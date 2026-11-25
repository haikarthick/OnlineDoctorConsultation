import database from '../../utils/database';
import logger from '../../utils/logger';
import NotificationService from '../NotificationService';

/**
 * Nutrition alerts and waiting plans reach people (NUT-173/174). One note per person per alert or plan, kept in the
 * ordinary notifications list - no second inbox. Who is told follows the same access the nutrition panel uses:
 * the owner, the farm's owner / managers / supervisors, and the vets connected by a booked or recent consultation.
 * Never blocks the action that raised the alert.
 */
const FARM_ROLES = ['owner', 'manager', 'supervisor'];

const FLAG_WORDS: Record<string, string> = {
  bcs_high: 'is carrying too much weight',
  bcs_low: 'is too thin',
  muscle_loss: 'is losing muscle',
  rapid_weight_loss: 'is losing weight fast',
  weight_drift: 'has changed weight',
  no_recent_weight: 'has not been weighed lately',
  treats_over_limit: 'is getting too many treats',
  unsafe_food_logged: 'was given a food that is not safe for it',
  transition_condition_loss: 'lost body condition after giving birth',
  feed_below_need: 'is being fed less than the table amount',
  feed_above_need: 'is being fed more than the table amount',
};

/** The code each alert type is told with (the app says it in the person's language; `what` is the English fallback). */
const FLAG_CODES: Record<string, string> = {
  bcs_high: 'NOTIF_NUT_FLAG_BCS_HIGH', bcs_low: 'NOTIF_NUT_FLAG_BCS_LOW', muscle_loss: 'NOTIF_NUT_FLAG_MUSCLE_LOSS',
  rapid_weight_loss: 'NOTIF_NUT_FLAG_RAPID_WEIGHT_LOSS', weight_drift: 'NOTIF_NUT_FLAG_WEIGHT_DRIFT', no_recent_weight: 'NOTIF_NUT_FLAG_NO_RECENT_WEIGHT',
  treats_over_limit: 'NOTIF_NUT_FLAG_TREATS_OVER_LIMIT', unsafe_food_logged: 'NOTIF_NUT_FLAG_UNSAFE_FOOD', transition_condition_loss: 'NOTIF_NUT_FLAG_TRANSITION_LOSS',
  feed_below_need: 'NOTIF_NUT_FLAG_FEED_BELOW', feed_above_need: 'NOTIF_NUT_FLAG_FEED_ABOVE',
};

export interface Subject { animalId?: string | null; groupId?: string | null }

class NutritionNotifier {
  private async subjectInfo(s: Subject): Promise<{ name: string; ownerId: string | null; enterpriseId: string | null } | null> {
    const r = s.animalId
      ? await database.query(`SELECT name, owner_id, enterprise_id FROM animals WHERE id = $1`, [s.animalId])
      : await database.query(`SELECT g.name, e.owner_id, g.enterprise_id FROM animal_groups g LEFT JOIN enterprises e ON e.id = g.enterprise_id WHERE g.id = $1`, [s.groupId]);
    const x = r.rows[0];
    return x ? { name: String(x.name), ownerId: x.owner_id || null, enterpriseId: x.enterprise_id || null } : null;
  }

  private async vets(s: Subject): Promise<string[]> {
    const col = s.animalId ? 'animal_id' : 'group_id';
    const id = s.animalId || s.groupId;
    const r = await database.query(
      `SELECT veterinarian_id AS id FROM consultations
        WHERE ${col} = $1 AND veterinarian_id IS NOT NULL
          AND (status IN ('confirmed', 'scheduled', 'in_progress') OR (status = 'completed' AND completed_at >= NOW() - INTERVAL '30 days'))
       ${s.animalId ? `UNION SELECT veterinarian_id FROM bookings WHERE animal_id = $1 AND veterinarian_id IS NOT NULL
          AND (status IN ('confirmed', 'rescheduled') OR (status = 'completed' AND updated_at >= NOW() - INTERVAL '30 days'))` : ''}`,
      [id]
    );
    return r.rows.map((x: any) => x.id);
  }

  private async farmPeople(enterpriseId: string | null): Promise<string[]> {
    if (!enterpriseId) return [];
    const r = await database.query(
      `SELECT owner_id AS id FROM enterprises WHERE id = $1
       UNION SELECT user_id FROM enterprise_members WHERE enterprise_id = $1 AND is_active = true AND role = ANY($2::text[])`,
      [enterpriseId, FARM_ROLES]
    );
    return r.rows.map((x: any) => x.id).filter(Boolean);
  }

  private async send(userIds: string[], dedupeKey: string, title: string, message: string, meta: Record<string, unknown>): Promise<number> {
    let sent = 0;
    for (const userId of [...new Set(userIds)]) {
      const seen = await database.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND metadata->>'dedupeKey' = $2 LIMIT 1`, [userId, dedupeKey]);
      if (seen.rows.length) continue;
      await NotificationService.createNotification(userId, 'system', title, message, 'in_app', { ...meta, dedupeKey });
      sent++;
    }
    return sent;
  }

  /** A new alert that needs action or watching: the owner / farm team and the connected vets are told once. */
  async flagRaised(subject: Subject, flag: { id: string; type: string; severity: string }): Promise<void> {
    try {
      if (flag.severity !== 'act' && flag.severity !== 'watch') return;
      const info = await this.subjectInfo(subject);
      if (!info) return;
      const people = [...(info.ownerId ? [info.ownerId] : []), ...(await this.farmPeople(info.enterpriseId)), ...(await this.vets(subject))];
      const what = FLAG_WORDS[flag.type] || 'needs a look';
      await this.send(people, `nutrition-flag:${flag.id}`,
        flag.severity === 'act' ? `Feeding alert: ${info.name}` : `Feeding watch: ${info.name}`,
        `${info.name} ${what}. Open Nutrition to see what to do.`,
        { type: 'nutrition_flag', animalId: subject.animalId || null, groupId: subject.groupId || null, flagType: flag.type,
          i18n: { title: { code: flag.severity === 'act' ? 'NOTIF_NUT_FLAG_ACT_TITLE' : 'NOTIF_NUT_FLAG_WATCH_TITLE', params: { name: info.name } },
                  body: { code: FLAG_CODES[flag.type] || 'NOTIF_NUT_FLAG_OTHER', params: { name: info.name } } } });
    } catch (err: any) { logger.warn('Nutrition alert notification failed', { error: err.message }); }
  }

  /** A plan that needs a vet before it is followed: the connected vets are told once. */
  async planWaitingForVet(subject: Subject, planId: string): Promise<void> {
    try {
      const info = await this.subjectInfo(subject);
      if (!info) return;
      await this.send(await this.vets(subject), `nutrition-plan:${planId}`,
        `Feeding plan to check: ${info.name}`,
        `A new feeding plan for ${info.name} is waiting for a vet to check it. Open Nutrition and use Review.`,
        { type: 'nutrition_plan_review', animalId: subject.animalId || null, groupId: subject.groupId || null, planId,
          i18n: { title: { code: 'NOTIF_NUT_PLAN_TITLE', params: { name: info.name } }, body: { code: 'NOTIF_NUT_PLAN_BODY', params: { name: info.name } } } });
    } catch (err: any) { logger.warn('Nutrition plan notification failed', { error: err.message }); }
  }
}

export default new NutritionNotifier();
