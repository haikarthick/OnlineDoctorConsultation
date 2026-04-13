import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import HospitalNetworkService from '../services/HospitalNetworkService';
import { ValidationError, ForbiddenError } from '../utils/errors';

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
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!);
    const updated = await HospitalNetworkService.updateNetwork(req.params.id, req.body, req.userId!);
    res.json({ success: true, data: updated });
  }

  async approveNetwork(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin') throw new ForbiddenError('Only admins can approve hospital networks');
    await HospitalNetworkService.approveNetwork(req.params.id, req.userId!);
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
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, ['corporate_admin', 'hospital_director']);
    const { userId, networkRole, hospitalId, notes } = req.body;
    if (!userId || !networkRole) throw new ValidationError('userId and networkRole are required');
    await HospitalNetworkService.addNetworkMember(req.params.id, userId, networkRole, hospitalId, req.userId!);
    res.status(201).json({ success: true, message: 'Member added to network' });
  }

  async removeNetworkMember(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, ['corporate_admin', 'hospital_director']);
    await HospitalNetworkService.removeNetworkMember(req.params.id, req.params.userId);
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
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!, ['corporate_admin']);
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
    await this.ensureNetworkAccess(req.params.id, req.userId!, req.userRole!);
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
    requiredRoles?: string[]
  ): Promise<void> {
    if (userRole === 'admin') return;

    const members = await HospitalNetworkService.listNetworkMembers(networkId);
    const membership = members.find((m) => m.userId === userId);
    if (!membership) throw new ForbiddenError('You do not have access to this network');

    if (requiredRoles && !requiredRoles.includes(membership.networkRole)) {
      throw new ForbiddenError('Insufficient role for this action');
    }
  }
}

export default new HospitalNetworkController();
