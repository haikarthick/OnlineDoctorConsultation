import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface Payment {
  id: string;
  consultationId: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  gateway: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentCreateDTO {
  consultationId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
}

export class PaymentService {
  /**
   * Creates a payment record. In the stub implementation, payment is
   * immediately marked as "completed". When Stripe is enabled, this
   * will create a Stripe PaymentIntent and set status to "processing".
   */
  async createPayment(userId: string, data: PaymentCreateDTO): Promise<Payment> {
    try {
      const id = uuidv4();
      // Stub: auto-complete. Replace with Stripe integration when FEATURE_PAYMENTS is live.
      const query = `
        INSERT INTO payments (id, consultation_id, user_id, amount, currency, status, payment_method, gateway, paid_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'completed', $6, 'stub', NOW(), NOW(), NOW())
        RETURNING id, consultation_id as "consultationId", user_id as "userId", amount, currency,
                  status, payment_method as "paymentMethod", transaction_id as "transactionId",
                  gateway, paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, data.consultationId, userId, data.amount,
        data.currency || 'USD', data.paymentMethod || 'card',
      ]);
      logger.info('Payment created (stub)', { id, userId, amount: data.amount });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating payment', { originalError: error });
    }
  }

  async getPayment(paymentId: string): Promise<Payment> {
    try {
      const query = `
        SELECT id, consultation_id as "consultationId", user_id as "userId", amount, currency,
               status, payment_method as "paymentMethod", transaction_id as "transactionId",
               gateway, paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
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

  async listPaymentsByUser(userId: string, limit: number = 20, offset: number = 0): Promise<{ payments: Payment[]; total: number }> {
    try {
      const query = `
        SELECT id, consultation_id as "consultationId", user_id as "userId", amount, currency,
               status, payment_method as "paymentMethod", gateway, paid_at as "paidAt",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM payments WHERE user_id = $1
        ORDER BY created_at DESC LIMIT $2 OFFSET $3
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
}

export default new PaymentService();
