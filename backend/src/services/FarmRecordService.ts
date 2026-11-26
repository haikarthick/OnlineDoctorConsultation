import WithdrawalService from './withdrawal/WithdrawalService';
import database from '../utils/database';
import logger from '../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError, CodedError } from '../utils/errors';
import FarmProfileService from './FarmProfileService';
import FarmAccessService, { VET_NOT_BOOKED_MESSAGE, NO_ACCESS_MESSAGE } from './FarmAccessService';
import { logClinicalAccess } from '../middleware/hospitalDataIsolation';
import BatchManagementService from './BatchManagementService';
import FeedInventoryService from './FeedInventoryService';

/**
 * Farm daily records (migration 045): milk, eggs, feed, sample weight, water quality - one row per
 * subject / record type / date / session, for ONE animal or a WHOLE group.
 *
 * Nothing here knows what a "cow" or a "broiler" is. Whether a record applies to a subject is the
 * farm profile engine's answer (FarmProfileService.assertRecordTypeAllowed); what a record asks
 * for is the record type's own `fields` list in master data. This service only enforces the shape
 * that list describes, so a new record type or a changed rule needs no code change here.
 *
 * A record type with a `stock` field (feed) names the farm's stock item it used: saving takes that much out of stock
 * and stores its cost; correcting or deleting the entry moves stock back by exactly what it had taken (migration 063).
 * Such a record may also be for the WHOLE farm ("All my animals") - a small farm feeds from one bag without groups.
 * Daily records is the only place feed given is recorded; Feed Inventory holds stock and price only.
 *
 * Deaths are the one exception to "store it in farm_daily_records": a death changes a group's head
 * count, and that number has exactly one owner - the population ledger - so a `mortality` record
 * is written through BatchManagementService.recordPopulationEvent instead.
 */

const LEDGER_RECORD_TYPE = 'mortality';
const canDeleteAnyRecord = (role: string | null): boolean => role === 'owner' || role === 'manager';
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
  /** The stock item used (record types with a `stock` field, i.e. feed). Empty = home-grown / not from stock. */
  feedId?: string | null;
  /** The person saw the withdrawal warning and chose to save anyway. */
  confirmWithdrawal?: boolean;
}

interface Caller { userId: string; role?: string }

interface Subject {
  enterpriseId: string;
  /** 'farm' = all the farm's animals (only record types with a stock field - feed). */
  kind: 'animal' | 'group' | 'farm';
  id: string;
  speciesCode: string | null;
  animalClass: string | null;
  gender: string | null;
  managementMode: string | null;
  groupType: string | null;
  cycleId: string | null;
}

interface FieldDef { key: string; type: string; required?: boolean; options?: string[] }

const todayIso = (): string => new Date().toISOString().slice(0, 10);

class FarmRecordService {

  /**
   * Throws a readable refusal unless the caller may use this farm. Reading is open to every member;
   * WRITING needs a role that records (owner, manager, supervisor, worker). The rule itself lives in
   * FarmAccessService so every farm screen and endpoint answers the same way.
   */
  async assertFarmAccess(enterpriseId: string, caller: Caller, write = false): Promise<void> {
    await FarmAccessService.assert(enterpriseId, caller, write ? 'record' : 'read');
  }

  /** Loads the animal or group a record is about, checking the caller may use its farm. */
  async loadSubject(input: { animalId?: string | null; groupId?: string | null; enterpriseId?: string | null }, caller: Caller, write = false, skipFarmAccess = false, allowFarm = false): Promise<Subject> {
    if (allowFarm && !input.animalId && !input.groupId && input.enterpriseId) {
      if (!skipFarmAccess) await this.assertFarmAccess(input.enterpriseId, caller, write);
      return {
        enterpriseId: input.enterpriseId, kind: 'farm', id: input.enterpriseId, speciesCode: null, animalClass: null,
        gender: null, managementMode: null, groupType: null, cycleId: null,
      };
    }
    if (!!input.animalId === !!input.groupId) {
      throw new ValidationError(allowFarm
        ? 'Say who was fed: one animal, one group, or all your animals.'
        : 'A record is about one animal or one group - choose which.');
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
      if (!skipFarmAccess) await this.assertFarmAccess(a.enterprise_id, caller, write);
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
    if (!skipFarmAccess) await this.assertFarmAccess(g.enterprise_id, caller, write);
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
      } else if (f.type === 'stock') {
        continue; // the stock item travels as input.feedId and is checked against the farm's stock in save()
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

  /** The caller's role on the farm that owns this animal / group (null: not on that farm). */
  private async farmRoleFor(ref: { animalId?: string | null; groupId?: string | null }, caller: Caller): Promise<string | null> {
    const r = ref.animalId
      ? await database.query(`SELECT enterprise_id FROM animals WHERE id = $1`, [ref.animalId])
      : await database.query(`SELECT enterprise_id FROM animal_groups WHERE id = $1`, [ref.groupId]);
    const enterpriseId = r.rows[0]?.enterprise_id;
    if (!enterpriseId) return null;
    return FarmAccessService.roleOf(enterpriseId, caller.userId);
  }

  /** Every read by a consulting vet is recorded (the animal's access log; groups go to the server log). */
  private auditVetRead(vetId: string, ref: { animalId?: string | null; groupId?: string | null }): void {
    if (ref.animalId) {
      logClinicalAccess({ accessedBy: vetId, accessorRole: 'veterinarian', animalId: ref.animalId, accessType: 'view', recordType: 'farm_records', accessGranted: true })
        .catch(() => { /* an audit failure must not block the vet's read */ });
    } else {
      logger.info('Consulting vet read group farm records', { vetId, groupId: ref.groupId });
    }
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
    const rt = await this.loadRecordType(input.recordType, kind);
    const usesStock = rt.fields.some(f => f.type === 'stock');
    const subject = await this.loadSubject(input, caller, true, false, usesStock);
    if (input.enterpriseId && input.enterpriseId !== subject.enterpriseId) {
      throw new ValidationError('That animal or group is not on the selected farm.');
    }
    const recordDate = this.checkDate(input.recordDate);

    // "All my animals" has no species to check: a stock record (feed) applies to every farm.
    if (subject.kind !== 'farm') {
      await FarmProfileService.assertRecordTypeAllowed({
        speciesCode: subject.speciesCode, animalClass: subject.animalClass, gender: subject.gender,
        managementMode: subject.managementMode, groupType: subject.groupType,
      }, rt.code, subject.kind);
    }
    // Milk and eggs from an animal or herd under a withdrawal: say so, and save only when the person confirms.
    if (subject.kind !== 'farm' && (rt.code === 'milk' || rt.code === 'eggs')) {
      await WithdrawalService.guard(subject.kind === 'group' ? { groupId: subject.id } : { animalId: subject.id }, 'milk', input.confirmWithdrawal, { userId: caller.userId, action: rt.code === 'eggs' ? 'egg_entry' : 'milk_entry' });
    }
    const feedId = usesStock && input.feedId ? String(input.feedId) : null;
    if (feedId && !/^[0-9a-f-]{36}$/i.test(feedId)) throw new ValidationError('Choose the feed from the list.');

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
          WHERE COALESCE(animal_id, group_id, enterprise_id) = $1 AND record_type = $2 AND record_date = $3 AND session = $4
            AND COALESCE(feed_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($5::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
          FOR UPDATE`,
        [subject.id, rt.code, recordDate, session, feedId]
      );
      // Stock: take out what this entry uses now, less what the same entry had already taken.
      let cost: number | null = null;
      let taken: number | null = null;
      if (feedId) {
        const prev = Number(existing.rows[0]?.stock_deducted) || 0;
        const moved = await FeedInventoryService.takeFromStock(client, feedId, subject.enterpriseId, quantity || 0, prev);
        cost = moved.cost;
        taken = moved.taken;
      }
      if (existing.rows.length) {
        await client.query(
          `INSERT INTO farm_daily_record_edits (record_id, enterprise_id, action, previous, edited_by)
           VALUES ($1,$2,'update',$3::jsonb,$4)`,
          [existing.rows[0].id, subject.enterpriseId, JSON.stringify(existing.rows[0]), caller.userId]
        );
      }
      const saved = await client.query(
        `INSERT INTO farm_daily_records
           (enterprise_id, animal_id, group_id, cycle_id, record_type, record_date, session, quantity, unit, detail, notes, recorded_by, updated_by,
            feed_id, cost, stock_deducted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$12,$13,$14,$15)
         ON CONFLICT ((COALESCE(animal_id, group_id, enterprise_id)), record_type, record_date, session,
                      (COALESCE(feed_id, '00000000-0000-0000-0000-000000000000'::uuid)))
         DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, detail = EXCLUDED.detail, notes = EXCLUDED.notes,
                       cycle_id = EXCLUDED.cycle_id, updated_by = EXCLUDED.updated_by, cost = EXCLUDED.cost,
                       stock_deducted = EXCLUDED.stock_deducted, updated_at = NOW()
         RETURNING *, record_date::text AS record_date`,
        [subject.enterpriseId, animalId, groupId, subject.cycleId, rt.code, recordDate, session, quantity, rt.unit,
         JSON.stringify(detail), notes, caller.userId, feedId, cost, taken]
      );
      return { row: saved.rows[0], replaced: existing.rows.length > 0 };
    });

    logger.info('Farm daily record saved', { recordType: rt.code, subject: subject.id, recordDate, replaced: row.replaced });
    return { ...this.mapRow(row.row), replaced: row.replaced };
  }

  async list(filter: {
    enterpriseId?: string; animalId?: string; groupId?: string; recordType?: string;
    from?: string; to?: string; limit?: number; wholeFarm?: boolean | string;
  }, caller: Caller): Promise<any[]> {
    if (!filter.enterpriseId && !filter.animalId && !filter.groupId) {
      throw new ValidationError('Say which farm, animal or group to list records for.');
    }
    if (filter.animalId || filter.groupId) {
      const subjectRef = { animalId: filter.animalId, groupId: filter.groupId };
      let viaConsultation = false;
      if (caller.role === 'veterinarian') {
        // A vet who is not on the farm reads only what the appointment they hold covers.
        const probe = await this.farmRoleFor(subjectRef, caller);
        if (!probe) {
          if (!(await FarmAccessService.consultingVetMayRead(caller.userId, subjectRef))) throw new ForbiddenError(VET_NOT_BOOKED_MESSAGE);
          viaConsultation = true;
        }
      }
      const s = await this.loadSubject(subjectRef, caller, false, viaConsultation);
      filter.enterpriseId = s.enterpriseId;
      if (viaConsultation) this.auditVetRead(caller.userId, subjectRef);
    } else {
      await this.assertFarmAccess(filter.enterpriseId!, caller);
    }
    const where: string[] = ['r.enterprise_id = $1'];
    const params: unknown[] = [filter.enterpriseId];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (filter.animalId) add('r.animal_id = ?', filter.animalId);
    if (filter.groupId) add('r.group_id = ?', filter.groupId);
    if (filter.recordType) add('r.record_type = ?', filter.recordType);
    if (filter.wholeFarm === true || filter.wholeFarm === 'true') where.push('r.animal_id IS NULL AND r.group_id IS NULL');
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
    // A missing entry and one on someone else's farm get the SAME answer (an admin, who may see everything, is told it is gone).
    if (!rec) {
      if (caller.role === 'admin') throw new CodedError(404, 'FR_GONE', 'This entry is already gone. Refresh the page to see the current entries.');
      throw new ForbiddenError(NO_ACCESS_MESSAGE);
    }
    await this.assertFarmAccess(rec.enterprise_id, caller, true);
    // The farm's owner and managers may delete anything; anyone else only what they entered themselves.
    if (caller.role !== 'admin' && rec.recorded_by !== caller.userId) {
      const role = await FarmAccessService.roleOf(rec.enterprise_id, caller.userId);
      if (!canDeleteAnyRecord(role)) throw new CodedError(403, 'FR_NOT_YOURS', 'Only the person who entered this record, or the farm owner or manager, can delete it.');
    }
    await database.transaction(async (client: any) => {
      await client.query(
        `INSERT INTO farm_daily_record_edits (record_id, enterprise_id, action, previous, edited_by)
         VALUES ($1,$2,'delete',$3::jsonb,$4)`,
        [rec.id, rec.enterprise_id, JSON.stringify(rec), caller.userId]
      );
      // A deleted feed entry puts back the stock it had taken.
      if (rec.feed_id && Number(rec.stock_deducted) > 0) await FeedInventoryService.returnToStock(client, rec.feed_id, Number(rec.stock_deducted));
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
      feedId: r.feed_id || null, cost: r.cost === null || r.cost === undefined ? null : Number(r.cost),
      wholeFarm: !r.animal_id && !r.group_id,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}

export default new FarmRecordService();
