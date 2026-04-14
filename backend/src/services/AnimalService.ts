import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface Animal {
  id: string;
  ownerId: string;
  uniqueId?: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  gender?: string;
  weight?: number;
  color?: string;
  microchipId?: string;
  earTagId?: string;
  registrationNumber?: string;
  isNeutered?: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
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
  earTagId?: string;
  registrationNumber?: string;
  isNeutered?: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  medicalNotes?: string;
  enterpriseId?: string;
  groupId?: string;
}

export class AnimalService {
  // Map species name → 3-letter code for VC-SPE-YY-NNNNN format
  private getSpeciesCode(species: string): string {
    const s = species.toLowerCase().trim().replace(/[^a-z\s]/g, '').trim();
    // Common Pets
    if (s === 'dog' || s === 'canine') return 'DOG';
    if (s === 'cat' || s === 'feline') return 'CAT';
    // Small Pets
    if (s === 'rabbit') return 'RAB';
    if (s === 'hamster') return 'HAM';
    if (s === 'guinea pig' || s === 'guinea_pig' || s === 'guineapig') return 'GNP';
    if (s === 'gerbil') return 'GRB';
    if (s === 'chinchilla') return 'CHN';
    if (s === 'ferret') return 'FRT';
    if (s === 'hedgehog') return 'HDG';
    if (s === 'sugar glider' || s === 'sugar_glider') return 'SGL';
    // Birds
    if (s === 'parrot') return 'PAR';
    if (s === 'budgerigar' || s === 'budgie') return 'BDG';
    if (s === 'cockatiel') return 'CCT';
    if (s === 'lovebird') return 'LVB';
    if (s === 'finch') return 'FNC';
    if (s === 'canary') return 'CNR';
    if (s === 'mynah' || s === 'myna') return 'MYN';
    if (s === 'pigeon' || s === 'dove') return 'PGN';
    if (s === 'bird') return 'BRD';
    // Reptiles
    if (s === 'tortoise') return 'TOR';
    if (s === 'turtle') return 'TRT';
    if (s === 'gecko') return 'GCK';
    if (s === 'bearded dragon' || s === 'bearded_dragon') return 'BDR';
    if (s === 'chameleon') return 'CHL';
    if (s === 'snake') return 'SNK';
    // Amphibians
    if (s === 'frog') return 'FRG';
    if (s === 'axolotl') return 'AXL';
    // Fish
    if (s === 'ornamental fish' || s === 'ornamental_fish' || s === 'fish') return 'FSH';
    if (s === 'koi') return 'KOI';
    if (s === 'arowana') return 'ARW';
    if (s === 'goldfish') return 'GLD';
    // Livestock / Farm
    if (s === 'cattle' || s === 'cow' || s === 'bovine') return 'COW';
    if (s === 'buffalo' || s === 'water buffalo') return 'BUF';
    if (s === 'horse' || s === 'equine') return 'HRS';
    if (s === 'donkey' || s === 'mule' || s === 'ass') return 'DNK';
    if (s === 'sheep' || s === 'ovine') return 'SHP';
    if (s === 'goat' || s === 'caprine') return 'GOT';
    if (s === 'pig' || s === 'swine' || s === 'porcine') return 'PIG';
    if (s === 'camel') return 'CAM';
    if (s === 'yak') return 'YAK';
    if (s === 'deer') return 'DER';
    // Poultry
    if (s === 'chicken' || s === 'poultry') return 'CHK';
    if (s === 'duck') return 'DUK';
    if (s === 'turkey') return 'TRK';
    if (s === 'quail') return 'QAL';
    if (s === 'emu') return 'EMU';
    if (s === 'ostrich') return 'OST';
    if (s === 'peacock' || s === 'peafowl') return 'PCK';
    // Exotic Large
    if (s === 'llama') return 'LLA';
    if (s === 'alpaca') return 'ALP';
    return 'OTH';
  }

  // Generate race-safe unique ID: VC-SPE-YY-NNNNN using atomic sequence table
  private async generateUniqueId(species: string): Promise<string> {
    const code = this.getSpeciesCode(species);
    const year = new Date().getFullYear() % 100; // 2-digit year
    try {
      const res = await database.query(
        `INSERT INTO animal_id_sequences (species, year, last_seq)
         VALUES ($1, $2, 1)
         ON CONFLICT (species, year) DO UPDATE
           SET last_seq = animal_id_sequences.last_seq + 1
         RETURNING last_seq`,
        [code, year]
      );
      if (!res.rows || res.rows.length === 0) {
        throw new Error('Failed to retrieve sequence data');
      }
      const seq = res.rows[0].last_seq as number;
      return `VC-${code}-${year.toString().padStart(2, '0')}-${seq.toString().padStart(6, '0')}`;
    } catch {
      // Fallback: timestamp-based (won't race but non-sequential)
      return `VC-${code}-${year.toString().padStart(2, '0')}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    }
  }

  async createAnimal(ownerId: string, data: AnimalCreateDTO): Promise<Animal> {
    try {
      const id = uuidv4();
      const uniqueId = await this.generateUniqueId(data.species);
      const query = `
        INSERT INTO animals (id, owner_id, unique_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id,
                             ear_tag_id, registration_number, is_neutered, insurance_provider, insurance_policy_number, insurance_expiry,
                             medical_notes, enterprise_id, group_id, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, true, NOW(), NOW())
        RETURNING id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
                  gender, weight, color, microchip_id as "microchipId", ear_tag_id as "earTagId",
                  registration_number as "registrationNumber", is_neutered as "isNeutered",
                  insurance_provider as "insuranceProvider", insurance_policy_number as "insurancePolicyNumber",
                  insurance_expiry as "insuranceExpiry", medical_notes as "medicalNotes",
                  enterprise_id as "enterpriseId", group_id as "groupId",
                  is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, ownerId, uniqueId, data.name, data.species, data.breed || null,
        data.dateOfBirth || null, data.gender || null, data.weight || null,
        data.color || null, data.microchipId || null, data.earTagId || null, data.registrationNumber || null,
        data.isNeutered || false, data.insuranceProvider || null, data.insurancePolicyNumber || null,
        data.insuranceExpiry || null, data.medicalNotes || null,
        data.enterpriseId || null, data.groupId || null
      ]);
      logger.info('Animal created', { id, ownerId, uniqueId });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating animal', { originalError: error });
    }
  }

  // Search animal by VC unique ID — cross-module lookup
  async searchByUniqueId(uid: string): Promise<Animal | null> {
    try {
      const res = await database.query(
        `SELECT a.id, a.owner_id as "ownerId", a.unique_id as "uniqueId", a.name, a.species, a.breed,
                a.date_of_birth as "dateOfBirth", a.gender, a.weight, a.color,
                a.microchip_id as "microchipId", a.ear_tag_id as "earTagId",
                a.registration_number as "registrationNumber", a.is_neutered as "isNeutered",
                a.insurance_provider as "insuranceProvider", a.insurance_policy_number as "insurancePolicyNumber",
                a.insurance_expiry as "insuranceExpiry", a.medical_notes as "medicalNotes",
                a.enterprise_id as "enterpriseId", a.group_id as "groupId",
                a.is_active as "isActive", a.created_at as "createdAt", a.updated_at as "updatedAt",
                COALESCE(u.first_name || ' ' || u.last_name, '') as "ownerName",
                u.email as "ownerEmail"
         FROM animals a LEFT JOIN users u ON u.id = a.owner_id
         WHERE a.unique_id = $1 AND a.is_active = true`,
        [uid.trim().toUpperCase()]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Error searching animal by unique ID', { originalError: error });
    }
  }

  async getAnimal(animalId: string): Promise<Animal> {
    try {
      const query = `
        SELECT id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
               gender, weight, color, microchip_id as "microchipId", ear_tag_id as "earTagId",
               registration_number as "registrationNumber", is_neutered as "isNeutered",
               insurance_provider as "insuranceProvider", insurance_policy_number as "insurancePolicyNumber",
               insurance_expiry as "insuranceExpiry", medical_notes as "medicalNotes",
               breeding_status as "breedingStatus", current_weight as "currentWeight",
               weight_unit as "weightUnit", last_breeding_date as "lastBreedingDate",
               expected_due_date as "expectedDueDate",
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
               gender, weight, color, microchip_id as "microchipId", ear_tag_id as "earTagId",
               registration_number as "registrationNumber", is_neutered as "isNeutered",
               insurance_provider as "insuranceProvider", insurance_policy_number as "insurancePolicyNumber",
               insurance_expiry as "insuranceExpiry", medical_notes as "medicalNotes",
               breeding_status as "breedingStatus", current_weight as "currentWeight",
               weight_unit as "weightUnit", last_breeding_date as "lastBreedingDate",
               expected_due_date as "expectedDueDate",
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
               a.microchip_id as "microchipId", a.ear_tag_id as "earTagId",
               a.registration_number as "registrationNumber", a.is_neutered as "isNeutered",
               a.insurance_provider as "insuranceProvider", a.insurance_policy_number as "insurancePolicyNumber",
               a.insurance_expiry as "insuranceExpiry", a.medical_notes as "medicalNotes",
               a.breeding_status as "breedingStatus", a.current_weight as "currentWeight",
               a.weight_unit as "weightUnit", a.last_breeding_date as "lastBreedingDate",
               a.expected_due_date as "expectedDueDate",
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
               a.microchip_id as "microchipId", a.ear_tag_id as "earTagId",
               a.registration_number as "registrationNumber", a.is_neutered as "isNeutered",
               a.insurance_provider as "insuranceProvider", a.insurance_policy_number as "insurancePolicyNumber",
               a.insurance_expiry as "insuranceExpiry", a.medical_notes as "medicalNotes",
               a.breeding_status as "breedingStatus", a.current_weight as "currentWeight",
               a.weight_unit as "weightUnit", a.last_breeding_date as "lastBreedingDate",
               a.expected_due_date as "expectedDueDate",
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

  async listAnimalsForNetworkStaff(userId: string, limit: number = 100, offset: number = 0): Promise<{ animals: Animal[]; total: number }> {
    try {
      // Find user's network membership
      const memberResult = await database.query(
        `SELECT network_id, hospital_id FROM hospital_network_members 
         WHERE user_id = $1 AND is_active = true LIMIT 1`,
        [userId]
      );
      if (memberResult.rows.length === 0) {
        return { animals: [], total: 0 };
      }
      const { network_id } = memberResult.rows[0];

      const query = `
        SELECT DISTINCT a.id, a.owner_id as "ownerId", a.unique_id as "uniqueId", a.name, a.species, a.breed,
               a.date_of_birth as "dateOfBirth", a.gender, a.weight, a.color,
               a.microchip_id as "microchipId", a.ear_tag_id as "earTagId",
               a.registration_number as "registrationNumber", a.is_neutered as "isNeutered",
               a.insurance_provider as "insuranceProvider", a.insurance_policy_number as "insurancePolicyNumber",
               a.insurance_expiry as "insuranceExpiry", a.medical_notes as "medicalNotes",
               a.breeding_status as "breedingStatus", a.current_weight as "currentWeight",
               a.weight_unit as "weightUnit", a.last_breeding_date as "lastBreedingDate",
               a.expected_due_date as "expectedDueDate",
               a.is_active as "isActive", a.created_at as "createdAt", a.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "ownerName"
        FROM animals a
        LEFT JOIN users u ON u.id = a.owner_id
        JOIN animal_care_contexts acc ON acc.animal_id = a.id
        WHERE a.is_active = true
          AND acc.network_id = $1
          AND acc.enrollment_status = 'active'
          AND acc.is_active = true
        ORDER BY a.name ASC LIMIT $2 OFFSET $3
      `;
      const countQuery = `
        SELECT COUNT(DISTINCT a.id) as count FROM animals a
        JOIN animal_care_contexts acc ON acc.animal_id = a.id
        WHERE a.is_active = true
          AND acc.network_id = $1
          AND acc.enrollment_status = 'active'
          AND acc.is_active = true
      `;
      const [animalsResult, countResult] = await Promise.all([
        database.query(query, [network_id, limit, offset]),
        database.query(countQuery, [network_id]),
      ]);
      return {
        animals: animalsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing network staff animals', { originalError: error });
    }
  }

  async updateAnimal(animalId: string, updates: Partial<AnimalCreateDTO>): Promise<Animal> {
    try {
      const fieldMap: Record<string, string> = {
        name: 'name', species: 'species', breed: 'breed', dateOfBirth: 'date_of_birth',
        gender: 'gender', weight: 'weight', color: 'color', microchipId: 'microchip_id',
        earTagId: 'ear_tag_id', registrationNumber: 'registration_number', isNeutered: 'is_neutered',
        insuranceProvider: 'insurance_provider', insurancePolicyNumber: 'insurance_policy_number',
        insuranceExpiry: 'insurance_expiry', medicalNotes: 'medical_notes',
      };
      const entries = Object.entries(updates).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return this.getAnimal(animalId);

      const sets = entries.map(([key], i) => `${fieldMap[key] || key} = $${i + 2}`);
      const values = entries.map(([_, v]) => v);

      const query = `
        UPDATE animals SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, owner_id as "ownerId", unique_id as "uniqueId", name, species, breed, date_of_birth as "dateOfBirth",
                  gender, weight, color, microchip_id as "microchipId", ear_tag_id as "earTagId",
                  registration_number as "registrationNumber", is_neutered as "isNeutered",
                  insurance_provider as "insuranceProvider", insurance_policy_number as "insurancePolicyNumber",
                  insurance_expiry as "insuranceExpiry", medical_notes as "medicalNotes",
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

  async listEnterpriseAnimals(enterpriseId: string, filters: { species?: string; groupId?: string; limit?: number; offset?: number } = {}): Promise<{ items: any[]; total: number }> {
    try {
      const { species, groupId, limit = 100, offset = 0 } = filters;
      const conditions: string[] = ['a.enterprise_id = $1', 'a.is_active = true'];
      const params: any[] = [enterpriseId];
      let idx = 2;
      if (species) { conditions.push(`a.species = $${idx++}`); params.push(species); }
      if (groupId) { conditions.push(`a.group_id = $${idx++}`); params.push(groupId); }
      const where = conditions.join(' AND ');
      const [rows, count] = await Promise.all([
        database.query(
          `SELECT a.id, a.name, a.species, a.breed, a.gender, a.date_of_birth as "dateOfBirth",
                  a.weight, a.unique_id as "uniqueId", a.group_id as "groupId",
                  a.enterprise_id as "enterpriseId", a.owner_id as "ownerId",
                  ag.name as "groupName", ag.color_code as "groupColor",
                  e.name as "enterpriseName"
           FROM animals a
           LEFT JOIN animal_groups ag ON ag.id = a.group_id
           LEFT JOIN enterprises e ON e.id = a.enterprise_id
           WHERE ${where}
           ORDER BY ag.name NULLS LAST, a.name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, Math.min(+limit, 200), +offset]
        ),
        database.query(`SELECT COUNT(*) as count FROM animals a WHERE ${where}`, params),
      ]);
      return { items: rows.rows, total: parseInt(count.rows[0]?.count || '0') };
    } catch (error) {
      throw new DatabaseError('Error listing enterprise animals', { originalError: error });
    }
  }
}

export default new AnimalService();
