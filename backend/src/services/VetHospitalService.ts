import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import HospitalDocumentService from './HospitalDocumentService';

// ─── Interfaces ─────────────────────────────────────────────

export interface VetHospital {
  id: string;
  name: string;
  tagline?: string;
  hospitalType: string;
  registrationNumber?: string;
  accreditationBody?: string;
  accreditationNumber?: string;
  accreditationExpiry?: Date;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  phone?: string;
  emergencyPhone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  establishedYear?: number;
  totalBeds: number;
  icuBeds: number;
  is24Hours: boolean;
  hasEmergency: boolean;
  hasAmbulance: boolean;
  hasPharmacy: boolean;
  hasLab: boolean;
  hasImaging: boolean;
  hasSurgery: boolean;
  hasIcu: boolean;
  specializations: string[];
  facilities: string[];
  acceptedSpecies: string[];
  operatingHours: any;
  ownerId: string;
  isVerified: boolean;
  isActive: boolean;
  verificationStatus: string;
  drugLicenseExpiry?: string | null;
  tradeLicenseExpiry?: string | null;
  registrationRenewalDate?: string | null;
  rating: number;
  totalReviews: number;
  totalConsultations: number;
  createdAt: Date;
  updatedAt: Date;
  // computed
  ownerName?: string;
  doctorCount?: number;
  departmentCount?: number;
  isNetworkBranch?: boolean;
  branchNetworkId?: string | null;
}

export interface HospitalDepartment {
  id: string;
  hospitalId: string;
  name: string;
  code?: string;
  description?: string;
  specializations: string[];
  floorNumber?: string;
  roomNumbers?: string;
  headDoctorId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // joined
  headDoctorName?: string;
  doctorCount?: number;
}

export interface HospitalDoctor {
  id: string;
  hospitalId: string;
  doctorId: string;
  departmentId?: string;
  hospitalRole: string;
  title?: string;
  employmentType: string;
  isPrimaryHospital: boolean;
  consultationFee?: number;
  isAcceptingPatients: boolean;
  joinedAt: Date;
  endsAt?: Date;
  isActive: boolean;
  // joined
  doctorName?: string;
  doctorEmail?: string;
  departmentName?: string;
  specializations?: string[];
  profileImage?: string;
  licenseNumber?: string;
  yearsOfExperience?: number;
  vetProfileRating?: number;
}

export interface HospitalService {
  id: string;
  hospitalId: string;
  serviceName: string;
  category: string;
  description?: string;
  priceMin?: number;
  priceMax?: number;
  currency: string;
  durationMinutes?: number;
  requiresAppointment: boolean;
  isAvailable: boolean;
  createdAt: Date;
}

// ─── DTOs ───────────────────────────────────────────────────

export interface CreateHospitalDTO {
  name: string;
  tagline?: string;
  hospitalType: string;
  registrationNumber?: string;
  accreditationBody?: string;
  accreditationNumber?: string;
  accreditationExpiry?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  phone?: string;
  emergencyPhone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  establishedYear?: number;
  totalBeds?: number;
  icuBeds?: number;
  is24Hours?: boolean;
  hasEmergency?: boolean;
  hasAmbulance?: boolean;
  hasPharmacy?: boolean;
  hasLab?: boolean;
  hasImaging?: boolean;
  hasSurgery?: boolean;
  hasIcu?: boolean;
  specializations?: string[];
  facilities?: string[];
  acceptedSpecies?: string[];
  operatingHours?: any;
}

// ─── VetHospitalService ─────────────────────────────────────

export class VetHospitalService {

  // ─── Schema Setup ─────────────────────────────────────────
  async ensureTables(): Promise<void> {
    try {
      await database.query(`
        CREATE TABLE IF NOT EXISTS vet_hospitals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          hospital_type VARCHAR(50) NOT NULL DEFAULT 'multi_specialty'
            CHECK (hospital_type IN (
              'multi_specialty','specialty','clinic','emergency_center',
              'mobile_vet','research','teaching','other'
            )),
          tagline VARCHAR(500),
          registration_number VARCHAR(100),
          accreditation_body VARCHAR(100),
          accreditation_number VARCHAR(100),
          accreditation_expiry DATE,
          description TEXT,
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100) DEFAULT 'US',
          postal_code VARCHAR(20),
          gps_latitude DECIMAL(10,7),
          gps_longitude DECIMAL(10,7),
          phone VARCHAR(30),
          emergency_phone VARCHAR(30),
          email VARCHAR(255),
          website VARCHAR(500),
          logo_url VARCHAR(500),
          cover_image_url VARCHAR(500),
          established_year INTEGER,
          total_beds INTEGER DEFAULT 0,
          icu_beds INTEGER DEFAULT 0,
          is_24_hours BOOLEAN DEFAULT false,
          has_emergency BOOLEAN DEFAULT false,
          has_ambulance BOOLEAN DEFAULT false,
          has_pharmacy BOOLEAN DEFAULT false,
          has_lab BOOLEAN DEFAULT false,
          has_imaging BOOLEAN DEFAULT false,
          has_surgery BOOLEAN DEFAULT false,
          has_icu BOOLEAN DEFAULT false,
          specializations TEXT[] DEFAULT '{}',
          facilities TEXT[] DEFAULT '{}',
          accepted_species TEXT[] DEFAULT '{}',
          operating_hours JSONB DEFAULT '{}',
          owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          is_verified BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          rating DECIMAL(3,2) DEFAULT 0,
          total_reviews INTEGER DEFAULT 0,
          total_consultations INTEGER DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hospital_departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(20),
          description TEXT,
          specializations TEXT[] DEFAULT '{}',
          floor_number VARCHAR(20),
          room_numbers VARCHAR(100),
          head_doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hospital_id, name)
        );

        CREATE TABLE IF NOT EXISTS hospital_doctors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
          doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          department_id UUID REFERENCES hospital_departments(id) ON DELETE SET NULL,
          hospital_role VARCHAR(50) NOT NULL DEFAULT 'doctor'
            CHECK (hospital_role IN (
              'owner','medical_director','department_head',
              'consultant','resident','intern','staff','visiting'
            )),
          title VARCHAR(100),
          employment_type VARCHAR(30) DEFAULT 'full_time'
            CHECK (employment_type IN ('full_time','part_time','contract','visiting','honorary')),
          is_primary_hospital BOOLEAN DEFAULT false,
          consultation_fee DECIMAL(10,2),
          is_accepting_patients BOOLEAN DEFAULT true,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ends_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hospital_id, doctor_id)
        );

        CREATE TABLE IF NOT EXISTS hospital_services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
          service_name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT 'consultation'
            CHECK (category IN (
              'consultation','diagnostics','surgery','vaccination',
              'dental','grooming','boarding','emergency',
              'rehabilitation','nutrition','reproduction','other'
            )),
          description TEXT,
          price_min DECIMAL(10,2),
          price_max DECIMAL(10,2),
          currency VARCHAR(10) DEFAULT 'USD',
          duration_minutes INTEGER,
          requires_appointment BOOLEAN DEFAULT true,
          is_available BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_vet_hospitals_owner ON vet_hospitals(owner_id);
        CREATE INDEX IF NOT EXISTS idx_vet_hospitals_city ON vet_hospitals(city);
        CREATE INDEX IF NOT EXISTS idx_vet_hospitals_active ON vet_hospitals(is_active);
        CREATE INDEX IF NOT EXISTS idx_hospital_doctors_hospital ON hospital_doctors(hospital_id);
        CREATE INDEX IF NOT EXISTS idx_hospital_doctors_doctor ON hospital_doctors(doctor_id);
        CREATE INDEX IF NOT EXISTS idx_hospital_departments_hospital ON hospital_departments(hospital_id);
      `);

      // Add hospital_id FK to bookings (links bookings to hospitals)
      await database.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES vet_hospitals(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_bookings_hospital ON bookings(hospital_id) WHERE hospital_id IS NOT NULL;
      `);

      // Bootstrap document tables / columns
      await HospitalDocumentService.ensureTables();

      // Hospital invites table
      await database.query(`
        CREATE TABLE IF NOT EXISTS hospital_invites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          phone VARCHAR(20),
          invite_token VARCHAR(128) NOT NULL UNIQUE,
          hospital_role VARCHAR(50) DEFAULT 'staff',
          department_id UUID REFERENCES hospital_departments(id) ON DELETE SET NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
          invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
          expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_hospital_invites_token ON hospital_invites(invite_token);
        CREATE INDEX IF NOT EXISTS idx_hospital_invites_hospital ON hospital_invites(hospital_id);
      `);

      logger.info('VetHospital tables ensured');
    } catch (error: any) {
      logger.error('Failed to ensure VetHospital tables', { error: error.message });
      throw error;
    }
  }

  // ─── Hospital CRUD ─────────────────────────────────────────

  async createHospital(ownerId: string, data: CreateHospitalDTO): Promise<VetHospital> {
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO vet_hospitals (
          id, name, tagline, hospital_type, registration_number, accreditation_body,
          accreditation_number, accreditation_expiry, description, address, city,
          state, country, postal_code, gps_latitude, gps_longitude,
          phone, emergency_phone, email, website, logo_url, cover_image_url,
          established_year, total_beds, icu_beds,
          is_24_hours, has_emergency, has_ambulance, has_pharmacy, has_lab,
          has_imaging, has_surgery, has_icu,
          specializations, facilities, accepted_species, operating_hours, owner_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
          $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38
        ) RETURNING *`,
        [
          id, data.name, data.tagline || null, data.hospitalType || 'multi_specialty',
          data.registrationNumber, data.accreditationBody, data.accreditationNumber,
          data.accreditationExpiry || null, data.description,
          data.address, data.city, data.state, data.country || 'US',
          data.postalCode, data.gpsLatitude, data.gpsLongitude,
          data.phone, data.emergencyPhone, data.email, data.website,
          data.logoUrl, data.coverImageUrl, data.establishedYear,
          data.totalBeds || 0, data.icuBeds || 0,
          data.is24Hours || false, data.hasEmergency || false,
          data.hasAmbulance || false, data.hasPharmacy || false,
          data.hasLab || false, data.hasImaging || false,
          data.hasSurgery || false, data.hasIcu || false,
          data.specializations || [], data.facilities || [],
          data.acceptedSpecies || [], data.operatingHours || {},
          ownerId
        ]
      );

      // Auto-add owner as hospital doctor with owner role
      await database.query(
        `INSERT INTO hospital_doctors (id, hospital_id, doctor_id, hospital_role, is_primary_hospital)
         VALUES ($1,$2,$3,'owner',true)`,
        [uuidv4(), id, ownerId]
      );

      logger.info(`Vet hospital created: ${data.name}`, { hospitalId: id, ownerId });
      return this.mapHospitalRow(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') throw new DatabaseError('A hospital with this registration number already exists');
      logger.error('Failed to create vet hospital', { error: error.message });
      throw new DatabaseError('Failed to create vet hospital');
    }
  }

  async getHospital(id: string): Promise<VetHospital> {
    const result = await database.query(
      `SELECT h.*,
              u.first_name || ' ' || u.last_name AS owner_name,
              (SELECT COUNT(*) FROM hospital_doctors WHERE hospital_id = h.id AND is_active = true) AS doctor_count,
              (SELECT COUNT(*) FROM hospital_departments WHERE hospital_id = h.id AND is_active = true) AS department_count
       FROM vet_hospitals h
       JOIN users u ON h.owner_id = u.id
       WHERE h.id = $1`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError('Vet hospital not found');
    return this.mapHospitalRow(result.rows[0]);
  }

  async listHospitals(filters: {
    search?: string; city?: string; hospitalType?: string; specialization?: string;
    hasEmergency?: boolean; is24Hours?: boolean; isVerified?: boolean;
    limit?: number; offset?: number; userId?: string;
  }): Promise<{ hospitals: VetHospital[]; total: number }> {
    const { search, city, hospitalType, specialization, hasEmergency, is24Hours, isVerified, userId } = filters;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // Check if the requesting user is a network member — if so, show only their network's hospitals
    let networkHospitalIds: string[] | null = null;
    if (userId) {
      const memberCheck = await database.query(
        `SELECT hnm.network_id, hnh.hospital_id
         FROM hospital_network_members hnm
         JOIN hospital_network_hospitals hnh ON hnh.network_id = hnm.network_id
         WHERE hnm.user_id = $1 AND hnm.is_active = true`,
        [userId]
      );
      if (memberCheck.rows.length > 0) {
        networkHospitalIds = memberCheck.rows.map((r: any) => r.hospital_id);
      }
    }

    const conditions: string[] = ['h.is_active = true'];
    if (networkHospitalIds && networkHospitalIds.length > 0) {
      // Network member: show ONLY their network's branch hospitals
      conditions.push(`h.id = ANY($1::uuid[])`);
    } else {
      // Non-network user: show only public (non-branch) hospitals
      conditions.push('(h.is_network_branch = false OR h.is_network_branch IS NULL)');
    }
    const params: any[] = networkHospitalIds && networkHospitalIds.length > 0 ? [networkHospitalIds] : [];
    let idx = params.length + 1;
    if (search) { conditions.push(`(h.name ILIKE $${idx} OR h.description ILIKE $${idx} OR h.city ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (city) { conditions.push(`h.city ILIKE $${idx}`); params.push(`%${city}%`); idx++; }
    if (hospitalType) { conditions.push(`h.hospital_type = $${idx}`); params.push(hospitalType); idx++; }
    if (specialization) { conditions.push(`$${idx} = ANY(h.specializations)`); params.push(specialization); idx++; }
    if (hasEmergency) { conditions.push(`h.has_emergency = true`); }
    if (is24Hours) { conditions.push(`h.is_24_hours = true`); }
    if (isVerified) { conditions.push(`h.is_verified = true`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database.query(`SELECT COUNT(*) FROM vet_hospitals h ${where}`, params);
    const rows = await database.query(
      `SELECT h.*,
              u.first_name || ' ' || u.last_name AS owner_name,
              (SELECT COUNT(*) FROM hospital_doctors WHERE hospital_id = h.id AND is_active = true) AS doctor_count,
              (SELECT COUNT(*) FROM hospital_departments WHERE hospital_id = h.id AND is_active = true) AS department_count
       FROM vet_hospitals h
       JOIN users u ON h.owner_id = u.id
       ${where}
       ORDER BY h.is_verified DESC, h.rating DESC, h.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return {
      hospitals: rows.rows.map((r: any) => this.mapHospitalRow(r)),
      total: parseInt(countResult.rows[0].count),
    };
  }

  async listHospitalsForVet(vetId: string): Promise<VetHospital[]> {
    // Union: hospitals where user is a doctor OR a network member (staff) OR has a staff_position.
    // IMPORTANT: branch_network_id is derived via COALESCE(h.branch_network_id, hnm.network_id)
    // so that network staff always see the correct networkId even when the hospital row's
    // branch_network_id column was not set (e.g., hospitals enrolled without createBranchHospital).
    const result = await database.query(
      `SELECT DISTINCT ON (h.id) h.*,
              u.first_name || ' ' || u.last_name AS owner_name,
              COALESCE(hd.hospital_role, sp.position, hnm.network_role, 'staff') AS hospital_role,
              COALESCE(hd.title, sp.department, '') AS title,
              COALESCE(hd.is_primary_hospital, false) AS is_primary_hospital,
              (SELECT COUNT(*) FROM hospital_doctors WHERE hospital_id = h.id AND is_active = true) AS doctor_count,
              (SELECT COUNT(*) FROM hospital_departments WHERE hospital_id = h.id AND is_active = true) AS department_count,
              COALESCE(h.branch_network_id, hnm.network_id) AS branch_network_id,
              (h.is_network_branch = true OR hnm.id IS NOT NULL) AS is_network_branch
       FROM vet_hospitals h
       JOIN users u ON h.owner_id = u.id
       LEFT JOIN hospital_doctors hd ON hd.hospital_id = h.id AND hd.doctor_id = $1 AND hd.is_active = true
       LEFT JOIN staff_positions sp ON sp.hospital_id = h.id AND sp.user_id = $1 AND sp.is_active = true
       LEFT JOIN hospital_network_members hnm ON hnm.hospital_id = h.id AND hnm.user_id = $1 AND hnm.is_active = true
       WHERE h.is_active = true
         AND (hd.id IS NOT NULL OR sp.id IS NOT NULL OR hnm.id IS NOT NULL)
       ORDER BY h.id, hd.is_primary_hospital DESC NULLS LAST, h.name ASC`,
      [vetId]
    );
    return result.rows.map((r: any) => this.mapHospitalRow(r));
  }

  async updateHospital(id: string, data: Partial<CreateHospitalDTO>): Promise<VetHospital> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      name: 'name', tagline: 'tagline', hospitalType: 'hospital_type', registrationNumber: 'registration_number',
      accreditationBody: 'accreditation_body', accreditationNumber: 'accreditation_number',
      accreditationExpiry: 'accreditation_expiry', description: 'description',
      address: 'address', city: 'city', state: 'state', country: 'country',
      postalCode: 'postal_code', gpsLatitude: 'gps_latitude', gpsLongitude: 'gps_longitude',
      phone: 'phone', emergencyPhone: 'emergency_phone', email: 'email',
      website: 'website', logoUrl: 'logo_url', coverImageUrl: 'cover_image_url',
      establishedYear: 'established_year', totalBeds: 'total_beds', icuBeds: 'icu_beds',
      is24Hours: 'is_24_hours', hasEmergency: 'has_emergency', hasAmbulance: 'has_ambulance',
      hasPharmacy: 'has_pharmacy', hasLab: 'has_lab', hasImaging: 'has_imaging',
      hasSurgery: 'has_surgery', hasIcu: 'has_icu',
      specializations: 'specializations', facilities: 'facilities',
      acceptedSpecies: 'accepted_species', operatingHours: 'operating_hours',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${col} = $${idx}`);
        params.push((data as any)[key]);
        idx++;
      }
    }
    if (!fields.length) throw new DatabaseError('No fields to update');
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const result = await database.query(
      `UPDATE vet_hospitals SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!result.rows[0]) throw new NotFoundError('Vet hospital not found');
    return this.mapHospitalRow(result.rows[0]);
  }

  async deleteHospital(id: string): Promise<void> {
    await database.query(`UPDATE vet_hospitals SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  async verifyHospital(id: string, verified: boolean): Promise<VetHospital> {
    const result = await database.query(
      `UPDATE vet_hospitals SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [verified, id]
    );
    if (!result.rows[0]) throw new NotFoundError('Vet hospital not found');
    return this.mapHospitalRow(result.rows[0]);
  }

  // ─── Membership Management ─────────────────────────────────

  async getMemberRole(hospitalId: string, userId: string): Promise<string | null> {
    const result = await database.query(
      `SELECT hospital_role FROM hospital_doctors WHERE hospital_id = $1 AND doctor_id = $2 AND is_active = true`,
      [hospitalId, userId]
    );
    return result.rows[0]?.hospital_role || null;
  }

  async isAdminOrOwner(hospitalId: string, userId: string, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    const role = await this.getMemberRole(hospitalId, userId);
    return role === 'owner' || role === 'medical_director';
  }

  async addDoctor(hospitalId: string, data: {
    doctorId: string; departmentId?: string; hospitalRole?: string; title?: string;
    employmentType?: string; isPrimaryHospital?: boolean; consultationFee?: number;
  }): Promise<HospitalDoctor> {
    // Verify doctor is a veterinarian
    const vet = await database.query(`SELECT role FROM users WHERE id = $1 AND role = 'veterinarian'`, [data.doctorId]);
    if (!vet.rows[0]) throw new DatabaseError('User is not a veterinarian');

    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO hospital_doctors (id, hospital_id, doctor_id, department_id, hospital_role, title,
         employment_type, is_primary_hospital, consultation_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (hospital_id, doctor_id) DO UPDATE
         SET hospital_role = EXCLUDED.hospital_role, title = EXCLUDED.title,
             employment_type = EXCLUDED.employment_type, is_active = true,
             consultation_fee = EXCLUDED.consultation_fee, updated_at = NOW()
       RETURNING *`,
      [id, hospitalId, data.doctorId, data.departmentId || null,
       data.hospitalRole || 'doctor', data.title,
       data.employmentType || 'full_time', data.isPrimaryHospital || false,
       data.consultationFee || null]
    );
    return this.mapDoctorRow(result.rows[0]);
  }

  async removeDoctor(hospitalId: string, doctorId: string): Promise<void> {
    await database.query(
      `UPDATE hospital_doctors SET is_active = false, updated_at = NOW()
       WHERE hospital_id = $1 AND doctor_id = $2`,
      [hospitalId, doctorId]
    );
  }

  async updateDoctor(hospitalId: string, doctorId: string, data: {
    hospitalRole?: string; title?: string; departmentId?: string;
    employmentType?: string; isPrimaryHospital?: boolean;
    consultationFee?: number; isAcceptingPatients?: boolean;
  }): Promise<HospitalDoctor> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.hospitalRole !== undefined) { fields.push(`hospital_role = $${idx}`); params.push(data.hospitalRole); idx++; }
    if (data.title !== undefined) { fields.push(`title = $${idx}`); params.push(data.title); idx++; }
    if (data.departmentId !== undefined) { fields.push(`department_id = $${idx}`); params.push(data.departmentId || null); idx++; }
    if (data.employmentType !== undefined) { fields.push(`employment_type = $${idx}`); params.push(data.employmentType); idx++; }
    if (data.isPrimaryHospital !== undefined) { fields.push(`is_primary_hospital = $${idx}`); params.push(data.isPrimaryHospital); idx++; }
    if (data.consultationFee !== undefined) { fields.push(`consultation_fee = $${idx}`); params.push(data.consultationFee); idx++; }
    if (data.isAcceptingPatients !== undefined) { fields.push(`is_accepting_patients = $${idx}`); params.push(data.isAcceptingPatients); idx++; }
    if (!fields.length) throw new DatabaseError('No fields to update');
    fields.push(`updated_at = NOW()`);
    params.push(hospitalId, doctorId);
    const result = await database.query(
      `UPDATE hospital_doctors SET ${fields.join(', ')} WHERE hospital_id = $${idx} AND doctor_id = $${idx + 1} RETURNING *`,
      params
    );
    if (!result.rows[0]) throw new NotFoundError('Doctor not found in hospital');
    return this.mapDoctorRow(result.rows[0]);
  }

  async listDoctors(hospitalId: string): Promise<HospitalDoctor[]> {
    const result = await database.query(
      `SELECT hd.*,
              u.first_name || ' ' || u.last_name AS doctor_name,
              u.email AS doctor_email,
              u.avatar_url AS profile_image,
              vp.specializations, vp.license_number, vp.years_of_experience,
              vp.rating AS vet_profile_rating,
              dept.name AS department_name
       FROM hospital_doctors hd
       JOIN users u ON hd.doctor_id = u.id
       LEFT JOIN vet_profiles vp ON vp.user_id = hd.doctor_id
       LEFT JOIN hospital_departments dept ON hd.department_id = dept.id
       WHERE hd.hospital_id = $1 AND hd.is_active = true
       ORDER BY
         CASE hd.hospital_role
           WHEN 'owner' THEN 1 WHEN 'medical_director' THEN 2
           WHEN 'department_head' THEN 3 WHEN 'consultant' THEN 4
           ELSE 5 END, u.first_name`,
      [hospitalId]
    );
    return result.rows.map((r: any) => this.mapDoctorRow(r));
  }

  async getHospitalForDoctor(doctorId: string): Promise<VetHospital | null> {
    const result = await database.query(
      `SELECT h.*, u.first_name || ' ' || u.last_name AS owner_name,
              hd.hospital_role
       FROM vet_hospitals h
       JOIN users u ON h.owner_id = u.id
       JOIN hospital_doctors hd ON hd.hospital_id = h.id AND hd.doctor_id = $1 AND hd.is_active = true
       WHERE h.is_active = true AND hd.is_primary_hospital = true
       LIMIT 1`,
      [doctorId]
    );
    if (!result.rows[0]) return null;
    return this.mapHospitalRow(result.rows[0]);
  }

  // ─── Departments ───────────────────────────────────────────

  async createDepartment(hospitalId: string, data: {
    name: string; code?: string; description?: string; specializations?: string[];
    floorNumber?: string; roomNumbers?: string; headDoctorId?: string;
  }): Promise<HospitalDepartment> {
    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO hospital_departments (id, hospital_id, name, code, description, specializations, floor_number, room_numbers, head_doctor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, hospitalId, data.name, data.code, data.description,
       data.specializations || [], data.floorNumber, data.roomNumbers, data.headDoctorId || null]
    );
    return this.mapDeptRow(result.rows[0]);
  }

  async listDepartments(hospitalId: string): Promise<HospitalDepartment[]> {
    const result = await database.query(
      `SELECT dept.*,
              u.first_name || ' ' || u.last_name AS head_doctor_name,
              (SELECT COUNT(*) FROM hospital_doctors WHERE department_id = dept.id AND is_active = true) AS doctor_count
       FROM hospital_departments dept
       LEFT JOIN users u ON dept.head_doctor_id = u.id
       WHERE dept.hospital_id = $1 AND dept.is_active = true
       ORDER BY dept.name`,
      [hospitalId]
    );
    return result.rows.map((r: any) => this.mapDeptRow(r));
  }

  async updateDepartment(id: string, data: Partial<{
    name: string; code: string; description: string; specializations: string[];
    floorNumber: string; roomNumbers: string; headDoctorId: string;
  }>): Promise<HospitalDepartment> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.name !== undefined) { fields.push(`name = $${idx}`); params.push(data.name); idx++; }
    if (data.code !== undefined) { fields.push(`code = $${idx}`); params.push(data.code); idx++; }
    if (data.description !== undefined) { fields.push(`description = $${idx}`); params.push(data.description); idx++; }
    if (data.specializations !== undefined) { fields.push(`specializations = $${idx}`); params.push(data.specializations); idx++; }
    if (data.floorNumber !== undefined) { fields.push(`floor_number = $${idx}`); params.push(data.floorNumber); idx++; }
    if (data.roomNumbers !== undefined) { fields.push(`room_numbers = $${idx}`); params.push(data.roomNumbers); idx++; }
    if (data.headDoctorId !== undefined) { fields.push(`head_doctor_id = $${idx}`); params.push(data.headDoctorId || null); idx++; }
    if (!fields.length) throw new DatabaseError('No fields to update');
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const result = await database.query(
      `UPDATE hospital_departments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    if (!result.rows[0]) throw new NotFoundError('Department not found');
    return this.mapDeptRow(result.rows[0]);
  }

  async deleteDepartment(id: string): Promise<void> {
    await database.query(`UPDATE hospital_departments SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  // ─── Services ─────────────────────────────────────────────

  async addService(hospitalId: string, data: {
    serviceName: string; category: string; description?: string;
    priceMin?: number; priceMax?: number; currency?: string;
    durationMinutes?: number; requiresAppointment?: boolean;
  }): Promise<HospitalService> {
    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO hospital_services (id, hospital_id, service_name, category, description, price_min, price_max, currency, duration_minutes, requires_appointment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, hospitalId, data.serviceName, data.category, data.description,
       data.priceMin || null, data.priceMax || null, data.currency || 'USD',
       data.durationMinutes || null, data.requiresAppointment !== false]
    );
    return this.mapServiceRow(result.rows[0]);
  }

  async listServices(hospitalId: string): Promise<HospitalService[]> {
    const result = await database.query(
      `SELECT * FROM hospital_services WHERE hospital_id = $1 AND is_available = true ORDER BY category, service_name`,
      [hospitalId]
    );
    return result.rows.map((r: any) => this.mapServiceRow(r));
  }

  async updateService(id: string, data: Partial<{
    serviceName: string; category: string; description: string;
    priceMin: number; priceMax: number; currency: string;
    durationMinutes: number; requiresAppointment: boolean; isAvailable: boolean;
  }>): Promise<HospitalService> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      serviceName: 'service_name', category: 'category', description: 'description',
      priceMin: 'price_min', priceMax: 'price_max', currency: 'currency',
      durationMinutes: 'duration_minutes', requiresAppointment: 'requires_appointment',
      isAvailable: 'is_available',
    };
    for (const [key, col] of Object.entries(map)) {
      if ((data as any)[key] !== undefined) { fields.push(`${col} = $${idx}`); params.push((data as any)[key]); idx++; }
    }
    if (!fields.length) throw new DatabaseError('No fields to update');
    params.push(id);
    const result = await database.query(
      `UPDATE hospital_services SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    if (!result.rows[0]) throw new NotFoundError('Service not found');
    return this.mapServiceRow(result.rows[0]);
  }

  async deleteService(id: string): Promise<void> {
    await database.query(`UPDATE hospital_services SET is_available = false WHERE id = $1`, [id]);
  }

  // ─── Stats ────────────────────────────────────────────────

  async getHospitalStats(hospitalId: string): Promise<any> {
    const [doctors, depts, services] = await Promise.all([
      database.query(`SELECT hospital_role, COUNT(*) as count FROM hospital_doctors WHERE hospital_id = $1 AND is_active = true GROUP BY hospital_role`, [hospitalId]),
      database.query(`SELECT COUNT(*) as count FROM hospital_departments WHERE hospital_id = $1 AND is_active = true`, [hospitalId]),
      database.query(`SELECT category, COUNT(*) as count FROM hospital_services WHERE hospital_id = $1 AND is_available = true GROUP BY category`, [hospitalId]),
    ]);
    return {
      totalDoctors: doctors.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0),
      doctorsByRole: doctors.rows.reduce((acc: any, r: any) => { acc[r.hospital_role] = parseInt(r.count); return acc; }, {}),
      totalDepartments: parseInt(depts.rows[0]?.count || '0'),
      servicesByCategory: services.rows.reduce((acc: any, r: any) => { acc[r.category] = parseInt(r.count); return acc; }, {}),
      totalServices: services.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0),
    };
  }

  async getAdminStats(): Promise<any> {
    const result = await database.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as total,
        COUNT(*) FILTER (WHERE is_verified = true AND is_active = true) as verified,
        COUNT(*) FILTER (WHERE is_active = true AND created_at > NOW() - INTERVAL '30 days') as new_this_month,
        ROUND(AVG(rating) FILTER (WHERE is_active = true AND rating > 0), 2) as avg_rating,
        COUNT(*) FILTER (WHERE hospital_type = 'multi_specialty' AND is_active = true) as multi_specialty,
        COUNT(*) FILTER (WHERE hospital_type = 'emergency_center' AND is_active = true) as emergency_centers
      FROM vet_hospitals
    `);
    return result.rows[0];
  }

  // ─── Row Mappers ───────────────────────────────────────────

  private mapHospitalRow(row: any): VetHospital {
    return {
      id: row.id, name: row.name, tagline: row.tagline, hospitalType: row.hospital_type,
      registrationNumber: row.registration_number, accreditationBody: row.accreditation_body,
      accreditationNumber: row.accreditation_number, accreditationExpiry: row.accreditation_expiry,
      description: row.description, address: row.address, city: row.city,
      state: row.state, country: row.country, postalCode: row.postal_code,
      gpsLatitude: row.gps_latitude ? parseFloat(row.gps_latitude) : undefined,
      gpsLongitude: row.gps_longitude ? parseFloat(row.gps_longitude) : undefined,
      phone: row.phone, emergencyPhone: row.emergency_phone, email: row.email,
      website: row.website, logoUrl: row.logo_url, coverImageUrl: row.cover_image_url,
      establishedYear: row.established_year,
      totalBeds: parseInt(row.total_beds) || 0, icuBeds: parseInt(row.icu_beds) || 0,
      is24Hours: row.is_24_hours, hasEmergency: row.has_emergency,
      hasAmbulance: row.has_ambulance, hasPharmacy: row.has_pharmacy,
      hasLab: row.has_lab, hasImaging: row.has_imaging,
      hasSurgery: row.has_surgery, hasIcu: row.has_icu,
      specializations: row.specializations || [], facilities: row.facilities || [],
      acceptedSpecies: row.accepted_species || [], operatingHours: row.operating_hours || {},
      ownerId: row.owner_id, isVerified: row.is_verified, isActive: row.is_active,
      verificationStatus: row.verification_status || 'pending_documents',
      drugLicenseExpiry: row.drug_license_expiry || null,
      tradeLicenseExpiry: row.trade_license_expiry || null,
      registrationRenewalDate: row.registration_renewal_date || null,
      rating: parseFloat(row.rating) || 0, totalReviews: parseInt(row.total_reviews) || 0,
      totalConsultations: parseInt(row.total_consultations) || 0,
      createdAt: row.created_at, updatedAt: row.updated_at,
      ownerName: row.owner_name,
      doctorCount: row.doctor_count !== undefined ? parseInt(row.doctor_count) : undefined,
      departmentCount: row.department_count !== undefined ? parseInt(row.department_count) : undefined,
      isNetworkBranch: row.is_network_branch || false,
      branchNetworkId: row.branch_network_id || null,
    };
  }

  private mapDoctorRow(row: any): HospitalDoctor {
    return {
      id: row.id, hospitalId: row.hospital_id, doctorId: row.doctor_id,
      departmentId: row.department_id, hospitalRole: row.hospital_role,
      title: row.title, employmentType: row.employment_type,
      isPrimaryHospital: row.is_primary_hospital,
      consultationFee: row.consultation_fee ? parseFloat(row.consultation_fee) : undefined,
      isAcceptingPatients: row.is_accepting_patients,
      joinedAt: row.joined_at, endsAt: row.ends_at, isActive: row.is_active,
      doctorName: row.doctor_name, doctorEmail: row.doctor_email,
      departmentName: row.department_name, specializations: row.specializations,
      profileImage: row.profile_image, licenseNumber: row.license_number,
      yearsOfExperience: row.years_of_experience,
      vetProfileRating: row.vet_profile_rating ? parseFloat(row.vet_profile_rating) : undefined,
    };
  }

  private mapDeptRow(row: any): HospitalDepartment {
    return {
      id: row.id, hospitalId: row.hospital_id, name: row.name, code: row.code,
      description: row.description, specializations: row.specializations || [],
      floorNumber: row.floor_number, roomNumbers: row.room_numbers,
      headDoctorId: row.head_doctor_id, isActive: row.is_active,
      createdAt: row.created_at, updatedAt: row.updated_at,
      headDoctorName: row.head_doctor_name,
      doctorCount: row.doctor_count !== undefined ? parseInt(row.doctor_count) : undefined,
    };
  }

  private mapServiceRow(row: any): HospitalService {
    return {
      id: row.id, hospitalId: row.hospital_id, serviceName: row.service_name,
      category: row.category, description: row.description,
      priceMin: row.price_min ? parseFloat(row.price_min) : undefined,
      priceMax: row.price_max ? parseFloat(row.price_max) : undefined,
      currency: row.currency, durationMinutes: row.duration_minutes,
      requiresAppointment: row.requires_appointment,
      isAvailable: row.is_available, createdAt: row.created_at,
    };
  }

  // ─── Doctor Invites ────────────────────────────────────────

  async inviteDoctor(hospitalId: string, data: {
    email: string; firstName?: string; lastName?: string; phone?: string;
    hospitalRole?: string; departmentId?: string;
  }, invitedBy: string): Promise<any> {
    // Check if there's already a pending invite for this email+hospital
    const existing = await database.query(
      `SELECT id FROM hospital_invites WHERE hospital_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
      [hospitalId, data.email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      throw new ConflictError('An active invite already exists for this email');
    }

    // Check if user already exists and is already linked to this hospital
    const existingUser = await database.query(
      `SELECT u.id FROM users u JOIN hospital_doctors hd ON hd.doctor_id = u.id
       WHERE u.email = $1 AND hd.hospital_id = $2 AND hd.is_active = true`,
      [data.email.toLowerCase(), hospitalId]
    );
    if (existingUser.rows.length > 0) {
      throw new ConflictError('This user is already a doctor at this hospital');
    }

    const token = uuidv4() + '-' + uuidv4(); // long unique token
    const result = await database.query(
      `INSERT INTO hospital_invites (hospital_id, email, first_name, last_name, phone, invite_token, hospital_role, department_id, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [hospitalId, data.email.toLowerCase(), data.firstName || null, data.lastName || null,
       data.phone || null, token, data.hospitalRole || 'staff', data.departmentId || null, invitedBy]
    );

    // Send invite email (best-effort)
    try {
      const hospital = await this.getHospital(hospitalId);
      const EmailService = (await import('./EmailService')).default;
      const frontendUrl = (await import('../config')).getFrontendUrl();
      await EmailService.send({
        to: data.email,
        subject: `You're invited to join ${hospital.name} on VetConnect`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;">
            <h2 style="color:#1e3a5f;">You've Been Invited! 🎉</h2>
            <p><strong>${hospital.name}</strong> has invited you to join their veterinary team as <strong>${(data.hospitalRole || 'staff').replace(/_/g, ' ')}</strong>.</p>
            <p>Click the button below to set up your account and start:</p>
            <a href="${frontendUrl}/accept-invite?token=${token}"
               style="display:inline-block;background:#2563eb;color:#fff;padding:.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:700;margin:1rem 0;">
               Accept Invitation
            </a>
            <p style="color:#888;font-size:.85rem;margin-top:1rem;">This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.</p>
          </div>
        `
      });
      logger.info(`Invite email sent to ${data.email}`);
    } catch (err) {
      logger.warn('Failed to send invite email — share the invite link manually', { email: data.email, error: (err as any).message });
    }

    return result.rows[0];
  }

  async listInvites(hospitalId: string): Promise<any[]> {
    const result = await database.query(
      `SELECT hi.*, u.first_name || ' ' || u.last_name as invited_by_name
       FROM hospital_invites hi
       LEFT JOIN users u ON u.id = hi.invited_by
       WHERE hi.hospital_id = $1
       ORDER BY hi.created_at DESC`,
      [hospitalId]
    );
    return result.rows;
  }

  async revokeInvite(hospitalId: string, inviteId: string): Promise<void> {
    const result = await database.query(
      `UPDATE hospital_invites SET status = 'revoked', updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2 AND status = 'pending'`,
      [inviteId, hospitalId]
    );
    if (result.rowCount === 0) throw new NotFoundError('Invite not found or already processed');
  }

  async getInviteByToken(token: string): Promise<any> {
    const result = await database.query(
      `SELECT hi.*, vh.name as hospital_name, vh.city as hospital_city,
              vh.logo_url as hospital_logo_url, vh.hospital_type
       FROM hospital_invites hi
       JOIN vet_hospitals vh ON vh.id = hi.hospital_id
       WHERE hi.invite_token = $1`,
      [token]
    );
    if (result.rows.length === 0) throw new NotFoundError('Invalid invitation link');
    const invite = result.rows[0];
    if (invite.status !== 'pending') throw new ConflictError(`This invitation has already been ${invite.status}`);
    if (new Date(invite.expires_at) < new Date()) {
      await database.query(`UPDATE hospital_invites SET status = 'expired' WHERE id = $1`, [invite.id]);
      throw new ConflictError('This invitation has expired');
    }
    return invite;
  }

  async acceptInvite(token: string, password: string): Promise<{ user: any; hospital: any }> {
    const invite = await this.getInviteByToken(token);

    // Check if user already exists
    const existingUser = await database.query(`SELECT * FROM users WHERE email = $1`, [invite.email]);
    let userId: string;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Update role to veterinarian if not already
      if (existingUser.rows[0].role !== 'veterinarian') {
        await database.query(`UPDATE users SET role = 'veterinarian' WHERE id = $1`, [userId]);
      }
    } else {
      // Create new user
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);
      userId = uuidv4();
      await database.query(
        `INSERT INTO users (id, email, first_name, last_name, phone, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'veterinarian', true)`,
        [userId, invite.email, invite.first_name || 'Doctor', invite.last_name || '',
         invite.phone || '', passwordHash]
      );

      // Create vet profile
      try {
        await database.query(
          `INSERT INTO vet_profiles (user_id, license_number, specializations, years_of_experience, consultation_fee)
           VALUES ($1, '', '{}', 0, 0)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
      } catch { /* vet_profiles might not have ON CONFLICT, ignore */ }
    }

    // Link to hospital
    await this.addDoctor(invite.hospital_id, {
      doctorId: userId,
      hospitalRole: invite.hospital_role || 'staff',
      employmentType: 'full_time',
      departmentId: invite.department_id || undefined,
    });

    // Mark invite as accepted
    await database.query(
      `UPDATE hospital_invites SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
      [invite.id]
    );

    const hospital = await this.getHospital(invite.hospital_id);
    return { user: { id: userId, email: invite.email }, hospital };
  }

  // Walk-in registration for standalone (non-network) hospitals.
  // Creates a placeholder user account and animal record without needing a network context.
  async registerWalkInStandalone(data: {
    hospitalId: string; registeredBy: string;
    patientName: string; patientPhone?: string; patientEmail?: string; patientAddress?: string;
    animalName: string; animalSpecies: string; animalBreed?: string;
    animalGender?: string; animalDob?: string; animalWeight?: number;
    animalColor?: string; animalMicrochipId?: string; animalRegistrationNumber?: string;
    animalIsNeutered?: boolean; animalMedicalNotes?: string; animalAvatarUrl?: string;
    animalInsuranceProvider?: string; animalInsurancePolicyNumber?: string; animalInsuranceExpiry?: string;
    animalEarTagId?: string;
  }): Promise<{ ownerId: string; animalId: string }> {
    try {
      // Find or create a placeholder user for the walk-in owner
      let ownerId: string | null = null;
      if (data.patientEmail) {
        const existing = await database.query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`,
          [data.patientEmail]
        );
        if (existing.rows.length > 0) ownerId = existing.rows[0].id;
      }

      if (!ownerId) {
        const crypto = await import('crypto');
        const bcrypt = await import('bcryptjs');
        const placeholderPassword = crypto.randomBytes(32).toString('hex');
        const placeholderEmailSuffix = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(placeholderPassword, 10);
        const nameParts = data.patientName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Walk-In';
        const lastName = nameParts.slice(1).join(' ') || 'Patient';
        const placeholderEmail = data.patientEmail || `walkin-${placeholderEmailSuffix}@placeholder.local`;
        const userRes = await database.query(
          `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, 'pet_owner', true)
           ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
           RETURNING id`,
          [firstName, lastName, placeholderEmail, data.patientPhone || null, passwordHash]
        );
        ownerId = userRes.rows[0].id;
      }

      // Create the animal record
      const animalUniqueId = `VC-${data.animalSpecies.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const animalRes = await database.query(
        `INSERT INTO animals
           (name, species, breed, owner_id, unique_id, is_active,
            gender, date_of_birth, weight, color, microchip_id, registration_number,
            is_neutered, medical_notes, avatar_url,
            insurance_provider, insurance_policy_number, insurance_expiry,
            ear_tag_id)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id`,
        [
          data.animalName, data.animalSpecies, data.animalBreed || null, ownerId!, animalUniqueId,
          data.animalGender || null,
          data.animalDob || null,
          data.animalWeight ?? null,
          data.animalColor || null,
          data.animalMicrochipId || null,
          data.animalRegistrationNumber || null,
          data.animalIsNeutered ?? false,
          data.animalMedicalNotes || null,
          data.animalAvatarUrl || null,
          data.animalInsuranceProvider || null,
          data.animalInsurancePolicyNumber || null,
          data.animalInsuranceExpiry || null,
          data.animalEarTagId || null,
        ]
      );
      const animalId = animalRes.rows[0].id;

      logger.info('Walk-in patient registered (standalone)', { animalId, hospitalId: data.hospitalId });
      return { ownerId: ownerId!, animalId };
    } catch (err: any) {
      throw new Error(`Walk-in registration failed: ${err.message}`);
    }
  }
}

export default new VetHospitalService();
