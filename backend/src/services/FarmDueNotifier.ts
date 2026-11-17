import database from '../utils/database';
import logger from '../utils/logger';
import FarmDueService, { DueItem } from './FarmDueService';
import NotificationService from './NotificationService';
import { isFarmRecordsEnabled } from './farmRecords/FarmRecordsConfig';

/**
 * Daily reminder to the people who run a farm: what is coming up in the next few days (expected births,
 * vaccinations due, a medicine's withdrawal ending) - the same recorded dates as the due list on the Daily
 * records screen, nothing guessed. One in-app note per person per farm per day, only when something is
 * urgent, and only to the owner, managers and supervisors (workers see the list on the screen).
 *
 * Off while the daily records module (farm.records.enabled) is off.
 */
export const URGENT_WITHIN_DAYS = 3;
const RECIPIENT_ROLES = ['owner', 'manager', 'supervisor'];

const WORD: Record<DueItem['kind'], (i: DueItem) => string> = {
  birth_expected: i => `${i.name}: birth expected`,
  vaccination_due: i => `${i.name}: ${i.detail || 'vaccination'} due`,
  withdrawal_ending: i => `${i.name}: ${i.detail || ''} withdrawal ends`.replace('  ', ' '),
};

function when(inDays: number): string {
  if (inDays < 0) return `${-inDays} day${inDays === -1 ? '' : 's'} overdue`;
  if (inDays === 0) return 'today';
  return inDays === 1 ? 'tomorrow' : `in ${inDays} days`;
}

export function summarise(items: DueItem[]): { title: string; message: string } {
  const lines = items.slice(0, 8).map(i => `${WORD[i.kind](i)} (${when(i.inDays)})`);
  const more = items.length > 8 ? ` and ${items.length - 8} more` : '';
  return {
    title: items.length === 1 ? 'Coming up on your farm' : `${items.length} things coming up on your farm`,
    message: `${lines.join('; ')}${more}. Open Daily records to see them.`,
  };
}

class FarmDueNotifier {
  /** Runs for every farm; returns how many notes were sent. */
  async run(): Promise<number> {
    if (!(await isFarmRecordsEnabled())) return 0;
    const farms = await database.query(`SELECT id, name FROM enterprises`, []);
    let sent = 0;
    for (const farm of farms.rows) {
      try { sent += await this.runForFarm(farm.id, farm.name); }
      catch (err: any) { logger.warn('Due reminder failed for a farm', { farmId: farm.id, error: err.message }); }
    }
    return sent;
  }

  async runForFarm(enterpriseId: string, farmName: string): Promise<number> {
    const urgent = (await FarmDueService.listForFarm(enterpriseId)).filter(i => i.inDays <= URGENT_WITHIN_DAYS);
    if (urgent.length === 0) return 0;

    const people = await database.query(
      `SELECT e.owner_id AS user_id FROM enterprises e WHERE e.id = $1
       UNION
       SELECT em.user_id FROM enterprise_members em
        WHERE em.enterprise_id = $1 AND em.is_active = true AND em.role = ANY($2::text[])`,
      [enterpriseId, RECIPIENT_ROLES]
    );
    const { title, message } = summarise(urgent);
    const key = `farm-due:${enterpriseId}:${new Date().toISOString().slice(0, 10)}`;
    let sent = 0;
    for (const p of people.rows) {
      // Once per person per farm per day, however often the job runs.
      const already = await database.query(
        `SELECT 1 FROM notifications WHERE user_id = $1 AND metadata->>'dedupeKey' = $2 LIMIT 1`, [p.user_id, key]);
      if (already.rows.length) continue;
      await NotificationService.createNotification(p.user_id, 'system', `${title} - ${farmName}`, message, 'in_app',
        { type: 'farm_due', enterpriseId, dedupeKey: key });
      sent++;
    }
    return sent;
  }
}

export default new FarmDueNotifier();
