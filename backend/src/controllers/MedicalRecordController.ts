import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import MedicalRecordService from '../services/MedicalRecordService';
import { ValidationError, ForbiddenError } from '../utils/errors';

export class MedicalRecordController {
  // ═══ MEDICAL RECORDS ══════════════════════════════════════

  async createRecord(req: AuthRequest, res: Response): Promise<void> {
    const { recordType, title, content } = req.body;
    if (!recordType || !title || !content) {
      throw new ValidationError('recordType, title, and content are required');
    }
    const userName = req.body._userName || '';
    const record = await MedicalRecordService.createRecord(
      req.userId!,
      { ...req.body, veterinarianId: req.userRole === 'veterinarian' ? req.userId : req.body.veterinarianId },
      req.userId!, userName
    );
    res.status(201).json({ success: true, data: record });
  }

  async getRecord(req: AuthRequest, res: Response): Promise<void> {
    const record = await MedicalRecordService.getRecord(req.params.id);
    if (record.userId !== req.userId && record.createdBy !== req.userId && req.userRole !== 'admin' && req.userRole !== 'veterinarian') {
      throw new ForbiddenError('You do not have permission to view this record');
    }
    res.json({ success: true, data: record });
  }

  async listRecords(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const filters: any = { limit, offset };

    if (req.query.animalId) filters.animalId = req.query.animalId;
    if (req.query.recordType) filters.recordType = req.query.recordType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.search) filters.search = req.query.search;

    if (req.userRole === 'admin') {
      filters.isAdmin = true;
    } else {
      filters.userId = req.userId;
    }

    const result = await MedicalRecordService.listRecords(filters);
    res.json({ success: true, data: result });
  }

  async updateRecord(req: AuthRequest, res: Response): Promise<void> {
    const record = await MedicalRecordService.getRecord(req.params.id);
    if (record.createdBy !== req.userId && req.userRole !== 'admin' && req.userRole !== 'veterinarian') {
      throw new ForbiddenError('You do not have permission to update this record');
    }
    const updated = await MedicalRecordService.updateRecord(
      req.params.id, req.body, req.userId!, req.body._userName, req.body.changeReason
    );
    res.json({ success: true, data: updated });
  }

  async deleteRecord(req: AuthRequest, res: Response): Promise<void> {
    const record = await MedicalRecordService.getRecord(req.params.id);
    if (record.userId !== req.userId && record.createdBy !== req.userId && req.userRole !== 'admin') {
      throw new ForbiddenError('You do not have permission to archive this record');
    }
    await MedicalRecordService.deleteRecord(req.params.id, req.userId!, '', req.body?.reason);
    res.json({ success: true, message: 'Record archived' });
  }

  // ═══ VACCINATIONS ═════════════════════════════════════════

  async createVaccination(req: AuthRequest, res: Response): Promise<void> {
    const { animalId, vaccineName, dateAdministered } = req.body;
    if (!animalId || !vaccineName || !dateAdministered) {
      throw new ValidationError('animalId, vaccineName, and dateAdministered are required');
    }
    const record = await MedicalRecordService.createVaccination(animalId, req.body, req.userId!);
    res.status(201).json({ success: true, data: record });
  }

  async listVaccinations(req: AuthRequest, res: Response): Promise<void> {
    const animalId = req.params.animalId;
    if (!animalId) throw new ValidationError('animalId is required');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await MedicalRecordService.listVaccinations(animalId, limit, offset);
    res.json({ success: true, data: result });
  }

  async updateVaccination(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'veterinarian' && req.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians or admins can update vaccinations');
    }
    const updated = await MedicalRecordService.updateVaccination(req.params.id, req.body, req.userId!);
    res.json({ success: true, data: updated });
  }

  async deleteVaccination(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'veterinarian' && req.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians or admins can invalidate vaccinations');
    }
    await MedicalRecordService.deleteVaccination(req.params.id, req.userId!);
    res.json({ success: true, message: 'Vaccination invalidated' });
  }

  // ═══ WEIGHT HISTORY ═══════════════════════════════════════

  async addWeight(req: AuthRequest, res: Response): Promise<void> {
    const { animalId, weight, unit } = req.body;
    if (!animalId || weight === undefined) {
      throw new ValidationError('animalId and weight are required');
    }
    const record = await MedicalRecordService.addWeight(animalId, parseFloat(weight), unit || 'kg', req.userId!, req.body.notes);
    res.status(201).json({ success: true, data: record });
  }

  async listWeightHistory(req: AuthRequest, res: Response): Promise<void> {
    const animalId = req.params.animalId;
    if (!animalId) throw new ValidationError('animalId is required');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const records = await MedicalRecordService.listWeightHistory(animalId, limit);
    res.json({ success: true, data: records });
  }

  // ═══ ALLERGIES ════════════════════════════════════════════

  async createAllergy(req: AuthRequest, res: Response): Promise<void> {
    const { animalId, allergen } = req.body;
    if (!animalId || !allergen) {
      throw new ValidationError('animalId and allergen are required');
    }
    const record = await MedicalRecordService.createAllergy(animalId, req.body, req.userId!);
    res.status(201).json({ success: true, data: record });
  }

  async listAllergies(req: AuthRequest, res: Response): Promise<void> {
    const animalId = req.params.animalId;
    if (!animalId) throw new ValidationError('animalId is required');
    const records = await MedicalRecordService.listAllergies(animalId);
    res.json({ success: true, data: records });
  }

  async updateAllergy(req: AuthRequest, res: Response): Promise<void> {
    const updated = await MedicalRecordService.updateAllergy(req.params.id, req.body, req.userId!);
    res.json({ success: true, data: updated });
  }

  // ═══ LAB RESULTS ══════════════════════════════════════════

  async createLabResult(req: AuthRequest, res: Response): Promise<void> {
    const { animalId, testName, testDate } = req.body;
    if (!animalId || !testName || !testDate) {
      throw new ValidationError('animalId, testName, and testDate are required');
    }
    const record = await MedicalRecordService.createLabResult(animalId, req.body, req.userId!);
    res.status(201).json({ success: true, data: record });
  }

  async listLabResults(req: AuthRequest, res: Response): Promise<void> {
    const animalId = req.params.animalId;
    if (!animalId) throw new ValidationError('animalId is required');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await MedicalRecordService.listLabResults(animalId, limit, offset);
    res.json({ success: true, data: result });
  }

  async updateLabResult(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'veterinarian' && req.userRole !== 'admin') {
      throw new ForbiddenError('Only veterinarians or admins can update lab results');
    }
    const updated = await MedicalRecordService.updateLabResult(req.params.id, req.body, req.userId!);
    res.json({ success: true, data: updated });
  }

  // ═══ TIMELINE ═════════════════════════════════════════════

  async getTimeline(req: AuthRequest, res: Response): Promise<void> {
    const animalId = req.params.animalId;
    if (!animalId) throw new ValidationError('animalId is required');
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const timeline = await MedicalRecordService.getAnimalTimeline(animalId, limit);
    res.json({ success: true, data: timeline });
  }

  // ═══ AUDIT LOG ════════════════════════════════════════════

  async getAuditLog(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin' && req.userRole !== 'veterinarian') {
      throw new ForbiddenError('Only admins and vets can view audit logs');
    }
    const filters: any = {
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
      offset: parseInt(req.query.offset as string) || 0,
    };
    if (req.query.recordId) filters.recordId = req.query.recordId;
    if (req.query.recordType) filters.recordType = req.query.recordType;
    if (req.query.action) filters.action = req.query.action;
    const result = await MedicalRecordService.getAuditLog(filters);
    res.json({ success: true, data: result });
  }

  // ═══ CONSULTATIONS BY ANIMAL ══════════════════════════════

  async getConsultationsByAnimal(req: AuthRequest, res: Response): Promise<void> {
    const animalId = req.params.animalId;
    if (!animalId) throw new ValidationError('animalId is required');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await MedicalRecordService.getConsultationsByAnimal(animalId, limit, offset);
    res.json({ success: true, data: result });
  }

  // ═══ STATS ════════════════════════════════════════════════

  async getStats(req: AuthRequest, res: Response): Promise<void> {
    const isAdmin = req.userRole === 'admin';
    const animalId = req.query.animalId as string | undefined;
    const stats = await MedicalRecordService.getMedicalStats(req.userId!, isAdmin, animalId);
    res.json({ success: true, data: stats });
  }
}

export default new MedicalRecordController();
