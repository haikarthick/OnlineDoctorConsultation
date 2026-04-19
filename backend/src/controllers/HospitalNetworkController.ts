import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import HospitalNetworkService from '../services/HospitalNetworkService';
import NetworkRolePermissionService from '../services/NetworkRolePermissionService';
import NotificationService from '../services/NotificationService';
import { ValidationError, ForbiddenError } from '../utils/errors';
import database from '../utils/database';
import logger from '../utils/logger';

class HospitalNetworkController {

  // ─── Network CRUD ─────────────────────────────────────────────
  async createNetwork(req: AuthRequest, res: Response): Promise<void> {
    const { name } = req.body;
    if (!name) throw new ValidationError('Network name is required');
    const network = await HospitalNetworkService.createNetwork(req.body, req.userId!);
    res.status(201).json({ success: true, data: network });
  }

  async listNetworks(req: AuthRequest, res: Response): Promise<void> {
    const filters: { isApproved?: boolean; isActive?: boolean } = {};
    if (req.query.isApproved !== undefined) filters.isApproved = req.query.isApproved === 'true';
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    const networks = await HospitalNetworkService.listNetworks(filters);
    res.json({ success: true, data: networks });
  }

  async getNetwork(req: AuthRequest, res: Response): Promise<void> {
    const network = await HospitalNetworkService.getNetworkById(req.params.id);
    res.json({ success: true, data: network });
  }

  async updateNetwork(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, 'editNetworkSettings');
    const updated = await HospitalNetworkService.updateNetwork(req.params.id, req.body, req.userId!);
    await HospitalNetworkService.logAudit({
      networkId: req.params.id,
      actorId: req.userId!,
      action: 'network_updated',
      targetType: 'network',
      targetId: req.params.id,
      newValue: req.body,
      ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  }

  async approveNetwork(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin') throw new ForbiddenError('Only admins can approve hospital networks');
    await HospitalNetworkService.approveNetwork(req.params.id, req.userId!);
    // Notify network creator
    try {
      const network = await HospitalNetworkService.getNetworkById(req.params.id);
      if (network?.createdBy) {
        await NotificationService.createNotification(
          network.createdBy, 'network_approved',
          '🎉 Hospital Network Approved',
          `Your hospital network "${network.name}" has been approved and is now active.`,
          'all', { networkId: req.params.id, networkName: network.name }
        );
      }
    } catch (notifErr: any) { logger.warn('Notify network approval failed', { error: notifErr.message }); }
    res.json({ success: true, message: 'Hospital network approved' });
  }

  // Fix 7: Deactivate a network
  async deactivateNetwork(req: AuthRequest, res: Response): Promise<void> {
    const result = await HospitalNetworkService.deactivateNetwork(req.params.id, req.userId!, req.userRole!);
    res.json({ success: true, data: result });
  }

  // ─── Members ──────────────────────────────────────────────────
  async listNetworkMembers(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!);
    const members = await HospitalNetworkService.listNetworkMembers(req.params.id);
    res.json({ success: true, data: members });
  }

  async addNetworkMember(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, 'addRemoveMembers');
    const { userId, networkRole, hospitalId, notes, validUntil } = req.body;
    if (!userId || !networkRole) throw new ValidationError('userId and networkRole are required');
    await HospitalNetworkService.addNetworkMember(req.params.id, userId, networkRole, hospitalId, req.userId!, validUntil);
    // Notify added member
    try {
      await NotificationService.createNotification(
        userId, 'network_member_added',
        '🏥 Added to Hospital Network',
        `You have been added to a hospital network as ${networkRole}. Check your Network Memberships page for details.`,
        'all', { networkId: req.params.id, networkRole }
      );
    } catch (notifErr: any) { logger.warn('Notify member added failed', { error: notifErr.message }); }
    await HospitalNetworkService.logAudit({
      networkId: req.params.id,
      actorId: req.userId!,
      action: 'member_added',
      targetType: 'user',
      targetId: userId,
      newValue: { networkRole },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, message: 'Member added to network' });
  }

  async removeNetworkMember(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, 'addRemoveMembers');
    await HospitalNetworkService.removeNetworkMember(req.params.id, req.params.userId);
    // Notify removed member
    try {
      await NotificationService.createNotification(
        req.params.userId, 'network_member_removed',
        'Removed from Hospital Network',
        'You have been removed from a hospital network. Contact the network admin if you believe this is an error.',
        'in_app', { networkId: req.params.id }
      );
    } catch (notifErr: any) { logger.warn('Notify member removed failed', { error: notifErr.message }); }
    await HospitalNetworkService.logAudit({
      networkId: req.params.id,
      actorId: req.userId!,
      action: 'member_removed',
      targetType: 'user',
      targetId: req.params.userId,
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'Member removed from network' });
  }

  // ─── Hospital Assignment ───────────────────────────────────────
  async listNetworkHospitals(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await HospitalNetworkService.listNetworkHospitals(req.params.id, page, limit);
    res.json({ success: true, data: result });
  }

  async assignHospitalToNetwork(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, 'addHospitalToNetwork');
    await HospitalNetworkService.assignHospitalToNetwork(req.params.id, req.params.hospitalId, req.userId!);
    res.status(201).json({ success: true, message: 'Hospital assigned to network' });
  }

  // ─── Dashboard ─────────────────────────────────────────────────
  async getNetworkDashboard(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!);
    const dashboard = await HospitalNetworkService.getNetworkDashboard(req.params.id);
    res.json({ success: true, data: dashboard });
  }

  // ─── Audit Log ─────────────────────────────────────────────────
  async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, 'viewAuditLogs');
    const filters: any = {};
    if (req.query.page) filters.page = parseInt(req.query.page as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    if (req.query.recordType) filters.recordType = req.query.recordType as string;
    if (req.query.accessGranted !== undefined) filters.accessGranted = req.query.accessGranted === 'true';
    if (req.query.animalId) filters.animalId = req.query.animalId as string;
    const result = await HospitalNetworkService.getAuditLogs(req.params.id, filters);
    res.json({ success: true, data: result });
  }

  // ─── Patient Consent ──────────────────────────────────────────
  async createConsent(req: AuthRequest, res: Response): Promise<void> {
    const { animalId, consentScope } = req.body;
    if (!animalId || !consentScope) throw new ValidationError('animalId and consentScope are required');
    const consent = await HospitalNetworkService.createConsent(req.body, req.userId!);
    res.status(201).json({ success: true, data: consent });
  }

  async listConsents(req: AuthRequest, res: Response): Promise<void> {
    const consents = await HospitalNetworkService.listConsents(req.params.animalId, req.userId!);
    res.json({ success: true, data: consents });
  }

  async revokeConsent(req: AuthRequest, res: Response): Promise<void> {
    const reason = req.body.reason || 'Revoked by owner';
    await HospitalNetworkService.revokeConsent(req.params.consentId, req.userId!, reason);
    res.json({ success: true, message: 'Consent revoked' });
  }

  // ─── Network Referrals ────────────────────────────────────────

  async createNetworkReferral(req: AuthRequest, res: Response): Promise<void> {
    const data = { ...req.body, createdBy: req.userId!, fromVetId: req.userId! };
    const referral = await HospitalNetworkService.createNetworkReferral(data);
    // Notify directors of the receiving hospital
    try {
      const refData = req.body;
      if (refData.toHospitalId) {
        const directors = await database.query(
          `SELECT hnm.user_id FROM hospital_network_members hnm
           JOIN vet_hospitals vh ON vh.branch_network_id = hnm.network_id
           WHERE vh.id = $1 AND hnm.network_role IN ('hospital_director', 'corporate_admin') AND hnm.is_active = true`,
          [refData.toHospitalId]
        );
        for (const director of directors.rows) {
          await NotificationService.createNotification(
            director.user_id, 'referral_received',
            '📋 New Patient Referral',
            `A new inter-hospital referral has been received. Please review in the Referrals tab.`,
            'in_app', { networkId: req.body.networkId, referralId: referral.id }
          );
        }
      }
    } catch (notifErr: any) { logger.warn('Notify referral failed', { error: notifErr.message }); }
    res.status(201).json({ success: true, data: referral });
  }

  async updateNetworkReferralStatus(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, responseNotes } = req.body;
    const referral = await HospitalNetworkService.updateNetworkReferralStatus(id, status, req.userId!, responseNotes);
    res.json({ success: true, data: referral });
  }

  async listNetworkReferrals(req: AuthRequest, res: Response): Promise<void> {
    const { networkId, hospitalId, direction, animalId, status, page, limit } = req.query;
    const result = await HospitalNetworkService.listNetworkReferrals({
      networkId: networkId as string | undefined,
      hospitalId: hospitalId as string | undefined,
      direction: direction as 'incoming' | 'outgoing' | 'all' | undefined,
      animalId: animalId as string | undefined,
      status: status as string | undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    res.json({ success: true, ...result });
  }

  // ─── Corporate Dashboard ───────────────────────────────────────
  async getCorporateDashboard(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.userId!;
    const stats = await HospitalNetworkService.getCorporateDashboardStats(userId);
    res.json({ success: true, data: stats });
  }

  // ─── Branch Hospitals ─────────────────────────────────────────
  async createBranchHospital(req: AuthRequest, res: Response): Promise<void> {
    const networkId = req.params.id;
    const userId = req.userId!;
    const hospital = await HospitalNetworkService.createBranchHospital(networkId, req.body, userId);
    res.status(201).json({ success: true, data: hospital, message: 'Branch hospital created successfully' });
  }

  // ─── Helper ───────────────────────────────────────────────────
  private async ensureNetworkAccess(
    networkId: string,
    userId: string,
    userRole: string,
    actionOrRoles?: string | string[]
  ): Promise<void> {
    if (userRole === 'admin') return;

    const members = await HospitalNetworkService.listNetworkMembers(networkId);
    const membership = members.find((m) => m.userId === userId);
    if (!membership) throw new ForbiddenError('You do not have access to this network');

    if (actionOrRoles) {
      if (Array.isArray(actionOrRoles)) {
        // Legacy path: check against hardcoded role list
        if (!actionOrRoles.includes(membership.networkRole)) {
          throw new ForbiddenError('Insufficient role for this action');
        }
      } else {
        // DB-backed path: check network_role_permissions table
        const hasAccess = await NetworkRolePermissionService.checkAccess(networkId, membership.networkRole, actionOrRoles);
        if (!hasAccess) throw new ForbiddenError('Insufficient role for this action');
      }
    }
  }
}

export default new HospitalNetworkController();
