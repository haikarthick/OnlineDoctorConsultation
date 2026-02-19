import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import EnterpriseService from '../services/EnterpriseService';
import AnimalGroupService from '../services/AnimalGroupService';
import LocationService from '../services/LocationService';
import MovementService from '../services/MovementService';
import TreatmentCampaignService from '../services/TreatmentCampaignService';
import { ValidationError, ForbiddenError } from '../utils/errors';

class EnterpriseController {

  // ─── Enterprise CRUD ───────────────────────────────────────
  async createEnterprise(req: AuthRequest, res: Response): Promise<void> {
    const { name, enterpriseType } = req.body;
    if (!name || !enterpriseType) throw new ValidationError('Name and enterprise type are required');
    const enterprise = await EnterpriseService.createEnterprise(req.userId!, req.body);
    res.status(201).json({ success: true, data: enterprise });
  }

  async getEnterprise(req: AuthRequest, res: Response): Promise<void> {
    const enterprise = await EnterpriseService.getEnterprise(req.params.id);
    if (req.userRole !== 'admin') {
      const hasAccess = await EnterpriseService.hasAccess(req.params.id, req.userId!);
      if (!hasAccess) throw new ForbiddenError('Access denied');
    }
    res.json({ success: true, data: enterprise });
  }

  async listEnterprises(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    let result;
    if (req.userRole === 'admin') {
      result = await EnterpriseService.listAllEnterprises(limit, offset);
    } else {
      result = await EnterpriseService.listEnterprisesForUser(req.userId!, limit, offset);
    }
    res.json({ success: true, data: result });
  }

  async updateEnterprise(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.id, req.userId!, req.userRole!, ['owner', 'manager']);
    const updated = await EnterpriseService.updateEnterprise(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteEnterprise(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.id, req.userId!, req.userRole!, ['owner']);
    await EnterpriseService.deleteEnterprise(req.params.id);
    res.json({ success: true, message: 'Enterprise deactivated' });
  }

  async getEnterpriseStats(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.id, req.userId!, req.userRole!);
    const stats = await EnterpriseService.getEnterpriseStats(req.params.id);
    res.json({ success: true, data: stats });
  }

  // ─── Members ───────────────────────────────────────────────
  async listMembers(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.id, req.userId!, req.userRole!);
    const members = await EnterpriseService.listMembers(req.params.id);
    res.json({ success: true, data: members });
  }

  async addMember(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.id, req.userId!, req.userRole!, ['owner', 'manager']);
    const { userId, role, title } = req.body;
    if (!userId || !role) throw new ValidationError('userId and role are required');
    const member = await EnterpriseService.addMember(req.params.id, userId, role, title);
    res.status(201).json({ success: true, data: member });
  }

  async updateMember(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    const { role, title } = req.body;
    if (!role) throw new ValidationError('role is required');
    const member = await EnterpriseService.updateMemberRole(req.params.enterpriseId, req.params.userId, role, title);
    res.json({ success: true, data: member });
  }

  async removeMember(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureEnterpriseAccess(req.params.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    await EnterpriseService.removeMember(req.params.enterpriseId, req.params.userId);
    res.json({ success: true, message: 'Member removed' });
  }

  // ─── Animal Groups ────────────────────────────────────────
  async createGroup(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId, name, groupType } = req.body;
    if (!enterpriseId || !name || !groupType) throw new ValidationError('enterpriseId, name, and groupType are required');
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor']);
    const group = await AnimalGroupService.createGroup(req.body);
    res.status(201).json({ success: true, data: group });
  }

  async getGroup(req: AuthRequest, res: Response): Promise<void> {
    const group = await AnimalGroupService.getGroup(req.params.id);
    await this.ensureEnterpriseAccess(group.enterpriseId, req.userId!, req.userRole!);
    res.json({ success: true, data: group });
  }

  async listGroups(req: AuthRequest, res: Response): Promise<void> {
    const enterpriseId = req.params.enterpriseId;
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await AnimalGroupService.listByEnterprise(enterpriseId, limit, offset);
    res.json({ success: true, data: result });
  }

  async updateGroup(req: AuthRequest, res: Response): Promise<void> {
    const group = await AnimalGroupService.getGroup(req.params.id);
    await this.ensureEnterpriseAccess(group.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor']);
    const updated = await AnimalGroupService.updateGroup(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteGroup(req: AuthRequest, res: Response): Promise<void> {
    const group = await AnimalGroupService.getGroup(req.params.id);
    await this.ensureEnterpriseAccess(group.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    await AnimalGroupService.deleteGroup(req.params.id);
    res.json({ success: true, message: 'Group deleted' });
  }

  async assignAnimalToGroup(req: AuthRequest, res: Response): Promise<void> {
    const { animalId } = req.body;
    if (!animalId) throw new ValidationError('animalId is required');
    const group = await AnimalGroupService.getGroup(req.params.id);
    await this.ensureEnterpriseAccess(group.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor', 'worker']);
    await AnimalGroupService.assignAnimal(req.params.id, animalId);
    res.json({ success: true, message: 'Animal assigned to group' });
  }

  async removeAnimalFromGroup(req: AuthRequest, res: Response): Promise<void> {
    const group = await AnimalGroupService.getGroup(req.params.id);
    await this.ensureEnterpriseAccess(group.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor', 'worker']);
    await AnimalGroupService.removeAnimal(req.params.id, req.params.animalId);
    res.json({ success: true, message: 'Animal removed from group' });
  }

  // ─── Locations ─────────────────────────────────────────────
  async createLocation(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId, name, locationType } = req.body;
    if (!enterpriseId || !name || !locationType) throw new ValidationError('enterpriseId, name, and locationType are required');
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    const location = await LocationService.createLocation(req.body);
    res.status(201).json({ success: true, data: location });
  }

  async getLocation(req: AuthRequest, res: Response): Promise<void> {
    const location = await LocationService.getLocation(req.params.id);
    await this.ensureEnterpriseAccess(location.enterpriseId, req.userId!, req.userRole!);
    res.json({ success: true, data: location });
  }

  async listLocations(req: AuthRequest, res: Response): Promise<void> {
    const enterpriseId = req.params.enterpriseId;
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await LocationService.listByEnterprise(enterpriseId, limit, offset);
    res.json({ success: true, data: result });
  }

  async getLocationTree(req: AuthRequest, res: Response): Promise<void> {
    const enterpriseId = req.params.enterpriseId;
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!);
    const tree = await LocationService.getLocationTree(enterpriseId);
    res.json({ success: true, data: tree });
  }

  async updateLocation(req: AuthRequest, res: Response): Promise<void> {
    const location = await LocationService.getLocation(req.params.id);
    await this.ensureEnterpriseAccess(location.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    const updated = await LocationService.updateLocation(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteLocation(req: AuthRequest, res: Response): Promise<void> {
    const location = await LocationService.getLocation(req.params.id);
    await this.ensureEnterpriseAccess(location.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    await LocationService.deleteLocation(req.params.id);
    res.json({ success: true, message: 'Location deleted' });
  }

  // ─── Movements ─────────────────────────────────────────────
  async createMovement(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId, movementType } = req.body;
    if (!enterpriseId || !movementType) throw new ValidationError('enterpriseId and movementType are required');
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor', 'worker']);
    const movement = await MovementService.createMovement(req.userId!, req.body);
    res.status(201).json({ success: true, data: movement });
  }

  async listMovements(req: AuthRequest, res: Response): Promise<void> {
    const enterpriseId = req.params.enterpriseId;
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await MovementService.listByEnterprise(enterpriseId, limit, offset);
    res.json({ success: true, data: result });
  }

  async getMovement(req: AuthRequest, res: Response): Promise<void> {
    const movement = await MovementService.getMovement(req.params.id);
    await this.ensureEnterpriseAccess(movement.enterpriseId, req.userId!, req.userRole!);
    res.json({ success: true, data: movement });
  }

  // ─── Treatment Campaigns ──────────────────────────────────
  async createCampaign(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId, campaignType, name } = req.body;
    if (!enterpriseId || !campaignType || !name) throw new ValidationError('enterpriseId, campaignType, and name are required');
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor', 'farm_vet']);
    const campaign = await TreatmentCampaignService.createCampaign(req.body);
    res.status(201).json({ success: true, data: campaign });
  }

  async getCampaign(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await TreatmentCampaignService.getCampaign(req.params.id);
    await this.ensureEnterpriseAccess(campaign.enterpriseId, req.userId!, req.userRole!);
    res.json({ success: true, data: campaign });
  }

  async listCampaigns(req: AuthRequest, res: Response): Promise<void> {
    const enterpriseId = req.params.enterpriseId;
    await this.ensureEnterpriseAccess(enterpriseId, req.userId!, req.userRole!);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await TreatmentCampaignService.listByEnterprise(enterpriseId, limit, offset);
    res.json({ success: true, data: result });
  }

  async updateCampaign(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await TreatmentCampaignService.getCampaign(req.params.id);
    await this.ensureEnterpriseAccess(campaign.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager', 'supervisor', 'farm_vet']);
    const updated = await TreatmentCampaignService.updateCampaign(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteCampaign(req: AuthRequest, res: Response): Promise<void> {
    const campaign = await TreatmentCampaignService.getCampaign(req.params.id);
    await this.ensureEnterpriseAccess(campaign.enterpriseId, req.userId!, req.userRole!, ['owner', 'manager']);
    await TreatmentCampaignService.deleteCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign deleted' });
  }

  // ─── Helper ────────────────────────────────────────────────
  private async ensureEnterpriseAccess(
    enterpriseId: string,
    userId: string,
    userRole: string,
    requiredRoles?: string[]
  ): Promise<void> {
    if (userRole === 'admin') return; // Admins can access everything
    const hasAccess = await EnterpriseService.hasAccess(enterpriseId, userId);
    if (!hasAccess) throw new ForbiddenError('You do not have access to this enterprise');
    if (requiredRoles) {
      const hasRole = await EnterpriseService.hasRole(enterpriseId, userId, [...requiredRoles, 'owner']);
      if (!hasRole) throw new ForbiddenError('Insufficient role for this action');
    }
  }
}

export default new EnterpriseController();
