import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface Animal {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  gender?: string;
  weight?: number;
  color?: string;
  microchipId?: string;
  medicalNotes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnimalCreateDTO {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  gender?: string;
  weight?: number;
  color?: string;
  microchipId?: string;
  medicalNotes?: string;
}

export class AnimalService {
  // Generate a unique tracking number like VET-00001
  private async generateTrackingNumber(): Promise<string> {
    try {
      const result = await database.query(`SELECT COUNT(*) as count FROM animals`);
      const count = parseInt(result.rows[0]?.count || '0', 10) + 1;
      return `VET-${count.toString().padStart(5, '0')}`;
    } catch {
      // fallback to timestamp-based
      return `VET-${Date.now().toString(36).toUpperCase()}`;
    }
  }

  async createAnimal(ownerId: string, data: AnimalCreateDTO): Promise<Animal> {
    try {
      const id = uuidv4();
      const trackingNumber = await this.generateTrackingNumber();
      // Use microchip_id field to store tracking number if not provided
      const microchipId = data.microchipId || trackingNumber;
      const query = `
        INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, medical_notes, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
        RETURNING id, owner_id as "ownerId", name, species, breed, date_of_birth as "dateOfBirth",
                  gender, weight, color, microchip_id as "microchipId", medical_notes as "medicalNotes",
                  is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, ownerId, data.name, data.species, data.breed || null,
        data.dateOfBirth || null, data.gender || null, data.weight || null,
        data.color || null, microchipId, data.medicalNotes || null
      ]);
      logger.info('Animal created', { id, ownerId, trackingNumber });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating animal', { originalError: error });
    }
  }

  async getAnimal(animalId: string): Promise<Animal> {
    try {
      const query = `
        SELECT id, owner_id as "ownerId", name, species, breed, date_of_birth as "dateOfBirth",
               gender, weight, color, microchip_id as "microchipId", medical_notes as "medicalNotes",
               is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM animals WHERE id = $1
      `;
      const result = await database.query(query, [animalId]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Animal', animalId);
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching animal', { originalError: error });
    }
  }

  async listAnimalsByOwner(ownerId: string, limit: number = 20, offset: number = 0): Promise<{ animals: Animal[]; total: number }> {
    try {
      const query = `
        SELECT id, owner_id as "ownerId", name, species, breed, date_of_birth as "dateOfBirth",
               gender, weight, color, microchip_id as "microchipId", medical_notes as "medicalNotes",
               is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM animals WHERE owner_id = $1 AND is_active = true
        ORDER BY name ASC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM animals WHERE owner_id = $1 AND is_active = true`;
      const [animalsResult, countResult] = await Promise.all([
        database.query(query, [ownerId, limit, offset]),
        database.query(countQuery, [ownerId]),
      ]);
      return {
        animals: animalsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing animals', { originalError: error });
    }
  }

  async updateAnimal(animalId: string, updates: Partial<AnimalCreateDTO>): Promise<Animal> {
    try {
      const fieldMap: Record<string, string> = {
        name: 'name', species: 'species', breed: 'breed', dateOfBirth: 'date_of_birth',
        gender: 'gender', weight: 'weight', color: 'color', microchipId: 'microchip_id',
        medicalNotes: 'medical_notes',
      };
      const entries = Object.entries(updates).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return this.getAnimal(animalId);

      const sets = entries.map(([key], i) => `${fieldMap[key] || key} = $${i + 2}`);
      const values = entries.map(([_, v]) => v);

      const query = `
        UPDATE animals SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, owner_id as "ownerId", name, species, breed, date_of_birth as "dateOfBirth",
                  gender, weight, color, microchip_id as "microchipId", medical_notes as "medicalNotes",
                  is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [animalId, ...values]);
      if (result.rows.length === 0) throw new NotFoundError('Animal', animalId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error updating animal', { originalError: error });
    }
  }

  async deleteAnimal(animalId: string): Promise<void> {
    try {
      const query = `UPDATE animals SET is_active = false, updated_at = NOW() WHERE id = $1`;
      await database.query(query, [animalId]);
    } catch (error) {
      throw new DatabaseError('Error deleting animal', { originalError: error });
    }
  }
}

export default new AnimalService();
