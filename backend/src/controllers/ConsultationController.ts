import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
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

      // === DEDUP LAYER 1: Booking-level dedup (check both booking link and consultations.booking_id) ===
      if (bookingId) {
        // Check 1a: booking.consultation_id
        try {
          const BookingService = (await import('../services/BookingService')).default;
          const booking = await BookingService.getBooking(bookingId);
          if (booking && booking.consultationId) {
            const existing = await ConsultationService.getConsultation(booking.consultationId);
            logger.info('Returning existing consultation from booking link', { bookingId, consultationId: existing.id });
            return res.status(200).json({ success: true, data: existing }) as any;
          }
        } catch (err) {
          logger.warn('Booking lookup failed during dedup', { bookingId, error: (err as Error).message });
        }

        // Check 1b: consultations.booking_id (catches cases where booking link failed but consultation exists)
        try {
          const dupByBooking = await database.query(
            `SELECT id, user_id as "userId", veterinarian_id as "veterinarianId", animal_type as "animalType",
                    symptom_description as "symptomDescription", status, scheduled_at as "scheduledAt",
                    started_at as "startedAt", completed_at as "completedAt", diagnosis, prescription,
                    booking_id as "bookingId",
                    created_at as "createdAt", updated_at as "updatedAt"
             FROM consultations WHERE booking_id = $1 LIMIT 1`,
            [bookingId]
          );
          if (dupByBooking.rows.length > 0) {
            const existing = dupByBooking.rows[0];
            // Also ensure booking is linked
            try {
              await database.query(
                'UPDATE bookings SET consultation_id = $1, updated_at = NOW() WHERE id = $2 AND consultation_id IS NULL',
                [existing.id, bookingId]
              );
            } catch { /* safe to ignore */ }
            logger.info('Returning existing consultation from booking_id column', { bookingId, consultationId: existing.id });
            return res.status(200).json({ success: true, data: existing }) as any;
          }
        } catch (err) {
          logger.warn('Consultation booking_id dedup check failed', { error: (err as Error).message });
        }
      }

      // === DEDUP LAYER 2: Vet+patient active consultation dedup ===
      try {
        const dupCheck = await database.query(
          `SELECT id, user_id as "userId", veterinarian_id as "veterinarianId", animal_type as "animalType",
                  symptom_description as "symptomDescription", status, scheduled_at as "scheduledAt",
                  started_at as "startedAt", completed_at as "completedAt", diagnosis, prescription,
                  booking_id as "bookingId",
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
          if (bookingId) {
            try {
              await database.query(
                'UPDATE bookings SET consultation_id = $1, updated_at = NOW() WHERE id = $2 AND consultation_id IS NULL',
                [existing.id, bookingId]
              );
              // Also update consultation's booking_id if not set
              if (!existing.bookingId) {
                await database.query('UPDATE consultations SET booking_id = $1 WHERE id = $2', [bookingId, existing.id]);
              }
            } catch { /* safe to ignore */ }
          }
          return res.status(200).json({ success: true, data: existing }) as any;
        }
      } catch (err) {
        logger.warn('Consultation dedup check failed', { error: (err as Error).message });
      }

      // === No existing consultation found - create new one ===
      const consultation = await ConsultationService.createConsultation(
        patientId,
        veterinarianId,
        { animalType, symptomDescription, scheduledAt, animalId, bookingId }
      );

      // Link the booking to this consultation
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

        // §6.1: create the doctor's earning ledger entry (clearing) - idempotent
        try {
          const EarningsService = (await import('../services/payment/EarningsService')).default;
          await EarningsService.createEarningOnCompletion(id);
        } catch (earnErr) {
          logger.warn('Earning creation failed (non-blocking)', { consultationId: id, error: earnErr });
        }

        // H2: Auto-create medical record summary when consultation completes
        try {
          const consultResult = await database.query(
            `SELECT c.animal_id, c.user_id, c.veterinarian_id, c.diagnosis, c.notes, c.symptom_description
             FROM consultations c WHERE c.id = $1`,
            [id]
          );
          if (consultResult.rows.length > 0) {
            const c = consultResult.rows[0];
            if (c.animal_id) {
              const existingMR = await database.query(
                `SELECT id FROM medical_records WHERE consultation_id = $1 LIMIT 1`,
                [id]
              );
              if (existingMR.rows.length === 0) {
                const mrId = uuidv4();
                const contentParts: string[] = [];
                if (c.symptom_description) contentParts.push(`Symptoms: ${c.symptom_description}`);
                if (c.diagnosis) contentParts.push(`Diagnosis: ${c.diagnosis}`);
                if (c.notes) contentParts.push(`Notes: ${c.notes}`);
                const content = contentParts.length > 0
                  ? contentParts.join('\n')
                  : `Consultation completed on ${new Date().toLocaleDateString()}`;
                await database.query(
                  `INSERT INTO medical_records
                   (id, user_id, animal_id, veterinarian_id, consultation_id, record_type, title, content, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'other', $6, $7, NOW(), NOW())`,
                  [mrId, c.user_id, c.animal_id, c.veterinarian_id, id,
                   `Consultation Summary - ${new Date().toLocaleDateString()}`,
                   content]
                );
                logger.info('Auto-created medical record for completed consultation', { consultationId: id, mrId });
              }
            }
          }
        } catch (mrErr) {
          logger.warn('Auto medical record creation failed (non-blocking)', { consultationId: id, error: mrErr });
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

      const status = req.query.status as string | undefined;
      const networkId = req.query.networkId as string | undefined;
      const consultations = await ConsultationService.listConsultations(userId, veterinarianId, limit, offset, status, networkId);

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
