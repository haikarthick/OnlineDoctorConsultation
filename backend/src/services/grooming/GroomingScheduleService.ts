import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import GroomingProviderService from './GroomingProviderService';

/**
 * Grooming availability: working hours, date overrides, blocked ranges and bookable slots.
 *
 * The grooming counterpart of ScheduleService, kept SEPARATE per the module-separation rule —
 * it reads grooming_schedules/grooming_date_overrides/grooming_blocked_slots and never touches
 * vet_schedules or bookings.
 *
 * Two things this does that the consultation engine cannot:
 *   CAPACITY — a slot is bookable while overlapping orders < capacity, not merely "unbooked".
 *              A salon with three tables sells the same 10:00 three times.
 *   DURATION — occupancy is the interval [start, start + service duration). A 120-minute full
 *              groom starting at 10:00 blocks a station until 12:00, so 10:30 and 11:00 are
 *              only offered if another station is free.
 *
 * Times are 'HH:MM' strings throughout, matching how grooming_orders already stores
 * time_slot_start — no timezone maths, because a salon's opening hours are local by definition.
 */

/** Statuses that still occupy a station. Terminal/failed states release the slot. */
const OCCUPYING_STATUSES = `(
  'payment_pending','pending_provider_acceptance','confirmed','provider_assigned',
  'checked_in','en_route','intake_done','in_progress','awaiting_approval',
  'quality_check','ready_for_pickup','returning'
)`;

export interface GroomingSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  remainingCapacity: number;
}

export interface GroomingAvailability {
  providerId: string;
  locationId: string | null;
  date: string;
  slots: GroomingSlot[];
  capacity: number;
  /** Populated when the day yields no slots, so the UI can say WHY rather than "none". */
  closedReason?: string;
}

function parseTime(t: string): number {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 0=Sunday … 6=Saturday, matching the day_of_week CHECK and the consultation convention. */
function dayOfWeek(date: string): number {
  // Midday avoids the date shifting a day under any local-timezone interpretation.
  return new Date(`${date}T12:00:00`).getDay();
}

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(`${date}T12:00:00`).getTime());
}

class GroomingScheduleService {
  /** Owner/manager may edit the schedule; plain staff may not. */
  private async requireScheduleAdmin(userId: string, providerId: string): Promise<void> {
    const role = await GroomingProviderService.resolveProviderAccess(userId, providerId);
    if (role !== 'owner' && role !== 'manager') throw new NotFoundError('GroomingProvider', providerId);
  }

  private validateWindow(open: string, close: string): void {
    if (!/^\d{1,2}:\d{2}$/.test(open || '') || !/^\d{1,2}:\d{2}$/.test(close || ''))
      throw new ValidationError('Times must be in HH:MM format');
    if (parseTime(close) <= parseTime(open))
      throw new ValidationError('Closing time must be after opening time');
  }

  // ── Weekly working hours ───────────────────────────────────────
  async listSchedules(userId: string, providerId: string): Promise<any[]> {
    await GroomingProviderService.resolveProviderAccess(userId, providerId);
    const r = await database.query(
      `SELECT id, provider_id as "providerId", location_id as "locationId", day_of_week as "dayOfWeek",
              open_time as "openTime", close_time as "closeTime",
              slot_interval_minutes as "slotIntervalMinutes", capacity, is_active as "isActive"
       FROM grooming_schedules WHERE provider_id = $1
       ORDER BY day_of_week ASC, open_time ASC`, [providerId]);
    return r.rows;
  }

  /**
   * Upsert one weekday's hours. Upsert rather than insert so the provider UI can be a simple
   * seven-row form that saves idempotently instead of the caller tracking row ids.
   */
  async saveSchedule(userId: string, providerId: string, data: {
    dayOfWeek: number; locationId?: string | null; openTime: string; closeTime: string;
    slotIntervalMinutes?: number; capacity?: number; isActive?: boolean;
  }): Promise<any> {
    await this.requireScheduleAdmin(userId, providerId);
    if (!(data.dayOfWeek >= 0 && data.dayOfWeek <= 6)) throw new ValidationError('dayOfWeek must be 0–6');
    this.validateWindow(data.openTime, data.closeTime);

    const locationId = data.locationId || null;
    const interval = data.slotIntervalMinutes ?? 30;
    const capacity = data.capacity ?? 1;

    // ON CONFLICT cannot target the two partial indexes with one clause, so the NULL-location
    // and per-location cases are matched explicitly. IS NOT DISTINCT FROM treats NULL = NULL.
    const existing = await database.query(
      `SELECT id FROM grooming_schedules
       WHERE provider_id = $1 AND day_of_week = $2 AND location_id IS NOT DISTINCT FROM $3`,
      [providerId, data.dayOfWeek, locationId]);

    if (existing.rows.length > 0) {
      const r = await database.query(
        `UPDATE grooming_schedules SET open_time = $2, close_time = $3, slot_interval_minutes = $4,
                capacity = $5, is_active = $6, updated_at = NOW()
         WHERE id = $1
         RETURNING id, provider_id as "providerId", location_id as "locationId", day_of_week as "dayOfWeek",
                   open_time as "openTime", close_time as "closeTime",
                   slot_interval_minutes as "slotIntervalMinutes", capacity, is_active as "isActive"`,
        [existing.rows[0].id, data.openTime, data.closeTime, interval, capacity, data.isActive !== false]);
      return r.rows[0];
    }
    const r = await database.query(
      `INSERT INTO grooming_schedules
         (provider_id, location_id, day_of_week, open_time, close_time, slot_interval_minutes, capacity, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, provider_id as "providerId", location_id as "locationId", day_of_week as "dayOfWeek",
                 open_time as "openTime", close_time as "closeTime",
                 slot_interval_minutes as "slotIntervalMinutes", capacity, is_active as "isActive"`,
      [providerId, locationId, data.dayOfWeek, data.openTime, data.closeTime, interval, capacity, data.isActive !== false]);
    return r.rows[0];
  }

  async deleteSchedule(userId: string, providerId: string, id: string): Promise<void> {
    await this.requireScheduleAdmin(userId, providerId);
    const r = await database.query(
      `DELETE FROM grooming_schedules WHERE id = $1 AND provider_id = $2`, [id, providerId]);
    if (r.rowCount === 0) throw new NotFoundError('GroomingSchedule', id);
  }

  // ── Date overrides (closures / one-off hours) ──────────────────
  async listOverrides(userId: string, providerId: string, from?: string, to?: string): Promise<any[]> {
    await GroomingProviderService.resolveProviderAccess(userId, providerId);
    const params: any[] = [providerId];
    let where = `WHERE provider_id = $1`;
    if (from) { params.push(from); where += ` AND override_date >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND override_date <= $${params.length}`; }
    const r = await database.query(
      `SELECT id, provider_id as "providerId", location_id as "locationId", override_date as "overrideDate",
              override_type as "overrideType", open_time as "openTime", close_time as "closeTime",
              slot_interval_minutes as "slotIntervalMinutes", capacity, reason
       FROM grooming_date_overrides ${where} ORDER BY override_date ASC`, params);
    return r.rows;
  }

  async saveOverride(userId: string, providerId: string, data: {
    overrideDate: string; overrideType: 'closed' | 'custom_hours'; locationId?: string | null;
    openTime?: string; closeTime?: string; slotIntervalMinutes?: number; capacity?: number; reason?: string;
  }): Promise<any> {
    await this.requireScheduleAdmin(userId, providerId);
    if (!isValidDate(data.overrideDate)) throw new ValidationError('overrideDate must be YYYY-MM-DD');
    if (data.overrideType === 'custom_hours') {
      if (!data.openTime || !data.closeTime)
        throw new ValidationError('Custom hours need both an opening and a closing time');
      this.validateWindow(data.openTime, data.closeTime);
    }
    const locationId = data.locationId || null;
    const existing = await database.query(
      `SELECT id FROM grooming_date_overrides
       WHERE provider_id = $1 AND override_date = $2 AND location_id IS NOT DISTINCT FROM $3`,
      [providerId, data.overrideDate, locationId]);

    const vals = [data.overrideType, data.openTime || null, data.closeTime || null,
      data.slotIntervalMinutes ?? null, data.capacity ?? null, data.reason || null];

    if (existing.rows.length > 0) {
      const r = await database.query(
        `UPDATE grooming_date_overrides SET override_type = $2, open_time = $3, close_time = $4,
                slot_interval_minutes = $5, capacity = $6, reason = $7, updated_at = NOW()
         WHERE id = $1
         RETURNING id, override_date as "overrideDate", override_type as "overrideType",
                   open_time as "openTime", close_time as "closeTime", capacity, reason`,
        [existing.rows[0].id, ...vals]);
      return r.rows[0];
    }
    const r = await database.query(
      `INSERT INTO grooming_date_overrides
         (provider_id, location_id, override_date, override_type, open_time, close_time,
          slot_interval_minutes, capacity, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, override_date as "overrideDate", override_type as "overrideType",
                 open_time as "openTime", close_time as "closeTime", capacity, reason`,
      [providerId, locationId, data.overrideDate, ...vals, userId]);
    return r.rows[0];
  }

  async deleteOverride(userId: string, providerId: string, id: string): Promise<void> {
    await this.requireScheduleAdmin(userId, providerId);
    const r = await database.query(
      `DELETE FROM grooming_date_overrides WHERE id = $1 AND provider_id = $2`, [id, providerId]);
    if (r.rowCount === 0) throw new NotFoundError('GroomingDateOverride', id);
  }

  // ── Blocked ranges (breaks) ────────────────────────────────────
  async listBlockedSlots(userId: string, providerId: string): Promise<any[]> {
    await GroomingProviderService.resolveProviderAccess(userId, providerId);
    const r = await database.query(
      `SELECT id, provider_id as "providerId", location_id as "locationId", block_date as "blockDate",
              start_time as "startTime", end_time as "endTime", is_recurring as "isRecurring",
              recurring_day as "recurringDay", reason
       FROM grooming_blocked_slots WHERE provider_id = $1
       ORDER BY is_recurring DESC, recurring_day ASC, block_date ASC, start_time ASC`, [providerId]);
    return r.rows;
  }

  async createBlockedSlot(userId: string, providerId: string, data: {
    startTime: string; endTime: string; blockDate?: string; isRecurring?: boolean;
    recurringDay?: number; locationId?: string | null; reason?: string;
  }): Promise<any> {
    await this.requireScheduleAdmin(userId, providerId);
    this.validateWindow(data.startTime, data.endTime);
    const recurring = data.isRecurring === true;
    // Mirrors grooming_blocked_slots_when_check so the caller gets a readable error rather than
    // a raw constraint violation.
    if (recurring && !(typeof data.recurringDay === 'number' && data.recurringDay >= 0 && data.recurringDay <= 6))
      throw new ValidationError('A recurring block needs recurringDay (0–6)');
    if (!recurring && !isValidDate(data.blockDate || ''))
      throw new ValidationError('A one-off block needs blockDate (YYYY-MM-DD)');

    const r = await database.query(
      `INSERT INTO grooming_blocked_slots
         (provider_id, location_id, block_date, start_time, end_time, is_recurring, recurring_day, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, block_date as "blockDate", start_time as "startTime", end_time as "endTime",
                 is_recurring as "isRecurring", recurring_day as "recurringDay", reason`,
      [providerId, data.locationId || null, recurring ? null : data.blockDate,
       data.startTime, data.endTime, recurring, recurring ? data.recurringDay : null,
       data.reason || null, userId]);
    return r.rows[0];
  }

  async deleteBlockedSlot(userId: string, providerId: string, id: string): Promise<void> {
    await this.requireScheduleAdmin(userId, providerId);
    const r = await database.query(
      `DELETE FROM grooming_blocked_slots WHERE id = $1 AND provider_id = $2`, [id, providerId]);
    if (r.rowCount === 0) throw new NotFoundError('GroomingBlockedSlot', id);
  }

  // ── Bookable slots (public: customers browse this before booking) ──
  /**
   * Slots for one provider/date, optionally sized to a specific service.
   *
   * Public by design — a customer must see availability before committing to a booking. It
   * exposes only times and remaining capacity, never customer or order details.
   */
  async getAvailability(providerId: string, date: string, opts: {
    serviceId?: string; locationId?: string | null;
  } = {}): Promise<GroomingAvailability> {
    if (!isValidDate(date)) throw new ValidationError('date must be YYYY-MM-DD');
    const locationId = opts.locationId || null;
    const base: GroomingAvailability = { providerId, locationId, date, slots: [], capacity: 0 };

    const prov = await database.query(
      `SELECT verification_status, is_paused FROM grooming_providers WHERE id = $1`, [providerId]);
    if (prov.rows.length === 0) throw new NotFoundError('GroomingProvider', providerId);
    if (prov.rows[0].verification_status !== 'verified')
      return { ...base, closedReason: 'This provider is not open for bookings yet.' };
    if (prov.rows[0].is_paused)
      return { ...base, closedReason: 'This provider is not accepting bookings at the moment.' };

    // How long the booking will actually occupy a station. Without a service we still need a
    // footprint to test against capacity, so fall back to the interval grid itself.
    let serviceDuration = 0;
    if (opts.serviceId) {
      const svc = await database.query(
        `SELECT duration_minutes, is_active, is_paused FROM grooming_services
         WHERE id = $1 AND provider_id = $2`, [opts.serviceId, providerId]);
      if (svc.rows.length === 0) throw new NotFoundError('GroomingService', opts.serviceId);
      if (!svc.rows[0].is_active || svc.rows[0].is_paused)
        return { ...base, closedReason: 'This service is not available.' };
      serviceDuration = Number(svc.rows[0].duration_minutes) || 60;
    }

    const dow = dayOfWeek(date);

    // A date override replaces the weekly pattern entirely for that day.
    const ovr = await database.query(
      `SELECT override_type as "overrideType", open_time as "openTime", close_time as "closeTime",
              slot_interval_minutes as "slotIntervalMinutes", capacity, reason
       FROM grooming_date_overrides
       WHERE provider_id = $1 AND override_date = $2 AND location_id IS NOT DISTINCT FROM $3`,
      [providerId, date, locationId]);
    const override = ovr.rows[0];
    if (override?.overrideType === 'closed')
      return { ...base, closedReason: override.reason || 'Closed on this date.' };

    let openTime: string, closeTime: string, interval: number, capacity: number;
    if (override?.overrideType === 'custom_hours') {
      openTime = override.openTime; closeTime = override.closeTime;
      interval = Number(override.slotIntervalMinutes) || 30;
      capacity = Number(override.capacity) || 1;
    } else {
      const sched = await database.query(
        `SELECT open_time as "openTime", close_time as "closeTime",
                slot_interval_minutes as "slotIntervalMinutes", capacity
         FROM grooming_schedules
         WHERE provider_id = $1 AND day_of_week = $2 AND is_active = true
           AND location_id IS NOT DISTINCT FROM $3`,
        [providerId, dow, locationId]);
      if (sched.rows.length === 0)
        return { ...base, closedReason: 'Closed on this day of the week.' };
      openTime = sched.rows[0].openTime; closeTime = sched.rows[0].closeTime;
      interval = Number(sched.rows[0].slotIntervalMinutes) || 30;
      capacity = Number(sched.rows[0].capacity) || 1;
    }

    const openM = parseTime(openTime), closeM = parseTime(closeTime);
    const footprint = serviceDuration > 0 ? serviceDuration : interval;

    const blocked = await database.query(
      `SELECT start_time as "startTime", end_time as "endTime"
       FROM grooming_blocked_slots
       WHERE provider_id = $1 AND location_id IS NOT DISTINCT FROM $2
         AND ((is_recurring = false AND block_date = $3) OR (is_recurring = true AND recurring_day = $4))`,
      [providerId, locationId, date, dow]);
    const blockedRanges = blocked.rows.map((b: any) => ({ s: parseTime(b.startTime), e: parseTime(b.endTime) }));

    // Existing occupancy. Each order occupies [start, start + its own duration).
    const orders = await database.query(
      `SELECT time_slot_start as "startTime", COALESCE(duration_minutes, 60) AS "durationMinutes"
       FROM grooming_orders
       WHERE provider_id = $1 AND scheduled_date = $2
         AND status IN ${OCCUPYING_STATUSES}
         AND ($3::uuid IS NULL OR location_id IS NOT DISTINCT FROM $3::uuid)`,
      [providerId, date, locationId]);
    const busy = orders.rows.map((o: any) => {
      const s = parseTime(o.startTime);
      return { s, e: s + (Number(o.durationMinutes) || 60) };
    });

    // Past slots on today's date must not be offered.
    const now = new Date();
    const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots: GroomingSlot[] = [];
    for (let start = openM; start + footprint <= closeM; start += interval) {
      const end = start + footprint;
      const overlaps = (r: { s: number; e: number }) => start < r.e && end > r.s;

      if (blockedRanges.some(overlaps)) continue;      // a break is not a slot at all
      if (isToday && start <= nowMinutes) continue;    // already gone

      const concurrent = busy.filter(overlaps).length;
      const remaining = Math.max(capacity - concurrent, 0);
      slots.push({
        startTime: formatTime(start),
        endTime: formatTime(end),
        isAvailable: remaining > 0,
        remainingCapacity: remaining,
      });
    }

    return { providerId, locationId, date, slots, capacity };
  }

  /**
   * Which days in a month have any capacity — powers the booking calendar so a customer is not
   * made to click through empty dates one at a time.
   */
  async getMonthAvailability(providerId: string, year: number, month: number, opts: {
    serviceId?: string; locationId?: string | null;
  } = {}): Promise<Array<{ date: string; hasAvailability: boolean; closedReason?: string }>> {
    if (!(month >= 1 && month <= 12)) throw new ValidationError('month must be 1–12');
    if (!(year >= 2000 && year <= 2100)) throw new ValidationError('year is out of range');
    const days = new Date(year, month, 0).getDate();
    const out: Array<{ date: string; hasAvailability: boolean; closedReason?: string }> = [];
    for (let d = 1; d <= days; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      try {
        const a = await this.getAvailability(providerId, date, opts);
        out.push({
          date,
          hasAvailability: a.slots.some(s => s.isAvailable),
          ...(a.closedReason ? { closedReason: a.closedReason } : {}),
        });
      } catch (err: any) {
        // One unparseable day must not blank the whole calendar.
        logger.warn('Grooming month availability failed for one date', { providerId, date, error: err.message });
        out.push({ date, hasAvailability: false });
      }
    }
    return out;
  }

  /**
   * Authoritative booking-time check. getAvailability() drives the UI, but the UI can be stale
   * or bypassed entirely, so createOrder() calls this and it is the thing that actually stops a
   * double-booking or a 3am booking on a closed Sunday.
   *
   * Returns the duration to store on the order, so the caller never has to re-derive it.
   */
  async assertSlotBookable(providerId: string, date: string, startTime: string, opts: {
    serviceId?: string; locationId?: string | null;
  } = {}): Promise<number> {
    const availability = await this.getAvailability(providerId, date, opts);
    if (availability.closedReason) throw new ValidationError(availability.closedReason);

    const normalized = formatTime(parseTime(startTime));
    const slot = availability.slots.find(s => s.startTime === normalized);
    if (!slot)
      throw new ValidationError(`${normalized} is not a bookable start time on ${date}.`);
    if (!slot.isAvailable)
      throw new ValidationError(`${normalized} on ${date} is fully booked. Please choose another time.`);

    return parseTime(slot.endTime) - parseTime(slot.startTime);
  }

  /**
   * Seed a sensible Mon–Sat 09:00–18:00 week so a newly verified provider is bookable straight
   * away. Without this a provider looks permanently closed until they find the schedule screen,
   * which is the single most likely way a real booking is lost.
   */
  async seedDefaultSchedule(providerId: string): Promise<number> {
    const existing = await database.query(
      `SELECT 1 FROM grooming_schedules WHERE provider_id = $1 LIMIT 1`, [providerId]);
    if (existing.rows.length > 0) return 0;
    let created = 0;
    for (let day = 1; day <= 6; day++) { // Monday–Saturday; Sunday left closed
      await database.query(
        `INSERT INTO grooming_schedules (provider_id, day_of_week, open_time, close_time, slot_interval_minutes, capacity)
         VALUES ($1,$2,'09:00','18:00',30,1)`, [providerId, day]);
      created++;
    }
    logger.info('Seeded default grooming schedule', { providerId, days: created });
    return created;
  }
}

export default new GroomingScheduleService();
