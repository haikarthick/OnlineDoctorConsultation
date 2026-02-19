import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { registerSchema, loginSchema, createConsultationSchema, updateConsultationSchema } from '../middleware/validation';
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
import AdminController from '../controllers/AdminController';
import EnterpriseController from '../controllers/EnterpriseController';
import Tier2Controller from '../controllers/Tier2Controller';
import AdminService from '../services/AdminService';
import PermissionService from '../services/PermissionService';
import { asyncHandler } from '../utils/errorHandler';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Auth routes ─────────────────────────────────────────────
router.post('/auth/register', validateBody(registerSchema), asyncHandler((req: Request, res: Response) => AuthController.register(req, res)));
router.post('/auth/login', validateBody(loginSchema), asyncHandler((req: Request, res: Response) => AuthController.login(req, res)));
router.get('/auth/profile', authMiddleware, asyncHandler((req: Request, res: Response) => AuthController.getProfile(req, res)));

// ─── Consultation routes ─────────────────────────────────────
router.post('/consultations', authMiddleware, validateBody(createConsultationSchema), asyncHandler((req: Request, res: Response) => ConsultationController.createConsultation(req, res)));
router.get('/consultations', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.listConsultations(req, res)));
router.get('/consultations/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getConsultationsByAnimal(req, res)));
router.get('/consultations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ConsultationController.getConsultation(req, res)));
router.put('/consultations/:id', authMiddleware, validateBody(updateConsultationSchema), asyncHandler((req: Request, res: Response) => ConsultationController.updateConsultation(req, res)));

// ─── Booking routes ──────────────────────────────────────────
router.post('/bookings', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.createBooking(req, res)));
router.get('/bookings', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.listBookings(req, res)));
router.get('/bookings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getBooking(req, res)));
router.put('/bookings/:id/confirm', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.confirmBooking(req, res)));
router.put('/bookings/:id/cancel', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.cancelBooking(req, res)));
router.put('/bookings/:id/reschedule', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.rescheduleBooking(req, res)));
router.get('/bookings/:id/action-logs', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getBookingActionLogs(req, res)));
router.get('/action-logs/my', authMiddleware, asyncHandler((req: Request, res: Response) => BookingController.getMyActionLogs(req, res)));

// ─── Video Session routes ────────────────────────────────────
router.post('/video-sessions', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.createSession(req, res)));
router.get('/video-sessions/active', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.listActiveSessions(req, res)));
router.get('/video-sessions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSession(req, res)));
router.get('/video-sessions/consultation/:consultationId', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getSessionByConsultation(req, res)));
router.put('/video-sessions/:id/start', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.startSession(req, res)));
router.put('/video-sessions/:id/end', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.endSession(req, res)));
router.post('/video-sessions/join/:roomId', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.joinSession(req, res)));
router.post('/video-sessions/:id/messages', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.sendMessage(req, res)));
router.get('/video-sessions/:id/messages', authMiddleware, asyncHandler((req: Request, res: Response) => VideoSessionController.getMessages(req, res)));

// ─── Schedule & Availability routes ─────────────────────────
router.post('/schedules', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.createSchedule(req, res)));
router.get('/schedules/me', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getSchedules(req, res)));
router.get('/schedules/vet/:vetId', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getSchedules(req, res)));
router.put('/schedules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.updateSchedule(req, res)));
router.delete('/schedules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.deleteSchedule(req, res)));
router.get('/availability/:vetId/:date', authMiddleware, asyncHandler((req: Request, res: Response) => ScheduleController.getAvailability(req, res)));

// ─── Prescription routes ─────────────────────────────────────
router.post('/prescriptions', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.createPrescription(req, res)));
router.get('/prescriptions/me', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.listMyPrescriptions(req, res)));
router.get('/prescriptions/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.listByAnimal(req, res)));
router.get('/prescriptions/:id', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.getPrescription(req, res)));
router.get('/prescriptions/consultation/:consultationId', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.listByConsultation(req, res)));
router.put('/prescriptions/:id/deactivate', authMiddleware, asyncHandler((req: Request, res: Response) => PrescriptionController.deactivatePrescription(req, res)));

// ─── Animal / Pet routes ─────────────────────────────────────
router.post('/animals', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.createAnimal(req, res)));
router.get('/animals', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.listAnimals(req, res)));
router.get('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.getAnimal(req, res)));
router.put('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.updateAnimal(req, res)));
router.delete('/animals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => AnimalController.deleteAnimal(req, res)));

// ─── Vet Profile routes ─────────────────────────────────────
router.post('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.createProfile(req, res)));
router.get('/vet-profiles/me', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getMyProfile(req, res)));
router.get('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.listVets(req, res)));
router.get('/vet-profiles/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.getProfile(req, res)));
router.put('/vet-profiles', authMiddleware, asyncHandler((req: Request, res: Response) => VetProfileController.updateProfile(req, res)));

// ─── Enterprise / Farm routes ────────────────────────────────
router.post('/enterprises', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.createEnterprise(req, res)));
router.get('/enterprises', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listEnterprises(req, res)));
router.get('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getEnterprise(req, res)));
router.put('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.updateEnterprise(req, res)));
router.delete('/enterprises/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteEnterprise(req, res)));
router.get('/enterprises/:id/stats', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getEnterpriseStats(req, res)));

// Enterprise Members
router.get('/enterprises/:id/members', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listMembers(req, res)));
router.post('/enterprises/:id/members', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.addMember(req, res)));
router.put('/enterprises/:enterpriseId/members/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.updateMember(req, res)));
router.delete('/enterprises/:enterpriseId/members/:userId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.removeMember(req, res)));

// Animal Groups
router.post('/animal-groups', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.createGroup(req, res)));
router.get('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getGroup(req, res)));
router.put('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.updateGroup(req, res)));
router.delete('/animal-groups/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteGroup(req, res)));
router.get('/enterprises/:enterpriseId/groups', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listGroups(req, res)));
router.post('/animal-groups/:id/assign', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.assignAnimalToGroup(req, res)));
router.delete('/animal-groups/:id/animals/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.removeAnimalFromGroup(req, res)));

// Locations
router.post('/locations', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.createLocation(req, res)));
router.get('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getLocation(req, res)));
router.put('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.updateLocation(req, res)));
router.delete('/locations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteLocation(req, res)));
router.get('/enterprises/:enterpriseId/locations', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listLocations(req, res)));
router.get('/enterprises/:enterpriseId/location-tree', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getLocationTree(req, res)));

// Movement Records
router.post('/movements', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.createMovement(req, res)));
router.get('/movements/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getMovement(req, res)));
router.get('/enterprises/:enterpriseId/movements', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listMovements(req, res)));

// Treatment Campaigns
router.post('/campaigns', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.createCampaign(req, res)));
router.get('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.getCampaign(req, res)));
router.put('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.updateCampaign(req, res)));
router.delete('/campaigns/:id', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.deleteCampaign(req, res)));
router.get('/enterprises/:enterpriseId/campaigns', authMiddleware, asyncHandler((req: Request, res: Response) => EnterpriseController.listCampaigns(req, res)));

// ─── Medical Record routes ───────────────────────────────────
router.get('/medical-records/stats', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getStats(req, res)));
router.get('/medical-records/audit', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getAuditLog(req, res)));
router.post('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.createRecord(req, res)));
router.get('/medical-records', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listRecords(req, res)));
router.get('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getRecord(req, res)));
router.put('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.updateRecord(req, res)));
router.delete('/medical-records/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteRecord(req, res)));

// ─── Vaccination routes ──────────────────────────────────────
router.post('/vaccinations', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.createVaccination(req, res)));
router.get('/vaccinations/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listVaccinations(req, res)));
router.put('/vaccinations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.updateVaccination(req, res)));
router.delete('/vaccinations/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.deleteVaccination(req, res)));

// ─── Weight History routes ───────────────────────────────────
router.post('/weight-history', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.addWeight(req, res)));
router.get('/weight-history/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listWeightHistory(req, res)));

// ─── Allergy routes ─────────────────────────────────────────
router.post('/allergies', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.createAllergy(req, res)));
router.get('/allergies/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listAllergies(req, res)));
router.put('/allergies/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.updateAllergy(req, res)));

// ─── Lab Result routes ──────────────────────────────────────
router.post('/lab-results', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.createLabResult(req, res)));
router.get('/lab-results/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.listLabResults(req, res)));
router.put('/lab-results/:id', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.updateLabResult(req, res)));

// ─── Medical Timeline route ─────────────────────────────────
router.get('/timeline/animal/:animalId', authMiddleware, asyncHandler((req: Request, res: Response) => MedicalRecordController.getTimeline(req, res)));

// ─── Notification routes ─────────────────────────────────────
router.get('/notifications', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.listNotifications(req, res)));
router.put('/notifications/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAsRead(req, res)));
router.put('/notifications/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => NotificationController.markAllAsRead(req, res)));

// ─── Payment routes ──────────────────────────────────────────
router.post('/payments', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.createPayment(req, res)));
router.get('/payments', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.listPayments(req, res)));
router.get('/payments/:id', authMiddleware, asyncHandler((req: Request, res: Response) => PaymentController.getPayment(req, res)));

// ─── Review routes ───────────────────────────────────────────
router.post('/reviews', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.createReview(req, res)));
router.get('/reviews/vet/:vetId', authMiddleware, asyncHandler((req: Request, res: Response) => ReviewController.listReviews(req, res)));

// ─── Admin routes (admin role required) ──────────────────────
router.get('/admin/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getDashboardStats(req, res)));
router.get('/admin/users', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listUsers(req, res)));
router.put('/admin/users/:id/status', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.toggleUserStatus(req, res)));
router.put('/admin/users/:id/role', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.changeUserRole(req, res)));
router.get('/admin/consultations', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listConsultations(req, res)));
router.get('/admin/payments', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listPayments(req, res)));
router.post('/admin/payments/:id/refund', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.processRefund(req, res)));
router.get('/admin/reviews', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.listReviews(req, res)));
router.put('/admin/reviews/:id/moderate', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.moderateReview(req, res)));
router.get('/admin/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getSystemSettings(req, res)));
router.put('/admin/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.updateSystemSetting(req, res)));
router.get('/admin/audit-logs', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => AdminController.getAuditLogs(req, res)));

// ─── Permission routes ───────────────────────────────────────
// Get my permissions (authenticated user)
router.get('/permissions/my', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const permissions = await PermissionService.getPermissionsForRole(authReq.userRole || '');
  const metadata = PermissionService.getPermissionMetadata();
  res.json({ success: true, data: { permissions, metadata } });
}));

// Admin: get full permission matrix
router.get('/admin/permissions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (_req: Request, res: Response) => {
  const matrix = await PermissionService.getFullPermissionMatrix();
  const metadata = PermissionService.getPermissionMetadata();
  res.json({ success: true, data: { matrix, metadata } });
}));

// Admin: update permission for a role
router.put('/admin/permissions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { role, permission, isEnabled } = req.body;
  if (!role || !permission || typeof isEnabled !== 'boolean') {
    return res.status(400).json({ error: 'role, permission, and isEnabled (boolean) are required' });
  }
  await PermissionService.updatePermission(role, permission, isEnabled, authReq.userId);
  res.json({ success: true, message: `Permission ${permission} for ${role} set to ${isEnabled}` });
}));

// Admin: bulk update permissions for a role
router.put('/admin/permissions/bulk', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { role, permissions } = req.body;
  if (!role || !permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'role and permissions object are required' });
  }
  await PermissionService.bulkUpdatePermissions(role, permissions, authReq.userId);
  const updated = await PermissionService.getFullPermissionMatrix();
  res.json({ success: true, data: { matrix: updated }, message: `Permissions updated for ${role}` });
}));

// Admin: reset role permissions to defaults
router.post('/admin/permissions/reset', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'role is required' });
  }
  await PermissionService.resetToDefaults(role);
  const updated = await PermissionService.getFullPermissionMatrix();
  res.json({ success: true, data: { matrix: updated }, message: `Permissions reset to defaults for ${role}` });
}));

// ═══════════════════════════════════════════════════════════════
// ─── Tier-2: Health Analytics ────────────────────────────────
router.get('/enterprises/:enterpriseId/health/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getHealthDashboard(req, res)));
router.get('/enterprises/:enterpriseId/health/observations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listObservations(req, res)));
router.post('/enterprises/:enterpriseId/health/observations', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.createObservation(req, res)));
router.patch('/health/observations/:id/resolve', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.resolveObservation(req, res)));

// ─── Tier-2: Breeding & Genetics ────────────────────────────
router.get('/enterprises/:enterpriseId/breeding', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listBreedingRecords(req, res)));
router.post('/enterprises/:enterpriseId/breeding', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.createBreedingRecord(req, res)));
router.put('/breeding/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.updateBreedingRecord(req, res)));
router.get('/enterprises/:enterpriseId/breeding/upcoming-due', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getUpcomingDueDates(req, res)));
router.get('/enterprises/:enterpriseId/breeding/stats', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getBreedingStats(req, res)));

// ─── Tier-2: Feed & Inventory ───────────────────────────────
router.get('/enterprises/:enterpriseId/feed', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listFeeds(req, res)));
router.post('/enterprises/:enterpriseId/feed', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.createFeed(req, res)));
router.put('/feed/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.updateFeed(req, res)));
router.post('/feed/:id/restock', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.restockFeed(req, res)));
router.delete('/feed/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteFeed(req, res)));
router.post('/enterprises/:enterpriseId/feed/consumption', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.logFeedConsumption(req, res)));
router.get('/enterprises/:enterpriseId/feed/consumption', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listConsumptionLogs(req, res)));
router.get('/enterprises/:enterpriseId/feed/analytics', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getFeedAnalytics(req, res)));

// ─── Tier-2: Compliance & Regulatory ────────────────────────
router.get('/enterprises/:enterpriseId/compliance', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listComplianceDocs(req, res)));
router.post('/enterprises/:enterpriseId/compliance', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.createComplianceDoc(req, res)));
router.put('/compliance/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.updateComplianceDoc(req, res)));
router.patch('/compliance/:id/verify', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.verifyComplianceDoc(req, res)));
router.delete('/compliance/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteComplianceDoc(req, res)));
router.get('/enterprises/:enterpriseId/compliance/summary', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getComplianceSummary(req, res)));

// ─── Tier-2: Financial Analytics ────────────────────────────
router.get('/enterprises/:enterpriseId/financial', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listFinancialRecords(req, res)));
router.post('/enterprises/:enterpriseId/financial', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.createFinancialRecord(req, res)));
router.put('/financial/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.updateFinancialRecord(req, res)));
router.delete('/financial/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteFinancialRecord(req, res)));
router.get('/enterprises/:enterpriseId/financial/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.getFinancialDashboard(req, res)));

// ─── Tier-2: Smart Alerts ───────────────────────────────────
router.get('/enterprises/:enterpriseId/alerts/rules', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listAlertRules(req, res)));
router.post('/enterprises/:enterpriseId/alerts/rules', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.createAlertRule(req, res)));
router.put('/alerts/rules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.updateAlertRule(req, res)));
router.delete('/alerts/rules/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.deleteAlertRule(req, res)));
router.patch('/alerts/rules/:id/toggle', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.toggleAlertRule(req, res)));
router.get('/enterprises/:enterpriseId/alerts/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.listAlertEvents(req, res)));
router.patch('/alerts/events/:id/read', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.markAlertRead(req, res)));
router.patch('/enterprises/:enterpriseId/alerts/events/read-all', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.markAllAlertsRead(req, res)));
router.patch('/alerts/events/:id/acknowledge', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.acknowledgeAlert(req, res)));
router.post('/enterprises/:enterpriseId/alerts/run-checks', authMiddleware, asyncHandler((req: Request, res: Response) => Tier2Controller.runAlertChecks(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── Public settings (no auth) ───────────────────────────────
router.get('/settings/public', asyncHandler(async (_req: Request, res: Response) => {
  const settings = await AdminService.getPublicSettings();
  res.json({ success: true, data: settings });
}));

// ─── Health check & feature flags ────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/features', (_req, res) => {
  res.json({ success: true, data: getAllFeatureFlags() });
});

export default router;
