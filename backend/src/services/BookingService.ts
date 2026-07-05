import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { Booking, CreateBookingDTO, BookingStatus, PaginatedResponse } from '../models/types';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';
import PaymentService from './PaymentService';
import WalletService from './WalletService';
import NotificationService from './NotificationService';
import PaymentModuleConfig from './payment/PaymentModuleConfig';
import PaymentOrchestrator from './payment/PaymentOrchestrator';

class BookingService {
  /**
   * Auto-mark confirmed bookings as 'missed' if their time window has passed.
   * Detects WHO missed using video_sessions:
   *   - doctor: no video session was created (doctor never opened the room)
   *   - patient: video session exists in 'waiting' state (doctor opened room, patient didn't join)
   * Skips bookings whose linked consultation is completed or in progress.
   */
  async markMissedBookings(): Promise<number> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. Mark CONFIRMED bookings as missed whose scheduled window has passed.
    // Determines missed_by:
    //   'patient'  — video session created (doctor opened room) but stuck in 'waiting'
    //   'doctor'   — no video session created at all (doctor never started the room)
    // Skips bookings whose consultation is already completed or in_progress.
    const confirmedResult = await database.query(
      `UPDATE bookings AS b
       SET status = 'missed',
           missed_by = CASE
             WHEN b.consultation_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM video_sessions vs
               WHERE vs.consultation_id = b.consultation_id
                 AND vs.status = 'waiting'
             ) THEN 'patient'
             ELSE 'doctor'
           END,
           updated_at = NOW()
       WHERE b.status = 'confirmed'
         AND NOT (
           b.consultation_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM consultations c
             WHERE c.id = b.consultation_id
               AND c.status IN ('completed', 'in_progress')
           )
         )
         AND (
           b.scheduled_date < $1::date
           OR (b.scheduled_date = $1::date AND b.time_slot_end <= $2)
         )
       RETURNING b.id, b.missed_by`,
      [dateStr, timeStr]
    );

    // 2. Mark PENDING bookings as missed — doctor never confirmed before time passed.
    // Always missed_by = 'doctor' (vet's responsibility to confirm).
    const pendingResult = await database.query(
      `UPDATE bookings AS b
       SET status = 'missed',
           missed_by = 'doctor',
           updated_at = NOW()
       WHERE b.status = 'pending'
         AND (
           b.scheduled_date < $1::date
           OR (b.scheduled_date = $1::date AND b.time_slot_end <= $2)
         )
       RETURNING b.id, b.missed_by`,
      [dateStr, timeStr]
    );

    const totalMarked = confirmedResult.rows.length + pendingResult.rows.length;

    // §4.3: settle money outcomes for missed paid bookings (doctor missed →
    // auto-refund + penalty; patient missed → doctor compensation)
    for (const r of [...confirmedResult.rows, ...pendingResult.rows]) {
      try {
        await PaymentOrchestrator.settleMissedBooking(r.id, r.missed_by);
      } catch (err) {
        logger.error('Missed booking settlement failed (non-blocking)', { bookingId: r.id, error: err });
      }
    }

    if (totalMarked > 0) {
      logger.info(`Auto-marked ${totalMarked} booking(s) as missed`, {
        confirmedToMissed: confirmedResult.rows.length,
        pendingToMissed: pendingResult.rows.length,
        bookingIds: [...confirmedResult.rows, ...pendingResult.rows].map((r: any) => r.id),
        byDoctor: [...confirmedResult.rows, ...pendingResult.rows].filter((r: any) => r.missed_by === 'doctor').length,
        byPatient: confirmedResult.rows.filter((r: any) => r.missed_by === 'patient').length,
      });
    }
    return totalMarked;
  }

  async createBooking(petOwnerId: string, data: CreateBookingDTO): Promise<Booking> {
    const id = uuidv4();
    const now = new Date();

    // ── Validate: no bookings in the past (date-only check; time-of-day
    //    validation is done on the frontend using the user's local timezone) ──
    const requestedDate = new Date(data.scheduledDate + 'T12:00:00Z');
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    if (requestedDate < todayStart) {
      throw new ValidationError('Cannot book a consultation in the past. Please select a future date and time.');
    }

    // Validate enterprise/group access for farmer bookings
    if (data.enterpriseId) {
      const enterpriseCheck = await database.query(
        `SELECT id FROM enterprises WHERE id = $1 AND owner_id = $2`,
        [data.enterpriseId, petOwnerId]
      );
      if (enterpriseCheck.rows.length === 0) {
        throw new Error('You do not have access to this enterprise');
      }
      // Validate animal belongs to this enterprise
      if (data.animalId) {
        const animalEntCheck = await database.query(
          `SELECT enterprise_id FROM animals WHERE id = $1`,
          [data.animalId]
        );
        if (animalEntCheck.rows.length > 0 &&
            animalEntCheck.rows[0].enterprise_id &&
            animalEntCheck.rows[0].enterprise_id !== data.enterpriseId) {
          throw new Error('The selected animal does not belong to this enterprise');
        }
      }
    }
    if (data.groupId && !data.enterpriseId) {
      const groupCheck = await database.query(
        `SELECT ag.id FROM animal_groups ag
         JOIN enterprises e ON e.id = ag.enterprise_id
         WHERE ag.id = $1 AND e.owner_id = $2`,
        [data.groupId, petOwnerId]
      );
      if (groupCheck.rows.length === 0) {
        throw new Error('You do not have access to this animal group');
      }
    }
    if (data.groupId && data.enterpriseId) {
      const groupCheck = await database.query(
        `SELECT id FROM animal_groups WHERE id = $1 AND enterprise_id = $2`,
        [data.groupId, data.enterpriseId]
      );
      if (groupCheck.rows.length === 0) {
        throw new Error('Group does not belong to this enterprise');
      }
    }

    // Check for conflicting bookings (payment_pending holds the slot; released
    // statuses — cancelled/rescheduled/payment_expired/referred — do not block)
    const conflicts = await database.query(
      `SELECT id FROM bookings WHERE veterinarian_id = $1 AND scheduled_date = $2
       AND time_slot_start = $3 AND status NOT IN ('cancelled', 'rescheduled', 'payment_expired', 'referred')`,
      [data.veterinarianId, data.scheduledDate, data.timeSlotStart]
    );

    if (conflicts.rows.length > 0) {
      throw new ConflictError('This time slot is already booked');
    }

    // Payment module (§4.2): when enabled, bookings start in payment_pending and
    // the fee is derived server-side up-front so missing-fee doctors fail fast.
    const paymentsOn = await PaymentModuleConfig.isEnabled();
    if (paymentsOn) {
      await PaymentOrchestrator.deriveBookingAmount({
        veterinarianId: data.veterinarianId,
        hospitalId: data.hospitalId || null,
        priority: data.priority || 'normal',
      });
    }
    const initialStatus = paymentsOn ? 'payment_pending' : 'pending';

    const result = await database.query(
      `INSERT INTO bookings (id, pet_owner_id, veterinarian_id, animal_id, enterprise_id, group_id, hospital_id, scheduled_date, 
       time_slot_start, time_slot_end, status, booking_type, priority, reason_for_visit, 
       symptoms, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, pet_owner_id as "petOwnerId", veterinarian_id as "veterinarianId", 
       animal_id as "animalId", enterprise_id as "enterpriseId", group_id as "groupId",
       hospital_id as "hospitalId",
       scheduled_date as "scheduledDate", 
       time_slot_start as "timeSlotStart", time_slot_end as "timeSlotEnd",
       status, booking_type as "bookingType", priority, reason_for_visit as "reasonForVisit",
       symptoms, notes, created_at as "createdAt", updated_at as "updatedAt"`,
      [id, petOwnerId, data.veterinarianId, data.animalId || null, data.enterpriseId || null, data.groupId || null, data.hospitalId || null, data.scheduledDate,
       data.timeSlotStart, data.timeSlotEnd, initialStatus, data.bookingType,
       data.priority || 'normal', data.reasonForVisit, data.symptoms || null,
       data.notes || null, now, now]
    ).catch((err: any) => {
      if (err.code === '23505' && err.constraint?.includes('idx_bookings_vet_slot_unique')) {
        throw new ConflictError('This time slot was just booked by another user. Please choose a different time.');
      }
      throw err;
    });

    logger.info('Booking created', { bookingId: id, petOwnerId, vetId: data.veterinarianId, hospitalId: data.hospitalId, initialStatus });

    if (paymentsOn) {
      // Create the payment hold that owns the slot-hold window. If it fails,
      // roll the booking back so no unpayable booking blocks the slot.
      try {
        const hold = await PaymentOrchestrator.createPaymentHold({
          id, petOwnerId, veterinarianId: data.veterinarianId,
          hospitalId: data.hospitalId || null, priority: data.priority || 'normal',
        });
        (result.rows[0] as any).paymentId = hold.paymentId;
        (result.rows[0] as any).paymentAmount = hold.amount;
        (result.rows[0] as any).paymentExpiresAt = hold.expiresAt;
      } catch (err) {
        await database.query(`DELETE FROM bookings WHERE id = $1`, [id]).catch(() => {});
        throw err;
      }
      // Vet is notified AFTER payment completes (PaymentOrchestrator), not here.
      return result.rows[0];
    }

    // Notify vet of new booking (non-blocking)
    try {
      await NotificationService.createNotification(
        data.veterinarianId, 'booking',
        'New Booking Request',
        `You have a new consultation request for ${data.scheduledDate} at ${data.timeSlotStart}. Please confirm or decline.`,
        'all', { bookingId: id }
      );
    } catch (err) {
      logger.error('New booking vet notification failed (non-blocking)', { bookingId: id, error: err });
    }

    return result.rows[0];
  }

  async getBooking(id: string): Promise<Booking> {
    const result = await database.query(
      `SELECT id, pet_owner_id as "petOwnerId", veterinarian_id as "veterinarianId",
       animal_id as "animalId", enterprise_id as "enterpriseId", group_id as "groupId",
       hospital_id as "hospitalId", consultation_id as "consultationId",
       scheduled_date as "scheduledDate", time_slot_start as "timeSlotStart",
       time_slot_end as "timeSlotEnd", status, booking_type as "bookingType",
       priority, reason_for_visit as "reasonForVisit", symptoms, notes,
       cancellation_reason as "cancellationReason", cancelled_by as "cancelledBy",
       cancelled_at as "cancelledAt", confirmed_at as "confirmedAt",
       reschedule_count as "rescheduleCount", missed_by as "missedBy",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM bookings WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Booking', id);
    }
    return result.rows[0];
  }

  async listBookings(userId: string, role: string, params: { limit?: number; offset?: number; status?: string }): Promise<PaginatedResponse<Booking>> {
    // Auto-mark missed bookings before listing (non-blocking — listing must succeed even if marking fails)
    try {
      await this.markMissedBookings();
    } catch (err: any) {
      logger.warn('markMissedBookings failed — continuing with listing', { error: err.message });
    }

    const limit = params.limit || 10;
    const offset = params.offset || 0;
    
    let whereClause = '';
    const queryParams: any[] = [];

    if (role === 'pet_owner' || role === 'farmer') {
      queryParams.push(userId);
      whereClause = `WHERE b.pet_owner_id = $${queryParams.length}`;
    } else if (role === 'veterinarian') {
      queryParams.push(userId);
      whereClause = `WHERE b.veterinarian_id = $${queryParams.length}`;
    }
    // admin sees all

    if (params.status) {
      queryParams.push(params.status);
      whereClause += whereClause ? ` AND b.status = $${queryParams.length}` : `WHERE b.status = $${queryParams.length}`;
    }

    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM bookings b ${whereClause}`,
      [...queryParams]
    );

    const result = await database.query(
      `SELECT b.id, b.pet_owner_id as "petOwnerId", b.veterinarian_id as "veterinarianId",
       b.animal_id as "animalId", b.enterprise_id as "enterpriseId", b.group_id as "groupId",
       b.hospital_id as "hospitalId", b.consultation_id as "consultationId",
       b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
       b.time_slot_end as "timeSlotEnd", b.status, b.booking_type as "bookingType",
       b.priority, b.reason_for_visit as "reasonForVisit", b.symptoms, b.notes,
       b.reschedule_count as "rescheduleCount", b.missed_by as "missedBy",
       b.cancelled_by as "cancelledBy", b.cancelled_at as "cancelledAt",
       b.confirmed_at as "confirmedAt",
       b.created_at as "createdAt", b.updated_at as "updatedAt",
       CONCAT(po.first_name, ' ', po.last_name) as "petOwnerName",
       CONCAT('Dr. ', v.first_name, ' ', v.last_name) as "vetName",
       a.name as "animalName", a.species as "animalSpecies", a.breed as "animalBreed",
       a.unique_id as "animalUniqueId",
       e.name as "enterpriseName", e.enterprise_type as "enterpriseType",
       ag.name as "groupName", ag.group_type as "groupType",
       vh.name as "hospitalName"
       FROM bookings b
       LEFT JOIN users po ON po.id = b.pet_owner_id
       LEFT JOIN users v ON v.id = b.veterinarian_id
       LEFT JOIN animals a ON a.id = b.animal_id
       LEFT JOIN enterprises e ON e.id = b.enterprise_id
       LEFT JOIN animal_groups ag ON ag.id = b.group_id
       LEFT JOIN vet_hospitals vh ON vh.id = b.hospital_id
       ${whereClause}
       ORDER BY b.scheduled_date DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit
    };
  }

  async updateBookingStatus(id: string, status: BookingStatus, reason?: string): Promise<Booking> {
    const updates: string[] = ['status = $1', 'updated_at = $2'];
    const params: any[] = [status, new Date()];
    
    if (status === 'confirmed') {
      updates.push(`confirmed_at = $${params.length + 1}`);
      params.push(new Date());
    }
    if (status === 'cancelled' && reason) {
      updates.push(`cancellation_reason = $${params.length + 1}`);
      params.push(reason);
    }

    params.push(id);
    const result = await database.query(
      `UPDATE bookings SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, pet_owner_id as "petOwnerId", veterinarian_id as "veterinarianId",
       status, booking_type as "bookingType", scheduled_date as "scheduledDate",
       time_slot_start as "timeSlotStart", time_slot_end as "timeSlotEnd",
       created_at as "createdAt", updated_at as "updatedAt"`,
      params
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Booking', id);
    }

    logger.info('Booking status updated', { bookingId: id, newStatus: status });
    return result.rows[0];
  }

  async confirmBooking(id: string): Promise<Booking> {
    // Prevent confirming a booking whose time has already passed
    const booking = await this.getBooking(id);

    // Only pending bookings can be confirmed
    if (booking.status !== 'pending') {
      throw new ValidationError(`Cannot confirm a booking with status '${booking.status}'. Only pending bookings can be confirmed.`);
    }

    // Use local date methods to avoid timezone shift (pg returns DATE as local midnight)
    const d = new Date(booking.scheduledDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const scheduledEnd = new Date(`${dateStr}T${booking.timeSlotEnd}:00`);
    if (scheduledEnd < new Date()) {
      throw new ValidationError('Cannot confirm a booking whose scheduled time has already passed.');
    }
    return this.updateBookingStatus(id, 'confirmed');
  }

  async cancelBooking(id: string, reason: string, cancelledByUserId?: string, cancellerRole?: string, refundDestination: 'wallet' | 'gateway' = 'wallet'): Promise<Booking> {
    const booking = await this.getBooking(id);

    // Determine cancellation details
    const isByDoctor = cancellerRole === 'veterinarian';
    const isByPatient = cancellerRole === 'pet_owner' || cancellerRole === 'farmer';
    const isByAdmin = cancellerRole === 'admin';

    // Update booking with cancelled_by info
    const updates: string[] = ['status = $1', 'updated_at = $2', 'cancellation_reason = $3', 'cancelled_at = $4'];
    const params: any[] = ['cancelled', new Date(), reason, new Date()];
    if (cancelledByUserId) {
      updates.push(`cancelled_by = $${params.length + 1}`);
      params.push(cancelledByUserId);
    }
    params.push(id);
    const result = await database.query(
      `UPDATE bookings SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, pet_owner_id as "petOwnerId", veterinarian_id as "veterinarianId",
       status, booking_type as "bookingType", scheduled_date as "scheduledDate",
       time_slot_start as "timeSlotStart", time_slot_end as "timeSlotEnd",
       cancelled_by as "cancelledBy", cancelled_at as "cancelledAt",
       created_at as "createdAt", updated_at as "updatedAt"`,
      params
    );
    if (result.rows.length === 0) throw new NotFoundError('Booking', id);
    const updatedBooking = result.rows[0];
    logger.info('Booking cancelled', { bookingId: id, cancellerRole, reason });

    // ─── Auto-refund logic ──────────────────────────────────
    try {
      // Void any unpaid payment holds so abandoned checkouts don't linger
      await database.query(
        `UPDATE payments SET status = 'expired', updated_at = NOW()
         WHERE booking_id = $1 AND status IN ('created', 'pending')`,
        [id]
      ).catch(() => {});

      const paymentsOn = await PaymentModuleConfig.isEnabled();
      if (paymentsOn) {
        // Payment module refund engine (D12 matrix; D7 destination choice)
        await PaymentOrchestrator.refundForCancellation(id, booking.petOwnerId, cancellerRole || 'admin', reason, refundDestination);
      } else {
        // Legacy path (flag off — kept for exact pre-module behavior)
        const payment = await PaymentService.getPaymentByBooking(id);
        if (payment) {
          const paymentAmount = parseFloat(String(payment.amount));

          if (isByDoctor || isByAdmin) {
            // Doctor/admin cancellation: full refund + goodwill bonus
            const autoRefund = await this.getSetting('cancellation.autoRefundOnDoctorCancel', 'true');
            if (autoRefund === 'true') {
              await PaymentService.processRefund(payment.id, paymentAmount, `Auto-refund: ${isByDoctor ? 'Doctor' : 'Admin'} cancelled booking`);
              await WalletService.refund(booking.petOwnerId, paymentAmount, `Refund for cancelled booking`, id, 'booking');

              // Goodwill bonus for doctor cancellation
              if (isByDoctor) {
                const bonusPercent = parseInt(await this.getSetting('cancellation.goodwillBonusPercent', '10'), 10);
                if (bonusPercent > 0) {
                  const bonusAmount = Math.round(paymentAmount * bonusPercent) / 100;
                  await WalletService.addBonus(booking.petOwnerId, bonusAmount, `Goodwill bonus — doctor cancelled your appointment`, id, 'booking');
                }
              }
            }
          } else if (isByPatient) {
            // Patient cancellation: time-based refund policy
            const refundResult = await this.calculatePatientRefund(booking, paymentAmount);
            if (refundResult.refundAmount > 0) {
              await PaymentService.processRefund(payment.id, refundResult.refundAmount, refundResult.reason);
              await WalletService.refund(booking.petOwnerId, refundResult.refundAmount, refundResult.reason, id, 'booking');
            }
          }
        }
      }
    } catch (err) {
      logger.error('Auto-refund failed (non-blocking)', { bookingId: id, error: err });
    }

    // ─── Send cancellation notifications ─────────────────────
    try {
      const cancelerLabel = isByDoctor ? 'Doctor' : isByPatient ? 'Patient' : 'Admin';
      // Notify the other party
      if (isByDoctor) {
        await NotificationService.createNotification(
          booking.petOwnerId, 'booking',
          'Appointment Cancelled by Doctor',
          `Your appointment has been cancelled by the doctor. Reason: ${reason}. A refund has been initiated.`,
          'all', { bookingId: id, cancelledBy: 'doctor' }
        );
      } else if (isByPatient) {
        await NotificationService.createNotification(
          booking.veterinarianId, 'booking',
          'Appointment Cancelled by Patient',
          `A patient has cancelled their appointment. Reason: ${reason}`,
          'all', { bookingId: id, cancelledBy: 'patient' }
        );
      } else if (isByAdmin && cancelledByUserId) {
        // Notify both parties
        await NotificationService.createNotification(
          booking.petOwnerId, 'booking',
          'Appointment Cancelled by Admin',
          `Your appointment has been cancelled by an administrator. Reason: ${reason}`,
          'all', { bookingId: id, cancelledBy: 'admin' }
        );
        await NotificationService.createNotification(
          booking.veterinarianId, 'booking',
          'Appointment Cancelled by Admin',
          `An appointment has been cancelled by an administrator. Reason: ${reason}`,
          'all', { bookingId: id, cancelledBy: 'admin' }
        );
      }
    } catch (err) {
      logger.error('Cancellation notification failed (non-blocking)', { bookingId: id, error: err });
    }

    return updatedBooking;
  }

  /** Calculate patient refund based on time-based cancellation policy */
  private async calculatePatientRefund(booking: Booking, paymentAmount: number): Promise<{ refundAmount: number; reason: string }> {
    const freeWindowHours = parseInt(await this.getSetting('cancellation.patientFreeWindowHours', '24'), 10);
    const partialPercent = parseInt(await this.getSetting('cancellation.partialRefundPercent', '50'), 10);
    const partialWindowHours = parseInt(await this.getSetting('cancellation.partialRefundWindowHours', '2'), 10);

    // Calculate hours until appointment
    const d = new Date(booking.scheduledDate);
    const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const appointmentTime = new Date(`${datePart}T${booking.timeSlotStart}:00`);
    const hoursUntilAppt = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilAppt >= freeWindowHours) {
      return { refundAmount: paymentAmount, reason: `Full refund — cancelled ${Math.floor(hoursUntilAppt)}h before appointment` };
    } else if (hoursUntilAppt >= partialWindowHours) {
      const refund = Math.round(paymentAmount * partialPercent) / 100;
      return { refundAmount: refund, reason: `Partial refund (${partialPercent}%) — cancelled ${Math.floor(hoursUntilAppt)}h before appointment` };
    } else {
      return { refundAmount: 0, reason: 'No refund — cancelled too close to appointment time' };
    }
  }

  /** Helper to read a system setting with default */
  private async getSetting(key: string, defaultValue: string): Promise<string> {
    try {
      const result = await database.query(`SELECT value FROM system_settings WHERE key = $1`, [key]);
      return result.rows[0]?.value || defaultValue;
    } catch { return defaultValue; }
  }

  async rescheduleBooking(id: string, newDate: string, newStart: string, newEnd: string, initiatorRole?: string, newVeterinarianId?: string): Promise<Booking> {
    // Prevent rescheduling to a past date (date-only check; time-of-day
    // validation is done on the frontend using the user's local timezone)
    const requestedDate = new Date(newDate + 'T12:00:00Z');
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    if (requestedDate < todayStart) {
      throw new ValidationError('Cannot reschedule to a past date/time. Please select a future time.');
    }

    // Get the original booking details
    const oldBooking = await this.getBooking(id);

    // Allow pending, confirmed, or missed bookings to be rescheduled
    if (!['pending', 'confirmed', 'missed'].includes(oldBooking.status)) {
      throw new ValidationError(`Cannot reschedule a booking with status '${oldBooking.status}'. Only pending, confirmed, or missed bookings can be rescheduled.`);
    }

    // Determine if this is an expired pending booking (time has passed, never confirmed)
    const isExpiredPending = oldBooking.status === 'pending' && this.isBookingPastDue(oldBooking);

    // For non-expired pending reschedules, enforce the max reschedule limit
    if (oldBooking.status === 'pending' && !isExpiredPending) {
      const maxReschedules = await this.getMaxReschedules();
      const currentCount = (oldBooking as any).rescheduleCount || 0;
      if (maxReschedules > 0 && currentCount >= maxReschedules) {
        throw new ValidationError(`You have reached the maximum number of reschedules (${maxReschedules}). Please cancel and create a new booking.`);
      }
    }

    // For missed bookings, apply role-based reschedule limits:
    //   - missed_by = 'doctor' → unlimited (not the patient's fault)
    //   - missed_by = 'patient' or 'both' → patientNoShowRescheduleLimit
    //   - missed_by = null/undefined → allow (no penalty for legacy records)
    if (oldBooking.status === 'missed') {
      const missedBy = (oldBooking as any).missedBy;
      if (missedBy === 'patient' || missedBy === 'both') {
        const patientLimit = await this.getPatientNoShowRescheduleLimit();
        const currentCount = (oldBooking as any).rescheduleCount || 0;
        if (patientLimit > 0 && currentCount >= patientLimit) {
          throw new ValidationError(
            `You have used your reschedule allowance (${patientLimit} time${patientLimit !== 1 ? 's' : ''}) for a patient no-show. Please contact support to book a new appointment.`
          );
        }
      }
      // missed_by = 'doctor' or null → no limit enforced
    }

    // Determine which vet to use (allow changing vet for reschedules)
    const vetId = newVeterinarianId || oldBooking.veterinarianId;

    // Check for conflicting bookings on the new slot
    const conflicts = await database.query(
      `SELECT id FROM bookings WHERE veterinarian_id = $1 AND scheduled_date = $2
       AND time_slot_start = $3 AND status NOT IN ('cancelled', 'rescheduled', 'payment_expired', 'referred')`,
      [vetId, newDate, newStart]
    );
    if (conflicts.rows.length > 0) {
      throw new ConflictError('This time slot is already booked');
    }

    const now = new Date();

    // Mark OLD booking as 'rescheduled'
    await database.query(
      `UPDATE bookings SET status = 'rescheduled', updated_at = $1 WHERE id = $2`,
      [now, id]
    );

    // Create a NEW booking with the rescheduled date/time
    // If doctor reschedules → auto-confirm; if patient → pending (needs doctor approval)
    const newId = uuidv4();
    const newStatus = initiatorRole === 'veterinarian' ? 'confirmed' : 'pending';
    const confirmedAt = initiatorRole === 'veterinarian' ? now : null;
    // Carry forward reschedule count (+1 only for non-expired-pending reschedules)
    const newRescheduleCount = isExpiredPending ? ((oldBooking as any).rescheduleCount || 0) : ((oldBooking as any).rescheduleCount || 0) + 1;

    const result = await database.query(
      `INSERT INTO bookings (id, pet_owner_id, veterinarian_id, animal_id, enterprise_id, group_id, hospital_id, scheduled_date,
       time_slot_start, time_slot_end, status, booking_type, priority, reason_for_visit,
       symptoms, notes, rescheduled_from, reschedule_count, confirmed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id, pet_owner_id as "petOwnerId", veterinarian_id as "veterinarianId",
       animal_id as "animalId", enterprise_id as "enterpriseId", group_id as "groupId",
       hospital_id as "hospitalId",
       scheduled_date as "scheduledDate",
       time_slot_start as "timeSlotStart", time_slot_end as "timeSlotEnd",
       status, booking_type as "bookingType", priority, reason_for_visit as "reasonForVisit",
       symptoms, notes, rescheduled_from as "rescheduledFrom",
       reschedule_count as "rescheduleCount",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [newId, oldBooking.petOwnerId, vetId, oldBooking.animalId || null,
       (oldBooking as any).enterpriseId || null, (oldBooking as any).groupId || null,
       (oldBooking as any).hospitalId || null,
       newDate, newStart, newEnd, newStatus, oldBooking.bookingType || 'video_call',
       oldBooking.priority || 'normal', oldBooking.reasonForVisit || null,
       oldBooking.symptoms || null, oldBooking.notes || null, id, newRescheduleCount, confirmedAt, now, now]
    );

    // Payment module (§4.2 rule 5): a completed payment follows the booking —
    // re-link it to the new row so no second charge happens on reschedule.
    try {
      const relinked = await database.query(
        `UPDATE payments SET booking_id = $1, updated_at = NOW()
         WHERE booking_id = $2 AND status IN ('completed', 'partially_refunded')
         RETURNING id`,
        [newId, id]
      );
      for (const p of relinked.rows) {
        await database.query(
          `INSERT INTO payment_events (id, payment_id, event_type, payload, created_at)
           VALUES (gen_random_uuid(), $1, 'relinked_on_reschedule', $2, NOW())`,
          [p.id, JSON.stringify({ fromBookingId: id, toBookingId: newId })]
        ).catch(() => {});
      }
    } catch (err) {
      logger.error('Payment re-link on reschedule failed (non-blocking)', { oldBookingId: id, newBookingId: newId, error: err });
    }

    logger.info('Booking rescheduled', { oldBookingId: id, newBookingId: newId, newStatus, initiatorRole, vetChanged: vetId !== oldBooking.veterinarianId });
    return result.rows[0];
  }

  /** Check if a booking's scheduled time has already passed */
  private isBookingPastDue(booking: Booking): boolean {
    const d = new Date(booking.scheduledDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const scheduledEnd = new Date(`${dateStr}T${booking.timeSlotEnd}:00`);
    return scheduledEnd < new Date();
  }

  /** Get max reschedules setting from system_settings */
  private async getMaxReschedules(): Promise<number> {
    try {
      const result = await database.query(
        `SELECT value FROM system_settings WHERE key = 'booking.maxReschedules'`
      );
      return result.rows.length > 0 ? parseInt(result.rows[0].value, 10) || 0 : 1;
    } catch { return 1; }
  }

  /** Get patient no-show reschedule limit from system_settings (0 = unlimited) */
  private async getPatientNoShowRescheduleLimit(): Promise<number> {
    try {
      const result = await database.query(
        `SELECT value FROM system_settings WHERE key = 'booking.patientNoShowRescheduleLimit'`
      );
      return result.rows.length > 0 ? parseInt(result.rows[0].value, 10) || 0 : 1;
    } catch { return 1; }
  }

  /** Get doctor cancellation stats (for reliability scoring) */
  async getDoctorCancellationStats(veterinarianId: string): Promise<{
    totalCancellations: number;
    monthCancellations: number;
    totalBookings: number;
    reliabilityScore: number;
    isReliable: boolean;
  }> {
    const totalResult = await database.query(
      `SELECT COUNT(*) as count FROM bookings WHERE veterinarian_id = $1 AND status = 'cancelled' AND cancelled_by = $1`,
      [veterinarianId]
    );
    const monthResult = await database.query(
      `SELECT COUNT(*) as count FROM bookings WHERE veterinarian_id = $1 AND status = 'cancelled' AND cancelled_by = $1
       AND cancelled_at >= NOW() - INTERVAL '30 days'`,
      [veterinarianId]
    );
    const totalBookingsResult = await database.query(
      `SELECT COUNT(*) as count FROM bookings WHERE veterinarian_id = $1 AND status IN ('completed', 'cancelled', 'missed')`,
      [veterinarianId]
    );

    const totalCancellations = parseInt(totalResult.rows[0]?.count || '0', 10);
    const monthCancellations = parseInt(monthResult.rows[0]?.count || '0', 10);
    const totalBookings = parseInt(totalBookingsResult.rows[0]?.count || '0', 10);

    const maxMonthly = parseInt(await this.getSetting('cancellation.doctorMaxCancellationsPerMonth', '3'), 10);

    // Reliability score: 100 - (cancellation_ratio * 100), min 0
    const reliabilityScore = totalBookings > 0
      ? Math.max(0, Math.round(100 - (totalCancellations / totalBookings * 100)))
      : 100;
    const isReliable = monthCancellations <= maxMonthly;

    return { totalCancellations, monthCancellations, totalBookings, reliabilityScore, isReliable };
  }

  /** Get cancellation statistics for admin dashboard */
  async getCancellationStats(): Promise<{
    totalCancellations: number;
    doctorCancellations: number;
    patientCancellations: number;
    adminCancellations: number;
    totalRefunded: number;
    avgRefundAmount: number;
  }> {
    const statsResult = await database.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE b.cancelled_by = b.veterinarian_id) as by_doctor,
        COUNT(*) FILTER (WHERE b.cancelled_by = b.pet_owner_id) as by_patient,
        COUNT(*) FILTER (WHERE b.cancelled_by IS NOT NULL
          AND b.cancelled_by != b.veterinarian_id
          AND b.cancelled_by != b.pet_owner_id) as by_admin
      FROM bookings b WHERE b.status = 'cancelled'
    `);
    const refundResult = await database.query(`
      SELECT COALESCE(SUM(refund_amount), 0) as total_refunded,
             COALESCE(AVG(refund_amount), 0) as avg_refund
      FROM payments WHERE status = 'refunded'
    `);

    const stats = statsResult.rows[0] || {};
    const refunds = refundResult.rows[0] || {};

    return {
      totalCancellations: parseInt(stats.total || '0', 10),
      doctorCancellations: parseInt(stats.by_doctor || '0', 10),
      patientCancellations: parseInt(stats.by_patient || '0', 10),
      adminCancellations: parseInt(stats.by_admin || '0', 10),
      totalRefunded: parseFloat(refunds.total_refunded || '0'),
      avgRefundAmount: parseFloat(refunds.avg_refund || '0'),
    };
  }

  // ─── Hospital-specific bookings listing ──────────────────────
  async listHospitalBookings(hospitalId: string, params: {
    limit?: number; offset?: number; status?: string;
  }): Promise<PaginatedResponse<Booking>> {
    await this.markMissedBookings();
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const qp: any[] = [];

    // Bookings explicitly linked to this hospital, OR bookings for doctors who belong to this hospital
    qp.push(hospitalId);
    conditions.push(`(b.hospital_id = $1 OR b.veterinarian_id IN (SELECT doctor_id FROM hospital_doctors WHERE hospital_id = $1 AND is_active = true))`);

    if (params.status) {
      qp.push(params.status);
      conditions.push(`b.status = $${qp.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await database.query(`SELECT COUNT(*) as count FROM bookings b ${where}`, qp);
    const result = await database.query(
      `SELECT b.id, b.pet_owner_id as "petOwnerId", b.veterinarian_id as "veterinarianId",
       b.animal_id as "animalId", b.hospital_id as "hospitalId",
       b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
       b.time_slot_end as "timeSlotEnd", b.status, b.booking_type as "bookingType",
       b.priority, b.reason_for_visit as "reasonForVisit", b.symptoms, b.notes,
       b.created_at as "createdAt", b.updated_at as "updatedAt",
       CONCAT(po.first_name, ' ', po.last_name) as "petOwnerName",
       CONCAT('Dr. ', v.first_name, ' ', v.last_name) as "vetName",
       a.name as "animalName", a.species as "animalSpecies"
       FROM bookings b
       LEFT JOIN users po ON po.id = b.pet_owner_id
       LEFT JOIN users v ON v.id = b.veterinarian_id
       LEFT JOIN animals a ON a.id = b.animal_id
       ${where}
       ORDER BY b.scheduled_date DESC, b.time_slot_start DESC
       LIMIT $${qp.length + 1} OFFSET $${qp.length + 2}`,
      [...qp, limit, offset]
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit,
    };
  }
}

export default new BookingService();
