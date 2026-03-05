import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import VetHospitalService from '../services/VetHospitalService';
import BookingService from '../services/BookingService';
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/errors';
import { getFrontendUrl } from '../config';

class VetHospitalController {

  // ─── Hospital CRUD ─────────────────────────────────────────

  async createHospital(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'veterinarian' && req.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians can create a vet hospital');
    }
    const { name, hospitalType } = req.body;
    if (!name || !hospitalType) throw new ValidationError('name and hospitalType are required');
    const hospital = await VetHospitalService.createHospital(req.userId!, req.body);
    res.status(201).json({ success: true, data: hospital });
  }

  async getHospital(req: AuthRequest, res: Response): Promise<void> {
    const hospital = await VetHospitalService.getHospital(req.params.id);
    res.json({ success: true, data: hospital });
  }

  async listHospitals(req: AuthRequest, res: Response): Promise<void> {
    const { search, city, hospitalType, specialization,
            hasEmergency, is24Hours, isVerified, limit, offset } = req.query as any;
    const result = await VetHospitalService.listHospitals({
      search, city, hospitalType, specialization,
      hasEmergency: hasEmergency === 'true',
      is24Hours: is24Hours === 'true',
      isVerified: isVerified === 'true',
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });
    res.json({ success: true, data: result });
  }

  async listMyHospitals(req: AuthRequest, res: Response): Promise<void> {
    const hospitals = await VetHospitalService.listHospitalsForVet(req.userId!);
    res.json({ success: true, data: hospitals });
  }

  async updateHospital(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const hospital = await VetHospitalService.updateHospital(req.params.id, req.body);
    res.json({ success: true, data: hospital });
  }

  async deleteHospital(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureOwnerAccess(req.params.id, req.userId!, req.userRole!);
    await VetHospitalService.deleteHospital(req.params.id);
    res.json({ success: true, message: 'Vet hospital deactivated' });
  }

  async verifyHospital(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin') throw new ForbiddenError('Admin only');
    const { verified } = req.body;
    const hospital = await VetHospitalService.verifyHospital(req.params.id, verified !== false);
    res.json({ success: true, data: hospital });
  }

  async getHospitalStats(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const stats = await VetHospitalService.getHospitalStats(req.params.id);
    res.json({ success: true, data: stats });
  }

  async getAdminStats(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin') throw new ForbiddenError('Admin only');
    const stats = await VetHospitalService.getAdminStats();
    res.json({ success: true, data: stats });
  }

  // ─── Doctor Membership ─────────────────────────────────────

  async listDoctors(req: AuthRequest, res: Response): Promise<void> {
    const doctors = await VetHospitalService.listDoctors(req.params.id);
    res.json({ success: true, data: doctors });
  }

  async addDoctor(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const { doctorId, departmentId, hospitalRole, title, employmentType, isPrimaryHospital, consultationFee } = req.body;
    if (!doctorId) throw new ValidationError('doctorId is required');
    const member = await VetHospitalService.addDoctor(req.params.id, {
      doctorId, departmentId, hospitalRole, title, employmentType, isPrimaryHospital, consultationFee
    });
    res.status(201).json({ success: true, data: member });
  }

  async updateDoctor(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const doctor = await VetHospitalService.updateDoctor(req.params.id, req.params.doctorId, req.body);
    res.json({ success: true, data: doctor });
  }

  async removeDoctor(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureOwnerAccess(req.params.id, req.userId!, req.userRole!);
    await VetHospitalService.removeDoctor(req.params.id, req.params.doctorId);
    res.json({ success: true, message: 'Doctor removed from hospital' });
  }

  // ─── Departments ───────────────────────────────────────────

  async listDepartments(req: AuthRequest, res: Response): Promise<void> {
    const departments = await VetHospitalService.listDepartments(req.params.id);
    res.json({ success: true, data: departments });
  }

  async createDepartment(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const { name } = req.body;
    if (!name) throw new ValidationError('Department name is required');
    const dept = await VetHospitalService.createDepartment(req.params.id, req.body);
    res.status(201).json({ success: true, data: dept });
  }

  async updateDepartment(req: AuthRequest, res: Response): Promise<void> {
    const dept = await VetHospitalService.listDepartments(req.params.id);
    const thisDept = dept.find(d => d.id === req.params.deptId);
    if (!thisDept) throw new NotFoundError('Department not found');
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const updated = await VetHospitalService.updateDepartment(req.params.deptId, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteDepartment(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    await VetHospitalService.deleteDepartment(req.params.deptId);
    res.json({ success: true, message: 'Department removed' });
  }

  // ─── Services ─────────────────────────────────────────────

  async listServices(req: AuthRequest, res: Response): Promise<void> {
    const services = await VetHospitalService.listServices(req.params.id);
    res.json({ success: true, data: services });
  }

  async addService(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const { serviceName, category } = req.body;
    if (!serviceName || !category) throw new ValidationError('serviceName and category are required');
    const service = await VetHospitalService.addService(req.params.id, req.body);
    res.status(201).json({ success: true, data: service });
  }

  async updateService(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const service = await VetHospitalService.updateService(req.params.serviceId, req.body);
    res.json({ success: true, data: service });
  }

  async deleteService(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    await VetHospitalService.deleteService(req.params.serviceId);
    res.json({ success: true, message: 'Service removed' });
  }

  // ─── Hospital Bookings ─────────────────────────────────────

  async listHospitalBookings(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const { limit, offset, status } = req.query as any;
    const result = await BookingService.listHospitalBookings(req.params.id, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      status: status || undefined,
    });
    res.json({ success: true, data: result });
  }

  // ─── Doctor Invites ────────────────────────────────────────

  async inviteDoctor(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const { email } = req.body;
    if (!email) throw new ValidationError('email is required');
    const invite = await VetHospitalService.inviteDoctor(req.params.id, req.body, req.userId!);
    const frontendUrl = getFrontendUrl();
    res.status(201).json({ success: true, data: { ...invite, inviteUrl: `${frontendUrl}/accept-invite?token=${invite.invite_token}` } });
  }

  async listInvites(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    const invites = await VetHospitalService.listInvites(req.params.id);
    const frontendUrl = getFrontendUrl();
    const enriched = invites.map(inv => ({ ...inv, inviteUrl: inv.status === 'pending' ? `${frontendUrl}/accept-invite?token=${inv.invite_token}` : undefined }));
    res.json({ success: true, data: enriched });
  }

  async revokeInvite(req: AuthRequest, res: Response): Promise<void> {
    await this.ensureHospitalAccess(req.params.id, req.userId!, req.userRole!);
    await VetHospitalService.revokeInvite(req.params.id, req.params.inviteId);
    res.json({ success: true, message: 'Invite revoked' });
  }

  async getInviteByToken(req: AuthRequest, res: Response): Promise<void> {
    const invite = await VetHospitalService.getInviteByToken(req.params.token);
    res.json({ success: true, data: invite });
  }

  async acceptInvite(req: AuthRequest, res: Response): Promise<void> {
    const { token, password } = req.body;
    if (!token || !password) throw new ValidationError('token and password are required');
    if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');
    const result = await VetHospitalService.acceptInvite(token, password);
    res.json({ success: true, data: result });
  }

  // ─── Access Guards ─────────────────────────────────────────

  private async ensureHospitalAccess(hospitalId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === 'admin') return;
    const role = await VetHospitalService.getMemberRole(hospitalId, userId);
    if (!role) throw new ForbiddenError('You are not a member of this hospital');
    if (!['owner', 'medical_director', 'department_head'].includes(role)) {
      throw new ForbiddenError('Insufficient hospital role');
    }
  }

  private async ensureOwnerAccess(hospitalId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === 'admin') return;
    const role = await VetHospitalService.getMemberRole(hospitalId, userId);
    if (role !== 'owner') throw new ForbiddenError('Only the hospital owner can perform this action');
  }
}

export default new VetHospitalController();
