import database from '../../utils/database';
import { DatabaseError } from '../../utils/errors';
import logger from '../../utils/logger';
import NetworkRolePermissionService from '../NetworkRolePermissionService';
import type { NetworkMember } from './types';
import { mapMemberRow } from './rowMappersAndDeactivate';
import { getNetworkById } from './networkCrud';
  // ─── Members ──────────────────────────────────────────────────
  export async function addNetworkMember(
    networkId: string,
    userId: string,
    role: string,
    hospitalId?: string,
    grantedBy?: string,
    validUntil?: string
  ): Promise<void> {
    try {
      await database.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (network_id, user_id)
         DO UPDATE SET network_role = $3, hospital_id = $4, is_active = true, granted_at = NOW(),
                       valid_until = COALESCE($6, hospital_network_members.valid_until)`,
        [networkId, userId, role, hospitalId ?? null, grantedBy ?? null, validUntil ?? null]
      );
    } catch (error: any) {
      logger.error('Failed to add network member', { error: error.message });
      throw new DatabaseError('Failed to add network member');
    }
  }

  export async function getNetworkMember(networkId: string, userId: string): Promise<NetworkMember | null> {
    const result = await database.query(
      `SELECT hnm.*,
              u.first_name || ' ' || u.last_name AS "userName",
              u.email AS "userEmail",
              u.role AS "userRole",
              vh.name AS "hospitalName"
       FROM hospital_network_members hnm
       JOIN users u ON hnm.user_id = u.id
       LEFT JOIN vet_hospitals vh ON hnm.hospital_id = vh.id
       WHERE hnm.network_id = $1 AND hnm.user_id = $2 AND hnm.is_active = true
         AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
      [networkId, userId]
    );
    if (result.rows.length === 0) return null;
    return mapMemberRow(result.rows[0]);
  }

  /**
   * §7 reconciliation: resolve the caller's active network memberships together with the
   * effective (admin-configurable) action matrix for each. Consumed by GET /permissions/my so
   * the frontend can surface network-role-driven nav, dashboard branches and action gating.
   */
  export async function getMyNetworkAccess(userId: string): Promise<Array<{
    networkId: string;
    networkName: string;
    networkRole: string;
    hospitalId: string | null;
    hospitalName: string | null;
    isBranchScoped: boolean;
    actions: Record<string, boolean>;
  }>> {
    const memberships = await database.query(
      `SELECT hnm.network_id AS "networkId", hnm.network_role AS "networkRole",
              hnm.hospital_id AS "hospitalId",
              hn.name AS "networkName", vh.name AS "hospitalName"
         FROM hospital_network_members hnm
         JOIN hospital_networks hn ON hn.id = hnm.network_id
         LEFT JOIN vet_hospitals vh ON vh.id = hnm.hospital_id
        WHERE hnm.user_id = $1 AND hnm.is_active = true
          AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
      [userId]
    );

    const result = [];
    for (const m of memberships.rows) {
      const matrix = await NetworkRolePermissionService.getMatrix(m.networkId);
      const actions = matrix[m.networkRole] || {};
      result.push({
        networkId: m.networkId,
        networkName: m.networkName,
        networkRole: m.networkRole,
        hospitalId: m.hospitalId ?? null,
        hospitalName: m.hospitalName ?? null,
        isBranchScoped: ['hospital_director', 'hospital_staff'].includes(m.networkRole),
        actions,
      });
    }
    return result;
  }

  export async function listNetworkMembers(networkId: string): Promise<NetworkMember[]> {
    const result = await database.query(
      `SELECT hnm.*,
              u.first_name || ' ' || u.last_name AS "userName",
              u.email AS "userEmail",
              u.role AS "userRole",
              vh.name AS "hospitalName"
       FROM hospital_network_members hnm
       JOIN users u ON hnm.user_id = u.id
       LEFT JOIN vet_hospitals vh ON hnm.hospital_id = vh.id
       WHERE hnm.network_id = $1 AND hnm.is_active = true
         AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())
       ORDER BY CASE hnm.network_role
         WHEN 'corporate_admin' THEN 1
         WHEN 'hospital_director' THEN 2
         WHEN 'compliance_officer' THEN 3
         WHEN 'auditor' THEN 4
         ELSE 5 END`,
      [networkId]
    );
    return result.rows.map((r: any) => mapMemberRow(r));
  }

  export async function removeNetworkMember(networkId: string, userId: string): Promise<void> {
    await database.query(
      `UPDATE hospital_network_members SET is_active = false
       WHERE network_id = $1 AND user_id = $2`,
      [networkId, userId]
    );
  }

  export async function logAudit(params: {
    networkId: string;
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await database.query(
        `INSERT INTO network_security_audit
           (network_id, actor_id, action, target_type, target_id, old_value, new_value, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          params.networkId, params.actorId, params.action,
          params.targetType ?? null, params.targetId ?? null,
          params.oldValue ? JSON.stringify(params.oldValue) : null,
          params.newValue ? JSON.stringify(params.newValue) : null,
          params.ipAddress ?? null,
        ]
      );
    } catch (err: any) {
      logger.warn('Audit log failed', { error: err.message });
    }
  }

  // ─── Hospital Assignment ───────────────────────────────────────
  export async function assignHospitalToNetwork(networkId: string, hospitalId: string, assignedBy: string): Promise<void> {
    await getNetworkById(networkId);
    try {
      // Primary path: update vet_hospitals flags (canonical network membership)
      await database.query(
        `UPDATE vet_hospitals SET is_network_branch = true, branch_network_id = $1 WHERE id = $2`,
        [networkId, hospitalId]
      );
      // Also insert into junction table (kept for backward compat queries)
      await database.query(
        `INSERT INTO hospital_network_hospitals (network_id, hospital_id, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (network_id, hospital_id) DO UPDATE SET is_active = true`,
        [networkId, hospitalId]
      );
      // Add hospital owner as hospital_staff member if not already a member
      await database.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by)
         SELECT $1, u.id, 'hospital_staff', $2, $3
         FROM vet_hospitals vh
         JOIN users u ON vh.owner_id = u.id
         WHERE vh.id = $2
         ON CONFLICT (network_id, user_id) DO UPDATE SET hospital_id = $2, is_active = true`,
        [networkId, hospitalId, assignedBy]
      );
    } catch (error: any) {
      logger.error('Failed to assign hospital to network', { error: error.message });
      throw new DatabaseError('Failed to assign hospital to network');
    }
  }

  export async function listNetworkHospitals(networkId: string, page: number = 1, limit: number = 20): Promise<any> {
    const offset = (page - 1) * limit;
    const result = await database.query(
      `SELECT vh.id,
              vh.name,
              vh.city,
              vh.state,
              vh.hospital_type AS "hospitalType",
              vh.email AS "contactEmail",
              vh.phone AS "contactPhone",
              vh.is_verified AS "isVerified",
              vh.is_network_branch AS "isNetworkBranch",
              vh.specializations,
              (SELECT COUNT(*) FROM hospital_network_members
               WHERE network_id = $1 AND hospital_id = vh.id AND is_active = true) AS "staffCount"
       FROM vet_hospitals vh
       WHERE vh.branch_network_id = $1 AND vh.is_network_branch = true
       ORDER BY vh.name ASC
       LIMIT $2 OFFSET $3`,
      [networkId, limit, offset]
    );
    const countResult = await database.query(
      `SELECT COUNT(*) AS count FROM vet_hospitals WHERE branch_network_id = $1 AND is_network_branch = true`,
      [networkId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0');
    return {
      hospitals: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

