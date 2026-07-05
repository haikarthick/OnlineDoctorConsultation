import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import logger from '../../../utils/logger';
import {
  PaymentGateway, PaymentGatewayMode, GatewayOrder, GatewayRefund, GatewayPaymentStatus,
} from '../types';

/**
 * Razorpay adapter (docs/PAYMENT_MODULE_PLAN.md P2).
 *
 * - Amounts cross this boundary in RUPEES; Razorpay's API works in PAISE —
 *   conversion happens ONLY here.
 * - Keys come from env vars (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
 *   RAZORPAY_WEBHOOK_SECRET) — never from system_settings (§12 rule 6).
 * - Signature checks use timing-safe comparison.
 */

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  try {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(actualHex, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

export class RazorpayGateway implements PaymentGateway {
  readonly mode: PaymentGatewayMode;
  private http: AxiosInstance;

  constructor(mode: 'razorpay_test' | 'razorpay_live') {
    this.mode = mode;
    if (!this.keyId || !this.keySecret) {
      throw new Error(
        `Razorpay gateway mode '${mode}' selected but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars are not set.`
      );
    }
    this.http = axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      auth: { username: this.keyId, password: this.keySecret },
      timeout: 20000,
    });
  }

  private get keyId(): string { return process.env.RAZORPAY_KEY_ID || ''; }
  private get keySecret(): string { return process.env.RAZORPAY_KEY_SECRET || ''; }
  private get webhookSecret(): string { return process.env.RAZORPAY_WEBHOOK_SECRET || ''; }

  async createOrder(amount: number, currency: string, receipt: string, notes?: Record<string, string>): Promise<GatewayOrder> {
    const resp = await this.http.post('/orders', {
      amount: toPaise(amount),
      currency: currency || 'INR',
      receipt,
      notes: notes || {},
    });
    const order = resp.data;
    return {
      gatewayOrderId: order.id,
      amount,
      currency: order.currency,
      checkoutPayload: {
        keyId: this.keyId,
        orderId: order.id,
        amountPaise: order.amount,
        currency: order.currency,
      },
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
      return false;
    }
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return timingSafeEqualHex(expected, signature || '');
  }

  verifyCheckoutSignature(gatewayOrderId: string, gatewayPaymentId: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');
    return timingSafeEqualHex(expected, signature || '');
  }

  async refund(gatewayPaymentId: string, amount: number, notes?: Record<string, string>): Promise<GatewayRefund> {
    const resp = await this.http.post(`/payments/${gatewayPaymentId}/refund`, {
      amount: toPaise(amount),
      notes: notes || {},
    });
    const r = resp.data;
    return {
      gatewayRefundId: r.id,
      amount: toRupees(r.amount),
      status: r.status === 'processed' ? 'processed' : (r.status === 'failed' ? 'failed' : 'pending'),
    };
  }

  async fetchPayment(gatewayPaymentId: string): Promise<GatewayPaymentStatus> {
    const resp = await this.http.get(`/payments/${gatewayPaymentId}`);
    const p = resp.data;
    return this.mapPayment(p);
  }

  /** Reconciliation helper: all payments attempted against an order. */
  async fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPaymentStatus[]> {
    const resp = await this.http.get(`/orders/${gatewayOrderId}/payments`);
    const items = resp.data?.items || [];
    return items.map((p: any) => this.mapPayment(p));
  }

  private mapPayment(p: any): GatewayPaymentStatus {
    const statusMap: Record<string, GatewayPaymentStatus['status']> = {
      created: 'created', authorized: 'authorized', captured: 'captured',
      refunded: 'refunded', failed: 'failed',
    };
    return {
      gatewayPaymentId: p.id,
      status: statusMap[p.status] || 'failed',
      amount: toRupees(p.amount || 0),
      fee: toRupees((p.fee || 0)),
      method: p.method,
    };
  }
}

export default RazorpayGateway;
