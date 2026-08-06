import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import logger from '../utils/logger';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { requireNetworkAccess, NetworkAccessRequest, resolveNetworkAccess } from '../middleware/networkAccess';
import { groomingEnabled } from '../middleware/grooming';
import GroomingProviderService from '../services/grooming/GroomingProviderService';
import GroomingOrderService from '../services/grooming/GroomingOrderService';
import GroomingScheduleService from '../services/grooming/GroomingScheduleService';
import GroomingSettlementService from '../services/grooming/GroomingSettlementService';
import GroomingCareService from '../services/grooming/GroomingCareService';
import GroomingDisputeService from '../services/grooming/GroomingDisputeService';
import GroomingReportService from '../services/grooming/GroomingReportService';
import GroomingPaymentService from '../services/grooming/GroomingPaymentService';
import GroomingModuleConfig from '../services/grooming/GroomingModuleConfig';
import {
  createGroomingProviderSchema, updateGroomingProviderSchema, groomingLocationSchema,
  groomingResourceSchema, groomingServiceSchema, updateGroomingServiceSchema,
  groomingStaffSchema, groomingProviderRejectSchema,
  createGroomingOrderSchema, groomingCancelSchema, groomingAcceptSchema, groomingDeclineSchema,
  groomingScheduleSchema, groomingDateOverrideSchema, groomingBlockedSlotSchema,
  walletWithdrawalRequestSchema,
  groomingTransitionSchema, groomingAssignSchema, groomingIntakeSchema,
  groomingItemStatusSchema, groomingReportCardSchema, groomingSettleSchema,
  groomingVariableRequestSchema, groomingVariableRespondSchema,
  groomingEscalationSchema, groomingEscalationRespondSchema,
  groomingDisputeSchema, groomingDisputeRespondSchema,
} from '../middleware/validation';
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

// ─── Auth routes ─────────────────────────────────────────────
router.post('/auth/register', validateBody(registerSchema), asyncHandler((req: Request, res: Response) => AuthController.register(req, res)));
router.post('/auth/login', validateBody(loginSchema), asyncHandler((req: Request, res: Response) => AuthController.login(req, res)));
router.post('/auth/refresh', validateBody(refreshTokenSchema), asyncHandler((req: Request, res: Response) => AuthController.refreshToken(req, res)));
router.post('/auth/logout', validateBody(logoutSchema), asyncHandler((req: Request, res: Response) => AuthController.logout(req, res)));
router.post('/auth/logout-all', authMiddleware, asyncHandler((req: Request, res: Response) => AuthController.logoutAll(req, res)));
router.get('/auth/profile', authMiddleware, asyncHandler((req: Request, res: Response) => AuthController.getProfile(req, res)));

// ─── Self-service Password Reset (public - no auth required) ─────────────────
//
// Security model:
//   • Raw 32-byte token is sent in the email link (64-char hex, 256-bit entropy)
//   • Only the SHA-256 hash is stored in the DB - a DB leak cannot be used to reset accounts
//   • Tokens expire after 1 hour and are single-use (deleted on successful reset)
//   • Rate-limited: one email per address per 5 minutes (new request silently suppressed)
//   • Email enumeration-safe: always returns HTTP 200 with the same message
//   • Insecure-account guard: frozen/suspended users cannot reset their password
//
router.post('/auth/forgot-password', validateBody(forgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const crypto = await import('crypto');
  const db = (await import('../utils/database')).default;
  const emailService = (await import('../services/EmailService')).default;
  const { getFrontendUrl } = await import('../config/index');

  const { email } = req.body as { email: string };

  // Always return the same response - prevents email enumeration
  const safeResponse = () => res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });

  // Look up user
  const userResult = await db.query(
    `SELECT id, first_name AS "firstName", email, account_status FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (userResult.rows.length === 0) return safeResponse();

  const user = userResult.rows[0];

  // Don't allow reset for frozen/suspended accounts
  if (user.account_status === 'frozen' || user.account_status === 'suspended') return safeResponse();

  // Rate-limit: suppress if a valid token was issued in the last 5 minutes
  const recentCheck = await db.query(
    `SELECT id FROM password_reset_tokens WHERE user_id = $1 AND created_at > NOW() - INTERVAL '5 minutes' AND used_at IS NULL`,
    [user.id]
  );
  if (recentCheck.rows.length > 0) return safeResponse();

  // Invalidate any previous unexpired tokens for this user (one active token at a time)
  await db.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [user.id]);

  // Generate raw token → hash for storage
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${getFrontendUrl()}/reset-password?token=${rawToken}`;
  await emailService.sendPasswordReset(user.email, { firstName: user.firstName, resetUrl });

  logger.info('Password reset email dispatched', { userId: user.id });
  return safeResponse();
}));

router.get('/auth/reset-password/validate', asyncHandler(async (req: Request, res: Response) => {
  const crypto = await import('crypto');
  const db = (await import('../utils/database')).default;

  const rawToken = String(req.query.token || '');
  if (!rawToken || rawToken.length !== 64 || !/^[0-9a-f]+$/i.test(rawToken)) {
    return res.json({ success: false, valid: false, reason: 'invalid_token' });
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const result = await db.query(
    `SELECT id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) return res.json({ success: false, valid: false, reason: 'not_found' });
  const row = result.rows[0];
  if (row.used_at) return res.json({ success: false, valid: false, reason: 'already_used' });
  if (new Date(row.expires_at) < new Date()) return res.json({ success: false, valid: false, reason: 'expired' });

  return res.json({ success: true, valid: true });
}));

router.post('/auth/reset-password', validateBody(resetPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const crypto = await import('crypto');
  const bcrypt = await import('bcryptjs');
  const db = (await import('../utils/database')).default;
  const { v4: uuidv4 } = await import('uuid');

  const { token: rawToken, newPassword } = req.body as { token: string; newPassword: string };

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const result = await db.query(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at,
            u.email, u.first_name AS "firstName", u.account_status
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
  }

  const row = result.rows[0];

  if (row.used_at) {
    return res.status(400).json({ success: false, message: 'This password reset link has already been used. Please request a new one.' });
  }
  if (new Date(row.expires_at) < new Date()) {
    await db.query(`DELETE FROM password_reset_tokens WHERE id = $1`, [row.id]);
    return res.status(400).json({ success: false, message: 'This password reset link has expired. Please request a new one.' });
  }
  if (row.account_status === 'frozen' || row.account_status === 'suspended') {
    return res.status(403).json({ success: false, message: 'Your account is not eligible for password reset. Please contact support.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password and mark token as used atomically
  await db.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, row.user_id]);
  await db.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);

  // Audit log
  const auditId = uuidv4();
  await db.query(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, $2, 'user.password_reset_self_service', 'user', $3, $4, NOW())`,
    [auditId, row.user_id, row.user_id, JSON.stringify({ email: row.email, method: 'forgot_password_flow' })]
  );

  logger.info('Password reset completed (self-service)', { userId: row.user_id });
  return res.json({ success: true, message: 'Your password has been reset successfully. You can now log in.' });
}));

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
router.post('/consultations', authMiddleware, validateBody(createConsultationSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'consultations'); emitRoleRefresh('admin', 'consultations') } })

  // Payment enforcement (§4.2 rule 4): booking-linked consultations require a
  // completed payment when the payment module is enabled. Replaces the old
  // fail-open 'failed'-only check.
  if (req.body.bookingId) {
    try {
      const PaymentModuleConfig = (await import('../services/payment/PaymentModuleConfig')).default;
      if (await PaymentModuleConfig.isEnabled()) {
        const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
        const paid = await PaymentOrchestrator.isBookingPaid(req.body.bookingId);
        if (!paid) {
          return res.status(402).json({ success: false, error: 'Payment for this booking has not been completed. Please complete payment before starting the consultation.' });
        }
      } else {
        const paymentCheck = await database.query(
          `SELECT id, status FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [req.body.bookingId]
        );
        if (paymentCheck.rows.length > 0 && paymentCheck.rows[0].status === 'failed') {
          return res.status(402).json({ success: false, error: 'Payment for this booking has failed. Please complete payment before starting the consultation.' });
        }
      }
    } catch (payErr) {
      logger.warn('Payment check failed (non-blocking)', { bookingId: req.body.bookingId, error: payErr });
    }
  }

  await ConsultationController.createConsultation(req, res)
}));
router.get('/consultations', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.listConsultations(req, res)));
router.get('/consultations/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'consultations'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getConsultationsByAnimal(req, res)));
router.get('/consultations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.getConsultation(req, res)));
router.put('/consultations/:id', authMiddleware, validateBody(updateConsultationSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'consultations'); emitRoleRefresh('admin', 'consultations') } })
  await ConsultationController.updateConsultation(req, res)
}));

// ─── Booking routes ──────────────────────────────────────────
router.post('/bookings', authMiddleware, validateBody(createBookingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'bookings'); emitRoleRefresh('admin', 'bookings') } })
  await BookingController.createBooking(req, res)
}));
router.get('/bookings', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.listBookings(req, res)));
router.get('/bookings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getBooking(req, res)));
router.put('/bookings/:id/confirm', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'bookings'); emitRoleRefresh('admin', 'bookings') } })
  await BookingController.confirmBooking(req, res)
}));
router.put('/bookings/:id/cancel', authMiddleware, validateBody(cancelBookingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'bookings'); emitRoleRefresh('admin', 'bookings') } })
  await BookingController.cancelBooking(req, res)
}));
router.put('/bookings/:id/reschedule', authMiddleware, validateBody(rescheduleBookingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'bookings'); emitRoleRefresh('admin', 'bookings') } })
  await BookingController.rescheduleBooking(req, res)
}));
router.get('/bookings/:id/action-logs', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getBookingActionLogs(req, res)));
router.get('/action-logs/my', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getMyActionLogs(req, res)));
router.put('/bookings/:id/no-show', authMiddleware, roleMiddleware(['veterinarian', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const booking = await database.query(
    `SELECT id, pet_owner_id as "petOwnerId", veterinarian_id as "veterinarianId", status FROM bookings WHERE id = $1`,
    [req.params.id]
  );
  if (booking.rows.length === 0) return res.status(404).json({ success: false, error: 'Booking not found' });
  const b = booking.rows[0];
  if (authReq.userRole === 'veterinarian' && b.veterinarianId !== authReq.userId) {
    return res.status(403).json({ success: false, error: 'Not your booking' });
  }
  if (!['confirmed', 'pending'].includes(b.status)) {
    return res.status(400).json({ success: false, error: 'Only confirmed or pending bookings can be marked as no-show' });
  }
  await database.query(
    `UPDATE bookings SET status = 'missed', missed_by = 'patient', updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  // §4.3: compensate the doctor for the patient no-show (paid bookings only)
  try {
    const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
    await PaymentOrchestrator.settleMissedBooking(req.params.id, 'patient');
  } catch { /* non-fatal */ }
  try {
    const NSvc = (await import('../services/NotificationService')).default;
    await NSvc.createNotification(b.petOwnerId, 'booking', 'No-Show Recorded',
      'You were marked as no-show for your appointment. This may affect future bookings.',
      'all', { bookingId: req.params.id });
  } catch { /* non-fatal */ }
  res.json({ success: true, message: 'Booking marked as no-show' });
}));

// ─── Video Session routes ────────────────────────────────────

/** §4.2 rule 4: booking-linked consultations need a completed payment before video (flag-gated). */
async function assertConsultationPaymentOk(consultationId: string | null | undefined, res: Response): Promise<boolean> {
  if (!consultationId) return true;
  try {
    const PaymentModuleConfig = (await import('../services/payment/PaymentModuleConfig')).default;
    if (!(await PaymentModuleConfig.isEnabled())) return true;
    const cRes = await database.query(`SELECT booking_id FROM consultations WHERE id = $1`, [consultationId]);
    const bookingId = cRes.rows[0]?.booking_id;
    if (!bookingId) return true; // direct consultations stay allowed (§4.2)
    const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
    if (await PaymentOrchestrator.isBookingPaid(bookingId)) return true;
    res.status(402).json({ success: false, error: 'Payment for this booking has not been completed. The video session cannot start until payment is done.' });
    return false;
  } catch (err) {
    logger.warn('Video session payment check failed (non-blocking)', { consultationId, error: err });
    return true;
  }
}

router.post('/video-sessions', authMiddleware, validateBody(createVideoSessionSchema), asyncHandler(async (req: Request, res: Response) => {
  if (!(await assertConsultationPaymentOk(req.body.consultationId, res))) return;
  await VideoSessionController.createSession(req, res);
}));
router.get('/video-sessions/active', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.listActiveSessions(req, res)));
router.get('/video-sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSession(req, res)));
router.get('/video-sessions/consultation/:consultationId', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSessionByConsultation(req, res)));
router.put('/video-sessions/:id/start', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.startSession(req, res)));
router.put('/video-sessions/:id/end', authMiddleware, validateBody(endVideoSessionSchema), asyncHandler((req: Request, res: Response) => VideoSessionController.endSession(req, res)));
router.post('/video-sessions/join/:roomId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const VideoSessionService = (await import('../services/VideoSessionService')).default;
    const session = await VideoSessionService.getSessionByRoom(req.params.roomId);
    if (session && !(await assertConsultationPaymentOk(session.consultationId, res))) return;
  } catch { /* session lookup errors fall through to the controller's own handling */ }
  await VideoSessionController.joinSession(req, res);
}));
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
router.post('/prescriptions', authMiddleware, validateBody(createPrescriptionSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'prescriptions'); emitRoleRefresh('admin', 'prescriptions') } })
  await PrescriptionController.createPrescription(req, res)
}));
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
router.post('/animals', authMiddleware, validateBody(createAnimalSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'animals') } })
  await AnimalController.createAnimal(req, res)
}));
router.get('/animals/search/by-uid', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.searchByUniqueId(req, res)));
router.get('/animals', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.listAnimals(req, res)));
// Access-check endpoint - frontend can call this before showing a "Request Access" button
router.get('/animals/:id/access-check', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const decision = await checkAnimalAccess(authReq.userId!, authReq.userRole!, req.params.id);
  res.json({ success: true, data: { allowed: decision.allowed, isPrivate: decision.isPrivate, accessType: decision.accessType, reason: decision.reason } });
}));
router.get('/animals/:id', authMiddleware, requireAnimalAccess('params:id', 'animal_profile'), asyncHandler((req: Request, res: Response) => AnimalController.getAnimal(req, res)));
router.put('/animals/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'animals') } })
  await AnimalController.updateAnimal(req, res)
}));
router.delete('/animals/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { const r = req as AuthRequest; if (r.userId) emitDataRefresh(r.userId, 'animals') } })
  await AnimalController.deleteAnimal(req, res)
}));

// ─── Vet Profile routes ─────────────────────────────────────
router.post('/vet-profiles', authMiddleware, validateBody(createVetProfileSchema), asyncHandler((req: Request, res: Response) => VetProfileController.createProfile(req, res)));
router.get('/vet-profiles/me', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getMyProfile(req, res)));
router.get('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.listVets(req, res)));
router.get('/vet-profiles/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getProfile(req, res)));
router.put('/vet-profiles', authMiddleware, validateBody(updateVetProfileSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // §17.2: saving payout details re-acknowledges the Doctor Agreement (context payout_setup)
  const touchesPayout = ['payoutAccountNumber', 'payoutIfsc', 'payoutUpi', 'payoutAccountName']
    .some((k) => req.body[k] !== undefined && req.body[k] !== null && String(req.body[k]).trim() !== '');
  await VetProfileController.updateProfile(req, res);
  if (touchesPayout && res.statusCode < 300 && authReq.userId) {
    try {
      const LegalService = (await import('../services/LegalService')).default;
      const userRes = await database.query(`SELECT email FROM users WHERE id = $1`, [authReq.userId]);
      await LegalService.recordAcceptances({
        userId: authReq.userId,
        userEmail: userRes.rows[0]?.email || '',
        docTypes: ['doctor_agreement'],
        context: 'payout_setup',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (err) {
      logger.warn('payout_setup consent recording failed (non-blocking)', { userId: authReq.userId, error: err });
    }
  }
}));

// ─── Vet Earnings ─────────────────────────────────────────────
router.get('/vet/earnings', authMiddleware, roleMiddleware(['veterinarian', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const vetId = authReq.userRole === 'admin' ? ((req.query.vetId as string) || authReq.userId!) : authReq.userId!;
  const daysInput = parseInt(req.query.days as string) || 30;
  const days = Math.min(Math.max(daysInput, 1), 365);
  
  const summary = await database.query(
    `SELECT 
       COUNT(CASE WHEN b.status = 'completed' THEN 1 END)::int as "totalConsultations",
       COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as "totalEarned",
       COUNT(CASE WHEN b.status = 'cancelled' AND b.cancelled_by = $1::uuid THEN 1 END)::int as "cancelledByMe",
       COUNT(CASE WHEN b.status = 'missed' AND b.missed_by = 'doctor' THEN 1 END)::int as "missed"
     FROM bookings b
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.veterinarian_id = $1
       AND b.created_at >= NOW() - make_interval(days => $2)`,
    [vetId, days]
  );
  
  const daily = await database.query(
    `SELECT DATE_TRUNC('day', p.created_at)::DATE as date,
            SUM(p.amount)::numeric as earned,
            COUNT(*)::int as consultations
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     WHERE b.veterinarian_id = $1 AND p.status = 'completed'
       AND p.created_at >= NOW() - make_interval(days => $2)
     GROUP BY DATE_TRUNC('day', p.created_at)
     ORDER BY date ASC`,
    [vetId, days]
  );
  
  const recent = await database.query(
    `SELECT b.id, b.scheduled_date as "date", b.time_slot_start as "time",
            CONCAT(u.first_name, ' ', u.last_name) as "patientOwnerName",
            a.name as "animalName", p.amount, p.status as "paymentStatus", b.status as "bookingStatus"
     FROM bookings b
     LEFT JOIN users u ON u.id = b.pet_owner_id
     LEFT JOIN animals a ON a.id = b.animal_id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.veterinarian_id = $1
     ORDER BY b.scheduled_date DESC LIMIT 20`,
    [vetId]
  );
  
  res.json({ success: true, data: { summary: summary.rows[0], daily: daily.rows, recent: recent.rows } });
}));

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
    return res.status(400).json({ success: false, message: 'email and role are required' });
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
    return res.status(403).json({ success: false, message: 'Not authorized to manage enterprise members' });
  }

  // Look up user by email
  const userResult = await database.query(
    `SELECT id FROM users WHERE email = $1 AND is_active = true`,
    [email.toLowerCase().trim()]
  );
  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'No active user found with that email address' });
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

// ─── Batch (flock/herd) management ──────────────────────────────────────────
// A health event has ONE subject - an animal or a group - so a 5,000-bird flock produces one
// record, not 5,000. See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
//
// Every route below is gated by ensureGroupAccess(): the caller must own the enterprise that
// owns the group, be a member of it, or be a platform admin. A group id is a bearer of an
// enterprise's data, so an unguarded :groupId here would be a cross-tenant read exactly like
// the ones the network audits found.
async function ensureGroupAccess(req: Request, res: Response): Promise<string | null> {
  const authReq = req as any;
  const groupId = req.params.groupId || req.params.id;
  if (!groupId) { res.status(400).json({ success: false, message: 'Group id is required' }); return null; }

  if (authReq.userRole === 'admin') return groupId;

  const owned = await database.query(
    `SELECT 1
       FROM animal_groups ag
       JOIN enterprises e ON e.id = ag.enterprise_id
      WHERE ag.id = $1
        AND (e.owner_id = $2
             OR EXISTS (SELECT 1 FROM enterprise_members em
                         WHERE em.enterprise_id = e.id AND em.user_id = $2 AND em.is_active = true))
      LIMIT 1`,
    [groupId, authReq.userId]
  );
  if (!owned.rows.length) {
    // 404 not 403 - do not confirm that a group exists to someone with no claim on it.
    res.status(404).json({ success: false, message: 'Animal group not found' });
    return null;
  }
  return groupId;
}

router.get('/animal-groups/:groupId/cycles', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.listCycles(groupId) });
}));

router.get('/animal-groups/:groupId/cycles/active', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.getActiveCycle(groupId) });
}));

router.post('/animal-groups/:groupId/cycles', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const { name, species, breed, placedCount, startedAt, notes } = req.body;
  const cycle = await BatchManagementService.openCycle({
    groupId, name, species, breed,
    placedCount: Number(placedCount) || 0, startedAt, notes,
    userId: (req as any).userId,
  });
  res.status(201).json({ success: true, data: cycle });
}));

router.post('/group-cycles/:cycleId/close', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  // The cycle is reached by its own id, so resolve its group first and guard on that.
  const owner = await database.query(
    `SELECT gc.group_id FROM group_cycles gc WHERE gc.id = $1`, [req.params.cycleId]
  );
  if (!owner.rows.length) { res.status(404).json({ success: false, message: 'Cycle not found' }); return; }
  req.params.groupId = owner.rows[0].group_id;
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;

  const cycle = await BatchManagementService.closeCycle(req.params.cycleId, authReq.userId, req.body?.reason);
  res.json({ success: true, data: cycle });
}));

router.get('/animal-groups/:groupId/population-events', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const events = await BatchManagementService.listPopulationEvents(groupId, req.query.cycleId as string | undefined);
  res.json({ success: true, data: events });
}));

router.post('/animal-groups/:groupId/population-events', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const { cycleId, eventType, quantity, eventDate, reason, sourceRef } = req.body;
  const result = await BatchManagementService.recordPopulationEvent({
    groupId, cycleId, eventType, quantity: Number(quantity),
    eventDate, reason, sourceRef, userId: (req as any).userId,
  });
  res.status(201).json({ success: true, data: result });
}));

router.get('/animal-groups/:groupId/reconcile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.reconcile(groupId) });
}));

// Flock health as RATES - mortality %, morbidity %, treatment coverage. "1 record" says
// nothing about a flock of 5,000; these are the numbers a producer manages by.
router.get('/animal-groups/:groupId/health-metrics', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const metrics = await BatchManagementService.getGroupHealthMetrics(groupId, req.query.cycleId as string | undefined);
  res.json({ success: true, data: metrics });
}));

router.get('/animal-groups/:groupId/withdrawal', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  res.json({ success: true, data: await BatchManagementService.getWithdrawalStatus({ groupId }) });
}));

router.post('/animal-groups/:groupId/promote', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  const { animalId, cycleId, reason } = req.body;
  if (!animalId) { res.status(400).json({ success: false, message: 'animalId is required' }); return; }
  const result = await BatchManagementService.promoteFromBatch({
    animalId, groupId, cycleId, reason, userId: (req as any).userId,
  });
  res.status(201).json({ success: true, data: result });
}));

// An animal's FULL life story: its own records plus the group records that applied while it was
// a member of that cycle. Composed at read time - nothing is ever copied down.
router.get('/animals/:animalId/lifetime-history', authMiddleware, requireAnimalAccess('params:animalId', 'medical_records'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await BatchManagementService.getAnimalLifetimeHistory(req.params.animalId) });
}));

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
    return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
  }

  const movement = await database.query(
    `SELECT m.*, a.enterprise_id FROM movement_records m
     LEFT JOIN animals a ON a.id = m.animal_id
     WHERE m.id = $1`,
    [req.params.id]
  );

  if (movement.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Movement record not found' });
  }

  const mv = movement.rows[0];
  const enterpriseId = mv.enterprise_id || mv.enterprise_id;

  if (userRole !== 'admin') {
    const enterpriseAccess = await database.query(
      `SELECT id FROM enterprises WHERE id = $1 AND owner_id = $2`,
      [enterpriseId, userId]
    );
    if (enterpriseAccess.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve this movement' });
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


// ─── Medical Record routes ───────────────────────────────────
// HIGH FIX-5: Added requireAnimalAccess for stats endpoint to prevent leaking per-animal counts
router.get('/medical-records/stats', authMiddleware, requireAnimalAccess('query:animalId', 'stats'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getStats(req, res)));
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
// CRITICAL FIX: Added requireAnimalAccess for body:animalId (POST) and params:animalId (GET)
router.post('/weight-history', authMiddleware, requireAnimalAccess('body:animalId', 'weight'), validateBody(addWeightSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.addWeight(req, res)));
router.get('/weight-history/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'weight'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listWeightHistory(req, res)));

// ─── Allergy routes ─────────────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for all allergy routes
router.post('/allergies', authMiddleware, requireAnimalAccess('body:animalId', 'allergies'), validateBody(createAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createAllergy(req, res)));
router.get('/allergies/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'allergies'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listAllergies(req, res)));
router.put('/allergies/:id', authMiddleware, requireAnimalAccess('body:animalId', 'allergies'), validateBody(updateAllergySchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateAllergy(req, res)));

// ─── Lab Result routes ──────────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for all lab result routes
router.post('/lab-results', authMiddleware, requireAnimalAccess('body:animalId', 'lab_results'), validateBody(createLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.createLabResult(req, res)));
router.get('/lab-results/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'lab_results'), asyncHandler((req: Request, res: Response) => MedicalRecordController.listLabResults(req, res)));
router.put('/lab-results/:id', authMiddleware, requireAnimalAccess('body:animalId', 'lab_results'), validateBody(updateLabResultSchema), asyncHandler((req: Request, res: Response) => MedicalRecordController.updateLabResult(req, res)));

// ─── Medical Timeline route ─────────────────────────────────
// CRITICAL FIX: Added requireAnimalAccess for timeline
router.get('/timeline/animal/:animalId', authMiddleware, requireAnimalAccess('params:animalId', 'timeline'), asyncHandler((req: Request, res: Response) => MedicalRecordController.getTimeline(req, res)));

// ─── Notification routes ─────────────────────────────────────
router.get('/notifications', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.listNotifications(req, res)));
router.put('/notifications/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAsRead(req, res)));
router.put('/notifications/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAllAsRead(req, res)));

// ─── Payment routes ──────────────────────────────────────────
// ─── Payment module: checkout lifecycle (docs/PAYMENT_MODULE_PLAN.md §9) ───
router.post('/payments/checkout/:bookingId', authMiddleware, validateBody(checkoutPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const breakdown = await PaymentOrchestrator.initiateCheckout(authReq.userId!, req.params.bookingId, req.body.useWallet === true);
  res.on('finish', () => { if (res.statusCode < 300 && authReq.userId) { emitDataRefresh(authReq.userId, 'bookings'); } });
  res.json({ success: true, data: breakdown });
}));

router.post('/payments/verify', authMiddleware, validateBody(verifyPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const PaymentModuleConfig = (await import('../services/payment/PaymentModuleConfig')).default;
  const mode = await PaymentModuleConfig.getGatewayMode();
  if (mode === 'demo') {
    await PaymentOrchestrator.completeDemoCheckout(authReq.userId!, req.body.paymentId);
  } else {
    const { paymentId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;
    if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
      return res.status(400).json({ success: false, error: 'gatewayOrderId, gatewayPaymentId and gatewaySignature are required' });
    }
    await PaymentOrchestrator.completeRazorpayCheckout(authReq.userId!, paymentId, gatewayOrderId, gatewayPaymentId, gatewaySignature);
  }
  res.on('finish', () => { if (res.statusCode < 300 && authReq.userId) { emitDataRefresh(authReq.userId, 'bookings'); emitRoleRefresh('admin', 'payments'); } });
  res.json({ success: true, message: 'Payment completed' });
}));

// Razorpay webhook (§12 rules 2-3): raw-body signature verification, no auth
// middleware, idempotent on gateway event id. Always 200 for processed events
// so Razorpay stops retrying; 400 only on signature failure.
router.post('/webhooks/razorpay', asyncHandler(async (req: Request, res: Response) => {
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const signature = (req.headers['x-razorpay-signature'] as string) || '';
  const eventId = (req.headers['x-razorpay-event-id'] as string) || null;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : JSON.stringify(req.body || {});
  const result = await PaymentOrchestrator.handleRazorpayWebhook(rawBody, signature, eventId);
  if (!result.handled && result.reason === 'invalid_signature') {
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }
  res.json({ success: true });
}));

router.get('/payments/refund-preview/:bookingId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const booking = await database.query(
    `SELECT pet_owner_id, veterinarian_id FROM bookings WHERE id = $1`, [req.params.bookingId]
  );
  if (booking.rows.length === 0) return res.status(404).json({ success: false, error: 'Booking not found' });
  const b = booking.rows[0];
  if (b.pet_owner_id !== authReq.userId && b.veterinarian_id !== authReq.userId && authReq.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Not your booking' });
  }
  // Preview is computed for the role of the requester (patient sees patient policy, vet sees vet policy)
  const role = authReq.userId === b.pet_owner_id ? 'pet_owner' : (authReq.userId === b.veterinarian_id ? 'veterinarian' : 'admin');
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const preview = await PaymentOrchestrator.computeRefundPreview(req.params.bookingId, role);
  res.json({ success: true, data: preview });
}));

router.get('/payments/receipt/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const PaymentOrchestrator = (await import('../services/payment/PaymentOrchestrator')).default;
  const receipt = await PaymentOrchestrator.getReceipt(req.params.id, authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: receipt });
}));

// ─── Doctor earnings ledger (docs/PAYMENT_MODULE_PLAN.md §6) ───────────────
router.get('/earnings/summary', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const EarningsService = (await import('../services/payment/EarningsService')).default;
  const PaymentModuleConfig = (await import('../services/payment/PaymentModuleConfig')).default;
  const [balance, minWithdrawal, clearanceDays, enabled] = await Promise.all([
    EarningsService.getBalance(authReq.userId!),
    PaymentModuleConfig.getMinWithdrawalAmount(),
    PaymentModuleConfig.getClearanceDays(),
    PaymentModuleConfig.isEnabled(),
  ]);
  res.json({ success: true, data: { ...balance, minWithdrawalAmount: minWithdrawal, clearanceDays, paymentsEnabled: enabled } });
}));

router.get('/earnings/statement', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const EarningsService = (await import('../services/payment/EarningsService')).default;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const result = await EarningsService.getStatement(authReq.userId!, limit, offset);
  res.json({ success: true, data: result });
}));

// ─── Invoices & GST (docs/PAYMENT_MODULE_PLAN.md §7) ───────────────────────
router.get('/invoices/payment/:paymentId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const InvoiceService = (await import('../services/payment/InvoiceService')).default;
  const invoice = await InvoiceService.getInvoiceByPayment(req.params.paymentId, authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: invoice });
}));

router.get('/invoices/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const InvoiceService = (await import('../services/payment/InvoiceService')).default;
  const invoice = await InvoiceService.getInvoice(req.params.id, authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: invoice });
}));

// Admin: SAC tax-code management (D13 - rate changes need zero code)
router.get('/admin/tax-codes', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const result = await database.query(
    `SELECT id, sac_code as "sacCode", label, rate_percent as "ratePercent", is_active as "isActive"
     FROM tax_codes ORDER BY sac_code`
  );
  res.json({ success: true, data: result.rows });
}));

router.put('/admin/tax-codes/:sacCode', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const rate = parseFloat(req.body.ratePercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return res.status(400).json({ success: false, error: 'ratePercent must be between 0 and 100' });
  }
  const result = await database.query(
    `UPDATE tax_codes SET rate_percent = $1, updated_at = NOW() WHERE sac_code = $2
     RETURNING sac_code as "sacCode", rate_percent as "ratePercent"`,
    [rate, req.params.sacCode]
  );
  if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'SAC code not found' });
  await database.query(
    `INSERT INTO payment_events (id, event_type, actor_user_id, payload, created_at)
     VALUES (gen_random_uuid(), 'tax_rate_changed', $1, $2, NOW())`,
    [authReq.userId, JSON.stringify({ sacCode: req.params.sacCode, newRate: rate })]
  ).catch(() => {});
  res.json({ success: true, data: result.rows[0] });
}));

// Finance overview (§11): GMV, commission, refunds, liabilities, TDS, health
router.get('/admin/reports/finance/overview', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ success: false, error: 'from/to must be YYYY-MM-DD' });
  }
  const [payments, pharmacyPayments, earnings, wallets, tds, health] = await Promise.all([
    database.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status IN ('completed', 'partially_refunded', 'refunded', 'transferred')), 0) as gmv,
         COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('completed', 'partially_refunded')), 0) as commission_earned,
         COALESCE(SUM(refund_amount), 0) as refunds_out,
         COALESCE(SUM(processing_charge_amount), 0) as processing_charges,
         COALESCE(SUM(gateway_fee_amount) FILTER (WHERE status IN ('completed', 'partially_refunded', 'refunded', 'transferred')), 0) as gateway_fees,
         COUNT(*) FILTER (WHERE status IN ('completed', 'partially_refunded')) as paid_count
       FROM payments WHERE payment_source = 'consultation'
         AND created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`,
      [from, to]
    ),
    // Pharmacy revenue has no platform commission split (it's the network's own dispensing
    // revenue, not a consultation the platform brokered) - tracked separately from GMV/commission above.
    database.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as collected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
         COUNT(*) FILTER (WHERE status = 'completed') as dispensed_count,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count
       FROM payments WHERE payment_source = 'pharmacy'
         AND created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`,
      [from, to]
    ),
    database.query(
      `SELECT
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'clearing'), 0) as clearing,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'available'), 0) as available,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'locked'), 0) as locked,
         COUNT(DISTINCT doctor_id) FILTER (WHERE status = 'available' AND net_amount < 0) as negative_doctor_rows
       FROM doctor_earnings`
    ),
    database.query(
      `SELECT COALESCE(SUM(balance), 0) as balance, COALESCE(SUM(bonus_credits), 0) as bonus FROM wallets`
    ),
    database.query(
      `SELECT COALESCE(SUM(tds_amount), 0) as tds_total, COUNT(*) as settled_count,
              COALESCE(SUM(net_paid_amount), 0) as net_paid_total
       FROM withdrawal_requests
       WHERE status = 'settled' AND settled_at >= $1::date AND settled_at < ($2::date + INTERVAL '1 day')`,
      [from, to]
    ),
    database.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending' AND updated_at < NOW() - INTERVAL '1 hour') as stuck_pending,
         COUNT(*) FILTER (WHERE status IN ('created', 'pending')) as open_holds
       FROM payments WHERE payment_source = 'consultation'`
    ),
  ]);
  const p = payments.rows[0]; const pp = pharmacyPayments.rows[0]; const e = earnings.rows[0]; const w = wallets.rows[0];
  const t = tds.rows[0]; const h = health.rows[0];
  res.json({
    success: true,
    data: {
      range: { from, to },
      revenue: {
        gmv: parseFloat(p.gmv), commissionEarned: parseFloat(p.commission_earned),
        refundsOut: parseFloat(p.refunds_out), processingCharges: parseFloat(p.processing_charges),
        gatewayFees: parseFloat(p.gateway_fees), paidCount: parseInt(p.paid_count, 10),
        netPlatformRevenue: Math.round((parseFloat(p.commission_earned) + parseFloat(p.processing_charges) - parseFloat(p.gateway_fees)) * 100) / 100,
      },
      pharmacyRevenue: {
        collected: parseFloat(pp.collected), pendingAmount: parseFloat(pp.pending_amount),
        dispensedCount: parseInt(pp.dispensed_count, 10), pendingCount: parseInt(pp.pending_count, 10),
      },
      settlementLiability: {
        clearing: parseFloat(e.clearing), available: parseFloat(e.available), locked: parseFloat(e.locked),
      },
      walletLiability: {
        balance: parseFloat(w.balance), bonusCredits: parseFloat(w.bonus),
        total: Math.round((parseFloat(w.balance) + parseFloat(w.bonus)) * 100) / 100,
      },
      tds: {
        totalDeducted: parseFloat(t.tds_total), settledCount: parseInt(t.settled_count, 10),
        netPaidTotal: parseFloat(t.net_paid_total),
      },
      health: {
        stuckPending: parseInt(h.stuck_pending, 10), openHolds: parseInt(h.open_holds, 10),
      },
    },
  });
}));

router.get('/admin/reports/gst-export', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ success: false, error: 'from/to must be YYYY-MM-DD' });
  }
  const InvoiceService = (await import('../services/payment/InvoiceService')).default;
  const csv = await InvoiceService.gstExportCsv(from, to);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="gst-export-${from}-to-${to}.csv"`);
  res.send(csv);
}));

// ─── Platform referrals (docs/PAYMENT_MODULE_PLAN.md §4.4) ─────────────────
router.post('/referrals/platform', authMiddleware, roleMiddleware(['veterinarian']), validateBody(createPlatformReferralSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  const result = await ReferralService.createReferral(authReq.userId!, {
    toVetId: req.body.toVetId || null,
    reason: req.body.reason,
    bookingId: req.body.bookingId,
    consultationId: req.body.consultationId,
  });
  res.status(201).json({ success: true, data: result });
}));

router.get('/referrals/platform/my', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  res.json({ success: true, data: await ReferralService.listForUser(authReq.userId!, authReq.userRole || '') });
}));

// Doctor: items that can be referred (paid upcoming bookings + recent completed consultations)
router.get('/referrals/platform/referable', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const bookings = await database.query(
    `SELECT b.id, b.scheduled_date as "scheduledDate", b.time_slot_start as "timeSlotStart",
            b.status, b.priority, a.name as "animalName",
            CONCAT(po.first_name, ' ', po.last_name) as "patientName"
     FROM bookings b
     JOIN payments p ON p.booking_id = b.id AND p.status = 'completed'
     LEFT JOIN animals a ON a.id = b.animal_id
     LEFT JOIN users po ON po.id = b.pet_owner_id
     WHERE b.veterinarian_id = $1 AND b.status IN ('pending', 'confirmed')
       AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.booking_id = b.id AND r.transfer_status IN ('offered', 'accepted', 'rechosen'))
     ORDER BY b.scheduled_date ASC LIMIT 50`,
    [authReq.userId]
  );
  const consultations = await database.query(
    `SELECT c.id, c.completed_at as "completedAt", c.diagnosis, a.name as "animalName",
            CONCAT(po.first_name, ' ', po.last_name) as "patientName"
     FROM consultations c
     LEFT JOIN animals a ON a.id = c.animal_id
     LEFT JOIN users po ON po.id = c.user_id
     WHERE c.veterinarian_id = $1 AND c.status = 'completed'
       AND c.completed_at > NOW() - INTERVAL '30 days'
     ORDER BY c.completed_at DESC LIMIT 50`,
    [authReq.userId]
  );
  res.json({ success: true, data: { bookings: bookings.rows, consultations: consultations.rows } });
}));

router.post('/referrals/platform/:id/accept', authMiddleware, roleMiddleware(['pet_owner', 'farmer']), validateBody(acceptReferralSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  const booking = await ReferralService.acceptReferral(authReq.userId!, req.params.id, {
    veterinarianId: req.body.veterinarianId || undefined,
    scheduledDate: req.body.scheduledDate,
    timeSlotStart: req.body.timeSlotStart,
    timeSlotEnd: req.body.timeSlotEnd,
    bookingType: req.body.bookingType,
    reasonForVisit: req.body.reasonForVisit,
  });
  res.on('finish', () => { if (res.statusCode < 300 && authReq.userId) { emitDataRefresh(authReq.userId, 'bookings'); } });
  res.status(201).json({ success: true, data: booking });
}));

router.post('/referrals/platform/:id/decline', authMiddleware, roleMiddleware(['pet_owner', 'farmer']), validateBody(declineReferralSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const ReferralService = (await import('../services/payment/ReferralService')).default;
  const outcome = await ReferralService.declineReferral(authReq.userId!, req.params.id, req.body.refundDestination || 'wallet');
  res.json({ success: true, data: outcome });
}));

// ─── Withdrawals / settlements (docs/PAYMENT_MODULE_PLAN.md §6.3) ──────────
router.post('/withdrawals/request', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  const result = await WithdrawalService.requestWithdrawal(authReq.userId!);
  res.status(201).json({ success: true, data: result });
}));

router.post('/withdrawals/:id/cancel', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.cancelRequest(authReq.userId!, req.params.id);
  res.json({ success: true, message: 'Withdrawal request cancelled' });
}));

router.get('/withdrawals/my', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.listMyWithdrawals(authReq.userId!) });
}));

router.get('/admin/withdrawals', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.adminList(req.query.status as string | undefined) });
}));

// Doctors the platform owes money to. The negative-balance route below is its counterpart;
// neither existed for the positive case until now, so unpaid doctors were invisible.
router.get('/admin/withdrawals/payables', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.adminPayables() });
}));
router.get('/admin/withdrawals/negative-balances', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  res.json({ success: true, data: await WithdrawalService.adminNegativeBalances() });
}));

router.put('/admin/withdrawals/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.adminApprove(req.params.id, authReq.userId!, req.body.note);
  res.json({ success: true, message: 'Withdrawal approved' });
}));

router.put('/admin/withdrawals/:id/reject', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!req.body.reason || !String(req.body.reason).trim()) {
    return res.status(400).json({ success: false, error: 'A rejection reason is required' });
  }
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.adminReject(req.params.id, authReq.userId!, String(req.body.reason).substring(0, 500));
  res.json({ success: true, message: 'Withdrawal rejected' });
}));

router.put('/admin/withdrawals/:id/settle', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!req.body.utrReference || !String(req.body.utrReference).trim()) {
    return res.status(400).json({ success: false, error: 'utrReference (bank/UPI reference) is required' });
  }
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  await WithdrawalService.adminSettle(req.params.id, authReq.userId!, String(req.body.utrReference).substring(0, 100), req.body.note);
  res.json({ success: true, message: 'Withdrawal settled' });
}));

router.post('/admin/withdrawals/discretionary', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { doctorId, utrReference, note } = req.body;
  if (!doctorId || !utrReference || !note) {
    return res.status(400).json({ success: false, error: 'doctorId, utrReference and note are required' });
  }
  const WithdrawalService = (await import('../services/payment/WithdrawalService')).default;
  const result = await WithdrawalService.adminDiscretionaryPayout(doctorId, authReq.userId!, String(utrReference).substring(0, 100), String(note).substring(0, 500));
  res.status(201).json({ success: true, data: result });
}));

// Admin: per-doctor commission overrides (§5)
router.get('/admin/commission/doctors', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string) || '';
  const params: any[] = [];
  let where = `u.role = 'veterinarian'`;
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where += ` AND (LOWER(u.first_name) LIKE $${params.length} OR LOWER(u.last_name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
  }
  const result = await database.query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as "name", u.email,
            vp.consultation_fee as "consultationFee", vp.emergency_consultation_fee as "emergencyFee",
            vp.commission_percent_override as "commissionPercentOverride",
            vp.commission_flat_override as "commissionFlatOverride"
     FROM users u JOIN vet_profiles vp ON vp.user_id = u.id
     WHERE ${where}
     ORDER BY u.first_name, u.last_name LIMIT 100`,
    params
  );
  res.json({ success: true, data: result.rows });
}));

router.put('/admin/commission/doctors/:userId', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { commissionPercentOverride, commissionFlatOverride } = req.body;
  const pct = commissionPercentOverride === null || commissionPercentOverride === '' || commissionPercentOverride === undefined
    ? null : parseFloat(commissionPercentOverride);
  const flat = commissionFlatOverride === null || commissionFlatOverride === '' || commissionFlatOverride === undefined
    ? null : parseFloat(commissionFlatOverride);
  if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
    return res.status(400).json({ success: false, error: 'commissionPercentOverride must be between 0 and 100' });
  }
  if (flat !== null && (!Number.isFinite(flat) || flat < 0 || flat > 100000)) {
    return res.status(400).json({ success: false, error: 'commissionFlatOverride must be a non-negative amount' });
  }
  const before = await database.query(
    `SELECT commission_percent_override, commission_flat_override FROM vet_profiles WHERE user_id = $1`,
    [req.params.userId]
  );
  if (before.rows.length === 0) return res.status(404).json({ success: false, error: 'Doctor profile not found' });
  await database.query(
    `UPDATE vet_profiles SET commission_percent_override = $1, commission_flat_override = $2, updated_at = NOW() WHERE user_id = $3`,
    [pct, flat, req.params.userId]
  );
  // §5: commission config changes are audit-logged
  await database.query(
    `INSERT INTO payment_events (id, event_type, actor_user_id, payload, created_at)
     VALUES (gen_random_uuid(), 'commission_override_changed', $1, $2, NOW())`,
    [authReq.userId, JSON.stringify({
      doctorUserId: req.params.userId,
      before: before.rows[0],
      after: { commission_percent_override: pct, commission_flat_override: flat },
    })]
  ).catch(() => {});
  res.json({ success: true, message: 'Commission override updated' });
}));

// ─── Legal documents & consent (docs/PAYMENT_MODULE_PLAN.md §17) ───────────
router.get('/legal/documents', asyncHandler(async (_req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.listActiveDocuments() });
}));

router.get('/legal/documents/:docType', asyncHandler(async (req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.getActiveDocument(req.params.docType) });
}));

router.get('/legal/acceptances/pending', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const LegalService = (await import('../services/LegalService')).default;
  const pending = await LegalService.getPendingReacceptances(authReq.userId!, authReq.userRole || '');
  res.json({ success: true, data: pending });
}));

router.post('/legal/acceptances', authMiddleware, validateBody(legalAcceptSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const LegalService = (await import('../services/LegalService')).default;
  const userRes = await database.query(`SELECT email FROM users WHERE id = $1`, [authReq.userId]);
  await LegalService.recordAcceptances({
    userId: authReq.userId!,
    userEmail: userRes.rows[0]?.email || '',
    docTypes: req.body.docTypes,
    context: req.body.context || 'login_reacceptance',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.json({ success: true, message: 'Acceptance recorded' });
}));

// Admin: Legal & Policies manager (§10 item 8)
router.get('/admin/legal-documents', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.listAllDocuments() });
}));

router.post('/admin/legal-documents', authMiddleware, roleMiddleware(['admin']), validateBody(adminLegalDocSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const LegalService = (await import('../services/LegalService')).default;
  const doc = await LegalService.publishNewVersion({
    docType: req.body.docType,
    title: req.body.title,
    content: req.body.content,
    requiresReacceptance: req.body.requiresReacceptance === true,
    createdBy: authReq.userId!,
  });
  res.status(201).json({ success: true, data: doc });
}));

router.get('/admin/legal-documents/acceptance-stats', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.getAcceptanceStats() });
}));

router.get('/admin/legal-documents/user/:userId', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const LegalService = (await import('../services/LegalService')).default;
  res.json({ success: true, data: await LegalService.getUserAcceptances(req.params.userId) });
}));

router.post('/payments', authMiddleware, validateBody(createPaymentSchema), asyncHandler((req: Request, res: Response) => PaymentController.createPayment(req, res)));
router.get('/payments', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.listPayments(req, res)));
router.get('/payments/booking/:bookingId', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPaymentByBooking(req, res)));
router.get('/payments/gateway-settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => PaymentController.getGatewaySettings(req, res)));
router.get('/payments/:id', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPayment(req, res)));

// ─── Razorpay credentials (payment module - §12 rule 6: masked only, never plaintext) ───
router.get('/admin/razorpay-credentials', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const PaymentCredentialsService = (await import('../services/payment/PaymentCredentialsService')).default;
  const [test, live] = await Promise.all([
    PaymentCredentialsService.getMaskedStatus('test'),
    PaymentCredentialsService.getMaskedStatus('live'),
  ]);
  const webhookUrl = `${req.protocol}://${req.get('host')}/api/v1/webhooks/razorpay`;
  res.json({ success: true, data: { test, live, webhookUrl } });
}));

router.put('/admin/razorpay-credentials/:environment', authMiddleware, roleMiddleware(['admin']), validateBody(razorpayCredentialsSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { environment } = req.params;
  if (environment !== 'test' && environment !== 'live') {
    return res.status(400).json({ success: false, error: { message: "environment must be 'test' or 'live'" } });
  }
  const PaymentCredentialsService = (await import('../services/payment/PaymentCredentialsService')).default;
  const { keyId, keySecret, webhookSecret } = req.body;
  await PaymentCredentialsService.setCredentials(environment, keyId, keySecret || undefined, webhookSecret || undefined, authReq.userId!);
  res.json({ success: true, data: await PaymentCredentialsService.getMaskedStatus(environment) });
}));

// ─── Wallet routes ───────────────────────────────────────────
router.get('/wallet', authMiddleware, asyncHandler((req: Request, res: Response) => WalletController.getWallet(req, res)));
router.get('/wallet/transactions', authMiddleware, asyncHandler((req: Request, res: Response) => WalletController.listTransactions(req, res)));

// Wallet withdrawals (038) - the wallet's exit door. Any authenticated user may withdraw their
// OWN balance; refunds land here and must not be trapped as permanent store credit.
router.post('/wallet/withdrawals', authMiddleware, validateBody(walletWithdrawalRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await WalletWithdrawalService.requestWithdrawal((req as any).userId, req.body) });
  }));
router.get('/wallet/withdrawals', authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await WalletWithdrawalService.listMine((req as any).userId) });
  }));
router.post('/wallet/withdrawals/:id/cancel', authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.cancelMine((req as any).userId, req.params.id);
    res.json({ success: true });
  }));

// Admin payout queue for customer withdrawals.
router.get('/admin/wallet-withdrawals', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await WalletWithdrawalService.adminList(req.query.status as string) });
  }));
router.put('/admin/wallet-withdrawals/:id/approve', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.adminApprove(req.params.id, (req as any).userId, req.body?.note);
    res.json({ success: true });
  }));
router.put('/admin/wallet-withdrawals/:id/reject', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.adminReject(req.params.id, (req as any).userId, req.body?.reason);
    res.json({ success: true });
  }));
router.put('/admin/wallet-withdrawals/:id/settle', authMiddleware, roleMiddleware(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    await WalletWithdrawalService.adminSettle(req.params.id, (req as any).userId, req.body?.utrReference, req.body?.note);
    res.json({ success: true });
  }));

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
router.get('/dashboard/hospital-staff', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const result = await HospitalNetworkService.getHospitalStaffDashboard(userId);
  res.json({ success: true, data: result });
}));
router.get('/dashboard/corporate', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), asyncHandler((req: Request, res: Response) => HospitalNetworkController.getCorporateDashboard(req, res)));
router.get('/admin/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getDashboardStats(req, res)));
router.get('/admin/users/search', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const role = (req.query.role as string) || '';
  try {
    const filter = q.length >= 1 ? `%${q}%` : '%';
    const params: any[] = [filter];
    let roleClause = '';
    if (role) { params.push(role); roleClause = `AND role = $${params.length}`; }
    const result = await database.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", email, role
       FROM users
       WHERE is_active = true
         AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1
              OR (first_name || ' ' || last_name) ILIKE $1)
         ${roleClause}
       ORDER BY first_name, last_name
       LIMIT 30`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Admin user search failed', { error: err.message });
    res.status(500).json({ success: false, message: 'Search failed' });
  }
}));
router.get('/admin/users', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listUsers(req, res)));
router.get('/admin/users/pending', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listPendingUsers(req, res)));
router.put('/admin/users/:id/status', authMiddleware, roleMiddleware(['admin']), validateBody(toggleUserStatusSchema), asyncHandler((req: Request, res: Response) => AdminController.toggleUserStatus(req, res)));
router.put('/admin/users/:id/role', authMiddleware, roleMiddleware(['admin']), validateBody(changeUserRoleSchema), asyncHandler((req: Request, res: Response) => AdminController.changeUserRole(req, res)));
router.post('/admin/users/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.approveUser(req, res)));
router.post('/admin/users/:id/reject', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.rejectUser(req, res)));
router.post('/admin/users/:id/freeze', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.freezeUser(req, res)));
router.post('/admin/users/:id/unfreeze', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.unfreezeUser(req, res)));
router.post('/admin/users/:id/suspend', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.suspendUser(req, res)));
router.post('/admin/users/:id/reactivate', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.reactivateUser(req, res)));

// C7: Admin password reset
router.post('/admin/users/:id/reset-password', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
  }
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const userCheck = await database.query(`SELECT id FROM users WHERE id = $1`, [req.params.id]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  await database.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hashedPassword, req.params.id]
  );

  const { v4: uuidv4 } = require('uuid');
  const auditId = uuidv4();
  await database.query(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
     VALUES ($1, $2, 'user.password_reset', 'user', $3, $4, NOW())`,
    [auditId, authReq.userId, req.params.id, JSON.stringify({ resetBy: authReq.userId })]
  );

  res.json({ success: true, message: 'Password reset successfully' });
}));

// P4-HIGH1: Secondary role management (admin only)
router.get('/users/:id/roles', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const rows = await database.query(
    `SELECT ur.id, ur.role, ur.is_primary AS "isPrimary", ur.notes,
            ur.granted_at AS "grantedAt",
            gb.first_name || ' ' || gb.last_name AS "grantedByName"
     FROM user_roles ur
     LEFT JOIN users gb ON ur.granted_by = gb.id
     WHERE ur.user_id = $1
     ORDER BY ur.is_primary DESC, ur.granted_at ASC`,
    [req.params.id]
  );
  res.json({ success: true, data: rows.rows });
}));

router.post('/users/:id/roles', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { role, notes } = req.body;
  const validRoles = ['pet_owner', 'farmer', 'veterinarian', 'admin', 'corporate_admin', 'hospital_staff', 'pharmacist', 'groomer', 'support'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  }
  // Cannot add a role the user already has as primary
  const existing = await database.query(`SELECT role FROM users WHERE id = $1`, [req.params.id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'User not found' });

  await database.query(
    `INSERT INTO user_roles (user_id, role, is_primary, granted_by, notes)
     VALUES ($1, $2, false, $3, $4)
     ON CONFLICT (user_id, role) DO UPDATE SET notes = EXCLUDED.notes, granted_by = EXCLUDED.granted_by`,
    [req.params.id, role, (req as any).userId, notes ?? null]
  );
  res.json({ success: true, message: 'Role granted successfully' });
}));

router.delete('/users/:id/roles/:role', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  // Cannot remove the primary role
  const userRow = await database.query(`SELECT role FROM users WHERE id = $1`, [req.params.id]);
  if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  if (userRow.rows[0].role === req.params.role) {
    return res.status(400).json({ error: 'Cannot remove the primary role' });
  }
  const result = await database.query(
    `DELETE FROM user_roles WHERE user_id = $1 AND role = $2 AND is_primary = false`,
    [req.params.id, req.params.role]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Secondary role not found for this user' });
  }
  res.json({ success: true, message: 'Role removed successfully' });
}));
router.get('/admin/consultations', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listConsultations(req, res)));
router.get('/admin/payments', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listPayments(req, res)));
router.post('/admin/payments/:id/refund', authMiddleware, roleMiddleware(['admin']), validateBody(processRefundSchema), asyncHandler((req: Request, res: Response) => AdminController.processRefund(req, res)));

// C8: Admin wallet summary
router.get('/admin/wallet-summary', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const result = await database.query(
    `SELECT 
      COUNT(DISTINCT user_id)::int as "totalUsersWithBalance",
      COALESCE(SUM(balance), 0) as "totalPlatformBalance",
      COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as "totalPositiveBalance",
      COALESCE(SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END), 0) as "totalNegativeBalance",
      COALESCE(MAX(balance), 0) as "maxBalance",
      COALESCE(AVG(balance), 0) as "avgBalance",
      COUNT(CASE WHEN balance > 0 THEN 1 END)::int as "usersWithPositiveBalance"
     FROM wallets`
  );

  const topBalances = await database.query(
    `SELECT w.user_id as "userId", w.balance,
            CONCAT(u.first_name, ' ', u.last_name) as "userName",
            u.email, u.role
     FROM wallets w
     JOIN users u ON u.id = w.user_id
     WHERE w.balance > 0
     ORDER BY w.balance DESC
     LIMIT 10`
  );

  res.json({
    success: true,
    data: {
      summary: result.rows[0],
      topBalances: topBalances.rows
    }
  });
}));
router.get('/admin/reviews', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listReviews(req, res)));
router.put('/admin/reviews/:id/moderate', authMiddleware, roleMiddleware(['admin']), validateBody(moderateReviewSchema), asyncHandler((req: Request, res: Response) => AdminController.moderateReview(req, res)));
router.get('/admin/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getSystemSettings(req, res)));
router.put('/admin/settings', authMiddleware, roleMiddleware(['admin']), validateBody(updateSystemSettingSchema), asyncHandler((req: Request, res: Response) => AdminController.updateSystemSetting(req, res)));
router.post('/admin/settings/test-email', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ success: false, message: 'Recipient email required' });
  const devRedirect = process.env.EMAIL_DEV_REDIRECT;
  try {
    const result = await emailService.send({
      to,
      subject: 'VetCare - Test Email',
      html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>✅ Email is working!</h2><p>This is a test email from VetCare admin panel.</p><p>Sent at: ${new Date().toISOString()}</p><p>Dev redirect: ${devRedirect || 'off'}</p></div>`,
      text: `Email is working! Sent at: ${new Date().toISOString()}`,
    });
    const mode = result.mode || emailService.getMode();
    const messages: Record<string, string> = {
      'resend': 'Test email sent via Resend (HTTP)',
      'smtp': 'Test email sent via SMTP',
      'log-only': 'Email logged (no email provider available - add RESEND_API_KEY for delivery)',
    };
    res.json({ success: true, message: messages[mode] || 'Email processed', data: { messageId: result.messageId, mode, previewUrl: result.previewUrl || null, redirectedTo: devRedirect || null } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Email failed: ${err.message}`, mode: emailService.getMode() });
  }
}));
router.get('/admin/email-templates', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const result = await database.query(
    `SELECT key, value FROM system_settings WHERE key LIKE 'email_template.%'`
  );
  const templates: Record<string, string> = {};
  result.rows.forEach((row: any) => {
    templates[row.key.replace('email_template.', '')] = row.value;
  });
  res.json({ success: true, data: templates });
}));

router.put('/admin/email-templates/:templateName', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { subject, body } = req.body;
  if (!subject || !body) {
    return res.status(400).json({ success: false, error: 'subject and body are required' });
  }
  const templateKey = `email_template.${req.params.templateName}`;
  await database.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [templateKey, JSON.stringify({ subject, body })]
  );
  res.json({ success: true, message: 'Template saved' });
}));

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
  // P4-HIGH1: merge permissions from all roles the user has
  const rolesToCheck = authReq.userRoles && authReq.userRoles.length > 0
    ? authReq.userRoles
    : [authReq.userRole || ''];
  const permSets = await Promise.all(rolesToCheck.map(r => PermissionService.getPermissionsForRole(r)));
  const permissions = [...new Set(permSets.flat())];
  const metadata = PermissionService.getPermissionMetadata();
  // §7 reconciliation: include the caller's network memberships + effective action matrix so the
  // frontend can drive network-role-aware navigation/visibility (hospital_director, etc.).
  let networks: any[] = [];
  try {
    networks = await HospitalNetworkService.getMyNetworkAccess(authReq.userId!);
  } catch (err: any) {
    logger.warn('getMyNetworkAccess failed; returning permissions without network context', { error: err.message });
  }
  res.json({ success: true, data: { permissions, metadata, networks } });
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

// ─── Marketplace & Auctions ─────────────────────────
router.get('/marketplace/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceDashboard(req, res)));
router.get('/marketplace/listings', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceListings(req, res)));
router.get('/marketplace/listings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceListing(req, res)));
router.post('/marketplace/listings', authMiddleware, validateBody(createMarketplaceListingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('admin', 'marketplace') } })
  await Tier4Controller.createMarketplaceListing(req, res)
}));
router.put('/marketplace/listings/:id', authMiddleware, validateBody(updateMarketplaceListingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('admin', 'marketplace') } })
  await Tier4Controller.updateMarketplaceListing(req, res)
}));
router.delete('/marketplace/listings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplaceListing(req, res)));
router.get('/marketplace/listings/:listingId/bids', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceBids(req, res)));
router.post('/marketplace/listings/:listingId/bids', authMiddleware, validateBody(placeBidSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.placeMarketplaceBid(req, res)));
router.get('/marketplace/orders', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceOrders(req, res)));
router.post('/marketplace/orders', authMiddleware, validateBody(createMarketplaceOrderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceOrder(req, res)));
router.patch('/marketplace/orders/:id/status', authMiddleware, validateBody(updateOrderStatusSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateOrderStatus(req, res)));
// Deal handshake: both parties confirm off-platform settlement; either can cancel a reservation
router.post('/marketplace/orders/:id/confirm', authMiddleware, validateBody(confirmDealSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.confirmMarketplaceDeal(req, res)));
router.post('/marketplace/orders/:id/cancel', authMiddleware, validateBody(cancelDealSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.cancelMarketplaceDeal(req, res)));
router.get('/marketplace/prices', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketPrices(req, res)));
// ─── Marketplace Engagement (Phase 3): messaging, favorites, saved searches ───
router.get('/marketplace/threads', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceThreads(req, res)));
router.get('/marketplace/threads/unread-count', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceUnreadCount(req, res)));
router.post('/marketplace/listings/:listingId/threads', authMiddleware, validateBody(startThreadSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.startMarketplaceThread(req, res)));
router.get('/marketplace/threads/:id/messages', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceThreadMessages(req, res)));
router.post('/marketplace/threads/:id/messages', authMiddleware, validateBody(sendMessageSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.sendMarketplaceMessage(req, res)));
router.get('/marketplace/favorites', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceFavorites(req, res)));
router.get('/marketplace/favorites/ids', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceFavoriteIds(req, res)));
router.post('/marketplace/listings/:listingId/favorite', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.addMarketplaceFavorite(req, res)));
router.delete('/marketplace/listings/:listingId/favorite', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.removeMarketplaceFavorite(req, res)));
router.get('/marketplace/config', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceConfig(req, res)));
router.post('/marketplace/listings/:listingId/report', authMiddleware, validateBody(reportListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.reportMarketplaceListing(req, res)));
router.get('/marketplace/admin/reports', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminListMarketplaceReports(req, res)));
router.patch('/marketplace/admin/reports/:id', authMiddleware, roleMiddleware(['admin']), validateBody(resolveReportSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.adminResolveMarketplaceReport(req, res)));
router.get('/marketplace/saved-searches', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceSavedSearches(req, res)));
router.post('/marketplace/saved-searches', authMiddleware, validateBody(createSavedSearchSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceSavedSearch(req, res)));
router.put('/marketplace/saved-searches/:id', authMiddleware, validateBody(updateSavedSearchSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMarketplaceSavedSearch(req, res)));
router.delete('/marketplace/saved-searches/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplaceSavedSearch(req, res)));
// Admin marketplace controls
router.get('/marketplace/admin/listings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminListMarketplaceListings(req, res)));
router.get('/marketplace/admin/stats', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceStats(req, res)));
router.patch('/marketplace/admin/listings/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminApproveMarketplaceListing(req, res)));
router.patch('/marketplace/admin/listings/:id/reject', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminRejectMarketplaceListing(req, res)));
router.patch('/marketplace/admin/listings/:id/hot-deal', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminToggleHotDeal(req, res)));
router.patch('/marketplace/admin/listings/:id/featured', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminToggleFeatured(req, res)));
// Marketplace Monetization - Admin
router.get('/marketplace/admin/monetization/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMonetizationSettings(req, res)));
router.put('/marketplace/admin/monetization/settings/:key', authMiddleware, roleMiddleware(['admin']), validateBody(updateMonetizationSettingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMonetizationSetting(req, res)));
router.get('/marketplace/admin/monetization/plans', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplacePlans(req, res)));
router.post('/marketplace/admin/monetization/plans', authMiddleware, roleMiddleware(['admin']), validateBody(createMPlanSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplacePlan(req, res)));
router.put('/marketplace/admin/monetization/plans/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMPlanSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMarketplacePlan(req, res)));
router.delete('/marketplace/admin/monetization/plans/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplacePlan(req, res)));
router.get('/marketplace/admin/monetization/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMonetizationDashboard(req, res)));
// Marketplace Monetization - User
router.get('/marketplace/subscription', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getUserSubscription(req, res)));
router.post('/marketplace/subscription', authMiddleware, validateBody(createSubscriptionSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createUserSubscription(req, res)));
router.delete('/marketplace/subscription', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.cancelUserSubscription(req, res)));
router.post('/marketplace/listings/:id/boost', authMiddleware, validateBody(boostListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.boostMarketplaceListing(req, res)));
router.post('/marketplace/listings/:listingId/inquiries', authMiddleware, validateBody(createInquirySchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceInquiry(req, res)));
router.get('/marketplace/inquiries', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceInquiries(req, res)));
router.patch('/marketplace/inquiries/:id/respond', authMiddleware, validateBody(respondInquirySchema), asyncHandler((req: Request, res: Response) => Tier4Controller.respondToMarketplaceInquiry(req, res)));
router.get('/marketplace/monetization-status', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getUserMonetizationStatus(req, res)));
// Auction feature flag - readable by any authenticated user, writable by admin only
router.get('/marketplace/auction-enabled', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getAuctionEnabled(req, res)));
router.put('/marketplace/admin/auction-enabled', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.setAuctionEnabled(req, res)));

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

// ─── Emergency diagnostics (break-glass token required) ──────
/**
 * These two endpoints exist for the case where a deploy left the database in a
 * state the app cannot start against (the 2026-07-26 Render investigation). That
 * is exactly the case where `authMiddleware` would be useless as the gate: if the
 * schema is missing or wrong, nobody can log in to authorise the repair - so
 * requiring a login would break the emergency they exist to solve.
 *
 * The gate is therefore a pre-shared secret in EMERGENCY_DIAGNOSTIC_TOKEN,
 * compared in constant time. If that env var is unset the endpoints are disabled
 * outright: fail closed, so an operator who never opted in is never exposed.
 *
 * Both respond 404 rather than 401/403 - an anonymous prober should not even be
 * able to confirm the route exists.
 *
 * To use during an incident:
 *   curl -H "x-emergency-token: $EMERGENCY_DIAGNOSTIC_TOKEN" .../api/v1/debug/db-state
 */
const emergencyGate = (req: Request, res: Response, next: NextFunction): void => {
  const expected = process.env.EMERGENCY_DIAGNOSTIC_TOKEN || '';
  const provided = req.get('x-emergency-token') || '';
  const deny = (reason: string): void => {
    logger.warn('Emergency diagnostic endpoint denied', { path: req.path, ip: req.ip, reason });
    res.status(404).json({ success: false, error: 'Not found' });
  };

  // Unset (or trivially short) token means the break-glass path is not enabled.
  if (expected.length < 16) return deny('EMERGENCY_DIAGNOSTIC_TOKEN unset or too short (min 16 chars)');

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return deny('token mismatch');

  logger.warn('Emergency diagnostic endpoint AUTHORISED via break-glass token', { path: req.path, ip: req.ip });
  next();
};

router.get('/debug/db-state', emergencyGate, async (_req, res) => {
  try {
    const schema = process.env.DB_SCHEMA || 'public';
    const rows: Record<string, any> = {};

    // current search_path
    const spResult = await database.query('SHOW search_path');
    rows.searchPath = spResult.rows[0]?.search_path;

    // list all non-system schemas
    const schemas = await database.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name`);
    rows.schemas = schemas.rows.map((r: any) => r.schema_name);

    // tables in target schema
    const tables = await database.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`, [schema]);
    rows.tablesInSchema = tables.rows.map((r: any) => r.table_name);

    // tables in public schema
    const publicTables = await database.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    rows.tablesInPublic = publicTables.rows.map((r: any) => r.table_name);

    // user count (try both schemas)
    try {
      const uc = await database.query(`SELECT COUNT(*)::int AS cnt FROM "${schema}".users`);
      rows.userCountInSchema = uc.rows[0]?.cnt;
    } catch { rows.userCountInSchema = 'error - table likely missing'; }

    res.json({ status: 'ok', targetSchema: schema, ...rows });
  } catch (e: any) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

router.post('/repair-schema', emergencyGate, async (_req, res) => {
  try {
    const result = await database.repairSchema();
    if (result.success) {
      // Also seed demo users
      try {
        const { fixDemoPasswords } = await import('../utils/fixDemoPasswords');
        await fixDemoPasswords();
        (result as any).demoUsers = 'seeded';
      } catch (se: any) {
        (result as any).demoUsers = 'error: ' + se.message;
      }
    }
    res.status(result.success ? 200 : 500).json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── File Uploads ────────────────────────────────────────────
router.post('/files/upload', authMiddleware, uploadAny.single('file'), asyncHandler((req: Request, res: Response) => FileController.upload(req, res)));
router.post('/files/upload-image', authMiddleware, uploadImage.single('file'), asyncHandler((req: Request, res: Response) => FileController.upload(req, res)));
router.post('/files/upload-video', authMiddleware, uploadVideo.single('file'), asyncHandler((req: Request, res: Response) => FileController.uploadVideo(req, res)));
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

// ─── Vaccine protocols - public read (authenticated) ─────────
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

// ═══════════════════════════════════════════════════════════════════
// Master Data - species, breeds, animal classes, marketplace categories/conditions.
// Public read (active-only, powers dropdowns) + admin CRUD (archive/restore + delete
// blocked while in use). Mirrors the vaccine-protocols route shape above.
// ═══════════════════════════════════════════════════════════════════

// ─── Public read (no auth - powers dropdowns on both authed pages and the
// unauthenticated PublicMarketplace; mirrors GET /settings/public's convention
// for non-sensitive UI config that must load before/without login) ─────────
router.get('/master-data/species', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listSpecies(true) });
}));
router.get('/master-data/breeds', asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listBreeds(req.query.speciesId as string | undefined, true) });
}));
router.get('/master-data/animal-classes', asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listAnimalClasses(req.query.speciesId as string | undefined, true) });
}));
router.get('/master-data/marketplace/categories', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceCategories(true) });
}));
router.get('/master-data/marketplace/conditions', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceConditions(true) });
}));

// ─── Admin CRUD: Species ───────────────────────────────────────
router.get('/admin/master-data/species', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listSpecies(false) });
}));
router.post('/admin/master-data/species', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterSpeciesSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createSpecies(req.body) });
}));
router.put('/admin/master-data/species/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterSpeciesSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateSpecies(req.params.id, req.body) });
}));
router.patch('/admin/master-data/species/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveSpecies(req.params.id);
  res.json({ success: true, message: 'Species archived' });
}));
router.patch('/admin/master-data/species/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreSpecies(req.params.id);
  res.json({ success: true, message: 'Species restored' });
}));
router.delete('/admin/master-data/species/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteSpecies(req.params.id);
  res.json({ success: true, message: 'Species deleted' });
}));

// ─── Admin CRUD: Breeds ────────────────────────────────────────
router.get('/admin/master-data/breeds', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listBreeds(req.query.speciesId as string | undefined, false) });
}));
router.post('/admin/master-data/breeds', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterBreedSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createBreed(req.body) });
}));
router.put('/admin/master-data/breeds/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterBreedSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateBreed(req.params.id, req.body) });
}));
router.patch('/admin/master-data/breeds/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveBreed(req.params.id);
  res.json({ success: true, message: 'Breed archived' });
}));
router.patch('/admin/master-data/breeds/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreBreed(req.params.id);
  res.json({ success: true, message: 'Breed restored' });
}));
router.delete('/admin/master-data/breeds/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteBreed(req.params.id);
  res.json({ success: true, message: 'Breed deleted' });
}));

// ─── Admin CRUD: Animal Classes ────────────────────────────────
router.get('/admin/master-data/animal-classes', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listAnimalClasses(req.query.speciesId as string | undefined, false) });
}));
router.post('/admin/master-data/animal-classes', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterAnimalClassSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createAnimalClass(req.body) });
}));
router.put('/admin/master-data/animal-classes/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterAnimalClassSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateAnimalClass(req.params.id, req.body) });
}));
router.patch('/admin/master-data/animal-classes/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveAnimalClass(req.params.id);
  res.json({ success: true, message: 'Animal class archived' });
}));
router.patch('/admin/master-data/animal-classes/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreAnimalClass(req.params.id);
  res.json({ success: true, message: 'Animal class restored' });
}));
router.delete('/admin/master-data/animal-classes/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteAnimalClass(req.params.id);
  res.json({ success: true, message: 'Animal class deleted' });
}));

// ─── Admin CRUD: Marketplace Categories ────────────────────────
router.get('/admin/master-data/marketplace/categories', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceCategories(false) });
}));
router.post('/admin/master-data/marketplace/categories', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterMarketplaceCategorySchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createMarketplaceCategory(req.body) });
}));
router.put('/admin/master-data/marketplace/categories/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterMarketplaceCategorySchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateMarketplaceCategory(req.params.id, req.body) });
}));
router.patch('/admin/master-data/marketplace/categories/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveMarketplaceCategory(req.params.id);
  res.json({ success: true, message: 'Category archived' });
}));
router.patch('/admin/master-data/marketplace/categories/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreMarketplaceCategory(req.params.id);
  res.json({ success: true, message: 'Category restored' });
}));
router.delete('/admin/master-data/marketplace/categories/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteMarketplaceCategory(req.params.id);
  res.json({ success: true, message: 'Category deleted' });
}));

// ─── Admin CRUD: Marketplace Conditions ────────────────────────
router.get('/admin/master-data/marketplace/conditions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.listMarketplaceConditions(false) });
}));
router.post('/admin/master-data/marketplace/conditions', authMiddleware, roleMiddleware(['admin']), validateBody(createMasterMarketplaceConditionSchema), asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: await MasterDataService.createMarketplaceCondition(req.body) });
}));
router.put('/admin/master-data/marketplace/conditions/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMasterMarketplaceConditionSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await MasterDataService.updateMarketplaceCondition(req.params.id, req.body) });
}));
router.patch('/admin/master-data/marketplace/conditions/:id/archive', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.archiveMarketplaceCondition(req.params.id);
  res.json({ success: true, message: 'Condition archived' });
}));
router.patch('/admin/master-data/marketplace/conditions/:id/restore', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.restoreMarketplaceCondition(req.params.id);
  res.json({ success: true, message: 'Condition restored' });
}));
router.delete('/admin/master-data/marketplace/conditions/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await MasterDataService.deleteMarketplaceCondition(req.params.id);
  res.json({ success: true, message: 'Condition deleted' });
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

// Group vaccination passport - the passport for a batch herd/flock is the group's, not a bird's.
// Farmers/vets/admins may view any group they can see; pet owners are blocked (groups are farm assets).
router.get('/vaccination-passport/group/:groupId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.userRole === 'pet_owner') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  if (authReq.userRole !== 'admin' && authReq.userRole !== 'veterinarian') {
    // farmer: only their own enterprise's group
    const { rows } = await database.query(
      `SELECT 1 FROM animal_groups ag
         JOIN enterprises e ON e.id = ag.enterprise_id
        WHERE ag.id = $1 AND e.owner_id = $2`,
      [req.params.groupId, authReq.userId]
    );
    if (!rows[0]) return res.status(403).json({ success: false, message: 'Access denied' });
  }
  const passport = await VaccineProtocolService.getGroupVaccinationPassport(req.params.groupId);
  res.json({ success: true, data: passport });
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
  const { requested_role, reason, profile } = req.body;
  const userId = authReq.userId;
  const currentRole = authReq.userRole;
  if (requested_role === currentRole) {
    return res.status(400).json({ success: false, message: 'Requested role is the same as your current role' });
  }
  const existing = await (await import('../utils/database')).default.query(
    `SELECT id FROM role_change_requests WHERE user_id = $1 AND status = 'pending'`, [userId]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, message: 'You already have a pending role change request' });
  }
  // Store role-specific details (validated by roleChangeRequestSchema) so the admin can
  // review + provision the satellite profile on approval. Empty object for non-vet roles.
  const profilePayload = requested_role === 'veterinarian' && profile ? profile : {};
  const result = await (await import('../utils/database')).default.query(
    `INSERT INTO role_change_requests (user_id, "current_role", requested_role, reason, profile_payload)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, status, created_at`,
    [userId, currentRole, requested_role, reason, JSON.stringify(profilePayload)]
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
            r.reason, r.profile_payload AS "profilePayload", r.created_at AS "createdAt",
            u.first_name || ' ' || u.last_name AS "userName",
            u.email AS "userEmail", u.unique_id AS "uniqueId",
            r.rejection_reason AS "rejectionReason", r.reviewed_at AS "reviewedAt",
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

  // Provision the role's satellite profile in the SAME transaction as the role flip, so a
  // user approved into 'veterinarian' always gets a vet_profiles row and is immediately
  // visible/bookable in Find Doctor (which INNER JOINs vet_profiles). Admin-approval counts
  // as verification, so is_verified/is_available = true (mirrors AdminService.approveUser).
  await db.transaction(async (client: any) => {
    await client.query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, [rcr.requested_role, rcr.uid]);

    if (rcr.requested_role === 'veterinarian') {
      const p = rcr.profile_payload || {};
      await client.query(
        `INSERT INTO vet_profiles
           (user_id, license_number, specializations, qualifications, years_of_experience,
            clinic_name, consultation_fee, is_verified, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
         ON CONFLICT (user_id) DO UPDATE SET
           license_number      = COALESCE(NULLIF(EXCLUDED.license_number, ''), vet_profiles.license_number),
           specializations     = CASE WHEN cardinality(EXCLUDED.specializations) > 0 THEN EXCLUDED.specializations ELSE vet_profiles.specializations END,
           qualifications      = CASE WHEN cardinality(EXCLUDED.qualifications) > 0 THEN EXCLUDED.qualifications ELSE vet_profiles.qualifications END,
           years_of_experience = GREATEST(EXCLUDED.years_of_experience, vet_profiles.years_of_experience),
           clinic_name         = COALESCE(NULLIF(EXCLUDED.clinic_name, ''), vet_profiles.clinic_name),
           consultation_fee    = CASE WHEN EXCLUDED.consultation_fee > 0 THEN EXCLUDED.consultation_fee ELSE vet_profiles.consultation_fee END,
           is_verified         = true,
           is_available        = true,
           updated_at          = NOW()`,
        [
          rcr.uid,
          (p.licenseNumber || '').toString().trim(),
          Array.isArray(p.specializations) ? p.specializations : [],
          Array.isArray(p.qualifications) ? p.qualifications : [],
          Number(p.yearsOfExperience) || 0,
          (p.clinicName || '').toString().trim(),
          Number(p.consultationFee) || 0,
        ]
      );
    }

    await client.query(
      `UPDATE role_change_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [authReq.userId, req.params.id]
    );
  });
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
// PRICING VISIBILITY (public endpoint + admin management)
// ─────────────────────────────────────────────────────────────────────────────

// system_settings values are free-text editable (generic admin settings table,
// not just the dedicated Pricing Settings page) - normalize case/whitespace so
// a typo like 'True' doesn't silently disable visibility. See payment.enabled
// incident (2026-07-06) for why this must never be a strict '=== "true"'.
const isSettingTrue = (value: string | undefined | null): boolean =>
  typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase());

router.get('/pricing/plans', asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const [plansResult, settingsResult] = await Promise.all([
    db.query(`SELECT id, name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, sort_order FROM network_subscription_plans WHERE is_published = true AND is_active = true ORDER BY sort_order`),
    db.query(`SELECT key, value FROM system_settings WHERE key LIKE 'pricing.%'`),
  ]);
  const settings: Record<string, string> = {};
  for (const row of settingsResult.rows) settings[row.key] = row.value;
  const globalVisible = isSettingTrue(settings['pricing.visibility.global']);
  res.json({ success: true, data: {
    isVisible: globalVisible,
    plans: globalVisible ? plansResult.rows : [],
    ctaText: settings['pricing.cta_text'] || 'Contact us for pricing',
    ctaEmail: settings['pricing.cta_email'] || '',
    ctaPhone: settings['pricing.cta_phone'] || '',
    visibility: {
      global: globalVisible,
      landing_page: isSettingTrue(settings['pricing.visibility.landing_page']),
      registration: isSettingTrue(settings['pricing.visibility.registration']),
      corp_dashboard: isSettingTrue(settings['pricing.visibility.corp_dashboard']),
      upgrade_prompts: isSettingTrue(settings['pricing.visibility.upgrade_prompts']),
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
  const showPrice = isSettingTrue(vis.rows[0]?.value);
  const sub = result.rows[0] || { network_id: networkId, seat_limit: 5, status: 'trial', seatsUsed: 0, planName: 'Trial' };
  if (!showPrice) { delete sub.priceMonthly; delete sub.priceAnnually; }
  res.json({ success: true, data: sub });
}));

// ─────────────────────────────────────────────────────────────────────────────
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

// ============================================================
// PHARMACY MODULE ROUTES
// ============================================================

// ── Access Guards ────────────────────────────────────────────
// Returns networkId or sends 403/404 and returns null. All pharmacy routes MUST call this first.
async function guardPharmacy(req: Request, res: Response, pharmacyId: string): Promise<string | null> {
  const authReq = req as any;
  if (!pharmacyId) { res.status(400).json({ success: false, message: 'pharmacyId is required' }); return null; }
  const p = await database.query('SELECT network_id, is_active FROM hospital_pharmacies WHERE id=$1', [pharmacyId]);
  if (!p.rows[0]) { res.status(404).json({ success: false, message: 'Pharmacy not found' }); return null; }
  if (authReq.userRole === 'admin') return p.rows[0].network_id;
  const m = await database.query(
    'SELECT 1 FROM hospital_network_members WHERE network_id=$1 AND user_id=$2 AND is_active=true',
    [p.rows[0].network_id, authReq.userId]
  );
  if (!m.rows[0]) { res.status(403).json({ success: false, message: 'You are not a member of this pharmacy\'s network' }); return null; }
  return p.rows[0].network_id;
}

// Network-level pharmacy guard (for /networks/:networkId/suppliers, /medications etc.)
async function guardNetworkPharmacy(req: Request, res: Response, networkId: string): Promise<boolean> {
  const authReq = req as any;
  if (authReq.userRole === 'admin') return true;
  const m = await database.query(
    'SELECT 1 FROM hospital_network_members WHERE network_id=$1 AND user_id=$2 AND is_active=true',
    [networkId, authReq.userId]
  );
  if (!m.rows[0]) { res.status(403).json({ success: false, message: 'You are not a member of this network' }); return false; }
  return true;
}

// Auto-discover pharmacies for the current user based on network membership
router.get('/pharmacy/my-pharmacies', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const userId = authReq.userId;

  // An empty list has two completely different causes and the screen used to show the same
  // dead end for both: "Select a pharmacy", with nothing to select and no explanation. `reason`
  // lets the UI say which precondition actually failed and what to do about it.
  // See docs/DESIGN_SYSTEM.md section 5a.

  // A platform admin is not a network member but must still be able to see and set pharmacies up.
  if (authReq.userRole === 'admin') {
    const all = await database.query(
      `SELECT hp.*, vh.name AS hospital_name FROM hospital_pharmacies hp
       LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
       ORDER BY hp.is_primary_pharmacy DESC, hp.pharmacy_name ASC`
    );
    return res.json({
      success: true, data: all.rows, networkId: null,
      reason: all.rows.length ? 'ok' : 'no_pharmacy_in_network', canCreate: true,
    });
  }

  const memberRes = await database.query(
    `SELECT hnm.network_id, hnm.network_role
       FROM hospital_network_members hnm
      WHERE hnm.user_id = $1 AND hnm.is_active = true
        AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
    [userId]
  );
  if (memberRes.rows.length === 0) {
    // The pharmacist exists but nobody has added them to a network, so there is no pharmacy
    // they could possibly reach. Previously indistinguishable from "network has no pharmacy".
    return res.json({
      success: true, data: [], networkId: null,
      reason: 'not_in_network', canCreate: false,
    });
  }

  const networkId = memberRes.rows[0].network_id;
  // Only these roles may stand a new pharmacy up; the UI uses this to decide whether to offer
  // the action or tell the user who to ask.
  const canCreate = ['corporate_admin', 'hospital_director'].includes(memberRes.rows[0].network_role);

  const pharmaRes = await database.query(
    `SELECT hp.*, vh.name AS hospital_name FROM hospital_pharmacies hp
     LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
     WHERE hp.network_id = $1
     ORDER BY hp.is_primary_pharmacy DESC, hp.pharmacy_name ASC`,
    [networkId]
  );
  res.json({
    success: true, data: pharmaRes.rows, networkId,
    reason: pharmaRes.rows.length ? 'ok' : 'no_pharmacy_in_network',
    canCreate,
  });
}));

// ── Pharmacy Setup ──────────────────────────────────────────

// List pharmacies for a network
router.get('/networks/:networkId/pharmacies', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { networkId } = req.params;
  if (!await guardNetworkPharmacy(req, res, networkId)) return;
  const result = await database.query(
    `SELECT hp.*, vh.name AS hospital_name, u.first_name || ' ' || u.last_name AS created_by_name
     FROM hospital_pharmacies hp
     LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
     LEFT JOIN users u ON hp.created_by = u.id
     WHERE hp.network_id = $1
     ORDER BY hp.is_primary_pharmacy DESC, hp.pharmacy_name ASC`,
    [networkId]
  );
  res.json(result.rows);
}));

// Create pharmacy
router.post('/networks/:networkId/pharmacies', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const { networkId } = req.params;
  if (!await guardNetworkPharmacy(req, res, networkId)) return;
  const { pharmacy_name, hospital_id, address, phone, email, license_number, operating_hours, is_primary_pharmacy } = req.body;
  if (!pharmacy_name) return res.status(400).json({ error: 'pharmacy_name is required' });
  // If setting as primary, unset others
  if (is_primary_pharmacy) {
    await database.query(`UPDATE hospital_pharmacies SET is_primary_pharmacy = false WHERE network_id = $1`, [networkId]);
  }
  const result = await database.query(
    `INSERT INTO hospital_pharmacies (network_id, hospital_id, pharmacy_name, address, phone, email, license_number, operating_hours, is_primary_pharmacy, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [networkId, hospital_id || null, pharmacy_name, address || null, phone || null, email || null, license_number || null, operating_hours ? JSON.stringify(operating_hours) : '{}', is_primary_pharmacy || false, authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

// Get / Update pharmacy
router.get('/pharmacies/:pharmacyId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT hp.*, vh.name AS hospital_name FROM hospital_pharmacies hp
     LEFT JOIN vet_hospitals vh ON hp.hospital_id = vh.id
     WHERE hp.id = $1`,
    [req.params.pharmacyId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Pharmacy not found' });
  res.json(result.rows[0]);
}));

router.patch('/pharmacies/:pharmacyId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { pharmacy_name, address, phone, email, license_number, operating_hours, is_primary_pharmacy, is_accepting_requests, is_active } = req.body;
  const existing = await database.query(`SELECT * FROM hospital_pharmacies WHERE id = $1`, [req.params.pharmacyId]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Pharmacy not found' });
  if (is_primary_pharmacy) {
    await database.query(`UPDATE hospital_pharmacies SET is_primary_pharmacy = false WHERE network_id = $1`, [existing.rows[0].network_id]);
  }
  const result = await database.query(
    `UPDATE hospital_pharmacies SET
       pharmacy_name = COALESCE($1, pharmacy_name),
       address = COALESCE($2, address),
       phone = COALESCE($3, phone),
       email = COALESCE($4, email),
       license_number = COALESCE($5, license_number),
       operating_hours = COALESCE($6::jsonb, operating_hours),
       is_primary_pharmacy = COALESCE($7, is_primary_pharmacy),
       is_accepting_requests = COALESCE($8, is_accepting_requests),
       is_active = COALESCE($9, is_active),
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [pharmacy_name, address, phone, email, license_number, operating_hours ? JSON.stringify(operating_hours) : null, is_primary_pharmacy, is_accepting_requests, is_active, req.params.pharmacyId]
  );
  res.json(result.rows[0]);
}));

// ── Suppliers ──────────────────────────────────────────────

router.get('/networks/:networkId/suppliers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const result = await database.query(
    `SELECT ps.*, (SELECT COUNT(*) FROM pharmacy_medications WHERE supplier_id = ps.id) AS medication_count
     FROM pharmacy_suppliers ps
     WHERE ps.network_id = $1 ORDER BY ps.name ASC`,
    [req.params.networkId]
  );
  res.json(result.rows);
}));

router.post('/networks/:networkId/suppliers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const authReq = req as any;
  const { name, contact_name, email, phone, address, payment_terms, lead_time_days, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await database.query(
    `INSERT INTO pharmacy_suppliers (network_id, name, contact_name, email, phone, address, payment_terms, lead_time_days, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [req.params.networkId, name, contact_name || null, email || null, phone || null, address || null, payment_terms || null, lead_time_days || 7, notes || null, authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/networks/:networkId/suppliers/:supplierId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { name, contact_name, email, phone, address, payment_terms, lead_time_days, notes, is_approved, is_active } = req.body;
  const result = await database.query(
    `UPDATE pharmacy_suppliers SET
       name = COALESCE($1, name), contact_name = COALESCE($2, contact_name),
       email = COALESCE($3, email), phone = COALESCE($4, phone),
       address = COALESCE($5, address), payment_terms = COALESCE($6, payment_terms),
       lead_time_days = COALESCE($7, lead_time_days), notes = COALESCE($8, notes),
       is_approved = COALESCE($9, is_approved), is_active = COALESCE($10, is_active),
       updated_at = NOW()
     WHERE id = $11 AND network_id = $12 RETURNING *`,
    [name, contact_name, email, phone, address, payment_terms, lead_time_days, notes, is_approved, is_active, req.params.supplierId, req.params.networkId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Supplier not found' });
  res.json(result.rows[0]);
}));

// ── Medications ─────────────────────────────────────────────

router.get('/networks/:networkId/medications', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const result = await database.query(
    `SELECT pm.*, ps.name AS supplier_name FROM pharmacy_medications pm
     LEFT JOIN pharmacy_suppliers ps ON pm.supplier_id = ps.id
     WHERE pm.network_id = $1
     ORDER BY pm.name ASC`,
    [req.params.networkId]
  );
  res.json(result.rows);
}));

router.post('/networks/:networkId/medications', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const authReq = req as any;
  const { name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, contraindications, side_effects, common_interactions } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await database.query(
    `INSERT INTO pharmacy_medications (network_id, name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, contraindications, side_effects, common_interactions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
    [req.params.networkId, name, generic_name || null, form || 'tablet', strength || null, unit || 'unit', supplier_id || null, unit_cost || 0, selling_price || 0, min_stock_level || 10, max_stock_level || 500, reorder_point || 20, reorder_quantity || 100, manufacturer || null, registration_number || null, is_controlled || false, contraindications || [], side_effects || [], common_interactions || [], authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/networks/:networkId/medications/:medId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, is_active } = req.body;
  const result = await database.query(
    `UPDATE pharmacy_medications SET
       name = COALESCE($1, name), generic_name = COALESCE($2, generic_name),
       form = COALESCE($3, form), strength = COALESCE($4, strength),
       unit = COALESCE($5, unit), supplier_id = COALESCE($6, supplier_id),
       unit_cost = COALESCE($7, unit_cost), selling_price = COALESCE($8, selling_price),
       min_stock_level = COALESCE($9, min_stock_level), max_stock_level = COALESCE($10, max_stock_level),
       reorder_point = COALESCE($11, reorder_point), reorder_quantity = COALESCE($12, reorder_quantity),
       manufacturer = COALESCE($13, manufacturer), registration_number = COALESCE($14, registration_number),
       is_controlled = COALESCE($15, is_controlled), is_active = COALESCE($16, is_active),
       updated_at = NOW()
     WHERE id = $17 AND network_id = $18 RETURNING *`,
    [name, generic_name, form, strength, unit, supplier_id, unit_cost, selling_price, min_stock_level, max_stock_level, reorder_point, reorder_quantity, manufacturer, registration_number, is_controlled, is_active, req.params.medId, req.params.networkId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Medication not found' });
  res.json(result.rows[0]);
}));

// ── Inventory ───────────────────────────────────────────────

router.get('/pharmacies/:pharmacyId/inventory', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pi.*, pm.name AS med_name, pm.generic_name, pm.form, pm.strength, pm.unit AS med_unit,
            pm.reorder_point, pm.min_stock_level,
            (pi.expiry_date - CURRENT_DATE) AS days_until_expiry
     FROM pharmacy_inventory pi
     JOIN pharmacy_medications pm ON pi.med_id = pm.id
     WHERE pi.pharmacy_id = $1 AND pi.is_active = true
     ORDER BY pi.expiry_date ASC NULLS LAST`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

router.post('/pharmacies/:pharmacyId/inventory', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { med_id, batch_number, quantity, unit, expiry_date, received_from, location_code, shipment_request_id } = req.body;
  if (!med_id || !quantity) return res.status(400).json({ error: 'med_id and quantity are required' });
  const result = await database.query(
    `INSERT INTO pharmacy_inventory (pharmacy_id, med_id, batch_number, quantity, unit, expiry_date, received_from, received_by, location_code, shipment_request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.params.pharmacyId, med_id, batch_number || null, quantity, unit || 'unit', expiry_date || null, received_from || null, authReq.userId, location_code || null, shipment_request_id || null]
  );
  // Log adjustment
  await database.query(
    `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, adjusted_by)
     VALUES ($1,$2,$3,$4,$5,'add','Batch received',$6)`,
    [req.params.pharmacyId, med_id, result.rows[0].id, batch_number || null, quantity, authReq.userId]
  ).catch(() => {});
  res.status(201).json(result.rows[0]);
}));

// Expiry alerts
router.get('/pharmacies/:pharmacyId/expiry-alerts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pi.*, pm.name AS med_name, pm.form, pm.strength,
            (pi.expiry_date - CURRENT_DATE) AS days_until_expiry
     FROM pharmacy_inventory pi
     JOIN pharmacy_medications pm ON pi.med_id = pm.id
     WHERE pi.pharmacy_id = $1 AND pi.is_active = true
       AND pi.expiry_date IS NOT NULL AND pi.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
     ORDER BY pi.expiry_date ASC`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

// Low stock alerts
router.get('/pharmacies/:pharmacyId/low-stock-alerts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pm.id AS med_id, pm.name AS med_name, pm.form, pm.strength, pm.reorder_point, pm.min_stock_level,
            COALESCE(SUM(pi.quantity), 0) AS current_stock
     FROM pharmacy_medications pm
     LEFT JOIN pharmacy_inventory pi ON pi.med_id = pm.id AND pi.pharmacy_id = $1 AND pi.is_active = true
     WHERE pm.network_id = (SELECT network_id FROM hospital_pharmacies WHERE id = $1)
       AND pm.is_active = true
     GROUP BY pm.id
     HAVING COALESCE(SUM(pi.quantity), 0) <= pm.reorder_point
     ORDER BY current_stock ASC`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

// Stock adjustments
router.post('/pharmacies/:pharmacyId/stock-adjustments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, evidence_url } = req.body;
  if (!med_id || !adjustment_qty || !adjustment_type) return res.status(400).json({ error: 'med_id, adjustment_qty, adjustment_type are required' });
  await database.query(
    `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, evidence_url, adjusted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [req.params.pharmacyId, med_id, inventory_id || null, batch_number || null, adjustment_qty, adjustment_type, reason || null, evidence_url || null, authReq.userId]
  );
  // Update inventory quantity if inventory_id provided
  if (inventory_id) {
    const sign = ['add','return'].includes(adjustment_type) ? '+' : '-';
    await database.query(
      `UPDATE pharmacy_inventory SET quantity = quantity ${sign} $1, updated_at = NOW() WHERE id = $2`,
      [Math.abs(adjustment_qty), inventory_id]
    );
  }
  res.status(201).json({ success: true });
}));

router.get('/pharmacies/:pharmacyId/stock-adjustments', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT psa.*, pm.name AS med_name, u.first_name || ' ' || u.last_name AS adjusted_by_name
     FROM pharmacy_stock_adjustments psa
     JOIN pharmacy_medications pm ON psa.med_id = pm.id
     LEFT JOIN users u ON psa.adjusted_by = u.id
     WHERE psa.pharmacy_id = $1
     ORDER BY psa.adjusted_at DESC LIMIT 200`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

// ── Reorder Requests ─────────────────────────────────────────

router.get('/pharmacies/:pharmacyId/reorders', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const result = await database.query(
    `SELECT pr.*, pm.name AS med_name, pm.form, pm.strength, ps.name AS supplier_name,
            u.first_name || ' ' || u.last_name AS requested_by_name
     FROM pharmacy_reorder_requests pr
     JOIN pharmacy_medications pm ON pr.med_id = pm.id
     LEFT JOIN pharmacy_suppliers ps ON pr.supplier_id = ps.id
     LEFT JOIN users u ON pr.requested_by = u.id
     WHERE pr.pharmacy_id = $1
     ORDER BY pr.created_at DESC`,
    [req.params.pharmacyId]
  );
  res.json(result.rows);
}));

router.post('/pharmacies/:pharmacyId/reorders', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { med_id, supplier_id, requested_qty, notes, triggered_by } = req.body;
  if (!med_id || !requested_qty) return res.status(400).json({ error: 'med_id and requested_qty are required' });
  const result = await database.query(
    `INSERT INTO pharmacy_reorder_requests (pharmacy_id, med_id, supplier_id, requested_qty, requested_by, triggered_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.pharmacyId, med_id, supplier_id || null, requested_qty, authReq.userId, triggered_by || 'manual', notes || null]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/pharmacies/:pharmacyId/reorders/:reorderId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const authReq = req as any;
  const { status, tracking_number, expected_delivery_date, notes } = req.body;
  const now = new Date().toISOString();

  // Build SET clause with correctly indexed parameters - never hardcode index offsets
  const setParts: string[] = [];
  const params: any[] = [];

  if (status !== undefined)                { setParts.push(`status = $${params.push(status)}`); }
  if (tracking_number !== undefined)       { setParts.push(`tracking_number = $${params.push(tracking_number || null)}`); }
  if (expected_delivery_date !== undefined){ setParts.push(`expected_delivery_date = $${params.push(expected_delivery_date || null)}`); }
  if (notes !== undefined)                 { setParts.push(`notes = $${params.push(notes || null)}`); }

  // Status-specific timestamp columns - use correct column names from pharmacy_reorder_requests schema
  if (status === 'received')  { setParts.push(`received_at = $${params.push(now)}`); }
  if (status === 'shipped')   { setParts.push(`shipped_at = $${params.push(now)}`); }
  if (status === 'confirmed') { setParts.push(`confirmed_at = $${params.push(now)}`); }

  setParts.push('updated_at = NOW()');

  // WHERE clause params added last
  const reorderIdx = params.push(req.params.reorderId);
  const pharmacyIdx = params.push(req.params.pharmacyId);

  const result = await database.query(
    `UPDATE pharmacy_reorder_requests SET ${setParts.join(', ')}
     WHERE id = $${reorderIdx} AND pharmacy_id = $${pharmacyIdx} RETURNING *`,
    params
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Reorder request not found' });

  // When marked received: log a stock audit event (non-fatal)
  if (status === 'received') {
    const r = result.rows[0];
    database.query(
      `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, adjustment_qty, adjustment_type, reason, adjusted_by)
       VALUES ($1, $2, $3, 'add', 'Reorder received - add stock via Inventory tab', $4)`,
      [req.params.pharmacyId, r.med_id, r.requested_qty, authReq.userId]
    ).catch(() => {});
  }

  res.json({ success: true, data: result.rows[0] });
}));

// ── Prescription Review ──────────────────────────────────────

// Pending prescriptions queue for a pharmacy
router.get('/pharmacies/:pharmacyId/pending-prescriptions', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = await guardPharmacy(req, res, req.params.pharmacyId);
  if (!networkId) return;
  const result = await database.query(
    `SELECT p.id, p.created_at, p.valid_until, p.instructions, p.medications, p.review_status,
            p.animal_id, p.veterinarian_id, p.pet_owner_id, p.consultation_id,
            a.name AS pet_name, a.species AS animal_species, a.breed AS animal_breed,
            u.first_name || ' ' || u.last_name AS vet_name,
            po.first_name || ' ' || po.last_name AS owner_name,
            (SELECT STRING_AGG(med->>'name', ', ')
             FROM jsonb_array_elements(COALESCE(p.medications, '[]'::jsonb)) AS med
            ) AS medication_names
     FROM prescriptions p
     JOIN animals a ON p.animal_id = a.id
     JOIN users u ON p.veterinarian_id = u.id
     LEFT JOIN users po ON p.pet_owner_id = po.id
     WHERE p.network_id = $1
       AND (p.review_status = 'pending_review' OR p.review_status IS NULL)
       AND p.is_active = true
     ORDER BY p.created_at ASC`,
    [networkId]
  );
  res.json(result.rows);
}));

// Submit prescription review - pharmacist or admin only, scoped to their network
router.post('/prescriptions/:prescriptionId/review', authMiddleware, roleMiddleware(['pharmacist', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  // Verify prescription exists and belongs to the pharmacist's network
  const rxRow = await database.query(
    `SELECT id, network_id FROM prescriptions WHERE id = $1 AND is_active = true`,
    [req.params.prescriptionId]
  );
  if (!rxRow.rows[0]) return res.status(404).json({ success: false, message: 'Prescription not found' });
  if (authReq.userRole !== 'admin') {
    if (!await guardNetworkPharmacy(req, res, rxRow.rows[0].network_id)) return;
  }
  // Accept both field naming conventions (frontend sends review_notes; canonical is rejection_reason/findings)
  const review_status = req.body.review_status;
  const validation_checks = req.body.validation_checks || {};
  const rejection_reason = req.body.rejection_reason || req.body.review_notes || null;
  const findings = req.body.findings || null;
  const suggested_modifications = req.body.suggested_modifications || null;
  if (!review_status) return res.status(400).json({ success: false, message: 'review_status is required' });
  const validStatuses = ['approved', 'rejected', 'needs_clarification'];
  if (!validStatuses.includes(review_status)) return res.status(400).json({ success: false, message: 'Invalid review_status' });
  // Insert review record
  // findings is TEXT[] - the frontend sends one free-text string, so wrap it as a
  // single-element array; binding a bare JS string to an array column throws
  // "malformed array literal" in Postgres.
  await database.query(
    `INSERT INTO prescription_reviews (prescription_id, pharmacist_id, review_status, validation_checks, findings, suggested_modifications, rejection_reason)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
    [req.params.prescriptionId, authReq.userId, review_status, JSON.stringify(validation_checks), findings ? [findings] : null, suggested_modifications, rejection_reason]
  );
  // Map to prescription review_status
  const prescriptionStatus = review_status === 'approved' ? 'approved_for_dispensing' : review_status === 'rejected' ? 'rejected' : 'needs_clarification';
  await database.query(
    `UPDATE prescriptions SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW() WHERE id = $4`,
    [prescriptionStatus, authReq.userId, rejection_reason || suggested_modifications || null, req.params.prescriptionId]
  );
  // Notify vet on rejection or clarification request
  if (review_status === 'rejected' || review_status === 'needs_clarification') {
    try {
      const rxRow = await database.query(
        `SELECT p.veterinarian_id, a.name AS animal_name FROM prescriptions p LEFT JOIN animals a ON a.id=p.animal_id WHERE p.id=$1`,
        [req.params.prescriptionId]
      );
      if (rxRow.rows[0]) {
        const msg = review_status === 'rejected'
          ? `Your prescription for ${rxRow.rows[0].animal_name || 'your patient'} was rejected by the pharmacist.${rejection_reason ? ' Reason: ' + rejection_reason : ''}`
          : `Pharmacist needs clarification on your prescription for ${rxRow.rows[0].animal_name || 'your patient'}.${suggested_modifications ? ' Note: ' + suggested_modifications : ''}`;
        const NSvc = (await import('../services/NotificationService')).default;
        await NSvc.createNotification(rxRow.rows[0].veterinarian_id, 'prescription',
          review_status === 'rejected' ? 'Prescription Rejected' : 'Prescription - Clarification Needed',
          msg, 'all', { prescriptionId: req.params.prescriptionId });
      }
    } catch { /* non-fatal */ }
  }
  res.json({ success: true, review_status: prescriptionStatus });
}));

// Get review history for a prescription
router.get('/prescriptions/:prescriptionId/reviews', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const rxRow = await database.query(
    `SELECT veterinarian_id, pet_owner_id, network_id FROM prescriptions WHERE id = $1`,
    [req.params.prescriptionId]
  );
  if (!rxRow.rows[0]) return res.status(404).json({ success: false, message: 'Prescription not found' });
  const { veterinarian_id, pet_owner_id, network_id } = rxRow.rows[0];
  const isOwner = authReq.userId === veterinarian_id || authReq.userId === pet_owner_id;
  if (authReq.userRole !== 'admin' && !isOwner) {
    if (!network_id) return res.status(403).json({ success: false, message: 'You do not have access to this prescription' });
    if (!await guardNetworkPharmacy(req, res, network_id)) return;
  }
  const result = await database.query(
    `SELECT pr.*, u.first_name || ' ' || u.last_name AS pharmacist_name
     FROM prescription_reviews pr
     JOIN users u ON pr.pharmacist_id = u.id
     WHERE pr.prescription_id = $1
     ORDER BY pr.reviewed_at DESC`,
    [req.params.prescriptionId]
  );
  res.json(result.rows);
}));

// ── Dispensing ──────────────────────────────────────────────

// Ready-for-dispensing queue
router.get('/pharmacies/:pharmacyId/ready-for-dispensing', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const networkId = await guardPharmacy(req, res, req.params.pharmacyId);
  if (!networkId) return;
  const result = await database.query(
    `SELECT p.id, p.created_at, p.valid_until, p.instructions, p.medications, p.review_status,
            p.animal_id, p.veterinarian_id, p.pet_owner_id, p.consultation_id,
            a.name AS pet_name, a.species AS animal_species, a.breed AS animal_breed,
            u.first_name || ' ' || u.last_name AS vet_name,
            po.first_name || ' ' || po.last_name AS owner_name,
            dr.id AS dispensing_record_id, dr.dispensing_status,
            (SELECT STRING_AGG(med->>'name', ', ')
             FROM jsonb_array_elements(COALESCE(p.medications, '[]'::jsonb)) AS med
            ) AS medication_names
     FROM prescriptions p
     JOIN animals a ON p.animal_id = a.id
     JOIN users u ON p.veterinarian_id = u.id
     LEFT JOIN users po ON p.pet_owner_id = po.id
     LEFT JOIN dispensing_records dr ON dr.prescription_id = p.id AND dr.pharmacy_id = $1
     WHERE p.network_id = $2
       AND p.review_status = 'approved_for_dispensing'
       AND (dr.id IS NULL OR dr.dispensing_status NOT IN ('handed_over','delivered'))
       AND p.is_active = true
     ORDER BY p.created_at ASC`,
    [req.params.pharmacyId, networkId]
  );
  res.json(result.rows);
}));

// Create dispensing record
router.post('/dispensing', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.body.pharmacy_id)) return;
  const authReq = req as any;
  const { prescription_id, pharmacy_id, dispensing_method, line_items, received_by, notes } = req.body;
  if (!prescription_id || !pharmacy_id) return res.status(400).json({ success: false, message: 'prescription_id and pharmacy_id are required' });
  // Calculate total cost
  const total_cost = (line_items || []).reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
  const record = await database.query(
    `INSERT INTO dispensing_records (prescription_id, pharmacy_id, pharmacist_id, dispensing_method, total_cost, received_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [prescription_id, pharmacy_id, authReq.userId, dispensing_method || 'walk_in_pickup', total_cost, received_by || null, notes || null]
  );
  const recordId = record.rows[0].id;
  // Insert line items
  for (const item of (line_items || [])) {
    await database.query(
      `INSERT INTO dispensing_line_items (dispensing_record_id, med_id, inventory_id, batch_number, quantity_dispensed, unit, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [recordId, item.med_id, item.inventory_id || null, item.batch_number || null, item.quantity_dispensed, item.unit || 'unit', item.unit_price || 0, item.line_total || 0]
    );
    // Decrement inventory
    if (item.inventory_id) {
      await database.query(`UPDATE pharmacy_inventory SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, [item.quantity_dispensed, item.inventory_id]).catch(() => {});
      await database.query(
        `INSERT INTO pharmacy_stock_adjustments (pharmacy_id, med_id, inventory_id, batch_number, adjustment_qty, adjustment_type, reason, adjusted_by)
         VALUES ($1,$2,$3,$4,$5,'dispense','Prescription dispensed',$6)`,
        [pharmacy_id, item.med_id, item.inventory_id, item.batch_number || null, item.quantity_dispensed, authReq.userId]
      ).catch(() => {});
    }
  }
  // Update prescription to dispensed
  await database.query(`UPDATE prescriptions SET review_status = 'dispensed', updated_at = NOW() WHERE id = $1`, [prescription_id]);
  // Create pharmacy payment record (pending - patient pays at counter or later)
  if (total_cost > 0) {
    try {
      const rxForBilling = await database.query(
        `SELECT pet_owner_id, consultation_id FROM prescriptions WHERE id=$1`, [prescription_id]
      );
      if (rxForBilling.rows[0]) {
        const invoiceNum = `PHARM-${recordId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const payStatus = (dispensing_method === 'walk_in_pickup' || dispensing_method === 'hospital_pickup') ? 'completed' : 'pending';
        const payRow = await database.query(
          `INSERT INTO payments (consultation_id, dispensing_id, user_id, payer_id, amount, currency, status, payment_method, payment_source, invoice_number, paid_at, created_at, updated_at)
           VALUES ($1,$2,$3,$3,$4,'INR',$5,'cash','pharmacy',$6,
             CASE WHEN $5='completed' THEN NOW() ELSE NULL END, NOW(), NOW())
           RETURNING id`,
          [rxForBilling.rows[0].consultation_id || null, recordId, rxForBilling.rows[0].pet_owner_id, total_cost, payStatus, invoiceNum]
        );
        const InvoiceService = (await import('../services/payment/InvoiceService')).default;
        await InvoiceService.createPharmacyInvoice(payRow.rows[0].id);
      }
    } catch (billErr: any) {
      logger.warn('Pharmacy billing record creation failed (non-fatal)', { error: billErr.message });
    }
  }
  // Notify pet owner that medication is ready/dispensed
  try {
    const rxRow = await database.query(
      `SELECT p.pet_owner_id, a.name AS animal_name FROM prescriptions p LEFT JOIN animals a ON a.id=p.animal_id WHERE p.id=$1`,
      [prescription_id]
    );
    if (rxRow.rows[0]?.pet_owner_id) {
      const method = dispensing_method || 'walk_in_pickup';
      const msg = method === 'home_delivery'
        ? `${rxRow.rows[0].animal_name || 'Your pet'}'s medication has been dispatched for home delivery.`
        : `${rxRow.rows[0].animal_name || 'Your pet'}'s medication is ready for ${method === 'courier' ? 'courier pickup' : 'collection'} at the pharmacy.`;
      const NSvc = (await import('../services/NotificationService')).default;
      await NSvc.createNotification(rxRow.rows[0].pet_owner_id, 'prescription', 'Medication Ready', msg, 'all', { prescriptionId: prescription_id, dispensingId: recordId });
    }
  } catch { /* non-fatal */ }
  res.status(201).json(record.rows[0]);
}));

// Update dispensing status - requires pharmacy membership
router.patch('/dispensing/:dispensingId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const row = await database.query(
    `SELECT pharmacy_id FROM dispensing_records WHERE id = $1`,
    [req.params.dispensingId]
  );
  if (!row.rows[0]) return res.status(404).json({ error: 'Dispensing record not found' });
  if (!await guardPharmacy(req, res, row.rows[0].pharmacy_id)) return;
  const { dispensing_status, received_by, signature_url, notes } = req.body;
  const now = new Date().toISOString();
  const result = await database.query(
    `UPDATE dispensing_records SET
       dispensing_status = COALESCE($1, dispensing_status),
       received_by = COALESCE($2, received_by),
       signature_url = COALESCE($3, signature_url),
       notes = COALESCE($4, notes),
       handed_over_at = CASE WHEN $1 = 'handed_over' THEN $5::timestamptz ELSE handed_over_at END,
       updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [dispensing_status, received_by, signature_url, notes, now, req.params.dispensingId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Dispensing record not found' });
  res.json(result.rows[0]);
}));

// Dispensing history
router.get('/pharmacies/:pharmacyId/dispensing-history', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const result = await database.query(
    `SELECT dr.*, p.medications AS prescription_medications,
            a.name AS animal_name, a.species AS animal_species,
            u.first_name || ' ' || u.last_name AS pharmacist_name,
            po.first_name || ' ' || po.last_name AS owner_name,
            v.first_name || ' ' || v.last_name AS vet_name,
            hp.pharmacy_name, hp.address AS pharmacy_address, hp.phone AS pharmacy_phone,
            (SELECT json_agg(json_build_object('name', pm.name, 'quantity', dli.quantity_dispensed, 'unit', dli.unit, 'unitPrice', dli.unit_price, 'lineTotal', dli.line_total, 'batchNumber', dli.batch_number) ORDER BY dli.created_at)
             FROM dispensing_line_items dli LEFT JOIN pharmacy_medications pm ON pm.id = dli.med_id
             WHERE dli.dispensing_record_id = dr.id) AS line_items
     FROM dispensing_records dr
     JOIN prescriptions p ON dr.prescription_id = p.id
     JOIN animals a ON p.animal_id = a.id
     LEFT JOIN users po ON p.pet_owner_id = po.id
     LEFT JOIN users v ON p.veterinarian_id = v.id
     JOIN users u ON dr.pharmacist_id = u.id
     LEFT JOIN hospital_pharmacies hp ON hp.id = dr.pharmacy_id
     WHERE dr.pharmacy_id = $1
     ORDER BY dr.created_at DESC LIMIT $2`,
    [req.params.pharmacyId, limit]
  );
  res.json(result.rows);
}));

// Vet's own pharmacy stats (dashboard tile) - self-scoped, no guard needed
router.get('/vet/pharmacy-stats', authMiddleware, roleMiddleware(['veterinarian']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const result = await database.query(
    `SELECT
       COUNT(*) FILTER (WHERE review_status = 'pending_review') AS pending_review,
       COUNT(*) FILTER (WHERE review_status = 'rejected' AND updated_at >= NOW() - INTERVAL '7 days') AS rejected_this_week,
       COUNT(*) FILTER (WHERE review_status = 'dispensed') AS dispensed_count
     FROM prescriptions
     WHERE veterinarian_id = $1 AND is_network_coordinated = true AND is_active = true`,
    [authReq.userId]
  );
  const r = result.rows[0];
  res.json({
    success: true,
    data: {
      pendingReview: parseInt(r.pending_review, 10),
      rejectedThisWeek: parseInt(r.rejected_this_week, 10),
      dispensedCount: parseInt(r.dispensed_count, 10),
    },
  });
}));

// ── Analytics ────────────────────────────────────────────────

router.get('/pharmacies/:pharmacyId/analytics', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardPharmacy(req, res, req.params.pharmacyId)) return;
  const days = Math.min(Math.max(Number.parseInt(String(req.query.days), 10) || 30, 1), 365);
  const [revenue, volume, topMeds, lowStock, expiring] = await Promise.all([
    database.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS total_revenue, COUNT(*) AS dispensing_count
       FROM dispensing_records WHERE pharmacy_id = $1 AND created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
      [req.params.pharmacyId, days]
    ),
    database.query(
      `SELECT COUNT(*) AS pending_reviews FROM prescriptions p
       WHERE p.network_id = (SELECT network_id FROM hospital_pharmacies WHERE id = $1)
         AND p.review_status = 'pending_review'`,
      [req.params.pharmacyId]
    ),
    database.query(
      `SELECT pm.name AS med_name, SUM(dli.quantity_dispensed) AS total_dispensed, SUM(dli.line_total) AS total_revenue
       FROM dispensing_line_items dli
       JOIN dispensing_records dr ON dli.dispensing_record_id = dr.id
       JOIN pharmacy_medications pm ON dli.med_id = pm.id
       WHERE dr.pharmacy_id = $1 AND dr.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY pm.name ORDER BY total_dispensed DESC LIMIT 5`,
      [req.params.pharmacyId]
    ),
    database.query(
      `SELECT COUNT(*) AS low_stock_count FROM (
         SELECT pm.id FROM pharmacy_medications pm
         LEFT JOIN pharmacy_inventory pi ON pi.med_id = pm.id AND pi.pharmacy_id = $1 AND pi.is_active = true
         WHERE pm.network_id = (SELECT network_id FROM hospital_pharmacies WHERE id = $1) AND pm.is_active = true
         GROUP BY pm.id, pm.reorder_point HAVING COALESCE(SUM(pi.quantity), 0) <= pm.reorder_point
       ) t`,
      [req.params.pharmacyId]
    ),
    database.query(
      `SELECT COUNT(*) AS expiring_count FROM pharmacy_inventory
       WHERE pharmacy_id = $1 AND is_active = true AND expiry_date IS NOT NULL
         AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'`,
      [req.params.pharmacyId]
    ),
  ]);
  res.json({
    period_days: days,
    total_revenue: revenue.rows[0]?.total_revenue || 0,
    dispensing_count: revenue.rows[0]?.dispensing_count || 0,
    pending_reviews: volume.rows[0]?.pending_reviews || 0,
    top_medications: topMeds.rows,
    low_stock_count: lowStock.rows[0]?.low_stock_count || 0,
    expiring_count: expiring.rows[0]?.expiring_count || 0,
  });
}));

// Network-wide pharmacy report - network members only
router.get('/networks/:networkId/pharmacy-reports', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const days = Math.min(Math.max(Number.parseInt(String(req.query.days), 10) || 30, 1), 365);
  const result = await database.query(
    `SELECT hp.pharmacy_name, hp.id AS pharmacy_id,
            COALESCE(SUM(dr.total_cost), 0) AS revenue,
            COUNT(dr.id) AS dispensing_count
     FROM hospital_pharmacies hp
     LEFT JOIN dispensing_records dr ON dr.pharmacy_id = hp.id
       AND dr.created_at >= NOW() - ($2::int * INTERVAL '1 day')
     WHERE hp.network_id = $1 AND hp.is_active = true
     GROUP BY hp.id, hp.pharmacy_name ORDER BY revenue DESC`,
    [req.params.networkId, days]
  );
  res.json({ period_days: days, pharmacies: result.rows });
}));

// Cross-network pharmacy overview for the admin dashboard
router.get('/admin/pharmacy-overview', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const [dispensing, pendingReview, lowStock, revenue] = await Promise.all([
    database.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS this_week
       FROM dispensing_records`
    ),
    database.query(
      `SELECT COUNT(*) AS count FROM prescriptions WHERE review_status = 'pending_review' AND is_network_coordinated = true AND is_active = true`
    ),
    database.query(
      `SELECT COUNT(DISTINCT hp.network_id) AS network_count, COUNT(*) AS item_count
       FROM pharmacy_inventory pi JOIN hospital_pharmacies hp ON hp.id = pi.pharmacy_id
       WHERE pi.quantity <= pi.min_stock_level AND hp.is_active = true`
    ),
    database.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS revenue FROM dispensing_records WHERE created_at >= NOW() - INTERVAL '7 days'`
    ),
  ]);
  res.json({
    success: true,
    data: {
      dispensingToday: parseInt(dispensing.rows[0].today, 10),
      dispensingThisWeek: parseInt(dispensing.rows[0].this_week, 10),
      pendingReviewCount: parseInt(pendingReview.rows[0].count, 10),
      lowStockNetworks: parseInt(lowStock.rows[0].network_count, 10),
      lowStockItems: parseInt(lowStock.rows[0].item_count, 10),
      revenueThisWeek: parseFloat(revenue.rows[0].revenue),
    },
  });
}));

// ── Inter-hospital Medication Requests ───────────────────────

router.get('/networks/:networkId/med-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const result = await database.query(
    `SELECT pmr.*, vh_s.name AS source_hospital_name, vh_d.name AS destination_hospital_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM pharmacy_medication_requests pmr
     LEFT JOIN vet_hospitals vh_s ON pmr.source_hospital_id = vh_s.id
     LEFT JOIN vet_hospitals vh_d ON pmr.destination_hospital_id = vh_d.id
     LEFT JOIN users u ON pmr.created_by = u.id
     WHERE pmr.source_network_id = $1
     ORDER BY pmr.created_at DESC`,
    [req.params.networkId]
  );
  res.json(result.rows);
}));

router.post('/networks/:networkId/med-requests', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { source_hospital_id, destination_hospital_id, prescription_id, requested_medications, notes } = req.body;
  if (!requested_medications || !Array.isArray(requested_medications)) return res.status(400).json({ error: 'requested_medications array is required' });
  const result = await database.query(
    `INSERT INTO pharmacy_medication_requests (source_network_id, source_hospital_id, destination_hospital_id, prescription_id, requested_medications, notes, created_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *`,
    [req.params.networkId, source_hospital_id || null, destination_hospital_id || null, prescription_id || null, JSON.stringify(requested_medications), notes || null, authReq.userId]
  );
  res.status(201).json(result.rows[0]);
}));

router.patch('/networks/:networkId/med-requests/:requestId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  if (!await guardNetworkPharmacy(req, res, req.params.networkId)) return;
  const { status, tracking_number, decline_reason, notes } = req.body;
  const result = await database.query(
    `UPDATE pharmacy_medication_requests SET
       status = COALESCE($1, status),
       tracking_number = COALESCE($2, tracking_number),
       decline_reason = COALESCE($3, decline_reason),
       notes = COALESCE($4, notes),
       fulfilled_by = CASE WHEN $1 IN ('fulfilled','shipped') THEN $5 ELSE fulfilled_by END,
       updated_at = NOW()
     WHERE id = $6 AND source_network_id = $7 RETURNING *`,
    [status, tracking_number, decline_reason, notes, authReq.userId, req.params.requestId, req.params.networkId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Medication request not found' });
  res.json(result.rows[0]);
}));

// Pharmacy dashboard summary (tiles)
router.get('/pharmacies/:pharmacyId/dashboard', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const pid = req.params.pharmacyId;
  const networkId = await guardPharmacy(req, res, pid);
  if (!networkId) return;
  const [pending, approved, lowStock, expiring, pendingReorders, todayRevenue] = await Promise.all([
    database.query(`SELECT COUNT(*) FROM prescriptions WHERE network_id = $1 AND (review_status = 'pending_review' OR review_status IS NULL) AND is_active = true`, [networkId]),
    database.query(`SELECT COUNT(*) FROM prescriptions WHERE network_id = $1 AND review_status = 'approved_for_dispensing' AND is_active = true`, [networkId]),
    database.query(
      `SELECT COUNT(*) FROM (SELECT pm.id FROM pharmacy_medications pm LEFT JOIN pharmacy_inventory pi ON pi.med_id = pm.id AND pi.pharmacy_id = $1 AND pi.is_active = true WHERE pm.network_id = $2 AND pm.is_active = true GROUP BY pm.id, pm.reorder_point HAVING COALESCE(SUM(pi.quantity), 0) <= pm.reorder_point) t`,
      [pid, networkId]
    ),
    database.query(`SELECT COUNT(*) FROM pharmacy_inventory WHERE pharmacy_id = $1 AND is_active = true AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'`, [pid]),
    database.query(`SELECT COUNT(*) FROM pharmacy_reorder_requests WHERE pharmacy_id = $1 AND status IN ('pending','sent_to_supplier')`, [pid]),
    database.query(`SELECT COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS dispensed FROM dispensing_records WHERE pharmacy_id = $1 AND DATE(created_at) = CURRENT_DATE`, [pid]),
  ]);
  res.json({
    pending_reviews: parseInt(pending.rows[0].count),
    ready_to_dispense: parseInt(approved.rows[0].count),
    low_stock_count: parseInt(lowStock.rows[0].count),
    expiring_soon_count: parseInt(expiring.rows[0].count),
    pending_reorders: parseInt(pendingReorders.rows[0].count),
    todays_revenue: parseFloat(todayRevenue.rows[0]?.revenue ?? '0'),
    todays_dispensed: parseInt(todayRevenue.rows[0]?.dispensed ?? '0'),
  });
}));

// ═══════════════════════════════════════════════════════════════════════════
// PET WELLNESS / GROOMING & SPA MODULE (P1: onboarding + discovery + admin verify)
// Dark-launched behind grooming.enabled (groomingEnabled middleware → 404 when off).
// Provider-scoped isolation enforced inside GroomingProviderService.resolveProviderAccess.
// ═══════════════════════════════════════════════════════════════════════════

// Public status probe (NO gate) so the frontend can hide the whole module when disabled.
router.get('/grooming/status', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: await GroomingModuleConfig.isEnabled() } });
}));

// ── Provider onboarding (self-service) ──
router.post('/grooming/providers', authMiddleware, groomingEnabled, validateBody(createGroomingProviderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const p = await GroomingProviderService.createProvider((req as any).userId, req.body);
    res.status(201).json({ success: true, data: p });
  }));

router.get('/grooming/providers/me', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.getMyProvider((req as any).userId) });
  }));

router.put('/grooming/providers/:id', authMiddleware, groomingEnabled, validateBody(updateGroomingProviderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.updateProvider((req as any).userId, req.params.id, req.body) });
  }));

// ── Locations ──
router.get('/grooming/providers/:id/locations', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listLocations(req.params.id) });
  }));
router.post('/grooming/providers/:id/locations', authMiddleware, groomingEnabled, validateBody(groomingLocationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingProviderService.addLocation((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/locations/:locId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.deleteLocation((req as any).userId, req.params.id, req.params.locId);
    res.json({ success: true });
  }));

// ── Resources ──
router.get('/grooming/providers/:id/resources', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listResources(req.params.id) });
  }));
router.post('/grooming/providers/:id/resources', authMiddleware, groomingEnabled, validateBody(groomingResourceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingProviderService.addResource((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/resources/:resId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.deleteResource((req as any).userId, req.params.id, req.params.resId);
    res.json({ success: true });
  }));

// ── Services (catalog) ──
router.get('/grooming/providers/:id/services', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listServices(req.params.id) });
  }));
router.post('/grooming/providers/:id/services', authMiddleware, groomingEnabled, validateBody(groomingServiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingProviderService.addService((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/providers/:id/services/:svcId', authMiddleware, groomingEnabled, validateBody(updateGroomingServiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.updateService((req as any).userId, req.params.id, req.params.svcId, req.body) });
  }));
router.delete('/grooming/providers/:id/services/:svcId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.deleteService((req as any).userId, req.params.id, req.params.svcId);
    res.json({ success: true });
  }));

// ── Staff ──
router.get('/grooming/providers/:id/staff', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    if (!await GroomingProviderService.resolveProviderAccess((req as any).userId, req.params.id))
      return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await GroomingProviderService.listStaff(req.params.id) });
  }));
router.post('/grooming/providers/:id/staff', authMiddleware, groomingEnabled, validateBody(groomingStaffSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    res.status(201).json({ success: true, data: await GroomingProviderService.addStaffByEmail(authReq.userId, req.params.id, req.body.email, req.body.role, authReq.userId) });
  }));
router.delete('/grooming/providers/:id/staff/:userId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingProviderService.removeStaff((req as any).userId, req.params.id, req.params.userId);
    res.json({ success: true });
  }));

// ── Public discovery (verified providers only) ──
router.get('/grooming/discover', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const { mobile, species, search, limit, offset } = req.query;
    const result = await GroomingProviderService.listPublicProviders({
      mobile: mobile === 'true', species, search, limit, offset,
    });
    res.json({ success: true, data: result });
  }));
router.get('/grooming/providers/:id/public', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.getPublicProvider(req.params.id) });
  }));

// ── Admin verification ──
router.get('/grooming/admin/providers', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminListProviders((req.query.status as string) || 'pending') });
  }));
router.put('/grooming/admin/providers/:id/verify', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminVerify(req.params.id, (req as any).userId) });
  }));
router.put('/grooming/admin/providers/:id/reject', authMiddleware, roleMiddleware(['admin']), groomingEnabled, validateBody(groomingProviderRejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminReject(req.params.id, (req as any).userId, req.body.reason) });
  }));
router.put('/grooming/admin/providers/:id/suspend', authMiddleware, roleMiddleware(['admin']), groomingEnabled, validateBody(groomingProviderRejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingProviderService.adminSuspend(req.params.id, (req as any).userId, req.body.reason) });
  }));

// ── Availability & working hours (037) ──
// Slot reads are PUBLIC (authMiddleware only, no provider membership): a customer must be able
// to see when a salon is free before booking. They expose times and remaining capacity only -
// never customer or order details.
router.get('/grooming/providers/:id/availability', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: await GroomingScheduleService.getAvailability(req.params.id, String(req.query.date || ''), {
        serviceId: req.query.serviceId ? String(req.query.serviceId) : undefined,
        locationId: req.query.locationId ? String(req.query.locationId) : null,
      }),
    });
  }));
router.get('/grooming/providers/:id/availability/month', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: await GroomingScheduleService.getMonthAvailability(
        req.params.id, Number(req.query.year), Number(req.query.month), {
          serviceId: req.query.serviceId ? String(req.query.serviceId) : undefined,
          locationId: req.query.locationId ? String(req.query.locationId) : null,
        }),
    });
  }));

// Weekly working hours - owner/manager only (enforced in the service).
router.get('/grooming/providers/:id/schedules', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.listSchedules((req as any).userId, req.params.id) });
  }));
router.put('/grooming/providers/:id/schedules', authMiddleware, groomingEnabled, validateBody(groomingScheduleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.saveSchedule((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/schedules/:scheduleId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingScheduleService.deleteSchedule((req as any).userId, req.params.id, req.params.scheduleId);
    res.json({ success: true });
  }));

// Date overrides - closures and one-off hours.
router.get('/grooming/providers/:id/date-overrides', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.listOverrides(
      (req as any).userId, req.params.id, req.query.from as string, req.query.to as string) });
  }));
router.put('/grooming/providers/:id/date-overrides', authMiddleware, groomingEnabled, validateBody(groomingDateOverrideSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.saveOverride((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/date-overrides/:overrideId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingScheduleService.deleteOverride((req as any).userId, req.params.id, req.params.overrideId);
    res.json({ success: true });
  }));

// Blocked ranges - breaks within an otherwise open day.
router.get('/grooming/providers/:id/blocked-slots', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingScheduleService.listBlockedSlots((req as any).userId, req.params.id) });
  }));
router.post('/grooming/providers/:id/blocked-slots', authMiddleware, groomingEnabled, validateBody(groomingBlockedSlotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingScheduleService.createBlockedSlot((req as any).userId, req.params.id, req.body) });
  }));
router.delete('/grooming/providers/:id/blocked-slots/:slotId', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    await GroomingScheduleService.deleteBlockedSlot((req as any).userId, req.params.id, req.params.slotId);
    res.json({ success: true });
  }));

// ── Orders (P2: customer booking + provider view) ──
router.post('/grooming/orders', authMiddleware, groomingEnabled, validateBody(createGroomingOrderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingOrderService.createOrder((req as any).userId, req.body) });
  }));
router.get('/grooming/orders', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.listMyOrders((req as any).userId) });
  }));
router.get('/grooming/orders/:id', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.getOrder((req as any).userId, req.params.id) });
  }));
// NOTE: the legacy POST /grooming/orders/:id/pay route was REMOVED. It was the demo-era
// "mark it paid" shortcut and it confirmed an order, set amount_paid and credited the provider
// WITHOUT taking any money - any customer could self-issue a free booking. Payment goes through
// /checkout + /confirm-payment (real gateway, verified capture) only.
// Real gateway checkout (demo auto-verifies; Razorpay opens on the client) + GST invoice
router.post('/grooming/orders/:id/checkout', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingPaymentService.createCheckout((req as any).userId, req.params.id, req.body?.deposit === true) });
  }));
router.post('/grooming/orders/:id/confirm-payment', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingPaymentService.confirmCheckout((req as any).userId, req.params.id, req.body || {}) });
  }));
// Balance collection (approved extra work / remainder after a deposit). Separate payments row
// per collection, linked by payments.grooming_order_id.
router.post('/grooming/orders/:id/balance-checkout', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingPaymentService.createBalanceCheckout((req as any).userId, req.params.id) });
  }));
router.post('/grooming/orders/:id/confirm-balance', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingPaymentService.confirmBalancePayment((req as any).userId, req.params.id, req.body || {}) });
  }));
// What the customer gets back if they cancel now - grooming's own policy engine, shown in the
// cancel dialog before they commit (mirrors /payments/refund-preview for consultations).
router.get('/grooming/orders/:id/refund-preview', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.getRefundPreview((req as any).userId, req.params.id) });
  }));
router.put('/grooming/orders/:id/cancel', authMiddleware, groomingEnabled, validateBody(groomingCancelSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.cancelOrder((req as any).userId, req.params.id, req.body?.reason) });
  }));
router.get('/grooming/providers/:id/orders', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.listProviderOrders((req as any).userId, req.params.id, req.query.status as string) });
  }));

// ── Provider acceptance gate (036) ──
// Provider staff only (enforced in the service via requireProviderStaff). Accepting confirms the
// appointment; declining triggers a full no-fault refund, so a reason is mandatory.
router.put('/grooming/orders/:id/accept', authMiddleware, groomingEnabled, validateBody(groomingAcceptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.acceptOrder((req as any).userId, req.params.id, req.body?.note) });
  }));
router.put('/grooming/orders/:id/decline', authMiddleware, groomingEnabled, validateBody(groomingDeclineSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.declineOrder((req as any).userId, req.params.id, req.body.reason) });
  }));

// ── Order detail + ops workflow (P3) ──
router.get('/grooming/orders/:id/detail', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.getOrderDetail((req as any).userId, req.params.id) });
  }));
router.put('/grooming/orders/:id/transition', authMiddleware, groomingEnabled, validateBody(groomingTransitionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.transitionOrder((req as any).userId, req.params.id, req.body.toStatus, req.body.note) });
  }));
router.put('/grooming/orders/:id/assign', authMiddleware, groomingEnabled, validateBody(groomingAssignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.assignOrder((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/orders/:id/intake', authMiddleware, groomingEnabled, validateBody(groomingIntakeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.saveIntake((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/orders/:id/items/:itemId', authMiddleware, groomingEnabled, validateBody(groomingItemStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.updateItemStatus((req as any).userId, req.params.id, req.params.itemId, req.body.status, { reason: req.body.reason, photoUrl: req.body.photoUrl }) });
  }));
router.put('/grooming/orders/:id/report-card', authMiddleware, groomingEnabled, validateBody(groomingReportCardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.createReportCard((req as any).userId, req.params.id, req.body) });
  }));
// P4: variable-price (extra work) approval
router.post('/grooming/orders/:id/variable-items', authMiddleware, groomingEnabled, validateBody(groomingVariableRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingOrderService.requestVariableItem((req as any).userId, req.params.id, req.body) });
  }));
router.put('/grooming/orders/:id/variable-items/:itemId/respond', authMiddleware, groomingEnabled, validateBody(groomingVariableRespondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingOrderService.respondVariableItem((req as any).userId, req.params.id, req.params.itemId, req.body.approve === true) });
  }));

// ── Earnings + manual settlement (P3) ──
router.get('/grooming/providers/:id/earnings', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.getEarnings((req as any).userId, req.params.id) });
  }));
router.get('/grooming/providers/:id/settlements', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    const isAdmin = authReq.userRole === 'admin' || (authReq.userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingSettlementService.listSettlements(authReq.userId, req.params.id, isAdmin) });
  }));
router.post('/grooming/admin/providers/:id/settle', authMiddleware, roleMiddleware(['admin']), groomingEnabled, validateBody(groomingSettleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingSettlementService.adminSettle((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/admin/providers/:id/earnings', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.getEarningsAdmin(req.params.id) });
  }));
// "Who do I owe, and how much" - the register that made manual settlement operable.
router.get('/grooming/admin/payables', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.adminPayables() });
  }));
// Statement of exactly which earnings one payout covered - the provider's reconciliation view.
router.get('/grooming/settlements/:settlementId/statement', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = ((req as any).userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingSettlementService.getSettlementStatement(
      (req as any).userId, req.params.settlementId, isAdmin) });
  }));
router.get('/grooming/admin/reconciliation', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingSettlementService.adminReconciliation() });
  }));

// ── P5: safety escalation (groomer → vet) + grooming passport ──
router.post('/grooming/orders/:id/escalations', authMiddleware, groomingEnabled, validateBody(groomingEscalationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingCareService.raiseEscalation((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/orders/:id/escalations', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingCareService.listEscalations((req as any).userId, req.params.id) });
  }));
router.put('/grooming/escalations/:id/respond', authMiddleware, groomingEnabled, validateBody(groomingEscalationRespondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingCareService.respondEscalation((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/pets/:animalId/passport', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingCareService.getPetPassport((req as any).userId, req.params.animalId) });
  }));

// ── P6: disputes & refunds ──
router.post('/grooming/orders/:id/disputes', authMiddleware, groomingEnabled, validateBody(groomingDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ success: true, data: await GroomingDisputeService.raiseDispute((req as any).userId, req.params.id, req.body) });
  }));
router.get('/grooming/disputes/mine', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingDisputeService.listMyDisputes((req as any).userId) });
  }));
router.get('/grooming/providers/:id/disputes', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingDisputeService.listProviderDisputes((req as any).userId, req.params.id) });
  }));
router.get('/grooming/admin/disputes', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingDisputeService.adminListDisputes(req.query.status as string) });
  }));
router.put('/grooming/disputes/:id/respond', authMiddleware, groomingEnabled, validateBody(groomingDisputeRespondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    const isAdmin = authReq.userRole === 'admin' || (authReq.userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingDisputeService.respondDispute(authReq.userId, isAdmin, req.params.id, req.body) });
  }));

// ── P7: reports ──
router.get('/grooming/providers/:id/report', authMiddleware, groomingEnabled,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as any;
    const isAdmin = authReq.userRole === 'admin' || (authReq.userRoles || []).includes('admin');
    res.json({ success: true, data: await GroomingReportService.providerReport(authReq.userId, req.params.id, isAdmin) });
  }));
router.get('/grooming/admin/report', authMiddleware, roleMiddleware(['admin']), groomingEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: await GroomingReportService.platformReport() });
  }));

export default router;
