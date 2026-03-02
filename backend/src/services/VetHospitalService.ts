import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';
import HospitalDocumentService from './HospitalDocumentService';

// ─── Interfaces ─────────────────────────────────────────────

export interface VetHospital {
  id: string;
  name: string;
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
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          hospital_type VARCHAR(50) NOT NULL DEFAULT 'multi_specialty'
            CHECK (hospital_type IN (
              'multi_specialty','specialty','clinic','emergency_center',
              'mobile_vet','research','teaching','other'
            )),
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
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
      // Bootstrap document tables / columns
      await HospitalDocumentService.ensureTables();
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
          id, name, hospital_type, registration_number, accreditation_body,
          accreditation_number, accreditation_expiry, description, address, city,
          state, country, postal_code, gps_latitude, gps_longitude,
          phone, emergency_phone, email, website, logo_url, cover_image_url,
          established_year, total_beds, icu_beds,
          is_24_hours, has_emergency, has_ambulance, has_pharmacy, has_lab,
          has_imaging, has_surgery, has_icu,
          specializations, facilities, accepted_species, operating_hours, owner_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
          $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37
        ) RETURNING *`,
        [
          id, data.name, data.hospitalType || 'multi_specialty',
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
    limit?: number; offset?: number;
  }): Promise<{ hospitals: VetHospital[]; total: number }> {
    const { search, city, hospitalType, specialization, hasEmergency, is24Hours, isVerified } = filters;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;
    const conditions: string[] = ['h.is_active = true'];
    const params: any[] = [];
    let idx = 1;
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
    const result = await database.query(
      `SELECT h.*,
              u.first_name || ' ' || u.last_name AS owner_name,
              hd.hospital_role, hd.title, hd.is_primary_hospital,
              (SELECT COUNT(*) FROM hospital_doctors WHERE hospital_id = h.id AND is_active = true) AS doctor_count,
              (SELECT COUNT(*) FROM hospital_departments WHERE hospital_id = h.id AND is_active = true) AS department_count
       FROM vet_hospitals h
       JOIN users u ON h.owner_id = u.id
       JOIN hospital_doctors hd ON hd.hospital_id = h.id AND hd.doctor_id = $1 AND hd.is_active = true
       WHERE h.is_active = true
       ORDER BY hd.is_primary_hospital DESC, h.name ASC`,
      [vetId]
    );
    return result.rows.map((r: any) => this.mapHospitalRow(r));
  }

  async updateHospital(id: string, data: Partial<CreateHospitalDTO>): Promise<VetHospital> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      name: 'name', hospitalType: 'hospital_type', registrationNumber: 'registration_number',
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
      id: row.id, name: row.name, hospitalType: row.hospital_type,
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
}

export default new VetHospitalService();
