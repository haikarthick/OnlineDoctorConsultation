import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface MedicalRecord {
  id: string;
  userId: string;
  animalId?: string;
  consultationId?: string;
  recordType: string;
  title: string;
  content: string;
  fileUrl?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecordCreateDTO {
  animalId?: string;
  consultationId?: string;
  recordType: string;
  title: string;
  content: string;
  fileUrl?: string;
}

export class MedicalRecordService {
  async createRecord(userId: string, data: MedicalRecordCreateDTO, createdBy?: string): Promise<MedicalRecord> {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO medical_records (id, user_id, animal_id, consultation_id, record_type, title, content, file_url, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, user_id as "userId", animal_id as "animalId", consultation_id as "consultationId",
                  record_type as "recordType", title, content, file_url as "fileUrl",
                  created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, userId, data.animalId || null, data.consultationId || null,
        data.recordType, data.title, data.content, data.fileUrl || null, createdBy || userId,
      ]);
      logger.info('Medical record created', { id, userId });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating medical record', { originalError: error });
    }
  }

  async getRecord(recordId: string): Promise<MedicalRecord> {
    try {
      const query = `
        SELECT id, user_id as "userId", animal_id as "animalId", consultation_id as "consultationId",
               record_type as "recordType", title, content, file_url as "fileUrl",
               created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
        FROM medical_records WHERE id = $1
      `;
      const result = await database.query(query, [recordId]);
      if (result.rows.length === 0) throw new NotFoundError('MedicalRecord', recordId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching medical record', { originalError: error });
    }
  }

  async listRecordsByUser(userId: string, limit: number = 20, offset: number = 0): Promise<{ records: MedicalRecord[]; total: number }> {
    try {
      const query = `
        SELECT id, user_id as "userId", animal_id as "animalId", consultation_id as "consultationId",
               record_type as "recordType", title, content, file_url as "fileUrl",
               created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
        FROM medical_records WHERE user_id = $1
        ORDER BY created_at DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM medical_records WHERE user_id = $1`;
      const [recordsResult, countResult] = await Promise.all([
        database.query(query, [userId, limit, offset]),
        database.query(countQuery, [userId]),
      ]);
      return {
        records: recordsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing medical records', { originalError: error });
    }
  }

  async listRecordsByAnimal(animalId: string, limit: number = 20, offset: number = 0): Promise<{ records: MedicalRecord[]; total: number }> {
    try {
      const query = `
        SELECT id, user_id as "userId", animal_id as "animalId", consultation_id as "consultationId",
               record_type as "recordType", title, content, file_url as "fileUrl",
               created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
        FROM medical_records WHERE animal_id = $1
        ORDER BY created_at DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM medical_records WHERE animal_id = $1`;
      const [recordsResult, countResult] = await Promise.all([
        database.query(query, [animalId, limit, offset]),
        database.query(countQuery, [animalId]),
      ]);
      return {
        records: recordsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing medical records by animal', { originalError: error });
    }
  }

  async updateRecord(recordId: string, updates: Partial<MedicalRecordCreateDTO>): Promise<MedicalRecord> {
    try {
      const fieldMap: Record<string, string> = {
        recordType: 'record_type', title: 'title', content: 'content',
        fileUrl: 'file_url', animalId: 'animal_id', consultationId: 'consultation_id',
      };
      const entries = Object.entries(updates).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return this.getRecord(recordId);

      const sets = entries.map(([key], i) => `${fieldMap[key] || key} = $${i + 2}`);
      const values = entries.map(([_, v]) => v);

      const query = `
        UPDATE medical_records SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, user_id as "userId", animal_id as "animalId", consultation_id as "consultationId",
                  record_type as "recordType", title, content, file_url as "fileUrl",
                  created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [recordId, ...values]);
      if (result.rows.length === 0) throw new NotFoundError('MedicalRecord', recordId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error updating medical record', { originalError: error });
    }
  }

  async deleteRecord(recordId: string): Promise<void> {
    try {
      await database.query(`DELETE FROM medical_records WHERE id = $1`, [recordId]);
    } catch (error) {
      throw new DatabaseError('Error deleting medical record', { originalError: error });
    }
  }
}

export default new MedicalRecordService();
