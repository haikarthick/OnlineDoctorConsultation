import database from '../utils/database';
import logger from '../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import FarmProfileService from './FarmProfileService';
import BatchManagementService from './BatchManagementService';

/**
 * Farm daily records (migration 045): milk, eggs, feed, sample weight, water quality - one row per
 * subject / record type / date / session, for ONE animal or a WHOLE group.
 *
 * Nothing here knows what a "cow" or a "broiler" is. Whether a record applies to a subject is the
 * farm profile engine's answer (FarmProfileService.assertRecordTypeAllowed); what a record asks
 * for is the record type's own `fields` list in master data. This service only enforces the shape
 * that list describes, so a new record type or a changed rule needs no code change here.
 *
 * Deaths are the one exception to "store it in farm_daily_records": a death changes a group's head
 * count, and that number has exactly one owner - the population ledger - so a `mortality` record
 * is written through BatchManagementService.recordPopulationEvent instead.
 */

const LEDGER_RECORD_TYPE = 'mortality';
const READ_ONLY_FARM_ROLES = ['farm_vet', 'viewer'];
const SESSIONS = ['am', 'pm', 'day'] as const;
type Session = typeof SESSIONS[number];

export interface SaveRecordInput {
  enterpriseId?: string;
  animalId?: string | null;
  groupId?: string | null;
  recordType: string;
  recordDate?: string;
  session?: string;
  quantity?: number | string | null;
  detail?: Record<string, unknown> | null;
  notes?: string | null;
}

interface Caller { userId: string; role?: string }

interface Subject {
  enterpriseId: string;
  kind: 'animal' | 'group';
  id: string;
  speciesCode: string | null;
  animalClass: string | null;
  gender: string | null;
  managementMode: string | null;
  groupType: string | null;
  cycleId: string | null;
}

interface FieldDef { key: string; type: string; required?: boolean; options?: string[] }

const FARM_ACCESS = `(e.owner_id = $2 OR EXISTS (SELECT 1 FROM enterprise_members em
                       WHERE em.enterprise_id = e.id AND em.user_id = $2 AND em.is_active = true))`;

const todayIso = (): string => new Date().toISOString().slice(0, 10);

class FarmRecordService {

  /**
   * Throws unless the caller works on this farm (owner, active member) or is an admin. Reading is
   * open to every member; WRITING is not - a farm vet or a viewer can look at the records but not
   * add or change them (the farm's own people record; the vet reads).
   */
  async assertFarmAccess(enterpriseId: string, caller: Caller, write = false): Promise<void> {
    if (caller.role === 'admin') return;
    const r = await database.query(
      `SELECT (e.owner_id = $2) AS is_owner,
              (SELECT em.role FROM enterprise_members em
                WHERE em.enterprise_id = e.id AND em.user_id = $2 AND em.is_active = true LIMIT 1) AS member_role
         FROM enterprises e WHERE e.id = $1 AND ${FARM_ACCESS} LIMIT 1`, [enterpriseId, caller.userId]
    );
    // 404, not 403: do not confirm that a farm exists to someone with no claim on it.
    if (!r.rows.length) throw new NotFoundError('Farm not found');
    if (write && !r.rows[0].is_owner && READ_ONLY_FARM_ROLES.includes(r.rows[0].member_role)) {
      throw new ForbiddenError('Your role on this farm lets you see its records but not add or change them. Ask the farm owner or manager.');
    }
  }

  /** Loads the animal or group a record is about, checking the caller may use its farm. */
  async loadSubject(input: { animalId?: string | null; groupId?: string | null }, caller: Caller, write = false): Promise<Subject> {
    if (!!input.animalId === !!input.groupId) {
      throw new ValidationError('A record is about one animal or one group - choose which.');
    }
    if (input.animalId) {
      const r = await database.query(
        `SELECT a.id, a.enterprise_id, a.species, a.animal_class, a.gender, a.group_id,
                g.management_mode, g.group_type
           FROM animals a
           LEFT JOIN animal_groups g ON g.id = a.group_id
          WHERE a.id = $1`,
        [input.animalId]
      );
      const a = r.rows[0];
      if (!a) throw new NotFoundError('Animal not found');
      if (!a.enterprise_id) throw new ValidationError('This animal is not on a farm yet. Put it on a farm first, then record against it.');
      await this.assertFarmAccess(a.enterprise_id, caller, write);
      return {
        enterpriseId: a.enterprise_id, kind: 'animal', id: a.id, speciesCode: a.species || null,
        animalClass: a.animal_class || null, gender: a.gender || null,
        // An animal in a batch group is still its own individual here.
        managementMode: 'individual', groupType: a.group_type || null, cycleId: null,
      };
    }
    const r = await database.query(
      `SELECT g.id, g.enterprise_id, g.species, g.management_mode, g.group_type,
              (SELECT c.id FROM group_cycles c WHERE c.group_id = g.id AND c.status = 'active' LIMIT 1) AS cycle_id
         FROM animal_groups g WHERE g.id = $1`,
      [input.groupId]
    );
    const g = r.rows[0];
    if (!g) throw new NotFoundError('Group not found');
    await this.assertFarmAccess(g.enterprise_id, caller, write);
    return {
      enterpriseId: g.enterprise_id, kind: 'group', id: g.id, speciesCode: g.species || null, animalClass: null,
      gender: null, managementMode: g.management_mode || null, groupType: g.group_type || null, cycleId: g.cycle_id || null,
    };
  }

  async loadRecordType(code: string, kind: 'daily' | 'event' = 'daily'): Promise<{ code: string; kind: string; unit: string | null; fields: FieldDef[] }> {
    const r = await database.query(
      `SELECT code, kind, unit, fields FROM master_record_types WHERE code = $1 AND is_active = true`, [code]
    );
    const rt = r.rows[0];
    if (!rt) throw new ValidationError(`'${code}' is not a record type you can use.`);
    if (rt.kind !== kind) {
      throw new ValidationError(kind === 'daily'
        ? `'${code}' is an event, not a daily record. Record it as an event.`
        : `'${code}' is a daily record, not an event. Record it as a daily record.`);
    }
    return { code: rt.code, kind: rt.kind, unit: rt.unit || null, fields: Array.isArray(rt.fields) ? rt.fields : [] };
  }

  /**
   * Checks the entry against the record type's own field list and splits it into the headline
   * quantity, the session and the rest (detail). Driven entirely by master data.
   */
  shape(fields: FieldDef[], input: SaveRecordInput): { quantity: number | null; session: Session; detail: Record<string, unknown> } {
    const raw: Record<string, unknown> = { ...(input.detail || {}) };
    if (input.quantity !== undefined && input.quantity !== null && input.quantity !== '') raw.quantity = input.quantity;
    if (input.session) raw.session = input.session;

    let quantity: number | null = null;
    let session: Session = 'day';
    const detail: Record<string, unknown> = {};
    const known = new Set(fields.map(f => f.key));

    for (const f of fields) {
      const v = raw[f.key];
      const blank = v === undefined || v === null || v === '';
      if (blank) {
        if (f.required) throw new ValidationError(`${this.labelOf(f.key)} is needed for this record.`);
        continue;
      }
      let value: unknown = v;
      if (f.type === 'number') {
        const n = typeof v === 'number' ? v : Number(String(v).trim());
        if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${this.labelOf(f.key)} must be a number, zero or more.`);
        if (n > 1e9) throw new ValidationError(`${this.labelOf(f.key)} is too large. Check the number.`);
        value = n;
      } else if (f.type === 'choice') {
        if (!f.options || !f.options.includes(String(v))) {
          throw new ValidationError(`${this.labelOf(f.key)} must be one of: ${(f.options || []).join(', ')}.`);
        }
        value = String(v);
      } else {
        const s = String(v).trim();
        if (s.length > 500) throw new ValidationError(`${this.labelOf(f.key)} is too long (500 characters at most).`);
        value = s;
      }
      if (f.key === 'quantity') quantity = value as number;
      else if (f.key === 'session') session = value as Session;
      else detail[f.key] = value;
    }
    // A record type that does not ask for a session is one record per day. A type that asks for
    // one (milk: am / pm) already insisted on it above.
    if (!known.has('session')) session = 'day';
    return { quantity, session, detail };
  }

  private labelOf(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  }

  checkDate(date?: string): string {
    const d = date || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new ValidationError('That date is not valid.');
    // A day of slack covers a farmer in a timezone ahead of the server.
    const latest = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (d > latest) throw new ValidationError('That date is in the future. Choose today or an earlier day.');
    const earliest = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
    if (d < earliest) throw new ValidationError('That date is more than a year back. Check the date.');
    return d;
  }

  /**
   * Saves one daily record. Saving the same subject / type / date / session again corrects it
   * (the earlier values are kept in the audit table) - it never adds a second row.
   */
  async save(input: SaveRecordInput, caller: Caller, kind: 'daily' | 'event' = 'daily'): Promise<any> {
    const subject = await this.loadSubject(input, caller, true);
    if (input.enterpriseId && input.enterpriseId !== subject.enterpriseId) {
      throw new ValidationError('That animal or group is not on the selected farm.');
    }
    const recordDate = this.checkDate(input.recordDate);
    const rt = await this.loadRecordType(input.recordType, kind);

    await FarmProfileService.assertRecordTypeAllowed({
      speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
      managementMode: subject.managementMode, groupType: subject.groupType,
    }, rt.code, subject.kind);

    const { quantity, session, detail } = this.shape(rt.fields, input);
    const notes = input.notes ? String(input.notes).trim().slice(0, 1000) : null;

    // Deaths change the head count, which the population ledger owns.
    if (rt.code === LEDGER_RECORD_TYPE) {
      if (subject.kind !== 'group') throw new ValidationError('Deaths are recorded against a group. For one animal, record its death as an event.');
      const n = Math.round(quantity || 0);
      if (n <= 0) throw new ValidationError('How many died? Enter a number above zero.');
      const done = await BatchManagementService.recordPopulationEvent({
        groupId: subject.id, cycleId: subject.cycleId, eventType: 'mortality', quantity: n, eventDate: recordDate,
        reason: [detail.cause, notes].filter(Boolean).join(' - ') || undefined, userId: caller.userId,
      });
      return { ledger: true, ...done, recordType: rt.code, recordDate };
    }

    const animalId = subject.kind === 'animal' ? subject.id : null;
    const groupId = subject.kind === 'group' ? subject.id : null;

    const row = await database.transaction(async (client: any) => {
      const existing = await client.query(
        `SELECT * FROM farm_daily_records
          WHERE COALESCE(animal_id, group_id) = $1 AND record_type = $2 AND record_date = $3 AND session = $4
          FOR UPDATE`,
        [subject.id, rt.code, recordDate, session]
      );
      if (existing.rows.length) {
        await client.query(
          `INSERT INTO farm_daily_record_edits (record_id, enterprise_id, action, previous, edited_by)
           VALUES ($1,$2,'update',$3::jsonb,$4)`,
          [existing.rows[0].id, subject.enterpriseId, JSON.stringify(existing.rows[0]), caller.userId]
        );
      }
      const saved = await client.query(
        `INSERT INTO farm_daily_records
           (enterprise_id, animal_id, group_id, cycle_id, record_type, record_date, session, quantity, unit, detail, notes, recorded_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$12)
         ON CONFLICT ((COALESCE(animal_id, group_id)), record_type, record_date, session)
         DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, detail = EXCLUDED.detail, notes = EXCLUDED.notes,
                       cycle_id = EXCLUDED.cycle_id, updated_by = EXCLUDED.updated_by, updated_at = NOW()
         RETURNING *, record_date::text AS record_date`,
        [subject.enterpriseId, animalId, groupId, subject.cycleId, rt.code, recordDate, session, quantity, rt.unit,
         JSON.stringify(detail), notes, caller.userId]
      );
      return { row: saved.rows[0], replaced: existing.rows.length > 0 };
    });

    logger.info('Farm daily record saved', { recordType: rt.code, subject: subject.id, recordDate, replaced: row.replaced });
    return { ...this.mapRow(row.row), replaced: row.replaced };
  }

  async list(filter: {
    enterpriseId?: string; animalId?: string; groupId?: string; recordType?: string;
    from?: string; to?: string; limit?: number;
  }, caller: Caller): Promise<any[]> {
    if (!filter.enterpriseId && !filter.animalId && !filter.groupId) {
      throw new ValidationError('Say which farm, animal or group to list records for.');
    }
    if (filter.animalId || filter.groupId) {
      const s = await this.loadSubject({ animalId: filter.animalId, groupId: filter.groupId }, caller);
      filter.enterpriseId = s.enterpriseId;
    } else {
      await this.assertFarmAccess(filter.enterpriseId!, caller);
    }
    const where: string[] = ['r.enterprise_id = $1'];
    const params: unknown[] = [filter.enterpriseId];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (filter.animalId) add('r.animal_id = ?', filter.animalId);
    if (filter.groupId) add('r.group_id = ?', filter.groupId);
    if (filter.recordType) add('r.record_type = ?', filter.recordType);
    if (filter.from) add('r.record_date >= ?::date', filter.from);
    if (filter.to) add('r.record_date <= ?::date', filter.to);
    const limit = Math.min(Math.max(Number(filter.limit) || 100, 1), 500);
    const r = await database.query(
      `SELECT r.*, r.record_date::text AS record_date FROM farm_daily_records r WHERE ${where.join(' AND ')}
        ORDER BY r.record_date DESC, r.created_at DESC LIMIT ${limit}`,
      params
    );
    return r.rows.map((x: any) => this.mapRow(x));
  }

  /**
   * Totals per record type per day for a farm - what the Today view and the vet timeline show.
   * Milk recorded for the whole group AND per animal in the same group are both counted: the
   * farmer chose how to record, and we never guess which of the two is the duplicate.
   */
  async summary(enterpriseId: string, days: number, caller: Caller): Promise<any[]> {
    await this.assertFarmAccess(enterpriseId, caller);
    const span = Math.min(Math.max(Math.floor(days) || 7, 1), 90);
    const r = await database.query(
      `SELECT record_type, record_date::text AS record_date, SUM(quantity) AS total, COUNT(*) AS entries
         FROM farm_daily_records
        WHERE enterprise_id = $1 AND record_date >= CURRENT_DATE - ($2::int - 1)
        GROUP BY record_type, record_date
        ORDER BY record_date DESC, record_type`,
      [enterpriseId, span]
    );
    return r.rows.map((x: any) => ({
      recordType: x.record_type,
      recordDate: x.record_date,
      total: x.total === null ? null : Number(x.total),
      entries: Number(x.entries),
    }));
  }

  async remove(id: string, caller: Caller): Promise<void> {
    const r = await database.query(`SELECT * FROM farm_daily_records WHERE id = $1`, [id]);
    const rec = r.rows[0];
    if (!rec) throw new NotFoundError('Record not found');
    await this.assertFarmAccess(rec.enterprise_id, caller, true);
    // The farm's owner and managers may delete anything; a worker may only delete what they entered.
    if (caller.role !== 'admin' && rec.recorded_by !== caller.userId) {
      const own = await database.query(
        `SELECT 1 FROM enterprises e WHERE e.id = $1 AND e.owner_id = $2
         UNION SELECT 1 FROM enterprise_members em WHERE em.enterprise_id = $1 AND em.user_id = $2 AND em.is_active = true AND em.role IN ('owner','manager')`,
        [rec.enterprise_id, caller.userId]
      );
      if (!own.rows.length) throw new ForbiddenError('Only the person who entered this record, or the farm owner or manager, can delete it.');
    }
    await database.transaction(async (client: any) => {
      await client.query(
        `INSERT INTO farm_daily_record_edits (record_id, enterprise_id, action, previous, edited_by)
         VALUES ($1,$2,'delete',$3::jsonb,$4)`,
        [rec.id, rec.enterprise_id, JSON.stringify(rec), caller.userId]
      );
      await client.query(`DELETE FROM farm_daily_records WHERE id = $1`, [rec.id]);
    });
  }

  private mapRow(r: any) {
    const date = String(r.record_date).slice(0, 10); // selected as text - a DATE parsed to a JS Date shifts a day in some timezones
    return {
      id: r.id, enterpriseId: r.enterprise_id, animalId: r.animal_id, groupId: r.group_id, cycleId: r.cycle_id,
      recordType: r.record_type, recordDate: date, session: r.session,
      quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
      unit: r.unit, detail: r.detail || {}, notes: r.notes, recordedBy: r.recorded_by,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}

export default new FarmRecordService();
