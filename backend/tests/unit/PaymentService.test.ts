import PaymentService from '../../src/services/PaymentService';
import database from '../../src/utils/database';
import { NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');

const mockPayment = {
  id: 'pay-1',
  userId: 'user-1',
  consultationId: 'cons-1',
  bookingId: 'booking-1',
  amount: 100,
  currency: 'USD',
  status: 'completed',
  paymentMethod: 'credit_card',
  gatewayTransactionId: 'gw-123',
  refundAmount: null,
  refundReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      // getGatewayMode
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ value: 'sandbox' }] })
        .mockResolvedValueOnce({ rows: [mockPayment] });

      const result = await PaymentService.createPayment('user-1', {
        consultationId: 'cons-1',
        amount: 100,
        currency: 'USD',
        paymentMethod: 'credit_card',
      } as any);

      expect(result).toBeDefined();
      expect(result.amount).toBe(100);
    });

    it('should handle missing gateway mode gracefully', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })        // no gateway setting
        .mockResolvedValueOnce({ rows: [mockPayment] });

      const result = await PaymentService.createPayment('user-1', {
        consultationId: 'cons-1',
        amount: 50,
      } as any);

      expect(result).toBeDefined();
    });
  });

  describe('getPayment', () => {
    it('should return payment by id', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPayment] });

      const result = await PaymentService.getPayment('pay-1');
      expect(result).toEqual(mockPayment);
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('payments'),
        ['pay-1']
      );
    });

    it('should throw NotFoundError if payment not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(PaymentService.getPayment('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getPaymentByBooking', () => {
    it('should return payment by booking id', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPayment] });

      const result = await PaymentService.getPaymentByBooking('booking-1');
      expect(result).toEqual(mockPayment);
    });

    it('should return null if no payment for booking', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await PaymentService.getPaymentByBooking('booking-999');
      expect(result).toBeNull();
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      const refunded = { ...mockPayment, status: 'refunded', refundAmount: 100, refundReason: 'Doctor cancelled' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [refunded] });

      const result = await PaymentService.processRefund('pay-1', 100, 'Doctor cancelled');
      expect(result.status).toBe('refunded');
      expect(result.refundAmount).toBe(100);
    });

    it('should throw NotFoundError if payment not found for refund', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(PaymentService.processRefund('non-existent', 50, 'reason')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listPaymentsByUser', () => {
    it('should list payments with pagination', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockPayment] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await PaymentService.listPaymentsByUser('user-1', 10, 0);
      expect(result.payments).toHaveLength(1);
      expect(result.total).toBe(5);
    });

    it('should return empty list if no payments', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await PaymentService.listPaymentsByUser('user-1');
      expect(result.payments).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getGatewaySettings', () => {
    it('should return gateway settings', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [{ key: 'payment.gateway.mode', value: 'sandbox' }, { key: 'payment.gateway.provider', value: 'stripe' }]
      });

      const result = await PaymentService.getGatewaySettings();
      expect(result).toBeDefined();
    });
  });
});
