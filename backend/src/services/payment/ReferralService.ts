import { v4 as uuidv4 } from 'uuid';
import database from '../../utils/database';
import logger from '../../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors';
import PaymentModuleConfig from './PaymentModuleConfig';
import PaymentOrchestrator from './PaymentOrchestrator';
import NotificationService from '../NotificationService';

/**
 * Platform referrals (docs/PAYMENT_MODULE_PLAN.md §4.4, D10).
 *
 * Pre-consultation referral = payment TRANSFER:
 *   The original payment is converted into an instant wallet credit
 *   ("wallet hop") and the patient books the new doctor through the normal
 *   checkout, where the wallet covers what was already paid and the gateway
 *   collects any difference. One code path handles cheaper AND costlier
 *   target doctors, commission is recomputed naturally at the new doctor's
 *   rate, and no gateway refund fee is ever incurred on a transfer.
 *
 * Post-consultation referral = informational record; patient books & pays
 * the specialist through the regular flow.
 *
 * Decline / expiry = doctor-cancellation treatment (D9): full refund +
 * goodwill bonus to patient, penalty on the referring doctor's ledger.
 */

class ReferralService {
  /** Doctor initiates a referral. Pre-consult needs bookingId; post-consult needs consultationId. */
  async createReferral(fromVetId: string, params: {
    toVetId: string | null; reason: string; bookingId?: string; consultationId?: string;
  }): Promise<any> {
    if (!params.reason || !params.reason.trim()) {
      throw new ValidationError('A reason for the referral is required.');
    }
    if (params.toVetId && params.toVetId === fromVetId) {
      throw new ValidationError('You cannot refer a patient to yourself.');
    }
    if (params.toVetId) {
      const target = await database.query(
        `SELECT u.id FROM users u JOIN vet_profiles vp ON vp.user_id = u.id
         WHERE u.id = $1 AND u.role = 'veterinarian' AND u.is_active = true`,
        [params.toVetId]
      );
      if (target.rows.length === 0) throw new NotFoundError('Target veterinarian', params.toVetId);
    }

    if (params.bookingId) {
      return this.createPreConsultReferral(fromVetId, params.toVetId, params.reason, params.bookingId);
    }
    if (params.consultationId) {
      return this.createPostConsultReferral(fromVetId, params.toVetId, params.reason, params.consultationId);
    }
    throw new ValidationError('Either bookingId (pre-consultation) or consultationId (post-consultation) is required.');
  }

  private async createPreConsultReferral(fromVetId: string, toVetId: string | null, reason: string, bookingId: string): Promise<any> {
    const bRes = await database.query(
      `SELECT id, pet_owner_id, veterinarian_id, animal_id, status, scheduled_date, time_slot_start
       FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (bRes.rows.length === 0) throw new NotFoundError('Booking', bookingId);
    const booking = bRes.rows[0];
    if (booking.veterinarian_id !== fromVetId) {
      throw new ForbiddenError('Only the booked doctor can refer this booking.');
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new ValidationError(`Only pending or confirmed bookings can be referred (status: ${booking.status}).`);
    }
    if (!(await PaymentModuleConfig.isEnabled())) {
      throw new ValidationError('Referral transfers require the payment module to be enabled.');
    }
    const pRes = await database.query(
      `SELECT id FROM payments WHERE booking_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );
    if (pRes.rows.length === 0) {
      throw new ValidationError('This booking has no completed payment to transfer.');
    }
    const existing = await database.query(
      `SELECT id FROM referrals WHERE booking_id = $1 AND transfer_status IN ('offered', 'accepted', 'rechosen') LIMIT 1`,
      [bookingId]
    );
    if (existing.rows.length > 0) {
      throw new ValidationError('An active referral already exists for this booking.');
    }

    const windowHours = await PaymentModuleConfig.getReferralActionWindowHours();
    const id = uuidv4();
    await database.query(
      `INSERT INTO referrals (id, referral_type, booking_id, payment_id, from_vet_id, to_vet_id, animal_id,
        reason, status, transfer_status, action_deadline, created_at, updated_at)
       VALUES ($1, 'platform', $2, $3, $4, $5, $6, $7, 'pending', 'offered',
               NOW() + ($8 || ' hours')::interval, NOW(), NOW())`,
      [id, bookingId, pRes.rows[0].id, fromVetId, toVetId, booking.animal_id, reason.trim(), String(windowHours)]
    );
    await database.query(
      `UPDATE bookings SET status = 'referred', updated_at = NOW() WHERE id = $1`,
      [bookingId]
    );
    try {
      await NotificationService.createNotification(
        booking.pet_owner_id, 'booking', 'Your Doctor Referred You',
        `Your doctor is unavailable and has referred your booking onward. Open Referrals to accept the referred doctor, choose another doctor, or take a full refund. You have ${windowHours} hours to decide.`,
        'all', { referralId: id, bookingId }
      );
    } catch { /* non-blocking */ }
    logger.info('Pre-consultation referral created', { referralId: id, bookingId, fromVetId, toVetId });
    return { id, transferStatus: 'offered', actionWindowHours: windowHours };
  }

  private async createPostConsultReferral(fromVetId: string, toVetId: string | null, reason: string, consultationId: string): Promise<any> {
    if (!toVetId) throw new ValidationError('Post-consultation referrals need a target doctor.');
    const cRes = await database.query(
      `SELECT id, user_id, veterinarian_id, animal_id, status FROM consultations WHERE id = $1`,
      [consultationId]
    );
    if (cRes.rows.length === 0) throw new NotFoundError('Consultation', consultationId);
    const c = cRes.rows[0];
    if (c.veterinarian_id !== fromVetId) {
      throw new ForbiddenError('Only the consulting doctor can refer this consultation.');
    }
    if (c.status !== 'completed') {
      throw new ValidationError('Post-consultation referrals require a completed consultation.');
    }
    const id = uuidv4();
    await database.query(
      `INSERT INTO referrals (id, referral_type, from_vet_id, to_vet_id, animal_id, reason, status,
        transfer_status, created_at, updated_at)
       VALUES ($1, 'platform', $2, $3, $4, $5, 'pending', NULL, NOW(), NOW())`,
      [id, fromVetId, toVetId, c.animal_id, reason.trim()]
    );
    try {
      await NotificationService.createNotification(
        c.user_id, 'booking', 'Specialist Referral',
        'Your doctor has referred you to a specialist for further care. You can book the specialist from Find Doctor — the referral history stays linked to your records.',
        'all', { referralId: id, consultationId }
      );
    } catch { /* non-blocking */ }
    logger.info('Post-consultation referral created', { referralId: id, consultationId, fromVetId, toVetId });
    return { id, transferStatus: null };
  }

  /**
   * Patient accepts (referred doctor) or re-chooses (any doctor):
   * wallet hop + new booking through the normal payment_pending flow.
   * Returns the new booking incl. paymentId for the standard checkout.
   */
  async acceptReferral(patientId: string, referralId: string, params: {
    veterinarianId?: string; scheduledDate: string; timeSlotStart: string; timeSlotEnd: string;
    bookingType?: string; reasonForVisit?: string;
  }): Promise<any> {
    const referral = await this.getActionableReferral(patientId, referralId);
    const targetVetId = params.veterinarianId || referral.to_vet_id;
    if (!targetVetId) throw new ValidationError('Choose a doctor to continue.');
    if (targetVetId === referral.from_vet_id) {
      throw new ValidationError('The referring doctor is unavailable — please choose a different doctor.');
    }
    const rechosen = !!(params.veterinarianId && params.veterinarianId !== referral.to_vet_id);

    // 1) Wallet hop: original payment → transferred + instant wallet credit
    await this.transferPaymentToWallet(referral, patientId, 'Referral transfer credit');

    // 2) New booking through the normal flow (payment_pending + hold at new fee;
    //    the standard checkout applies the wallet credit and collects any delta)
    const BookingService = (await import('../BookingService')).default;
    const newBooking = await BookingService.createBooking(patientId, {
      veterinarianId: targetVetId,
      animalId: referral.animal_id || undefined,
      scheduledDate: params.scheduledDate,
      timeSlotStart: params.timeSlotStart,
      timeSlotEnd: params.timeSlotEnd,
      bookingType: (params.bookingType || referral.booking_type || 'video_call') as any,
      priority: referral.priority || 'normal',
      reasonForVisit: params.reasonForVisit || referral.orig_reason || `Referred: ${referral.reason}`,
    } as any);

    await database.query(
      `UPDATE referrals SET transfer_status = $1, status = 'accepted', accepted_at = NOW(),
              to_vet_id = COALESCE($2, to_vet_id), updated_at = NOW()
       WHERE id = $3`,
      [rechosen ? 'rechosen' : 'accepted', params.veterinarianId || null, referralId]
    );
    try {
      await NotificationService.createNotification(
        referral.from_vet_id, 'booking', 'Referral Update',
        rechosen ? 'The patient chose a different doctor for the referred booking.' : 'The patient accepted your referral.',
        'all', { referralId }
      );
    } catch { /* non-blocking */ }
    logger.info('Referral accepted', { referralId, patientId, targetVetId, rechosen });
    return newBooking;
  }

  /** Patient declines → doctor-cancellation treatment on the original booking (D9). */
  async declineReferral(patientId: string, referralId: string, destination: 'wallet' | 'gateway' = 'wallet'): Promise<any> {
    const referral = await this.getActionableReferral(patientId, referralId);
    // Restore booking to a refundable state marker is unnecessary — refund works off payments
    const outcome = await PaymentOrchestrator.refundForCancellation(
      referral.booking_id, patientId, 'veterinarian', 'Referral declined — original doctor unavailable', destination
    );
    await database.query(
      `UPDATE referrals SET transfer_status = 'refunded', status = 'declined', updated_at = NOW() WHERE id = $1`,
      [referralId]
    );
    try {
      await NotificationService.createNotification(
        referral.from_vet_id, 'booking', 'Referral Declined',
        'The patient declined the referral and took a refund. The refund costs have been applied to your earnings ledger.',
        'all', { referralId }
      );
    } catch { /* non-blocking */ }
    logger.info('Referral declined with refund', { referralId, patientId });
    return outcome;
  }

  /** Scheduler: expire un-actioned offers → auto-refund (charged to referring doctor). */
  async expireStaleReferrals(): Promise<number> {
    if (!(await PaymentModuleConfig.isEnabled())) return 0;
    const stale = await database.query(
      `SELECT r.id, r.booking_id, r.from_vet_id, b.pet_owner_id
       FROM referrals r JOIN bookings b ON b.id = r.booking_id
       WHERE r.referral_type = 'platform' AND r.transfer_status = 'offered'
         AND r.action_deadline IS NOT NULL AND r.action_deadline < NOW()
       LIMIT 20`
    );
    let count = 0;
    for (const r of stale.rows) {
      try {
        await PaymentOrchestrator.refundForCancellation(
          r.booking_id, r.pet_owner_id, 'veterinarian', 'Referral expired without action — auto refund', 'wallet'
        );
        await database.query(
          `UPDATE referrals SET transfer_status = 'expired', status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [r.id]
        );
        await NotificationService.createNotification(
          r.pet_owner_id, 'payment', 'Referral Expired — Refund Issued',
          'You did not act on a referral in time, so a full refund plus goodwill bonus has been credited to your wallet.',
          'all', { referralId: r.id }
        ).catch(() => {});
        count++;
      } catch (err: any) {
        logger.error('Referral expiry refund failed', { referralId: r.id, error: err.message });
      }
    }
    if (count > 0) logger.info(`Expired ${count} stale referral(s) with auto-refund`);
    return count;
  }

  /**
   * Emergency fast-track (§4.5, D11): paid emergency bookings the doctor
   * hasn't confirmed within booking.emergencyConfirmMinutes are converted
   * into an open referral offer (patient picks another doctor or refunds —
   * costs on the non-responding doctor).
   */
  async expireEmergencyConfirmations(): Promise<number> {
    if (!(await PaymentModuleConfig.isEnabled())) return 0;
    const confirmMinutes = await PaymentModuleConfig.getEmergencyConfirmMinutes();
    const windowHours = await PaymentModuleConfig.getReferralActionWindowHours();
    const stale = await database.query(
      `SELECT b.id, b.pet_owner_id, b.veterinarian_id, b.animal_id, p.id as payment_id, p.paid_at
       FROM bookings b
       JOIN payments p ON p.booking_id = b.id AND p.status = 'completed'
       WHERE b.priority = 'emergency' AND b.status = 'pending'
         AND p.paid_at IS NOT NULL AND p.paid_at < NOW() - ($1 || ' minutes')::interval
         AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.booking_id = b.id AND r.transfer_status IN ('offered', 'accepted', 'rechosen'))
       LIMIT 20`,
      [String(confirmMinutes)]
    );
    let count = 0;
    for (const b of stale.rows) {
      try {
        const id = uuidv4();
        await database.query(
          `INSERT INTO referrals (id, referral_type, booking_id, payment_id, from_vet_id, to_vet_id, animal_id,
            reason, status, transfer_status, action_deadline, created_at, updated_at)
           VALUES ($1, 'platform', $2, $3, $4, NULL, $5,
                   'Emergency booking not confirmed in time', 'pending', 'offered',
                   NOW() + ($6 || ' hours')::interval, NOW(), NOW())`,
          [id, b.id, b.payment_id, b.veterinarian_id, b.animal_id, String(windowHours)]
        );
        await database.query(`UPDATE bookings SET status = 'referred', updated_at = NOW() WHERE id = $1`, [b.id]);
        await NotificationService.createNotification(
          b.pet_owner_id, 'booking', 'Emergency Doctor Did Not Respond',
          'The doctor did not confirm your emergency booking in time. Open Referrals to instantly move your payment to another emergency doctor, or take a full refund.',
          'all', { referralId: id, bookingId: b.id }
        ).catch(() => {});
        await NotificationService.createNotification(
          b.veterinarian_id, 'booking', 'Emergency Booking Missed',
          'You did not confirm an emergency booking within the response window. The patient has been offered alternatives; refund costs may apply to your ledger.',
          'all', { bookingId: b.id }
        ).catch(() => {});
        count++;
      } catch (err: any) {
        logger.error('Emergency fast-track conversion failed', { bookingId: b.id, error: err.message });
      }
    }
    if (count > 0) logger.info(`Converted ${count} unconfirmed emergency booking(s) to referral offers`);
    return count;
  }

  /** Referral lists (§4.4 history — all personas). */
  async listForUser(userId: string, role: string): Promise<any[]> {
    const base = `
      SELECT r.id, r.referral_type as "referralType", r.reason, r.status,
             r.transfer_status as "transferStatus", r.action_deadline as "actionDeadline",
             r.created_at as "createdAt", r.booking_id as "bookingId",
             CONCAT('Dr. ', fv.first_name, ' ', fv.last_name) as "fromVetName",
             CASE WHEN tv.id IS NULL THEN NULL ELSE CONCAT('Dr. ', tv.first_name, ' ', tv.last_name) END as "toVetName",
             r.to_vet_id as "toVetId", r.from_vet_id as "fromVetId",
             a.name as "animalName",
             b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
             b.booking_type as "bookingType", b.priority,
             p.amount as "paidAmount"
      FROM referrals r
      LEFT JOIN users fv ON fv.id = r.from_vet_id
      LEFT JOIN users tv ON tv.id = r.to_vet_id
      LEFT JOIN animals a ON a.id = r.animal_id
      LEFT JOIN bookings b ON b.id = r.booking_id
      LEFT JOIN payments p ON p.id = r.payment_id
      WHERE r.referral_type = 'platform'`;
    if (role === 'veterinarian') {
      const res = await database.query(
        `${base} AND (r.from_vet_id = $1 OR r.to_vet_id = $1) ORDER BY r.created_at DESC LIMIT 100`,
        [userId]
      );
      return res.rows;
    }
    const res = await database.query(
      `${base} AND b.pet_owner_id = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [userId]
    );
    return res.rows;
  }

  // ── internals ───────────────────────────────────────────────

  private async getActionableReferral(patientId: string, referralId: string): Promise<any> {
    const res = await database.query(
      `SELECT r.*, b.pet_owner_id, b.booking_type, b.priority, b.reason_for_visit as orig_reason
       FROM referrals r JOIN bookings b ON b.id = r.booking_id
       WHERE r.id = $1 AND r.referral_type = 'platform'`,
      [referralId]
    );
    if (res.rows.length === 0) throw new NotFoundError('Referral', referralId);
    const r = res.rows[0];
    if (r.pet_owner_id !== patientId) throw new ForbiddenError('This referral is not yours.');
    if (r.transfer_status !== 'offered') {
      throw new ValidationError(`This referral is no longer actionable (status: ${r.transfer_status}).`);
    }
    if (r.action_deadline && new Date(r.action_deadline) < new Date()) {
      throw new ValidationError('The action window for this referral has expired.');
    }
    return r;
  }

  /** Wallet hop: original completed payment → 'transferred' + instant wallet credit. */
  private async transferPaymentToWallet(referral: any, patientId: string, description: string): Promise<void> {
    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      const pay = await client.query(
        `SELECT id, amount, status FROM payments WHERE id = $1 FOR UPDATE`,
        [referral.payment_id]
      );
      if (pay.rows.length === 0 || pay.rows[0].status !== 'completed') {
        throw new ValidationError('The original payment is no longer transferable.');
      }
      const amount = parseFloat(String(pay.rows[0].amount));
      await client.query(
        `UPDATE payments SET status = 'transferred', updated_at = NOW() WHERE id = $1`,
        [referral.payment_id]
      );
      // wallet credit (create wallet if needed)
      const wRes = await client.query(`SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE`, [patientId]);
      let walletId = wRes.rows[0]?.id;
      if (!walletId) {
        await client.query(
          `INSERT INTO wallets (id, user_id, balance, bonus_credits, currency, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 0, 0, 'INR', NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
          [patientId]
        );
        const again = await client.query(`SELECT id FROM wallets WHERE user_id = $1`, [patientId]);
        walletId = again.rows[0].id;
      }
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [amount, walletId]
      );
      await client.query(
        `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
         VALUES (gen_random_uuid(), $1, 'credit', $2, $3, $4, 'referral', NOW())`,
        [walletId, amount, description, referral.id]
      );
      await client.query(
        `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, payload, created_at)
         VALUES (gen_random_uuid(), $1, 'transferred_to_wallet', 'completed', 'transferred', $2, NOW())`,
        [referral.payment_id, JSON.stringify({ referralId: referral.id, amount })]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export default new ReferralService();
