import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError, WithdrawalConfirmError } from '../../utils/errors';
import {
  CourseLine, WithdrawalItem, WithdrawalSummary, addDays, daysBetween, itemFor, summarise, wholeDays,
} from './withdrawalMath';

/**
 * "Is this animal or herd under a milk / egg or meat withdrawal, until when?" - the ONE answer every screen reads
 * (ration, due list, animal and herd banners, milk / sale warnings). Computed from the vet's prescription lines and the
 * farmer's own treatments; nothing is copied into a second place. The platform supplies no drug figure: the label's days are
 * typed by the vet on the prescription (or by the farmer on their own treatment). See withdrawalMath.ts for the sums.
 */
export type Subject = { animalId?: string | null; groupId?: string | null };

const todayIso = () => new Date().toISOString().slice(0, 10);
const DAYS = (col: string) => `CASE WHEN (${col}) ~ '^[0-9]+$' THEN (${col})::int ELSE 0 END`;

/**
 * Prescription lines and the farmer's own treatments, as raw rows (dates are added in TypeScript, withdrawalMath.ts).
 * $1 is always the filter value; `where` says what it is matched against.
 */
function linesSql(where: { rx: string; self: string }): string {
  return `
    SELECT 'prescription'::text AS source, p.id AS source_id, p.animal_id, p.group_id,
           COALESCE(m->>'name', '') AS medicine, COALESCE(m->>'kind', 'medicine') AS kind,
           COALESCE(p.course_start_on, p.created_at::date)::text AS started_on,
           GREATEST(${DAYS("m->>'treatmentDays'")}, 1) AS treatment_days,
           p.last_dose_on::text AS last_dose_on,
           ${DAYS("m->>'withdrawalMilkDays'")} AS milk_days, ${DAYS("m->>'withdrawalMeatDays'")} AS meat_days,
           p.veterinarian_id AS by_user, p.created_at
      FROM prescriptions p
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.medications) = 'array' THEN p.medications ELSE '[]'::jsonb END) m
     WHERE p.is_active = true AND ${where.rx}
    UNION ALL
    SELECT 'self'::text, s.id, s.animal_id, s.group_id, s.medicine_name, 'medicine',
           s.started_on::text, s.treatment_days, s.last_dose_on::text, s.withdrawal_milk_days, s.withdrawal_meat_days,
           s.entered_by, s.created_at
      FROM self_treatments s
     WHERE s.is_active = true AND ${where.self}`;
}

const toLine = (r: any): CourseLine => ({
  source: r.source, sourceId: r.source_id, medicine: String(r.medicine || ''), kind: r.kind,
  startedOn: String(r.started_on).slice(0, 10), treatmentDays: Number(r.treatment_days) || 1,
  lastDoseOn: r.last_dose_on ? String(r.last_dose_on).slice(0, 10) : null,
  milkDays: Number(r.milk_days) || 0, meatDays: Number(r.meat_days) || 0,
});

class WithdrawalService {
  /** What holds back milk / eggs or meat for this subject right now. An animal also carries its herd's treatments. */
  async status(subject: Subject): Promise<WithdrawalSummary> {
    const id = subject.groupId || subject.animalId;
    if (!id) throw new ValidationError('Choose an animal or a group.');
    const where = subject.groupId
      ? { rx: 'p.group_id = $1', self: 's.group_id = $1' }
      : {
          rx: `(p.animal_id = $1 OR p.group_id IN (SELECT group_id FROM animal_group_memberships WHERE animal_id = $1 AND left_at IS NULL))`,
          self: `(s.animal_id = $1 OR s.group_id IN (SELECT group_id FROM animal_group_memberships WHERE animal_id = $1 AND left_at IS NULL))`,
        };
    const r = await database.query(linesSql(where), [id]);
    return summarise(r.rows.map((x: any) => itemFor(toLine(x))), todayIso());
  }

  /**
   * Everything on a farm that is under a withdrawal today or ends within `endingWithinDays` (used by the due list, the
   * reminders and the "under withdrawal" card). One row per animal or herd and kind.
   */
  async listForFarm(enterpriseId: string, opts: { endingWithinDays?: number } = {}): Promise<Array<{
    animalId: string | null; groupId: string | null; name: string; what: 'milk' | 'meat'; until: string; inDays: number; medicine: string; source: string; sourceId: string;
  }>> {
    const r = await database.query(linesSql({
      rx: `(p.animal_id IN (SELECT id FROM animals WHERE enterprise_id = $1) OR p.group_id IN (SELECT id FROM animal_groups WHERE enterprise_id = $1))`,
      self: `s.enterprise_id = $1`,
    }), [enterpriseId]);
    const names = await database.query(
      `SELECT id, name, 'animal' AS kind FROM animals WHERE enterprise_id = $1 UNION ALL SELECT id, name, 'group' FROM animal_groups WHERE enterprise_id = $1`, [enterpriseId]);
    const nameOf = new Map<string, string>(names.rows.map((n: any) => [n.id, n.name]));
    const today = todayIso();
    const limit = opts.endingWithinDays ?? 365;
    const out: Array<any> = [];
    for (const row of r.rows) {
      const item = itemFor(toLine(row));
      for (const [what, until] of [['milk', item.milkUntil], ['meat', item.meatUntil]] as const) {
        if (!until || until < today) continue;
        const inDays = daysBetween(today, until);
        if (inDays > limit) continue;
        out.push({ animalId: row.animal_id, groupId: row.group_id, name: nameOf.get(row.animal_id || row.group_id) || '', what, until, inDays, medicine: item.medicine, source: item.source, sourceId: item.sourceId });
      }
    }
    return out.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
  }

  /** The farm's treatment history ("my medicines"): the vet's prescription lines and the farmer's own, newest first. */
  async history(enterpriseId: string, limit = 60): Promise<Array<WithdrawalItem & { animalId: string | null; groupId: string | null; name: string; treatmentDays: number; boughtOn: string | null }>> {
    const r = await database.query(`SELECT * FROM (${linesSql({
      rx: `(p.animal_id IN (SELECT id FROM animals WHERE enterprise_id = $1) OR p.group_id IN (SELECT id FROM animal_groups WHERE enterprise_id = $1))`,
      self: `s.enterprise_id = $1`,
    })}) t ORDER BY created_at DESC LIMIT ${Math.min(Math.max(Number(limit) || 60, 1), 200)}`, [enterpriseId]);
    const names = await database.query(
      `SELECT id, name FROM animals WHERE enterprise_id = $1 UNION ALL SELECT id, name FROM animal_groups WHERE enterprise_id = $1`, [enterpriseId]);
    const nameOf = new Map<string, string>(names.rows.map((n: any) => [n.id, n.name]));
    // When the pharmacy handed the medicine over: information only, it never restarts or shortens the withdrawal.
    const rxIds = [...new Set<string>(r.rows.filter((x: any) => x.source === 'prescription').map((x: any) => x.source_id))];
    const bought = rxIds.length
      ? await database.query(
          `SELECT prescription_id, MAX(COALESCE(handed_over_at, prepared_at, created_at))::date::text AS on_day
             FROM dispensing_records WHERE prescription_id = ANY($1::uuid[]) AND dispensing_status IN ('handed_over', 'delivered') GROUP BY prescription_id`, [rxIds])
      : { rows: [] as any[] };
    const boughtOn = new Map<string, string>(bought.rows.map((b: any) => [b.prescription_id, b.on_day]));
    return r.rows
      .filter((x: any) => x.kind !== 'diet' && x.kind !== 'supplement')
      .map((x: any) => ({ ...itemFor(toLine(x)), animalId: x.animal_id, groupId: x.group_id, name: nameOf.get(x.animal_id || x.group_id) || '', treatmentDays: Number(x.treatment_days) || 1, boughtOn: x.source === 'prescription' ? (boughtOn.get(x.source_id) || null) : null }));
  }

  /** Medicated-feed courses still running for this subject (shown on the Daily records feed entry). */
  async activeFeedCourses(subject: Subject): Promise<Array<{ medicine: string; startedOn: string; lastDose: string; daysLeft: number; dosage: string | null }>> {
    const id = subject.groupId || subject.animalId;
    if (!id) return [];
    const col = subject.groupId ? 'p.group_id' : 'p.animal_id';
    const r = await database.query(
      `SELECT m->>'name' AS medicine, m->>'dosage' AS dosage, COALESCE(p.course_start_on, p.created_at::date)::text AS started_on, p.last_dose_on::text AS last_dose_on,
              GREATEST(${DAYS("m->>'treatmentDays'")}, 1) AS treatment_days
         FROM prescriptions p
         CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.medications) = 'array' THEN p.medications ELSE '[]'::jsonb END) m
        WHERE p.is_active = true AND ${col} = $1 AND m->>'kind' = 'medicated_feed'`, [id]);
    const today = todayIso();
    return r.rows.map((x: any) => {
      const lastDose = x.last_dose_on ? String(x.last_dose_on).slice(0, 10) : addDays(String(x.started_on), Number(x.treatment_days) - 1);
      return { medicine: x.medicine, dosage: x.dosage || null, startedOn: String(x.started_on), lastDose, daysLeft: daysBetween(today, lastDose) + 1 };
    }).filter((c: any) => c.daysLeft > 0);
  }

  /** The farmer's correction on a prescription's course: "stopped early" / "last dose on". null puts it back as prescribed. */
  async correctCourse(prescriptionId: string, lastDoseOn: string | null, userId: string): Promise<void> {
    if (lastDoseOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(lastDoseOn) || Number.isNaN(Date.parse(lastDoseOn)))) throw new ValidationError('That date is not valid.');
    const rx = await database.query(`SELECT COALESCE(course_start_on, created_at::date)::text AS started FROM prescriptions WHERE id = $1`, [prescriptionId]);
    if (!rx.rows[0]) throw new NotFoundError('Prescription');
    if (lastDoseOn !== null && lastDoseOn < rx.rows[0].started) throw new ValidationError('The last dose cannot be before the treatment started.');
    if (lastDoseOn !== null && lastDoseOn > addDays(todayIso(), 1)) throw new ValidationError('That last dose date is too far ahead. Choose today or an earlier day.');
    await database.query(`UPDATE prescriptions SET last_dose_on = $2, course_corrected_by = $3, updated_at = NOW() WHERE id = $1`, [prescriptionId, lastDoseOn, userId]);
  }

  /** The withdrawal of the animal or herd a prescription is for (returned after a correction, so the screen updates at once). */
  async statusForPrescription(prescriptionId: string): Promise<WithdrawalSummary> {
    const r = await database.query(`SELECT animal_id, group_id FROM prescriptions WHERE id = $1`, [prescriptionId]);
    if (!r.rows[0]) throw new NotFoundError('Prescription');
    return this.status(r.rows[0].animal_id ? { animalId: r.rows[0].animal_id } : { groupId: r.rows[0].group_id });
  }

  /** The vet's own most recent line for each medicine name, with the label days they typed - pre-fills the next prescription. */
  async recentLinesOf(vetId: string): Promise<Array<{ name: string; kind: string; dosage: string; frequency: string; treatmentDays: number | null; withdrawalMilkDays: number | null; withdrawalMeatDays: number | null }>> {
    const r = await database.query(
      `SELECT DISTINCT ON (lower(m->>'name')) m->>'name' AS name, COALESCE(m->>'kind', 'medicine') AS kind, m->>'dosage' AS dosage, m->>'frequency' AS frequency,
              CASE WHEN m->>'treatmentDays' ~ '^[0-9]+$' THEN (m->>'treatmentDays')::int END AS treatment_days,
              CASE WHEN m->>'withdrawalMilkDays' ~ '^[0-9]+$' THEN (m->>'withdrawalMilkDays')::int END AS milk_days,
              CASE WHEN m->>'withdrawalMeatDays' ~ '^[0-9]+$' THEN (m->>'withdrawalMeatDays')::int END AS meat_days
         FROM (SELECT medications, created_at FROM prescriptions WHERE veterinarian_id = $1 ORDER BY created_at DESC LIMIT 200) p
         CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.medications) = 'array' THEN p.medications ELSE '[]'::jsonb END) m
        WHERE COALESCE(m->>'name', '') <> '' AND COALESCE(m->>'kind', 'medicine') IN ('medicine', 'medicated_feed')
        ORDER BY lower(m->>'name'), p.created_at DESC`, [vetId]);
    return r.rows.map((x: any) => ({
      name: x.name, kind: x.kind, dosage: x.dosage || '', frequency: x.frequency || '',
      treatmentDays: x.treatment_days ?? null, withdrawalMilkDays: x.milk_days ?? null, withdrawalMeatDays: x.meat_days ?? null,
    }));
  }

  /** The same correction for a treatment the farmer entered themselves. */
  async correctSelfCourse(id: string, lastDoseOn: string | null): Promise<void> {
    if (lastDoseOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(lastDoseOn) || Number.isNaN(Date.parse(lastDoseOn)))) throw new ValidationError('That date is not valid.');
    const r = await database.query(`SELECT started_on::text AS started FROM self_treatments WHERE id = $1`, [id]);
    if (!r.rows[0]) throw new NotFoundError('Treatment');
    if (lastDoseOn !== null && lastDoseOn < r.rows[0].started) throw new ValidationError('The last dose cannot be before the treatment started.');
    if (lastDoseOn !== null && lastDoseOn > addDays(todayIso(), 1)) throw new ValidationError('That last dose date is too far ahead. Choose today or an earlier day.');
    await database.query(`UPDATE self_treatments SET last_dose_on = $2, updated_at = NOW() WHERE id = $1`, [id, lastDoseOn]);
  }

  /** A farmer who treated an animal or herd without a vet: same facts as a prescription line, entered once. */
  async addSelfTreatment(enterpriseId: string, input: {
    id?: string; animalId?: string | null; groupId?: string | null; medicineName: string; treatmentDays: number;
    withdrawalMilkDays: number; withdrawalMeatDays: number; startedOn?: string | null; note?: string | null;
  }, userId: string): Promise<{ id: string }> {
    const name = String(input.medicineName || '').trim().slice(0, 255);
    if (!name) throw new ValidationError('Write the name of the medicine, as it is on the label.');
    if (!!input.animalId === !!input.groupId) throw new ValidationError('Choose one animal or one group.');
    const subject = input.animalId
      ? await database.query(`SELECT 1 FROM animals WHERE id = $1 AND enterprise_id = $2`, [input.animalId, enterpriseId])
      : await database.query(`SELECT 1 FROM animal_groups WHERE id = $1 AND enterprise_id = $2`, [input.groupId, enterpriseId]);
    if (!subject.rows.length) throw new ValidationError('That animal or group is not on this farm.');
    const started = input.startedOn || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(started) || Number.isNaN(Date.parse(started))) throw new ValidationError('That date is not valid.');
    if (started > addDays(todayIso(), 1)) throw new ValidationError('The treatment cannot start in the future. Choose today or an earlier day.');
    const days = wholeDays(input.treatmentDays);
    if (days < 1) throw new ValidationError('How many days was it given? Enter a number of days, 1 or more.');
    const milk = Number(input.withdrawalMilkDays); const meat = Number(input.withdrawalMeatDays);
    // Both numbers are required, 0 meaning the label says none - the farmer reads the label, the platform never assumes.
    if (!Number.isFinite(milk) || !Number.isFinite(meat) || milk < 0 || meat < 0 || milk > 365 || meat > 365) {
      throw new ValidationError('Enter the milk / egg and the meat withdrawal days from the label. Enter 0 if the label says none.');
    }
    // A phone that was offline sends the entry again with the same id: the first row stands, no second one is made.
    const r = await database.query(
      `INSERT INTO self_treatments (id, enterprise_id, animal_id, group_id, medicine_name, treatment_days, withdrawal_milk_days, withdrawal_meat_days, started_on, note, entered_by)
       VALUES (COALESCE($11::uuid, gen_random_uuid()),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [enterpriseId, input.animalId || null, input.groupId || null, name, days, Math.round(milk), Math.round(meat), started, input.note ? String(input.note).slice(0, 500) : null, userId, input.id || null]);
    return { id: r.rows[0]?.id || String(input.id) };
  }

  /** The farm owner and the managers are told when a prescription holds milk / eggs or meat back, and until when. */
  async notifyStarted(rx: { id: string; animalId: string | null; groupId: string | null; medications: any[] }): Promise<void> {
    const held = rx.medications.filter(l => wholeDays(l.withdrawalMilkDays) > 0 || wholeDays(l.withdrawalMeatDays) > 0);
    if (!held.length) return;
    const subject = rx.animalId ? { animalId: rx.animalId } : { groupId: rx.groupId };
    const s = await this.status(subject);
    if (!s.active) return;
    const info = rx.animalId
      ? await database.query(`SELECT a.name, a.enterprise_id, e.owner_id FROM animals a LEFT JOIN enterprises e ON e.id = a.enterprise_id WHERE a.id = $1`, [rx.animalId])
      : await database.query(`SELECT g.name, g.enterprise_id, e.owner_id FROM animal_groups g LEFT JOIN enterprises e ON e.id = g.enterprise_id WHERE g.id = $1`, [rx.groupId]);
    const x = info.rows[0];
    if (!x?.enterprise_id) return;
    const people = await database.query(
      `SELECT owner_id AS id FROM enterprises WHERE id = $1
       UNION SELECT user_id FROM enterprise_members WHERE enterprise_id = $1 AND is_active = true AND role IN ('manager', 'supervisor')`, [x.enterprise_id]);
    const parts = [s.milkUntil ? `milk and eggs through ${s.milkUntil}` : '', s.meatUntil ? `meat through ${s.meatUntil}` : ''].filter(Boolean).join(', ');
    const NotificationService = (await import('../NotificationService')).default;
    for (const p of people.rows) {
      if (!p.id) continue;
      const key = `withdrawal-rx:${rx.id}`;
      const seen = await database.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND metadata->>'dedupeKey' = $2 LIMIT 1`, [p.id, key]);
      if (seen.rows.length) continue;
      await NotificationService.createNotification(p.id, 'system', `Withdrawal: ${x.name}`,
        `${x.name} was treated - hold back ${parts}. Open Daily records to see what is under withdrawal.`, 'in_app',
        { type: 'withdrawal_started', prescriptionId: rx.id, dedupeKey: key });
    }
  }

  /** Is this a food-producing animal or herd (master data: the species' farm segment), so the vet must give label days? */
  async isFoodProducing(subject: Subject): Promise<boolean> {
    const r = subject.groupId
      ? await database.query(`SELECT ms.farm_segment FROM animal_groups g JOIN master_species ms ON ms.code = g.species WHERE g.id = $1`, [subject.groupId])
      : subject.animalId
        ? await database.query(`SELECT ms.farm_segment FROM animals a JOIN master_species ms ON ms.code = a.species WHERE a.id = $1`, [subject.animalId])
        : { rows: [] as any[] };
    const seg = r.rows[0]?.farm_segment;
    return !!seg && !['pet', 'equine'].includes(seg);
  }

  /**
   * Warn-and-confirm (not a block): when milk / eggs or meat must be withheld, the action says so in words and goes ahead only
   * when the person confirms (the client sends the request again with confirmWithdrawal). `what` is the thing about to leave.
   */
  async guard(subject: Subject, what: 'milk' | 'meat', confirmed: boolean | undefined, ctx: { userId: string; action: string }): Promise<void> {
    if (!subject.animalId && !subject.groupId) return;
    const s = await this.status(subject);
    const until = what === 'milk' ? s.milkUntil : s.meatUntil;
    if (!until) return;
    const item = s.items.find(i => (what === 'milk' ? i.milkUntil : i.meatUntil) === until);
    const row = subject.animalId
      ? (await database.query(`SELECT name, enterprise_id FROM animals WHERE id = $1`, [subject.animalId])).rows[0]
      : (await database.query(`SELECT name, enterprise_id FROM animal_groups WHERE id = $1`, [subject.groupId])).rows[0];
    const name = row?.name;
    // "Record anyway": the person has read the warning and confirmed. Keep who, when, what and until when - for a buyer or inspector.
    if (confirmed === true) {
      await database.query(
        `INSERT INTO withdrawal_overrides (user_id, enterprise_id, animal_id, group_id, action, withheld, until_date, medicine)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ctx.userId || null, row?.enterprise_id || null, subject.animalId || null, subject.groupId || null, ctx.action, what, until, item?.medicine || null]
      ).catch((e: any) => logger.warn('Could not record a withdrawal confirmation', { error: e?.message }));
      return;
    }
    const thing = what === 'milk' ? 'Milk and eggs' : 'Meat';
    throw new WithdrawalConfirmError(
      `${name || (subject.groupId ? 'This group' : 'This animal')} is under a ${what === 'milk' ? 'milk / egg' : 'meat'} withdrawal until ${until}${item?.medicine ? ` because of ${item.medicine}` : ''}. ` +
      `${thing} from ${subject.groupId ? 'this group' : 'this animal'} must not be sold or eaten before then. Save anyway only if you are sure.`,
      // The screen builds the same warning in the person's own language from these values.
      { what, name: name || null, group: !!subject.groupId, until, medicine: item?.medicine || null, action: ctx.action }
    );
  }
}

export default new WithdrawalService();
