import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AdminService from '../services/AdminService';
import AuditService from '../services/AuditService';
import { ForbiddenError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

class AdminController {
  // Middleware-level check: all admin routes require admin role
  private assertAdmin(req: Request): AuthRequest {
    const authReq = req as AuthRequest;
    if (authReq.userRole !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }
    return authReq;
  }

  async getDashboardStats(req: Request, res: Response) {
    this.assertAdmin(req);
    const stats = await AdminService.getDashboardStats();
    res.json({ success: true, data: stats });
  }

  async listUsers(req: Request, res: Response) {
    this.assertAdmin(req);
    const params = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      role: req.query.role as string,
      search: req.query.search as string,
      accountStatus: req.query.accountStatus as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const result = await AdminService.listAllUsers(params);
    res.json({ success: true, data: result });
  }

  async listPendingUsers(req: Request, res: Response) {
    this.assertAdmin(req);
    const users = await AdminService.listPendingUsers();
    res.json({ success: true, data: users });
  }

  async approveUser(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const user = await AdminService.approveUser(req.params.id, authReq.userId!);
    await AdminService.createAuditLog({
      userId: authReq.userId!, action: 'APPROVE_USER', resource: 'users',
      resourceId: req.params.id, ipAddress: req.ip,
    });
    // Best-effort approval email
    try {
      const EmailService = (await import('../services/EmailService')).default;
      await EmailService.send({
        to: user.email,
        subject: 'Your VetCare registration has been approved',
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;">
          <h2 style="color:#1e3a5f;">Welcome to VetCare!</h2>
          <p>Dear ${user.firstName},</p>
          <p>We are pleased to inform you that your registration as a <strong>${user.role.replace('_', ' ')}</strong> has been reviewed and approved by our platform team.</p>
          <p>You may now log in and access the platform.</p>
          <p style="color:#888;font-size:.85rem;">If you have any questions, contact us at support@vetcare.com.</p>
        </div>`,
      });
    } catch { /* non-fatal */ }
    res.json({ success: true, data: user });
  }

  async rejectUser(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { reason } = req.body;
    if (!reason?.trim()) throw new ValidationError('reason is required');
    const user = await AdminService.rejectUser(req.params.id, authReq.userId!, reason);
    await AdminService.createAuditLog({
      userId: authReq.userId!, action: 'REJECT_USER', resource: 'users',
      resourceId: req.params.id, details: { reason }, ipAddress: req.ip,
    });
    try {
      const EmailService = (await import('../services/EmailService')).default;
      await EmailService.send({
        to: user.email,
        subject: 'Update regarding your VetCare registration',
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;">
          <h2 style="color:#1e3a5f;">Registration Update</h2>
          <p>Dear ${user.firstName},</p>
          <p>Thank you for your interest in joining VetCare. After reviewing your registration, we are unable to approve your account at this time.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>If you believe this decision was made in error or wish to provide additional information, please contact us at support@vetcare.com.</p>
        </div>`,
      });
    } catch { /* non-fatal */ }
    res.json({ success: true, data: user });
  }

  async freezeUser(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { reason } = req.body;
    if (!reason?.trim()) throw new ValidationError('reason is required');
    const user = await AdminService.freezeUser(req.params.id, authReq.userId!, reason);
    await AdminService.createAuditLog({
      userId: authReq.userId!, action: 'FREEZE_USER', resource: 'users',
      resourceId: req.params.id, details: { reason }, ipAddress: req.ip,
    });
    try {
      const EmailService = (await import('../services/EmailService')).default;
      await EmailService.send({
        to: user.email,
        subject: 'Important notice regarding your VetCare account',
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;">
          <h2 style="color:#1e3a5f;">Account Notice</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your account has been temporarily restricted pending further review by our platform team. This measure has been taken to ensure the safety and integrity of the platform.</p>
          <p>If you believe this is an error or would like clarification, please contact us at <a href="mailto:support@vetcare.com">support@vetcare.com</a> - we will be happy to assist you and aim to resolve this at the earliest.</p>
          <p>Please quote your registered email address when contacting support.</p>
          <p style="color:#888;font-size:.85rem;">We apologise for any inconvenience caused.</p>
        </div>`,
      });
    } catch { /* non-fatal */ }
    res.json({ success: true, data: user });
  }

  async unfreezeUser(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const user = await AdminService.unfreezeUser(req.params.id, authReq.userId!);
    await AdminService.createAuditLog({
      userId: authReq.userId!, action: 'UNFREEZE_USER', resource: 'users',
      resourceId: req.params.id, ipAddress: req.ip,
    });
    try {
      const EmailService = (await import('../services/EmailService')).default;
      await EmailService.send({
        to: user.email,
        subject: 'Your VetCare account has been restored',
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;">
          <h2 style="color:#1e3a5f;">Account Restored</h2>
          <p>Dear ${user.firstName},</p>
          <p>We are pleased to inform you that the temporary restriction on your account has been lifted. You may now log in and access the platform as usual.</p>
          <p>If you have any questions, contact us at support@vetcare.com.</p>
        </div>`,
      });
    } catch { /* non-fatal */ }
    res.json({ success: true, data: user });
  }

  async suspendUser(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { reason } = req.body;
    const user = await AdminService.suspendUser(req.params.id, authReq.userId!, reason);
    await AdminService.createAuditLog({
      userId: authReq.userId!, action: 'SUSPEND_USER', resource: 'users',
      resourceId: req.params.id, details: { reason }, ipAddress: req.ip,
    });
    res.json({ success: true, data: user });
  }

  async reactivateUser(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const user = await AdminService.reactivateUser(req.params.id, authReq.userId!);
    await AdminService.createAuditLog({
      userId: authReq.userId!, action: 'REACTIVATE_USER', resource: 'users',
      resourceId: req.params.id, ipAddress: req.ip,
    });
    res.json({ success: true, data: user });
  }

  async toggleUserStatus(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { isActive } = req.body;
    if (isActive === undefined) throw new ValidationError('isActive field is required');
    const user = await AdminService.toggleUserStatus(req.params.id, isActive);
    await AdminService.createAuditLog({
      userId: authReq.userId!,
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      resource: 'users', resourceId: req.params.id, ipAddress: req.ip,
    });
    res.json({ success: true, data: user });
  }

  async changeUserRole(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { role, profile } = req.body;
    if (!role) throw new ValidationError('role field is required');

    const user = await AdminService.changeUserRole(req.params.id, role, profile);

    await AdminService.createAuditLog({
      userId: authReq.userId!,
      action: 'CHANGE_USER_ROLE',
      resource: 'users',
      resourceId: req.params.id,
      details: { newRole: role },
      ipAddress: req.ip
    });

    res.json({ success: true, data: user });
  }

  async listConsultations(req: Request, res: Response) {
    this.assertAdmin(req);
    const params = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      status: req.query.status as string
    };
    const result = await AdminService.listAllConsultations(params);
    res.json({ success: true, data: result });
  }

  async listPayments(req: Request, res: Response) {
    this.assertAdmin(req);
    const params = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      status: req.query.status as string
    };
    const result = await AdminService.listAllPayments(params);
    res.json({ success: true, data: result });
  }

  async processRefund(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { amount, reason } = req.body;
    if (!amount || !reason) throw new ValidationError('amount and reason are required');

    const payment = await AdminService.processRefund(req.params.id, amount, reason);

    await AdminService.createAuditLog({
      userId: authReq.userId!,
      action: 'PROCESS_REFUND',
      resource: 'payments',
      resourceId: req.params.id,
      details: { amount, reason },
      ipAddress: req.ip
    });

    res.json({ success: true, data: payment });
  }

  async listReviews(req: Request, res: Response) {
    this.assertAdmin(req);
    const params = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      status: req.query.status as string
    };
    const result = await AdminService.listAllReviews(params);
    res.json({ success: true, data: result });
  }

  async moderateReview(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { action } = req.body;
    if (!action || !['approve', 'hide', 'remove', 'flag', 'unflag'].includes(action)) {
      throw new ValidationError('action must be one of: approve, hide, remove, flag, unflag');
    }

    const review = await AdminService.moderateReview(req.params.id, action);

    await AdminService.createAuditLog({
      userId: authReq.userId!,
      action: 'MODERATE_REVIEW',
      resource: 'reviews',
      resourceId: req.params.id,
      details: { moderationAction: action },
      ipAddress: req.ip
    });

    res.json({ success: true, data: review });
  }

  async getSystemSettings(req: Request, res: Response) {
    this.assertAdmin(req);
    const settings = await AdminService.getSystemSettings();
    res.json({ success: true, data: settings });
  }

  async updateSystemSetting(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { key, value } = req.body;
    if (!key || value === undefined) throw new ValidationError('key and value are required');

    const setting = await AdminService.updateSystemSetting(key, value, authReq.userId!);
    res.json({ success: true, data: setting });
  }

  async getAuditLogs(req: Request, res: Response) {
    this.assertAdmin(req);
    const params = {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      userId: req.query.userId as string,
      action: req.query.action as string
    };
    const result = await AdminService.getAuditLogs(params);
    res.json({ success: true, data: result });
  }

  // ─── HIPAA Compliance Endpoints ─────────────────────────────

  async getComplianceDashboard(req: Request, res: Response) {
    this.assertAdmin(req);
    const data = await AuditService.getComplianceDashboard();
    res.json({ success: true, data });
  }

  async getPhiAccessLog(req: Request, res: Response) {
    this.assertAdmin(req);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const filters = {
      userId: req.query.userId as string,
      entityType: req.query.entityType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    const data = await AuditService.getPhiAccessLog(limit, offset, filters);
    res.json({ success: true, data });
  }

  async getUserDataSummary(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    // Users can view their own; admins can view anyone's
    const targetUserId = req.params.userId || authReq.userId;
    if (targetUserId !== authReq.userId && authReq.userRole !== 'admin') {
      throw new ForbiddenError('You can only view your own data summary');
    }
    const data = await AuditService.getUserDataSummary(targetUserId!);
    res.json({ success: true, data });
  }

  async revokeUserSessions(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    await AuditService.revokeUserSessions(req.params.userId);
    await AuditService.log(authReq.userId, 'admin.revoke_sessions', 'user', req.params.userId,
      undefined, undefined, req.ip, req.get('user-agent'));
    res.json({ success: true, message: 'All sessions revoked' });
  }
}

export default new AdminController();
