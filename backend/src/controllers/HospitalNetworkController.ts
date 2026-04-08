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
    const hospitals = await HospitalNetworkService.listNetworkHospitals(req.params.id);
    res.json({ success: true, data: hospitals });
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
