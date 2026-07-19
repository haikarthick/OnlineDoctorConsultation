import { v4 as uuidv4 } from 'uuid';
import database from '../../utils/database';
import logger from '../../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError, DatabaseError } from '../../utils/errors';
import PaymentModuleConfig from './PaymentModuleConfig';
import NotificationService from '../NotificationService';

/**
 * Withdrawal / settlement workflow (docs/PAYMENT_MODULE_PLAN.md §6.3, D3).
 *
 * Model: a withdrawal always covers the doctor's FULL available balance at
 * request time (keeps the ledger row-granular with no row splitting). The
 * request locks those rows (available → locked) so nothing double-spends.
 *
 * requested → approved → settled (UTR recorded)
 * requested → rejected / cancelled  (rows unlock back to available)
 *
 * Admin discretionary payout (owner rule): admin can settle a doctor's
 * available balance in one step, below the minimum threshold, with a note.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

class WithdrawalService {
  /** Doctor requests withdrawal of the full available balance. */
  async requestWithdrawal(doctorId: string): Promise<any> {
    if (!(await PaymentModuleConfig.isEnabled())) {
      throw new ValidationError('Payments are not enabled on this platform.');
    }

    // Payout details must exist before money can be sent anywhere (§10 doctor)
    const profile = await database.query(
      `SELECT payout_account_number, payout_ifsc, payout_upi FROM vet_profiles WHERE user_id = $1`,
      [doctorId]
    );
    const prof = profile.rows[0];
    if (!prof || (!(prof.payout_account_number && prof.payout_ifsc) && !prof.payout_upi)) {
      throw new ValidationError('Please add your payout bank account (or UPI) details before requesting a withdrawal.');
    }

    const open = await database.query(
      `SELECT id FROM withdrawal_requests WHERE doctor_id = $1 AND status IN ('requested', 'approved') LIMIT 1`,
      [doctorId]
    );
    if (open.rows.length > 0) {
      throw new ValidationError('You already have a withdrawal request in progress.');
    }

    const minAmount = await PaymentModuleConfig.getMinWithdrawalAmount();
    const tdsRate = await PaymentModuleConfig.getTdsRatePercent();

    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      // Lock all available rows for this doctor (row order stabilized by id)
      const rows = await client.query(
        `SELECT id, net_amount FROM doctor_earnings
         WHERE doctor_id = $1 AND status = 'available'
         ORDER BY created_at ASC FOR UPDATE`,
        [doctorId]
      );
      const available = round2(rows.rows.reduce((s: number, r: any) => s + parseFloat(String(r.net_amount)), 0));
      if (available <= 0) {
        throw new ValidationError('No positive available balance to withdraw.');
      }
      if (available < minAmount) {
        throw new ValidationError(`Minimum withdrawal amount is ${minAmount}. Your available balance is ${available}.`);
      }

      const withdrawalId = uuidv4();
      const tdsAmount = round2(available * tdsRate / 100);
      const netPaid = round2(available - tdsAmount);
      await client.query(
        `INSERT INTO withdrawal_requests
           (id, doctor_id, amount, tds_rate, tds_amount, net_paid_amount, status, is_discretionary, requested_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'requested', false, NOW(), NOW(), NOW())`,
        [withdrawalId, doctorId, available, tdsRate, tdsAmount, netPaid]
      );
      await client.query(
        `UPDATE doctor_earnings SET status = 'locked', withdrawal_id = $1, updated_at = NOW()
         WHERE doctor_id = $2 AND status = 'available'`,
        [withdrawalId, doctorId]
      );
      await client.query('COMMIT');
      logger.info('Withdrawal requested', { withdrawalId, doctorId, amount: available });
      return { id: withdrawalId, amount: available, tdsRate, tdsAmount, netPaidAmount: netPaid, status: 'requested' };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Error creating withdrawal request', { originalError: err });
    } finally {
      client.release();
    }
  }

  /** Doctor cancels their own pending request — rows unlock. */
  async cancelRequest(doctorId: string, withdrawalId: string): Promise<void> {
    const res = await database.query(
      `UPDATE withdrawal_requests SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND doctor_id = $2 AND status = 'requested' RETURNING id`,
      [withdrawalId, doctorId]
    );
    if (res.rows.length === 0) {
      throw new ValidationError('Only your own pending requests can be cancelled.');
    }
    await this.unlockRows(withdrawalId);
    logger.info('Withdrawal cancelled by doctor', { withdrawalId, doctorId });
  }

  async listMyWithdrawals(doctorId: string): Promise<any[]> {
    const res = await database.query(
      `SELECT id, amount, tds_rate as "tdsRate", tds_amount as "tdsAmount",
              net_paid_amount as "netPaidAmount", status, is_discretionary as "isDiscretionary",
              requested_at as "requestedAt", settled_at as "settledAt",
              utr_reference as "utrReference", rejection_reason as "rejectionReason"
       FROM withdrawal_requests WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [doctorId]
    );
    return res.rows;
  }

  // ── Admin console ───────────────────────────────────────────

  async adminList(status?: string): Promise<any[]> {
    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE wr.status = $1`; }
    const res = await database.query(
      `SELECT wr.id, wr.amount, wr.tds_rate as "tdsRate", wr.tds_amount as "tdsAmount",
              wr.net_paid_amount as "netPaidAmount", wr.status, wr.is_discretionary as "isDiscretionary",
              wr.requested_at as "requestedAt", wr.reviewed_at as "reviewedAt", wr.settled_at as "settledAt",
              wr.utr_reference as "utrReference", wr.admin_note as "adminNote",
              wr.rejection_reason as "rejectionReason",
              wr.doctor_id as "doctorId",
              CONCAT(u.first_name, ' ', u.last_name) as "doctorName", u.email as "doctorEmail",
              vp.payout_account_name as "payoutAccountName", vp.payout_account_number as "payoutAccountNumber",
              vp.payout_ifsc as "payoutIfsc", vp.payout_upi as "payoutUpi",
              EXTRACT(DAY FROM NOW() - wr.requested_at)::int as "ageDays"
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.doctor_id
       LEFT JOIN vet_profiles vp ON vp.user_id = wr.doctor_id
       ${where}
       ORDER BY CASE wr.status WHEN 'requested' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                wr.requested_at ASC
       LIMIT 200`,
      params
    );
    return res.rows;
  }

  async adminApprove(withdrawalId: string, adminId: string, note?: string): Promise<void> {
    const res = await database.query(
      `UPDATE withdrawal_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(),
              admin_note = COALESCE($2, admin_note), updated_at = NOW()
       WHERE id = $3 AND status = 'requested' RETURNING doctor_id`,
      [adminId, note || null, withdrawalId]
    );
    if (res.rows.length === 0) throw new ValidationError('Only pending requests can be approved.');
    await this.notifyDoctor(res.rows[0].doctor_id, 'Withdrawal Approved',
      'Your withdrawal request has been approved and will be settled shortly.');
  }

  async adminReject(withdrawalId: string, adminId: string, reason: string): Promise<void> {
    const res = await database.query(
      `UPDATE withdrawal_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
              rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status IN ('requested', 'approved') RETURNING doctor_id`,
      [adminId, reason, withdrawalId]
    );
    if (res.rows.length === 0) throw new ValidationError('Only pending or approved requests can be rejected.');
    await this.unlockRows(withdrawalId);
    await this.notifyDoctor(res.rows[0].doctor_id, 'Withdrawal Rejected',
      `Your withdrawal request was rejected: ${reason}. The amount is back in your available balance.`);
  }

  /** Settle: bank/UPI transfer done outside the app; UTR recorded here. */
  async adminSettle(withdrawalId: string, adminId: string, utrReference: string, note?: string): Promise<void> {
    const res = await database.query(
      `UPDATE withdrawal_requests SET status = 'settled', settled_by = $1, settled_at = NOW(),
              utr_reference = $2, admin_note = COALESCE($3, admin_note), updated_at = NOW()
       WHERE id = $4 AND status IN ('requested', 'approved') RETURNING doctor_id, net_paid_amount`,
      [adminId, utrReference, note || null, withdrawalId]
    );
    if (res.rows.length === 0) throw new ValidationError('Only pending or approved requests can be settled.');
    await database.query(
      `UPDATE doctor_earnings SET status = 'withdrawn', updated_at = NOW() WHERE withdrawal_id = $1 AND status = 'locked'`,
      [withdrawalId]
    );
    await this.notifyDoctor(res.rows[0].doctor_id, 'Withdrawal Settled',
      `Your withdrawal has been settled (ref: ${utrReference}). Net amount paid: ${res.rows[0].net_paid_amount}.`);
    // §7: commission invoice for this settlement (non-blocking, idempotent)
    try {
      const InvoiceService = (await import('./InvoiceService')).default;
      await InvoiceService.createCommissionInvoice(withdrawalId);
    } catch (err: any) {
      logger.warn('Commission invoice creation failed (non-blocking)', { withdrawalId, error: err.message });
    }
    logger.info('Withdrawal settled', { withdrawalId, adminId, utrReference });
  }

  /**
   * Discretionary payout (owner rule): admin settles a doctor's available
   * balance in one step, bypassing the minimum threshold. Requires a note.
   */
  async adminDiscretionaryPayout(doctorId: string, adminId: string, utrReference: string, note: string): Promise<any> {
    if (!note || !note.trim()) throw new ValidationError('A note is required for discretionary payouts.');
    const tdsRate = await PaymentModuleConfig.getTdsRatePercent();

    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      const rows = await client.query(
        `SELECT id, net_amount FROM doctor_earnings
         WHERE doctor_id = $1 AND status = 'available'
         ORDER BY created_at ASC FOR UPDATE`,
        [doctorId]
      );
      const available = round2(rows.rows.reduce((s: number, r: any) => s + parseFloat(String(r.net_amount)), 0));
      if (available <= 0) throw new ValidationError('This doctor has no positive available balance.');

      const withdrawalId = uuidv4();
      const tdsAmount = round2(available * tdsRate / 100);
      const netPaid = round2(available - tdsAmount);
      await client.query(
        `INSERT INTO withdrawal_requests
           (id, doctor_id, amount, tds_rate, tds_amount, net_paid_amount, status, is_discretionary,
            requested_at, reviewed_by, reviewed_at, settled_by, settled_at, utr_reference, admin_note, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'settled', true, NOW(), $7, NOW(), $7, NOW(), $8, $9, NOW(), NOW())`,
        [withdrawalId, doctorId, available, tdsRate, tdsAmount, netPaid, adminId, utrReference, note]
      );
      await client.query(
        `UPDATE doctor_earnings SET status = 'withdrawn', withdrawal_id = $1, updated_at = NOW()
         WHERE doctor_id = $2 AND status = 'available'`,
        [withdrawalId, doctorId]
      );
      await client.query('COMMIT');
      logger.info('Discretionary payout settled', { withdrawalId, doctorId, adminId, amount: available });
      await this.notifyDoctor(doctorId, 'Payout Settled',
        `The platform has settled your earnings of ${available} (net ${netPaid} after TDS, ref: ${utrReference}).`);
      // §7: commission invoice for this settlement (non-blocking, idempotent)
      try {
        const InvoiceService = (await import('./InvoiceService')).default;
        await InvoiceService.createCommissionInvoice(withdrawalId);
      } catch (invErr: any) {
        logger.warn('Commission invoice creation failed (non-blocking)', { withdrawalId, error: invErr.message });
      }
      return { id: withdrawalId, amount: available, tdsAmount, netPaidAmount: netPaid };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Error processing discretionary payout', { originalError: err });
    } finally {
      client.release();
    }
  }

  /** Doctors with negative available balances (deep-negative console flag, §6.2). */
  async adminNegativeBalances(): Promise<any[]> {
    const res = await database.query(
      `SELECT de.doctor_id as "doctorId",
              CONCAT(u.first_name, ' ', u.last_name) as "doctorName", u.email,
              ROUND(SUM(de.net_amount) FILTER (WHERE de.status = 'available')::numeric, 2) as "available"
       FROM doctor_earnings de JOIN users u ON u.id = de.doctor_id
       GROUP BY de.doctor_id, u.first_name, u.last_name, u.email
       HAVING COALESCE(SUM(de.net_amount) FILTER (WHERE de.status = 'available'), 0) < 0
       ORDER BY SUM(de.net_amount) FILTER (WHERE de.status = 'available') ASC`
    );
    return res.rows;
  }

  private async unlockRows(withdrawalId: string): Promise<void> {
    await database.query(
      `UPDATE doctor_earnings SET status = 'available', withdrawal_id = NULL, updated_at = NOW()
       WHERE withdrawal_id = $1 AND status = 'locked'`,
      [withdrawalId]
    );
  }

  private async notifyDoctor(doctorId: string, title: string, message: string): Promise<void> {
    try {
      await NotificationService.createNotification(doctorId, 'payment', title, message, 'all', {});
    } catch { /* non-blocking */ }
  }
}

export default new WithdrawalService();
