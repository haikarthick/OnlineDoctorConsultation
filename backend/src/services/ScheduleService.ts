import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { VetSchedule, TimeSlot, VetAvailability, DayOfWeek } from '../models/types';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

class ScheduleService {
  async createSchedule(veterinarianId: string, data: {
    dayOfWeek: DayOfWeek; startTime: string; endTime: string;
    slotDuration?: number; maxAppointments?: number;
  }): Promise<VetSchedule> {
    const id = uuidv4();
    const now = new Date();

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
       data.slotDuration || 30, data.maxAppointments || 10, true, now, now]
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

  async updateSchedule(id: string, veterinarianId: string, data: Partial<VetSchedule>): Promise<VetSchedule> {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.startTime) { updates.push(`start_time = $${idx++}`); params.push(data.startTime); }
    if (data.endTime) { updates.push(`end_time = $${idx++}`); params.push(data.endTime); }
    if (data.slotDuration) { updates.push(`slot_duration = $${idx++}`); params.push(data.slotDuration); }
    if (data.maxAppointments) { updates.push(`max_appointments = $${idx++}`); params.push(data.maxAppointments); }
    if (data.isActive !== undefined) { updates.push(`is_active = $${idx++}`); params.push(data.isActive); }
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
    // Reject past dates entirely
    const requestedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return { veterinarianId, date, slots: [] };
    }

    const isToday = requestedDate.getTime() === today.getTime();
    // Use T12:00:00 to avoid timezone day-shift when parsing date-only strings
    const dayOfWeek = this.getDayOfWeek(new Date(date + 'T12:00:00'));
    
    // Get schedule for the day
    const scheduleResult = await database.query(
      `SELECT id, start_time as "startTime", end_time as "endTime", slot_duration as "slotDuration",
       max_appointments as "maxAppointments"
       FROM vet_schedules WHERE veterinarian_id = $1 AND day_of_week = $2 AND is_active = $3`,
      [veterinarianId, dayOfWeek, true]
    );

    if (scheduleResult.rows.length === 0) {
      return { veterinarianId, date, slots: [] };
    }

    const schedule = scheduleResult.rows[0];
    
    // Get existing bookings for the date
    const bookingsResult = await database.query(
      `SELECT time_slot_start as "timeSlotStart", time_slot_end as "timeSlotEnd", id
       FROM bookings WHERE veterinarian_id = $1 AND scheduled_date = $2 AND status NOT IN ('cancelled')`,
      [veterinarianId, date]
    );

    const bookedSlots = new Set(bookingsResult.rows.map((b: any) => b.timeSlotStart));
    
    // Generate time slots
    const slots: TimeSlot[] = [];
    const slotDuration = schedule.slotDuration || 30;
    let currentTime = this.parseTime(schedule.startTime);
    const endTime = this.parseTime(schedule.endTime);

    // For today, calculate current time in minutes to filter past slots
    const now = new Date();
    const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

    while (currentTime < endTime) {
      const startStr = this.formatTime(currentTime);
      const endStr = this.formatTime(currentTime + slotDuration);
      
      // Skip slots that are already in the past (for today)
      if (isToday && currentTime <= currentMinutesOfDay) {
        currentTime += slotDuration;
        continue;
      }

      slots.push({
        startTime: startStr,
        endTime: endStr,
        isAvailable: !bookedSlots.has(startStr),
        bookingId: bookingsResult.rows.find((b: any) => b.timeSlotStart === startStr)?.id
      });

      currentTime += slotDuration;
    }

    return { veterinarianId, date, slots };
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
