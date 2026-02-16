import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface VetProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  specializations: string[];
  qualifications: string[];
  yearsOfExperience: number;
  bio?: string;
  clinicName?: string;
  clinicAddress?: string;
  consultationFee: number;
  currency: string;
  isVerified: boolean;
  isAvailable: boolean;
  acceptsEmergency: boolean;
  availableDays: string;
  availableHoursStart: string;
  availableHoursEnd: string;
  languages: string[];
  rating: number;
  totalReviews: number;
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
  specializations?: string[];
  qualifications?: string[];
  yearsOfExperience?: number;
  bio?: string;
  clinicName?: string;
  clinicAddress?: string;
  consultationFee?: number;
  currency?: string;
  isAvailable?: boolean;
  acceptsEmergency?: boolean;
  availableDays?: string;
  availableHoursStart?: string;
  availableHoursEnd?: string;
  languages?: string[];
}

export class VetProfileService {
  async createProfile(userId: string, data: VetProfileCreateDTO): Promise<VetProfile> {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO vet_profiles (id, user_id, license_number, specializations, qualifications,
          years_of_experience, bio, clinic_name, clinic_address, consultation_fee, currency,
          is_available, accepts_emergency, available_days, available_hours_start, available_hours_end,
          languages, is_verified, rating, total_reviews, total_consultations)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,false,0.00,0,0)
        RETURNING id, user_id as "userId", license_number as "licenseNumber",
                  specializations, qualifications,
                  years_of_experience as "yearsOfExperience", bio,
                  clinic_name as "clinicName", clinic_address as "clinicAddress",
                  consultation_fee as "consultationFee", currency,
                  is_verified as "isVerified", is_available as "isAvailable",
                  accepts_emergency as "acceptsEmergency",
                  available_days as "availableDays",
                  available_hours_start as "availableHoursStart",
                  available_hours_end as "availableHoursEnd",
                  languages, rating, total_reviews as "totalReviews",
                  total_consultations as "totalConsultations",
                  created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [
        id, userId, data.licenseNumber,
        data.specializations || [],
        data.qualifications || [],
        data.yearsOfExperience || 0,
        data.bio || null,
        data.clinicName || null,
        data.clinicAddress || null,
        data.consultationFee || 0,
        data.currency || 'USD',
        data.isAvailable !== false,
        data.acceptsEmergency || false,
        data.availableDays || 'Mon,Tue,Wed,Thu,Fri',
        data.availableHoursStart || '09:00',
        data.availableHoursEnd || '17:00',
        data.languages || ['English'],
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
        SELECT vp.id, vp.user_id as "userId", vp.license_number as "licenseNumber",
               vp.specializations, vp.qualifications,
               vp.years_of_experience as "yearsOfExperience", vp.bio,
               vp.clinic_name as "clinicName", vp.clinic_address as "clinicAddress",
               vp.consultation_fee as "consultationFee", vp.currency,
               vp.is_verified as "isVerified", vp.is_available as "isAvailable",
               vp.accepts_emergency as "acceptsEmergency",
               vp.available_days as "availableDays",
               vp.available_hours_start as "availableHoursStart",
               vp.available_hours_end as "availableHoursEnd",
               vp.languages, vp.rating, vp.total_reviews as "totalReviews",
               vp.total_consultations as "totalConsultations",
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
        SELECT vp.id, vp.user_id as "userId", vp.license_number as "licenseNumber",
               vp.specializations, vp.qualifications,
               vp.years_of_experience as "yearsOfExperience", vp.bio,
               vp.clinic_name as "clinicName", vp.consultation_fee as "consultationFee",
               vp.currency, vp.is_verified as "isVerified",
               vp.is_available as "isAvailable", vp.accepts_emergency as "acceptsEmergency",
               vp.languages, vp.rating, vp.total_reviews as "totalReviews",
               vp.total_consultations as "totalConsultations",
               u.first_name as "firstName", u.last_name as "lastName", u.email,
               vp.created_at as "createdAt", vp.updated_at as "updatedAt"
        FROM vet_profiles vp JOIN users u ON u.id = vp.user_id
        WHERE u.is_active = true
      `;
      const params: any[] = [];
      let idx = 0;

      if (specialization) {
        idx++;
        query += ` AND $${idx} = ANY(vp.specializations)`;
        params.push(specialization);
      }

      const countQuery = `SELECT COUNT(*) as count FROM vet_profiles vp JOIN users u ON u.id = vp.user_id WHERE u.is_active = true${specialization ? ` AND $1 = ANY(vp.specializations)` : ''}`;
      const countParams = specialization ? [specialization] : [];

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
        licenseNumber: 'license_number', specializations: 'specializations',
        qualifications: 'qualifications', yearsOfExperience: 'years_of_experience',
        bio: 'bio', clinicName: 'clinic_name', clinicAddress: 'clinic_address',
        consultationFee: 'consultation_fee', currency: 'currency',
        isAvailable: 'is_available', acceptsEmergency: 'accepts_emergency',
        availableDays: 'available_days', availableHoursStart: 'available_hours_start',
        availableHoursEnd: 'available_hours_end', languages: 'languages',
      };

      const entries = Object.entries(updates).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return this.getProfileByUserId(userId);

      const sets = entries.map(([key], i) => `${fieldMap[key] || key} = $${i + 2}`);
      const values = entries.map(([_, v]) => v);

      const query = `
        UPDATE vet_profiles SET ${sets.join(', ')}, updated_at = NOW()
        WHERE user_id = $1
        RETURNING id, user_id as "userId", license_number as "licenseNumber",
                  specializations, qualifications,
                  years_of_experience as "yearsOfExperience", bio,
                  clinic_name as "clinicName", consultation_fee as "consultationFee",
                  currency, is_verified as "isVerified",
                  is_available as "isAvailable", accepts_emergency as "acceptsEmergency",
                  rating, total_reviews as "totalReviews",
                  total_consultations as "totalConsultations",
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
