/**
 * Payment module shared types (docs/PAYMENT_MODULE_PLAN.md §3).
 * All amounts are in INR rupees (DECIMAL(10,2) semantics), NOT paise —
 * gateway adapters convert to paise internally where their API requires it.
 */

export type PaymentGatewayMode = 'demo' | 'razorpay_test' | 'razorpay_live';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'expired'
  | 'transferred';

export interface GatewayOrder {
  /** Gateway-side order id (e.g. Razorpay order_xxx, demo demo_order_xxx) */
  gatewayOrderId: string;
  /** Amount in rupees the order was created for */
  amount: number;
  currency: string;
  /** Extra fields the frontend checkout needs (e.g. Razorpay key id) */
  checkoutPayload: Record<string, unknown>;
}

export interface GatewayRefund {
  gatewayRefundId: string;
  amount: number;
  status: 'processed' | 'pending' | 'failed';
}

export interface GatewayPaymentStatus {
  gatewayPaymentId: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  amount: number;
  /** Actual fee the gateway charged on this payment (rupees) — basis for D12 fee recovery */
  fee: number;
  method?: string;
}

/**
 * Gateway adapter contract. Implementations: DemoGateway (P0), RazorpayGateway (P2).
 * Selected at runtime from the system setting `payment.gatewayMode`.
 */
export interface PaymentGateway {
  readonly mode: PaymentGatewayMode;

  /** Create a gateway order for checkout. `receipt` is our payment UUID. */
  createOrder(amount: number, currency: string, receipt: string, notes?: Record<string, string>): Promise<GatewayOrder>;

  /** Verify a webhook payload signature (raw body + signature header). */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  /** Verify the client-side checkout success signature (order id + payment id + signature). */
  verifyCheckoutSignature(gatewayOrderId: string, gatewayPaymentId: string, signature: string): boolean;

  /** Issue a (full or partial) refund against a captured gateway payment. */
  refund(gatewayPaymentId: string, amount: number, notes?: Record<string, string>): Promise<GatewayRefund>;

  /** Fetch current gateway-side status of a payment — used by the reconciliation sweep. */
  fetchPayment(gatewayPaymentId: string): Promise<GatewayPaymentStatus>;
}
