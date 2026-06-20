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
 * Enforces the dual-gate model for /hospital-networks/:id/* endpoints:
 *   1. Platform admin bypasses all checks.
 *   2. Caller must be an active member of the network in the :id route param.
 *   3. If `action` is provided, the caller's network role must be granted that action
 *      in the (admin-configurable) network role permission matrix.
 *   4. For branch-scoped roles (hospital_director / hospital_staff) it attaches
 *      req.branchScopeHospitalId so downstream queries can restrict rows to the member's branch.
 *
 * The :id param name can be overridden (e.g. for routes that nest the network id elsewhere).
 */
export function requireNetworkAccess(action?: string, paramName: string = 'id') {
  return async (req: NetworkAccessRequest, res: Response, next: NextFunction) => {
    try {
      const networkId = req.params[paramName];
      const userId = req.userId;
      const userRole = req.userRole;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // 1. Platform admin bypass — full, network-wide access.
      if (userRole === 'admin') {
        req.networkRole = 'admin';
        req.branchScopeHospitalId = null;
        return next();
      }

      if (!networkId) {
        return res.status(400).json({ success: false, message: 'Network id is required' });
      }

      // 2. Must be an active, non-expired member of this network.
      const memberRes = await database.query(
        `SELECT network_role, hospital_id
           FROM hospital_network_members
          WHERE network_id = $1 AND user_id = $2 AND is_active = true
            AND (valid_until IS NULL OR valid_until > NOW())
          LIMIT 1`,
        [networkId, userId]
      );
      if (memberRes.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'You do not have access to this network' });
      }

      const networkRole: string = memberRes.rows[0].network_role;
      const hospitalId: string | null = memberRes.rows[0].hospital_id ?? null;
      req.networkRole = networkRole;

      // 3. Action gate against the configurable matrix.
      if (action) {
        const allowed = await NetworkRolePermissionService.checkAccess(networkId, networkRole, action);
        if (!allowed) {
          return res.status(403).json({ success: false, message: 'Insufficient role for this action' });
        }
      }

      // 4. Branch scoping for restricted roles.
      req.branchScopeHospitalId = BRANCH_SCOPED_ROLES.includes(networkRole) ? hospitalId : null;

      return next();
    } catch (err: any) {
      logger.error('requireNetworkAccess failed', { error: err.message, path: req.path });
      return res.status(500).json({ success: false, message: 'Access check failed' });
    }
  };
}

export default requireNetworkAccess;
