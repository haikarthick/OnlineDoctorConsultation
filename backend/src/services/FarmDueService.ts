import database from '../utils/database';
import FarmRecordService from './FarmRecordService';

/**
 * What is coming up on a farm - the "due list" on the Daily records screen.
 *
 * Only dates the farm has actually recorded are used: an expected birth date (calculated when the
 * mating was recorded, from the species' gestation days in master data), a vaccination's next-due
 * date, and a medicine's withdrawal end. Nothing is guessed from a species name (no "check
 * pregnancy at day 45"): a rule like that needs a sourced value in master data first.
 *
 * Read access only - every member of the farm may see it.
 */
const BIRTH_WINDOW_DAYS = 14;
const VACCINATION_WINDOW_DAYS = 14;
const WITHDRAWAL_WINDOW_DAYS = 7;

export type DueKind = 'birth_expected' | 'vaccination_due' | 'withdrawal_ending';

export interface DueItem {
  kind: DueKind;
  /** The date it falls on (YYYY-MM-DD). */
  date: string;
  /** Whole days from today: negative = overdue. */
  inDays: number;
  animalId: string | null;
  groupId: string | null;
  name: string;
  /** Vaccine name, or "milk" / "meat" for a withdrawal. */
  detail: string | null;
}

class FarmDueService {

  async list(enterpriseId: string, caller: { userId: string; role?: string }): Promise<DueItem[]> {
    await FarmRecordService.assertFarmAccess(enterpriseId, caller);
    return this.listForFarm(enterpriseId);
  }

  /** The due items of a farm with no caller check - for the daily reminder job, which has no caller. */
  async listForFarm(enterpriseId: string): Promise<DueItem[]> {

    const births = await database.query(
      `SELECT a.id, a.name, a.expected_due_date::text AS due, (a.expected_due_date - CURRENT_DATE) AS in_days
         FROM animals a
        WHERE a.enterprise_id = $1 AND a.status = 'active' AND a.breeding_status = 'pregnant'
          AND a.expected_due_date IS NOT NULL AND a.expected_due_date <= CURRENT_DATE + $2::int
        ORDER BY a.expected_due_date`,
      [enterpriseId, BIRTH_WINDOW_DAYS]
    );

    // The latest dose of each vaccine per animal: an older dose's next-due date is superseded.
    const vaccinations = await database.query(
      `SELECT a.id, a.name, v.vaccine_name, v.next_due_date::text AS due, (v.next_due_date - CURRENT_DATE) AS in_days
         FROM animals a
         JOIN LATERAL (
           SELECT DISTINCT ON (vaccine_name) vaccine_name, next_due_date
             FROM vaccination_records WHERE animal_id = a.id
            ORDER BY vaccine_name, date_administered DESC, created_at DESC
         ) v ON true
        WHERE a.enterprise_id = $1 AND a.status = 'active'
          AND v.next_due_date IS NOT NULL AND v.next_due_date <= CURRENT_DATE + $2::int
        ORDER BY v.next_due_date`,
      [enterpriseId, VACCINATION_WINDOW_DAYS]
    );

    const withdrawals = await database.query(
      `SELECT m.animal_id, m.group_id, COALESCE(a.name, g.name) AS name,
              CASE WHEN m.withdrawal_until_milk >= CURRENT_DATE AND m.withdrawal_until_milk <= CURRENT_DATE + $2::int THEN 'milk' ELSE 'meat' END AS what,
              CASE WHEN m.withdrawal_until_milk >= CURRENT_DATE AND m.withdrawal_until_milk <= CURRENT_DATE + $2::int
                   THEN m.withdrawal_until_milk::text ELSE m.withdrawal_until_meat::text END AS due,
              CASE WHEN m.withdrawal_until_milk >= CURRENT_DATE AND m.withdrawal_until_milk <= CURRENT_DATE + $2::int
                   THEN (m.withdrawal_until_milk - CURRENT_DATE) ELSE (m.withdrawal_until_meat - CURRENT_DATE) END AS in_days
         FROM medical_records m
         LEFT JOIN animals a ON a.id = m.animal_id
         LEFT JOIN animal_groups g ON g.id = m.group_id
        WHERE COALESCE(a.enterprise_id, g.enterprise_id) = $1
          AND ((m.withdrawal_until_milk >= CURRENT_DATE AND m.withdrawal_until_milk <= CURRENT_DATE + $2::int)
            OR (m.withdrawal_until_meat >= CURRENT_DATE AND m.withdrawal_until_meat <= CURRENT_DATE + $2::int))
        ORDER BY 5`,
      [enterpriseId, WITHDRAWAL_WINDOW_DAYS]
    );

    const items: DueItem[] = [
      ...births.rows.map((r: any): DueItem => ({ kind: 'birth_expected', date: r.due, inDays: Number(r.in_days), animalId: r.id, groupId: null, name: r.name, detail: null })),
      ...vaccinations.rows.map((r: any): DueItem => ({ kind: 'vaccination_due', date: r.due, inDays: Number(r.in_days), animalId: r.id, groupId: null, name: r.name, detail: r.vaccine_name })),
      ...withdrawals.rows.map((r: any): DueItem => ({ kind: 'withdrawal_ending', date: r.due, inDays: Number(r.in_days), animalId: r.animal_id, groupId: r.group_id, name: r.name, detail: r.what })),
    ];
    // Overdue first, then soonest.
    return items.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
  }
}

export default new FarmDueService();
