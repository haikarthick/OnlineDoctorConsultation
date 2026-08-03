import PaymentOrchestrator from '../../src/services/payment/PaymentOrchestrator';
import PaymentModuleConfig from '../../src/services/payment/PaymentModuleConfig';
import { DemoGateway } from '../../src/services/payment/gateways/DemoGateway';
import database from '../../src/utils/database';

jest.mock('../../src/utils/database');

describe('Payment module money math (docs/PAYMENT_MODULE_PLAN.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // PaymentModuleConfig caches settings with a 60s TTL - clear between tests
    PaymentModuleConfig.invalidate();
  });

  describe('computeCommission (§5 - % + flat, snapshot semantics)', () => {
    it('applies percent + flat: 15% + ₹20 on ₹500 → ₹95 commission, ₹405 net', () => {
      const { commission, doctorNet } = PaymentOrchestrator.computeCommission(500, 15, 20);
      expect(commission).toBe(95);
      expect(doctorNet).toBe(405);
    });

    it('caps commission at gross for ultra-low fees (flat may never exceed gross)', () => {
      const { commission, doctorNet } = PaymentOrchestrator.computeCommission(10, 15, 20);
      expect(commission).toBe(10);
      expect(doctorNet).toBe(0);
    });

    it('rounds to 2 decimals', () => {
      const { commission, doctorNet } = PaymentOrchestrator.computeCommission(333, 15, 0);
      expect(commission).toBe(49.95);
      expect(doctorNet).toBe(283.05);
    });

    it('zero percent + zero flat → full net to doctor', () => {
      const { commission, doctorNet } = PaymentOrchestrator.computeCommission(750, 0, 0);
      expect(commission).toBe(0);
      expect(doctorNet).toBe(750);
    });
  });

  describe('getEffectiveCommission (§5 - per-doctor override ?? global)', () => {
    it('uses per-doctor overrides when set', async () => {
      (database.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
        if (/FROM system_settings WHERE key = \$1/.test(sql)) {
          const key = params?.[0];
          const map: Record<string, string> = { 'commission.defaultPercent': '15', 'commission.flatFee': '20' };
          return { rows: map[key] !== undefined ? [{ value: map[key] }] : [] };
        }
        if (/commission_percent_override/.test(sql)) {
          return { rows: [{ commission_percent_override: '10', commission_flat_override: '5' }] };
        }
        return { rows: [] };
      });
      const { percent, flat } = await PaymentOrchestrator.getEffectiveCommission('doc-1');
      expect(percent).toBe(10);
      expect(flat).toBe(5);
    });

    it('falls back to globals when overrides are null', async () => {
      (database.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
        if (/FROM system_settings WHERE key = \$1/.test(sql)) {
          const key = params?.[0];
          const map: Record<string, string> = { 'commission.defaultPercent': '18', 'commission.flatFee': '30' };
          return { rows: map[key] !== undefined ? [{ value: map[key] }] : [] };
        }
        if (/commission_percent_override/.test(sql)) {
          return { rows: [{ commission_percent_override: null, commission_flat_override: null }] };
        }
        return { rows: [] };
      });
      const { percent, flat } = await PaymentOrchestrator.getEffectiveCommission('doc-1');
      expect(percent).toBe(18);
      expect(flat).toBe(30);
    });
  });

  describe('computeRefundPreview (§4.3 matrix, D12 processing charge)', () => {
    const paymentRow = (scheduledInHours: number) => {
      const appt = new Date(Date.now() + scheduledInHours * 3600 * 1000);
      const datePart = `${appt.getFullYear()}-${String(appt.getMonth() + 1).padStart(2, '0')}-${String(appt.getDate()).padStart(2, '0')}`;
      const timePart = `${String(appt.getHours()).padStart(2, '0')}:${String(appt.getMinutes()).padStart(2, '0')}`;
      return {
        id: 'pay-1', amount: '500', gateway_fee_amount: '10',
        scheduled_date: datePart, time_slot_start: timePart,
      };
    };

    function setupPreviewMocks(hoursUntil: number, settings: Record<string, string> = {}) {
      const map: Record<string, string> = {
        'payment.enabled': 'true',
        'cancellation.patientFreeWindowHours': '24',
        'cancellation.partialRefundPercent': '50',
        'cancellation.partialRefundWindowHours': '2',
        'cancellation.processingFlatFee': '25',
        'cancellation.goodwillBonusPercent': '10',
        ...settings,
      };
      (database.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
        if (/FROM system_settings WHERE key = \$1/.test(sql)) {
          const key = params?.[0];
          return { rows: map[key] !== undefined ? [{ value: map[key] }] : [] };
        }
        if (/FROM payments p JOIN bookings b/.test(sql)) {
          return { rows: [paymentRow(hoursUntil)] };
        }
        return { rows: [] };
      });
    }

    it('doctor cancel → full refund + goodwill bonus, zero processing charge', async () => {
      setupPreviewMocks(48);
      const p = await PaymentOrchestrator.computeRefundPreview('b-1', 'veterinarian');
      expect(p.refundAmount).toBe(500);
      expect(p.bonusAmount).toBe(50); // 10% of 500
      expect(p.processingCharge).toBe(0);
      expect(p.policy).toBe('doctor_cancel_full_refund');
    });

    it('patient free window → full refund minus processing charge (gateway fee + flat)', async () => {
      setupPreviewMocks(48);
      const p = await PaymentOrchestrator.computeRefundPreview('b-1', 'pet_owner');
      // 500 − (10 gateway fee + 25 flat) = 465
      expect(p.refundAmount).toBe(465);
      expect(p.processingCharge).toBe(35);
      expect(p.policy).toBe('patient_free_window');
    });

    it('patient partial window → 50% minus processing charge', async () => {
      setupPreviewMocks(6);
      const p = await PaymentOrchestrator.computeRefundPreview('b-1', 'pet_owner');
      // 50% of 500 = 250; 250 − 35 = 215
      expect(p.refundAmount).toBe(215);
      expect(p.policy).toBe('patient_partial_window');
    });

    it('patient inside no-refund window → zero refund', async () => {
      setupPreviewMocks(1);
      const p = await PaymentOrchestrator.computeRefundPreview('b-1', 'pet_owner');
      expect(p.refundAmount).toBe(0);
      expect(p.policy).toBe('patient_no_refund_window');
    });

    it('processing charge never drives the refund negative', async () => {
      (database.query as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
        if (/FROM system_settings WHERE key = \$1/.test(sql)) {
          const map: Record<string, string> = {
            'payment.enabled': 'true', 'cancellation.patientFreeWindowHours': '24',
            'cancellation.partialRefundPercent': '50', 'cancellation.partialRefundWindowHours': '2',
            'cancellation.processingFlatFee': '100',
          };
          const key = params?.[0];
          return { rows: map[key] !== undefined ? [{ value: map[key] }] : [] };
        }
        if (/FROM payments p JOIN bookings b/.test(sql)) {
          const appt = new Date(Date.now() + 48 * 3600 * 1000);
          const datePart = `${appt.getFullYear()}-${String(appt.getMonth() + 1).padStart(2, '0')}-${String(appt.getDate()).padStart(2, '0')}`;
          return {
            rows: [{ id: 'p', amount: '50', gateway_fee_amount: '1', scheduled_date: datePart, time_slot_start: '10:00' }],
          };
        }
        return { rows: [] };
      });
      const p = await PaymentOrchestrator.computeRefundPreview('b-1', 'pet_owner');
      expect(p.refundAmount).toBe(0);
      expect(p.refundAmount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DemoGateway (P0/P2 - simulated fee for D12 testing)', () => {
    it('captures with a simulated 2% fee', async () => {
      const gw = new DemoGateway();
      const order = await gw.createOrder(500, 'INR', 'receipt-1');
      expect(order.gatewayOrderId).toMatch(/^demo_order_/);
      const captured = gw.capturePayment(order.gatewayOrderId, 500);
      expect(captured.status).toBe('captured');
      expect(captured.fee).toBe(10); // 2% of 500
    });

    it('refunds and reflects refunded status on fetch', async () => {
      const gw = new DemoGateway();
      const order = await gw.createOrder(300, 'INR', 'receipt-2');
      const captured = gw.capturePayment(order.gatewayOrderId, 300);
      const refund = await gw.refund(captured.gatewayPaymentId, 300);
      expect(refund.status).toBe('processed');
      const fetched = await gw.fetchPayment(captured.gatewayPaymentId);
      expect(fetched.status).toBe('refunded');
    });

    it('always verifies signatures (demo trust model)', () => {
      const gw = new DemoGateway();
      expect(gw.verifyWebhookSignature('anything', 'sig')).toBe(true);
      expect(gw.verifyCheckoutSignature('o', 'p', 's')).toBe(true);
    });
  });
});
