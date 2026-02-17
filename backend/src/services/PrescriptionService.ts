import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { Prescription, CreatePrescriptionDTO, Medication } from '../models/types';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

class PrescriptionService {
  async createPrescription(veterinarianId: string, data: CreatePrescriptionDTO): Promise<Prescription> {
    const id = uuidv4();
    const now = new Date();

    // Auto-lookup petOwnerId and animalId from consultation if not provided
    let petOwnerId = data.petOwnerId;
    let animalId = data.animalId || null;
    if (data.consultationId && (!petOwnerId || !animalId)) {
      try {
        const consultResult = await database.query(
          `SELECT user_id, animal_id FROM consultations WHERE id = $1`,
          [data.consultationId]
        );
        if (consultResult.rows.length > 0) {
          if (!petOwnerId) petOwnerId = consultResult.rows[0].user_id;
          if (!animalId) animalId = consultResult.rows[0].animal_id || null;
        }
      } catch (err) {
        logger.warn('Could not auto-lookup consultation for prescription', { consultationId: data.consultationId, error: err });
      }
    }

    if (!petOwnerId) {
      throw new NotFoundError('Pet owner could not be determined from consultation', data.consultationId);
    }

    // Default validUntil to 30 days from now if not provided
    const validUntil = data.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await database.query(
      `INSERT INTO prescriptions (id, consultation_id, veterinarian_id, pet_owner_id, animal_id,
       medications, instructions, valid_until, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, consultation_id as "consultationId", veterinarian_id as "veterinarianId",
       pet_owner_id as "petOwnerId", animal_id as "animalId", medications, instructions,
       valid_until as "validUntil", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [id, data.consultationId, veterinarianId, petOwnerId, animalId,
       JSON.stringify(data.medications), data.instructions, validUntil, true, now, now]
    );

    logger.info('Prescription created', { prescriptionId: id, consultationId: data.consultationId });

    // If diagnosis or followUpDate provided, update the consultation record
    if (data.consultationId && (data.diagnosis || data.followUpDate)) {
      try {
        const updates: string[] = [];
        const vals: any[] = [data.consultationId];
        let idx = 2;
        if (data.diagnosis) {
          updates.push(`diagnosis = $${idx++}`);
          vals.push(data.diagnosis);
        }
        if (data.followUpDate) {
          updates.push(`follow_up_date = $${idx++}`);
          vals.push(data.followUpDate);
        }
        updates.push('updated_at = NOW()');
        await database.query(
          `UPDATE consultations SET ${updates.join(', ')} WHERE id = $1`,
          vals
        );
        logger.info('Consultation updated with prescription diagnosis/followUp', { consultationId: data.consultationId });
      } catch (err) {
        logger.warn('Failed to update consultation with prescription data', { error: err });
      }
    }

    return result.rows[0];
  }

  async getPrescription(id: string): Promise<Prescription> {
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", veterinarian_id as "veterinarianId",
       pet_owner_id as "petOwnerId", animal_id as "animalId", medications, instructions,
       valid_until as "validUntil", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM prescriptions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) throw new NotFoundError('Prescription', id);
    
    const row = result.rows[0];
    if (typeof row.medications === 'string') {
      row.medications = JSON.parse(row.medications);
    }
    return row;
  }

  async listByConsultation(consultationId: string): Promise<Prescription[]> {
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", veterinarian_id as "veterinarianId",
       pet_owner_id as "petOwnerId", medications, instructions,
       valid_until as "validUntil", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM prescriptions WHERE consultation_id = $1 ORDER BY created_at DESC`,
      [consultationId]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async listByPetOwner(petOwnerId: string, params?: { limit?: number; offset?: number }): Promise<Prescription[]> {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;

    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", veterinarian_id as "veterinarianId",
       pet_owner_id as "petOwnerId", medications, instructions,
       valid_until as "validUntil", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM prescriptions WHERE pet_owner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [petOwnerId, limit, offset]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async listByVeterinarian(veterinarianId: string, params?: { limit?: number; offset?: number }): Promise<Prescription[]> {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;

    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", veterinarian_id as "veterinarianId",
       pet_owner_id as "petOwnerId", medications, instructions,
       valid_until as "validUntil", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM prescriptions WHERE veterinarian_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [veterinarianId, limit, offset]
    );
    return result.rows.map((row: any) => {
      if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
      return row;
    });
  }

  async listByAnimal(animalId: string, params?: { limit?: number; offset?: number }): Promise<{ prescriptions: Prescription[]; total: number }> {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    const result = await database.query(
      `SELECT p.id, p.consultation_id as "consultationId", p.veterinarian_id as "veterinarianId",
       p.pet_owner_id as "petOwnerId", p.animal_id as "animalId", p.medications, p.instructions,
       p.valid_until as "validUntil", p.is_active as "isActive",
       p.created_at as "createdAt", p.updated_at as "updatedAt",
       COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as "veterinarianName",
       c.diagnosis
       FROM prescriptions p
       LEFT JOIN users u ON u.id = p.veterinarian_id
       LEFT JOIN consultations c ON c.id = p.consultation_id
       WHERE p.animal_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [animalId, limit, offset]
    );
    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM prescriptions WHERE animal_id = $1`,
      [animalId]
    );
    return {
      prescriptions: result.rows.map((row: any) => {
        if (typeof row.medications === 'string') row.medications = JSON.parse(row.medications);
        return row;
      }),
      total: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  async deactivatePrescription(id: string): Promise<Prescription> {
    const result = await database.query(
      `UPDATE prescriptions SET is_active = $1, updated_at = $2 WHERE id = $3
       RETURNING id, consultation_id as "consultationId", is_active as "isActive",
       created_at as "createdAt", updated_at as "updatedAt"`,
      [false, new Date(), id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Prescription', id);
    return result.rows[0];
  }
}

export default new PrescriptionService();
