import crypto from 'crypto';
import database from '../utils/database';
import logger from '../utils/logger';
import { DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import NotificationService from './NotificationService';
import { logClinicalAccess } from '../middleware/hospitalDataIsolation';

/**
 * A farm shares a GROUP (herd / flock) with a hospital network for ONE production cycle.
 *
 *   owner  --creates a one-time code (what is shared, for the current cycle)-->  hospital
 *   hospital staff  --redeems the code-->  a group_care_context (live sharing)
 *   the sharing ends when the cycle closes, or when the owner stops it. A new cycle needs a new code.
 *
 * Why a code and not a request from the network: a network cannot browse farms, and a group id must never be enough to ask
 * for one (the animal flow guards this with a "footprint" check; a group has no visit history to check). The farm decides
 * who is given a code, what it covers and for how long - consent comes first, as everywhere else in the hospital network.
 * See docs/modules/farm-profile.md "Sharing a group with a hospital network".
 */

export const SHARE_CODE_DAYS = 14;
/** A group with no production cycle (kept as individual animals) is shared for a fixed period instead. */
export const NO_CYCLE_SHARE_DAYS = 90;
/** Letters and digits that cannot be misread over the phone (no 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export const BAD_CODE_MESSAGE = 'That code is not valid, has expired, or has already been used. Ask the farm owner to create a new one.';

export interface ShareScope { medicalRecords: boolean; vaccinationRecords: boolean; prescriptions: boolean }

const hash = (code: string) => crypto.createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
function newCode(): string {
  let out = '';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
/** 8 characters shown as XXXX-XXXX. */
export const formatCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

class GroupNetworkSharingService {
  private async groupRow(groupId: string) {
    const g = await database.query(
      `SELECT ag.id, ag.name, ag.enterprise_id, e.owner_id
         FROM animal_groups ag JOIN enterprises e ON e.id = ag.enterprise_id
        WHERE ag.id = $1 AND ag.is_active = true`, [groupId]
    );
    if (g.rows.length === 0) throw new NotFoundError('We could not find that group. It may have been removed.');
    return g.rows[0];
  }

  /** Owner: create a code for the group's current cycle. Returns the code ONCE - only its hash is stored. */
  async createCode(groupId: string, userId: string, scope: Partial<ShareScope> = {}) {
    const g = await this.groupRow(groupId);
    const cyc = await database.query(`SELECT id, cycle_number FROM group_cycles WHERE group_id = $1 AND status = 'active' LIMIT 1`, [groupId]);
    const cycleId: string | null = cyc.rows[0]?.id || null;
    const expiresAt = new Date(Date.now() + SHARE_CODE_DAYS * 86400000);
    const code = newCode();
    const r = await database.query(
      `INSERT INTO group_share_codes (group_id, cycle_id, created_by, code_hash, allow_medical_records, allow_vaccination_records, allow_prescriptions, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [groupId, cycleId, userId, hash(code), scope.medicalRecords !== false, scope.vaccinationRecords !== false, scope.prescriptions !== false, expiresAt]
    );
    logger.info('Group share code created', { groupId, cycleId, codeId: r.rows[0].id });
    return { id: r.rows[0].id, code: formatCode(code), expiresAt, groupName: g.name, cycleId, cycleNumber: cyc.rows[0]?.cycle_number ?? null };
  }

  /** Owner: what is currently shared or offered for this group. */
  async listForGroup(groupId: string) {
    const contexts = await database.query(
      `SELECT gcc.id, gcc.network_id AS "networkId", hn.name AS "networkName", vh.name AS "hospitalName", gcc.cycle_id AS "cycleId",
              gcc.status, gcc.valid_until AS "validUntil", gcc.created_at AS "sharedSince", gcc.ended_at AS "endedAt", gcc.ended_reason AS "endedReason",
              gcc.allow_medical_records AS "medicalRecords", gcc.allow_vaccination_records AS "vaccinationRecords", gcc.allow_prescriptions AS "prescriptions"
         FROM group_care_contexts gcc
         JOIN hospital_networks hn ON hn.id = gcc.network_id
         LEFT JOIN vet_hospitals vh ON vh.id = gcc.hospital_id
        WHERE gcc.group_id = $1 ORDER BY gcc.created_at DESC LIMIT 50`, [groupId]
    );
    const codes = await database.query(
      `SELECT id, cycle_id AS "cycleId", expires_at AS "expiresAt", created_at AS "createdAt",
              allow_medical_records AS "medicalRecords", allow_vaccination_records AS "vaccinationRecords", allow_prescriptions AS "prescriptions"
         FROM group_share_codes
        WHERE group_id = $1 AND redeemed_at IS NULL AND cancelled_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC`, [groupId]
    );
    return { sharings: contexts.rows, openCodes: codes.rows };
  }

  async cancelCode(groupId: string, codeId: string) {
    const r = await database.query(
      `UPDATE group_share_codes SET cancelled_at = NOW() WHERE id = $1 AND group_id = $2 AND redeemed_at IS NULL AND cancelled_at IS NULL RETURNING id`, [codeId, groupId]);
    if (r.rows.length === 0) throw new NotFoundError('We could not find that code. It may already have been used or cancelled.');
  }

  /** Owner: stop sharing. Takes effect at once; the network keeps nothing it can open any more. */
  async stopSharing(groupId: string, contextId: string) {
    const r = await database.query(
      `UPDATE group_care_contexts SET status = 'revoked', ended_at = NOW(), ended_reason = 'owner_stopped'
        WHERE id = $1 AND group_id = $2 AND status = 'active' RETURNING id`, [contextId, groupId]);
    if (r.rows.length === 0) throw new NotFoundError('We could not find that sharing, or it has already ended.');
  }

  /** Network staff: redeem a code. `hospitalId` is the branch (forced to the person's own branch for branch-scoped roles). */
  async redeem(networkId: string, userId: string, rawCode: string, hospitalId: string | null) {
    const code = (rawCode || '').trim();
    if (!code) throw new ValidationError('Enter the code the farm gave you.');
    if (hospitalId) {
      const inNet = await database.query(
        `SELECT 1 FROM hospital_network_members WHERE network_id = $1 AND hospital_id = $2 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
        [networkId, hospitalId]);
      if (inNet.rows.length === 0) throw new ValidationError('That hospital is not part of this network.');
    }
    try {
      return await database.transaction(async (client: any) => {
        const found = await client.query(
          `SELECT * FROM group_share_codes WHERE code_hash = $1 AND redeemed_at IS NULL AND cancelled_at IS NULL AND expires_at > NOW() FOR UPDATE`, [hash(code)]);
        if (found.rows.length === 0) throw new ValidationError(BAD_CODE_MESSAGE);
        const c = found.rows[0];
        const g = await client.query(
          `SELECT ag.id, ag.name, ag.species, ag.current_count, e.owner_id FROM animal_groups ag JOIN enterprises e ON e.id = ag.enterprise_id WHERE ag.id = $1 AND ag.is_active = true`, [c.group_id]);
        if (g.rows.length === 0) throw new ValidationError(BAD_CODE_MESSAGE);
        // The cycle the code was made for must still be the group's open one: a closed cycle is over, nothing to share.
        if (c.cycle_id) {
          const open = await client.query(`SELECT 1 FROM group_cycles WHERE id = $1 AND status = 'active'`, [c.cycle_id]);
          if (open.rows.length === 0) throw new ValidationError('The production cycle this code was made for has ended. Ask the farm owner to create a new code for the current cycle.');
        }
        const validUntil = c.cycle_id ? null : new Date(Date.now() + NO_CYCLE_SHARE_DAYS * 86400000);
        const exists = await client.query(`SELECT 1 FROM group_care_contexts WHERE group_id = $1 AND network_id = $2 AND status = 'active'`, [c.group_id, networkId]);
        if (exists.rows.length > 0) throw new ValidationError('This group is already shared with your network. Ask the farm owner to stop the current sharing first if you need a new one.');
        const ins = await client.query(
          `INSERT INTO group_care_contexts (group_id, network_id, hospital_id, cycle_id, share_code_id, shared_by, redeemed_by,
              allow_medical_records, allow_vaccination_records, allow_prescriptions, valid_until)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [c.group_id, networkId, hospitalId, c.cycle_id, c.id, c.created_by, userId, c.allow_medical_records, c.allow_vaccination_records, c.allow_prescriptions, validUntil]);
        await client.query(`UPDATE group_share_codes SET redeemed_at = NOW() WHERE id = $1`, [c.id]);
        const net = await client.query(`SELECT name FROM hospital_networks WHERE id = $1`, [networkId]);
        return { id: ins.rows[0].id, group: g.rows[0], ownerId: g.rows[0].owner_id, networkName: net.rows[0]?.name || 'the network' };
      }).then(async (res: any) => {
        try {
          await NotificationService.createNotification(
            res.ownerId, 'group_shared', 'Group shared with a network',
            `${res.networkName} is now able to see the records of your group "${res.group.name}" for its current cycle. You can stop sharing at any time from the group.`,
            'all', { groupId: res.group.id, networkId, contextId: res.id });
        } catch (e: any) { logger.warn('Share notification failed', { error: e.message }); }
        return { id: res.id, groupId: res.group.id, groupName: res.group.name };
      });
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new DatabaseError('Could not redeem the sharing code', { originalError: err.message });
    }
  }

  /** The network's view: groups shared with it that are still live. Branch-scoped roles see their own branch's only. */
  async listForNetwork(networkId: string, branchScopeHospitalId: string | null) {
    const r = await database.query(
      `SELECT gcc.id, gcc.group_id AS "groupId", ag.name AS "groupName", ag.species, ag.group_type AS "groupType", ag.current_count AS "headCount",
              gcc.cycle_id AS "cycleId", gcc.hospital_id AS "hospitalId", gcc.created_at AS "sharedSince", gcc.valid_until AS "validUntil",
              gcc.allow_medical_records AS "medicalRecords", gcc.allow_vaccination_records AS "vaccinationRecords", gcc.allow_prescriptions AS "prescriptions",
              e.name AS "farmName"
         FROM group_care_contexts gcc
         JOIN animal_groups ag ON ag.id = gcc.group_id
         JOIN enterprises e ON e.id = ag.enterprise_id
        WHERE gcc.network_id = $1 AND gcc.status = 'active' AND (gcc.valid_until IS NULL OR gcc.valid_until > NOW())
          AND ($2::uuid IS NULL OR gcc.hospital_id = $2::uuid)
        ORDER BY gcc.created_at DESC`, [networkId, branchScopeHospitalId]);
    return r.rows;
  }

  /**
   * The records of a shared group, limited to the cycle that was shared and to what the owner allowed. Never confidential
   * records. Every read is written to the clinical access log.
   */
  async recordsForNetwork(networkId: string, groupId: string, userId: string, role: string, branchScopeHospitalId: string | null) {
    const ctx = await database.query(
      `SELECT * FROM group_care_contexts
        WHERE network_id = $1 AND group_id = $2 AND status = 'active' AND (valid_until IS NULL OR valid_until > NOW())
          AND ($3::uuid IS NULL OR hospital_id = $3::uuid) LIMIT 1`, [networkId, groupId, branchScopeHospitalId]);
    if (ctx.rows.length === 0) {
      throw new ForbiddenError('This group is not shared with your network. The farm owner has to share it with a code first.');
    }
    const c = ctx.rows[0];
    // Same cycle only: records of an earlier or later cycle are not part of what was consented to.
    const cycleSql = c.cycle_id ? 'AND x.cycle_id = $2' : '';
    const params = c.cycle_id ? [groupId, c.cycle_id] : [groupId];
    const out: any = { groupId, cycleId: c.cycle_id, medicalRecords: [], vaccinations: [], prescriptions: [] };
    if (c.allow_medical_records) {
      out.medicalRecords = (await database.query(
        `SELECT x.id, x.record_type AS "recordType", x.title, x.content, x.severity, x.event_date AS "eventDate",
                x.head_count_treated AS "headCountTreated", x.affected_count AS "affectedCount", x.mortality_count AS "mortalityCount", x.created_at AS "createdAt"
           FROM medical_records x WHERE x.group_id = $1 ${cycleSql} AND x.status != 'archived' AND COALESCE(x.is_confidential, false) = false
          ORDER BY x.created_at DESC LIMIT 200`, params)).rows;
    }
    if (c.allow_vaccination_records) {
      out.vaccinations = (await database.query(
        `SELECT x.id, x.vaccine_name AS "vaccineName", x.date_administered AS "dateAdministered", x.next_due_date AS "nextDueDate",
                x.head_count_treated AS "headCountTreated", x.batch_number AS "batchNumber"
           FROM vaccination_records x WHERE x.group_id = $1 AND x.entered_by_mistake_at IS NULL ${cycleSql} ORDER BY x.date_administered DESC LIMIT 200`, params)).rows;
    }
    if (c.allow_prescriptions) {
      out.prescriptions = (await database.query(
        `SELECT x.id, c.diagnosis, x.medications, x.instructions, x.head_count_treated AS "headCountTreated", x.created_at AS "createdAt"
           FROM prescriptions x LEFT JOIN consultations c ON c.id = x.consultation_id
          WHERE x.group_id = $1 ${cycleSql} ORDER BY x.created_at DESC LIMIT 200`, params)).rows;
    }
    logClinicalAccess({ accessedBy: userId, accessorRole: role, animalId: null as any, accessType: 'view', recordType: 'group_records', recordId: groupId, networkId, accessGranted: true }).catch(() => {});
    return out;
  }

  /** Called when a cycle closes: every live sharing bound to it ends, and the owner is told. */
  async endForCycle(cycleId: string, client?: { query: (q: string, p?: any[]) => Promise<any> }) {
    const q = client || database;
    await q.query(
      `UPDATE group_care_contexts SET status = 'ended', ended_at = NOW(), ended_reason = 'cycle_closed' WHERE cycle_id = $1 AND status = 'active'`, [cycleId]);
    await q.query(`UPDATE group_share_codes SET cancelled_at = NOW() WHERE cycle_id = $1 AND redeemed_at IS NULL AND cancelled_at IS NULL`, [cycleId]);
  }
}

export default new GroupNetworkSharingService();
