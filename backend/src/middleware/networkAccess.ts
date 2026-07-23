import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import database from '../utils/database';
import logger from '../utils/logger';
import NetworkRolePermissionService, { BRANCH_SCOPED_ROLES } from '../services/NetworkRolePermissionService';

/**
 * Network access fields attached to the request by requireNetworkAccess().
 * Downstream handlers/services read these to apply row-level branch scoping.
 */
export interface NetworkAccessRequest extends AuthRequest {
  networkRole?: string;
  /** When set (non-null), queries MUST filter rows to this hospital_id. Null = network-wide. */
  branchScopeHospitalId?: string | null;
}

/**
 * Result of a network membership + action check. Pure data — no req/res coupling —
 * so every network-hospital gate (route middleware, controller helper, resource-id-keyed
 * checks) can share this ONE implementation instead of each re-querying
 * hospital_network_members and re-implementing the admin-bypass / action-matrix / branch-scope
 * logic slightly differently. See [[feedback-network-hospital-change-approval]] — four
 * independently-maintained variants of this exact check previously existed, which is how a
 * new route (leave-requests) shipped without the equivalent of any of them.
 */
export type NetworkAccessResult =
  | { allowed: true; networkRole: string; branchScopeHospitalId: string | null }
  | { allowed: false; reason: 'not_member' | 'insufficient_permission' };

/**
 * Core network access check, shared by requireNetworkAccess (middleware),
 * HospitalNetworkController.ensureNetworkAccess, and the resource-id-keyed
 * checks in routes/index.ts (checkResourceNetworkAccess / checkInpatientNetworkAccess).
 *   1. Platform admin bypasses all checks.
 *   2. Caller must be an active, non-expired member of `networkId`.
 *   3. If `action` is provided, the caller's network role must be granted that action
 *      in the (admin-configurable) network role permission matrix.
 *   4. Returns branchScopeHospitalId for branch-scoped roles (hospital_director /
 *      hospital_staff) so callers can restrict downstream queries to the member's branch.
 */
export async function resolveNetworkAccess(
  networkId: string, userId: string, userRole: string, action?: string
): Promise<NetworkAccessResult> {
  if (userRole === 'admin') {
    return { allowed: true, networkRole: 'admin', branchScopeHospitalId: null };
  }

  const memberRes = await database.query(
    `SELECT network_role, hospital_id
       FROM hospital_network_members
      WHERE network_id = $1 AND user_id = $2 AND is_active = true
        AND (valid_until IS NULL OR valid_until > NOW())
      LIMIT 1`,
    [networkId, userId]
  );
  if (memberRes.rows.length === 0) {
    return { allowed: false, reason: 'not_member' };
  }

  const networkRole: string = memberRes.rows[0].network_role;
  const hospitalId: string | null = memberRes.rows[0].hospital_id ?? null;

  if (action) {
    const hasAccess = await NetworkRolePermissionService.checkAccess(networkId, networkRole, action);
    if (!hasAccess) {
      return { allowed: false, reason: 'insufficient_permission' };
    }
  }

  return {
    allowed: true,
    networkRole,
    branchScopeHospitalId: BRANCH_SCOPED_ROLES.includes(networkRole) ? hospitalId : null,
  };
}

/**
 * Express middleware wrapper around resolveNetworkAccess() for /hospital-networks/:id/*
 * endpoints. The :id param name can be overridden (e.g. for routes that nest the network
 * id elsewhere). Non-membership returns 404 (not 403) deliberately — an unauthorized caller
 * should not be able to confirm a network/resource exists just by probing IDs.
 */
export function requireNetworkAccess(action?: string, paramName: string = 'id') {
  return async (req: NetworkAccessRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      const userRole = req.userRole;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (userRole === 'admin') {
        req.networkRole = 'admin';
        req.branchScopeHospitalId = null;
        return next();
      }

      const networkId = req.params[paramName];
      if (!networkId) {
        return res.status(400).json({ success: false, message: 'Network id is required' });
      }

      const result = await resolveNetworkAccess(networkId, userId, userRole || '', action);
      if (!result.allowed) {
        if (result.reason === 'not_member') {
          return res.status(404).json({ success: false, message: 'Network not found' });
        }
        return res.status(403).json({ success: false, message: 'Insufficient role for this action' });
      }

      req.networkRole = result.networkRole;
      req.branchScopeHospitalId = result.branchScopeHospitalId;
      return next();
    } catch (err: any) {
      logger.error('requireNetworkAccess failed', { error: err.message, path: req.path });
      return res.status(500).json({ success: false, message: 'Access check failed' });
    }
  };
}

export default requireNetworkAccess;
