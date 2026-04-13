import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
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
  // Admin
  toggleUserStatusSchema, changeUserRoleSchema, processRefundSchema, moderateReviewSchema, updateSystemSettingSchema,
  updatePermissionSchema, bulkUpdatePermissionsSchema, resetPermissionsSchema,
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
  createNetworkReferralSchema,
  // Role Change Requests
  roleChangeRequestSchema, rejectRoleChangeSchema,
  // Network Subscriptions + Staff Invites
  createNetworkPlanSchema, updateNetworkPlanSchema,
  setNetworkSubscriptionSchema, overrideSeatLimitSchema,
  suspendNetworkSchema, updatePricingSettingsSchema,
  inviteHospitalStaffSchema, acceptStaffInviteSchema,
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
import HospitalNetworkService from '../services/HospitalNetworkService';
import WalletController from '../controllers/WalletController';
import StaffWorkflowController from '../controllers/StaffWorkflowController';
import { FileController } from '../controllers/FileController';
import { uploadAny } from '../middleware/upload';
import AdminService from '../services/AdminService';
import PermissionService from '../services/PermissionService';
import VetProfileService from '../services/VetProfileService';
import UserService from '../services/UserService';
import VaccineProtocolService from '../services/VaccineProtocolService';
import VaccineScheduleService from '../services/VaccineScheduleService';
import { asyncHandler } from '../utils/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { checkAnimalAccess, requireAnimalAccess } from '../middleware/hospitalDataIsolation';

const router = Router();

// ─── Auth routes ─────────────────────────────────────────────
router.post('/auth/register', validateBody(registerSchema), asyncHandler((req: Request, res: Response) => AuthController.register(req, res)));
router.post('/auth/login', validateBody(loginSchema), asyncHandler((req: Request, res: Response) => AuthController.login(req, res)));
router.post('/auth/refresh', validateBody(refreshTokenSchema), asyncHandler((req: Request, res: Response) => AuthController.refreshToken(req, res)));
router.post('/auth/logout', validateBody(logoutSchema), asyncHandler((req: Request, res: Response) => AuthController.logout(req, res)));
router.post('/auth/logout-all', authMiddleware, asyncHandler((req: Request, res: Response) => AuthController.logoutAll(req, res)));
router.get('/auth/profile', authMiddleware, asyncHandler((req: Request, res: Response) => AuthController.getProfile(req, res)));
router.put('/auth/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const allowed: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', phone: 'phone', avatar: 'avatar_url' };
  const updates: Record<string, unknown> = {};
  for (const [key, _col] of Object.entries(allowed)) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }
  const user = await UserService.updateUser(authReq.userId!, updates);
  res.json({ success: true, data: user });
}));

// ─── Consultation routes ─────────────────────────────────────
router.post('/consultations', authMiddleware, validateBody(createConsultationSchema), asyncHandler((req: Request, res: Response) => ConsultationController.createConsultation(req, res)));
router.get('/consultations', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.listConsultations(req, res)));
router.get('/consultations/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'consultations'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getConsultationsByAnimal(req, res)));
router.get('/consultations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.getConsultation(req, res)));
router.put('/consultations/:id', authMiddleware, validateBody(updateConsultationSchema), asyncHandler((req: Request, res: Response) => ConsultationController.updateConsultation(req, res)));

// ─── Booking routes ──────────────────────────────────────────
router.post('/bookings', authMiddleware, validateBody(createBookingSchema), asyncHandler((req: Request, res: Response) => BookingController.createBooking(req, res)));
router.get('/bookings', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.listBookings(req, res)));
router.get('/bookings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getBooking(req, res)));
router.put('/bookings/:id/confirm', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.confirmBooking(req, res)));
router.put('/bookings/:id/cancel', authMiddleware, validateBody(cancelBookingSchema), asyncHandler((req: Request, res: Response) => BookingController.cancelBooking(req, res)));
router.put('/bookings/:id/reschedule', authMiddleware, validateBody(rescheduleBookingSchema), asyncHandler((req: Request, res: Response) => BookingController.rescheduleBooking(req, res)));
router.get('/bookings/:id/action-logs', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getBookingActionLogs(req, res)));
router.get('/action-logs/my', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getMyActionLogs(req, res)));

// ─── Video Session routes ────────────────────────────────────
router.post('/video-sessions', authMiddleware, validateBody(createVideoSessionSchema), asyncHandler((req: Request, res: Response) => VideoSessionController.createSession(req, res)));
router.get('/video-sessions/active', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.listActiveSessions(req, res)));
router.get('/video-sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSession(req, res)));
router.get('/video-sessions/consultation/:consultationId', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSessionByConsultation(req, res)));
router.put('/video-sessions/:id/start', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.startSession(req, res)));
router.put('/video-sessions/:id/end', authMiddleware, validateBody(endVideoSessionSchema), asyncHandler((req: Request, res: Response) => VideoSessionController.endSession(req, res)));
router.post('/video-sessions/join/:roomId', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.joinSession(req, res)));
router.post('/video-sessions/:id/messages', authMiddleware, validateBody(sendVideoMessageSchema), asyncHandler((req: Request, res: Response) => VideoSessionController.sendMessage(req, res)));
router.get('/video-sessions/:id/messages', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getMessages(req, res)));
router.post('/video-sessions/:id/signal', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.sendSignal(req, res)));
router.get('/video-sessions/:id/signals', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSignals(req, res)));

// ─── Schedule & Availability routes ─────────────────────────
router.post('/schedules', authMiddleware, validateBody(createScheduleSchema), asyncHandler((req: Request, res: Response) => ScheduleController.createSchedule(req, res)));
router.get('/schedules/me', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getSchedules(req, res)));
router.get('/schedules/vet/:vetId', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getSchedules(req, res)));
router.put('/schedules/:id', authMiddleware, validateBody(updateScheduleSchema), asyncHandler((req: Request, res: Response) => ScheduleController.updateSchedule(req, res)));
router.delete('/schedules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.deleteSchedule(req, res)));
router.get('/availability/search', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.searchByAvailability(req, res)));
router.get('/availability/:vetId/:date', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getAvailability(req, res)));
router.get('/availability/:vetId/monthly/summary', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getMonthlyAvailability(req, res)));

// ─── Date Overrides & Time Blocks ───────────────────────────
router.post('/schedules/date-overrides', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.createDateOverride(req, res)));
router.post('/schedules/date-overrides/bulk', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.bulkCreateDateOverrides(req, res)));
router.get('/schedules/date-overrides/me', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.listDateOverrides(req, res)));
router.get('/schedules/date-overrides/vet/:vetId', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.listDateOverrides(req, res)));
router.delete('/schedules/date-overrides/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.deleteDateOverride(req, res)));
router.post('/schedules/blocked-slots', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.createBlockedSlot(req, res)));
router.get('/schedules/blocked-slots/me', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.listBlockedSlots(req, res)));
router.get('/schedules/blocked-slots/vet/:vetId', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.listBlockedSlots(req, res)));
router.delete('/schedules/blocked-slots/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.deleteBlockedSlot(req, res)));

// ─── Hospital Holidays ──────────────────────────────────────
router.post('/holidays', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.createHoliday(req, res)));
router.get('/holidays', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.listHolidays(req, res)));
router.put('/holidays/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.updateHoliday(req, res)));
router.delete('/holidays/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.deleteHoliday(req, res)));

// ─── Prescription routes ─────────────────────────────────────
router.post('/prescriptions', authMiddleware, validateBody(createPrescriptionSchema), asyncHandler((req: Request, res: Response) => PrescriptionController.createPrescription(req, res)));
router.get('/prescriptions/patients', authMiddleware, roleMiddleware(['admin', 'veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  // Return pet_owner and farmer users for standalone prescription patient selector
  const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
  const search = req.query.search as string || '';
  const params: any[] = [];
  const conditions: string[] = ["role IN ('pet_owner', 'farmer')", 'is_active = true'];
  if (search) { params.push(`%${search}%`); conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
  const { rows } = await database.query(
    `SELECT id, first_name as "firstName", last_name as "lastName", email, role FROM users WHERE ${conditions.join(' AND ')} ORDER BY first_name, last_name LIMIT $${params.length + 1}`,
    [...params, limit]
  );
  res.json({ success: true, data: { users: rows } });
}));
router.get('/prescriptions/me', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.listMyPrescriptions(req, res)));
router.get('/prescriptions/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'prescriptions'), asyncHandler((req: Request, res: Response) => PrescriptionController.listByAnimal(req, res)));
router.get('/prescriptions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.getPrescription(req, res)));
router.get('/prescriptions/consultation/:consultationId', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.listByConsultation(req, res)));
router.put('/prescriptions/:id/deactivate', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.deactivatePrescription(req, res)));

// ─── Veterinary Certificate routes ───────────────────────────
router.post('/certificates', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.createCertificate(req, res)));
router.get('/certificates/me', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.getMyCertificates(req, res)));
router.get('/certificates/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.getCertificatesByAnimal(req, res)));
router.get('/certificates/:id', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.getCertificate(req, res)));
router.put('/certificates/:id/issue', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.issueCertificate(req, res)));
router.put('/certificates/:id/revoke', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.revokeCertificate(req, res)));
router.put('/certificates/:id', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.updateCertificate(req, res)));
router.delete('/certificates/:id', authMiddleware, asyncHandler((req: Request, res: Response) => CertificateController.deleteCertificate(req, res)));

// ─── Animal / Pet routes ─────────────────────────────────────
router.post('/animals', authMiddleware, validateBody(createAnimalSchema), asyncHandler((req: Request, res: Response) => AnimalController.createAnimal(req, res)));
router.get('/animals/search/by-uid', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.searchByUniqueId(req, res)));
router.get('/animals', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.listAnimals(req, res)));
// Access-check endpoint — frontend can call this before showing a "Request Access" button
router.get('/animals/:id/access-check', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const decision = await checkAnimalAccess(authReq.userId!, authReq.userRole!, req.params.id);
  res.json({ success: true, data: { allowed: decision.allowed, isPrivate: decision.isPrivate, accessType: decision.accessType, reason: decision.reason } });
}));
router.get('/animals/:id', authMiddleware, requireAnimalAccess('params:id', 'animal_profile'), asyncHandler((req: Request, res: Response) => AnimalController.getAnimal(req, res)));
router.put('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.updateAnimal(req, res)));
router.delete('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.deleteAnimal(req, res)));

// ─── Vet Profile routes ─────────────────────────────────────
router.post('/vet-profiles', authMiddleware, validateBody(createVetProfileSchema), asyncHandler((req: Request, res: Response) => VetProfileController.createProfile(req, res)));
router.get('/vet-profiles/me', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getMyProfile(req, res)));
router.get('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.listVets(req, res)));
router.get('/vet-profiles/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getProfile(req, res)));
router.put('/vet-profiles', authMiddleware, validateBody(updateVetProfileSchema), asyncHandler((req: Request, res: Response) => VetProfileController.updateProfile(req, res)));

// ─── Enterprise / Farm routes ────────────────────────────────
router.post('/enterprises', authMiddleware, validateBody(createEnterpriseSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createEnterprise(req, res)));
router.get('/enterprises', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listEnterprises(req, res)));
router.get('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getEnterprise(req, res)));
router.put('/enterprises/:id', authMiddleware, validateBody(updateEnterpriseSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateEnterprise(req, res)));
router.delete('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteEnterprise(req, res)));
router.get('/enterprises/:id/stats', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getEnterpriseStats(req, res)));

// Enterprise Animals
router.get('/enterprises/:enterpriseId/animals', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listEnterpriseAnimals(req, res)));

// Enterprise Members
router.get('/enterprises/:id/members', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listMembers(req, res)));
router.post('/enterprises/:id/members', authMiddleware, validateBody(addMemberSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.addMember(req, res)));
router.put('/enterprises/:enterpriseId/members/:userId', authMiddleware, validateBody(updateMemberSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateMember(req, res)));
router.delete('/enterprises/:enterpriseId/members/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.removeMember(req, res)));

// Enterprise member invite by email (finds user by email then adds as member)
router.post('/enterprises/:id/invite-member', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'email and role are required' });
  }

  // Verify requester is enterprise owner or manager
  const entResult = await database.query(
    `SELECT id FROM enterprises WHERE id = $1 AND owner_id = $2`,
    [req.params.id, userId]
  );
  const memberResult = await database.query(
    `SELECT id FROM enterprise_members WHERE enterprise_id = $1 AND user_id = $2 AND role IN ('owner','manager') AND is_active = true`,
    [req.params.id, userId]
  );
  if (userRole !== 'admin' && entResult.rows.length === 0 && memberResult.rows.length === 0) {
    return res.status(403).json({ error: 'Not authorized to manage enterprise members' });
  }

  // Look up user by email
  const userResult = await database.query(
    `SELECT id FROM users WHERE email = $1 AND is_active = true`,
    [email.toLowerCase().trim()]
  );
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'No active user found with that email address' });
  }

  const targetUserId = userResult.rows[0].id;
  const EnterpriseService = (await import('../services/EnterpriseService')).default;
  const member = await EnterpriseService.addMember(req.params.id, targetUserId, role);
  res.status(201).json({ success: true, data: member });
}));

// Animal Groups
router.post('/animal-groups', authMiddleware, validateBody(createAnimalGroupSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createGroup(req, res)));
router.get('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getGroup(req, res)));
router.put('/animal-groups/:id', authMiddleware, validateBody(updateAnimalGroupSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateGroup(req, res)));
router.delete('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteGroup(req, res)));
router.get('/enterprises/:enterpriseId/groups', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listGroups(req, res)));
router.post('/animal-groups/:id/assign', authMiddleware, validateBody(assignAnimalToGroupSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.assignAnimalToGroup(req, res)));
router.delete('/animal-groups/:id/animals/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.removeAnimalFromGroup(req, res)));

// Locations
router.post('/locations', authMiddleware, validateBody(createLocationSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createLocation(req, res)));
router.get('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getLocation(req, res)));
router.put('/locations/:id', authMiddleware, validateBody(updateLocationSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateLocation(req, res)));
router.delete('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteLocation(req, res)));
router.get('/enterprises/:enterpriseId/locations', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listLocations(req, res)));
router.get('/enterprises/:enterpriseId/location-tree', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getLocationTree(req, res)));

// Movement Records
router.post('/movements', authMiddleware, validateBody(createMovementSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createMovement(req, res)));
router.get('/movements/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getMovement(req, res)));
router.get('/enterprises/:enterpriseId/movements', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listMovements(req, res)));

// Movement approval/rejection (enterprise owner or admin)
router.patch('/movements/:id/approve', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;
  const { action } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  }

  const movement = await database.query(
    `SELECT m.*, a.enterprise_id FROM movement_records m
     LEFT JOIN animals a ON a.id = m.animal_id
     WHERE m.id = $1`,
    [req.params.id]
  );

  if (movement.rows.length === 0) {
    return res.status(404).json({ error: 'Movement record not found' });
  }

  const mv = movement.rows[0];
  const enterpriseId = mv.enterprise_id || mv.enterprise_id;

  if (userRole !== 'admin') {
    const enterpriseAccess = await database.query(
      `SELECT id FROM enterprises WHERE id = $1 AND owner_id = $2`,
      [enterpriseId, userId]
    );
    if (enterpriseAccess.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to approve this movement' });
    }
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await database.query(
    `UPDATE movement_records SET status = $1, approved_by = $2 WHERE id = $3`,
    [newStatus, userId, req.params.id]
  );

  res.json({ data: { status: newStatus, message: `Movement ${newStatus}` } });
}));

// Treatment Campaigns
router.post('/campaigns', authMiddleware, validateBody(createCampaignSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.createCampaign(req, res)));
router.get('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getCampaign(req, res)));
router.put('/campaigns/:id', authMiddleware, validateBody(updateCampaignSchema), asyncHandler((req: Request, res: Response) => EnterpriseController.updateCampaign(req, res)));
router.delete('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteCampaign(req, res)));
router.get('/enterprises/:enterpriseId/campaigns', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listCampaigns(req, res)));

// ─── Hospital Network routes ──────────────────────────────────
router.post('/hospital-networks', authMiddleware, validateBody(createHospitalNetworkSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createNetwork(req, res)));
router.get('/hospital-networks', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworks(req, res)));
router.get('/hospital-networks/:id', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.getNetwork(req, res)));
router.put('/hospital-networks/:id', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.updateNetwork(req, res)));
router.post('/hospital-networks/:id/approve', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.approveNetwork(req, res)));
router.patch('/hospital-networks/:id/deactivate', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.deactivateNetwork(req, res)));
router.get('/hospital-networks/:id/hospitals', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworkHospitals(req, res)));
router.post('/hospital-networks/:id/hospitals/:hospitalId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.assignHospitalToNetwork(req, res)));
router.get('/hospital-networks/:id/members', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworkMembers(req, res)));
router.post('/hospital-networks/:id/members', authMiddleware, validateBody(addNetworkMemberSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.addNetworkMember(req, res)));
router.delete('/hospital-networks/:id/members/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.removeNetworkMember(req, res)));
router.get('/hospital-networks/:id/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.getNetworkDashboard(req, res)));
router.get('/hospital-networks/:id/audit-logs', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.getAuditLogs(req, res)));

// Enroll animal into a network (generates per-network patient ID)
router.post('/hospital-networks/:networkId/enroll-animal', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { animalId, hospitalId, notes } = req.body;
  if (!animalId) { res.status(400).json({ error: 'animalId is required' }); return; }
  const result = await HospitalNetworkService.enrollAnimal({
    animalId,
    networkId: req.params.networkId,
    hospitalId,
    enrolledBy: (req as any).userId,
    notes,
  });
  res.json(result);
}));

// List patients enrolled in a network
router.get('/hospital-networks/:networkId/patients', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await HospitalNetworkService.getNetworkPatients(req.params.networkId, limit, offset);
  res.json(result);
}));

// Get all care contexts (network enrollments) for an animal
router.get('/animals/:animalId/care-contexts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
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
  res.json(result.rows);
}));

// Patient consent routes
router.post('/patient-consent', authMiddleware, validateBody(createPatientConsentSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createConsent(req, res)));
router.get('/patient-consent/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listConsents(req, res)));
router.delete('/patient-consent/:consentId', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.revokeConsent(req, res)));

// Network Referrals
router.get('/network-referrals', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.listNetworkReferrals(req, res)));
router.post('/network-referrals', authMiddleware, validateBody(createNetworkReferralSchema), asyncHandler((req: Request, res: Response) => HospitalNetworkController.createNetworkReferral(req, res)));
router.patch('/network-referrals/:id/status', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalNetworkController.updateNetworkReferralStatus(req, res)));

// ─── Privacy-first patient enrollment routes ───────────────────
// Search existing platform patients (for hospital staff)
router.get('/hospital-networks/:networkId/search-patients', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) ?? '';
    if (!q || q.length < 2) { res.json([]); return; }
    const results = await HospitalNetworkService.searchPatients(q, 10);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

// Get all enrollments for a network (pending + active + declined)
router.get('/hospital-networks/:networkId/all-enrollments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const results = await HospitalNetworkService.getPendingEnrollments(req.params.networkId);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

// Invite a walk-in patient (no platform account)
router.post('/hospital-networks/:networkId/invite-walkin', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { patientName, patientEmail, patientPhone, animalName, animalSpecies, hospitalId, message } = req.body;
    if (!patientName || !patientEmail) { res.status(400).json({ error: 'patientName and patientEmail are required' }); return; }
    const result = await HospitalNetworkService.inviteWalkInPatient({
      networkId: req.params.networkId, hospitalId, patientName, patientEmail,
      patientPhone, animalName, animalSpecies, message,
    }, (req as any).userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

// Patient accepts enrollment request (CONSENT-BEFORE-ACCESS)
router.post('/hospital-networks/enrollments/:contextId/accept', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { consentScope } = req.body;
    await HospitalNetworkService.acceptEnrollment(req.params.contextId, (req as any).userId, consentScope);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}));

// Accept a walk-in patient invite by token (Fix 6)
router.post('/hospital-networks/walkin-invites/accept', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ error: 'token is required' }); return; }
    const result = await HospitalNetworkService.acceptWalkInInvite(token, (req as any).userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}));

// Patient declines enrollment request
router.post('/hospital-networks/enrollments/:contextId/decline', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    await HospitalNetworkService.declineEnrollment(req.params.contextId, (req as any).userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}));

// Patient views all their network enrollments
router.get('/my-network-enrollments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const results = await HospitalNetworkService.getMyEnrollments((req as any).userId);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));


// ─── Medical Record routes ───────────────────────────────────
router.get('/medical-records/stats', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getStats(req, res)));
router.get('/medical-records/audit', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getAuditLog(req, res)));
router.post('/medical-records', authMiddleware, roleMiddleware(['veterinarian', 'farmer', 'admin']), validateBody(createMedicalRecordSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createRecord(req, res)));
router.get('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listRecords(req, res)));
router.get('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getRecord(req, res)));
router.put('/medical-records/:id', authMiddleware, validateBody(updateMedicalRecordSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateRecord(req, res)));
router.delete('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteRecord(req, res)));

// ─── Vaccination routes ──────────────────────────────────────
router.post('/vaccinations', authMiddleware, validateBody(createVaccinationSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createVaccination(req, res)));
router.get('/vaccinations/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'vaccinations'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listVaccinations(req, res)));
router.put('/vaccinations/:id', authMiddleware, validateBody(updateVaccinationSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateVaccination(req, res)));
router.delete('/vaccinations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteVaccination(req, res)));

// ─── Weight History routes ───────────────────────────────────
router.post('/weight-history', authMiddleware, validateBody(addWeightSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.addWeight(req, res)));
router.get('/weight-history/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listWeightHistory(req, res)));

// ─── Allergy routes ─────────────────────────────────────────
router.post('/allergies', authMiddleware, validateBody(createAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createAllergy(req, res)));
router.get('/allergies/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listAllergies(req, res)));
router.put('/allergies/:id', authMiddleware, validateBody(updateAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateAllergy(req, res)));

// ─── Lab Result routes ──────────────────────────────────────
router.post('/lab-results', authMiddleware, validateBody(createLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createLabResult(req, res)));
router.get('/lab-results/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listLabResults(req, res)));
router.put('/lab-results/:id', authMiddleware, validateBody(updateLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateLabResult(req, res)));

// ─── Medical Timeline route ─────────────────────────────────
router.get('/timeline/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getTimeline(req, res)));

// ─── Notification routes ─────────────────────────────────────
router.get('/notifications', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.listNotifications(req, res)));
router.put('/notifications/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAsRead(req, res)));
router.put('/notifications/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAllAsRead(req, res)));

// ─── Payment routes ──────────────────────────────────────────
router.post('/payments', authMiddleware, validateBody(createPaymentSchema), asyncHandler((req: Request, res: Response) => PaymentController.createPayment(req, res)));
router.get('/payments', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.listPayments(req, res)));
router.get('/payments/booking/:bookingId', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPaymentByBooking(req, res)));
router.get('/payments/gateway-settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => PaymentController.getGatewaySettings(req, res)));
router.get('/payments/:id', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPayment(req, res)));

// ─── Wallet routes ───────────────────────────────────────────
router.get('/wallet', authMiddleware, asyncHandler((req: Request, res: Response) => WalletController.getWallet(req, res)));
router.get('/wallet/transactions', authMiddleware, asyncHandler((req: Request, res: Response) => WalletController.listTransactions(req, res)));

// ─── Doctor reliability ──────────────────────────────────────
router.get('/doctors/:vetId/reliability', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getDoctorReliability(req, res)));

// ─── Review routes ───────────────────────────────────────────
router.get('/reviews/reviewable', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.listReviewableConsultations(req, res)));
router.post('/reviews', authMiddleware, validateBody(createReviewSchema), asyncHandler((req: Request, res: Response) => ReviewController.createReview(req, res)));
router.get('/reviews/vet/:vetId', asyncHandler((req: Request, res: Response) => ReviewController.listReviews(req, res)));
router.put('/reviews/:id/vet-response', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.addVetResponse(req, res)));
router.post('/reviews/:id/helpful', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.markHelpful(req, res)));
router.post('/reviews/:id/report', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.reportReview(req, res)));

// ─── Admin routes (admin role required) ──────────────────────
router.get('/admin/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getDashboardStats(req, res)));
router.get('/admin/users', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listUsers(req, res)));
router.put('/admin/users/:id/status', authMiddleware, roleMiddleware(['admin']), validateBody(toggleUserStatusSchema), asyncHandler((req: Request, res: Response) => AdminController.toggleUserStatus(req, res)));
router.put('/admin/users/:id/role', authMiddleware, roleMiddleware(['admin']), validateBody(changeUserRoleSchema), asyncHandler((req: Request, res: Response) => AdminController.changeUserRole(req, res)));
router.get('/admin/consultations', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listConsultations(req, res)));
router.get('/admin/payments', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listPayments(req, res)));
router.post('/admin/payments/:id/refund', authMiddleware, roleMiddleware(['admin']), validateBody(processRefundSchema), asyncHandler((req: Request, res: Response) => AdminController.processRefund(req, res)));
router.get('/admin/reviews', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listReviews(req, res)));
router.put('/admin/reviews/:id/moderate', authMiddleware, roleMiddleware(['admin']), validateBody(moderateReviewSchema), asyncHandler((req: Request, res: Response) => AdminController.moderateReview(req, res)));
router.get('/admin/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getSystemSettings(req, res)));
router.put('/admin/settings', authMiddleware, roleMiddleware(['admin']), validateBody(updateSystemSettingSchema), asyncHandler((req: Request, res: Response) => AdminController.updateSystemSetting(req, res)));
router.get('/admin/audit-logs', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getAuditLogs(req, res)));
router.get('/admin/compliance/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getComplianceDashboard(req, res)));
router.get('/admin/compliance/phi-access', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getPhiAccessLog(req, res)));
router.get('/admin/compliance/user-data/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => AdminController.getUserDataSummary(req, res)));
router.get('/admin/compliance/my-data', authMiddleware, asyncHandler((req: Request, res: Response) => AdminController.getUserDataSummary(req, res)));
router.post('/admin/compliance/revoke-sessions/:userId', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.revokeUserSessions(req, res)));
router.get('/admin/cancellation-stats', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => BookingController.getCancellationStats(req, res)));
router.get('/admin/vet-profiles/:userId', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => VetProfileController.getProfile(req, res)));
router.put('/admin/vet-profiles/:userId', authMiddleware, roleMiddleware(['admin']), validateBody(updateVetProfileSchema), asyncHandler(async (req: Request, res: Response) => {
  const profile = await VetProfileService.updateProfile(req.params.userId, req.body);
  res.json({ success: true, data: profile });
}));

// ─── Permission routes ───────────────────────────────────────
router.get('/permissions/my', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const permissions = await PermissionService.getPermissionsForRole(authReq.userRole || '');
  const metadata = PermissionService.getPermissionMetadata();
  res.json({ success: true, data: { permissions, metadata } });
}));

router.get('/admin/permissions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const matrix = await PermissionService.getFullPermissionMatrix();
  const metadata = PermissionService.getPermissionMetadata();
  res.json({ success: true, data: { matrix, metadata } });
}));

router.put('/admin/permissions', authMiddleware, roleMiddleware(['admin']), validateBody(updatePermissionSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { role, permission, isEnabled } = req.body;
  await PermissionService.updatePermission(role, permission, isEnabled, authReq.userId);
  res.json({ success: true, message: `Permission ${permission} for ${role} set to ${isEnabled}` });
}));

router.put('/admin/permissions/bulk', authMiddleware, roleMiddleware(['admin']), validateBody(bulkUpdatePermissionsSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { role, permissions } = req.body;
  await PermissionService.bulkUpdatePermissions(role, permissions, authReq.userId);
  const updated = await PermissionService.getFullPermissionMatrix();
  res.json({ success: true, data: { matrix: updated }, message: `Permissions updated for ${role}` });
}));

router.post('/admin/permissions/reset', authMiddleware, roleMiddleware(['admin']), validateBody(resetPermissionsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body;
  await PermissionService.resetToDefaults(role);
  const updated = await PermissionService.getFullPermissionMatrix();
  res.json({ success: true, data: { matrix: updated }, message: `Permissions reset to defaults for ${role}` });
}));

// ═══════════════════════════════════════════════════════════════
// ─── Health Analytics ────────────────────────────────
router.get('/enterprises/:enterpriseId/health/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getHealthDashboard(req, res)));
router.get('/enterprises/:enterpriseId/health/observations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listObservations(req, res)));
router.post('/enterprises/:enterpriseId/health/observations', authMiddleware, validateBody(createObservationSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.createObservation(req, res)));
router.patch('/health/observations/:id/resolve', authMiddleware, validateBody(resolveObservationSchema), asyncHandler((req: Request, res: Response) => Tier2Controller.resolveObservation(req, res)));

// ─── Enterprise / Herd Medical Management ────────────
router.get('/enterprises/:enterpriseId/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listEnterpriseRecords(req, res)));
router.get('/enterprises/:enterpriseId/medical-records/stats', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getEnterpriseMedicalStats(req, res)));
router.get('/enterprises/:enterpriseId/vaccinations', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listEnterpriseVaccinations(req, res)));

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
router.get('/hospitals/:hospitalId/staff', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.listStaffPositions(req, res)));
router.post('/hospitals/:hospitalId/staff', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.addStaffPosition(req, res)));
router.put('/staff-positions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.updateStaffPosition(req, res)));
router.delete('/staff-positions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.removeStaffPosition(req, res)));
// Appointment Queue
router.get('/hospitals/:hospitalId/queue', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getQueue(req, res)));
router.post('/hospitals/:hospitalId/queue/check-in', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.checkInToQueue(req, res)));
router.patch('/queue/:id/triage', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.triagePatient(req, res)));
router.patch('/queue/:id/status', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.updateQueueStatus(req, res)));
router.get('/hospitals/:hospitalId/queue/stats', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getQueueStats(req, res)));
// Clinical Workflow
router.get('/hospitals/:hospitalId/workflow/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getWorkflowDashboard(req, res)));
router.get('/hospitals/:hospitalId/workflow/cases', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.listWorkflowCases(req, res)));
router.post('/hospitals/:hospitalId/workflow/cases', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.createWorkflowCase(req, res)));
router.get('/workflow/cases/:id', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getWorkflowCaseDetail(req, res)));
router.put('/workflow/cases/:id', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.updateWorkflowCase(req, res)));
router.patch('/workflow/cases/:id/transition', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.transitionWorkflowStage(req, res)));
// Referrals
router.get('/vets/search', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.searchVets(req, res)));
router.get('/hospitals/:hospitalId/referrals', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.listReferrals(req, res)));
router.post('/hospitals/:hospitalId/referrals', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.createReferral(req, res)));
router.patch('/referrals/:id/status', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.updateReferralStatus(req, res)));
// Inpatient / Boarding
router.get('/hospitals/:hospitalId/inpatient/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getInpatientDashboard(req, res)));
router.get('/hospitals/:hospitalId/inpatient', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.listInpatients(req, res)));
router.post('/hospitals/:hospitalId/inpatient/admit', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.admitPatient(req, res)));
router.patch('/inpatient/:id/status', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.updateInpatientStatus(req, res)));
router.post('/inpatient/:id/vitals', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.addVitalsLog(req, res)));
router.put('/inpatient/:id', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.updateInpatientDetails(req, res)));
router.get('/animals/:animalId/hospital-visits', authMiddleware, asyncHandler((req: Request, res: Response) => StaffWorkflowController.getAnimalHospitalVisits(req, res)));

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

// ─── Marketplace & Auctions ─────────────────────────
router.get('/marketplace/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceDashboard(req, res)));
router.get('/marketplace/listings', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceListings(req, res)));
router.get('/marketplace/listings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceListing(req, res)));
router.post('/marketplace/listings', authMiddleware, validateBody(createMarketplaceListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceListing(req, res)));
router.put('/marketplace/listings/:id', authMiddleware, validateBody(updateMarketplaceListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMarketplaceListing(req, res)));
router.delete('/marketplace/listings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplaceListing(req, res)));
router.get('/marketplace/listings/:listingId/bids', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceBids(req, res)));
router.post('/marketplace/listings/:listingId/bids', authMiddleware, validateBody(placeBidSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.placeMarketplaceBid(req, res)));
router.get('/marketplace/orders', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceOrders(req, res)));
router.post('/marketplace/orders', authMiddleware, validateBody(createMarketplaceOrderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceOrder(req, res)));
router.patch('/marketplace/orders/:id/status', authMiddleware, validateBody(updateOrderStatusSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateOrderStatus(req, res)));
router.get('/marketplace/prices', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketPrices(req, res)));
// Admin marketplace controls
router.get('/marketplace/admin/listings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminListMarketplaceListings(req, res)));
router.get('/marketplace/admin/stats', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceStats(req, res)));
router.patch('/marketplace/admin/listings/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminApproveMarketplaceListing(req, res)));
router.patch('/marketplace/admin/listings/:id/reject', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminRejectMarketplaceListing(req, res)));
router.patch('/marketplace/admin/listings/:id/hot-deal', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminToggleHotDeal(req, res)));
router.patch('/marketplace/admin/listings/:id/featured', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminToggleFeatured(req, res)));
// Marketplace Monetization — Admin
router.get('/marketplace/admin/monetization/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMonetizationSettings(req, res)));
router.put('/marketplace/admin/monetization/settings/:key', authMiddleware, roleMiddleware(['admin']), validateBody(updateMonetizationSettingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMonetizationSetting(req, res)));
router.get('/marketplace/admin/monetization/plans', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplacePlans(req, res)));
router.post('/marketplace/admin/monetization/plans', authMiddleware, roleMiddleware(['admin']), validateBody(createMPlanSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplacePlan(req, res)));
router.put('/marketplace/admin/monetization/plans/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMPlanSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMarketplacePlan(req, res)));
router.delete('/marketplace/admin/monetization/plans/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplacePlan(req, res)));
router.get('/marketplace/admin/monetization/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMonetizationDashboard(req, res)));
// Marketplace Monetization — User
router.get('/marketplace/subscription', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getUserSubscription(req, res)));
router.post('/marketplace/subscription', authMiddleware, validateBody(createSubscriptionSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createUserSubscription(req, res)));
router.delete('/marketplace/subscription', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.cancelUserSubscription(req, res)));
router.post('/marketplace/listings/:id/boost', authMiddleware, validateBody(boostListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.boostMarketplaceListing(req, res)));
router.post('/marketplace/listings/:listingId/inquiries', authMiddleware, validateBody(createInquirySchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceInquiry(req, res)));
router.get('/marketplace/inquiries', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceInquiries(req, res)));
router.patch('/marketplace/inquiries/:id/respond', authMiddleware, validateBody(respondInquirySchema), asyncHandler((req: Request, res: Response) => Tier4Controller.respondToMarketplaceInquiry(req, res)));
router.get('/marketplace/monetization-status', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getUserMonetizationStatus(req, res)));

// ─── Sustainability & Carbon Tracking ───────────────
router.get('/enterprises/:enterpriseId/sustainability/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getSustainabilityDashboard(req, res)));
router.get('/enterprises/:enterpriseId/sustainability/metrics', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listSustainabilityMetrics(req, res)));
router.post('/enterprises/:enterpriseId/sustainability/metrics', authMiddleware, validateBody(createSustainabilityMetricSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createSustainabilityMetric(req, res)));
router.put('/sustainability/metrics/:id', authMiddleware, validateBody(updateSustainabilityMetricSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateSustainabilityMetric(req, res)));
router.delete('/sustainability/metrics/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteSustainabilityMetric(req, res)));
router.get('/enterprises/:enterpriseId/sustainability/goals', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listSustainabilityGoals(req, res)));
router.post('/enterprises/:enterpriseId/sustainability/goals', authMiddleware, validateBody(createSustainabilityGoalSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createSustainabilityGoal(req, res)));
router.put('/sustainability/goals/:id', authMiddleware, validateBody(updateSustainabilityGoalSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateSustainabilityGoal(req, res)));
router.delete('/sustainability/goals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteSustainabilityGoal(req, res)));
router.get('/enterprises/:enterpriseId/sustainability/carbon-footprint', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getCarbonFootprint(req, res)));

// ─── Client Portal & Wellness ───────────────────────
router.get('/wellness/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getWellnessDashboard(req, res)));
router.get('/wellness/scorecards', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listWellnessScorecards(req, res)));
router.post('/wellness/scorecards', authMiddleware, validateBody(createWellnessScorecardSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createWellnessScorecard(req, res)));
router.put('/wellness/scorecards/:id', authMiddleware, validateBody(updateWellnessScorecardSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateWellnessScorecard(req, res)));
router.delete('/wellness/scorecards/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteWellnessScorecard(req, res)));
router.get('/wellness/reminders', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listWellnessReminders(req, res)));
router.post('/wellness/reminders', authMiddleware, validateBody(createWellnessReminderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createWellnessReminder(req, res)));
router.patch('/wellness/reminders/:id/complete', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.completeReminder(req, res)));
router.patch('/wellness/reminders/:id/snooze', authMiddleware, validateBody(snoozeReminderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.snoozeReminder(req, res)));
router.delete('/wellness/reminders/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteWellnessReminder(req, res)));

// ─── Geospatial Analytics & Geofencing ──────────────
router.get('/enterprises/:enterpriseId/geospatial/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getGeospatialDashboard(req, res)));
router.get('/enterprises/:enterpriseId/geospatial/zones', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listGeofenceZones(req, res)));
router.post('/enterprises/:enterpriseId/geospatial/zones', authMiddleware, validateBody(createGeofenceZoneSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createGeofenceZone(req, res)));
router.put('/geospatial/zones/:id', authMiddleware, validateBody(updateGeofenceZoneSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateGeofenceZone(req, res)));
router.delete('/geospatial/zones/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteGeofenceZone(req, res)));
router.get('/enterprises/:enterpriseId/geospatial/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listGeospatialEvents(req, res)));
router.post('/enterprises/:enterpriseId/geospatial/events', authMiddleware, validateBody(createGeospatialEventSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createGeospatialEvent(req, res)));
router.get('/enterprises/:enterpriseId/geospatial/heatmap', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getHeatmapData(req, res)));
router.get('/geospatial/animals/:animalId/trail', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMovementTrail(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── Public settings (no auth) ───────────────────────────────
router.get('/settings/public', asyncHandler(async (_req: Request, res: Response) => {
  const settings = await AdminService.getPublicSettings();
  res.json({ success: true, data: settings });
}));

// ─── Public Marketplace (no auth required) ───────────────────
router.get('/public/marketplace/listings', asyncHandler((req: Request, res: Response) => Tier4Controller.publicListMarketplaceListings(req, res)));
router.get('/public/marketplace/listings/:id', asyncHandler((req: Request, res: Response) => Tier4Controller.publicGetMarketplaceListing(req, res)));
router.get('/public/marketplace/stats', asyncHandler((req: Request, res: Response) => Tier4Controller.publicGetMarketplaceStats(req, res)));

// ─── Health check & feature flags ────────────────────────────
router.get('/health', async (_req, res) => {
  const checks: Record<string, any> = { api: 'ok' };
  let httpStatus = 200;

  // Database connectivity check
  try {
    const dbResult = await database.query('SELECT 1 AS ok');
    checks.database = dbResult.rows?.[0]?.ok === 1 ? 'ok' : 'degraded';
  } catch {
    checks.database = 'down';
    httpStatus = 503;
  }

  // Schema + users table check (critical for login)
  try {
    const schema = process.env.DB_SCHEMA || 'public';
    const tableCheck = await database.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users') AS users_exists`, [schema]
    );
    const usersExists = tableCheck.rows[0]?.users_exists;
    if (usersExists) {
      const countCheck = await database.query('SELECT COUNT(*)::int AS cnt FROM users');
      checks.schema = schema;
      checks.usersTable = 'ok';
      checks.userCount = countCheck.rows[0]?.cnt ?? 0;
    } else {
      checks.schema = schema;
      checks.usersTable = 'missing';
      httpStatus = 503;
    }
  } catch (e: any) {
    checks.usersTable = 'error: ' + e.message;
    httpStatus = 503;
  }

  // Cache check
  try {
    const cacheOk = cacheManager !== undefined;
    checks.cache = cacheOk ? 'ok' : 'unavailable';
  } catch {
    checks.cache = 'unavailable';
  }

  const overall = httpStatus === 200 ? 'healthy' : 'unhealthy';

  res.status(httpStatus).json({
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  });
});

router.get('/features', (_req, res) => {
  res.json({ success: true, data: getAllFeatureFlags() });
});

// ─── File Uploads ────────────────────────────────────────────
router.post('/files/upload', authMiddleware, uploadAny.single('file'), asyncHandler((req: Request, res: Response) => FileController.upload(req, res)));
router.post('/files/upload-multiple', authMiddleware, uploadAny.array('files', 10), asyncHandler((req: Request, res: Response) => FileController.uploadMultiple(req, res)));
router.get('/files', authMiddleware, asyncHandler((req: Request, res: Response) => FileController.list(req, res)));
router.delete('/files/*', authMiddleware, asyncHandler((req: Request, res: Response) => FileController.remove(req, res)));

// ─── Vet Hospital routes ─────────────────────────────────────
router.post('/vet-hospitals', authMiddleware, validateBody(createHospitalSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.createHospital(req, res)));
router.get('/vet-hospitals', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listHospitals(req, res)));
router.get('/vet-hospitals/my', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listMyHospitals(req, res)));
router.get('/vet-hospitals/admin/stats', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.getAdminStats(req, res)));
// Doctor Invite public routes (must come before :id param)
router.get('/vet-hospitals/invites/token/:token', asyncHandler((req: Request, res: Response) => VetHospitalController.getInviteByToken(req, res)));
router.post('/vet-hospitals/invites/accept', asyncHandler((req: Request, res: Response) => VetHospitalController.acceptInvite(req, res)));
router.get('/vet-hospitals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.getHospital(req, res)));
router.put('/vet-hospitals/:id', authMiddleware, validateBody(updateHospitalSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateHospital(req, res)));
router.delete('/vet-hospitals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.deleteHospital(req, res)));
router.put('/vet-hospitals/:id/verify', authMiddleware, validateBody(verifyHospitalSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.verifyHospital(req, res)));
router.get('/vet-hospitals/:id/stats', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.getHospitalStats(req, res)));
// Doctors
router.get('/vet-hospitals/:id/doctors', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listDoctors(req, res)));
router.post('/vet-hospitals/:id/doctors', authMiddleware, validateBody(addHospitalDoctorSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.addDoctor(req, res)));
router.put('/vet-hospitals/:id/doctors/:doctorId', authMiddleware, validateBody(updateHospitalDoctorSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateDoctor(req, res)));
router.delete('/vet-hospitals/:id/doctors/:doctorId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.removeDoctor(req, res)));
// Departments
router.get('/vet-hospitals/:id/departments', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listDepartments(req, res)));
router.post('/vet-hospitals/:id/departments', authMiddleware, validateBody(createDepartmentSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.createDepartment(req, res)));
router.put('/vet-hospitals/:id/departments/:deptId', authMiddleware, validateBody(updateDepartmentSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateDepartment(req, res)));
router.delete('/vet-hospitals/:id/departments/:deptId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.deleteDepartment(req, res)));
// Services
router.get('/vet-hospitals/:id/services', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listServices(req, res)));
router.post('/vet-hospitals/:id/services', authMiddleware, validateBody(createHospitalServiceSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.addService(req, res)));
router.put('/vet-hospitals/:id/services/:serviceId', authMiddleware, validateBody(updateHospitalServiceSchema), asyncHandler((req: Request, res: Response) => VetHospitalController.updateService(req, res)));
router.delete('/vet-hospitals/:id/services/:serviceId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.deleteService(req, res)));
// Hospital Bookings (appointments at this hospital)
router.get('/vet-hospitals/:id/bookings', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listHospitalBookings(req, res)));
// Doctor Invites
router.post('/vet-hospitals/:id/invites', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.inviteDoctor(req, res)));
router.get('/vet-hospitals/:id/invites', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.listInvites(req, res)));
router.delete('/vet-hospitals/:id/invites/:inviteId', authMiddleware, asyncHandler((req: Request, res: Response) => VetHospitalController.revokeInvite(req, res)));
// Documents (KYC / Compliance)
router.get('/vet-hospitals/admin/pending', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalDocumentController.listPendingVerification(req, res)));
router.get('/vet-hospitals/:id/documents', authMiddleware, asyncHandler((req: Request, res: Response) => HospitalDocumentController.listDocuments(req, res)));
router.post('/vet-hospitals/:id/documents', authMiddleware, uploadAny.any(), asyncHandler((req: Request, res: Response) => HospitalDocumentController.uploadDocument(req, res)));
router.put('/vet-hospitals/:id/documents/:docId/review', authMiddleware, validateBody(reviewHospitalDocSchema), asyncHandler((req: Request, res: Response) => HospitalDocumentController.reviewDocument(req, res)));

// ─── Vaccine Protocol routes (admin CRUD) ────────────────────
router.get('/admin/vaccine-protocols', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { species, category, country, activeOnly } = req.query as Record<string, string>;
  const protocols = await VaccineProtocolService.listProtocols({
    species, category, country, activeOnly: activeOnly !== 'false',
  });
  const stats = await VaccineProtocolService.getProtocolStats();
  res.json({ success: true, data: { protocols, stats } });
}));

router.post('/admin/vaccine-protocols', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const protocol = await VaccineProtocolService.createProtocol({
    ...req.body, createdBy: authReq.userId,
  });
  res.status(201).json({ success: true, data: protocol });
}));

router.get('/admin/vaccine-protocols/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const protocol = await VaccineProtocolService.getProtocol(req.params.id);
  if (!protocol) return res.status(404).json({ success: false, message: 'Protocol not found' });
  res.json({ success: true, data: protocol });
}));

router.put('/admin/vaccine-protocols/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const protocol = await VaccineProtocolService.updateProtocol(req.params.id, req.body, authReq.userId);
  res.json({ success: true, data: protocol });
}));

router.patch('/admin/vaccine-protocols/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await VaccineProtocolService.archiveProtocol(req.params.id);
  res.json({ success: true, message: 'Protocol archived' });
}));

router.patch('/admin/vaccine-protocols/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await VaccineProtocolService.restoreProtocol(req.params.id);
  res.json({ success: true, message: 'Protocol restored' });
}));

// Regulatory change tracking
router.get('/admin/vaccine-protocols/:id/changes', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const changes = await VaccineProtocolService.getProtocolChangeHistory(req.params.id);
  res.json({ success: true, data: changes });
}));

router.post('/admin/vaccine-protocols/:id/changes', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const change = await VaccineProtocolService.addProtocolChange({
    protocolId: req.params.id,
    ...req.body,
    changedBy: authReq.userId,
  });
  res.status(201).json({ success: true, data: change });
}));

// ─── Vaccine protocols — public read (authenticated) ─────────
router.get('/vaccine-protocols', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { species, category, country } = req.query as Record<string, string>;
  const protocols = await VaccineProtocolService.listProtocols({ species, category, country, activeOnly: true });
  res.json({ success: true, data: protocols });
}));

router.get('/vaccine-protocols/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const protocol = await VaccineProtocolService.getProtocol(req.params.id);
  if (!protocol) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: protocol });
}));

// ─── Animal vaccine assignment routes ────────────────────────
router.get('/animals/:animalId/vaccine-assignments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const assignments = await VaccineProtocolService.getAnimalAssignments(req.params.animalId);
  res.json({ success: true, data: assignments });
}));

router.post('/animals/:animalId/vaccine-assignments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { protocolId, notes } = req.body;
  if (!protocolId) return res.status(400).json({ success: false, message: 'protocolId required' });
  const assignment = await VaccineProtocolService.assignProtocolToAnimal(
    req.params.animalId, protocolId, authReq.userId!, notes
  );
  // Auto-generate schedule rows
  const animalRes = await database.query(
    `SELECT date_of_birth FROM animals WHERE id = $1`, [req.params.animalId]
  );
  await VaccineScheduleService.generateScheduleForAnimal(
    req.params.animalId, protocolId, animalRes.rows[0]?.date_of_birth ?? null
  );
  res.status(201).json({ success: true, data: assignment });
}));

router.patch('/animals/:animalId/vaccine-assignments/:protocolId/waive', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  await VaccineProtocolService.waiverProtocol(req.params.animalId, req.params.protocolId, reason || 'Owner waiver');
  res.json({ success: true, message: 'Protocol waived' });
}));

// ─── Vaccine schedule routes ─────────────────────────────────
router.get('/vaccine-schedule/animal/:animalId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const rows = await VaccineScheduleService.getAnimalSchedule(req.params.animalId);
  res.json({ success: true, data: rows });
}));

router.patch('/vaccine-schedule/:scheduleId/administer', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { vaccinationRecordId, administeredAt } = req.body;
  if (!vaccinationRecordId) return res.status(400).json({ success: false, message: 'vaccinationRecordId required' });
  await VaccineScheduleService.markDoseAdministered(
    req.params.scheduleId, vaccinationRecordId, administeredAt || new Date().toISOString().split('T')[0]
  );
  res.json({ success: true, message: 'Dose marked administered' });
}));

// ─── Vaccination Passport routes ─────────────────────────────
router.get('/vaccination-passport/animal/:animalId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // Pet owners and farmers may only access their own animal's passport
  if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
    const { rows } = await database.query(
      'SELECT owner_id FROM animals WHERE id = $1',
      [req.params.animalId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Animal not found' });
    if (rows[0].owner_id !== authReq.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const passport = await VaccineScheduleService.getAnimalPassport(req.params.animalId);
  if (!passport) return res.status(404).json({ success: false, message: 'Animal not found' });
  res.json({ success: true, data: passport });
}));

router.get('/vaccination-passport/compliance-summary', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { enterpriseId, species } = req.query as Record<string, string>;
  const isAdmin = authReq.userRole === 'admin';
  const isVet = authReq.userRole === 'veterinarian';
  const ownerId = (isAdmin || isVet) ? undefined : authReq.userId;
  const data = await VaccineScheduleService.getComplianceSummary({
    enterpriseId: enterpriseId || undefined,
    ownerId,
    species: species || undefined,
  });
  res.json({ success: true, data });
}));

// ─── Certificate log routes ───────────────────────────────────
router.post('/vaccine-certificate-log', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { animalId, vaccinationRecordId, certificateType, fileName } = req.body;
  if (!animalId) return res.status(400).json({ success: false, message: 'animalId required' });
  const entry = await VaccineProtocolService.logCertificateDownload({
    animalId,
    vaccinationRecordId: vaccinationRecordId ?? null,
    generatedBy: authReq.userId!,
    certificateType: certificateType ?? 'single',
    fileName: fileName ?? null,
  });
  res.status(201).json({ success: true, data: entry });
}));

router.get('/vaccine-certificate-log/animal/:animalId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // Pet owners and farmers may only view certificate logs for their own animals
  if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
    const { rows } = await database.query(
      'SELECT owner_id FROM animals WHERE id = $1',
      [req.params.animalId]
    );
    if (rows[0] && rows[0].owner_id !== authReq.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }
  const logs = await VaccineProtocolService.getCertificateLogs(req.params.animalId);
  res.json({ success: true, data: logs });
}));

// ─── Role Change Requests ─────────────────────────────────────
// User submits a role change request
router.post('/role-change-requests', authMiddleware, validateBody(roleChangeRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { requested_role, reason } = req.body;
  const userId = authReq.userId;
  const currentRole = authReq.role;
  if (requested_role === currentRole) {
    return res.status(400).json({ success: false, message: 'Requested role is the same as your current role' });
  }
  const existing = await (await import('../utils/database')).default.query(
    `SELECT id FROM role_change_requests WHERE user_id = $1 AND status = 'pending'`, [userId]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: 'You already have a pending role change request' });
  }
  const result = await (await import('../utils/database')).default.query(
    `INSERT INTO role_change_requests (user_id, "current_role", requested_role, reason)
     VALUES ($1, $2, $3, $4) RETURNING id, status, created_at`,
    [userId, currentRole, requested_role, reason]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

// User views their own role change requests
router.get('/role-change-requests/my', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const result = await (await import('../utils/database')).default.query(
    `SELECT r.id, r."current_role" AS "currentRole", r.requested_role AS "requestedRole",
            r.reason, r.status, r.rejection_reason AS "rejectionReason",
            r.reviewed_at AS "reviewedAt", r.created_at AS "createdAt",
            u.first_name || ' ' || u.last_name AS "reviewedBy"
     FROM role_change_requests r
     LEFT JOIN users u ON u.id = r.reviewed_by
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [authReq.userId]
  );
  res.json({ success: true, data: result.rows });
}));

// User cancels their own pending request
router.put('/role-change-requests/:id/cancel', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const result = await (await import('../utils/database')).default.query(
    `UPDATE role_change_requests SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
    [req.params.id, authReq.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found or already processed' });
  res.json({ success: true });
}));

// Admin lists all role change requests
router.get('/admin/role-change-requests', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { status = 'pending' } = req.query;
  const result = await (await import('../utils/database')).default.query(
    `SELECT r.id, r."current_role" AS "currentRole", r.requested_role AS "requestedRole",
            u.email AS "userEmail", u.unique_id AS "uniqueId",
            rev.first_name || ' ' || rev.last_name AS "reviewedBy"
     FROM role_change_requests r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN users rev ON rev.id = r.reviewed_by
     WHERE r.status = $1
     ORDER BY r.created_at ASC`,
    [status]
  );
  res.json({ success: true, data: result.rows });
}));

// Admin approves a role change request
router.put('/admin/role-change-requests/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const rcrResult = await db.query(
    `SELECT r.*, u.id AS "uid" FROM role_change_requests r JOIN users u ON u.id = r.user_id WHERE r.id = $1`,
    [req.params.id]
  );
  if (rcrResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
  const rcr = rcrResult.rows[0];
  if (rcr.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is no longer pending' });
  await db.query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, [rcr.requested_role, rcr.uid]);
  await db.query(
    `UPDATE role_change_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [authReq.userId, req.params.id]
  );
  res.json({ success: true, message: 'Role change approved. User must re-login to receive new permissions.' });
}));

// Admin rejects a role change request
router.put('/admin/role-change-requests/:id/reject', authMiddleware, roleMiddleware(['admin']), validateBody(rejectRoleChangeSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { rejection_reason } = req.body;
  const db = (await import('../utils/database')).default;
  const rcrResult = await db.query(`SELECT id, status FROM role_change_requests WHERE id = $1`, [req.params.id]);
  if (rcrResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
  if (rcrResult.rows[0].status !== 'pending') return res.status(400).json({ success: false, message: 'Request is no longer pending' });
  await db.query(
    `UPDATE role_change_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2, updated_at = NOW() WHERE id = $3`,
    [authReq.userId, rejection_reason, req.params.id]
  );
  res.json({ success: true });
}));


// ─────────────────────────────────────────────────────────────────────────────
// NETWORK SUBSCRIPTION PLANS (platform admin only)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/network-subscription-plans', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const isAdmin = authReq.role === 'admin';
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
      (SELECT COUNT(*) FROM vet_hospitals vh WHERE vh.network_id = hn.id) AS "hospitalsCount"
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
// PRICING VISIBILITY (public endpoint + admin management)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/pricing/plans', asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const [plansResult, settingsResult] = await Promise.all([
    db.query(`SELECT id, name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, sort_order FROM network_subscription_plans WHERE is_published = true AND is_active = true ORDER BY sort_order`),
    db.query(`SELECT key, value FROM system_settings WHERE key LIKE 'pricing.%'`),
  ]);
  const settings: Record<string, string> = {};
  for (const row of settingsResult.rows) settings[row.key] = row.value;
  const globalVisible = settings['pricing.visibility.global'] === 'true';
  res.json({ success: true, data: {
    isVisible: globalVisible,
    plans: globalVisible ? plansResult.rows : [],
    ctaText: settings['pricing.cta_text'] || 'Contact us for pricing',
    ctaEmail: settings['pricing.cta_email'] || '',
    ctaPhone: settings['pricing.cta_phone'] || '',
    visibility: {
      global: globalVisible,
      landing_page: settings['pricing.visibility.landing_page'] === 'true',
      registration: settings['pricing.visibility.registration'] === 'true',
      corp_dashboard: settings['pricing.visibility.corp_dashboard'] === 'true',
      upgrade_prompts: settings['pricing.visibility.upgrade_prompts'] === 'true',
    },
  }});
}));

router.get('/admin/pricing-settings', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const [plansResult, settingsResult] = await Promise.all([
    db.query(`SELECT * FROM network_subscription_plans ORDER BY sort_order`),
    db.query(`SELECT key, value FROM system_settings WHERE key LIKE 'pricing.%'`),
  ]);
  const settings: Record<string, string> = {};
  for (const row of settingsResult.rows) settings[row.key] = row.value;
  res.json({ success: true, data: { plans: plansResult.rows, settings } });
}));

router.put('/admin/pricing-settings', authMiddleware, roleMiddleware(['admin']), validateBody(updatePricingSettingsSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  for (const [key, value] of Object.entries(req.body)) {
    await db.query(`INSERT INTO system_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`, [key, String(value)]);
  }
  res.json({ success: true });
}));

router.get('/my-network-subscription', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const netResult = await db.query(
    `SELECT id FROM hospital_networks WHERE id IN (SELECT network_id FROM hospital_network_members WHERE user_id=$1 AND network_role='corporate_admin' AND is_active=true) LIMIT 1`,
    [authReq.userId]
  );
  if (netResult.rows.length === 0) return res.json({ success: true, data: null });
  const networkId = netResult.rows[0].id;
  const result = await db.query(
    `SELECT ns.*, nsp.name AS "planName", nsp.price_monthly AS "priceMonthly", nsp.price_annually AS "priceAnnually",
      (SELECT COUNT(*) FROM hospital_network_members m WHERE m.network_id=ns.network_id AND m.is_active=true) AS "seatsUsed"
     FROM network_subscriptions ns LEFT JOIN network_subscription_plans nsp ON nsp.id=ns.plan_id WHERE ns.network_id=$1`,
    [networkId]
  );
  const vis = await db.query(`SELECT value FROM system_settings WHERE key='pricing.visibility.corp_dashboard'`);
  const showPrice = vis.rows[0]?.value === 'true';
  const sub = result.rows[0] || { network_id: networkId, seat_limit: 5, status: 'trial', seatsUsed: 0, planName: 'Trial' };
  if (!showPrice) { delete sub.priceMonthly; delete sub.priceAnnually; }
  res.json({ success: true, data: sub });
}));

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL STAFF INVITES (invite-only registration for hospital_staff role)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/hospital-networks/:id/invite-staff', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian']), validateBody(inviteHospitalStaffSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const networkId = req.params.id;
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
    [networkId, hospital_id||null, authReq.userId, invitee_email, invitee_name, staff_position, token]);
  res.status(201).json({ success: true, message: 'Invite created. Share the acceptance link with the staff member.', data: { token, expires_in: '72 hours' } });
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
  const seat = await checkSeatLimit(invite.network_id, db);
  if (!seat.allowed) return res.status(403).json({ success: false, message: 'Seat limit reached. Contact your network administrator.', code: 'seat_limit_exceeded' });
  const existing = await db.query(`SELECT id FROM users WHERE email=$1`, [invite.invitee_email]);
  if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });
  const bcrypt = require('bcryptjs');
  const password_hash = await bcrypt.hash(password, 12);
  const userResult = await db.query(
    `INSERT INTO users (email, first_name, last_name, phone, role, password_hash) VALUES ($1,$2,$3,$4,'hospital_staff',$5) RETURNING id, email, first_name, last_name, role`,
    [invite.invitee_email, first_name, last_name, phone, password_hash]
  );
  const newUser = userResult.rows[0];
  await db.query(`INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by) VALUES ($1,$2,'hospital_staff',$3,$4) ON CONFLICT (network_id, user_id) DO NOTHING`,
    [invite.network_id, newUser.id, invite.hospital_id, invite.invited_by]);
  await db.query(`INSERT INTO staff_positions (hospital_id, user_id, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [invite.hospital_id, newUser.id, invite.staff_position]).catch(()=>{});
  await db.query(`UPDATE hospital_staff_invites SET status='accepted', accepted_at=NOW(), accepted_user_id=$1 WHERE invite_token=$2`, [newUser.id, token]);
  res.status(201).json({ success: true, message: 'Account created successfully. You can now log in.' });
}));

router.get('/hospital-networks/:id/staff-invites', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const result = await db.query(
    `SELECT hsi.*, u.first_name AS "inviterFirstName", u.last_name AS "inviterLastName", vh.name AS "hospitalName" FROM hospital_staff_invites hsi JOIN users u ON u.id=hsi.invited_by LEFT JOIN vet_hospitals vh ON vh.id=hsi.hospital_id WHERE hsi.network_id=$1 ORDER BY hsi.created_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: result.rows });
}));

router.delete('/hospital-networks/:id/staff-invites/:inviteId', authMiddleware, roleMiddleware(['admin', 'corporate_admin', 'veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  await db.query(`UPDATE hospital_staff_invites SET status='revoked', updated_at=NOW() WHERE id=$1 AND network_id=$2 AND status='pending'`, [req.params.inviteId, req.params.id]);
  res.json({ success: true });
}));

export default router;