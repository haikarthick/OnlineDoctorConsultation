import { checkAnimalAccess } from '../middleware/hospitalDataIsolation';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import MedicalRecordService from '../services/MedicalRecordService';
import RecordCorrectionService from '../services/RecordCorrectionService';
import { ValidationError, ForbiddenError, CodedError } from '../utils/errors';
import database from '../utils/database';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE } from '../services/AnimalAccessService';

export class MedicalRecordController {
  // ═══ MEDICAL RECORDS ══════════════════════════════════════

  async createRecord(req: AuthRequest, res: Response): Promise<void> {
    const { recordType, title, content } = req.body;
    if (!recordType || !title || !content) {
      throw new ValidationError('recordType, title, and content are required');
    }
    const userName = req.body._userName || '';

    // A group-subject record must be one the caller can actually reach. Without this a group id
    // would be a bearer token for writing into another enterprise's health history.
    if (req.body.groupId) {
      const allowed = await database.query(
        `SELECT 1 FROM animal_groups ag
           JOIN enterprises e ON e.id = ag.enterprise_id
          WHERE ag.id = $1
            AND ($2 = 'admin'
                 OR e.owner_id = $3
                 OR EXISTS (SELECT 1 FROM enterprise_members em
                             WHERE em.enterprise_id = e.id AND em.user_id = $3 AND em.is_active = true AND em.role <> 'viewer'))
          LIMIT 1`,
        [req.body.groupId, req.userRole, req.userId]
      );
      if (!allowed.rows.length) {
        res.status(404).json({ success: false, message: 'Animal group not found' });
        return;
      }
    }

    // HIGH FIX-6: CRITICAL - force userId to authenticated user
    // Prevents attacker from passing ?userId=victim in request body
    const safeData = { ...req.body };
    delete safeData.userId; // Strip any caller-provided userId

    const record = await MedicalRecordService.createRecord(
      req.userId!,
      { ...safeData, veterinarianId: req.userRole === 'veterinarian' ? req.userId : req.body.veterinarianId },
      req.userId!, userName
    );
    res.status(201).json({ success: true, data: record });
  }

  async getRecord(req: AuthRequest, res: Response): Promise<void> {
    const record = await MedicalRecordService.getRecord(req.params.id);
    // Who may open it is decided on the route by requireRecordAccess (the one platform rule: the record's own animal or group).
    // The only extra rule here: a confidential record stays with the people on it.
    const me = req.userId;
    const onIt = record.userId === me || record.createdBy === me || (record as any).veterinarianId === me;
    if ((record as any).isConfidential && !onIt && req.userRole !== 'admin') {
      throw new ForbiddenError('This record was marked confidential by the person who wrote it. Ask them to share it with you.');
    }
    res.json({ success: true, data: record });
  }

  async listRecords(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const filters: any = { limit, offset };

    if (req.query.animalId) filters.animalId = req.query.animalId;
    if (req.query.groupId) filters.groupId = req.query.groupId; // a group's own records (still limited to the person's own by the scope below)
    if (req.query.recordType) filters.recordType = req.query.recordType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.search) filters.search = req.query.search;

    if (req.userRole === 'admin') {
      filters.isAdmin = true;
      const result = await MedicalRecordService.listRecords(filters);
      res.json({ success: true, data: result });
      return;
    }

    if (req.userRole === 'hospital_staff' || req.userRole === 'corporate_admin') {
      filters.userId = req.userId!;
      const result = await MedicalRecordService.listNetworkRecords(filters);
      res.json({ success: true, data: result });
      return;
    }

    filters.userId = req.userId;
    if (filters.animalId) {
      const user = { userId: req.userId!, role: req.userRole, roles: req.userRoles };
      const isolation = await checkAnimalAccess(req.userId!, req.userRole || '', filters.animalId);
      filters.animalAccessGranted = isolation.isPrivate ? isolation.allowed : (await AnimalAccessService.check(user, filters.animalId, 'read')).allowed;
    }
    const result = await MedicalRecordService.listRecords(filters);
    res.json({ success: true, data: result });
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
    const { animalId, groupId, vaccineName, dateAdministered } = req.body;
    // ONE subject: an animal or a group. A batch group is vaccinated as a single population, so
    // a 5,000-bird flock produces one record rather than 5,000.
    if ((!animalId && !groupId) || !vaccineName || !dateAdministered) {
      throw new ValidationError('animalId or groupId, plus vaccineName and dateAdministered, are required');
    }
    if (animalId && groupId) {
      throw new ValidationError('A vaccination belongs to either an animal or a group, not both');
    }
    // A caller must actually be able to reach the group they are recording against.
    if (groupId) {
      const allowed = await database.query(
        `SELECT 1 FROM animal_groups ag
           JOIN enterprises e ON e.id = ag.enterprise_id
          WHERE ag.id = $1
            AND ($2 = 'admin'
                 OR e.owner_id = $3
                 OR EXISTS (SELECT 1 FROM enterprise_members em
                             WHERE em.enterprise_id = e.id AND em.user_id = $3 AND em.is_active = true AND em.role <> 'viewer'))
          LIMIT 1`,
        [groupId, req.userRole, req.userId]
      );
      if (!allowed.rows.length) {
        res.status(404).json({ success: false, message: 'Animal group not found' });
        return;
      }
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

  // ═══ CORRECTIONS (never an edit in place) ═════════════════

  async listAddenda(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await RecordCorrectionService.listAddenda(req.params.id) });
  }

  async addAddendum(req: AuthRequest, res: Response): Promise<void> {
    const note = await RecordCorrectionService.addAddendum(req.params.id, { userId: req.userId!, role: req.userRole, roles: req.userRoles }, req.body.note);
    res.status(201).json({ success: true, data: note });
  }

  async markVaccinationMistake(req: AuthRequest, res: Response): Promise<void> {
    const out = await RecordCorrectionService.markMistake('vaccination_records', req.params.id, { userId: req.userId!, role: req.userRole, roles: req.userRoles }, req.body.reason);
    res.json({ success: true, data: out });
  }

  async markAllergyMistake(req: AuthRequest, res: Response): Promise<void> {
    const out = await RecordCorrectionService.markMistake('allergy_records', req.params.id, { userId: req.userId!, role: req.userRole, roles: req.userRoles }, req.body.reason);
    res.json({ success: true, data: out });
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
    const filters: { types?: string[]; dateFrom?: string; dateTo?: string } = {};
    if (req.query.types) {
      filters.types = (req.query.types as string).split(',').map(t => t.trim()).filter(Boolean);
    }
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom as string;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo as string;
    const timeline = await MedicalRecordService.getAnimalTimeline(animalId, limit, filters);
    res.json({ success: true, data: timeline });
  }

  // ═══ AUDIT LOG ════════════════════════════════════════════

  async getAuditLog(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin' && req.userRole !== 'veterinarian') {
      throw new ForbiddenError('Only admins and vets can view audit logs');
    }
    // A vet sees the change history of ONE record, and only one they can reach - not the whole platform's log.
    if (req.userRole !== 'admin') {
      const recordId = String(req.query.recordId || '');
      if (!/^[0-9a-f-]{36}$/i.test(recordId)) {
        throw new ForbiddenError('Open the change history from a record you are treating - the full log is for admins.');
      }
      const owner = await database.query(
        `SELECT animal_id FROM medical_records WHERE id = $1
         UNION ALL SELECT animal_id FROM vaccination_records WHERE id = $1
         UNION ALL SELECT animal_id FROM allergy_records WHERE id = $1
         UNION ALL SELECT animal_id FROM lab_results WHERE id = $1
         UNION ALL SELECT animal_id FROM weight_history WHERE id = $1
         LIMIT 1`,
        [recordId]
      );
      const animalId = owner.rows[0]?.animal_id;
      const access = animalId
        ? await AnimalAccessService.check({ userId: req.userId!, role: req.userRole, roles: req.userRoles }, animalId, 'read')
        : { allowed: false };
      if (!access.allowed) throw new CodedError(403, 'ANIMAL_NO_ACCESS', ANIMAL_NO_ACCESS_MESSAGE);
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

  // ═══ ENTERPRISE / HERD MEDICAL ════════════════════════════

  async listEnterpriseRecords(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId } = req.params;
    const filters: any = {
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
      offset: parseInt(req.query.offset as string) || 0,
    };
    if (req.query.animalId) filters.animalId = req.query.animalId;
    if (req.query.groupId) filters.groupId = req.query.groupId;
    if (req.query.recordType) filters.recordType = req.query.recordType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.search) filters.search = req.query.search;
    const result = await MedicalRecordService.listEnterpriseRecords(enterpriseId, filters);
    res.json({ success: true, data: result });
  }

  async listEnterpriseVaccinations(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId } = req.params;
    const filters: any = {
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
      offset: parseInt(req.query.offset as string) || 0,
    };
    if (req.query.animalId) filters.animalId = req.query.animalId;
    if (req.query.groupId) filters.groupId = req.query.groupId;
    if (req.query.overdueOnly === 'true') filters.overdueOnly = true;
    if (req.query.upcomingOnly === 'true') filters.upcomingOnly = true;
    const result = await MedicalRecordService.listEnterpriseVaccinations(enterpriseId, filters);
    res.json({ success: true, data: result });
  }

  async getEnterpriseMedicalStats(req: AuthRequest, res: Response): Promise<void> {
    const { enterpriseId } = req.params;
    const stats = await MedicalRecordService.getEnterpriseMedicalStats(enterpriseId);
    res.json({ success: true, data: stats });
  }
}

export default new MedicalRecordController();
