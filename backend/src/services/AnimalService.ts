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
      // Generate unique pet ID
      let uniqueId: string;
      try {
        const cnt = await database.query('SELECT COUNT(*) as count FROM animals');
        const num = parseInt(cnt.rows[0]?.count || '0', 10) + 1;
        uniqueId = `PET-${num.toString().padStart(5, '0')}`;
      } catch { uniqueId = `PET-${Date.now().toString(36).toUpperCase()}`; }
      const query = `
        INSERT INTO animals (id, owner_id, unique_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, medical_notes, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW())
        RETURNING id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
                  gender, weight, color, microchip_id as "microchipId", medical_notes as "medicalNotes",
                  is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, ownerId, uniqueId, data.name, data.species, data.breed || null,
        data.dateOfBirth || null, data.gender || null, data.weight || null,
        data.color || null, microchipId, data.medicalNotes || null
      ]);
      logger.info('Animal created', { id, ownerId, uniqueId, trackingNumber });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating animal', { originalError: error });
    }
  }

  async getAnimal(animalId: string): Promise<Animal> {
    try {
      const query = `
        SELECT id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
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
        SELECT id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
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

  async listAnimalsByVeterinarian(vetId: string, limit: number = 100, offset: number = 0): Promise<{ animals: Animal[]; total: number }> {
    try {
      // Get distinct animals the vet has consulted with (via bookings or consultations)
      const query = `
        SELECT DISTINCT a.id, a.owner_id as "ownerId", a.unique_id as "uniqueId", a.name, a.species, a.breed,
               a.date_of_birth as "dateOfBirth", a.gender, a.weight, a.color,
               a.microchip_id as "microchipId", a.medical_notes as "medicalNotes",
               a.is_active as "isActive", a.created_at as "createdAt", a.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "ownerName"
        FROM animals a
        LEFT JOIN users u ON u.id = a.owner_id
        WHERE a.is_active = true AND (
          a.id IN (SELECT animal_id FROM bookings WHERE veterinarian_id = $1 AND animal_id IS NOT NULL)
          OR a.id IN (SELECT animal_id FROM consultations WHERE veterinarian_id = $1 AND animal_id IS NOT NULL)
        )
        ORDER BY a.name ASC LIMIT $2 OFFSET $3
      `;
      const countQuery = `
        SELECT COUNT(DISTINCT a.id) as count FROM animals a
        WHERE a.is_active = true AND (
          a.id IN (SELECT animal_id FROM bookings WHERE veterinarian_id = $1 AND animal_id IS NOT NULL)
          OR a.id IN (SELECT animal_id FROM consultations WHERE veterinarian_id = $1 AND animal_id IS NOT NULL)
        )
      `;
      const [animalsResult, countResult] = await Promise.all([
        database.query(query, [vetId, limit, offset]),
        database.query(countQuery, [vetId]),
      ]);
      return {
        animals: animalsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing vet animals', { originalError: error });
    }
  }

  async listAllAnimals(limit: number = 100, offset: number = 0): Promise<{ animals: Animal[]; total: number }> {
    try {
      const query = `
        SELECT a.id, a.owner_id as "ownerId", a.unique_id as "uniqueId", a.name, a.species, a.breed,
               a.date_of_birth as "dateOfBirth", a.gender, a.weight, a.color,
               a.microchip_id as "microchipId", a.medical_notes as "medicalNotes",
               a.is_active as "isActive", a.created_at as "createdAt", a.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "ownerName"
        FROM animals a LEFT JOIN users u ON u.id = a.owner_id
        WHERE a.is_active = true ORDER BY a.name ASC LIMIT $1 OFFSET $2
      `;
      const countQuery = `SELECT COUNT(*) as count FROM animals WHERE is_active = true`;
      const [animalsResult, countResult] = await Promise.all([
        database.query(query, [limit, offset]),
        database.query(countQuery),
      ]);
      return {
        animals: animalsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing all animals', { originalError: error });
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
        RETURNING id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
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
