import { v4 as uuidv4 } from 'uuid';
import {
  PaymentGateway, PaymentGatewayMode, GatewayOrder, GatewayRefund, GatewayPaymentStatus,
} from '../types';

/**
 * Demo gateway (docs/PAYMENT_MODULE_PLAN.md §3) — makes the entire payment
 * lifecycle exercisable locally and on environments without Razorpay keys.
 *
 * Behavior notes:
 *  - Orders/payments/refunds always succeed; signatures always verify.
 *  - Simulates a 2% gateway fee so the D12 fee-recovery logic (cancellation
 *    processing charge, doctor-cancel penalty) is testable in demo mode with
 *    realistic non-zero numbers.
 */
const DEMO_FEE_PERCENT = 2;

/** In-memory record of demo payments so fetchPayment() can reconcile realistically. */
const demoPayments = new Map<string, GatewayPaymentStatus>();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class DemoGateway implements PaymentGateway {
  readonly mode: PaymentGatewayMode = 'demo';

  async createOrder(amount: number, currency: string, receipt: string, notes?: Record<string, string>): Promise<GatewayOrder> {
    const gatewayOrderId = `demo_order_${uuidv4().replace(/-/g, '').substring(0, 14)}`;
    return {
      gatewayOrderId,
      amount,
      currency,
      checkoutPayload: {
        demo: true,
        orderId: gatewayOrderId,
        amount,
        currency,
        receipt,
        notes: notes || {},
      },
    };
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    return true;
  }

  verifyCheckoutSignature(_gatewayOrderId: string, _gatewayPaymentId: string, _signature: string): boolean {
    return true;
  }

  /**
   * Demo checkout "capture" — called by the orchestrator when the simulated
   * checkout succeeds. Returns the captured payment with its simulated fee.
   */
  capturePayment(gatewayOrderId: string, amount: number): GatewayPaymentStatus {
    const gatewayPaymentId = `demo_pay_${gatewayOrderId.replace('demo_order_', '')}`;
    const status: GatewayPaymentStatus = {
      gatewayPaymentId,
      status: 'captured',
      amount,
      fee: round2(amount * DEMO_FEE_PERCENT / 100),
      method: 'demo',
    };
    demoPayments.set(gatewayPaymentId, status);
    return status;
  }

  async refund(gatewayPaymentId: string, amount: number, _notes?: Record<string, string>): Promise<GatewayRefund> {
    const existing = demoPayments.get(gatewayPaymentId);
    if (existing) {
      demoPayments.set(gatewayPaymentId, { ...existing, status: 'refunded' });
    }
    return {
      gatewayRefundId: `demo_rfnd_${uuidv4().replace(/-/g, '').substring(0, 14)}`,
      amount,
      status: 'processed',
    };
  }

  async fetchPayment(gatewayPaymentId: string): Promise<GatewayPaymentStatus> {
    const known = demoPayments.get(gatewayPaymentId);
    if (known) return known;
    // Unknown id (e.g. server restarted): treat demo payments as captured with simulated fee unknown
    return { gatewayPaymentId, status: 'captured', amount: 0, fee: 0, method: 'demo' };
  }
}

export default new DemoGateway();
