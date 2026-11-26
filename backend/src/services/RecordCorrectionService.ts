import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import logger from '../utils/logger';
import { CodedError, NotFoundError, ValidationError } from '../utils/errors';
import AnimalAccessService from './AnimalAccessService';

/**
 * Correcting a saved health record WITHOUT rewriting it (owner decision 2026-11-25, ledger ORPH-049..052).
 *
 *  - A medical record is never edited in place. A correction is an ADDENDUM: a new dated note attached to the record, with who
 *    wrote it and their role. Everyone who may read the record reads its notes.
 *  - A vaccination or allergy entry that was wrong is marked "entered by mistake": reason required, who and when kept. The row stays
 *    (it is history) but leaves the passport, compliance counts, due reminders, certificates and the allergy warnings. A dose that
 *    was linked to a schedule row is un-linked and the row reopens, so the passport asks for the dose again.
 *
 * Callers sit behind `requireRecordAccess(table)` (the record's own animal decides, never an id from the body). This service adds the
 * "who may mark a mistake" rule on top: the person who entered it, the animal's owner, its farm team, or an admin.
 */

export type MistakeTable = 'vaccination_records' | 'allergy_records';

export interface Actor { userId: string; role?: string; roles?: string[] }

export const REC_NOT_AUTHOR_MESSAGE =
  'Only the person who entered this, the animal\'s owner, their farm team or an admin can mark it as entered by mistake. You can add a correction note to the record instead, or ask one of them.';

const MISTAKE_META: Record<MistakeTable, { auditType: string; authorColumn: string; label: string }> = {
  vaccination_records: { auditType: 'vaccination', authorColumn: 'created_by', label: 'vaccination' },
  allergy_records: { auditType: 'allergy', authorColumn: 'reported_by', label: 'allergy' },
};

async function actorName(userId: string): Promise<string> {
  const r = await database.query(`SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), email) AS name FROM users WHERE id = $1`, [userId]);
  return r.rows[0]?.name || '';
}

async function audit(recordId: string, recordType: string, action: string, by: string, byName: string, newValues: unknown, reason?: string) {
  try {
    await database.query(
      `INSERT INTO medical_record_audit_log (id, record_id, record_type, action, changed_by, changed_by_name, new_values, change_reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [uuidv4(), recordId, recordType, action, by, byName, JSON.stringify(newValues), reason || null]
    );
  } catch (err) {
    logger.error('Record correction audit failed', { err, recordId, action });
  }
}

class RecordCorrectionService {
  /** The notes on one medical record, oldest first. */
  async listAddenda(recordId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT id, record_id AS "recordId", note, author_id AS "authorId", author_name AS "authorName",
              author_role AS "authorRole", created_at AS "createdAt"
         FROM medical_record_addenda WHERE record_id = $1 ORDER BY created_at ASC`,
      [recordId]
    );
    return r.rows;
  }

  async addAddendum(recordId: string, actor: Actor, note: string): Promise<any> {
    const text = (note || '').trim();
    if (text.length < 3) throw new ValidationError('Write the correction before saving it.');
    const exists = await database.query(`SELECT 1 FROM medical_records WHERE id = $1`, [recordId]);
    if (!exists.rows.length) throw new NotFoundError('Record', recordId);
    const name = await actorName(actor.userId);
    const id = uuidv4();
    await database.query(
      `INSERT INTO medical_record_addenda (id, record_id, note, author_id, author_name, author_role)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, recordId, text, actor.userId, name, actor.role || null]
    );
    await audit(recordId, 'medical_record', 'ADDENDUM', actor.userId, name, { addendumId: id });
    const rows = await database.query(
      `SELECT id, record_id AS "recordId", note, author_id AS "authorId", author_name AS "authorName",
              author_role AS "authorRole", created_at AS "createdAt" FROM medical_record_addenda WHERE id = $1`, [id]);
    return rows.rows[0];
  }

  /** Mark a vaccination or allergy entry as entered by mistake. Idempotent refusal if it already is. */
  async markMistake(table: MistakeTable, id: string, actor: Actor, reason: string): Promise<any> {
    const meta = MISTAKE_META[table];
    const why = (reason || '').trim();
    if (why.length < 3) throw new ValidationError('Say why this entry was a mistake (for example "wrong animal" or "wrong date").');
    const found = await database.query(
      `SELECT animal_id, group_id, ${meta.authorColumn} AS author_id, entered_by_mistake_at FROM ${table} WHERE id = $1`, [id]);
    const row = found.rows[0];
    if (!row) throw new NotFoundError(meta.label, id);
    if (row.entered_by_mistake_at) throw new ValidationError('This entry is already marked as entered by mistake.');

    // Who may: the author, the owner, the farm team (write), an admin. A booked vet or a network member who did not enter it adds a
    // correction note instead.
    let allowedVia: string | undefined;
    if (row.animal_id) allowedVia = (await AnimalAccessService.check(actor, row.animal_id, 'write')).via;
    else if (row.group_id) allowedVia = (await AnimalAccessService.checkGroup(actor, row.group_id, 'write')).via;
    const isAuthor = row.author_id && row.author_id === actor.userId;
    if (!isAuthor && !['admin', 'owner', 'farm'].includes(allowedVia || '')) {
      throw new CodedError(403, 'REC_NOT_AUTHOR', REC_NOT_AUTHOR_MESSAGE);
    }

    const name = await actorName(actor.userId);
    const extra = table === 'allergy_records' ? ', is_active = false' : ', is_valid = false';
    await database.query(
      `UPDATE ${table}
          SET entered_by_mistake_at = NOW(), entered_by_mistake_by = $2, entered_by_mistake_by_name = $3,
              entered_by_mistake_reason = $4, updated_at = NOW()${extra}
        WHERE id = $1`,
      [id, actor.userId, name, why]
    );

    let reopened = 0;
    if (table === 'vaccination_records') {
      // The dose this entry satisfied is owed again: the schedule row reopens (overdue when its date has passed).
      const re = await database.query(
        `UPDATE vaccine_schedule
            SET status = CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
                vaccination_record_id = NULL, administered_at = NULL, reminder_sent = false, updated_at = NOW()
          WHERE vaccination_record_id = $1 AND status = 'administered'`,
        [id]
      );
      reopened = re.rowCount || 0;
    }
    await audit(id, meta.auditType, 'MISTAKE', actor.userId, name, { reopenedDoses: reopened }, why);
    return { id, enteredByMistakeAt: new Date().toISOString(), enteredByMistakeByName: name, enteredByMistakeReason: why, reopenedDoses: reopened };
  }
}

export default new RecordCorrectionService();
