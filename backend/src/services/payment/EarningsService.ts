import { v4 as uuidv4 } from 'uuid';
import database from '../../utils/database';
import logger from '../../utils/logger';
import PaymentModuleConfig from './PaymentModuleConfig';
import NotificationService from '../NotificationService';

/**
 * Doctor earnings ledger (docs/PAYMENT_MODULE_PLAN.md §6, D3/D9/D12).
 *
 * Ledger invariants:
 *  - Append-only rows; status transitions clearing→available→locked→withdrawn,
 *    clearing→reversed. Penalties post as negative net_amount rows that are
 *    immediately 'available' (they reduce the running balance at once).
 *  - The doctor's available balance = SUM(net_amount) of rows in status
 *    'available' — penalties make it negative; recovery is automatic because
 *    new earnings mature into the same bucket (§6.2).
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type EarningType = 'consultation' | 'cancel_compensation' | 'no_show_compensation' | 'penalty' | 'adjustment';

class EarningsService {
  /**
   * Consultation completed → doctor's net share enters 'clearing' until
   * completed_at + settlement.clearanceDays (owner rule, D3).
   * Idempotent per (payment, type=consultation).
   */
  async createEarningOnCompletion(consultationId: string): Promise<void> {
    if (!(await PaymentModuleConfig.isEnabled())) return;
    try {
      const res = await database.query(
        `SELECT c.id as consultation_id, c.veterinarian_id, b.id as booking_id,
                p.id as payment_id, p.amount, p.commission_amount, p.doctor_earning_amount, p.status as payment_status
         FROM consultations c
         JOIN bookings b ON b.consultation_id = c.id
         JOIN payments p ON p.booking_id = b.id AND p.status IN ('completed', 'partially_refunded')
         WHERE c.id = $1
         ORDER BY p.created_at DESC LIMIT 1`,
        [consultationId]
      );
      if (res.rows.length === 0) return; // unpaid/legacy consultation — no ledger entry
      const row = res.rows[0];

      const existing = await database.query(
        `SELECT id FROM doctor_earnings WHERE payment_id = $1 AND type = 'consultation' LIMIT 1`,
        [row.payment_id]
      );
      if (existing.rows.length > 0) return; // idempotent

      const clearanceDays = await PaymentModuleConfig.getClearanceDays();
      const net = parseFloat(String(row.doctor_earning_amount ?? 0));
      const gross = parseFloat(String(row.amount));
      const commission = parseFloat(String(row.commission_amount ?? 0));
      if (net <= 0) return;

      await database.query(
        `INSERT INTO doctor_earnings
           (id, doctor_id, payment_id, booking_id, consultation_id, gross_amount, commission_amount,
            net_amount, type, status, reason, clear_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'consultation', 'clearing', $9,
                 NOW() + ($10 || ' days')::interval, NOW(), NOW())`,
        [uuidv4(), row.veterinarian_id, row.payment_id, row.booking_id, consultationId,
         gross, commission, net, 'Consultation completed', String(clearanceDays)]
      );
      logger.info('Doctor earning created (clearing)', { consultationId, doctorId: row.veterinarian_id, net });
    } catch (err: any) {
      logger.error('createEarningOnCompletion failed (non-blocking)', { consultationId, error: err.message });
    }
  }

  /**
   * Compensation entries (D6): doctor's share of retained money on late
   * patient cancel, or his net share on patient no-show. Enters 'clearing'
   * like normal earnings. Idempotent per (booking, type).
   */
  async createCompensation(params: {
    doctorId: string; bookingId: string; paymentId: string | null;
    type: 'cancel_compensation' | 'no_show_compensation';
    amount: number; reason: string;
  }): Promise<void> {
    if (params.amount <= 0) return;
    const existing = await database.query(
      `SELECT id FROM doctor_earnings WHERE booking_id = $1 AND type = $2 LIMIT 1`,
      [params.bookingId, params.type]
    );
    if (existing.rows.length > 0) return;
    const clearanceDays = await PaymentModuleConfig.getClearanceDays();
    await database.query(
      `INSERT INTO doctor_earnings
         (id, doctor_id, payment_id, booking_id, gross_amount, commission_amount, net_amount,
          type, status, reason, clear_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, $5, $6, 'clearing', $7, NOW() + ($8 || ' days')::interval, NOW(), NOW())`,
      [uuidv4(), params.doctorId, params.paymentId, params.bookingId,
       round2(params.amount), params.type, params.reason, String(clearanceDays)]
    );
    logger.info('Doctor compensation created', { ...params });
  }

  /**
   * Penalty (D9/D12): negative entry, immediately effective on the balance.
   * Doctor-cancel = goodwill bonus + non-recoverable gateway fee.
   * Idempotent per (booking, type=penalty).
   */
  async applyPenalty(params: {
    doctorId: string; bookingId: string; paymentId: string | null;
    amount: number; reason: string;
  }): Promise<void> {
    if (params.amount <= 0) return;
    const existing = await database.query(
      `SELECT id FROM doctor_earnings WHERE booking_id = $1 AND type = 'penalty' LIMIT 1`,
      [params.bookingId]
    );
    if (existing.rows.length > 0) return;
    await database.query(
      `INSERT INTO doctor_earnings
         (id, doctor_id, payment_id, booking_id, gross_amount, commission_amount, net_amount,
          type, status, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, 0, $5, 'penalty', 'available', $6, NOW(), NOW())`,
      [uuidv4(), params.doctorId, params.paymentId, params.bookingId,
       -Math.abs(round2(params.amount)), params.reason]
    );
    logger.info('Doctor penalty applied', { ...params });

    // Deep-negative alert (§6.2): notify admins when a doctor crosses the threshold
    try {
      const alertAmount = await PaymentModuleConfig.getNegativeBalanceAlertAmount();
      const bal = await this.getBalance(params.doctorId);
      if (bal.available < 0 && Math.abs(bal.available) >= alertAmount) {
        const admins = await database.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 5`);
        for (const a of admins.rows) {
          await NotificationService.createNotification(
            a.id, 'payment', 'Doctor Deep-Negative Balance Alert',
            `A doctor's earnings balance has fallen to ${bal.available.toFixed(2)} after cancellation penalties. Review their reliability.`,
            'all', { doctorId: params.doctorId }
          ).catch(() => {});
        }
      }
    } catch { /* alert best-effort */ }
  }

  /** Refund/dispute after completion (§4.3): reverse the clearing earning. */
  async reverseEarningForPayment(paymentId: string, reason: string): Promise<boolean> {
    const res = await database.query(
      `UPDATE doctor_earnings SET status = 'reversed', reason = CONCAT(reason, ' | reversed: ', $2::text), updated_at = NOW()
       WHERE payment_id = $1 AND type = 'consultation' AND status = 'clearing'
       RETURNING id, doctor_id`,
      [paymentId, reason]
    );
    if (res.rows.length > 0) {
      logger.info('Doctor earning reversed', { paymentId, reason });
      return true;
    }
    return false;
  }

  /** Scheduler: mature clearing → available once clear_at passes (§6.1). */
  async matureClearedEarnings(): Promise<number> {
    if (!(await PaymentModuleConfig.isEnabled())) return 0;
    const res = await database.query(
      `UPDATE doctor_earnings SET status = 'available', updated_at = NOW()
       WHERE status = 'clearing' AND clear_at IS NOT NULL AND clear_at <= NOW()
       RETURNING id, doctor_id, net_amount`
    );
    if (res.rows.length > 0) {
      logger.info(`Matured ${res.rows.length} doctor earning(s) to available`);
      // Notify doctors (grouped per doctor)
      const byDoctor = new Map<string, number>();
      for (const r of res.rows) {
        byDoctor.set(r.doctor_id, (byDoctor.get(r.doctor_id) || 0) + parseFloat(String(r.net_amount)));
      }
      for (const [doctorId, total] of byDoctor) {
        if (total > 0) {
          await NotificationService.createNotification(
            doctorId, 'payment', 'Earnings Available',
            `Earnings of ${total.toFixed(2)} have cleared and are now available for withdrawal.`,
            'all', {}
          ).catch(() => {});
        }
      }
    }
    return res.rows.length;
  }

  /** Balance buckets for the doctor dashboard and withdrawal gating. */
  async getBalance(doctorId: string): Promise<{
    clearing: number; available: number; locked: number; withdrawn: number; lifetime: number;
  }> {
    const res = await database.query(
      `SELECT
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'clearing'), 0) as clearing,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'available'), 0) as available,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'locked'), 0) as locked,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'withdrawn'), 0) as withdrawn,
         COALESCE(SUM(net_amount) FILTER (WHERE status IN ('available', 'locked', 'withdrawn', 'clearing')), 0) as lifetime
       FROM doctor_earnings WHERE doctor_id = $1`,
      [doctorId]
    );
    const r = res.rows[0];
    return {
      clearing: round2(parseFloat(r.clearing)),
      available: round2(parseFloat(r.available)),
      locked: round2(parseFloat(r.locked)),
      withdrawn: round2(parseFloat(r.withdrawn)),
      lifetime: round2(parseFloat(r.lifetime)),
    };
  }

  /** Statement rows with booking/patient context (§10 doctor persona). */
  async getStatement(doctorId: string, limit: number = 30, offset: number = 0): Promise<{ items: any[]; total: number }> {
    const countRes = await database.query(
      `SELECT COUNT(*) as count FROM doctor_earnings WHERE doctor_id = $1`, [doctorId]
    );
    const res = await database.query(
      `SELECT de.id, de.gross_amount as "grossAmount", de.commission_amount as "commissionAmount",
              de.net_amount as "netAmount", de.type, de.status, de.reason,
              de.clear_at as "clearAt", de.created_at as "createdAt",
              b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
              CONCAT(po.first_name, ' ', po.last_name) as "patientName",
              a.name as "animalName"
       FROM doctor_earnings de
       LEFT JOIN bookings b ON b.id = de.booking_id
       LEFT JOIN users po ON po.id = b.pet_owner_id
       LEFT JOIN animals a ON a.id = b.animal_id
       WHERE de.doctor_id = $1
       ORDER BY de.created_at DESC
       LIMIT $2 OFFSET $3`,
      [doctorId, limit, offset]
    );
    return { items: res.rows, total: parseInt(countRes.rows[0]?.count || '0', 10) };
  }
}

export default new EarningsService();
