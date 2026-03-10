import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { Booking, CreateBookingDTO, BookingStatus, PaginatedResponse } from '../models/types';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

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

    // Mark confirmed bookings as missed whose scheduled window has passed.
    // Determines missed_by:
    //   'patient'  — video session created (doctor opened room) but stuck in 'waiting'
    //   'doctor'   — no video session created at all (doctor never started the room)
    // Skips bookings whose consultation is already completed or in_progress.
    const result = await database.query(
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

    if (result.rows.length > 0) {
      logger.info(`Auto-marked ${result.rows.length} booking(s) as missed`, {
        bookingIds: result.rows.map((r: any) => r.id),
        byDoctor: result.rows.filter((r: any) => r.missed_by === 'doctor').length,
        byPatient: result.rows.filter((r: any) => r.missed_by === 'patient').length,
      });
    }
    return result.rows.length;
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
    
    // Check for conflicting bookings
    const conflicts = await database.query(
      `SELECT id FROM bookings WHERE veterinarian_id = $1 AND scheduled_date = $2 
       AND time_slot_start = $3 AND status NOT IN ('cancelled')`,
      [data.veterinarianId, data.scheduledDate, data.timeSlotStart]
    );

    if (conflicts.rows.length > 0) {
      throw new ConflictError('This time slot is already booked');
    }

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
       data.timeSlotStart, data.timeSlotEnd, 'pending', data.bookingType,
       data.priority || 'normal', data.reasonForVisit, data.symptoms || null,
       data.notes || null, now, now]
    );

    logger.info('Booking created', { bookingId: id, petOwnerId, vetId: data.veterinarianId, hospitalId: data.hospitalId });
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
       cancellation_reason as "cancellationReason", confirmed_at as "confirmedAt",
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
    // Auto-mark missed bookings before listing
    await this.markMissedBookings();

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
    // Use local date methods to avoid timezone shift (pg returns DATE as local midnight)
    const d = new Date(booking.scheduledDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const scheduledEnd = new Date(`${dateStr}T${booking.timeSlotEnd}:00`);
    if (scheduledEnd < new Date()) {
      throw new ValidationError('Cannot confirm a booking whose scheduled time has already passed.');
    }
    return this.updateBookingStatus(id, 'confirmed');
  }

  async cancelBooking(id: string, reason: string): Promise<Booking> {
    return this.updateBookingStatus(id, 'cancelled', reason);
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
       AND time_slot_start = $3 AND status NOT IN ('cancelled', 'rescheduled')`,
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
