import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ConsultationService from '../services/ConsultationService';
import database from '../utils/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

export class ConsultationController {
  async createConsultation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { veterinarianId, animalType, symptomDescription, scheduledAt, animalId, bookingId, petOwnerId } = req.body;

      if (!veterinarianId || !animalType || !symptomDescription) {
        throw new ValidationError('Missing required fields');
      }

      // Determine the real patient userId FIRST (needed for all dedup checks):
      // If a vet is creating this from a booking, the patient is petOwnerId, NOT the vet
      let patientId = req.userId!;
      if (req.userRole === 'veterinarian' && petOwnerId && petOwnerId !== req.userId) {
        patientId = petOwnerId;
      }

      // === DEDUP LAYER 1: Booking-level dedup ===
      // If creating from a booking, check if a consultation already exists for that booking
      if (bookingId) {
        try {
          const BookingService = (await import('../services/BookingService')).default;
          const booking = await BookingService.getBooking(bookingId);
          if (booking && booking.consultationId) {
            // Booking already linked to a consultation — return the existing one
            const existing = await ConsultationService.getConsultation(booking.consultationId);
            logger.info('Returning existing consultation from booking', { bookingId, consultationId: existing.id });
            return res.status(200).json({ success: true, data: existing }) as any;
          }
        } catch (err) {
          logger.warn('Booking lookup failed during dedup', { bookingId, error: (err as Error).message });
        }
      }

      // === DEDUP LAYER 2: Consultation-level dedup ===
      // Prevent duplicate consultations for the same vet + patient with active status
      try {
        const dupCheck = await database.query(
          `SELECT id, user_id as "userId", veterinarian_id as "veterinarianId", animal_type as "animalType",
                  symptom_description as "symptomDescription", status, scheduled_at as "scheduledAt",
                  started_at as "startedAt", completed_at as "completedAt", diagnosis, prescription,
                  created_at as "createdAt", updated_at as "updatedAt"
           FROM consultations 
           WHERE veterinarian_id = $1 AND user_id = $2 AND status IN ('scheduled', 'in_progress')
           ORDER BY created_at DESC LIMIT 1`,
          [veterinarianId, patientId]
        );
        if (dupCheck.rows.length > 0) {
          const existing = dupCheck.rows[0];
          logger.info('Returning existing active consultation (vet+patient dedup)', { 
            consultationId: existing.id, veterinarianId, patientId 
          });
          // Also link the booking if provided and not yet linked
          if (bookingId) {
            try {
              await database.query(
                'UPDATE bookings SET consultation_id = $1, updated_at = NOW() WHERE id = $2 AND consultation_id IS NULL',
                [existing.id, bookingId]
              );
            } catch { /* linking failed, not critical */ }
          }
          return res.status(200).json({ success: true, data: existing }) as any;
        }
      } catch (err) {
        logger.warn('Consultation dedup check failed', { error: (err as Error).message });
      }

      // === No existing consultation found — create new one ===
      const consultation = await ConsultationService.createConsultation(
        patientId,
        veterinarianId,
        { animalType, symptomDescription, scheduledAt, animalId }
      );

      // If created from a booking, link the booking to this consultation
      if (bookingId) {
        try {
          await database.query(
            'UPDATE bookings SET consultation_id = $1, updated_at = NOW() WHERE id = $2',
            [consultation.id, bookingId]
          );
        } catch { /* linking failed, not critical */ }
      }

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

      if (consultation.userId !== req.userId && consultation.veterinarianId !== req.userId && req.userRole !== 'admin') {
        throw new ForbiddenError('You do not have permission to view this consultation');
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

      if (consultation.veterinarianId !== req.userId && consultation.userId !== req.userId && req.userRole !== 'admin') {
        throw new ForbiddenError('You do not have permission to update this consultation');
      }

      const updated = await ConsultationService.updateConsultation(id, req.body);

      // When consultation is completed, also update the linked booking status
      if (req.body.status === 'completed') {
        try {
          // Find bookings linked to this consultation and mark them completed
          await database.query(
            `UPDATE bookings SET status = 'completed', updated_at = NOW() WHERE consultation_id = $1 AND status != 'completed'`,
            [id]
          );
          logger.info('Linked booking(s) marked as completed', { consultationId: id });
        } catch (err) {
          logger.warn('Failed to update linked booking status', { consultationId: id, error: (err as Error).message });
        }
      }

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
