import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import MedicalRecordService from '../services/MedicalRecordService';
import { ValidationError, ForbiddenError } from '../utils/errors';

export class MedicalRecordController {
  async createRecord(req: AuthRequest, res: Response): Promise<void> {
    const { recordType, title, content, animalId, consultationId, fileUrl } = req.body;
    if (!recordType || !title || !content) {
      throw new ValidationError('recordType, title, and content are required');
    }

    // Pet owners create records for themselves; vets create records for the consultation user
    const targetUserId = req.body.userId || req.userId!;

    const record = await MedicalRecordService.createRecord(
      targetUserId,
      { recordType, title, content, animalId, consultationId, fileUrl },
      req.userId!
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
    const animalId = req.query.animalId as string | undefined;

    let result;
    if (animalId) {
      result = await MedicalRecordService.listRecordsByAnimal(animalId, limit, offset);
    } else {
      result = await MedicalRecordService.listRecordsByUser(req.userId!, limit, offset);
    }
    res.json({ success: true, data: result });
  }

  async updateRecord(req: AuthRequest, res: Response): Promise<void> {
    const record = await MedicalRecordService.getRecord(req.params.id);
    if (record.createdBy !== req.userId && req.userRole !== 'admin') {
      throw new ForbiddenError('You do not have permission to update this record');
    }
    const updated = await MedicalRecordService.updateRecord(req.params.id, req.body);
    res.json({ success: true, data: updated });
  }

  async deleteRecord(req: AuthRequest, res: Response): Promise<void> {
    const record = await MedicalRecordService.getRecord(req.params.id);
    if (record.userId !== req.userId && req.userRole !== 'admin') {
      throw new ForbiddenError('You do not have permission to delete this record');
    }
    await MedicalRecordService.deleteRecord(req.params.id);
    res.json({ success: true, message: 'Record deleted' });
  }
}

export default new MedicalRecordController();
