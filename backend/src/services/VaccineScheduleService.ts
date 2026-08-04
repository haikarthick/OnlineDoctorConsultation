import database from '../utils/database';
import logger from '../utils/logger';
import VaccineProtocolService, { VaccineProtocol } from './VaccineProtocolService';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string;
  animalId: string;
  animalName?: string;
  animalUniqueId?: string;
  protocolId: string;
  protocolName?: string;
  disease?: string;
  vaccineCategory?: string;
  assignmentId: string | null;
  doseNumber: number;
  dueDate: string;
  administeredAt: string | null;
  vaccinationRecordId: string | null;
  status: 'pending' | 'administered' | 'overdue' | 'skipped' | 'waived';
  reminderSent: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PassportAnimal {
  animalId: string;
  animalName: string;
  animalUniqueId: string;
  species: string;
  breed: string;
  ownerName: string;
  overallCompliancePercent: number;
  protocols: PassportProtocolStatus[];
}

export interface PassportDose {
  scheduleId: string;
  doseNumber: number;
  dueDate: string;
  administeredAt: string | null;
  status: 'pending' | 'administered' | 'overdue' | 'skipped' | 'waived';
  reminderSent: boolean;
  vaccinationRecordId: string | null;
}

export interface PassportProtocolStatus {
  protocolId: string;
  protocolName: string;
  disease: string;
  vaccineCategory: string;
  category: string;
  isZoonotic: boolean;
  waived: boolean;
  waiverReason: string | null;
  assignedAt: string;
  status: 'current' | 'due_soon' | 'overdue' | 'not_started' | 'waived';
  nextDueDate: string | null;
  lastAdministeredDate: string | null;
  lastAdministeredAt: string | null;
  lastVaccineName: string | null;
  overdueCount: number;
  compliancePercent: number;
  doses: PassportDose[];
  upcomingSchedule: ScheduleRow[];
  history: any[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

class VaccineScheduleService {
  /**
   * Generate or refresh schedule rows for an animal + protocol.
   * Idempotent - skips existing pending/waived rows.
   */
  async generateScheduleForAnimal(
    animalId: string,
    protocolId: string,
    animalDobOrAge?: string | null  // ISO date string
  ): Promise<ScheduleRow[]> {
    const protocol = await VaccineProtocolService.getProtocol(protocolId);
    if (!protocol) throw new Error('Protocol not found');

    // Get the assignment row
    const assignRes = await database.query(
      `SELECT id FROM animal_vaccine_assignments
       WHERE animal_id = $1 AND protocol_id = $2`,
      [animalId, protocolId]
    );
    const assignmentId = assignRes.rows[0]?.id ?? null;

    // Check if any doses already exist
    const existingRes = await database.query(
      `SELECT dose_number, due_date, status
       FROM vaccine_schedule
       WHERE animal_id = $1 AND protocol_id = $2
       ORDER BY dose_number`,
      [animalId, protocolId]
    );
    const existingDoses = existingRes.rows;

    const newRows: ScheduleRow[] = [];
    const today = new Date();

    // Calculate base date for first dose
    let baseDate = today;
    if (animalDobOrAge) {
      const dob = new Date(animalDobOrAge);
      if (!isNaN(dob.getTime())) {
        const firstDoseWeeks = protocol.initialDoseAgeWeeks ?? 0;
        baseDate = new Date(dob.getTime() + firstDoseWeeks * 7 * 24 * 60 * 60 * 1000);
        if (baseDate < today) baseDate = today;
      }
    }

    // For series (multiple initial doses), generate series rows
    const totalDosesToGenerate = Math.max(protocol.seriesDoseCount ?? 1, 1);
    for (let dose = 1; dose <= totalDosesToGenerate; dose++) {
      const alreadyExists = existingDoses.find((r: any) => r.dose_number === dose);
      if (alreadyExists) continue;

      let dueDate: Date;
      if (dose === 1) {
        dueDate = baseDate;
      } else {
        // Series: subsequent doses spaced by seriesIntervalDays
        dueDate = new Date(
          baseDate.getTime() + (dose - 1) * (protocol.seriesIntervalDays ?? 21) * 24 * 60 * 60 * 1000
        );
      }

      const result = await database.query(
        `INSERT INTO vaccine_schedule
           (animal_id, protocol_id, assignment_id, dose_number, due_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [animalId, protocolId, assignmentId, dose, dueDate.toISOString().split('T')[0]]
      );
      if (result.rows[0]) newRows.push(this.mapScheduleRow(result.rows[0]));
    }

    return newRows;
  }

  /**
   * Mark a schedule row as administered and link to a vaccination_record.
   */
  async markDoseAdministered(
    scheduleId: string,
    vaccinationRecordId: string,
    administeredAt: string
  ): Promise<void> {
    await database.query(
      `UPDATE vaccine_schedule
       SET status = 'administered',
           vaccination_record_id = $2,
           administered_at = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [scheduleId, vaccinationRecordId, administeredAt]
    );

    // Update the vaccination_records row to link schedule
    await database.query(
      `UPDATE vaccination_records SET schedule_id = $2 WHERE id = $1`,
      [vaccinationRecordId, scheduleId]
    );

    // Auto-generate next booster dose row
    const schedRow = await database.query(
      `SELECT * FROM vaccine_schedule WHERE id = $1`, [scheduleId]
    );
    if (!schedRow.rows[0]) return;
    const sr = schedRow.rows[0];

    const protocol = await VaccineProtocolService.getProtocol(sr.protocol_id);
    if (!protocol || protocol.boosterIntervalDays <= 0) return;

    const nextDose = sr.dose_number + 1;
    const nextDue = new Date(
      new Date(administeredAt).getTime() + protocol.boosterIntervalDays * 24 * 60 * 60 * 1000
    );

    await database.query(
      `INSERT INTO vaccine_schedule
         (animal_id, protocol_id, assignment_id, dose_number, due_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        sr.animal_id, sr.protocol_id, sr.assignment_id,
        nextDose, nextDue.toISOString().split('T')[0],
      ]
    );
  }

  /**
   * Get full vaccination passport for an animal.
   */
  async getAnimalPassport(animalId: string): Promise<PassportAnimal | null> {
    const animalRes = await database.query(
      `SELECT a.id, a.name, a.unique_id, a.species, a.breed,
              u.first_name || ' ' || u.last_name AS owner_name
       FROM animals a
       JOIN users u ON u.id = a.owner_id
       WHERE a.id = $1`,
      [animalId]
    );
    if (!animalRes.rows[0]) return null;
    const animal = animalRes.rows[0];

    // Get all assignments for the animal
    const assignments = await VaccineProtocolService.getAnimalAssignments(animalId);

    const protocolStatuses: PassportProtocolStatus[] = [];

    for (const asgn of assignments) {
      if (asgn.waived) {
        protocolStatuses.push({
          protocolId: asgn.protocol_id,
          protocolName: asgn.protocol_name,
          disease: asgn.disease,
          vaccineCategory: asgn.vaccine_category,
          category: asgn.vaccine_category,
          isZoonotic: asgn.is_zoonotic,
          waived: true,
          waiverReason: asgn.waiver_reason ?? null,
          assignedAt: asgn.assigned_at,
          status: 'waived',
          nextDueDate: null,
          lastAdministeredDate: null,
          lastAdministeredAt: null,
          lastVaccineName: null,
          overdueCount: 0,
          compliancePercent: 100,
          doses: [],
          upcomingSchedule: [],
          history: [],
        });
        continue;
      }

      // Get schedule rows
      const schedRes = await database.query(
        `SELECT vs.*
         FROM vaccine_schedule vs
         WHERE vs.animal_id = $1 AND vs.protocol_id = $2
         ORDER BY vs.dose_number`,
        [animalId, asgn.protocol_id]
      );
      const schedRows: ScheduleRow[] = schedRes.rows.map((r: any) => this.mapScheduleRow(r));

      // Get vaccination history
      const histRes = await database.query(
        `SELECT vr.*, u.first_name || ' ' || u.last_name AS administered_by_name
         FROM vaccination_records vr
         LEFT JOIN users u ON u.id = vr.administered_by
         WHERE vr.animal_id = $1 AND vr.protocol_id = $2 AND vr.is_valid = true
         ORDER BY vr.date_administered DESC`,
        [animalId, asgn.protocol_id]
      );

      const lastAdministered = histRes.rows[0];
      const pending = schedRows.filter(r => r.status === 'pending' || r.status === 'overdue');
      const upcoming = pending.filter(r => {
        const due = new Date(r.dueDate);
        return due >= new Date();
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      let status: PassportProtocolStatus['status'] = 'not_started';
      if (pending.some(r => new Date(r.dueDate) < today)) {
        status = 'overdue';
      } else if (pending.some(r => new Date(r.dueDate) <= thirtyDaysOut)) {
        status = 'due_soon';
      } else if (lastAdministered) {
        status = 'current';
      }

      // Compute per-protocol stats the frontend needs
      const overdueCount = schedRows.filter(r => r.status === 'overdue').length;
      const administered = schedRows.filter(r => r.status === 'administered').length;
      const compliancePercent = schedRows.length === 0
        ? 100
        : Math.round((administered / schedRows.length) * 100);

      // Map schedule rows to the PassportDose shape the frontend expects
      const doses = schedRows.map(r => ({
        scheduleId: r.id,
        doseNumber: r.doseNumber,
        dueDate: r.dueDate,
        administeredAt: r.administeredAt,
        status: r.status,
        reminderSent: r.reminderSent,
        vaccinationRecordId: r.vaccinationRecordId,
      }));

      protocolStatuses.push({
        protocolId: asgn.protocol_id,
        protocolName: asgn.protocol_name,
        disease: asgn.disease,
        vaccineCategory: asgn.vaccine_category,
        // Frontend uses both 'category' and 'vaccineCategory'
        category: asgn.vaccine_category,
        isZoonotic: asgn.is_zoonotic,
        waived: false,
        waiverReason: null,
        assignedAt: asgn.assigned_at,
        status,
        nextDueDate: upcoming[0]?.dueDate ?? null,
        lastAdministeredDate: lastAdministered?.date_administered ?? null,
        // Frontend uses 'lastAdministeredAt'
        lastAdministeredAt: lastAdministered?.date_administered ?? null,
        lastVaccineName: lastAdministered?.vaccine_name ?? null,
        overdueCount,
        compliancePercent,
        doses,
        upcomingSchedule: upcoming,
        history: histRes.rows,
      });
    }

    // Compliance %: among non-waived, how many are 'current'
    const nonWaived = protocolStatuses.filter(p => p.status !== 'waived');
    const compliant = nonWaived.filter(p => p.status === 'current').length;
    const overallCompliancePercent = nonWaived.length === 0
      ? 100
      : Math.round((compliant / nonWaived.length) * 100);

    return {
      animalId: animal.id,
      animalName: animal.name,
      animalUniqueId: animal.unique_id,
      species: animal.species,
      breed: animal.breed,
      ownerName: animal.owner_name,
      overallCompliancePercent,
      protocols: protocolStatuses,
    };
  }

  /**
   * Get all schedule rows for an animal, with protocol info.
   */
  async getAnimalSchedule(animalId: string): Promise<ScheduleRow[]> {
    const result = await database.query(
      `SELECT vs.*,
         vp.name AS protocol_name, vp.disease, vp.vaccine_category
       FROM vaccine_schedule vs
       JOIN vaccine_protocols vp ON vp.id = vs.protocol_id
       WHERE vs.animal_id = $1
       ORDER BY vs.due_date, vs.dose_number`,
      [animalId]
    );
    return result.rows.map((r: any) => this.mapScheduleRow(r));
  }

  /**
   * Get multi-animal compliance summary (for farmers/vets).
   * Accepts array of animal_ids or enterprise_id.
   */
  async getComplianceSummary(filters: {
    enterpriseId?: string;
    ownerId?: string;
    species?: string;
  }): Promise<any[]> {
    let query = `
      SELECT
        a.id AS animal_id, a.name AS animal_name, a.unique_id, a.species, a.breed,
        u.first_name || ' ' || u.last_name AS owner_name,
        COUNT(ava.id) FILTER (WHERE NOT ava.waived) AS total_protocols,
        COUNT(vs_pending.id) FILTER (
          WHERE vs_pending.status = 'overdue'
        ) AS overdue_count,
        COUNT(vs_pending.id) FILTER (
          WHERE vs_pending.status = 'pending'
            AND vs_pending.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ) AS due_soon_count
      FROM animals a
      JOIN users u ON u.id = a.owner_id
      LEFT JOIN animal_vaccine_assignments ava ON ava.animal_id = a.id
      LEFT JOIN vaccine_schedule vs_pending ON vs_pending.animal_id = a.id
        AND vs_pending.protocol_id = ava.protocol_id
        AND vs_pending.status IN ('pending','overdue')
      WHERE a.is_active = true
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters.enterpriseId) {
      query += ` AND a.enterprise_id = $${idx++}`;
      params.push(filters.enterpriseId);
    }
    if (filters.ownerId) {
      query += ` AND a.owner_id = $${idx++}`;
      params.push(filters.ownerId);
    }
    if (filters.species) {
      query += ` AND a.species = $${idx++}`;
      params.push(filters.species);
    }

    query += ` GROUP BY a.id, a.name, a.unique_id, a.species, a.breed, u.first_name, u.last_name`;
    query += ` ORDER BY overdue_count DESC, a.name`;

    const result = await database.query(query, params);
    return result.rows;
  }

  /**
   * Daily reminder job:
   * - Mark overdue any pending rows past due date
   * - Create notifications for dues within 7 days
   */
  async runDailyReminderJob(): Promise<void> {
    logger.info('[VaccineSchedule] Running daily reminder job...');

    // 1. Mark overdue
    await database.query(
      `UPDATE vaccine_schedule
       SET status = 'overdue', updated_at = NOW()
       WHERE status = 'pending' AND due_date < CURRENT_DATE`
    );

    // 2. Fetch pending/overdue within 7 days for notifications
    const dueRows = await database.query(
      `SELECT vs.id AS schedule_id, vs.animal_id, vs.protocol_id, vs.due_date, vs.status,
              vs.dose_number, vs.reminder_sent,
              a.name AS animal_name, a.owner_id,
              vp.name AS protocol_name, vp.disease
       FROM vaccine_schedule vs
       JOIN animals a ON a.id = vs.animal_id
       JOIN vaccine_protocols vp ON vp.id = vs.protocol_id
       WHERE vs.status IN ('pending','overdue')
         AND vs.due_date <= CURRENT_DATE + 7
         AND (vs.reminder_sent = false OR vs.status = 'overdue')
       ORDER BY vs.due_date`
    );

    for (const row of dueRows.rows) {
      try {
        const isOverdue = row.status === 'overdue';
        const notifType = isOverdue ? 'vaccination_overdue' : 'vaccination_due';
        const title = isOverdue
          ? `Vaccination Overdue: ${row.animal_name}`
          : `Vaccination Due: ${row.animal_name}`;
        const message = isOverdue
          ? `${row.protocol_name} (${row.disease}) for ${row.animal_name} is overdue. Please vaccinate as soon as possible.`
          : `${row.protocol_name} (${row.disease}) for ${row.animal_name} is due on ${row.due_date}.`;

        // Check if a notification already exists for this schedule within 3 days
        const existing = await database.query(
          `SELECT id FROM notifications
           WHERE user_id = $1 AND type = $2
             AND metadata->>'scheduleId' = $3
             AND created_at > NOW() - INTERVAL '3 days'`,
          [row.owner_id, notifType, row.schedule_id]
        );
        if (existing.rows.length > 0) continue;

        await database.query(
          `INSERT INTO notifications (user_id, type, title, message, channel, metadata)
           VALUES ($1, $2, $3, $4, 'in_app', $5::jsonb)`,
          [
            row.owner_id, notifType, title, message,
            JSON.stringify({
              scheduleId: row.schedule_id,
              animalId: row.animal_id,
              protocolId: row.protocol_id,
              dueDate: row.due_date,
            }),
          ]
        );

        // Mark reminder_sent
        await database.query(
          `UPDATE vaccine_schedule
           SET reminder_sent = true, reminder_sent_at = NOW()
           WHERE id = $1`,
          [row.schedule_id]
        );
      } catch (err: any) {
        logger.warn('[VaccineSchedule] Failed to send reminder for schedule', {
          scheduleId: row.schedule_id,
          error: err.message,
        });
      }
    }

    logger.info(`[VaccineSchedule] Reminder job complete. Processed ${dueRows.rows.length} rows.`);
  }

  // ── Mapper ───────────────────────────────────────────────────

  private mapScheduleRow(row: any): ScheduleRow {
    return {
      id: row.id,
      animalId: row.animal_id,
      animalName: row.animal_name,
      animalUniqueId: row.animal_unique_id,
      protocolId: row.protocol_id,
      protocolName: row.protocol_name,
      disease: row.disease,
      vaccineCategory: row.vaccine_category,
      assignmentId: row.assignment_id,
      doseNumber: row.dose_number,
      dueDate: row.due_date,
      administeredAt: row.administered_at,
      vaccinationRecordId: row.vaccination_record_id,
      status: row.status,
      reminderSent: row.reminder_sent,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new VaccineScheduleService();
