import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ConsultationService from '../services/ConsultationService';
import { ValidationError, NotFoundError } from '../utils/errors';

export class ConsultationController {
  async createConsultation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { veterinarianId, animalType, symptomDescription, scheduledAt } = req.body;

      if (!veterinarianId || !animalType || !symptomDescription) {
        throw new ValidationError('Missing required fields');
      }

      const consultation = await ConsultationService.createConsultation(
        req.userId!,
        veterinarianId,
        { animalType, symptomDescription, scheduledAt }
      );

      res.status(201).json({
        success: true,
        data: consultation
      });
    } catch (error) {
      throw error;
    }
  }

  async getConsultation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const consultation = await ConsultationService.getConsultation(id);

      if (consultation.userId !== req.userId && req.userRole !== 'admin') {
        throw new Error('Access denied');
      }

      res.json({
        success: true,
        data: consultation
      });
    } catch (error) {
      throw error;
    }
  }

  async updateConsultation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const consultation = await ConsultationService.getConsultation(id);

      if (consultation.veterinarianId !== req.userId && req.userRole !== 'admin') {
        throw new Error('Access denied');
      }

      const updated = await ConsultationService.updateConsultation(id, req.body);

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      throw error;
    }
  }

  async listConsultations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      let userId = undefined;
      let veterinarianId = undefined;

      if (req.userRole === 'veterinarian') {
        veterinarianId = req.userId;
      } else {
        userId = req.userId;
      }

      const consultations = await ConsultationService.listConsultations(userId, veterinarianId, limit, offset);

      res.json({
        success: true,
        data: consultations
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new ConsultationController();
