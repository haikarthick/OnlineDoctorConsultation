import { v4 as uuidv4 } from 'uuid';
import { Consultation } from '../models/types';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export class ConsultationService {
  async createConsultation(userId: string, veterinarianId: string, data: any): Promise<Consultation> {
    try {
      const consultationId = uuidv4();
      const query = `
        INSERT INTO consultations (id, user_id, veterinarian_id, animal_id, animal_type, symptom_description, status, scheduled_at, booking_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, user_id as "userId", veterinarian_id as "veterinarianId", animal_id as "animalId",
                  animal_type as "animalType", symptom_description as "symptomDescription", status,
                  scheduled_at as "scheduledAt", booking_id as "bookingId",
                  created_at as "createdAt", updated_at as "updatedAt"
      `;

      const result = await database.query(query, [
        consultationId,
        userId,
        veterinarianId,
        data.animalId || null,
        data.animalType,
        data.symptomDescription,
        'scheduled',
        data.scheduledAt || new Date(),
        data.bookingId || null
      ]);

      logger.info('Consultation created', { consultationId, userId, veterinarianId, animalId: data.animalId });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating consultation', { originalError: error });
    }
  }

  async getConsultation(consultationId: string): Promise<Consultation> {
    try {
      const query = `
        SELECT id, user_id as "userId", veterinarian_id as "veterinarianId", animal_id as "animalId", animal_type as "animalType",
               symptom_description as "symptomDescription", status, scheduled_at as "scheduledAt",
               started_at as "startedAt", completed_at as "completedAt", diagnosis, prescription, notes, duration,
               created_at as "createdAt", updated_at as "updatedAt"
        FROM consultations WHERE id = $1
      `;

      const result = await database.query(query, [consultationId]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Consultation', consultationId);
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Error fetching consultation', { originalError: error });
    }
  }

  async updateConsultation(consultationId: string, updates: Partial<Consultation>): Promise<Consultation> {
    try {
      const validUpdates: Record<string, any> = {
        status: updates.status,
        started_at: updates.startedAt,
        completed_at: updates.completedAt,
        diagnosis: updates.diagnosis,
        prescription: updates.prescription,
        notes: (updates as any).notes,
        animal_id: (updates as any).animalId,
        duration: updates.duration
      };

      const fields = Object.entries(validUpdates)
        .filter(([_, value]) => value !== undefined)
        .map(([key], idx) => `${key} = $${idx + 2}`);

      const values = Object.values(validUpdates).filter(v => v !== undefined);

      if (fields.length === 0) {
        return this.getConsultation(consultationId);
      }

      const query = `
        UPDATE consultations SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_id as "userId", veterinarian_id as "veterinarianId", animal_id as "animalId",
                  animal_type as "animalType", symptom_description as "symptomDescription", status,
                  scheduled_at as "scheduledAt", started_at as "startedAt", completed_at as "completedAt",
                  diagnosis, prescription, notes, duration,
                  created_at as "createdAt", updated_at as "updatedAt"
      `;

      const result = await database.query(query, [consultationId, ...values]);
      logger.info('Consultation updated', { consultationId });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error updating consultation', { originalError: error });
    }
  }

  async listConsultations(userId?: string, veterinarianId?: string, limit: number = 10, offset: number = 0, status?: string) {
    try {
      let query = `SELECT id, user_id as "userId", veterinarian_id as "veterinarianId", animal_id as "animalId", animal_type as "animalType",
                   symptom_description as "symptomDescription", status, scheduled_at as "scheduledAt",
                   diagnosis, notes, duration,
                   created_at as "createdAt", updated_at as "updatedAt"
                   FROM consultations WHERE 1=1`;
      const params: any[] = [];
      let paramCount = 0;

      if (userId) {
        paramCount++;
        query += ` AND user_id = $${paramCount}`;
        params.push(userId);
      }

      if (veterinarianId) {
        paramCount++;
        query += ` AND veterinarian_id = $${paramCount}`;
        params.push(veterinarianId);
      }

      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      query += ` ORDER BY scheduled_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Error listing consultations', { originalError: error });
    }
  }
}

export default new ConsultationService();
