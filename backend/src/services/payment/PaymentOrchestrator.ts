import { v4 as uuidv4 } from 'uuid';
import database from '../../utils/database';
import logger from '../../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError, DatabaseError } from '../../utils/errors';
import PaymentModuleConfig from './PaymentModuleConfig';
import { getActiveGateway, demoGateway } from './gateways';
import NotificationService from '../NotificationService';

/**
 * Payment lifecycle orchestrator (docs/PAYMENT_MODULE_PLAN.md §4).
 *
 * Invariants enforced here (never in controllers or the frontend):
 *  - Amounts are ALWAYS derived server-side from the doctor's fee (D12 corollary).
 *  - Payment completion only via verified capture (demo capture in P1; webhook in P2).
 *  - Every state change writes a payment_events row.
 *  - Wallet mutations run inside DB transactions with row locks.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CheckoutBreakdown {
  paymentId: string;
  bookingId: string;
  amount: number;
  walletApplied: number;
  payableNow: number;
  currency: string;
  gatewayMode: string;
  gatewayOrderId: string | null;
  checkoutPayload: Record<string, unknown> | null;
  /** true when the wallet fully covered the amount and payment completed immediately */
  paid: boolean;
}

export interface RefundOutcome {
  refunded: boolean;
  refundAmount: number;
  processingCharge: number;
  bonusAmount: number;
  destination: 'wallet';
  reason: string;
}

class PaymentOrchestrator {
  /**
   * Server-side price derivation (§4.2 rule 1).
   * Priority=emergency uses the doctor's emergency fee when set (D11);
   * hospital-context bookings use hospital_doctors.consultation_fee when present.
   */
  async deriveBookingAmount(booking: {
    veterinarianId: string; hospitalId?: string | null; priority?: string | null;
  }): Promise<number> {
    // Hospital-specific fee takes precedence when booked through a hospital
    if (booking.hospitalId) {
      const hosp = await database.query(
        `SELECT consultation_fee FROM hospital_doctors
         WHERE hospital_id = $1 AND doctor_id = $2 AND is_active = true
         LIMIT 1`,
        [booking.hospitalId, booking.veterinarianId]
      );
      const fee = hosp.rows[0]?.consultation_fee;
      if (fee !== null && fee !== undefined && parseFloat(String(fee)) > 0) {
        return parseFloat(String(fee));
      }
    }

    const vp = await database.query(
      `SELECT consultation_fee, emergency_consultation_fee FROM vet_profiles WHERE user_id = $1`,
      [booking.veterinarianId]
    );
    if (vp.rows.length === 0) {
      throw new ValidationError('This doctor has no fee configured. Please contact support.');
    }
    const row = vp.rows[0];
    if (booking.priority === 'emergency' && row.emergency_consultation_fee) {
      return parseFloat(String(row.emergency_consultation_fee));
    }
    const standard = parseFloat(String(row.consultation_fee || 0));
    if (standard <= 0) {
      throw new ValidationError('This doctor has not set a consultation fee yet. Please choose another doctor.');
    }
    return standard;
  }

  /** Effective commission for a doctor: per-doctor override ?? global default (D4). */
  async getEffectiveCommission(doctorId: string): Promise<{ percent: number; flat: number }> {
    const [defaultPercent, defaultFlat] = await Promise.all([
      PaymentModuleConfig.getCommissionDefaultPercent(),
      PaymentModuleConfig.getCommissionFlatFee(),
    ]);
    const result = await database.query(
      `SELECT commission_percent_override, commission_flat_override FROM vet_profiles WHERE user_id = $1`,
      [doctorId]
    );
    const row = result.rows[0] || {};
    const percent = row.commission_percent_override !== null && row.commission_percent_override !== undefined
      ? parseFloat(String(row.commission_percent_override)) : defaultPercent;
    const flat = row.commission_flat_override !== null && row.commission_flat_override !== undefined
      ? parseFloat(String(row.commission_flat_override)) : defaultFlat;
    return { percent, flat };
  }

  /** Snapshot commission math (§5): commission = gross×pct + flat (flat capped at gross). */
  computeCommission(gross: number, percent: number, flat: number): { commission: number; doctorNet: number } {
    const commission = Math.min(round2(gross * percent / 100 + flat), gross);
    return { commission, doctorNet: round2(gross - commission) };
  }

  /**
   * Called by BookingService at booking creation (flag on): creates the payment
   * hold row that owns the slot-hold window.
   */
  async createPaymentHold(booking: {
    id: string; petOwnerId: string; veterinarianId: string;
    hospitalId?: string | null; priority?: string | null; consultationId?: string | null;
  }): Promise<{ paymentId: string; amount: number; expiresAt: Date }> {
    const amount = await this.deriveBookingAmount(booking);
    const holdMinutes = booking.priority === 'emergency'
      ? await PaymentModuleConfig.getEmergencyHoldMinutes()
      : await PaymentModuleConfig.getHoldMinutes();
    const currency = await PaymentModuleConfig.getCurrency();
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    const id = uuidv4();

    await database.query(
      `INSERT INTO payments (id, booking_id, consultation_id, user_id, payer_id, payee_id,
        amount, currency, status, gateway, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 'created', 'demo', $8, NOW(), NOW())`,
      [id, booking.id, booking.consultationId || null, booking.petOwnerId,
       booking.veterinarianId, amount, currency, expiresAt]
    );
    await this.logEvent(id, 'hold_created', null, 'created', booking.petOwnerId, { amount, expiresAt });
    return { paymentId: id, amount, expiresAt };
  }

  /**
   * Step 1 of checkout: compute breakdown, apply wallet, create gateway order.
   * If the wallet covers everything, completes the payment immediately.
   */
  async initiateCheckout(userId: string, bookingId: string, useWallet: boolean): Promise<CheckoutBreakdown> {
    if (!(await PaymentModuleConfig.isEnabled())) {
      throw new ValidationError('Payments are not enabled on this platform.');
    }
    const bookingRes = await database.query(
      `SELECT id, pet_owner_id, veterinarian_id, hospital_id, priority, status FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (bookingRes.rows.length === 0) throw new NotFoundError('Booking', bookingId);
    const booking = bookingRes.rows[0];
    if (booking.pet_owner_id !== userId) {
      throw new ForbiddenError('You can only pay for your own bookings');
    }
    if (booking.status !== 'payment_pending') {
      throw new ValidationError(`This booking is not awaiting payment (status: ${booking.status}).`);
    }

    const payRes = await database.query(
      `SELECT id, amount, currency, status, expires_at FROM payments
       WHERE booking_id = $1 AND status IN ('created', 'pending')
       ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );
    if (payRes.rows.length === 0) {
      throw new NotFoundError('Payment hold for booking', bookingId);
    }
    const payment = payRes.rows[0];
    if (payment.expires_at && new Date(payment.expires_at) < new Date()) {
      // Let the expiry job clean up; tell the patient clearly
      throw new ValidationError('The payment window for this booking has expired. Please book again.');
    }

    const amount = parseFloat(String(payment.amount));
    let walletApplied = 0;
    if (useWallet) {
      const w = await database.query(
        `SELECT balance, bonus_credits FROM wallets WHERE user_id = $1`, [userId]
      );
      if (w.rows.length > 0) {
        const total = parseFloat(String(w.rows[0].balance)) + parseFloat(String(w.rows[0].bonus_credits));
        walletApplied = round2(Math.min(Math.max(total, 0), amount));
      }
    }
    const payableNow = round2(amount - walletApplied);
    const gateway = await getActiveGateway();
    const mode = gateway.mode;

    if (payableNow <= 0) {
      // Wallet fully covers — complete immediately (still goes through the
      // same transactional completion path; walletApplied re-validated inside)
      await database.query(
        `UPDATE payments SET wallet_amount_used = $1, updated_at = NOW() WHERE id = $2`,
        [walletApplied, payment.id]
      );
      await this.completeCapturedPayment(payment.id, {
        gatewayPaymentId: `wallet_${payment.id.substring(0, 8)}`,
        gatewayFee: 0,
        method: 'wallet',
        actorUserId: userId,
      });
      return {
        paymentId: payment.id, bookingId, amount, walletApplied, payableNow: 0,
        currency: payment.currency, gatewayMode: mode, gatewayOrderId: null, checkoutPayload: null, paid: true,
      };
    }

    const order = await gateway.createOrder(payableNow, payment.currency, payment.id, { bookingId });
    await database.query(
      `UPDATE payments SET gateway_order_id = $1, wallet_amount_used = $2, status = 'pending',
              gateway = $3, updated_at = NOW() WHERE id = $4`,
      [order.gatewayOrderId, walletApplied, mode === 'demo' ? 'demo' : 'razorpay', payment.id]
    );
    await this.logEvent(payment.id, 'checkout_initiated', 'created', 'pending', userId,
      { walletApplied, payableNow, gatewayOrderId: order.gatewayOrderId });

    return {
      paymentId: payment.id, bookingId, amount, walletApplied, payableNow,
      currency: payment.currency, gatewayMode: mode,
      gatewayOrderId: order.gatewayOrderId, checkoutPayload: order.checkoutPayload, paid: false,
    };
  }

  /**
   * Step 2 (demo mode): the simulated checkout succeeded — capture and complete.
   * P2 replaces the trust model with Razorpay signature verification + webhook.
   */
  async completeDemoCheckout(userId: string, paymentId: string): Promise<void> {
    const gateway = await getActiveGateway();
    if (gateway.mode !== 'demo') {
      throw new ValidationError('Demo checkout completion is only valid in demo gateway mode.');
    }
    const payRes = await database.query(
      `SELECT id, user_id, booking_id, amount, wallet_amount_used, gateway_order_id, status
       FROM payments WHERE id = $1`,
      [paymentId]
    );
    if (payRes.rows.length === 0) throw new NotFoundError('Payment', paymentId);
    const p = payRes.rows[0];
    if (p.user_id !== userId) throw new ForbiddenError('Not your payment');
    if (p.status === 'completed') return; // idempotent
    if (p.status !== 'pending') {
      throw new ValidationError(`Payment cannot be completed from status '${p.status}'.`);
    }
    const payable = round2(parseFloat(String(p.amount)) - parseFloat(String(p.wallet_amount_used || 0)));
    const captured = demoGateway.capturePayment(p.gateway_order_id, payable);
    await this.completeCapturedPayment(paymentId, {
      gatewayPaymentId: captured.gatewayPaymentId,
      gatewayFee: captured.fee,
      method: 'demo',
      actorUserId: userId,
    });
  }

  /**
   * Shared transactional completion: debits the wallet portion (row-locked),
   * snapshots commission, flips payment→completed and booking→pending,
   * then notifies both parties.
   */
  async completeCapturedPayment(paymentId: string, capture: {
    gatewayPaymentId: string; gatewayFee: number; method: string; actorUserId?: string | null;
  }): Promise<void> {
    const client = await database.getPool().connect();
    let bookingInfo: any = null;
    try {
      await client.query('BEGIN');
      const payRes = await client.query(
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`, [paymentId]
      );
      if (payRes.rows.length === 0) throw new NotFoundError('Payment', paymentId);
      const p = payRes.rows[0];
      if (p.status === 'completed') { await client.query('ROLLBACK'); return; } // idempotent
      if (!['created', 'pending'].includes(p.status)) {
        throw new ValidationError(`Payment cannot complete from status '${p.status}'.`);
      }

      const walletUsed = parseFloat(String(p.wallet_amount_used || 0));
      if (walletUsed > 0) {
        const wRes = await client.query(
          `SELECT id, balance, bonus_credits FROM wallets WHERE user_id = $1 FOR UPDATE`,
          [p.user_id]
        );
        if (wRes.rows.length === 0) throw new ValidationError('Wallet not found for wallet payment');
        const w = wRes.rows[0];
        const balance = parseFloat(String(w.balance));
        const bonus = parseFloat(String(w.bonus_credits));
        if (round2(balance + bonus) < walletUsed) {
          throw new ValidationError('Insufficient wallet balance. Please retry the payment.');
        }
        const fromBalance = round2(Math.min(balance, walletUsed));
        const fromBonus = round2(walletUsed - fromBalance);
        await client.query(
          `UPDATE wallets SET balance = balance - $1, bonus_credits = bonus_credits - $2, updated_at = NOW()
           WHERE id = $3`,
          [fromBalance, fromBonus, w.id]
        );
        await client.query(
          `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
           VALUES ($1, $2, 'debit', $3, $4, $5, 'booking', NOW())`,
          [uuidv4(), w.id, walletUsed, 'Wallet payment for consultation booking', p.booking_id]
        );
      }

      // Commission snapshot (D4 — locked at payment time)
      const gross = parseFloat(String(p.amount));
      const { percent, flat } = await this.getEffectiveCommission(p.payee_id);
      const { commission, doctorNet } = this.computeCommission(gross, percent, flat);

      await client.query(
        `UPDATE payments SET status = 'completed', transaction_id = $1, gateway_payment_id = $1,
                gateway_fee_amount = $2, payment_method = $3,
                commission_percent = $4, commission_flat = $5, commission_amount = $6,
                doctor_earning_amount = $7, paid_at = NOW(), updated_at = NOW()
         WHERE id = $8`,
        [capture.gatewayPaymentId, capture.gatewayFee, capture.method,
         percent, flat, commission, doctorNet, paymentId]
      );

      const bookRes = await client.query(
        `UPDATE bookings SET status = 'pending', updated_at = NOW()
         WHERE id = $1 AND status = 'payment_pending'
         RETURNING id, pet_owner_id, veterinarian_id, scheduled_date, time_slot_start`,
        [p.booking_id]
      );
      bookingInfo = bookRes.rows[0] || null;

      await client.query(
        `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, actor_user_id, payload, created_at)
         VALUES ($1, $2, 'payment_completed', $3, 'completed', $4, $5, NOW())`,
        [uuidv4(), paymentId, p.status, capture.actorUserId || null,
         JSON.stringify({ gatewayPaymentId: capture.gatewayPaymentId, gatewayFee: capture.gatewayFee, walletUsed, commission, doctorNet })]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Notifications after commit (non-blocking)
    if (bookingInfo) {
      const dateStr = bookingInfo.scheduled_date instanceof Date
        ? bookingInfo.scheduled_date.toISOString().split('T')[0]
        : String(bookingInfo.scheduled_date);
      try {
        await NotificationService.createNotification(
          bookingInfo.veterinarian_id, 'booking',
          'New Paid Booking Request',
          `You have a new paid consultation request for ${dateStr} at ${bookingInfo.time_slot_start}. Please confirm or decline.`,
          'all', { bookingId: bookingInfo.id }
        );
        await NotificationService.createNotification(
          bookingInfo.pet_owner_id, 'payment',
          'Payment Successful',
          `Your payment for the consultation on ${dateStr} at ${bookingInfo.time_slot_start} was received. The doctor will confirm your booking shortly.`,
          'all', { bookingId: bookingInfo.id, paymentId }
        );
      } catch (err) {
        logger.error('Payment completion notifications failed (non-blocking)', { paymentId, error: err });
      }
    }
    logger.info('Payment completed', { paymentId, method: capture.method });
  }

  /**
   * Refund preview for the cancel dialog (§10 policy transparency) — pure computation.
   */
  async computeRefundPreview(bookingId: string, cancellerRole: string): Promise<{
    hasPayment: boolean; paymentAmount: number; refundAmount: number;
    processingCharge: number; bonusAmount: number; policy: string;
  }> {
    const empty = { hasPayment: false, paymentAmount: 0, refundAmount: 0, processingCharge: 0, bonusAmount: 0, policy: 'none' };
    if (!(await PaymentModuleConfig.isEnabled())) return empty;
    const payRes = await database.query(
      `SELECT p.id, p.amount, p.gateway_fee_amount, b.scheduled_date, b.time_slot_start
       FROM payments p JOIN bookings b ON b.id = p.booking_id
       WHERE p.booking_id = $1 AND p.status = 'completed'
       ORDER BY p.created_at DESC LIMIT 1`,
      [bookingId]
    );
    if (payRes.rows.length === 0) return empty;
    const row = payRes.rows[0];
    const amount = parseFloat(String(row.amount));
    const gatewayFee = parseFloat(String(row.gateway_fee_amount || 0));

    const isByDoctor = cancellerRole === 'veterinarian' || cancellerRole === 'admin';
    if (isByDoctor) {
      const bonusPercent = cancellerRole === 'veterinarian'
        ? await this.getSettingNumber('cancellation.goodwillBonusPercent', 10) : 0;
      return {
        hasPayment: true, paymentAmount: amount, refundAmount: amount,
        processingCharge: 0, bonusAmount: round2(amount * bonusPercent / 100), policy: 'doctor_cancel_full_refund',
      };
    }

    // Patient policy: time-based windows + cancellation processing charge (D12)
    const freeWindow = await this.getSettingNumber('cancellation.patientFreeWindowHours', 24);
    const partialPercent = await this.getSettingNumber('cancellation.partialRefundPercent', 50);
    const partialWindow = await this.getSettingNumber('cancellation.partialRefundWindowHours', 2);
    const processingFlat = await PaymentModuleConfig.getProcessingFlatFee();
    const processingCharge = round2(gatewayFee + processingFlat);

    const d = new Date(row.scheduled_date);
    const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const apptTime = new Date(`${datePart}T${row.time_slot_start}:00`);
    const hoursUntil = (apptTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntil >= freeWindow) {
      const refund = Math.max(0, round2(amount - processingCharge));
      return { hasPayment: true, paymentAmount: amount, refundAmount: refund, processingCharge: Math.min(processingCharge, amount), bonusAmount: 0, policy: 'patient_free_window' };
    } else if (hoursUntil >= partialWindow) {
      const base = round2(amount * partialPercent / 100);
      const refund = Math.max(0, round2(base - processingCharge));
      return { hasPayment: true, paymentAmount: amount, refundAmount: refund, processingCharge: Math.min(processingCharge, base), bonusAmount: 0, policy: 'patient_partial_window' };
    }
    return { hasPayment: true, paymentAmount: amount, refundAmount: 0, processingCharge: 0, bonusAmount: 0, policy: 'patient_no_refund_window' };
  }

  /**
   * Refund engine (P1: wallet destination). Called from BookingService.cancelBooking
   * when the payment flag is on. Doctor-side penalty ledger entries land in P3.
   */
  async refundForCancellation(bookingId: string, petOwnerId: string, cancellerRole: string, reason: string): Promise<RefundOutcome | null> {
    if (!(await PaymentModuleConfig.isEnabled())) return null;
    const preview = await this.computeRefundPreview(bookingId, cancellerRole);
    if (!preview.hasPayment) return null;

    const payRes = await database.query(
      `SELECT id, status FROM payments WHERE booking_id = $1 AND status = 'completed'
       ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );
    if (payRes.rows.length === 0) return null;
    const paymentId = payRes.rows[0].id;

    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(`SELECT status, amount FROM payments WHERE id = $1 FOR UPDATE`, [paymentId]);
      if (locked.rows[0].status !== 'completed') { await client.query('ROLLBACK'); return null; }
      const amount = parseFloat(String(locked.rows[0].amount));
      const isFull = preview.refundAmount + preview.processingCharge >= amount;
      const newStatus = preview.refundAmount <= 0 ? 'completed' : (isFull ? 'refunded' : 'partially_refunded');

      if (preview.refundAmount > 0 || preview.processingCharge > 0) {
        await client.query(
          `UPDATE payments SET status = $1, refund_amount = $2, refund_reason = $3,
                  processing_charge_amount = $4, refund_destination = 'wallet', updated_at = NOW()
           WHERE id = $5`,
          [newStatus, preview.refundAmount, reason, preview.processingCharge, paymentId]
        );
      }

      if (preview.refundAmount > 0) {
        // wallet credit (refund) — inline, transactional
        const wRes = await client.query(
          `SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE`, [petOwnerId]
        );
        let walletId = wRes.rows[0]?.id;
        if (!walletId) {
          walletId = uuidv4();
          await client.query(
            `INSERT INTO wallets (id, user_id, balance, bonus_credits, currency, created_at, updated_at)
             VALUES ($1, $2, 0, 0, 'INR', NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
            [walletId, petOwnerId]
          );
          const again = await client.query(`SELECT id FROM wallets WHERE user_id = $1`, [petOwnerId]);
          walletId = again.rows[0].id;
        }
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
          [preview.refundAmount, walletId]
        );
        await client.query(
          `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
           VALUES ($1, $2, 'refund', $3, $4, $5, 'booking', NOW())`,
          [uuidv4(), walletId, preview.refundAmount, `Refund: ${reason}`, bookingId]
        );
        if (preview.bonusAmount > 0) {
          await client.query(
            `UPDATE wallets SET bonus_credits = bonus_credits + $1, updated_at = NOW() WHERE id = $2`,
            [preview.bonusAmount, walletId]
          );
          await client.query(
            `INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_id, reference_type, created_at)
             VALUES ($1, $2, 'bonus', $3, 'Goodwill bonus — doctor cancelled your appointment', $4, 'booking', NOW())`,
            [uuidv4(), walletId, preview.bonusAmount, bookingId]
          );
        }
      }

      await client.query(
        `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, payload, created_at)
         VALUES ($1, $2, 'refund_processed', 'completed', $3, $4, NOW())`,
        [uuidv4(), paymentId, newStatus,
         JSON.stringify({ ...preview, cancellerRole, reason, destination: 'wallet' })]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('refundForCancellation failed', { bookingId, error: err });
      throw new DatabaseError('Refund processing failed', { originalError: err });
    } finally {
      client.release();
    }

    logger.info('Refund processed (wallet)', { bookingId, ...preview });
    return {
      refunded: preview.refundAmount > 0,
      refundAmount: preview.refundAmount,
      processingCharge: preview.processingCharge,
      bonusAmount: preview.bonusAmount,
      destination: 'wallet',
      reason: preview.policy,
    };
  }

  /**
   * Scheduler job (§4.2 rule 3): expire unpaid holds, release slots, notify patient.
   */
  async expireStalePaymentHolds(): Promise<number> {
    if (!(await PaymentModuleConfig.isEnabled())) return 0;
    const expired = await database.query(
      `UPDATE payments SET status = 'expired', updated_at = NOW()
       WHERE status IN ('created', 'pending') AND expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING id, booking_id, user_id`
    );
    for (const p of expired.rows) {
      try {
        await database.query(
          `UPDATE bookings SET status = 'payment_expired', updated_at = NOW()
           WHERE id = $1 AND status = 'payment_pending'`,
          [p.booking_id]
        );
        await this.logEvent(p.id, 'hold_expired', 'pending', 'expired', null, {});
        await NotificationService.createNotification(
          p.user_id, 'payment',
          'Booking Payment Expired',
          'Your booking was released because payment was not completed in time. You can book the slot again if it is still available.',
          'all', { bookingId: p.booking_id }
        );
      } catch (err) {
        logger.error('Expire hold post-processing failed', { paymentId: p.id, error: err });
      }
    }
    if (expired.rows.length > 0) {
      logger.info(`Expired ${expired.rows.length} stale payment hold(s)`);
    }
    return expired.rows.length;
  }

  /** Enforcement helper (§4.2 rule 4): is the booking backed by a completed payment? */
  async isBookingPaid(bookingId: string): Promise<boolean> {
    const res = await database.query(
      `SELECT 1 FROM payments WHERE booking_id = $1 AND status IN ('completed', 'partially_refunded') LIMIT 1`,
      [bookingId]
    );
    return res.rows.length > 0;
  }

  /** Receipt payload (P1 basic receipts). */
  async getReceipt(paymentId: string, requesterId: string, requesterRole: string): Promise<any> {
    const res = await database.query(
      `SELECT p.id, p.booking_id as "bookingId", p.amount, p.currency, p.status,
              p.payment_method as "paymentMethod", p.transaction_id as "transactionId",
              p.wallet_amount_used as "walletAmountUsed", p.refund_amount as "refundAmount",
              p.processing_charge_amount as "processingChargeAmount", p.paid_at as "paidAt",
              p.created_at as "createdAt",
              b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
              b.booking_type as "bookingType", b.reason_for_visit as "reasonForVisit",
              CONCAT(po.first_name, ' ', po.last_name) as "patientName",
              CONCAT('Dr. ', v.first_name, ' ', v.last_name) as "doctorName",
              a.name as "animalName", a.species as "animalSpecies",
              p.user_id as "userId", p.payee_id as "payeeId"
       FROM payments p
       LEFT JOIN bookings b ON b.id = p.booking_id
       LEFT JOIN users po ON po.id = p.user_id
       LEFT JOIN users v ON v.id = p.payee_id
       LEFT JOIN animals a ON a.id = b.animal_id
       WHERE p.id = $1`,
      [paymentId]
    );
    if (res.rows.length === 0) throw new NotFoundError('Payment', paymentId);
    const receipt = res.rows[0];
    if (receipt.userId !== requesterId && receipt.payeeId !== requesterId && requesterRole !== 'admin') {
      throw new ForbiddenError('You do not have access to this receipt');
    }
    return receipt;
  }

  private async getSettingNumber(key: string, defaultValue: number): Promise<number> {
    return PaymentModuleConfig.getNumber(key, defaultValue);
  }

  private async logEvent(paymentId: string, eventType: string, fromStatus: string | null, toStatus: string | null, actorUserId: string | null, payload: Record<string, unknown>): Promise<void> {
    try {
      await database.query(
        `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, actor_user_id, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [uuidv4(), paymentId, eventType, fromStatus, toStatus, actorUserId, JSON.stringify(payload)]
      );
    } catch (err: any) {
      logger.warn('payment_events insert failed (non-blocking)', { paymentId, eventType, error: err.message });
    }
  }
}

export default new PaymentOrchestrator();
