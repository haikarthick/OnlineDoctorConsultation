import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import logger from '../utils/logger';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { requireNetworkAccess, NetworkAccessRequest, resolveNetworkAccess } from '../middleware/networkAccess';
import pharmacyRoutes from './pharmacy.routes';
import groomingRoutes from './grooming.routes';
import coreClinicalRoutes from './core-clinical.routes';
import enterpriseFarmRoutes from './enterprise-farm.routes';
import medicalRecordsRoutes from './medical-records.routes';
import paymentsAndReviewsRoutes from './payments-and-reviews.routes';
import adminAndPermissionsRoutes from './admin-and-permissions.routes';
import marketplaceRoutes from './marketplace.routes';
import catalogAndRolesRoutes from './catalog-and-roles.routes';
import pricingVisibilityRoutes from './pricing-visibility.routes';
import database from '../utils/database';
import cacheManager from '../utils/cacheManager';
import {
  // Auth
  registerSchema, loginSchema, refreshTokenSchema, logoutSchema,
  // Consultation
  createConsultationSchema, updateConsultationSchema,
  // Booking
  createBookingSchema, rescheduleBookingSchema, cancelBookingSchema,
  // Video
  createVideoSessionSchema, endVideoSessionSchema, sendVideoMessageSchema,
  // Schedule
  createScheduleSchema, updateScheduleSchema,
  // Prescription
  createPrescriptionSchema,
  // Animal
  createAnimalSchema, updateAnimalSchema,
  // Vet Profile
  createVetProfileSchema, updateVetProfileSchema,
  // Medical Record
  createMedicalRecordSchema, updateMedicalRecordSchema, deleteMedicalRecordSchema,
  // Vaccination
  createVaccinationSchema, updateVaccinationSchema,
  // Weight / Allergy / Lab
  addWeightSchema, createAllergySchema, updateAllergySchema, createLabResultSchema, updateLabResultSchema,
  // Payment / Review
  createPaymentSchema, createReviewSchema,
  checkoutPaymentSchema, verifyPaymentSchema, legalAcceptSchema, adminLegalDocSchema, razorpayCredentialsSchema,
  createPlatformReferralSchema, acceptReferralSchema, declineReferralSchema,
  // Admin
  toggleUserStatusSchema, changeUserRoleSchema, processRefundSchema, moderateReviewSchema, updateSystemSettingSchema,
  updatePermissionSchema, bulkUpdatePermissionsSchema, resetPermissionsSchema,
  updateNetworkRolePermissionSchema, resetNetworkRolePermissionsSchema,
  // Enterprise
  createEnterpriseSchema, updateEnterpriseSchema, addMemberSchema, updateMemberSchema,
  createAnimalGroupSchema, updateAnimalGroupSchema, assignAnimalToGroupSchema,
  createLocationSchema, updateLocationSchema, createMovementSchema,
  createCampaignSchema, updateCampaignSchema,
  // Tier 2
  createObservationSchema, resolveObservationSchema,
  createBreedingRecordSchema, updateBreedingRecordSchema,
  createFeedSchema, updateFeedSchema, restockFeedSchema, logFeedConsumptionSchema,
  createComplianceDocSchema, updateComplianceDocSchema,
  createFinancialRecordSchema, updateFinancialRecordSchema,
  createAlertRuleSchema, updateAlertRuleSchema, toggleAlertRuleSchema,
  // Tier 3
  createPredictionSchema, resolvePredictionSchema, createOutbreakZoneSchema,
  createGeneticProfileSchema, updateGeneticProfileSchema, createPairRecommendationSchema,
  createSensorSchema, updateSensorSchema, recordSensorReadingSchema,
  createBatchSchema, updateBatchSchema, createTraceabilityEventSchema, generateQRCodeSchema,
  createTaskSchema, updateTaskSchema, createShiftSchema, updateShiftSchema,
  createReportTemplateSchema, updateReportTemplateSchema, generateReportSchema,
  // Tier 4
  createChatSessionSchema, sendChatMessageSchema, checkDrugInteractionsSchema, analyzeSymptomsSchema,
  createDigitalTwinSchema, updateDigitalTwinSchema, runSimulationSchema,
  createMarketplaceListingSchema, updateMarketplaceListingSchema, placeBidSchema, createMarketplaceOrderSchema, updateOrderStatusSchema,
  confirmDealSchema, cancelDealSchema,
  startThreadSchema, sendMessageSchema, createSavedSearchSchema, updateSavedSearchSchema,
  reportListingSchema, resolveReportSchema,
  updateMonetizationSettingSchema, createMarketplacePlanSchema as createMPlanSchema, updateMarketplacePlanSchema as updateMPlanSchema,
  boostListingSchema, createInquirySchema, respondInquirySchema, createSubscriptionSchema,
  createSustainabilityMetricSchema, updateSustainabilityMetricSchema, createSustainabilityGoalSchema, updateSustainabilityGoalSchema,
  createWellnessScorecardSchema, updateWellnessScorecardSchema, createWellnessReminderSchema, snoozeReminderSchema,
  createGeofenceZoneSchema, updateGeofenceZoneSchema, createGeospatialEventSchema,
  // Vet Hospital
  createHospitalSchema, updateHospitalSchema, addHospitalDoctorSchema, updateHospitalDoctorSchema,
  createDepartmentSchema, updateDepartmentSchema,
  createHospitalServiceSchema, updateHospitalServiceSchema, verifyHospitalSchema,
  // Hospital Documents
  uploadHospitalDocSchema, reviewHospitalDocSchema,
  // Hospital Network
  createHospitalNetworkSchema, addNetworkMemberSchema, createPatientConsentSchema,
  createNetworkReferralSchema, createBranchHospitalSchema,
  // Role Change Requests
  roleChangeRequestSchema, rejectRoleChangeSchema,
  // Network Subscriptions + Staff Invites
  createNetworkPlanSchema, updateNetworkPlanSchema,
  setNetworkSubscriptionSchema, overrideSeatLimitSchema,
  suspendNetworkSchema, updatePricingSettingsSchema,
  inviteHospitalStaffSchema, acceptStaffInviteSchema,
  // Password Reset
  forgotPasswordSchema, resetPasswordSchema,
  // Master Data
  createMasterSpeciesSchema, updateMasterSpeciesSchema,
  createMasterBreedSchema, updateMasterBreedSchema,
  createMasterAnimalClassSchema, updateMasterAnimalClassSchema,
  createMasterMarketplaceCategorySchema, updateMasterMarketplaceCategorySchema,
  createMasterMarketplaceConditionSchema, updateMasterMarketplaceConditionSchema,
} from '../middleware/validation';
import { requireFeature, getAllFeatureFlags } from '../config/featureFlags';
import AuthController from '../controllers/AuthController';
import ConsultationController from '../controllers/ConsultationController';
import AnimalController from '../controllers/AnimalController';
import VetProfileController from '../controllers/VetProfileController';
import MedicalRecordController from '../controllers/MedicalRecordController';
import NotificationController from '../controllers/NotificationController';
import PaymentController from '../controllers/PaymentController';
import ReviewController from '../controllers/ReviewController';
import BookingController from '../controllers/BookingController';
import VideoSessionController from '../controllers/VideoSessionController';
import ScheduleController from '../controllers/ScheduleController';
import PrescriptionController from '../controllers/PrescriptionController';
import CertificateController from '../controllers/CertificateController';
import AdminController from '../controllers/AdminController';
import EnterpriseController from '../controllers/EnterpriseController';
import Tier2Controller from '../controllers/Tier2Controller';
import Tier3Controller from '../controllers/Tier3Controller';
import Tier4Controller from '../controllers/Tier4Controller';
import VetHospitalController from '../controllers/VetHospitalController';
import HospitalDocumentController from '../controllers/HospitalDocumentController';
import HospitalNetworkController from '../controllers/HospitalNetworkController';
import HospitalNetworkService, { updateBranchHospital, deleteBranchHospital, addApprovalEvent, getApprovalHistory, updateNetworkBranding, getNotificationPreferences, updateNotificationPreferences } from '../services/HospitalNetworkService';
import VetHospitalService from '../services/VetHospitalService';
import WalletController from '../controllers/WalletController';
import WalletWithdrawalService from '../services/WalletWithdrawalService';
import StaffWorkflowController from '../controllers/StaffWorkflowController';
import { FileController } from '../controllers/FileController';
import { uploadAny, uploadImage, uploadVideo } from '../middleware/upload';
import AdminService from '../services/AdminService';
import PermissionService from '../services/PermissionService';
import NetworkRolePermissionService from '../services/NetworkRolePermissionService';
import VetProfileService from '../services/VetProfileService';
import UserService from '../services/UserService';
import VaccineProtocolService from '../services/VaccineProtocolService';
import MasterDataService from '../services/MasterDataService';
import VaccineScheduleService from '../services/VaccineScheduleService';
import { asyncHandler } from '../utils/errorHandler';
import BatchManagementService from '../services/BatchManagementService';
import { AuthRequest } from '../middleware/auth';
import { checkAnimalAccess, requireAnimalAccess, requireEnterpriseAccess } from '../middleware/hospitalDataIsolation';
import emailService from '../services/EmailService';
import { emitDataRefresh, emitRoleRefresh, emitBroadcastRefresh } from '../utils/socketIO'

const router = Router();

router.use(coreClinicalRoutes);
router.use(enterpriseFarmRoutes);
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


router.use(medicalRecordsRoutes);
router.use(paymentsAndReviewsRoutes);
router.use(adminAndPermissionsRoutes);
// ─── Network Role Permissions (admin-configurable, per-network) ───────────────
router.get('/admin/network-role-permissions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { networkId } = req.query;
  if (!networkId || typeof networkId !== 'string') {
    return res.status(400).json({ success: false, error: 'networkId query parameter is required' });
  }
  const matrix = await NetworkRolePermissionService.getMatrix(networkId);
  const metadata = NetworkRolePermissionService.getMetadata();
  res.json({ success: true, data: { matrix, metadata } });
}));

router.put('/admin/network-role-permissions', authMiddleware, roleMiddleware(['admin']), validateBody(updateNetworkRolePermissionSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { networkId, networkRole, action, isEnabled } = req.body;
  await NetworkRolePermissionService.updatePermission(networkId, networkRole, action, isEnabled, authReq.userId!);
  res.json({ success: true, message: `Network permission '${action}' for '${networkRole}' set to ${isEnabled}` });
}));

router.post('/admin/network-role-permissions/reset', authMiddleware, roleMiddleware(['admin']), validateBody(resetNetworkRolePermissionsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { networkId, networkRole } = req.body;
  await NetworkRolePermissionService.resetToDefaults(networkId, networkRole);
  const matrix = await NetworkRolePermissionService.getMatrix(networkId);
  res.json({ success: true, data: { matrix }, message: networkRole ? `Network permissions reset for ${networkRole}` : 'All network role permissions reset to defaults' });
}));

// ─── Network Custom Roles CRUD ─────────────────────────────────────────────────

// viewNetworkDetails is held by all five network roles, so this preserves the
// previous "any active member" behaviour exactly while picking up the expiry
// check, the admin-configurable matrix and the 404-for-non-members that the
// hand-rolled query did not have.
router.get('/hospital-networks/:id/roles', authMiddleware, requireNetworkAccess('viewNetworkDetails'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const roles = await NetworkRolePermissionService.getNetworkRoles(req.params.id);
    res.json({ success: true, data: roles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// BEHAVIOUR CHANGE: the hand-rolled check admitted hospital_director, but the
// permission matrix sets manageRolePermissions=false for that role. Creating a
// custom role IS managing role permissions, so the inline list was granting a
// capability the declared matrix denies. Deferring to the matrix removes that
// escalation; a network that genuinely wants directors to manage roles can now
// grant it there, which the hardcoded list never allowed.
router.post('/hospital-networks/:id/roles', authMiddleware, requireNetworkAccess('manageRolePermissions'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { roleKey, displayName, description, baseTemplate, icon } = req.body;
    if (!roleKey || !displayName || !baseTemplate) {
      res.status(400).json({ success: false, error: 'roleKey, displayName, and baseTemplate are required' }); return;
    }
    const result = await NetworkRolePermissionService.createCustomRole(req.params.id, {
      roleKey, displayName, description, baseTemplate, icon, createdBy: userId,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.message.includes('reserved') || err.message.includes('unique') ? 400 : 500)
       .json({ success: false, error: err.message });
  }
}));

// Same matrix deferral as the create route above - see the note there.
router.put('/hospital-networks/:id/roles/:roleKey', authMiddleware, requireNetworkAccess('manageRolePermissions'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { displayName, description, baseTemplate, icon } = req.body;
    await NetworkRolePermissionService.updateCustomRole(req.params.id, req.params.roleKey, {
      displayName, description, baseTemplate, icon, updatedBy: userId,
    });
    res.json({ success: true, message: 'Custom role updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// corporate_admin is the only role with manageRolePermissions, so this matches
// the previous hardcoded list exactly.
router.delete('/hospital-networks/:id/roles/:roleKey', authMiddleware, requireNetworkAccess('manageRolePermissions'), asyncHandler(async (req: Request, res: Response) => {
  try {
    await NetworkRolePermissionService.deactivateCustomRole(req.params.id, req.params.roleKey);
    res.json({ success: true, message: 'Custom role deactivated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// ═══════════════════════════════════════════════════════════════
// ─── Health Analytics ────────────────────────────────
router.get('/enterprises/:enterpriseId/health/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getHealthDashboard(req, res)));
router.get('/enterprises/:enterpriseId/health/observations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listObservations(req, res)));
router.post('/enterprises/:enterpriseId/health/observations', authMiddleware, validateBody(createObservationSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createObservation(req, res)));
router.patch('/health/observations/:id/resolve', authMiddleware, validateBody(resolveObservationSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.resolveObservation(req, res)));

// ─── Enterprise / Herd Medical Management ────────────
// CRITICAL FIX: Added requireEnterpriseAccess to prevent data exposure by arbitrary enterpriseId
router.get('/enterprises/:enterpriseId/medical-records', authMiddleware, requireEnterpriseAccess(), asyncHandler((req: Request, res: Response) => MedicalRecordController.listEnterpriseRecords(req, res)));
router.get('/enterprises/:enterpriseId/medical-records/stats', authMiddleware, requireEnterpriseAccess(), asyncHandler((req: Request, res: Response) => MedicalRecordController.getEnterpriseMedicalStats(req, res)));
router.get('/enterprises/:enterpriseId/vaccinations', authMiddleware, requireEnterpriseAccess(), asyncHandler((req: Request, res: Response) => MedicalRecordController.listEnterpriseVaccinations(req, res)));

// ─── Breeding & Genetics ────────────────────────────
router.get('/enterprises/:enterpriseId/breeding', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listBreedingRecords(req, res)));
router.post('/enterprises/:enterpriseId/breeding', authMiddleware, validateBody(createBreedingRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createBreedingRecord(req, res)));
router.put('/breeding/:id', authMiddleware, validateBody(updateBreedingRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateBreedingRecord(req, res)));
router.get('/enterprises/:enterpriseId/breeding/upcoming-due', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getUpcomingDueDates(req, res)));
router.get('/enterprises/:enterpriseId/breeding/stats', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getBreedingStats(req, res)));

// ─── Feed & Inventory ───────────────────────────────
router.get('/enterprises/:enterpriseId/feed', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listFeeds(req, res)));
router.post('/enterprises/:enterpriseId/feed', authMiddleware, validateBody(createFeedSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createFeed(req, res)));
router.put('/feed/:id', authMiddleware, validateBody(updateFeedSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateFeed(req, res)));
router.post('/feed/:id/restock', authMiddleware, validateBody(restockFeedSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.restockFeed(req, res)));
router.delete('/feed/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteFeed(req, res)));
router.post('/enterprises/:enterpriseId/feed/consumption', authMiddleware, validateBody(logFeedConsumptionSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.logFeedConsumption(req, res)));
router.get('/enterprises/:enterpriseId/feed/consumption', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listConsumptionLogs(req, res)));
router.get('/enterprises/:enterpriseId/feed/analytics', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getFeedAnalytics(req, res)));

// ─── Compliance & Regulatory ────────────────────────
router.get('/enterprises/:enterpriseId/compliance', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listComplianceDocs(req, res)));
router.post('/enterprises/:enterpriseId/compliance', authMiddleware, validateBody(createComplianceDocSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createComplianceDoc(req, res)));
router.put('/compliance/:id', authMiddleware, validateBody(updateComplianceDocSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateComplianceDoc(req, res)));
router.patch('/compliance/:id/verify', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.verifyComplianceDoc(req, res)));
router.delete('/compliance/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteComplianceDoc(req, res)));
router.get('/enterprises/:enterpriseId/compliance/summary', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getComplianceSummary(req, res)));

// ─── Financial Analytics ────────────────────────────
router.get('/enterprises/:enterpriseId/financial', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listFinancialRecords(req, res)));
router.post('/enterprises/:enterpriseId/financial', authMiddleware, validateBody(createFinancialRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createFinancialRecord(req, res)));
router.put('/financial/:id', authMiddleware, validateBody(updateFinancialRecordSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateFinancialRecord(req, res)));
router.delete('/financial/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteFinancialRecord(req, res)));
router.get('/enterprises/:enterpriseId/financial/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getFinancialDashboard(req, res)));

// ─── Smart Alerts ───────────────────────────────────
router.get('/enterprises/:enterpriseId/alerts/rules', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listAlertRules(req, res)));
router.post('/enterprises/:enterpriseId/alerts/rules', authMiddleware, validateBody(createAlertRuleSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createAlertRule(req, res)));
router.put('/alerts/rules/:id', authMiddleware, validateBody(updateAlertRuleSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.updateAlertRule(req, res)));
router.delete('/alerts/rules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteAlertRule(req, res)));
router.patch('/alerts/rules/:id/toggle', authMiddleware, validateBody(toggleAlertRuleSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.toggleAlertRule(req, res)));
router.get('/enterprises/:enterpriseId/alerts/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listAlertEvents(req, res)));
router.patch('/alerts/events/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.markAlertRead(req, res)));
router.patch('/enterprises/:enterpriseId/alerts/events/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.markAllAlertsRead(req, res)));
router.patch('/alerts/events/:id/acknowledge', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.acknowledgeAlert(req, res)));
router.post('/enterprises/:enterpriseId/alerts/run-checks', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.runAlertChecks(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── AI Disease Prediction & Outbreak Mapping ────────
router.get('/enterprises/:enterpriseId/disease-predictions/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getRiskDashboard(req, res)));
router.get('/enterprises/:enterpriseId/disease-predictions', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listPredictions(req, res)));
router.post('/enterprises/:enterpriseId/disease-predictions', authMiddleware, validateBody(createPredictionSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createPrediction(req, res)));
router.patch('/disease-predictions/:id/resolve', authMiddleware, validateBody(resolvePredictionSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.resolvePrediction(req, res)));
router.get('/enterprises/:enterpriseId/outbreak-zones', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listOutbreakZones(req, res)));
router.post('/enterprises/:enterpriseId/outbreak-zones', authMiddleware, validateBody(createOutbreakZoneSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createOutbreakZone(req, res)));
router.patch('/outbreak-zones/:id/resolve', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.resolveOutbreakZone(req, res)));

// ─── Genomic Lineage & Genetic Diversity ────────────
router.get('/enterprises/:enterpriseId/genetic-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listGeneticProfiles(req, res)));
router.post('/enterprises/:enterpriseId/genetic-profiles', authMiddleware, validateBody(createGeneticProfileSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createGeneticProfile(req, res)));
router.put('/genetic-profiles/:id', authMiddleware, validateBody(updateGeneticProfileSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateGeneticProfile(req, res)));
router.get('/genetic-profiles/:animalId/lineage-tree', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getLineageTree(req, res)));
router.get('/enterprises/:enterpriseId/lineage-pairs', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listPairRecommendations(req, res)));
router.post('/enterprises/:enterpriseId/lineage-pairs', authMiddleware, validateBody(createPairRecommendationSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createPairRecommendation(req, res)));
router.get('/enterprises/:enterpriseId/genetic-dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getGeneticDashboard(req, res)));

// ─── IoT Sensor Integration ─────────────────────────
router.get('/enterprises/:enterpriseId/iot/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getSensorDashboard(req, res)));
router.get('/enterprises/:enterpriseId/iot/sensors', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listSensors(req, res)));
router.post('/enterprises/:enterpriseId/iot/sensors', authMiddleware, validateBody(createSensorSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createSensor(req, res)));
router.put('/iot/sensors/:id', authMiddleware, validateBody(updateSensorSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateSensor(req, res)));
router.delete('/iot/sensors/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteSensor(req, res)));
router.post('/enterprises/:enterpriseId/iot/readings', authMiddleware, validateBody(recordSensorReadingSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.recordSensorReading(req, res)));
router.get('/iot/sensors/:sensorId/readings', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listSensorReadings(req, res)));

// ─── Supply Chain & Traceability ─────────────────────
router.get('/enterprises/:enterpriseId/supply-chain/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getSupplyChainDashboard(req, res)));
router.get('/enterprises/:enterpriseId/supply-chain/batches', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listBatches(req, res)));
router.post('/enterprises/:enterpriseId/supply-chain/batches', authMiddleware, validateBody(createBatchSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createBatch(req, res)));
router.put('/supply-chain/batches/:id', authMiddleware, validateBody(updateBatchSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateBatch(req, res)));
router.get('/enterprises/:enterpriseId/supply-chain/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listTraceabilityEvents(req, res)));
router.post('/enterprises/:enterpriseId/supply-chain/events', authMiddleware, validateBody(createTraceabilityEventSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createTraceabilityEvent(req, res)));
router.patch('/supply-chain/events/:id/verify', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.verifyTraceabilityEvent(req, res)));
router.get('/supply-chain/batches/:batchId/traceability', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getBatchTraceability(req, res)));
router.post('/enterprises/:enterpriseId/supply-chain/qr-codes', authMiddleware, validateBody(generateQRCodeSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.generateQRCode(req, res)));
router.get('/enterprises/:enterpriseId/supply-chain/qr-codes', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listQRCodes(req, res)));

// ─── Workforce & Task Management ─────────────────────
router.get('/enterprises/:enterpriseId/workforce/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getWorkforceDashboard(req, res)));
router.get('/enterprises/:enterpriseId/workforce/tasks', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listTasks(req, res)));
router.post('/enterprises/:enterpriseId/workforce/tasks', authMiddleware, validateBody(createTaskSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createTask(req, res)));
router.put('/workforce/tasks/:id', authMiddleware, validateBody(updateTaskSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateTask(req, res)));
router.delete('/workforce/tasks/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteTask(req, res)));
router.get('/enterprises/:enterpriseId/workforce/shifts', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listShifts(req, res)));
router.post('/enterprises/:enterpriseId/workforce/shifts', authMiddleware, validateBody(createShiftSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createShift(req, res)));
router.put('/workforce/shifts/:id', authMiddleware, validateBody(updateShiftSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateShift(req, res)));
router.patch('/workforce/shifts/:id/check-in', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.checkInShift(req, res)));
router.patch('/workforce/shifts/:id/check-out', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.checkOutShift(req, res)));
router.delete('/workforce/shifts/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteShift(req, res)));

// ─── Staff & Workflow Management ─────────────────────
// Animal Search & Medical Summary (for workflow integration)
router.get('/workflow/animals/search', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.searchAnimals(req, res)));
router.get('/workflow/animals/:animalId/medical-summary', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getAnimalMedicalSummary(req, res)));
// Staff Positions
router.get('/hospitals/:hospitalId/staff', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listStaffPositions(req, res);
}));
router.post('/hospitals/:hospitalId/staff', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.addStaffPosition(req, res);
}));
router.put('/staff-positions/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'staff_positions')) return;
  return StaffWorkflowController.updateStaffPosition(req, res);
}));
router.delete('/staff-positions/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'staff_positions')) return;
  return StaffWorkflowController.removeStaffPosition(req, res);
}));
// Appointment Queue
router.get('/hospitals/:hospitalId/queue', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getQueue(req, res);
}));
router.post('/hospitals/:hospitalId/queue/check-in', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.checkInToQueue(req, res);
}));
router.patch('/queue/:id/triage', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'appointment_queue')) return;
  return StaffWorkflowController.triagePatient(req, res);
}));
router.patch('/queue/:id/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'appointment_queue')) return;
  return StaffWorkflowController.updateQueueStatus(req, res);
}));
router.get('/hospitals/:hospitalId/queue/stats', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getQueueStats(req, res);
}));
// Clinical Workflow
router.get('/hospitals/:hospitalId/workflow/dashboard', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getWorkflowDashboard(req, res);
}));
router.get('/hospitals/:hospitalId/workflow/cases', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listWorkflowCases(req, res);
}));
router.post('/hospitals/:hospitalId/workflow/cases', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.createWorkflowCase(req, res);
}));
router.get('/workflow/cases/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'workflow_cases')) return;
  return StaffWorkflowController.getWorkflowCaseDetail(req, res);
}));
router.put('/workflow/cases/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'workflow_cases')) return;
  return StaffWorkflowController.updateWorkflowCase(req, res);
}));
router.patch('/workflow/cases/:id/transition', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'workflow_cases')) return;
  return StaffWorkflowController.transitionWorkflowStage(req, res);
}));
// Referrals
router.get('/vets/search', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.searchVets(req, res)));
router.get('/hospitals/:hospitalId/referrals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listReferrals(req, res);
}));
router.post('/hospitals/:hospitalId/referrals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.createReferral(req, res);
}));
router.patch('/referrals/:id/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'referrals')) return;
  return StaffWorkflowController.updateReferralStatus(req, res);
}));
// Inpatient / Boarding
// Network-aware inpatient access helper - membership check delegated to the same
// resolveNetworkAccess() core used by requireNetworkAccess/ensureNetworkAccess (see
// [[feedback-network-hospital-change-approval]]); only the hospital→network resolution
// is specific to this helper. Non-membership responds 404 (not 403) - anti-enumeration,
// consistent with VetHospitalService's getHospital/listDoctors pattern.
async function checkInpatientNetworkAccess(req: Request, res: Response): Promise<boolean> {
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  if (userRole === 'admin') return true;
  const hospitalId = req.params.hospitalId;
  const hospitalRes = await database.query(`SELECT branch_network_id FROM vet_hospitals WHERE id = $1`, [hospitalId]);
  const networkId = hospitalRes.rows[0]?.branch_network_id;
  if (!networkId) return true; // standalone hospital - no network check needed
  const result = await resolveNetworkAccess(networkId, userId, userRole);
  if (!result.allowed) {
    res.status(404).json({ success: false, error: 'Hospital not found' });
    return false;
  }
  return true;
}

/**
 * Same network-membership check as checkInpatientNetworkAccess, but for
 * routes keyed by a resource id (queue entry, workflow case, referral,
 * staff position, inpatient admission) rather than :hospitalId directly -
 * resolves the resource's hospital_id first, then checks membership if that
 * hospital is a network branch. Prevents a staffer from one network reading
 * or mutating another network's operational data by id.
 */
async function checkResourceNetworkAccess(req: Request, res: Response, table: string, idParam: string = 'id'): Promise<boolean> {
  const userRole = (req as any).userRole;
  if (userRole === 'admin') return true;
  const userId = (req as any).userId;
  const resourceId = req.params[idParam];
  const resourceRes = await database.query(`SELECT hospital_id FROM ${table} WHERE id = $1`, [resourceId]);
  const hospitalId = resourceRes.rows[0]?.hospital_id;
  if (!hospitalId) return true; // not found here - let the controller 404 normally
  const hospitalRes = await database.query(`SELECT branch_network_id FROM vet_hospitals WHERE id = $1`, [hospitalId]);
  const networkId = hospitalRes.rows[0]?.branch_network_id;
  if (!networkId) return true; // standalone hospital - no network check needed
  const result = await resolveNetworkAccess(networkId, userId, userRole);
  if (!result.allowed) {
    res.status(404).json({ success: false, error: 'Resource not found' });
    return false;
  }
  return true;
}

router.get('/hospitals/:hospitalId/inpatient/dashboard', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.getInpatientDashboard(req, res);
}));
router.get('/hospitals/:hospitalId/inpatient', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.listInpatients(req, res);
}));
router.post('/hospitals/:hospitalId/inpatient/admit', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('veterinarian', 'inpatients'); emitRoleRefresh('hospital_staff', 'inpatients') } })
  if (!await checkInpatientNetworkAccess(req, res)) return;
  return StaffWorkflowController.admitPatient(req, res);
}));
router.patch('/inpatient/:id/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('veterinarian', 'inpatients'); emitRoleRefresh('hospital_staff', 'inpatients') } })
  if (!await checkResourceNetworkAccess(req, res, 'inpatient_admissions')) return;
  return StaffWorkflowController.updateInpatientStatus(req, res)
}));
router.post('/inpatient/:id/vitals', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await checkResourceNetworkAccess(req, res, 'inpatient_admissions')) return;
  return StaffWorkflowController.addVitalsLog(req, res);
}));
router.put('/inpatient/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('veterinarian', 'inpatients'); emitRoleRefresh('hospital_staff', 'inpatients') } })
  if (!await checkResourceNetworkAccess(req, res, 'inpatient_admissions')) return;
  await StaffWorkflowController.updateInpatientDetails(req, res)
}));
router.get('/animals/:animalId/hospital-visits', authMiddleware, requireAnimalAccess('params:animalId', 'hospital_visits'), asyncHandler((req: Request, res: Response) => StaffWorkflowController.getAnimalHospitalVisits(req, res)));

// ─── Report Builder & Export Center ──────────────────
router.get('/enterprises/:enterpriseId/reports/templates', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listReportTemplates(req, res)));
router.post('/enterprises/:enterpriseId/reports/templates', authMiddleware, validateBody(createReportTemplateSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.createReportTemplate(req, res)));
router.put('/reports/templates/:id', authMiddleware, validateBody(updateReportTemplateSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.updateReportTemplate(req, res)));
router.delete('/reports/templates/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteReportTemplate(req, res)));
router.post('/enterprises/:enterpriseId/reports/generate', authMiddleware, validateBody(generateReportSchema), asyncHandler((req: Request, res: Response) => Tier3Controller.generateReport(req, res)));
router.get('/enterprises/:enterpriseId/reports/generated', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.listGeneratedReports(req, res)));
router.get('/reports/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.getReport(req, res)));
router.delete('/reports/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier3Controller.deleteReport(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── AI Veterinary Copilot ──────────────────────────
router.get('/ai-copilot/sessions', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listChatSessions(req, res)));
router.post('/ai-copilot/sessions', authMiddleware, validateBody(createChatSessionSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createChatSession(req, res)));
router.get('/ai-copilot/sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getChatSession(req, res)));
router.delete('/ai-copilot/sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteChatSession(req, res)));
router.get('/ai-copilot/sessions/:sessionId/messages', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listChatMessages(req, res)));
router.post('/ai-copilot/sessions/:sessionId/messages', authMiddleware, validateBody(sendChatMessageSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.sendChatMessage(req, res)));
router.post('/ai-copilot/drug-interactions', authMiddleware, validateBody(checkDrugInteractionsSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.checkDrugInteractions(req, res)));
router.post('/ai-copilot/symptom-analysis', authMiddleware, validateBody(analyzeSymptomsSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.analyzeSymptoms(req, res)));
router.post('/ai-copilot/analyze-scan', authMiddleware, uploadAny.single('image'), asyncHandler((req: Request, res: Response) => Tier4Controller.analyzeScan(req, res)));

// ─── Digital Twin & Scenario Simulator ──────────────
router.get('/enterprises/:enterpriseId/digital-twins/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getDigitalTwinDashboard(req, res)));
router.get('/enterprises/:enterpriseId/digital-twins', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listDigitalTwins(req, res)));
router.post('/enterprises/:enterpriseId/digital-twins', authMiddleware, validateBody(createDigitalTwinSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createDigitalTwin(req, res)));
router.put('/digital-twins/:id', authMiddleware, validateBody(updateDigitalTwinSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateDigitalTwin(req, res)));
router.delete('/digital-twins/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteDigitalTwin(req, res)));
router.get('/enterprises/:enterpriseId/simulations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listSimulations(req, res)));
router.post('/enterprises/:enterpriseId/simulations', authMiddleware, validateBody(runSimulationSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.runSimulation(req, res)));
router.get('/simulations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getSimulation(req, res)));
router.delete('/simulations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteSimulation(req, res)));

router.use(marketplaceRoutes);
router.use(catalogAndRolesRoutes);
// NETWORK SUBSCRIPTION PLANS (platform admin only)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/network-subscription-plans', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const isAdmin = authReq.userRole === 'admin';
  const result = await db.query(
    isAdmin
      ? `SELECT * FROM network_subscription_plans ORDER BY sort_order, name`
      : `SELECT id, name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, sort_order FROM network_subscription_plans WHERE is_published = true AND is_active = true ORDER BY sort_order, name`
  );
  res.json({ success: true, data: result.rows });
}));

router.post('/admin/network-subscription-plans', authMiddleware, roleMiddleware(['admin']), validateBody(createNetworkPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, is_published, sort_order } = req.body;
  const result = await db.query(
    `INSERT INTO network_subscription_plans (name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, is_published, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [name, description||null, max_seats||null, max_hospitals||null, price_monthly||null, price_annually||null, currency||'INR', features ? JSON.stringify(features) : '{}', is_published||false, sort_order||0]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.put('/admin/network-subscription-plans/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateNetworkPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const allowedFields = ['name','description','max_seats','max_hospitals','price_monthly','price_annually','currency','features','is_published','sort_order','is_active'];
  const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowedFields.includes(k)));
  if (Object.keys(fields).length === 0) return res.status(400).json({ success: false, message: 'No valid fields to update' });
  const setClauses = Object.keys(fields).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
  const values = Object.values(fields);
  const result = await db.query(`UPDATE network_subscription_plans SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...values]);
  if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Plan not found' });
  res.json({ success: true, data: result.rows[0] });
}));

router.delete('/admin/network-subscription-plans/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const inUse = await db.query(`SELECT COUNT(*) FROM network_subscriptions WHERE plan_id = $1`, [req.params.id]);
  if (parseInt(inUse.rows[0].count) > 0) return res.status(400).json({ success: false, message: 'Plan is in use by one or more networks' });
  await db.query(`UPDATE network_subscription_plans SET is_active = false, updated_at = NOW() WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK SUBSCRIPTIONS ADMIN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

async function countSeatsUsed(db: any, networkId: string): Promise<number> {
  const r = await db.query(`SELECT COUNT(*) FROM hospital_network_members WHERE network_id = $1 AND is_active = true`, [networkId]);
  return parseInt(r.rows[0].count);
}
async function checkSeatLimit(networkId: string, db: any): Promise<{ allowed: boolean; used: number; limit: number; status: string }> {
  const sub = await db.query(`SELECT seat_limit, status FROM network_subscriptions WHERE network_id = $1`, [networkId]);
  if (sub.rows.length === 0) return { allowed: true, used: 0, limit: 5, status: 'trial' };
  const { seat_limit, status } = sub.rows[0];
  if (status === 'suspended') return { allowed: false, used: 0, limit: seat_limit, status };
  const used = await countSeatsUsed(db, networkId);
  return { allowed: used < seat_limit, used, limit: seat_limit, status };
}

router.get('/admin/network-subscriptions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const result = await db.query(`
    SELECT hn.id AS "networkId", hn.name AS "networkName", hn.is_approved AS "isApproved",
      ns.id AS "subscriptionId", ns.seat_limit AS "seatLimit", ns.status,
      ns.billing_cycle AS "billingCycle", ns.suspended_at AS "suspendedAt",
      ns.suspension_reason AS "suspensionReason", ns.admin_notes AS "adminNotes",
      nsp.name AS "planName", nsp.id AS "planId",
      (SELECT COUNT(*) FROM hospital_network_members m WHERE m.network_id = hn.id AND m.is_active = true) AS "seatsUsed",
      (SELECT COUNT(*) FROM hospital_network_hospitals hnh WHERE hnh.network_id = hn.id AND hnh.is_active = true) AS "hospitalsCount"
    FROM hospital_networks hn
    LEFT JOIN network_subscriptions ns ON ns.network_id = hn.id
    LEFT JOIN network_subscription_plans nsp ON nsp.id = ns.plan_id
    WHERE hn.is_active = true ORDER BY hn.name
  `);
  res.json({ success: true, data: result.rows });
}));

router.post('/admin/networks/:id/set-subscription', authMiddleware, roleMiddleware(['admin']), validateBody(setNetworkSubscriptionSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { plan_id, seat_limit, status, billing_cycle, ends_at, admin_notes } = req.body;
  const result = await db.query(
    `INSERT INTO network_subscriptions (network_id, plan_id, seat_limit, status, billing_cycle, ends_at, admin_notes) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (network_id) DO UPDATE SET plan_id=EXCLUDED.plan_id, seat_limit=EXCLUDED.seat_limit, status=EXCLUDED.status, billing_cycle=EXCLUDED.billing_cycle, ends_at=EXCLUDED.ends_at, admin_notes=EXCLUDED.admin_notes, updated_at=NOW() RETURNING *`,
    [req.params.id, plan_id||null, seat_limit, status||'trial', billing_cycle||'none', ends_at||null, admin_notes||null]
  );
  res.json({ success: true, data: result.rows[0] });
}));

router.put('/admin/networks/:id/override-seat-limit', authMiddleware, roleMiddleware(['admin']), validateBody(overrideSeatLimitSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { seat_limit, admin_notes } = req.body;
  const result = await db.query(
    `INSERT INTO network_subscriptions (network_id, seat_limit, admin_notes) VALUES ($1,$2,$3)
     ON CONFLICT (network_id) DO UPDATE SET seat_limit=EXCLUDED.seat_limit, admin_notes=COALESCE(EXCLUDED.admin_notes,network_subscriptions.admin_notes), updated_at=NOW() RETURNING *`,
    [req.params.id, seat_limit, admin_notes||null]
  );
  res.json({ success: true, data: result.rows[0] });
}));

router.post('/admin/networks/:id/suspend', authMiddleware, roleMiddleware(['admin']), validateBody(suspendNetworkSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const { suspension_reason } = req.body;
  await db.query(
    `INSERT INTO network_subscriptions (network_id, seat_limit, status, suspended_at, suspended_by, suspension_reason) VALUES ($1,5,'suspended',NOW(),$2,$3)
     ON CONFLICT (network_id) DO UPDATE SET status='suspended', suspended_at=NOW(), suspended_by=$2, suspension_reason=$3, updated_at=NOW()`,
    [req.params.id, authReq.userId, suspension_reason]
  );
  res.json({ success: true, message: 'Network suspended' });
}));

router.post('/admin/networks/:id/unsuspend', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  await db.query(`UPDATE network_subscriptions SET status='active', suspended_at=NULL, suspended_by=NULL, suspension_reason=NULL, updated_at=NOW() WHERE network_id=$1`, [req.params.id]);
  res.json({ success: true, message: 'Network unsuspended' });
}));

// ─────────────────────────────────────────────────────────────────────────────
router.use(pricingVisibilityRoutes);
// HOSPITAL STAFF INVITES (invite-only registration for hospital_staff role)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/hospital-networks/:id/invite-staff', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), validateBody(inviteHospitalStaffSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const networkId = req.params.id;
  // Secondary check: verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(networkId, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, message: 'Network not found' });
    return res.status(403).json({ success: false, message: 'Only corporate admins and hospital directors can invite staff' });
  }
  const seat = await checkSeatLimit(networkId, db);
  if (!seat.allowed) {
    if (seat.status === 'suspended') return res.status(403).json({ success: false, message: 'This network has been suspended. Contact platform support.', code: 'network_suspended' });
    return res.status(403).json({ success: false, message: `Seat limit reached (${seat.used}/${seat.limit}). Contact platform admin to upgrade.`, code: 'seat_limit_exceeded', used: seat.used, limit: seat.limit });
  }
  const { invitee_email, invitee_name, staff_position, hospital_id } = req.body;
  const crypto = require('crypto');
  const token = crypto.randomBytes(48).toString('hex');
  const existing = await db.query(`SELECT id FROM hospital_staff_invites WHERE network_id=$1 AND invitee_email=$2 AND status='pending' AND expires_at>NOW()`, [networkId, invitee_email]);
  if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'A pending invite already exists for this email' });
  await db.query(`INSERT INTO hospital_staff_invites (network_id, hospital_id, invited_by, invitee_email, invitee_name, staff_position, invite_token) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [networkId, hospital_id||null, authReq.userId, invitee_email, invitee_name || '', staff_position, token]);

  // Build invite URL
  const frontendUrl = process.env.FRONTEND_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL.replace('/api/v1', '') : '') || 'http://localhost:5173';
  const inviteUrl = `${frontendUrl}/accept-hospital-invite?token=${token}`;

  // Fetch network + hospital names for email
  const networkResult = await db.query(`SELECT name FROM hospital_networks WHERE id = $1`, [networkId]);
  const networkName = networkResult.rows[0]?.name || 'the network';
  let hospitalName = '';
  if (hospital_id) {
    const hRes = await db.query(`SELECT name FROM vet_hospitals WHERE id = $1`, [hospital_id]);
    hospitalName = hRes.rows[0]?.name || '';
  }

  // Send invite email (non-blocking)
  emailService.send({
    to: invitee_email,
    subject: '',
    template: 'staff_invite',
    data: { inviteeName: invitee_name, networkName, hospitalName, position: staff_position, inviteUrl },
  }).catch((err: any) => logger.error('Staff invite email failed', { error: err.message }));

  // H6: In-app notification if invitee already has an account
  try {
    const inviteeUser = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [invitee_email]);
    if (inviteeUser.rows.length > 0) {
      const NotificationService = (await import('../services/NotificationService')).default;
      await NotificationService.createNotification(
        inviteeUser.rows[0].id, 'system',
        `Invitation to join ${networkName}`,
        `You have been invited to join ${networkName}. Check your network invitations.`,
        'in_app', { networkId, type: 'staff_invite' }
      );
    }
  } catch (notifErr: any) {
    logger.warn('Staff invite in-app notification failed (non-blocking)', { networkId, error: notifErr.message });
  }

  res.status(201).json({ success: true, message: 'Invite created. Email sent if configured.', data: { token, inviteUrl } });
}));

router.get('/hospital-staff-invites/token/:token', asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const result = await db.query(
    `SELECT hsi.*, hn.name AS "networkName", vh.name AS "hospitalName" FROM hospital_staff_invites hsi JOIN hospital_networks hn ON hn.id=hsi.network_id LEFT JOIN vet_hospitals vh ON vh.id=hsi.hospital_id WHERE hsi.invite_token=$1`,
    [req.params.token]
  );
  if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Invite not found' });
  const invite = result.rows[0];
  if (invite.status !== 'pending') return res.status(400).json({ success: false, message: `Invite has been ${invite.status}` });
  if (new Date(invite.expires_at) < new Date()) {
    await db.query(`UPDATE hospital_staff_invites SET status='expired' WHERE invite_token=$1`, [req.params.token]);
    return res.status(400).json({ success: false, message: 'This invite has expired. Ask your administrator to resend.' });
  }
  res.json({ success: true, data: { email: invite.invitee_email, name: invite.invitee_name, position: invite.staff_position, networkName: invite.networkName, hospitalName: invite.hospitalName } });
}));

router.post('/hospital-staff-invites/accept', validateBody(acceptStaffInviteSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { token, first_name, last_name, phone, password } = req.body;
  const inviteResult = await db.query(`SELECT * FROM hospital_staff_invites WHERE invite_token=$1 AND status='pending' AND expires_at>NOW()`, [token]);
  if (inviteResult.rows.length === 0) return res.status(400).json({ success: false, message: 'Invalid, expired, or already used invite' });
  const invite = inviteResult.rows[0];
  const existing = await db.query(`SELECT id FROM users WHERE email=$1`, [invite.invitee_email]);
  if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });

  // CRITICAL: Wrap the entire accept flow in a transaction to prevent seat limit race conditions
  // Without this, two parallel accepts could both pass the seat check but exceed the limit when committed
  try {
    // Direct db usage - transactions need explicit BEGIN/COMMIT
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    // Re-check seat limit INSIDE the transaction (row-level lock prevents other accepts from executing in parallel)
    const seat = await db.query(`
      SELECT (SELECT COUNT(*) FROM users u
              INNER JOIN hospital_network_members hnm ON u.id = hnm.user_id
              WHERE hnm.network_id = $1 AND hnm.is_active = true) as used_seats,
             hn.seat_limit
      FROM network_subscriptions hn
      WHERE hn.network_id = $1
    `, [invite.network_id]);

    if (seat.rows.length > 0) {
      const { used_seats, seat_limit } = seat.rows[0];
      if (parseInt(used_seats) >= parseInt(seat_limit)) {
        await db.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Seat limit reached. Contact your network administrator.', code: 'seat_limit_exceeded' });
      }
    }

    const bcrypt = require('bcryptjs');
    const password_hash = await bcrypt.hash(password, 12);
    // Derive system role from invited staff_position - pharmacist gets dedicated role
    const staffPositionRoleMap: Record<string, string> = { pharmacist: 'pharmacist' };
    const assignedRole = staffPositionRoleMap[invite.staff_position] || 'hospital_staff';
    // network_role must satisfy the DB check constraint - always 'hospital_staff' for position-based invites
    const networkRole = 'hospital_staff';
    const userResult = await db.query(
      `INSERT INTO users (email, first_name, last_name, phone, role, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role`,
      [invite.invitee_email, first_name, last_name, phone || '', assignedRole, password_hash]
    );
    const newUser = userResult.rows[0];
    await db.query(`INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (network_id, user_id) DO NOTHING`,
      [invite.network_id, newUser.id, networkRole, invite.hospital_id, invite.invited_by]);
    // staff_positions may not have a unique constraint - use INSERT only if not exists
    const existingPos = await db.query(`SELECT id FROM staff_positions WHERE hospital_id=$1 AND user_id=$2`, [invite.hospital_id, newUser.id]);
    if (existingPos.rows.length === 0 && invite.hospital_id) {
      await db.query(`INSERT INTO staff_positions (hospital_id, user_id, position) VALUES ($1,$2,$3)`,
        [invite.hospital_id, newUser.id, invite.staff_position]).catch((err: any) => logger.error('Staff position insert failed', { error: err.message }));
    }
    await db.query(`UPDATE hospital_staff_invites SET status='accepted', accepted_at=NOW(), accepted_user_id=$1 WHERE invite_token=$2`, [newUser.id, token]);

    await db.query('COMMIT');

    // §17.2: record provable policy consent for the invited user (context 'invite')
    try {
      const LegalService = (await import('../services/LegalService')).default;
      await LegalService.recordAcceptances({
        userId: newUser.id,
        userEmail: newUser.email,
        docTypes: ['terms', 'privacy'],
        context: 'invite',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (consentErr: any) {
      logger.error('Policy acceptance recording failed at invite accept', { userId: newUser.id, error: consentErr.message });
    }

    res.status(201).json({ success: true, message: 'Account created successfully. You can now log in.' });
  } catch (err: any) {
    try { await db.query('ROLLBACK'); } catch (rollbackErr: any) { logger.error('Rollback failed', { error: rollbackErr.message }); }
    logger.error('Accept invite failed', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: err.message || 'Failed to create account' });
  }
}));

// Send a staff invite via email
router.post('/hospital-networks/:id/staff-invites', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  // Verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(req.params.id, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, error: 'Network not found' });
    return res.status(403).json({ success: false, error: 'Only corporate admins and hospital directors can send staff invites' });
  }

  const { inviteeEmail, inviteeName = '', staffPosition, hospitalId, expiresInHours = 72 } = req.body;
  if (!inviteeEmail || !staffPosition) {
    return res.status(400).json({ success: false, error: 'inviteeEmail and staffPosition are required' });
  }

  const builtInPositions = ['nurse','technician','receptionist','lab_tech','radiologist','anesthesiologist','pharmacist','intern','admin_staff'];
  if (!builtInPositions.includes(staffPosition)) {
    // Allow custom roles defined for this network
    const customRoleRes = await db.query(
      `SELECT role_key FROM network_custom_roles WHERE network_id = $1 AND role_key = $2 AND is_active = true`,
      [req.params.id, staffPosition]
    );
    if (customRoleRes.rows.length === 0) {
      return res.status(400).json({ success: false, error: `staffPosition must be one of: ${builtInPositions.join(', ')}, or a custom role defined for this network` });
    }
  }

  // Check if email is already an active member
  const existingUser = await db.query(
    `SELECT u.id FROM users u
     JOIN hospital_network_members hnm ON hnm.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1) AND hnm.network_id = $2 AND hnm.is_active = true`,
    [inviteeEmail, req.params.id]
  );
  if (existingUser.rows.length > 0) {
    return res.status(409).json({ success: false, error: 'This user is already a member of this network' });
  }

  // Check for existing pending invite
  const existingInvite = await db.query(
    `SELECT id FROM hospital_staff_invites WHERE LOWER(invitee_email) = LOWER($1) AND network_id = $2 AND status = 'pending' AND expires_at > NOW()`,
    [inviteeEmail, req.params.id]
  );
  if (existingInvite.rows.length > 0) {
    return res.status(409).json({ success: false, error: 'A pending invite already exists for this email address' });
  }

  const crypto = await import('crypto');
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const result = await db.query(
    `INSERT INTO hospital_staff_invites (network_id, hospital_id, invited_by, invitee_email, invitee_name, staff_position, invite_token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, invite_token AS "inviteToken", invitee_email AS "inviteeEmail", invitee_name AS "inviteeName", staff_position AS "staffPosition", expires_at AS "expiresAt"`,
    [req.params.id, hospitalId || null, authReq.userId, inviteeEmail, inviteeName, staffPosition, token, expiresAt]
  );

  const invite = result.rows[0];

  // Send email invitation (non-fatal)
  try {
    const emailService = (await import('../services/EmailService')).default;
    const networkResult = await db.query(`SELECT name FROM hospital_networks WHERE id = $1`, [req.params.id]);
    const networkName = networkResult.rows[0]?.name ?? 'the hospital network';
    const inviteUrl = `${process.env.FRONTEND_URL || 'https://vetcare.app'}/accept-staff-invite?token=${token}`;
    await emailService.send({
      to: inviteeEmail,
      subject: `You've been invited to join ${networkName} as ${staffPosition}`,
      text: `Hi ${inviteeName},\n\nYou have been invited to join ${networkName} as a ${staffPosition}.\n\nAccept your invitation here: ${inviteUrl}\n\nThis invitation expires in ${expiresInHours} hours.\n\nIf you did not expect this invitation, you can safely ignore this email.`,
      html: `<p>Hi <strong>${inviteeName}</strong>,</p><p>You have been invited to join <strong>${networkName}</strong> as a <strong>${staffPosition}</strong>.</p><p><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Accept Invitation</a></p><p>This invitation expires in ${expiresInHours} hours.</p><p>If you did not expect this invitation, you can safely ignore this email.</p>`,
    }).catch((err: any) => logger.warn('Staff invite email failed to send', { error: err.message }));
  } catch (emailErr: any) {
    logger.warn('Staff invite email setup failed', { error: emailErr.message });
  }

  // H6: In-app notification if invitee already has an account
  try {
    const inviteeUser = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [inviteeEmail]);
    if (inviteeUser.rows.length > 0) {
      const NotificationService = (await import('../services/NotificationService')).default;
      const networkRes = await db.query(`SELECT name FROM hospital_networks WHERE id = $1`, [req.params.id]);
      const netName = networkRes.rows[0]?.name ?? 'a hospital network';
      await NotificationService.createNotification(
        inviteeUser.rows[0].id, 'system',
        `Invitation to join ${netName}`,
        `You have been invited to join ${netName} as ${staffPosition}. Check your network invitations.`,
        'in_app', { networkId: req.params.id, type: 'staff_invite' }
      );
    }
  } catch (notifErr: any) {
    logger.warn('Staff invite in-app notification failed (non-blocking)', { networkId: req.params.id, error: notifErr.message });
  }

  res.status(201).json({ success: true, data: invite, message: 'Invitation sent successfully' });
}));

router.get('/hospital-networks/:id/staff-invites', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  // Secondary check: verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(req.params.id, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, message: 'Network not found' });
    return res.status(403).json({ success: false, message: 'Only corporate admins and hospital directors can view invites' });
  }
  const result = await db.query(
    `SELECT hsi.*, u.first_name AS "inviterFirstName", u.last_name AS "inviterLastName", vh.name AS "hospitalName"
     FROM hospital_staff_invites hsi
     JOIN users u ON u.id = hsi.invited_by
     LEFT JOIN vet_hospitals vh ON vh.id = hsi.hospital_id
     WHERE hsi.network_id = $1
       AND hsi.status = 'pending'
       AND hsi.expires_at > NOW()
     ORDER BY hsi.created_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: result.rows });
}));

router.delete('/hospital-networks/:id/staff-invites/:inviteId', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian', 'hospital_staff']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  // Secondary check: verify caller has appropriate network role for the (admin-configurable) inviteStaff action
  const access = await resolveNetworkAccess(req.params.id, authReq.userId, authReq.userRole, 'inviteStaff');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, message: 'Network not found' });
    return res.status(403).json({ success: false, message: 'Only corporate admins and hospital directors can manage invites' });
  }
  await db.query(`UPDATE hospital_staff_invites SET status='revoked', updated_at=NOW() WHERE id=$1 AND network_id=$2 AND status='pending'`, [req.params.inviteId, req.params.id]);
  res.json({ success: true });
}));

// G10 - Export audit logs as CSV
router.get('/hospital-networks/:id/audit-logs/export', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  // Was previously "any member" - hospital_staff has viewAuditLogs=false in the matrix
  // and should not be able to pull the raw clinical-access audit log via this endpoint.
  const access = await resolveNetworkAccess(networkId, userId, userRole, 'viewAuditLogs');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, error: 'Network not found' });
    return res.status(403).json({ success: false, error: 'Insufficient role to view audit logs' });
  }

  const result = await database.query(
    `SELECT cal.id, cal.accessed_by,
            COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as accessor_name,
            cal.animal_id, COALESCE(a.name, 'Unknown') as animal_name,
            cal.record_type, cal.access_type, cal.access_granted,
            cal.denial_reason, cal.ip_address, cal.accessed_at
     FROM clinical_data_access_log cal
     LEFT JOIN users u ON u.id = cal.accessed_by
     LEFT JOIN animals a ON a.id = cal.animal_id
     WHERE cal.accessor_network_id = $1
     ORDER BY cal.accessed_at DESC
     LIMIT 5000`,
    [networkId]
  );

  const headers = 'ID,Accessor,Animal,Record Type,Access Type,Granted,Denial Reason,IP Address,Timestamp\n';
  const rows = result.rows.map((r: any) =>
    `"${r.id}","${r.accessor_name}","${r.animal_name}","${r.record_type || ''}","${r.access_type || ''}","${r.access_granted}","${(r.denial_reason || '').replace(/"/g, '""')}","${r.ip_address || ''}","${r.accessed_at}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=audit-log-${networkId.slice(0,8)}-${new Date().toISOString().slice(0,10)}.csv`);
  res.send(headers + rows);
}));

// G11 - Network financial summary
router.get('/hospital-networks/:id/financial-summary', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  // Was previously a hardcoded ['corporate_admin','hospital_director','auditor'] list that bypassed
  // the admin-configurable financialAnalytics matrix entirely (matrix sets it false for both
  // hospital_director and auditor) - now honors whatever the network's admin has actually configured.
  const access = await resolveNetworkAccess(networkId, userId, userRole, 'financialAnalytics');
  if (!access.allowed) {
    if (access.reason === 'not_member') return res.status(404).json({ success: false, error: 'Network not found' });
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }
  const result = await HospitalNetworkService.getNetworkFinancialSummary(networkId);
  res.json({ success: true, data: result });
}));

// G12 - Staff leave management
router.get('/hospital-networks/:id/leave-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const member = await HospitalNetworkService.getNetworkMember(networkId, userId);
  if (!member) return res.status(403).json({ success: false, error: 'Not a member' });

  const filters: any = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
  };
  if (req.query.hospitalId) filters.hospitalId = req.query.hospitalId;
  if (req.query.status) filters.status = req.query.status;
  if (!['corporate_admin', 'hospital_director'].includes(member.networkRole)) {
    filters.userId = userId;
  }

  const result = await HospitalNetworkService.listLeaveRequests(networkId, filters);
  res.json({ success: true, data: result });
}));

router.post('/hospital-networks/:id/leave-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const { leaveType, startDate, endDate, reason, hospitalId } = req.body;

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, error: 'leaveType, startDate, and endDate are required' });
  }

  const result = await HospitalNetworkService.createLeaveRequest({
    networkId, hospitalId, userId, leaveType, startDate, endDate, reason
  });
  res.json({ success: true, data: result });
}));

router.patch('/hospital-networks/:id/leave-requests/:requestId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { id: networkId, requestId } = req.params;
  const userId = (req as any).userId;
  const { status, rejectionReason } = req.body;

  const member = await HospitalNetworkService.getNetworkMember(networkId, userId);
  if (!member || !['corporate_admin', 'hospital_director'].includes(member.networkRole)) {
    return res.status(403).json({ success: false, error: 'Only directors and admins can approve/reject leave' });
  }

  const result = await HospitalNetworkService.updateLeaveRequestStatus(networkId, requestId, status, userId, rejectionReason);
  res.json({ success: true, data: result });
}));

// G13 - Patient transfers
router.post('/hospital-networks/:id/patient-transfers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { fromHospitalId, toHospitalId, animalId, reason, transferReason, clinicalNotes } = req.body;

  if (!fromHospitalId || !toHospitalId || !animalId || !reason) {
    return res.status(400).json({ success: false, error: 'fromHospitalId, toHospitalId, animalId, and reason are required' });
  }

  const result = await HospitalNetworkService.createPatientTransfer({
    networkId, fromHospitalId, toHospitalId, animalId, reason, transferReason, clinicalNotes, createdBy: userId, createdByRole: userRole
  });
  res.json({ success: true, data: result });
}));

router.post('/hospital-networks/:id/patient-transfers/:transferId/complete', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { transferId } = req.params;
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const result = await HospitalNetworkService.completePatientTransfer(transferId, userId, userRole);
  res.json({ success: true, data: result });
}));

router.get('/hospital-networks/:id/patient-transfers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = req.params.id;
  const userId = (req as any).userId;
  const member = await HospitalNetworkService.getNetworkMember(networkId, userId);
  if (!member) return res.status(403).json({ success: false, error: 'Not a member' });

  const result = await database.query(
    `SELECT nr.*,
            fh.name as "fromHospitalName", th.name as "toHospitalName",
            a.name as "animalName", a.species as "animalSpecies",
            COALESCE(cu.first_name || ' ' || cu.last_name, '') as "createdByName"
     FROM network_referrals nr
     LEFT JOIN vet_hospitals fh ON fh.id = nr.from_hospital_id
     LEFT JOIN vet_hospitals th ON th.id = nr.to_hospital_id
     LEFT JOIN animals a ON a.id = nr.animal_id
     LEFT JOIN users cu ON cu.id = nr.created_by
     WHERE nr.network_id = $1 AND nr.referral_type = 'transfer'
     ORDER BY nr.created_at DESC
     LIMIT 50`,
    [networkId]
  );
  res.json({ success: true, data: result.rows });
}));

// ─── Revenue Trends ──────────────────────────────────────────
router.get('/admin/revenue-trends', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
  try {
    const daily = await database.query(
      `SELECT 
         DATE_TRUNC('day', created_at) as date,
         SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as transactions,
         SUM(CASE WHEN status IN ('refunded','partially_refunded') THEN COALESCE(refund_amount,0) ELSE 0 END) as refunds
       FROM payments
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date ASC`,
      [days]
    );
    const topVets = await database.query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) as "vetName",
         SUM(p.amount) as "totalRevenue",
         COUNT(*) as consultations
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN users u ON u.id = b.veterinarian_id
       WHERE p.status = 'completed' AND p.created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY b.veterinarian_id, u.first_name, u.last_name
       ORDER BY "totalRevenue" DESC
       LIMIT 5`,
      [days]
    );
    res.json({ success: true, data: { daily: daily.rows, topVets: topVets.rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// ─── Bulk Animal Import ──────────────────────────────────────
router.post('/animals/bulk-import', authMiddleware, roleMiddleware(['admin', 'farmer']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { animals, enterpriseId } = req.body;
  if (!Array.isArray(animals) || animals.length === 0) {
    return res.status(400).json({ success: false, error: 'animals array is required' });
  }
  if (animals.length > 500) {
    return res.status(400).json({ success: false, error: 'Maximum 500 animals per import' });
  }
  const results = { created: 0, failed: 0, errors: [] as string[] };
  const { v4: uuidv4 } = require('uuid');
  for (const animal of animals) {
    try {
      if (!animal.name || !animal.species) {
        results.failed++;
        results.errors.push(`Row skipped: name and species are required`);
        continue;
      }
      const id = uuidv4();
      await database.query(
        `INSERT INTO animals (id, owner_id, enterprise_id, name, species, breed, gender, date_of_birth, weight, color, microchip_id, animal_class, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [id, authReq.userId, enterpriseId || null, animal.name, animal.species,
         animal.breed || null, animal.gender || null, animal.dateOfBirth || null,
         animal.weight || null, animal.color || null, animal.microchipId || null, animal.animalClass || null]
      );
      results.created++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${animal.name || 'Unknown'}: ${err.message}`);
    }
  }
  res.json({ success: true, data: results });
}));

// ─── Compliance Report ───────────────────────────────────────
router.get('/compliance/report', authMiddleware, roleMiddleware(['admin', 'farmer']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const isAdmin = authReq.userRole === 'admin';
  const userId = isAdmin ? ((req.query.userId as string) || authReq.userId!) : authReq.userId!;
  try {
    const animals = await database.query(
      `SELECT a.id, a.name, a.species, a.breed, a.gender, a.date_of_birth as "dateOfBirth", a.microchip_id as "microchipId",
              COUNT(DISTINCT v.id)::text as "vaccinationCount",
              COUNT(DISTINCT mr.id)::text as "medicalRecordCount",
              MAX(v.administered_date) as "lastVaccination"
       FROM animals a
       LEFT JOIN vaccination_records v ON v.animal_id = a.id AND v.status = 'completed'
       LEFT JOIN medical_records mr ON mr.animal_id = a.id
       WHERE a.owner_id = $1
       GROUP BY a.id, a.name, a.species, a.breed, a.gender, a.date_of_birth, a.microchip_id
       ORDER BY a.name`,
      [userId]
    );
    const summary = {
      totalAnimals: animals.rows.length,
      speciesBreakdown: animals.rows.reduce((acc: any, a: any) => {
        acc[a.species] = (acc[a.species] || 0) + 1;
        return acc;
      }, {}),
      vaccinationCoverage: animals.rows.filter((a: any) => parseInt(a.vaccinationCount) > 0).length,
      generatedAt: new Date().toISOString()
    };
    res.json({ success: true, data: { animals: animals.rows, summary } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

// ─── Dispute Resolution ──────────────────────────────────────
router.post('/disputes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { bookingId, consultationId, subject, description, disputeType } = req.body;
  if (!subject || !description || !disputeType) {
    return res.status(400).json({ success: false, error: 'subject, description, and disputeType are required' });
  }
  try {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    await database.query(
      `INSERT INTO disputes (id, reported_by, booking_id, consultation_id, subject, description, dispute_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', NOW(), NOW())`,
      [id, authReq.userId, bookingId || null, consultationId || null, subject, description, disputeType]
    );
    res.status(201).json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

router.get('/disputes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const isAdmin = authReq.userRole === 'admin';
  const whereClause = isAdmin ? '' : 'WHERE d.reported_by = $1';
  const params: any[] = isAdmin ? [] : [authReq.userId];
  try {
    const result = await database.query(
      `SELECT d.id, d.subject, d.description, d.dispute_type as "disputeType", d.status,
              d.booking_id as "bookingId", d.consultation_id as "consultationId",
              d.resolution, d.resolved_at as "resolvedAt", d.resolved_by as "resolvedBy",
              d.created_at as "createdAt",
              CONCAT(u.first_name, ' ', u.last_name) as "reportedByName", u.email as "reportedByEmail"
       FROM disputes d
       LEFT JOIN users u ON u.id = d.reported_by
       ${whereClause}
       ORDER BY d.created_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

router.put('/disputes/:id/resolve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { resolution, status } = req.body;
  if (!resolution) {
    return res.status(400).json({ success: false, error: 'resolution is required' });
  }
  const validStatus = ['resolved', 'dismissed', 'escalated'];
  const newStatus = validStatus.includes(status) ? status : 'resolved';
  try {
    await database.query(
      `UPDATE disputes SET status = $1, resolution = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [newStatus, resolution, authReq.userId, req.params.id]
    );
    res.json({ success: true, message: 'Dispute resolved' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}));

router.use(pharmacyRoutes);
router.use(groomingRoutes);

export default router;
