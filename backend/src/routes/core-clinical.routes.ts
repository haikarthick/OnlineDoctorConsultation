import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody, AuthRequest } from '../middleware/auth';
import { checkAnimalAccess, requireAnimalAccess } from '../middleware/hospitalDataIsolation';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import logger from '../utils/logger';
import { emitDataRefresh, emitRoleRefresh } from '../utils/socketIO';
import AuthController from '../controllers/AuthController';
import ConsultationController from '../controllers/ConsultationController';
import MedicalRecordController from '../controllers/MedicalRecordController';
import BookingController from '../controllers/BookingController';
import VideoSessionController from '../controllers/VideoSessionController';
import ScheduleController from '../controllers/ScheduleController';
import PrescriptionController from '../controllers/PrescriptionController';
import CertificateController from '../controllers/CertificateController';
import AnimalController from '../controllers/AnimalController';
import VetProfileController from '../controllers/VetProfileController';
import UserService from '../services/UserService';
import { ensureGroupAccess } from './enterprise-farm.routes';
import {
  registerSchema, loginSchema, refreshTokenSchema, logoutSchema,
  createConsultationSchema, updateConsultationSchema,
  createBookingSchema, rescheduleBookingSchema, cancelBookingSchema,
  createVideoSessionSchema, endVideoSessionSchema, sendVideoMessageSchema,
  createScheduleSchema, updateScheduleSchema,
  createPrescriptionSchema,
  createAnimalSchema,
  createVetProfileSchema, updateVetProfileSchema,
  forgotPasswordSchema, resetPasswordSchema,
} from '../middleware/validation';

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
// Group-subject (batch herd/flock) prescriptions. Gated by ensureGroupAccess() so a :groupId
// here can't be a cross-tenant read - the caller must own/member the enterprise that owns the group.
router.get('/prescriptions/group/:groupId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const groupId = await ensureGroupAccess(req, res); if (!groupId) return;
  await PrescriptionController.listByGroup(req, res);
}));
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


export default router;
