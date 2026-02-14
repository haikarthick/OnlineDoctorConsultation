import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface VetProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization?: string;
  yearsOfExperience: number;
  bio?: string;
  clinicName?: string;
  clinicAddress?: string;
  consultationFee: number;
  isVerified: boolean;
  availableDays: string;
  availableHoursStart: string;
  availableHoursEnd: string;
  rating: number;
  totalConsultations: number;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface VetProfileCreateDTO {
  licenseNumber: string;
  specialization?: string;
  yearsOfExperience?: number;
  bio?: string;
  clinicName?: string;
  clinicAddress?: string;
  consultationFee?: number;
  availableDays?: string;
  availableHoursStart?: string;
  availableHoursEnd?: string;
}

export class VetProfileService {
  async createProfile(userId: string, data: VetProfileCreateDTO): Promise<VetProfile> {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO vet_profiles (id, user_id, license_number, specialization, years_of_experience,
          bio, clinic_name, clinic_address, consultation_fee, available_days, available_hours_start, available_hours_end,
          is_verified, rating, total_consultations, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,0.00,0,NOW(),NOW())
        RETURNING id, user_id as "userId", license_number as "licenseNumber", specialization,
                  years_of_experience as "yearsOfExperience", bio, clinic_name as "clinicName",
                  clinic_address as "clinicAddress", consultation_fee as "consultationFee",
                  is_verified as "isVerified", available_days as "availableDays",
                  available_hours_start as "availableHoursStart", available_hours_end as "availableHoursEnd",
                  rating, total_consultations as "totalConsultations",
                  created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, userId, data.licenseNumber, data.specialization || null,
        data.yearsOfExperience || 0, data.bio || null, data.clinicName || null,
        data.clinicAddress || null, data.consultationFee || 0,
        data.availableDays || 'Mon,Tue,Wed,Thu,Fri',
        data.availableHoursStart || '09:00', data.availableHoursEnd || '17:00',
      ]);
      logger.info('Vet profile created', { id, userId });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating vet profile', { originalError: error });
    }
  }

  async getProfileByUserId(userId: string): Promise<VetProfile> {
    try {
      const query = `
        SELECT vp.id, vp.user_id as "userId", vp.license_number as "licenseNumber", vp.specialization,
               vp.years_of_experience as "yearsOfExperience", vp.bio, vp.clinic_name as "clinicName",
               vp.clinic_address as "clinicAddress", vp.consultation_fee as "consultationFee",
               vp.is_verified as "isVerified", vp.available_days as "availableDays",
               vp.available_hours_start as "availableHoursStart", vp.available_hours_end as "availableHoursEnd",
               vp.rating, vp.total_consultations as "totalConsultations",
               u.first_name as "firstName", u.last_name as "lastName", u.email, u.phone,
               vp.created_at as "createdAt", vp.updated_at as "updatedAt"
        FROM vet_profiles vp JOIN users u ON u.id = vp.user_id
        WHERE vp.user_id = $1
      `;
      const result = await database.query(query, [userId]);
      if (result.rows.length === 0) throw new NotFoundError('VetProfile', userId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching vet profile', { originalError: error });
    }
  }

  async listVets(limit: number = 20, offset: number = 0, specialization?: string): Promise<{ vets: VetProfile[]; total: number }> {
    try {
      let query = `
        SELECT vp.id, vp.user_id as "userId", vp.license_number as "licenseNumber", vp.specialization,
               vp.years_of_experience as "yearsOfExperience", vp.bio, vp.clinic_name as "clinicName",
               vp.consultation_fee as "consultationFee", vp.is_verified as "isVerified",
               vp.rating, vp.total_consultations as "totalConsultations",
               u.first_name as "firstName", u.last_name as "lastName", u.email,
               vp.created_at as "createdAt", vp.updated_at as "updatedAt"
        FROM vet_profiles vp JOIN users u ON u.id = vp.user_id
        WHERE u.is_active = true
      `;
      const params: any[] = [];
      let idx = 0;

      if (specialization) {
        idx++;
        query += ` AND vp.specialization ILIKE $${idx}`;
        params.push(`%${specialization}%`);
      }

      const countQuery = `SELECT COUNT(*) as count FROM vet_profiles vp JOIN users u ON u.id = vp.user_id WHERE u.is_active = true${specialization ? ` AND vp.specialization ILIKE $1` : ''}`;
      const countParams = specialization ? [`%${specialization}%`] : [];

      query += ` ORDER BY vp.rating DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`;
      params.push(limit, offset);

      const [vetsResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, countParams),
      ]);

      return {
        vets: vetsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing vets', { originalError: error });
    }
  }

  async updateProfile(userId: string, updates: Partial<VetProfileCreateDTO>): Promise<VetProfile> {
    try {
      const fieldMap: Record<string, string> = {
        licenseNumber: 'license_number', specialization: 'specialization',
        yearsOfExperience: 'years_of_experience', bio: 'bio',
        clinicName: 'clinic_name', clinicAddress: 'clinic_address',
        consultationFee: 'consultation_fee', availableDays: 'available_days',
        availableHoursStart: 'available_hours_start', availableHoursEnd: 'available_hours_end',
      };

      const entries = Object.entries(updates).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return this.getProfileByUserId(userId);

      const sets = entries.map(([key], i) => `${fieldMap[key] || key} = $${i + 2}`);
      const values = entries.map(([_, v]) => v);

      const query = `
        UPDATE vet_profiles SET ${sets.join(', ')}, updated_at = NOW()
        WHERE user_id = $1
        RETURNING id, user_id as "userId", license_number as "licenseNumber", specialization,
                  years_of_experience as "yearsOfExperience", bio, clinic_name as "clinicName",
                  consultation_fee as "consultationFee", is_verified as "isVerified",
                  rating, total_consultations as "totalConsultations",
                  created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [userId, ...values]);
      if (result.rows.length === 0) throw new NotFoundError('VetProfile', userId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error updating vet profile', { originalError: error });
    }
  }
}

export default new VetProfileService();
