import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface Payment {
  id: string;
  consultationId: string;
  bookingId?: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  gateway: string;
  refundAmount?: number;
  refundReason?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentCreateDTO {
  consultationId: string;
  bookingId?: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
}

export class PaymentService {
  /**
   * Get payment gateway mode from system settings.
   * Returns 'demo' | 'test' | 'live'
   */
  private async getGatewayMode(): Promise<string> {
    try {
      const result = await database.query(
        `SELECT value FROM system_settings WHERE key = 'payment.gatewayMode'`
      );
      return result.rows[0]?.value || 'demo';
    } catch { return 'demo'; }
  }

  /**
   * Creates a payment record. In demo mode, payment is immediately marked
   * as "completed". In test/live mode, this would create a gateway intent
   * and set status to "processing".
   */
  async createPayment(userId: string, data: PaymentCreateDTO): Promise<Payment> {
    try {
      const id = uuidv4();
      const gatewayMode = await this.getGatewayMode();
      const isDemoMode = gatewayMode === 'demo';

      const status = isDemoMode ? 'completed' : 'processing';
      const gateway = isDemoMode ? 'stub' : gatewayMode;
      const transactionId = isDemoMode ? `DEMO-${id.substring(0, 8).toUpperCase()}` : null;

      const query = `
        INSERT INTO payments (id, consultation_id, booking_id, user_id, amount, currency, status, payment_method, gateway, transaction_id, paid_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${isDemoMode ? 'NOW()' : 'NULL'}, NOW(), NOW())
        RETURNING id, consultation_id as "consultationId", booking_id as "bookingId",
                  user_id as "userId", amount, currency,
                  status, payment_method as "paymentMethod", transaction_id as "transactionId",
                  gateway, refund_amount as "refundAmount", refund_reason as "refundReason",
                  paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, data.consultationId, data.bookingId || null, userId, data.amount,
        data.currency || 'INR', status, data.paymentMethod || 'card',
        gateway, transactionId,
      ]);
      logger.info(`Payment created (${gatewayMode})`, { id, userId, amount: data.amount });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating payment', { originalError: error });
    }
  }

  async getPayment(paymentId: string): Promise<Payment> {
    try {
      const query = `
        SELECT id, consultation_id as "consultationId", booking_id as "bookingId",
               user_id as "userId", amount, currency,
               status, payment_method as "paymentMethod", transaction_id as "transactionId",
               gateway, refund_amount as "refundAmount", refund_reason as "refundReason",
               paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
        FROM payments WHERE id = $1
      `;
      const result = await database.query(query, [paymentId]);
      if (result.rows.length === 0) throw new NotFoundError('Payment', paymentId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching payment', { originalError: error });
    }
  }

  /** Find payment linked to a booking */
  async getPaymentByBooking(bookingId: string): Promise<Payment | null> {
    try {
      const result = await database.query(
        `SELECT id, consultation_id as "consultationId", booking_id as "bookingId",
                user_id as "userId", amount, currency,
                status, payment_method as "paymentMethod", transaction_id as "transactionId",
                gateway, refund_amount as "refundAmount", refund_reason as "refundReason",
                paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
         FROM payments WHERE booking_id = $1 AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1`,
        [bookingId]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Error fetching payment by booking', { originalError: error });
    }
  }

  /** Process a refund for a payment */
  async processRefund(paymentId: string, amount: number, reason: string): Promise<Payment> {
    try {
      const gatewayMode = await this.getGatewayMode();
      // In demo mode, refund is instant. In live mode, this would call gateway API.
      const result = await database.query(
        `UPDATE payments SET status = 'refunded', refund_amount = $1, refund_reason = $2,
                updated_at = NOW()
         WHERE id = $3 AND status = 'completed'
         RETURNING id, consultation_id as "consultationId", booking_id as "bookingId",
                   user_id as "userId", amount, currency,
                   status, refund_amount as "refundAmount", refund_reason as "refundReason",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [amount, reason, paymentId]
      );
      if (result.rows.length === 0) throw new NotFoundError('Payment (completed)', paymentId);
      logger.info(`Refund processed (${gatewayMode})`, { paymentId, amount, reason });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error processing refund', { originalError: error });
    }
  }

  async listPaymentsByUser(userId: string, limit: number = 20, offset: number = 0): Promise<{ payments: Payment[]; total: number }> {
    try {
      const query = `
        SELECT p.id, p.consultation_id as "consultationId", p.booking_id as "bookingId",
               p.user_id as "userId", p.amount, p.currency,
               p.status, p.payment_method as "paymentMethod", p.gateway,
               p.refund_amount as "refundAmount", p.refund_reason as "refundReason",
               p.paid_at as "paidAt", p.created_at as "createdAt", p.updated_at as "updatedAt",
               COALESCE(p.payment_source, 'consultation') as "paymentSource",
               p.dispensing_id as "dispensingId", hp.pharmacy_name as "pharmacyName"
        FROM payments p
        LEFT JOIN dispensing_records dr ON dr.id = p.dispensing_id
        LEFT JOIN hospital_pharmacies hp ON hp.id = dr.pharmacy_id
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM payments WHERE user_id = $1`;
      const [paymentsResult, countResult] = await Promise.all([
        database.query(query, [userId, limit, offset]),
        database.query(countQuery, [userId]),
      ]);
      return {
        payments: paymentsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing payments', { originalError: error });
    }
  }

  /** Get payment gateway settings (for admin display) */
  async getGatewaySettings(): Promise<Record<string, string>> {
    try {
      const result = await database.query(
        `SELECT key, value FROM system_settings WHERE key LIKE 'payment.gateway%'`
      );
      const settings: Record<string, string> = {};
      result.rows.forEach((r: any) => { settings[r.key] = r.value; });
      return settings;
    } catch { return {}; }
  }
}

export default new PaymentService();
