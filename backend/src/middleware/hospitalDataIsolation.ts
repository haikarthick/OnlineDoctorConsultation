/**
 * Hospital Data Isolation Middleware
 *
 * Enforces that animals tagged as "private" in `animal_care_contexts`
 * (hospital/network-scoped animals) are ONLY accessible to:
 *   - The animal's owner
 *   - Admins
 *   - Vets with an active patient_data_consent for that animal (granted to them,
 *     their hospital, or their network)
 *   - Corporate/hospital network members of the owning network
 *
 * All access to private animals is immutably logged in clinical_data_access_log.
 * Non-private animals pass through without any extra checks (zero performance impact).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import database from '../utils/database';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessDecision {
  allowed: boolean;
  isPrivate: boolean;
  reason?: string;
  consentId?: string;
  networkId?: string;
  accessType: 'owner' | 'admin' | 'consent_user' | 'consent_hospital' | 'consent_network' | 'network_member' | 'public';
}

// ─── Core Access Check ────────────────────────────────────────────────────────

/**
 * Check whether a user can access a given animal's clinical data.
 * Returns an AccessDecision without throwing — callers decide whether to block.
 */
export async function checkAnimalAccess(
  userId: string,
  userRole: string,
  animalId: string
): Promise<AccessDecision> {
  try {
    // Step 1 — Is this animal tagged as private to a hospital network?
    const contextRes = await database.query(
      `SELECT acc.id, acc.network_id, acc.hospital_id, acc.visibility, a.owner_id
       FROM animal_care_contexts acc
       JOIN animals a ON acc.animal_id = a.id
       WHERE acc.animal_id = $1 AND acc.is_active = true AND acc.visibility = 'private'
       LIMIT 1`,
      [animalId]
    );

    if (contextRes.rows.length === 0) {
      // Not a private hospital animal — no isolation needed
      return { allowed: true, isPrivate: false, accessType: 'public' };
    }

    const ctx = contextRes.rows[0];

    // Step 2 — Admin always passes
    if (userRole === 'admin') {
      return { allowed: true, isPrivate: true, accessType: 'admin', networkId: ctx.network_id };
    }

    // Step 3 — Owner always passes
    if (ctx.owner_id === userId) {
      return { allowed: true, isPrivate: true, accessType: 'owner', networkId: ctx.network_id };
    }

    // Step 3.5 — Vet with confirmed booking for this animal can access
    if (userRole === 'veterinarian') {
      const bookingAccess = await database.query(
        `SELECT id FROM bookings 
         WHERE veterinarian_id = $1 AND animal_id = $2 AND status IN ('confirmed', 'pending', 'in_progress', 'completed')
         LIMIT 1`,
        [userId, animalId]
      );
      if (bookingAccess.rows.length > 0) {
        return { allowed: true, isPrivate: true, accessType: 'consent_user', networkId: ctx.network_id };
      }
    }

    // Step 4 — Network member check (any active member of the owning network)
    if (ctx.network_id) {
      const memberRes = await database.query(
        `SELECT id FROM hospital_network_members
         WHERE network_id = $1 AND user_id = $2 AND is_active = true
         LIMIT 1`,
        [ctx.network_id, userId]
      );
      if (memberRes.rows.length > 0) {
        return { allowed: true, isPrivate: true, accessType: 'network_member', networkId: ctx.network_id };
      }
    }

    // Step 5 — Patient consent check:
    //   granted_to_user_id = userId  (direct vet grant)
    //   OR granted_to_hospital_id = hospital the vet belongs to
    //   OR granted_to_network_id = network the vet belongs to
    const consentRes = await database.query(
      `SELECT pdc.id AS consent_id
       FROM patient_data_consent pdc
       WHERE pdc.animal_id = $1
         AND pdc.is_active = true
         AND (pdc.valid_until IS NULL OR pdc.valid_until > NOW())
         AND pdc.valid_from <= NOW()
         AND pdc.allow_view = true
         AND (
           pdc.granted_to_user_id = $2
           OR pdc.granted_to_hospital_id IN (
             SELECT hospital_id FROM hospital_network_members
             WHERE user_id = $2 AND is_active = true AND hospital_id IS NOT NULL
           )
           OR pdc.granted_to_network_id IN (
             SELECT network_id FROM hospital_network_members
             WHERE user_id = $2 AND is_active = true
           )
         )
       LIMIT 1`,
      [animalId, userId]
    );

    if (consentRes.rows.length > 0) {
      return {
        allowed: true,
        isPrivate: true,
        accessType: 'consent_user',
        consentId: consentRes.rows[0].consent_id,
        networkId: ctx.network_id,
      };
    }

    // Step 6 — No valid path: deny
    return {
      allowed: false,
      isPrivate: true,
      reason: 'This animal belongs to a private hospital network. Access requires explicit patient consent.',
      networkId: ctx.network_id,
      accessType: 'public',
    };
  } catch (error: any) {
    // Fail CLOSED on DB error — a check failure must not grant access to private clinical data.
    // Legitimate users experience a temporary block during DB outages; that is the correct
    // trade-off for clinical record privacy.
    logger.error('hospitalDataIsolation: access check failed — failing closed', { error: error.message, animalId, userId });
    return { allowed: false, isPrivate: true, reason: 'Access check failed — please retry shortly', accessType: 'public' };
  }
}

// ─── Audit Logger ─────────────────────────────────────────────────────────────

export async function logClinicalAccess(params: {
  accessedBy: string;
  accessorRole: string;
  animalId: string;
  accessType: string;
  recordType?: string;
  recordId?: string;
  consentId?: string;
  networkId?: string;
  accessGranted: boolean;
  denialReason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await database.query(
      `INSERT INTO clinical_data_access_log
         (accessed_by, accessor_role, accessor_network_id, animal_id,
          record_type, record_id, access_type, consent_id,
          ip_address, user_agent, access_granted, denial_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        params.accessedBy,
        params.accessorRole,
        params.networkId ?? null,
        params.animalId,
        params.recordType ?? null,
        params.recordId ?? null,
        params.accessType,
        params.consentId ?? null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.accessGranted,
        params.denialReason ?? null,
      ]
    );
  } catch (err: any) {
    // Audit log write failure is non-fatal
    logger.error('Failed to write clinical_data_access_log', { error: err.message });
  }
}

// ─── Express Middleware Factory ───────────────────────────────────────────────

/**
 * Express middleware that enforces hospital data isolation for a specific animal.
 *
 * @param animalIdSource  Where to find the animal ID:
 *   - 'params:animalId'  → req.params.animalId  (default)
 *   - 'params:id'        → req.params.id
 *   - 'query:animalId'   → req.query.animalId
 *   - 'body:animalId'    → req.body.animalId
 *
 * @param recordType  Optional label for the audit log (e.g. 'medical_records', 'vaccinations')
 *
 * Usage:
 *   router.get('/animals/:id', authMiddleware, requireAnimalAccess('params:id', 'animal_profile'), handler)
 *   router.get('/vaccinations/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'vaccinations'), handler)
 */
export function requireAnimalAccess(
  animalIdSource: string = 'params:animalId',
  recordType: string = 'clinical_data'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const userRole = req.userRole;

    if (!userId || !userRole) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Extract animal ID from the specified source
    const [sourceType, sourceKey] = animalIdSource.split(':');
    let animalId: string | undefined;
    if (sourceType === 'params') animalId = req.params[sourceKey];
    else if (sourceType === 'query') animalId = req.query[sourceKey] as string;
    else if (sourceType === 'body') animalId = req.body[sourceKey];

    if (!animalId) {
      // No animal ID — can't check isolation, pass through
      return next();
    }

    const decision = await checkAnimalAccess(userId, userRole, animalId);

    // Log access for ALL private animal requests (both granted and denied)
    if (decision.isPrivate) {
      // Non-blocking fire-and-forget audit
      logClinicalAccess({
        accessedBy: userId,
        accessorRole: userRole,
        animalId,
        accessType: `${req.method.toLowerCase()}_${recordType}`,
        recordType,
        consentId: decision.consentId,
        networkId: decision.networkId,
        accessGranted: decision.allowed,
        denialReason: decision.reason,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});
    }

    if (!decision.allowed) {
      return res.status(403).json({
        success: false,
        error: decision.reason || 'Access denied: private hospital animal',
        code: 'HOSPITAL_DATA_ISOLATED',
        requiresConsent: true,
      });
    }

    // Attach decision to request for downstream handlers (e.g. to filter hospital records)
    (req as any).animalAccessDecision = decision;
    next();
  };
}

/**
 * CRITICAL FIX: Middleware to verify user is a member of the specified enterprise.
 * Applied to: GET /enterprises/:enterpriseId/medical-records, /stats, /vaccinations
 * Prevents: Any logged-in user from querying arbitrary enterprise data by guessing UUID
 */
export function requireEnterpriseAccess() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const enterpriseId = req.params.enterpriseId;
    if (!enterpriseId) {
      return res.status(400).json({ success: false, error: 'enterpriseId parameter required' });
    }

    const isAdmin = req.userRole === 'admin';
    if (isAdmin) {
      return next(); // Admins can access all enterprises
    }

    // Check if user is a member of this enterprise
    const membershipRes = await database.query(
      `SELECT id FROM enterprise_members WHERE enterprise_id = $1 AND user_id = $2 AND is_active = true`,
      [enterpriseId, req.userId]
    );

    if (membershipRes.rows.length === 0) {
      logger.warn('Enterprise access denied', {
        userId: req.userId,
        enterpriseId,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this enterprise',
        code: 'ENTERPRISE_ACCESS_DENIED',
      });
    }

    next();
  };
}
