import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { VetSchedule, TimeSlot, VetAvailability, DayOfWeek } from '../models/types';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

interface DateOverride {
  id: string; veterinarianId: string; overrideDate: string;
  overrideType: 'unavailable' | 'custom_hours';
  startTime?: string; endTime?: string; slotDuration?: number;
  reason?: string; createdBy?: string; createdAt: string; updatedAt: string;
}

interface BlockedSlot {
  id: string; veterinarianId: string; blockDate?: string;
  startTime: string; endTime: string; reason?: string;
  isRecurring: boolean; recurringDay?: string;
  createdAt: string; updatedAt: string;
}

interface HospitalHoliday {
  id: string; hospitalId?: string; holidayDate: string;
  name: string; holidayType: string;
  isFullDay: boolean; startTime?: string; endTime?: string;
  createdBy?: string; createdAt: string; updatedAt: string;
}

class ScheduleService {
  async createSchedule(veterinarianId: string, data: {
    dayOfWeek: DayOfWeek; startTime: string; endTime: string;
    slotDuration?: number; slotDurationMinutes?: number; maxAppointments?: number;
  }): Promise<VetSchedule> {
    const id = uuidv4();
    const now = new Date();
    const slotDuration = data.slotDuration || data.slotDurationMinutes || 30;

    // Check for conflict
    const existing = await database.query(
      `SELECT id FROM vet_schedules WHERE veterinarian_id = $1 AND day_of_week = $2`,
      [veterinarianId, data.dayOfWeek]
    );
    if (existing.rows.length > 0) {
      throw new ConflictError(`Schedule already exists for ${data.dayOfWeek}`);
    }

    const result = await database.query(
      `INSERT INTO vet_schedules (id, veterinarian_id, day_of_week, start_time, end_time,
       slot_duration, max_appointments, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, veterinarian_id as "veterinarianId", day_of_week as "dayOfWeek",
       start_time as "startTime", end_time as "endTime", slot_duration as "slotDuration",
       max_appointments as "maxAppointments", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [id, veterinarianId, data.dayOfWeek, data.startTime, data.endTime,
       slotDuration, data.maxAppointments || 10, (data as any).isAvailable !== undefined ? (data as any).isAvailable : true, now, now]
    );

    logger.info('Vet schedule created', { scheduleId: id, veterinarianId, dayOfWeek: data.dayOfWeek });
    return result.rows[0];
  }

  async getSchedules(veterinarianId: string): Promise<VetSchedule[]> {
    const result = await database.query(
      `SELECT id, veterinarian_id as "veterinarianId", day_of_week as "dayOfWeek",
       start_time as "startTime", end_time as "endTime", slot_duration as "slotDuration",
       max_appointments as "maxAppointments", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM vet_schedules WHERE veterinarian_id = $1 ORDER BY 
       CASE day_of_week 
         WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
         WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
         WHEN 'sunday' THEN 7 END`,
      [veterinarianId]
    );
    return result.rows;
  }

  async updateSchedule(id: string, veterinarianId: string, data: Partial<VetSchedule> & Record<string, any>): Promise<VetSchedule> {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.startTime) { updates.push(`start_time = $${idx++}`); params.push(data.startTime); }
    if (data.endTime) { updates.push(`end_time = $${idx++}`); params.push(data.endTime); }
    const slotDur = data.slotDuration || data.slotDurationMinutes;
    if (slotDur) { updates.push(`slot_duration = $${idx++}`); params.push(slotDur); }
    if (data.maxAppointments) { updates.push(`max_appointments = $${idx++}`); params.push(data.maxAppointments); }
    const isActive = data.isActive !== undefined ? data.isActive : data.isAvailable;
    if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); params.push(isActive); }
    updates.push(`updated_at = $${idx++}`); params.push(new Date());
    params.push(id);
    params.push(veterinarianId);

    const result = await database.query(
      `UPDATE vet_schedules SET ${updates.join(', ')} WHERE id = $${idx++} AND veterinarian_id = $${idx}
       RETURNING id, veterinarian_id as "veterinarianId", day_of_week as "dayOfWeek",
       start_time as "startTime", end_time as "endTime", slot_duration as "slotDuration",
       max_appointments as "maxAppointments", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
      params
    );

    if (result.rows.length === 0) throw new NotFoundError('Schedule', id);
    return result.rows[0];
  }

  async deleteSchedule(id: string, veterinarianId: string): Promise<void> {
    const result = await database.query(
      `DELETE FROM vet_schedules WHERE id = $1 AND veterinarian_id = $2`,
      [id, veterinarianId]
    );
    if (result.rowCount === 0) throw new NotFoundError('Schedule', id);
  }

  async getAvailability(veterinarianId: string, date: string): Promise<VetAvailability> {
    const dayOfWeek = this.getDayOfWeek(new Date(date + 'T12:00:00'));

    // 1. Check hospital holidays (system-wide: hospital_id IS NULL)
    const holidayResult = await database.query(
      `SELECT id, name FROM hospital_holidays
       WHERE holiday_date = $1 AND (hospital_id IS NULL) AND is_full_day = true`,
      [date]
    );
    if (holidayResult.rows.length > 0) {
      return { veterinarianId, date, slots: [], holiday: holidayResult.rows[0].name };
    }

    // 2. Check date override (day off or custom hours)
    const overrideResult = await database.query(
      `SELECT override_type as "overrideType", start_time as "startTime",
              end_time as "endTime", slot_duration as "slotDuration", reason
       FROM vet_date_overrides WHERE veterinarian_id = $1 AND override_date = $2`,
      [veterinarianId, date]
    );
    const override = overrideResult.rows[0];

    if (override && override.overrideType === 'unavailable') {
      return { veterinarianId, date, slots: [], unavailableReason: override.reason || 'Doctor unavailable' };
    }

    // 3. Determine working hours: override custom_hours OR weekly schedule
    let startTime: string, endTime: string, slotDuration: number;

    if (override && override.overrideType === 'custom_hours') {
      startTime = override.startTime;
      endTime = override.endTime;
      slotDuration = override.slotDuration || 30;
    } else {
      const scheduleResult = await database.query(
        `SELECT start_time as "startTime", end_time as "endTime", slot_duration as "slotDuration"
         FROM vet_schedules WHERE veterinarian_id = $1 AND day_of_week = $2 AND is_active = true`,
        [veterinarianId, dayOfWeek]
      );
      if (scheduleResult.rows.length === 0) {
        return { veterinarianId, date, slots: [] };
      }
      const schedule = scheduleResult.rows[0];
      startTime = schedule.startTime;
      endTime = schedule.endTime;
      slotDuration = schedule.slotDuration || 30;
    }

    // 4. Get blocked slots for this date (one-time blocks + recurring day blocks)
    const blockedResult = await database.query(
      `SELECT start_time as "startTime", end_time as "endTime"
       FROM vet_blocked_slots WHERE veterinarian_id = $1
       AND ((is_recurring = false AND block_date = $2) OR (is_recurring = true AND recurring_day = $3))`,
      [veterinarianId, date, dayOfWeek]
    );
    const blockedRanges = blockedResult.rows;

    // 5. Get partial-day holiday blocks
    const partialHolidayResult = await database.query(
      `SELECT start_time as "startTime", end_time as "endTime"
       FROM hospital_holidays WHERE holiday_date = $1 AND is_full_day = false
       AND start_time IS NOT NULL AND end_time IS NOT NULL`,
      [date]
    );
    const allBlockedRanges = [...blockedRanges, ...partialHolidayResult.rows];

    // 6. Get existing bookings
    const bookingsResult = await database.query(
      `SELECT time_slot_start as "timeSlotStart", time_slot_end as "timeSlotEnd", id
       FROM bookings WHERE veterinarian_id = $1 AND scheduled_date = $2 AND status NOT IN ('cancelled')`,
      [veterinarianId, date]
    );
    const bookedSlots = new Set(bookingsResult.rows.map((b: any) => b.timeSlotStart));

    // 7. Generate time slots, filtering out blocked ranges
    const slots: TimeSlot[] = [];
    let currentTime = this.parseTime(startTime);
    const endTimeMinutes = this.parseTime(endTime);

    while (currentTime < endTimeMinutes) {
      const slotStart = currentTime;
      const slotEnd = currentTime + slotDuration;
      const startStr = this.formatTime(slotStart);
      const endStr = this.formatTime(slotEnd);

      // Check if this slot overlaps with any blocked range
      const isBlocked = allBlockedRanges.some((block: any) => {
        const blockStart = this.parseTime(block.startTime);
        const blockEnd = this.parseTime(block.endTime);
        return slotStart < blockEnd && slotEnd > blockStart;
      });

      if (!isBlocked) {
        slots.push({
          startTime: startStr,
          endTime: endStr,
          isAvailable: !bookedSlots.has(startStr),
          bookingId: bookingsResult.rows.find((b: any) => b.timeSlotStart === startStr)?.id
        });
      }

      currentTime += slotDuration;
    }

    return { veterinarianId, date, slots };
  }

  // ── Date Overrides ──────────────────────────────────────────
  async createDateOverride(veterinarianId: string, data: {
    overrideDate: string; overrideType: 'unavailable' | 'custom_hours';
    startTime?: string; endTime?: string; slotDuration?: number; reason?: string;
  }, createdBy?: string): Promise<DateOverride> {
    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO vet_date_overrides (id, veterinarian_id, override_date, override_type,
       start_time, end_time, slot_duration, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (veterinarian_id, override_date) DO UPDATE SET
         override_type = EXCLUDED.override_type, start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time, slot_duration = EXCLUDED.slot_duration,
         reason = EXCLUDED.reason, updated_at = NOW()
       RETURNING id, veterinarian_id as "veterinarianId", override_date as "overrideDate",
       override_type as "overrideType", start_time as "startTime", end_time as "endTime",
       slot_duration as "slotDuration", reason, created_by as "createdBy",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [id, veterinarianId, data.overrideDate, data.overrideType,
       data.startTime || null, data.endTime || null, data.slotDuration || null,
       data.reason || null, createdBy || veterinarianId]
    );
    logger.info('Date override created', { veterinarianId, date: data.overrideDate, type: data.overrideType });
    return result.rows[0];
  }

  async bulkCreateDateOverrides(veterinarianId: string, dates: string[], overrideType: 'unavailable' | 'custom_hours',
    data: { startTime?: string; endTime?: string; slotDuration?: number; reason?: string; } = {},
    createdBy?: string): Promise<DateOverride[]> {
    const results: DateOverride[] = [];
    for (const date of dates) {
      const override = await this.createDateOverride(veterinarianId,
        { overrideDate: date, overrideType, ...data }, createdBy);
      results.push(override);
    }
    return results;
  }

  async listDateOverrides(veterinarianId: string, fromDate?: string, toDate?: string): Promise<DateOverride[]> {
    let query = `SELECT id, veterinarian_id as "veterinarianId", override_date as "overrideDate",
       override_type as "overrideType", start_time as "startTime", end_time as "endTime",
       slot_duration as "slotDuration", reason, created_by as "createdBy",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM vet_date_overrides WHERE veterinarian_id = $1`;
    const params: any[] = [veterinarianId];
    if (fromDate) { params.push(fromDate); query += ` AND override_date >= $${params.length}`; }
    if (toDate) { params.push(toDate); query += ` AND override_date <= $${params.length}`; }
    query += ' ORDER BY override_date ASC';
    const result = await database.query(query, params);
    return result.rows;
  }

  async deleteDateOverride(id: string, veterinarianId: string): Promise<void> {
    const result = await database.query(
      `DELETE FROM vet_date_overrides WHERE id = $1 AND veterinarian_id = $2`, [id, veterinarianId]);
    if (result.rowCount === 0) throw new NotFoundError('Date override', id);
  }

  // ── Blocked Slots ───────────────────────────────────────────
  async createBlockedSlot(veterinarianId: string, data: {
    blockDate?: string; startTime: string; endTime: string; reason?: string;
    isRecurring?: boolean; recurringDay?: string;
  }): Promise<BlockedSlot> {
    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO vet_blocked_slots (id, veterinarian_id, block_date, start_time, end_time,
       reason, is_recurring, recurring_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, veterinarian_id as "veterinarianId", block_date as "blockDate",
       start_time as "startTime", end_time as "endTime", reason,
       is_recurring as "isRecurring", recurring_day as "recurringDay",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [id, veterinarianId, data.blockDate || null, data.startTime, data.endTime,
       data.reason || null, data.isRecurring || false, data.recurringDay || null]
    );
    logger.info('Blocked slot created', { veterinarianId, recurring: data.isRecurring || false });
    return result.rows[0];
  }

  async listBlockedSlots(veterinarianId: string): Promise<BlockedSlot[]> {
    const result = await database.query(
      `SELECT id, veterinarian_id as "veterinarianId", block_date as "blockDate",
       start_time as "startTime", end_time as "endTime", reason,
       is_recurring as "isRecurring", recurring_day as "recurringDay",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM vet_blocked_slots WHERE veterinarian_id = $1
       ORDER BY is_recurring DESC, block_date ASC NULLS FIRST`, [veterinarianId]);
    return result.rows;
  }

  async deleteBlockedSlot(id: string, veterinarianId: string): Promise<void> {
    const result = await database.query(
      `DELETE FROM vet_blocked_slots WHERE id = $1 AND veterinarian_id = $2`, [id, veterinarianId]);
    if (result.rowCount === 0) throw new NotFoundError('Blocked slot', id);
  }

  // ── Hospital Holidays ───────────────────────────────────────
  async createHoliday(data: {
    hospitalId?: string; holidayDate: string; name: string;
    holidayType?: string; isFullDay?: boolean;
    startTime?: string; endTime?: string;
  }, createdBy: string): Promise<HospitalHoliday> {
    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO hospital_holidays (id, hospital_id, holiday_date, name, holiday_type,
       is_full_day, start_time, end_time, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, hospital_id as "hospitalId", holiday_date as "holidayDate",
       name, holiday_type as "holidayType", is_full_day as "isFullDay",
       start_time as "startTime", end_time as "endTime", created_by as "createdBy",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [id, data.hospitalId || null, data.holidayDate, data.name,
       data.holidayType || 'general', data.isFullDay !== false, 
       data.startTime || null, data.endTime || null, createdBy]
    );
    logger.info('Holiday created', { name: data.name, date: data.holidayDate });
    return result.rows[0];
  }

  async listHolidays(params: { hospitalId?: string; fromDate?: string; toDate?: string; year?: number } = {}): Promise<HospitalHoliday[]> {
    let query = `SELECT id, hospital_id as "hospitalId", holiday_date as "holidayDate",
       name, holiday_type as "holidayType", is_full_day as "isFullDay",
       start_time as "startTime", end_time as "endTime", created_by as "createdBy",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM hospital_holidays WHERE 1=1`;
    const qParams: any[] = [];
    if (params.hospitalId) {
      qParams.push(params.hospitalId);
      query += ` AND (hospital_id = $${qParams.length} OR hospital_id IS NULL)`;
    }
    if (params.fromDate) { qParams.push(params.fromDate); query += ` AND holiday_date >= $${qParams.length}`; }
    if (params.toDate) { qParams.push(params.toDate); query += ` AND holiday_date <= $${qParams.length}`; }
    if (params.year) { qParams.push(params.year); query += ` AND EXTRACT(YEAR FROM holiday_date) = $${qParams.length}`; }
    query += ' ORDER BY holiday_date ASC';
    const result = await database.query(query, qParams);
    return result.rows;
  }

  async updateHoliday(id: string, data: {
    holidayDate?: string; name?: string; holidayType?: string;
    isFullDay?: boolean; startTime?: string; endTime?: string;
  }): Promise<HospitalHoliday> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.holidayDate !== undefined) { fields.push(`holiday_date = $${idx++}`); values.push(data.holidayDate); }
    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.holidayType !== undefined) { fields.push(`holiday_type = $${idx++}`); values.push(data.holidayType); }
    if (data.isFullDay !== undefined) { fields.push(`is_full_day = $${idx++}`); values.push(data.isFullDay); }
    if (data.startTime !== undefined) { fields.push(`start_time = $${idx++}`); values.push(data.startTime || null); }
    if (data.endTime !== undefined) { fields.push(`end_time = $${idx++}`); values.push(data.endTime || null); }
    if (fields.length === 0) throw new ValidationError('No fields to update');
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await database.query(
      `UPDATE hospital_holidays SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, hospital_id as "hospitalId", holiday_date as "holidayDate",
       name, holiday_type as "holidayType", is_full_day as "isFullDay",
       start_time as "startTime", end_time as "endTime", created_by as "createdBy",
       created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );
    if (result.rowCount === 0) throw new NotFoundError('Holiday', id);
    logger.info('Holiday updated', { id });
    return result.rows[0];
  }

  async deleteHoliday(id: string): Promise<void> {
    const result = await database.query(`DELETE FROM hospital_holidays WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw new NotFoundError('Holiday', id);
  }

  // ── Availability Summary (for calendar views) ──────────────
  async getMonthlyAvailabilitySummary(veterinarianId: string, year: number, month: number): Promise<{
    date: string; status: 'available' | 'unavailable' | 'custom' | 'holiday' | 'no_schedule';
    reason?: string;
  }[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day

    // Get overrides for the month
    const overrides = await this.listDateOverrides(veterinarianId, startDate, endDate);
    const overrideMap = new Map(overrides.map(o => [o.overrideDate.toString().split('T')[0], o]));

    // Get holidays for the month
    const holidays = await this.listHolidays({ fromDate: startDate, toDate: endDate });
    const holidayMap = new Map(holidays.filter(h => h.isFullDay).map(h => [h.holidayDate.toString().split('T')[0], h]));

    // Get weekly schedule
    const schedules = await this.getSchedules(veterinarianId);
    const scheduleDays = new Set(schedules.filter(s => s.isActive).map(s => s.dayOfWeek));

    const summary: any[] = [];
    const current = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = this.getDayOfWeek(current);

      if (holidayMap.has(dateStr)) {
        summary.push({ date: dateStr, status: 'holiday', reason: holidayMap.get(dateStr)!.name });
      } else if (overrideMap.has(dateStr)) {
        const ov = overrideMap.get(dateStr)!;
        summary.push({
          date: dateStr,
          status: ov.overrideType === 'unavailable' ? 'unavailable' : 'custom',
          reason: ov.reason
        });
      } else if (scheduleDays.has(dayOfWeek)) {
        summary.push({ date: dateStr, status: 'available' });
      } else {
        summary.push({ date: dateStr, status: 'no_schedule' });
      }

      current.setDate(current.getDate() + 1);
    }

    return summary;
  }

  // ── Search Vets By Availability ────────────────────────────
  async searchVetsByAvailability(params: {
    date: string;
    timeFrom?: string;
    timeTo?: string;
    specialization?: string;
    language?: string;
    acceptsEmergency?: boolean;
    minRating?: number;
    maxFee?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vets: any[]; total: number }> {
    const { date, timeFrom, timeTo, specialization, language, acceptsEmergency,
            minRating, maxFee, search, limit = 20, offset = 0 } = params;

    let vetQuery = `
      SELECT vp.id, vp.user_id as "userId", vp.license_number as "licenseNumber",
             vp.specializations, vp.qualifications,
             vp.years_of_experience as "yearsOfExperience", vp.bio,
             vp.clinic_name as "clinicName", vp.clinic_address as "clinicAddress",
             vp.consultation_fee as "consultationFee", vp.currency,
             vp.is_verified as "isVerified", vp.is_available as "isAvailable",
             vp.accepts_emergency as "acceptsEmergency",
             vp.available_days as "availableDays",
             vp.available_hours_start as "availableHoursStart",
             vp.available_hours_end as "availableHoursEnd",
             vp.languages, vp.rating, vp.total_reviews as "totalReviews",
             vp.total_consultations as "totalConsultations",
             u.first_name as "firstName", u.last_name as "lastName",
             vp.created_at as "createdAt", vp.updated_at as "updatedAt"
      FROM vet_profiles vp JOIN users u ON u.id = vp.user_id
      WHERE u.is_active = true
    `;
    const vetParams: any[] = [];
    let idx = 0;

    if (specialization) {
      idx++;
      vetQuery += ` AND $${idx} = ANY(vp.specializations)`;
      vetParams.push(specialization);
    }
    if (language) {
      idx++;
      vetQuery += ` AND $${idx} = ANY(vp.languages)`;
      vetParams.push(language);
    }
    if (acceptsEmergency) {
      vetQuery += ` AND vp.accepts_emergency = true`;
    }
    if (minRating != null && minRating > 0) {
      idx++;
      vetQuery += ` AND vp.rating >= $${idx}`;
      vetParams.push(minRating);
    }
    if (maxFee != null) {
      idx++;
      vetQuery += ` AND vp.consultation_fee <= $${idx}`;
      vetParams.push(maxFee);
    }
    if (search) {
      idx++;
      vetQuery += ` AND (
        u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx}
        OR vp.clinic_name ILIKE $${idx}
        OR EXISTS (SELECT 1 FROM unnest(vp.specializations) s WHERE s ILIKE $${idx})
      )`;
      vetParams.push(`%${search}%`);
    }
    vetQuery += ` LIMIT 200`;

    const vetResult = await database.query(vetQuery, vetParams);
    const allVets = vetResult.rows;

    const fromMinutes = timeFrom ? this.parseTime(timeFrom) : null;
    const toMinutes   = timeTo   ? this.parseTime(timeTo)   : null;

    const results = await Promise.all(
      allVets.map(async (vet: any) => {
        try {
          const availability = await this.getAvailability(vet.userId, date);
          let slots = availability.slots.filter(s => s.isAvailable);

          if (fromMinutes !== null || toMinutes !== null) {
            slots = slots.filter(slot => {
              const slotStart = this.parseTime(slot.startTime);
              if (fromMinutes !== null && slotStart < fromMinutes) return false;
              if (toMinutes   !== null && slotStart >= toMinutes)  return false;
              return true;
            });
          }

          // Filter out past slots when searching for today's date (IST = UTC+5:30)
          const istOffsetMs = 5.5 * 60 * 60 * 1000;
          const istNow = new Date(Date.now() + istOffsetMs);
          const istTodayStr = istNow.toISOString().split('T')[0];
          if (date === istTodayStr) {
            const nowMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes() + 15;
            slots = slots.filter(slot => this.parseTime(slot.startTime) > nowMinutes);
          }

          if (slots.length === 0) return null;

          return {
            ...vet,
            availableSlots:    slots,
            totalAvailableSlots: slots.length,
            nextAvailableTime: slots[0]?.startTime,
          };
        } catch {
          return null;
        }
      })
    );

    const available = results.filter((v): v is NonNullable<typeof v> => v !== null);
    available.sort((a, b) => {
      if (b.totalAvailableSlots !== a.totalAvailableSlots) return b.totalAvailableSlots - a.totalAvailableSlots;
      return Number(b.rating) - Number(a.rating);
    });

    return { vets: available.slice(offset, offset + limit), total: available.length };
  }

  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}

export default new ScheduleService();
