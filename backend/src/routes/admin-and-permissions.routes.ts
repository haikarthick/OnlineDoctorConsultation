import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import logger from '../utils/logger';
import emailService from '../services/EmailService';
import AdminController from '../controllers/AdminController';
import BookingController from '../controllers/BookingController';
import VetProfileController from '../controllers/VetProfileController';
import VetProfileService from '../services/VetProfileService';
import PermissionService from '../services/PermissionService';
import HospitalNetworkController from '../controllers/HospitalNetworkController';
import HospitalNetworkService from '../services/HospitalNetworkService';
import {
  toggleUserStatusSchema, changeUserRoleSchema, processRefundSchema, moderateReviewSchema, updateSystemSettingSchema,
  updatePermissionSchema, bulkUpdatePermissionsSchema, resetPermissionsSchema,
  updateVetProfileSchema,
} from '../middleware/validation';

const router = Router();

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
      subject: 'waytovet - Test Email',
      html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>✅ Email is working!</h2><p>This is a test email from waytovet admin panel.</p><p>Sent at: ${new Date().toISOString()}</p><p>Dev redirect: ${devRedirect || 'off'}</p></div>`,
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


export default router;
