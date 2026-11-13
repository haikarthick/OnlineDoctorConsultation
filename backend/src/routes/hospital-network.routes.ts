import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody, AuthRequest } from '../middleware/auth';
import { requireNetworkAccess, NetworkAccessRequest, resolveNetworkAccess } from '../middleware/networkAccess';
import { requireAnimalAccess } from '../middleware/hospitalDataIsolation';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import logger from '../utils/logger';
import { emitDataRefresh, emitRoleRefresh } from '../utils/socketIO';
import HospitalNetworkController from '../controllers/HospitalNetworkController';
import HospitalNetworkService, { updateBranchHospital, deleteBranchHospital, addApprovalEvent, getApprovalHistory, updateNetworkBranding, getNotificationPreferences, updateNotificationPreferences } from '../services/HospitalNetworkService';
import VetHospitalService from '../services/VetHospitalService';
import NetworkRolePermissionService from '../services/NetworkRolePermissionService';
import {
  createHospitalNetworkSchema, addNetworkMemberSchema, createPatientConsentSchema,
  createNetworkReferralSchema, createBranchHospitalSchema,
} from '../middleware/validation';

const router = Router();

// ─── Hospital Network routes ──────────────────────────────────
router.post('/hospital-networks', authMiddleware, roleMiddleware(['admin', 'corporate_admin']), validateBody(createHospitalNetworkSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createNetwork(req, res)));
router.get('/hospital-networks', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworks(req, res)));
router.get('/hospital-networks/:id', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.getNetwork(req, res)));
router.put('/hospital-networks/:id', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.updateNetwork(req, res)));
router.post('/hospital-networks/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await HospitalNetworkController.approveNetwork(req, res);
  // Also record the approval event (fire-and-forget so it doesn't affect response)
  addApprovalEvent(req.params.id, (req as any).userId, (req as any).userRole, 'approved', (req as any).body?.notes).catch(() => {});
}));
router.patch('/hospital-networks/:id/deactivate', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.deactivateNetwork(req, res)));

// P6-APPROVAL: approval workflow routes
router.post('/hospital-networks/:id/approval-events', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { eventType, notes } = req.body;
  if (!eventType) return res.status(400).json({ error: 'eventType is required' });
  const allowedTypes = ['submitted','under_review','info_requested','info_provided','approved','rejected','suspended','reactivated'];
  if (!allowedTypes.includes(eventType)) return res.status(400).json({ error: `eventType must be one of: ${allowedTypes.join(', ')}` });
  await addApprovalEvent(req.params.id, (req as any).userId, (req as any).userRole, eventType, notes);
  // If approve/reject/suspend/reactivate - also update the network status
  if (eventType === 'approved') {
    await database.query(
      `UPDATE hospital_networks SET is_approved = true, approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id, (req as any).userId]
    );
  } else if (eventType === 'rejected' || eventType === 'suspended') {
    await database.query(`UPDATE hospital_networks SET is_approved = false, is_active = false, updated_at = NOW() WHERE id = $1`, [req.params.id]);
  } else if (eventType === 'reactivated') {
    await database.query(`UPDATE hospital_networks SET is_approved = true, is_active = true, updated_at = NOW() WHERE id = $1`, [req.params.id]);
  }
  // Notify corporate_admin when info_requested
  if (eventType === 'info_requested') {
    const corpAdmins = await database.query(
      `SELECT user_id FROM hospital_network_members WHERE network_id = $1 AND network_role = 'corporate_admin' AND is_active = true`,
      [req.params.id]
    );
    const networkRes = await database.query(`SELECT name FROM hospital_networks WHERE id = $1`, [req.params.id]);
    const networkName = networkRes.rows[0]?.name ?? 'Your network';
    const NotificationService = (await import('../services/NotificationService')).default;
    for (const m of corpAdmins.rows) {
      await NotificationService.createNotification(
        m.user_id, 'network_info_requested',
        'Additional Information Required',
        `Platform admin has requested more information for ${networkName}${notes ? `: ${notes}` : '.'}`,
        'all'
      );
    }
  }
  res.json({ success: true, message: 'Approval event recorded' });
}));

router.get('/hospital-networks/:id/approval-history', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const role = (req as any).userRole;
  if (!['admin', 'corporate_admin', 'compliance_officer'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const history = await getApprovalHistory(req.params.id);
  res.json({ data: history });
}));

// P6-BRANDING
router.put('/hospital-networks/:id/branding', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'hospital-networks') } })
  const { logoUrl, contactEmail, contactPhone, websiteUrl, operatingHours, specializations, emergencyServices } = req.body;
  const updated = await updateNetworkBranding(req.params.id, { logoUrl, contactEmail, contactPhone, websiteUrl, operatingHours, specializations, emergencyServices });
  res.json({ success: true, data: updated });
}));

router.get('/hospital-networks/:id/public', asyncHandler(async (req: Request, res: Response) => {
  const result = await database.query(
    `SELECT id, name, logo_url AS "logoUrl", contact_email AS "contactEmail",
            website AS "website", website_url AS "websiteUrl", specializations,
            emergency_services AS "emergencyServices", headquarters_city AS "headquartersCity",
            headquarters_state AS "headquartersState", country
     FROM hospital_networks WHERE id = $1 AND is_active = true AND is_approved = true`,
    [req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Network not found' });
  res.json({ data: result.rows[0] });
}));

// P6-NOTIFICATIONS: notification preferences
router.get('/notification-preferences', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const prefs = await getNotificationPreferences((req as any).userId);
  res.json({ data: prefs });
}));

router.put('/notification-preferences', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { digestEmailsEnabled } = req.body;
  await updateNotificationPreferences((req as any).userId, { digestEmailsEnabled });
  res.json({ success: true, message: 'Notification preferences updated' });
}));
router.get('/hospital-networks/:id/hospitals', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworkHospitals(req, res)));
router.post('/hospital-networks/:id/hospitals/:hospitalId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.assignHospitalToNetwork(req, res)));
router.post('/hospital-networks/:id/branch-hospitals', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), validateBody(createBranchHospitalSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createBranchHospital(req, res)));
router.put('/hospital-networks/:id/branch-hospitals/:hospitalId', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const hospital = await updateBranchHospital(req.params.hospitalId, req.params.id, req.body);
  res.json({ success: true, data: hospital, message: 'Branch hospital updated' });
}));
router.delete('/hospital-networks/:id/branch-hospitals/:hospitalId', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  await deleteBranchHospital(req.params.hospitalId, req.params.id);
  res.json({ success: true, message: 'Branch hospital removed from network' });
}));
router.get('/hospital-networks/:id/members', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworkMembers(req, res)));
router.post('/hospital-networks/:id/members', authMiddleware, validateBody(addNetworkMemberSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.addNetworkMember(req, res)));
router.put('/hospital-networks/:id/members/:userId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('admin', 'hospital-networks'); emitRoleRefresh('corporate_admin', 'hospital-networks') } })
  const networkId = req.params.id;
  const targetUserId = req.params.userId;
  const userId = (req as any).userId;
  const { networkRole, hospitalId } = req.body;
  // Verify caller is corporate_admin, hospital_director, or platform admin
  const userRole = (req as any).userRole;
  if (userRole !== 'admin') {
    const memberCheck = await database.query(
      `SELECT network_role, hospital_id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
      [networkId, userId]
    );
    const callerNetworkRole = memberCheck.rows[0]?.network_role;
    // I-8: honor the admin-configurable editMemberRoles action instead of a hardcoded role list
    const canEditMembers = callerNetworkRole
      ? await NetworkRolePermissionService.checkAccess(networkId, callerNetworkRole, 'editMemberRoles')
      : false;
    if (!canEditMembers) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update members in this network' });
    }
    // H5: hospital_director scope - can only edit members in their own branch hospital
    if (memberCheck.rows[0].network_role === 'hospital_director') {
      const directorHospitalId = memberCheck.rows[0]?.hospital_id as string | undefined;
      const hospitalIdCheck = directorHospitalId || (await database.query(
        `SELECT hospital_id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
        [networkId, userId]
      )).rows[0]?.hospital_id;
      if (hospitalIdCheck) {
        const targetMember = await database.query(
          `SELECT hospital_id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2`,
          [networkId, targetUserId]
        );
        if (targetMember.rows[0]?.hospital_id !== hospitalIdCheck) {
          return res.status(403).json({ success: false, message: 'Hospital directors can only edit members within their own branch hospital.' });
        }
      }
      if (networkRole === 'corporate_admin') {
        return res.status(403).json({ success: false, message: 'Hospital directors cannot assign corporate_admin role.' });
      }
    }
  }
  const allowedRoles = ['corporate_admin', 'hospital_director', 'compliance_officer', 'auditor', 'hospital_staff'];
  if (networkRole && !allowedRoles.includes(networkRole)) {
    return res.status(400).json({ success: false, message: `Invalid network role. Allowed: ${allowedRoles.join(', ')}` });
  }
  const updates: string[] = [];
  const params: any[] = [networkId, targetUserId];
  let idx = 3;
  if (networkRole) { updates.push(`network_role = $${idx++}`); params.push(networkRole); }
  if (hospitalId !== undefined) { updates.push(`hospital_id = $${idx++}`); params.push(hospitalId || null); }
  if (req.body.department !== undefined) { updates.push(`department = $${idx++}`); params.push(req.body.department || null); }
  if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
  await database.query(`UPDATE hospital_network_members SET ${updates.join(', ')} WHERE network_id = $1 AND user_id = $2`, params);
  res.json({ success: true, message: 'Member updated successfully' });
}));
router.delete('/hospital-networks/:id/members/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.removeNetworkMember(req, res)));

// Candidate users for network membership.
//
// Scope: people already attached to one of THIS network's branch hospitals - as a doctor
// (hospital_doctors) or as staff (staff_positions) - who are not already active members.
// It is deliberately NOT a platform-wide user directory. The route this replaces
// (GET /network-user-search) selected `FROM users WHERE role NOT IN ('pet_owner','farmer')`
// with no network scoping at all and no network id in the request, so any corporate_admin
// or hospital_director of ANY network could enumerate the name, email and role of every
// professional account on the platform two characters at a time, and users who were already
// members still appeared in the picker (then collided with UNIQUE(network_id, user_id)).
//
// An empty `q` returns the whole candidate list rather than nothing: the set is bounded by
// the network's own hospitals, so it is safe to show before the admin types. Someone with no
// prior attachment to a branch hospital is onboarded through POST /:id/invite-staff instead.
router.get('/hospital-networks/:id/user-search', authMiddleware, requireNetworkAccess('addRemoveMembers'), asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  // hospital_director / hospital_staff are branch-scoped, so they only see their own branch,
  // exactly as getNetworkPatients does with the same field.
  const branchScopeHospitalId = (req as NetworkAccessRequest).branchScopeHospitalId ?? null;
  const search = ((req.query.q as string) || '').trim();

  // Built positionally rather than with hardcoded $n offsets - the clauses are optional.
  const params: any[] = [networkId];
  let idx = 2;

  let branchClause = '';
  if (branchScopeHospitalId) {
    branchClause = `AND hnh.hospital_id = $${idx++}`;
    params.push(branchScopeHospitalId);
  }

  let searchClause = '';
  if (search.length > 0) {
    searchClause = `AND (u.email ILIKE $${idx} OR u.first_name ILIKE $${idx}
                         OR u.last_name ILIKE $${idx}
                         OR (u.first_name || ' ' || u.last_name) ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  try {
    const result = await database.query(
      `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.role
         FROM users u
        WHERE u.is_active = true
          AND EXISTS (
            SELECT 1
              FROM hospital_network_hospitals hnh
             WHERE hnh.network_id = $1
               AND hnh.is_active = true
               ${branchClause}
               AND (
                 EXISTS (SELECT 1 FROM hospital_doctors hd
                          WHERE hd.hospital_id = hnh.hospital_id
                            AND hd.doctor_id = u.id AND hd.is_active = true)
                 OR EXISTS (SELECT 1 FROM staff_positions sp
                             WHERE sp.hospital_id = hnh.hospital_id
                               AND sp.user_id = u.id AND sp.is_active = true)
               )
          )
          AND NOT EXISTS (
            SELECT 1 FROM hospital_network_members m
             WHERE m.network_id = $1 AND m.user_id = u.id AND m.is_active = true
          )
          ${searchClause}
        ORDER BY u.first_name, u.last_name
        LIMIT 50`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Network candidate search failed', { error: err.message, networkId });
    res.status(500).json({ success: false, message: 'Search failed' });
  }
}));

router.get('/hospital-networks/:id/departments', authMiddleware, requireNetworkAccess('viewNetworkDetails'), asyncHandler(async (req: Request, res: Response) => {
  const custom = await database.query(
    `SELECT DISTINCT department FROM hospital_network_members 
     WHERE network_id = $1 AND department IS NOT NULL`,
    [req.params.id]
  );
  const predefined = ['Reception', 'Emergency', 'Surgery', 'Pharmacy', 'Laboratory', 'Radiology', 'ICU', 'General Practice', 'Cardiology', 'Orthopedics'];
  const existing = custom.rows.map((r: any) => r.department);
  const all = [...new Set([...predefined, ...existing])].sort();
  res.json({ success: true, data: all });
}));
router.get('/hospital-networks/:id/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.getNetworkDashboard(req, res)));
router.get('/hospital-networks/:id/audit-logs', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.getAuditLogs(req, res)));

// Network Security Audit Log
// viewAuditLogs is true for exactly corporate_admin / hospital_director /
// compliance_officer / auditor and false for hospital_staff, so this reproduces
// the previous hardcoded list precisely while gaining the expiry check.
router.get('/hospital-networks/:id/security-audit', authMiddleware, requireNetworkAccess('viewAuditLogs'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await database.query(
      `SELECT nsa.id, nsa.action, nsa.target_type AS "targetType", nsa.target_id AS "targetId",
              nsa.old_value AS "oldValue", nsa.new_value AS "newValue", nsa.ip_address AS "ipAddress",
              nsa.created_at AS "createdAt",
              u.first_name || ' ' || u.last_name AS "actorName"
       FROM network_security_audit nsa
       JOIN users u ON u.id = nsa.actor_id
       WHERE nsa.network_id = $1
       ORDER BY nsa.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// PLATFORM-WIDE user search. Its only remaining caller is /admin/staff-settings, which is
// admin-only (Navigation.tsx roles: ['admin']) and legitimately needs to attach ANY user to
// ANY hospital as a staff position.
//
// Gate narrowed to platform admin. It previously also admitted anyone holding
// corporate_admin/hospital_director in ANY network, which - because the route takes no
// network id and applies no network filter - let a network admin enumerate every
// professional account on the platform. Network-scoped member picking now lives at
// GET /hospital-networks/:id/user-search. Do NOT widen this gate again: the check here
// cannot be network-scoped, because there is no network in the request to scope to.
router.get('/network-user-search', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const search = ((req.query.q as string) || '').trim();
  if (!search || search.length < 2) { res.json({ success: true, data: [] }); return; }
  try {
    const result = await database.query(
      `SELECT id, first_name as "firstName", last_name as "lastName", email, role
       FROM users
       WHERE is_active = true
         AND role NOT IN ('pet_owner', 'farmer')
         AND (
           email ILIKE $1
           OR first_name ILIKE $1
           OR last_name ILIKE $1
           OR (first_name || ' ' || last_name) ILIKE $1
         )
       ORDER BY first_name, last_name
       LIMIT 20`,
      [`%${search}%`]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Network user search failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Search failed' });
  }
}));

// Enroll animal into a network (generates per-network patient ID)
router.post('/hospital-networks/:id/enroll-animal', authMiddleware, requireNetworkAccess('enrollPatient'), asyncHandler(async (req: Request, res: Response) => {
  const { animalId, hospitalId, notes } = req.body;
  if (!animalId) { res.status(400).json({ success: false, message: 'animalId is required' }); return; }
  const result = await HospitalNetworkService.enrollAnimal({
    animalId,
    networkId: req.params.id,
    hospitalId,
    enrolledBy: (req as any).userId,
    notes,
  });
  res.json(result);
}));

// List patients enrolled in a network
// I-1: now gated by membership + viewEnrolledPatients action, with branch-level row scoping
router.get('/hospital-networks/:id/patients', authMiddleware, requireNetworkAccess('viewEnrolledPatients'), asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const branchScopeHospitalId = (req as NetworkAccessRequest).branchScopeHospitalId ?? null;
  const result = await HospitalNetworkService.getNetworkPatients(req.params.id, limit, offset, branchScopeHospitalId);
  res.json(result);
}));

// Get all care contexts (network enrollments) for an animal
router.get('/animals/:animalId/care-contexts', authMiddleware, requireAnimalAccess('params:animalId', 'care_contexts'), asyncHandler(async (req: Request, res: Response) => {
  const result = await database.query(
    `SELECT acc.id, acc.network_id AS "networkId", acc.corporate_patient_id AS "networkPatientId",
            acc.platform_unique_id AS "platformUniqueId", acc.enrolled_at AS "enrolledAt",
            acc.visibility, hn.name AS "networkName", hn.id_prefix AS "networkPrefix"
     FROM animal_care_contexts acc
     JOIN hospital_networks hn ON acc.network_id = hn.id
     WHERE acc.animal_id = $1 AND acc.is_active = true
     ORDER BY acc.enrolled_at DESC`,
    [req.params.animalId]
  );
  res.json({ success: true, data: result.rows });
}));

// P4-MED2: Unified referral history for an animal (merges platform referrals + network referrals)
router.get('/animals/:animalId/referrals', authMiddleware, requireAnimalAccess('params:animalId', 'referrals'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const animalId = req.params.animalId;

    const platformRes = await database.query(
      `SELECT r.id, 'platform' AS type,
              fv.first_name || ' ' || fv.last_name AS "fromVetName",
              tv.first_name || ' ' || tv.last_name AS "toVetName",
              NULL::TEXT AS "toHospitalName",
              r.reason, r.status, r.priority,
              r.created_at AS "createdAt",
              r.network_referral_id AS "networkReferralId",
              NULL::UUID AS "platformReferralId"
       FROM referrals r
       LEFT JOIN users fv ON r.from_vet_id = fv.id
       LEFT JOIN users tv ON r.to_vet_id = tv.id
       WHERE r.animal_id = $1
       ORDER BY r.created_at DESC`,
      [animalId]
    );

    const networkRes = await database.query(
      `SELECT nr.id, 'network' AS type,
              fv.first_name || ' ' || fv.last_name AS "fromVetName",
              tv.first_name || ' ' || tv.last_name AS "toVetName",
              th.name AS "toHospitalName",
              nr.reason, nr.status, nr.priority,
              nr.created_at AS "createdAt",
              NULL::UUID AS "networkReferralId",
              nr.platform_referral_id AS "platformReferralId"
       FROM network_referrals nr
       LEFT JOIN users fv ON nr.from_vet_id = fv.id
       LEFT JOIN users tv ON nr.to_vet_id = tv.id
       LEFT JOIN vet_hospitals th ON nr.to_hospital_id = th.id
       WHERE nr.animal_id = $1
       ORDER BY nr.created_at DESC`,
      [animalId]
    );

    const referrals = [...platformRes.rows, ...networkRes.rows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, data: { referrals, total: referrals.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// Get all care contexts

// Patient consent routes
router.post('/patient-consent', authMiddleware, validateBody(createPatientConsentSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createConsent(req, res)));
router.get('/patient-consent/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listConsents(req, res)));
router.delete('/patient-consent/:consentId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.revokeConsent(req, res)));

// Consent search endpoints (search-and-select dropdowns)
router.get('/consent/search-doctors', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  try {
    const filter = q.length >= 1 ? `%${q}%` : '%';
    const result = await database.query(
      `SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email,
              COALESCE(vp.specializations[1], '') AS specialization
       FROM users u
       LEFT JOIN vet_profiles vp ON vp.user_id = u.id
       WHERE u.role = 'veterinarian' AND u.is_active = true
         AND (
           u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.email ILIKE $1
           OR (u.first_name || ' ' || u.last_name) ILIKE $1
         )
       ORDER BY u.first_name, u.last_name
       LIMIT 20`,
      [filter]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Consent doctor search failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Search failed' });
  }
}));

router.get('/consent/search-hospitals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  try {
    const filter = q.length >= 1 ? `%${q}%` : '%';
    const result = await database.query(
      `SELECT id, name, city, state
       FROM vet_hospitals
       WHERE verification_status = 'approved'
         AND (is_network_branch = false OR is_network_branch IS NULL)
         AND (name ILIKE $1 OR city ILIKE $1)
       ORDER BY name
       LIMIT 20`,
      [filter]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Consent hospital search failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Search failed' });
  }
}));

router.get('/consent/search-networks', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  try {
    const filter = q.length >= 1 ? `%${q}%` : '%';
    const result = await database.query(
      `SELECT id, name, network_type AS "networkType", id_prefix AS "idPrefix"
       FROM hospital_networks
       WHERE is_approved = true AND (name ILIKE $1)
       ORDER BY name
       LIMIT 20`,
      [filter]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Consent network search failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Search failed' });
  }
}));

// Network Referrals
router.get('/network-referrals', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworkReferrals(req, res)));
router.post('/network-referrals', authMiddleware, validateBody(createNetworkReferralSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createNetworkReferral(req, res)));
router.patch('/network-referrals/:id/status', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.updateNetworkReferralStatus(req, res)));

// ─── Privacy-first patient enrollment routes ───────────────────
// Search existing platform patients (for hospital staff)
router.get('/hospital-networks/:id/search-patients', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userRole = (req as AuthRequest).userRole;
    if (!['admin', 'veterinarian', 'hospital_staff', 'corporate_admin', 'compliance_officer'].includes(userRole || '')) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    const networkId = req.params.id;
    const q = (req.query.q as string) ?? '';
    if (!q || q.length < 2) { res.json([]); return; }

    // C5: scope results to user's assigned hospital for non-admin roles
    let userHospitalId: string | null = null;
    if (!['admin', 'corporate_admin'].includes(userRole || '')) {
      const memberCheck = await database.query(
        `SELECT hospital_id FROM hospital_network_members 
         WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
        [networkId, (req as AuthRequest).userId]
      );
      userHospitalId = memberCheck.rows[0]?.hospital_id || null;
    }

    const results = await HospitalNetworkService.searchNetworkPatients(networkId, q, 20, userHospitalId);
    res.json(results);
  } catch (err: any) {
    logger.error('Route error', { path: req.path, error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}));

// P5-ANALYTICS: Network analytics dashboard
router.get('/hospital-networks/:id/analytics', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const networkId = req.params.id;
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    // Was a hardcoded role list that included auditor, whose networkDashboardStats
    // matrix default is actually false - now honors the configurable matrix.
    const access = await resolveNetworkAccess(networkId, userId, userRole, 'networkDashboardStats');
    if (!access.allowed) {
      res.status(access.reason === 'not_member' ? 404 : 403).json({ success: false, message: 'Access denied' });
      return;
    }
    const analytics = await HospitalNetworkService.getNetworkAnalytics(networkId);
    const trend = await HospitalNetworkService.getPatientEnrollmentTrend(networkId);
    res.json({ success: true, data: { ...analytics, enrollmentTrend: trend } });
  } catch (err: any) {
    logger.error('Analytics route error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}));

// P5-COMPLIANCE-EXPORT: Compliance report
router.get('/hospital-networks/:id/compliance-report', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const networkId = req.params.id;
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      res.status(400).json({ success: false, message: 'from and to date params are required' });
      return;
    }
    // Matches matrix defaults exactly (hospital_director=false, others=true) - converted
    // to the matrix-driven check for consistency with the rest of this route family.
    const access = await resolveNetworkAccess(networkId, userId, userRole, 'exportComplianceReport');
    if (!access.allowed) {
      res.status(access.reason === 'not_member' ? 404 : 403).json({ success: false, message: 'Access denied' });
      return;
    }
    const report = await HospitalNetworkService.generateComplianceReport(networkId, from, to);
    res.json({ success: true, data: report });
  } catch (err: any) {
    logger.error('Compliance report error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}));

// Get all enrollments for a network (pending + active + declined)
// I-2: now gated by membership + viewEnrolledPatients action
router.get('/hospital-networks/:id/all-enrollments', authMiddleware, requireNetworkAccess('viewEnrolledPatients'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const results = await HospitalNetworkService.getPendingEnrollments(req.params.id);
    res.json(results);
  } catch (err: any) {
    logger.error('Route error', { path: req.path, error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}));

// Invite a walk-in patient (no platform account)
router.post('/hospital-networks/:id/invite-walkin', authMiddleware, requireNetworkAccess('walkInRegistration'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { patientName, patientEmail, patientPhone, animalName, animalSpecies, hospitalId, message } = req.body;
    if (!patientName || !patientEmail) { res.status(400).json({ success: false, error: 'patientName and patientEmail are required' }); return; }
    const result = await HospitalNetworkService.inviteWalkInPatient({
      networkId: req.params.id, hospitalId, patientName, patientEmail,
      patientPhone, animalName, animalSpecies, message,
    }, userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Route error', { path: req.path, error: err.message });
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}));

// Direct walk-in patient registration - no invite needed, treatment starts immediately
router.post('/hospital-networks/:id/register-walkin', authMiddleware, requireNetworkAccess('walkInRegistration'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { hospitalId, patientName, patientPhone, patientEmail, patientAddress, animalName, animalSpecies, animalBreed, animalGender, animalClass, animalDob, animalWeight, animalColor, animalMicrochipId, animalRegistrationNumber, animalIsNeutered, animalMedicalNotes, animalAvatarUrl, animalInsuranceProvider, animalInsurancePolicyNumber, animalInsuranceExpiry, animalEarTagId, reasonForVisit, consentCollected, consentMethod } = req.body;
    if (!patientName || !animalName || !animalSpecies || !hospitalId) {
      res.status(400).json({ success: false, message: 'patientName, animalName, animalSpecies, and hospitalId are required' }); return;
    }

    // H3: Duplicate detection - microchip ID
    if (animalMicrochipId) {
      const existing = await database.query(
        `SELECT a.id, a.name, a.species, u.email as "ownerEmail"
         FROM animals a
         JOIN users u ON u.id = a.owner_id
         WHERE a.microchip_id = $1`,
        [animalMicrochipId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate detected',
          existing: existing.rows[0],
          message: `An animal with microchip ID '${animalMicrochipId}' already exists. Please search for existing patient or update their record.`,
        });
      }
    }

    // H3: Duplicate detection - name + species + owner phone (fuzzy match)
    if (animalName && patientPhone) {
      const fuzzy = await database.query(
        `SELECT a.id, a.name, a.species, u.first_name || ' ' || u.last_name as "ownerName", u.email as "ownerEmail"
         FROM animals a
         JOIN users u ON u.id = a.owner_id
         WHERE LOWER(a.name) = LOWER($1) AND LOWER(a.species) = LOWER($2) AND u.phone = $3`,
        [animalName, animalSpecies || '', patientPhone]
      );
      if (fuzzy.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Possible duplicate detected',
          existing: fuzzy.rows[0],
          message: `An animal with the same name, species, and owner phone number already exists. Please confirm this is a different animal or search for existing patient.`,
          isDuplicateWarning: true,
        });
      }
    }

    const result = await HospitalNetworkService.registerWalkInPatientDirect({
      networkId: req.params.id, hospitalId, registeredBy: (req as any).userId,
      patientName, patientPhone, patientEmail, patientAddress, animalName, animalSpecies, animalBreed,
      animalGender, animalClass, animalDob, animalWeight: animalWeight ? parseFloat(animalWeight) : undefined,
      animalColor, animalMicrochipId, animalRegistrationNumber,
      animalIsNeutered: animalIsNeutered === true || animalIsNeutered === 'true',
      animalMedicalNotes, animalAvatarUrl, animalInsuranceProvider, animalInsurancePolicyNumber, animalInsuranceExpiry, animalEarTagId, reasonForVisit,
      consentCollected: consentCollected === true || consentCollected === 'true',
      consentMethod: consentMethod || 'verbal',
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Route error', { path: req.path, error: err.message });
    const status = err.message?.includes('permission') || err.message?.includes('Forbidden') ? 403 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
}));

// Walk-in registration for standalone (non-network) hospitals
router.post('/hospitals/:hospitalId/register-walkin', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const hospRes = await database.query(`SELECT is_network_branch FROM vet_hospitals WHERE id = $1`, [req.params.hospitalId]);
    if (!hospRes.rows[0]) { res.status(404).json({ success: false, message: 'Hospital not found' }); return; }
    if (hospRes.rows[0].is_network_branch) {
      res.status(400).json({ success: false, message: 'Network hospitals register walk-ins through their own hospital-network workflow.' }); return;
    }
    if ((req as any).userRole !== 'admin') {
      const memberRole = await VetHospitalService.getMemberRole(req.params.hospitalId, (req as any).userId);
      if (!memberRole) { res.status(403).json({ success: false, message: 'You are not a member of this hospital' }); return; }
    }
    const { patientName, patientPhone, patientEmail, patientAddress, animalName, animalSpecies, animalBreed, animalGender, animalClass, animalDob, animalWeight, animalColor, animalMicrochipId, animalRegistrationNumber, animalIsNeutered, animalMedicalNotes, animalAvatarUrl, animalInsuranceProvider, animalInsurancePolicyNumber, animalInsuranceExpiry, animalEarTagId } = req.body;
    if (!patientName || !animalName || !animalSpecies) {
      res.status(400).json({ success: false, message: 'patientName, animalName, and animalSpecies are required' }); return;
    }
    const result = await VetHospitalService.registerWalkInStandalone({
      hospitalId: req.params.hospitalId,
      registeredBy: (req as any).userId,
      patientName, patientPhone, patientEmail, patientAddress, animalName, animalSpecies, animalBreed,
      animalGender, animalClass, animalDob, animalWeight: animalWeight ? parseFloat(animalWeight) : undefined,
      animalColor, animalMicrochipId, animalRegistrationNumber,
      animalIsNeutered: animalIsNeutered === true || animalIsNeutered === 'true',
      animalMedicalNotes, animalAvatarUrl, animalInsuranceProvider, animalInsurancePolicyNumber, animalInsuranceExpiry, animalEarTagId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Route error', { path: req.path, error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}));

// Patient accepts enrollment request (CONSENT-BEFORE-ACCESS)
router.post('/hospital-networks/enrollments/:contextId/accept', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { consentScope } = req.body;
    await HospitalNetworkService.acceptEnrollment(req.params.contextId, (req as any).userId, consentScope);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}));

// Accept a walk-in patient invite by token (Fix 6)
router.post('/hospital-networks/walkin-invites/accept', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ success: false, message: 'token is required' }); return; }
    const result = await HospitalNetworkService.acceptWalkInInvite(token, (req as any).userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}));

// Patient declines enrollment request
router.post('/hospital-networks/enrollments/:contextId/decline', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    await HospitalNetworkService.declineEnrollment(req.params.contextId, (req as any).userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}));

// Patient views all their network enrollments
router.get('/my-network-enrollments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const results = await HospitalNetworkService.getMyEnrollments((req as any).userId);
    res.json(results);
  } catch (err: any) {
    logger.error('Route error', { path: req.path, error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}));



export default router;
