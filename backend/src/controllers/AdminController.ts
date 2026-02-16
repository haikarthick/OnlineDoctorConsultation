import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import AdminService from '../services/AdminService';
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
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };
    const result = await AdminService.listAllUsers(params);
    res.json({ success: true, data: result });
  }

  async toggleUserStatus(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { isActive } = req.body;
    if (isActive === undefined) throw new ValidationError('isActive field is required');

    const user = await AdminService.toggleUserStatus(req.params.id, isActive);

    await AdminService.createAuditLog({
      userId: authReq.userId!,
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      resource: 'users',
      resourceId: req.params.id,
      ipAddress: req.ip
    });

    res.json({ success: true, data: user });
  }

  async changeUserRole(req: Request, res: Response) {
    const authReq = this.assertAdmin(req);
    const { role } = req.body;
    if (!role) throw new ValidationError('role field is required');

    const user = await AdminService.changeUserRole(req.params.id, role);

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
    if (!action || !['approve', 'hide', 'remove'].includes(action)) {
      throw new ValidationError('action must be one of: approve, hide, remove');
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
}

export default new AdminController();
