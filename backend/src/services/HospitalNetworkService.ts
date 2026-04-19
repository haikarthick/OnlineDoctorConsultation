import database from '../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';
import NotificationService from './NotificationService';

// ─── Interfaces ──────────────────────────────────────────────
export interface HospitalNetwork {
  id: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  networkType: string;
  country?: string;
  headquartersAddress?: string;
  headquartersCity?: string;
  headquartersState?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  dpoName?: string;
  dpoEmail?: string;
  dataResidencyRegion?: string;
  isActive: boolean;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  // joined
  approvedByName?: string;
  memberCount?: number;
  hospitalCount?: number;
  idPrefix?: string;
}

export interface HospitalNetworkCreateDTO {
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  networkType?: string;
  country?: string;
  headquartersAddress?: string;
  headquartersCity?: string;
  headquartersState?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  dpoName?: string;
  dpoEmail?: string;
  dataResidencyRegion?: string;
  metadata?: any;
  idPrefix?: string;
}

export interface NetworkMember {
  id: string;
  networkId: string;
  userId: string;
  networkRole: string;
  hospitalId?: string;
  isActive: boolean;
  grantedBy?: string;
  grantedAt: Date;
  notes?: string;
  // joined
  userName?: string;
  userEmail?: string;
  userRole?: string;
  hospitalName?: string;
}

export interface NetworkDashboard {
  totalMembers: number;
  totalHospitals: number;
  totalPatients: number;
  activeConsents: number;
  recentAccessLogs: number;
  membersByRole: Record<string, number>;
}

export interface AccessLogEntry {
  accessedBy: string;
  accessorRole: string;
  accessorNetworkId?: string;
  animalId?: string;
  recordType?: string;
  recordId?: string;
  accessType: string;
  consentId?: string;
  ipAddress?: string;
  userAgent?: string;
  accessGranted: boolean;
  denialReason?: string;
}

export interface PatientConsent {
  id: string;
  animalId: string;
  ownerId: string;
  grantedToUserId?: string;
  grantedToHospitalId?: string;
  grantedToNetworkId?: string;
  consentScope: string;
  allowMedicalRecords: boolean;
  allowVaccinationRecords: boolean;
  allowPrescriptions: boolean;
  allowLabResults: boolean;
  allowGeneticData: boolean;
  includeHospitalRecords: boolean;
  allowView: boolean;
  allowCreateNotes: boolean;
  allowPrescribe: boolean;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  // joined
  animalName?: string;
  grantedToUserName?: string;
  grantedToHospitalName?: string;
  grantedToNetworkName?: string;
}

export interface PatientConsentDTO {
  animalId: string;
  grantedToUserId?: string;
  grantedToHospitalId?: string;
  grantedToNetworkId?: string;
  consentScope: string;
  allowMedicalRecords?: boolean;
  allowVaccinationRecords?: boolean;
  allowPrescriptions?: boolean;
  allowLabResults?: boolean;
  allowGeneticData?: boolean;
  includeHospitalRecords?: boolean;
  allowView?: boolean;
  allowCreateNotes?: boolean;
  allowPrescribe?: boolean;
  validFrom?: Date;
  validUntil?: Date;
}

export interface EnrollmentRequest {
  id: string;
  animalId: string;
  networkId: string;
  hospitalId?: string;
  enrollmentStatus: string;
  corporatePatientId?: string;
  platformUniqueId?: string;
  enrollmentRequestedAt: Date;
  enrollmentRespondedAt?: Date;
  enrolledBy?: string;
  notes?: string;
  animalName?: string;
  species?: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  networkName?: string;
  hospitalName?: string;
  enrolledByName?: string;
}

export interface WalkInInviteDTO {
  networkId: string;
  hospitalId?: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  animalName?: string;
  animalSpecies?: string;
  message?: string;
}

export class HospitalNetworkService {

  // ─── Network CRUD ─────────────────────────────────────────────
  async createNetwork(data: HospitalNetworkCreateDTO, createdById: string): Promise<HospitalNetwork> {
    // Fix 3: Validate id_prefix uniqueness BEFORE the transaction
    if (data.idPrefix) {
      const prefixCheck = await database.query(
        `SELECT id FROM hospital_networks WHERE UPPER(id_prefix) = UPPER($1) LIMIT 1`,
        [data.idPrefix]
      );
      if (prefixCheck.rows.length > 0) {
        throw new ConflictError('Network ID prefix is already in use by another network. Please choose a different prefix.');
      }
    }

    // Fix 1: Wrap both INSERTs in a transaction so an orphaned network can never exist
    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO hospital_networks
           (name, legal_name, registration_number, tax_id, network_type,
            country, headquarters_address, headquarters_city, headquarters_state,
            contact_email, contact_phone, website, logo_url,
            dpo_name, dpo_email, data_residency_region, metadata, id_prefix, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
          data.name,
          data.legalName ?? null,
          data.registrationNumber ?? null,
          data.taxId ?? null,
          data.networkType ?? 'private',
          data.country ?? null,
          data.headquartersAddress ?? null,
          data.headquartersCity ?? null,
          data.headquartersState ?? null,
          data.contactEmail ?? null,
          data.contactPhone ?? null,
          data.website ?? null,
          data.logoUrl ?? null,
          data.dpoName ?? null,
          data.dpoEmail ?? null,
          data.dataResidencyRegion ?? null,
          data.metadata ?? null,
          data.idPrefix ?? null,
          createdById,
        ]
      );

      const network = result.rows[0];

      // Auto-add creator as corporate_admin
      await client.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, granted_by)
         VALUES ($1, $2, 'corporate_admin', $2)`,
        [network.id, createdById]
      );

      await client.query('COMMIT');
      logger.info(`Hospital network created: ${data.name}`, { networkId: network.id, createdById });
      return this.mapNetworkRow(network);
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to create hospital network', { error: err.message });
      if (err.message.includes('already in use')) throw err;
      throw new DatabaseError('Failed to create hospital network');
    } finally {
      client.release();
    }
  }

  async listNetworks(filters: { isApproved?: boolean; isActive?: boolean } = {}): Promise<HospitalNetwork[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.isApproved !== undefined) {
      conditions.push(`hn.is_approved = $${idx++}`);
      params.push(filters.isApproved);
    }
    if (filters.isActive !== undefined) {
      conditions.push(`hn.is_active = $${idx++}`);
      params.push(filters.isActive);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await database.query(
      `SELECT hn.*,
              u.first_name || ' ' || u.last_name AS "approvedByName",
              (SELECT COUNT(*) FROM hospital_network_members WHERE network_id = hn.id AND is_active = true) AS "memberCount",
              (SELECT COUNT(DISTINCT hospital_id) FROM hospital_network_members WHERE network_id = hn.id AND hospital_id IS NOT NULL AND is_active = true) AS "hospitalCount"
       FROM hospital_networks hn
       LEFT JOIN users u ON hn.approved_by = u.id
       ${where}
       ORDER BY hn.name ASC`,
      params
    );
    return result.rows.map((r: any) => this.mapNetworkRow(r));
  }

  async getNetworkById(id: string): Promise<HospitalNetwork> {
    const result = await database.query(
      `SELECT hn.*,
              u.first_name || ' ' || u.last_name AS "approvedByName",
              (SELECT COUNT(*) FROM hospital_network_members WHERE network_id = hn.id AND is_active = true) AS "memberCount",
              (SELECT COUNT(DISTINCT hospital_id) FROM hospital_network_members WHERE network_id = hn.id AND hospital_id IS NOT NULL AND is_active = true) AS "hospitalCount"
       FROM hospital_networks hn
       LEFT JOIN users u ON hn.approved_by = u.id
       WHERE hn.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Hospital network not found');
    return this.mapNetworkRow(result.rows[0]);
  }

  async updateNetwork(id: string, data: Partial<HospitalNetworkCreateDTO>, userId: string): Promise<HospitalNetwork> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      legalName: 'legal_name',
      registrationNumber: 'registration_number',
      taxId: 'tax_id',
      networkType: 'network_type',
      country: 'country',
      headquartersAddress: 'headquarters_address',
      headquartersCity: 'headquarters_city',
      headquartersState: 'headquarters_state',
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      website: 'website',
      logoUrl: 'logo_url',
      dpoName: 'dpo_name',
      dpoEmail: 'dpo_email',
      dataResidencyRegion: 'data_residency_region',
      metadata: 'metadata',
      idPrefix: 'id_prefix',
    };

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push((data as any)[key]);
      }
    }

    if (setClauses.length === 0) throw new ValidationError('No fields to update');
    params.push(id);

    await database.query(
      `UPDATE hospital_networks SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      params
    );

    return this.getNetworkById(id);
  }

  async approveNetwork(id: string, approverId: string): Promise<void> {
    // Prevent creator from self-approving
    const networkCheck = await database.query(
      `SELECT created_by FROM hospital_networks WHERE id = $1`,
      [id]
    );
    if (networkCheck.rows.length === 0) throw new NotFoundError('Hospital network not found');
    if (networkCheck.rows[0].created_by === approverId) {
      throw new ForbiddenError('Network creators cannot approve their own network. Platform admin approval required.');
    }

    const result = await database.query(
      `UPDATE hospital_networks
       SET is_approved = true, approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, approverId]
    );
    if (result.rowCount === 0) throw new NotFoundError('Hospital network not found');
    logger.info(`Hospital network approved`, { networkId: id, approverId });
  }

  // ─── Members ──────────────────────────────────────────────────
  async addNetworkMember(
    networkId: string,
    userId: string,
    role: string,
    hospitalId?: string,
    grantedBy?: string,
    validUntil?: string
  ): Promise<void> {
    try {
      await database.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (network_id, user_id)
         DO UPDATE SET network_role = $3, hospital_id = $4, is_active = true, granted_at = NOW(),
                       valid_until = COALESCE($6, hospital_network_members.valid_until)`,
        [networkId, userId, role, hospitalId ?? null, grantedBy ?? null, validUntil ?? null]
      );
    } catch (error: any) {
      logger.error('Failed to add network member', { error: error.message });
      throw new DatabaseError('Failed to add network member');
    }
  }

  async getNetworkMember(networkId: string, userId: string): Promise<NetworkMember | null> {
    const result = await database.query(
      `SELECT hnm.*,
              u.first_name || ' ' || u.last_name AS "userName",
              u.email AS "userEmail",
              u.role AS "userRole",
              vh.name AS "hospitalName"
       FROM hospital_network_members hnm
       JOIN users u ON hnm.user_id = u.id
       LEFT JOIN vet_hospitals vh ON hnm.hospital_id = vh.id
       WHERE hnm.network_id = $1 AND hnm.user_id = $2 AND hnm.is_active = true
         AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())`,
      [networkId, userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapMemberRow(result.rows[0]);
  }

  async listNetworkMembers(networkId: string): Promise<NetworkMember[]> {
    const result = await database.query(
      `SELECT hnm.*,
              u.first_name || ' ' || u.last_name AS "userName",
              u.email AS "userEmail",
              u.role AS "userRole",
              vh.name AS "hospitalName"
       FROM hospital_network_members hnm
       JOIN users u ON hnm.user_id = u.id
       LEFT JOIN vet_hospitals vh ON hnm.hospital_id = vh.id
       WHERE hnm.network_id = $1 AND hnm.is_active = true
         AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())
       ORDER BY CASE hnm.network_role
         WHEN 'corporate_admin' THEN 1
         WHEN 'hospital_director' THEN 2
         WHEN 'compliance_officer' THEN 3
         WHEN 'auditor' THEN 4
         ELSE 5 END`,
      [networkId]
    );
    return result.rows.map((r: any) => this.mapMemberRow(r));
  }

  async removeNetworkMember(networkId: string, userId: string): Promise<void> {
    await database.query(
      `UPDATE hospital_network_members SET is_active = false
       WHERE network_id = $1 AND user_id = $2`,
      [networkId, userId]
    );
  }

  async logAudit(params: {
    networkId: string;
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await database.query(
        `INSERT INTO network_security_audit
           (network_id, actor_id, action, target_type, target_id, old_value, new_value, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          params.networkId, params.actorId, params.action,
          params.targetType ?? null, params.targetId ?? null,
          params.oldValue ? JSON.stringify(params.oldValue) : null,
          params.newValue ? JSON.stringify(params.newValue) : null,
          params.ipAddress ?? null,
        ]
      );
    } catch (err: any) {
      logger.warn('Audit log failed', { error: err.message });
    }
  }

  // ─── Hospital Assignment ───────────────────────────────────────
  async assignHospitalToNetwork(networkId: string, hospitalId: string, assignedBy: string): Promise<void> {
    await this.getNetworkById(networkId);
    try {
      // Primary path: update vet_hospitals flags (canonical network membership)
      await database.query(
        `UPDATE vet_hospitals SET is_network_branch = true, branch_network_id = $1 WHERE id = $2`,
        [networkId, hospitalId]
      );
      // Also insert into junction table (kept for backward compat queries)
      await database.query(
        `INSERT INTO hospital_network_hospitals (network_id, hospital_id, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (network_id, hospital_id) DO UPDATE SET is_active = true`,
        [networkId, hospitalId]
      );
      // Add hospital owner as hospital_staff member if not already a member
      await database.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by)
         SELECT $1, u.id, 'hospital_staff', $2, $3
         FROM vet_hospitals vh
         JOIN users u ON vh.owner_id = u.id
         WHERE vh.id = $2
         ON CONFLICT (network_id, user_id) DO UPDATE SET hospital_id = $2, is_active = true`,
        [networkId, hospitalId, assignedBy]
      );
    } catch (error: any) {
      logger.error('Failed to assign hospital to network', { error: error.message });
      throw new DatabaseError('Failed to assign hospital to network');
    }
  }

  async listNetworkHospitals(networkId: string, page: number = 1, limit: number = 20): Promise<any> {
    const offset = (page - 1) * limit;
    const result = await database.query(
      `SELECT vh.id,
              vh.name,
              vh.city,
              vh.state,
              vh.hospital_type AS "hospitalType",
              vh.email AS "contactEmail",
              vh.phone AS "contactPhone",
              vh.is_verified AS "isVerified",
              vh.is_network_branch AS "isNetworkBranch",
              vh.specializations,
              (SELECT COUNT(*) FROM hospital_network_members
               WHERE network_id = $1 AND hospital_id = vh.id AND is_active = true) AS "staffCount"
       FROM vet_hospitals vh
       WHERE vh.branch_network_id = $1 AND vh.is_network_branch = true
       ORDER BY vh.name ASC
       LIMIT $2 OFFSET $3`,
      [networkId, limit, offset]
    );
    const countResult = await database.query(
      `SELECT COUNT(*) AS count FROM vet_hospitals WHERE branch_network_id = $1 AND is_network_branch = true`,
      [networkId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0');
    return {
      hospitals: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Dashboard ─────────────────────────────────────────────────
  async getNetworkDashboard(networkId: string): Promise<NetworkDashboard> {
    const [members, hospitals, patients, consents, accessLogs, membersByRole] = await Promise.all([
      database.query(
        `SELECT COUNT(*) AS count FROM hospital_network_members WHERE network_id = $1 AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(DISTINCT hospital_id) AS count FROM hospital_network_members
         WHERE network_id = $1 AND hospital_id IS NOT NULL AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(*) AS count FROM animal_care_contexts WHERE network_id = $1 AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(*) AS count FROM patient_data_consent
         WHERE granted_to_network_id = $1 AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(*) AS count FROM clinical_data_access_log
         WHERE accessor_network_id = $1 AND accessed_at >= NOW() - INTERVAL '30 days'`,
        [networkId]
      ),
      database.query(
        `SELECT network_role AS role, COUNT(*) AS count
         FROM hospital_network_members WHERE network_id = $1 AND is_active = true
         GROUP BY network_role`,
        [networkId]
      ),
    ]);

    const membersByRoleMap: Record<string, number> = {};
    for (const row of membersByRole.rows) {
      membersByRoleMap[row.role] = parseInt(row.count);
    }

    return {
      totalMembers: parseInt(members.rows[0]?.count || '0'),
      totalHospitals: parseInt(hospitals.rows[0]?.count || '0'),
      totalPatients: parseInt(patients.rows[0]?.count || '0'),
      activeConsents: parseInt(consents.rows[0]?.count || '0'),
      recentAccessLogs: parseInt(accessLogs.rows[0]?.count || '0'),
      membersByRole: membersByRoleMap,
    };
  }

  async getHospitalStaffDashboard(userId: string): Promise<any> {
    // Find user's network and hospital
    const memberResult = await database.query(
      `SELECT hnm.network_id, hnm.hospital_id, hn.name as network_name, vh.name as hospital_name
       FROM hospital_network_members hnm
       LEFT JOIN hospital_networks hn ON hn.id = hnm.network_id
       LEFT JOIN vet_hospitals vh ON vh.id = hnm.hospital_id
       WHERE hnm.user_id = $1 AND hnm.is_active = true LIMIT 1`,
      [userId]
    );
    if (memberResult.rows.length === 0) {
      return {
        networkName: '', hospitalName: '',
        enrolledPatients: 0, todayQueueCount: 0, activeInpatients: 0,
        pendingReferrals: 0, staffCount: 0, recentActivity: []
      };
    }
    const { network_id, hospital_id, network_name, hospital_name } = memberResult.rows[0];

    const queries = await Promise.all([
      // Enrolled patients in network
      database.query(
        `SELECT COUNT(*) as count FROM animal_care_contexts 
         WHERE network_id = $1 AND enrollment_status = 'active' AND is_active = true`,
        [network_id]
      ),
      // Today's queue (if hospital assigned)
      hospital_id ? database.query(
        `SELECT COUNT(*) as count FROM appointment_queue 
         WHERE hospital_id = $1 AND created_at::date = CURRENT_DATE`,
        [hospital_id]
      ) : Promise.resolve({ rows: [{ count: '0' }] }),
      // Active inpatients
      hospital_id ? database.query(
        `SELECT COUNT(*) as count FROM inpatient_admissions 
         WHERE hospital_id = $1 AND status = 'admitted'`,
        [hospital_id]
      ) : Promise.resolve({ rows: [{ count: '0' }] }),
      // Pending referrals
      database.query(
        `SELECT COUNT(*) as count FROM network_referrals 
         WHERE network_id = $1 AND status = 'pending'`,
        [network_id]
      ),
      // Staff count at hospital
      hospital_id ? database.query(
        `SELECT COUNT(*) as count FROM hospital_network_members 
         WHERE network_id = $1 AND hospital_id = $2 AND is_active = true`,
        [network_id, hospital_id]
      ) : database.query(
        `SELECT COUNT(*) as count FROM hospital_network_members 
         WHERE network_id = $1 AND is_active = true`,
        [network_id]
      ),
    ]);

    return {
      networkName: network_name || '',
      hospitalName: hospital_name || '',
      networkId: network_id,
      hospitalId: hospital_id,
      enrolledPatients: parseInt(queries[0].rows[0]?.count || '0'),
      todayQueueCount: parseInt(queries[1].rows[0]?.count || '0'),
      activeInpatients: parseInt(queries[2].rows[0]?.count || '0'),
      pendingReferrals: parseInt(queries[3].rows[0]?.count || '0'),
      staffCount: parseInt(queries[4].rows[0]?.count || '0'),
    };
  }

  // ─── Audit Log ────────────────────────────────────────────────
  async getAuditLogs(
    networkId: string,
    filters: { page?: number; limit?: number; recordType?: string; accessGranted?: boolean; animalId?: string } = {}
  ): Promise<{ rows: any[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['cal.accessor_network_id = $1'];
    const params: any[] = [networkId];
    let idx = 2;

    if (filters.recordType) { conditions.push(`cal.record_type = $${idx++}`); params.push(filters.recordType); }
    if (filters.accessGranted !== undefined) { conditions.push(`cal.access_granted = $${idx++}`); params.push(filters.accessGranted); }
    if (filters.animalId) { conditions.push(`cal.animal_id = $${idx++}`); params.push(filters.animalId); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataRes, countRes] = await Promise.all([
      database.query(
        `SELECT cal.*,
                u.first_name || ' ' || u.last_name AS "accessorName",
                u.email AS "accessorEmail",
                COALESCE(a.name, '[Animal ID: ' || cal.animal_id || ']') AS "animalName",
                a.unique_id AS "animalUniqueId"
         FROM clinical_data_access_log cal
         LEFT JOIN users u ON cal.accessed_by = u.id
         LEFT JOIN animals a ON cal.animal_id = a.id
         ${where}
         ORDER BY cal.accessed_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      database.query(
        `SELECT COUNT(*) AS total FROM clinical_data_access_log cal ${where}`,
        params
      ),
    ]);

    return {
      rows: dataRes.rows.map((r: any) => ({
        id: r.id,
        accessedBy: r.accessed_by,
        accessorName: r.accessorName,
        accessorEmail: r.accessorEmail,
        accessorRole: r.accessor_role,
        animalId: r.animal_id,
        animalName: r.animalName,
        animalUniqueId: r.animalUniqueId,
        recordType: r.record_type,
        accessType: r.access_type,
        accessGranted: r.access_granted,
        denialReason: r.denial_reason,
        consentId: r.consent_id,
        accessedAt: r.accessed_at,
      })),
      total: parseInt(countRes.rows[0]?.total || '0'),
    };
  }

  async logAccess(entry: AccessLogEntry): Promise<void> {
    try {
      await database.query(
        `INSERT INTO clinical_data_access_log
           (accessed_by, accessor_role, accessor_network_id, animal_id, record_type,
            record_id, access_type, consent_id, ip_address, user_agent, access_granted, denial_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          entry.accessedBy,
          entry.accessorRole,
          entry.accessorNetworkId ?? null,
          entry.animalId ?? null,
          entry.recordType ?? null,
          entry.recordId ?? null,
          entry.accessType,
          entry.consentId ?? null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          entry.accessGranted,
          entry.denialReason ?? null,
        ]
      );
    } catch (error: any) {
      // Non-fatal: log the error but don't block the calling operation
      logger.error('Failed to write clinical data access log', { error: error.message });
    }
  }

  // ─── Patient Consent ──────────────────────────────────────────
  async createConsent(data: PatientConsentDTO, ownerId: string): Promise<PatientConsent> {
    try {
      const result = await database.query(
        `INSERT INTO patient_data_consent
           (animal_id, owner_id, granted_to_user_id, granted_to_hospital_id, granted_to_network_id,
            consent_scope, allow_medical_records, allow_vaccination_records, allow_prescriptions,
            allow_lab_results, allow_genetic_data, include_hospital_records,
            allow_view, allow_create_notes, allow_prescribe,
            valid_from, valid_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          data.animalId,
          ownerId,
          data.grantedToUserId ?? null,
          data.grantedToHospitalId ?? null,
          data.grantedToNetworkId ?? null,
          data.consentScope,
          data.allowMedicalRecords ?? true,
          data.allowVaccinationRecords ?? true,
          data.allowPrescriptions ?? true,
          data.allowLabResults ?? false,
          data.allowGeneticData ?? false,
          data.includeHospitalRecords ?? false,
          data.allowView ?? true,
          data.allowCreateNotes ?? false,
          data.allowPrescribe ?? false,
          data.validFrom ?? new Date(),
          data.validUntil ?? null,
        ]
      );
      return this.mapConsentRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create patient consent', { error: error.message });
      throw new DatabaseError('Failed to create patient consent');
    }
  }

  async listConsents(animalId: string, ownerId: string): Promise<PatientConsent[]> {
    const result = await database.query(
      `SELECT pdc.*,
              a.name AS "animalName",
              u.first_name || ' ' || u.last_name AS "grantedToUserName",
              vh.name AS "grantedToHospitalName",
              hn.name AS "grantedToNetworkName"
       FROM patient_data_consent pdc
       JOIN animals a ON pdc.animal_id = a.id
       LEFT JOIN users u ON pdc.granted_to_user_id = u.id
       LEFT JOIN vet_hospitals vh ON pdc.granted_to_hospital_id = vh.id
       LEFT JOIN hospital_networks hn ON pdc.granted_to_network_id = hn.id
       WHERE pdc.animal_id = $1 AND pdc.owner_id = $2
       ORDER BY pdc.created_at DESC`,
      [animalId, ownerId]
    );
    return result.rows.map((r: any) => this.mapConsentRow(r));
  }

  async revokeConsent(consentId: string, ownerId: string, reason: string): Promise<void> {
    const result = await database.query(
      `UPDATE patient_data_consent
       SET is_active = false, revoked_at = NOW(), revoked_reason = $3, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2`,
      [consentId, ownerId, reason]
    );
    if (result.rowCount === 0) {
      throw new ForbiddenError('Consent not found or you do not own it');
    }
  }

  // ─── Row Mappers ──────────────────────────────────────────────
  private async generateNetworkPatientId(networkId: string, species: string): Promise<string> {
    const netRes = await database.query(
      `SELECT id_prefix FROM hospital_networks WHERE id = $1`, [networkId]
    );
    const prefix = (netRes.rows[0]?.id_prefix ?? 'NET').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

    const SPECIES_CODES: Record<string, string> = {
      dog: 'DOG', canine: 'DOG', cat: 'CAT', feline: 'CAT',
      rabbit: 'RAB', hamster: 'HAM', 'guinea pig': 'GNP', gerbil: 'GRB',
      chinchilla: 'CHN', ferret: 'FRT', hedgehog: 'HDG', 'sugar glider': 'SGL',
      parrot: 'PAR', budgerigar: 'BDG', budgie: 'BDG', cockatiel: 'CCT',
      lovebird: 'LVB', finch: 'FNC', canary: 'CNR', mynah: 'MYN', myna: 'MYN',
      pigeon: 'PGN', dove: 'PGN', bird: 'BRD',
      tortoise: 'TOR', turtle: 'TRT', gecko: 'GCK', 'bearded dragon': 'BDR',
      chameleon: 'CHL', snake: 'SNK', frog: 'FRG', axolotl: 'AXL',
      'ornamental fish': 'FSH', fish: 'FSH', koi: 'KOI', arowana: 'ARW', goldfish: 'GLD',
      cattle: 'COW', cow: 'COW', bovine: 'COW', buffalo: 'BUF', 'water buffalo': 'BUF',
      horse: 'HRS', equine: 'HRS', donkey: 'DNK', mule: 'DNK',
      sheep: 'SHP', ovine: 'SHP', goat: 'GOT', caprine: 'GOT',
      pig: 'PIG', swine: 'PIG', porcine: 'PIG', camel: 'CAM', yak: 'YAK', deer: 'DER',
      chicken: 'CHK', poultry: 'CHK', duck: 'DUK', turkey: 'TRK', quail: 'QAL',
      emu: 'EMU', ostrich: 'OST', peacock: 'PCK', peafowl: 'PCK',
      llama: 'LLA', alpaca: 'ALP',
    };
    const code = SPECIES_CODES[species.toLowerCase()] ?? species.toUpperCase().slice(0, 3);
    const year = new Date().getFullYear() % 100;

    const seqRes = await database.query(
      `INSERT INTO network_patient_id_sequences (network_id, species, year, last_seq)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (network_id, species, year)
       DO UPDATE SET last_seq = network_patient_id_sequences.last_seq + 1
       RETURNING last_seq`,
      [networkId, species.toLowerCase(), year]
    );
    const seq = seqRes.rows[0].last_seq;
    return `${prefix}-${code}-${year.toString().padStart(2, '0')}-${seq.toString().padStart(6, '0')}`;
  }

  async enrollAnimal(data: { animalId: string; networkId: string; hospitalId?: string; enrolledBy: string; notes?: string }): Promise<{ id: string; animalId: string; networkId: string; networkPatientId: string; platformUniqueId: string | null; enrollmentStatus: string }> {
    try {
      // Fix 4a: Verify hospital belongs to this network (only when hospitalId provided)
      if (data.hospitalId) {
        const hospitalInNetwork = await database.query(
          `SELECT id FROM hospital_network_members 
           WHERE network_id = $1 AND hospital_id = $2 AND is_active = true LIMIT 1`,
          [data.networkId, data.hospitalId]
        );
        if (hospitalInNetwork.rows.length === 0) {
          throw new ValidationError('Hospital is not a member of this network');
        }
      }

      // Fix 4b: Verify enrolledBy user has permission (network member or hospital staff)
      const userPermission = await database.query(
        `SELECT hnm.network_role 
         FROM hospital_network_members hnm 
         WHERE hnm.network_id = $1 AND hnm.user_id = $2 AND hnm.is_active = true
         UNION
         SELECT 'hospital_staff' AS network_role
         FROM hospital_staff hs
         WHERE hs.hospital_id = $3 AND hs.user_id = $2 AND hs.is_active = true
         LIMIT 1`,
        [data.networkId, data.enrolledBy, data.hospitalId ?? null]
      );
      if (userPermission.rows.length === 0) {
        throw new ForbiddenError('You do not have permission to enroll patients in this network');
      }

      const animalRes = await database.query(
        `SELECT a.id, a.species, a.unique_id, a.name AS animal_name, a.owner_id,
                u.name AS owner_name
         FROM animals a JOIN users u ON a.owner_id = u.id
         WHERE a.id = $1 AND a.is_active = true`, [data.animalId]
      );
      if (!animalRes.rows[0]) throw new NotFoundError('Animal');
      const animal = animalRes.rows[0];

      // Ownership / consent check: only the owner, or a network admin with consent, can enroll
      const ownerCheck = await database.query(
        `SELECT 1 FROM animals WHERE id = $1 AND owner_id = $2`,
        [data.animalId, data.enrolledBy]
      );
      const consentCheck = await database.query(
        `SELECT 1 FROM patient_data_consent 
         WHERE animal_id = $1 AND granted_to_network_id = $2 AND status = 'active'`,
        [data.animalId, data.networkId]
      );
      const userRoleRes = await database.query(
        `SELECT network_role FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
        [data.networkId, data.enrolledBy]
      );
      const userNetworkRole = userRoleRes.rows[0]?.network_role;
      const isOwner = ownerCheck.rows.length > 0;
      const hasConsent = consentCheck.rows.length > 0;
      const isNetworkAdmin = ['corporate_admin', 'hospital_director'].includes(userNetworkRole);

      if (!isOwner && !hasConsent && !isNetworkAdmin) {
        throw new ForbiddenError('You do not have permission to enroll this animal. Only the owner or a network admin can enroll animals.');
      }

      const networkPatientId = await this.generateNetworkPatientId(data.networkId, animal.species);
      const netRes = await database.query(`SELECT name FROM hospital_networks WHERE id = $1`, [data.networkId]);
      const networkName = netRes.rows[0]?.name ?? 'Hospital Network';

      const result = await database.query(
        `INSERT INTO animal_care_contexts
           (animal_id, network_id, hospital_id, platform_unique_id, corporate_patient_id,
            enrolled_by, notes, visibility, enrollment_status, enrollment_requested_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'private', 'pending_consent', CURRENT_TIMESTAMP)
         ON CONFLICT (animal_id, network_id) DO UPDATE
           SET corporate_patient_id = EXCLUDED.corporate_patient_id,
               hospital_id = EXCLUDED.hospital_id,
               is_active = true,
               enrollment_status = 'pending_consent',
               enrollment_requested_at = CURRENT_TIMESTAMP,
               enrollment_responded_at = NULL
         RETURNING id, animal_id AS "animalId", network_id AS "networkId",
                   corporate_patient_id AS "networkPatientId",
                   platform_unique_id AS "platformUniqueId",
                   enrollment_status AS "enrollmentStatus"`,
        [data.animalId, data.networkId, data.hospitalId ?? null, animal.unique_id, networkPatientId, data.enrolledBy, data.notes ?? null]
      );

      // Notify the animal owner about the enrollment request
      try {
        const notifTitle = 'Network Enrollment Request';
        const notifMessage = `${networkName} has requested to enroll your animal "${animal.animal_name}" into their network. Please review and accept or decline.`;
        await NotificationService.createNotification(
          animal.owner_id, 'enrollment_requested', notifTitle, notifMessage, 'all',
          { networkId: data.networkId, networkName, animalId: data.animalId, animalName: animal.animal_name }
        );
      } catch (notifErr: any) {
        logger.warn('Failed to send enrollment notification', { error: notifErr.message });
      }
      logger.info('Enrollment request created', { networkName, animalName: animal.animal_name, ownerId: animal.owner_id });

      return result.rows[0];
    } catch (err: any) {
      throw new DatabaseError(`Enroll animal failed: ${err.message}`);
    }
  }

  async getNetworkPatients(networkId: string, limit = 50, offset = 0): Promise<{ total: number; patients: any[] }> {
    try {
      const countRes = await database.query(
        `SELECT COUNT(*) AS total FROM animal_care_contexts WHERE network_id = $1 AND is_active = true`, [networkId]
      );
      const rows = await database.query(
        `SELECT acc.id, acc.animal_id AS "animalId", acc.corporate_patient_id AS "networkPatientId",
                acc.platform_unique_id AS "platformUniqueId", acc.enrolled_at AS "enrolledAt",
                acc.hospital_id AS "hospitalId", acc.visibility,
                a.name AS "animalName", a.species, a.breed, a.gender,
                u.name AS "ownerName"
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN users u ON a.owner_id = u.id
         WHERE acc.network_id = $1 AND acc.is_active = true
         ORDER BY acc.enrolled_at DESC
         LIMIT $2 OFFSET $3`,
        [networkId, limit, offset]
      );
      return { total: parseInt(countRes.rows[0].total), patients: rows.rows };
    } catch (err: any) {
      throw new DatabaseError(`Get network patients failed: ${err.message}`);
    }
  }

  async searchPatients(query: string, limit = 10): Promise<Array<{
    userId: string; userName: string; userEmail: string; userPhone?: string;
    animals: Array<{ id: string; name: string; species: string; uniqueId?: string; }>
  }>> {
    try {
      const q = `%${query.toLowerCase()}%`;
      const result = await database.query(
        `SELECT DISTINCT u.id AS "userId", u.name AS "userName", u.email AS "userEmail", u.phone AS "userPhone"
         FROM users u
         LEFT JOIN animals a ON a.owner_id = u.id AND a.is_active = true
         WHERE u.role = 'pet_owner'
           AND (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1
                OR u.phone LIKE $1 OR LOWER(a.unique_id) LIKE $1
                OR LOWER(a.name) LIKE $1)
         LIMIT $2`,
        [q, limit]
      );
      const users = result.rows;
      for (const user of users) {
        const animalRes = await database.query(
          `SELECT id, name, species, unique_id AS "uniqueId" FROM animals
           WHERE owner_id = $1 AND is_active = true ORDER BY name`,
          [user.userId]
        );
        user.animals = animalRes.rows;
      }
      return users;
    } catch (err: any) {
      throw new DatabaseError(`Search patients failed: ${err.message}`);
    }
  }

  async acceptEnrollment(contextId: string, ownerId: string, consentScope?: string): Promise<void> {
    try {
      const check = await database.query(
        `SELECT acc.id, acc.animal_id, acc.network_id, acc.corporate_patient_id,
                a.owner_id, a.name AS animal_name, hn.name AS network_name
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN hospital_networks hn ON acc.network_id = hn.id
         WHERE acc.id = $1 AND a.owner_id = $2 AND acc.enrollment_status = 'pending_consent'`,
        [contextId, ownerId]
      );
      if (!check.rows[0]) throw new NotFoundError('Enrollment request not found or already responded');
      const ctx = check.rows[0];

      await database.query(
        `UPDATE animal_care_contexts
         SET enrollment_status = 'active', enrollment_responded_at = CURRENT_TIMESTAMP, is_active = true
         WHERE id = $1`,
        [contextId]
      );

      await database.query(
        `INSERT INTO patient_data_consent
           (animal_id, owner_id, granted_to_network_id, consent_scope,
            allow_medical_records, allow_vaccination_records, allow_prescriptions,
            allow_lab_results, allow_genetic_data, include_hospital_records,
            allow_view, allow_create_notes, allow_prescribe, is_active)
         VALUES ($1, $2, $3, $4, true, true, true, false, false, false, true, true, false, true)
         ON CONFLICT DO NOTHING`,
        [ctx.animal_id, ownerId, ctx.network_id, consentScope ?? 'basic_history']
      );
    } catch (err: any) {
      throw new DatabaseError(`Accept enrollment failed: ${err.message}`);
    }
  }

  async declineEnrollment(contextId: string, ownerId: string): Promise<void> {
    try {
      const result = await database.query(
        `UPDATE animal_care_contexts acc
         SET enrollment_status = 'declined', enrollment_responded_at = CURRENT_TIMESTAMP, is_active = false
         FROM animals a
         WHERE acc.id = $1 AND acc.animal_id = a.id AND a.owner_id = $2
           AND acc.enrollment_status = 'pending_consent'
         RETURNING acc.id`,
        [contextId, ownerId]
      );
      if (!result.rows[0]) throw new NotFoundError('Enrollment request');
    } catch (err: any) {
      throw new DatabaseError(`Decline enrollment failed: ${err.message}`);
    }
  }

  async getMyEnrollments(ownerId: string): Promise<any[]> {
    try {
      const result = await database.query(
        `SELECT acc.id, acc.animal_id AS "animalId", acc.network_id AS "networkId",
                acc.hospital_id AS "hospitalId", acc.corporate_patient_id AS "networkPatientId",
                acc.platform_unique_id AS "platformUniqueId", acc.enrollment_status AS "enrollmentStatus",
                acc.enrollment_requested_at AS "enrollmentRequestedAt",
                acc.enrollment_responded_at AS "enrollmentRespondedAt",
                acc.visibility, acc.notes,
                a.name AS "animalName", a.species, a.breed,
                hn.name AS "networkName", hn.id_prefix AS "networkPrefix",
                vh.name AS "hospitalName",
                u_by.first_name || ' ' || u_by.last_name AS "enrolledByName"
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN hospital_networks hn ON acc.network_id = hn.id
         LEFT JOIN vet_hospitals vh ON acc.hospital_id = vh.id
         LEFT JOIN users u_by ON acc.enrolled_by = u_by.id
         WHERE a.owner_id = $1
         ORDER BY acc.enrollment_requested_at DESC`,
        [ownerId]
      );
      return result.rows;
    } catch (err: any) {
      throw new DatabaseError(`Get my enrollments failed: ${err.message}`);
    }
  }

  async inviteWalkInPatient(data: WalkInInviteDTO, invitedBy: string): Promise<{ id: string; inviteToken: string }> {
    try {
      const crypto = await import('crypto');
      const token = crypto.randomBytes(48).toString('hex');
      const result = await database.query(
        `INSERT INTO hospital_patient_invites
           (network_id, hospital_id, invited_by, patient_name, patient_email, patient_phone,
            animal_name, animal_species, invite_token, message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, invite_token AS "inviteToken"`,
        [data.networkId, data.hospitalId ?? null, invitedBy, data.patientName, data.patientEmail,
         data.patientPhone ?? null, data.animalName ?? null, data.animalSpecies ?? null, token, data.message ?? null]
      );
      return result.rows[0];
    } catch (err: any) {
      throw new DatabaseError(`Invite walk-in patient failed: ${err.message}`);
    }
  }

  // Fix 6: Accept a walk-in patient invite by token, with expiry and status validation
  async acceptWalkInInvite(token: string, acceptedByUserId: string): Promise<{ id: string; networkId: string; hospitalId: string | null }> {
    try {
      const inviteRes = await database.query(
        `SELECT * FROM hospital_patient_invites WHERE invite_token = $1 LIMIT 1`,
        [token]
      );
      if (inviteRes.rows.length === 0) {
        throw new NotFoundError('Invitation not found. Please check the link and try again.');
      }
      const invite = inviteRes.rows[0];

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw new ValidationError('This invitation has expired. Please request a new invitation.');
      }
      if (invite.status !== 'pending') {
        throw new ConflictError(`This invitation has already been ${invite.status}.`);
      }

      await database.query(
        `UPDATE hospital_patient_invites
         SET status = 'accepted', accepted_at = NOW(), accepted_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [acceptedByUserId, invite.id]
      );
      return { id: invite.id, networkId: invite.network_id, hospitalId: invite.hospital_id };
    } catch (err: any) {
      throw new DatabaseError(err.message);
    }
  }

  // Direct walk-in registration: Staff registers patient on-site, treatment starts immediately.
  // No invite or consent needed — patient is enrolled as 'active' with 'walkin' visibility.
  // If the patient later wants online portal access, staff can send an invite separately.
  async registerWalkInPatientDirect(data: {
    networkId: string; hospitalId: string; registeredBy: string;
    patientName: string; patientPhone?: string; patientEmail?: string; patientAddress?: string;
    animalName: string; animalSpecies: string; animalBreed?: string;
    animalGender?: string; animalDob?: string; animalWeight?: number;
    animalColor?: string; animalMicrochipId?: string; animalRegistrationNumber?: string;
    animalIsNeutered?: boolean; animalMedicalNotes?: string; animalAvatarUrl?: string;
    animalInsuranceProvider?: string; animalInsurancePolicyNumber?: string; animalInsuranceExpiry?: string;
    animalEarTagId?: string;
    reasonForVisit?: string;
    consentCollected?: boolean; consentMethod?: string;
  }): Promise<{ patientId: string; networkPatientId: string; animalId: string; ownerId: string | null }> {
    try {
      // Verify the registering user is a network member
      const member = await this.getNetworkMember(data.networkId, data.registeredBy);
      if (!member) throw new ForbiddenError('You are not a member of this network');

      // Create a placeholder user for the walk-in patient (or find existing by email/phone)
      let ownerId: string | null = null;
      if (data.patientEmail) {
        const existing = await database.query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`, [data.patientEmail]
        );
        if (existing.rows.length > 0) ownerId = existing.rows[0].id;
      }

      // If no existing user found, create a walk-in placeholder account
      if (!ownerId) {
        const crypto = await import('crypto');
        const placeholderPassword = crypto.randomBytes(32).toString('hex');
        const nameParts = data.patientName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Walk-In';
        const lastName = nameParts.slice(1).join(' ') || 'Patient';
        const userRes = await database.query(
          `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, 'pet_owner', true)
           ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
           RETURNING id`,
          [firstName, lastName, data.patientEmail || `walkin-${Date.now()}@placeholder.local`,
           data.patientPhone || null, placeholderPassword]
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
          data.animalName, data.animalSpecies, data.animalBreed || null, ownerId, animalUniqueId,
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

      // Enroll — active if consent was collected, pending_consent otherwise
      const enrollmentStatus = data.consentCollected === true ? 'active' : 'pending_consent';
      const networkPatientId = await this.generateNetworkPatientId(data.networkId, data.animalSpecies);
      const contextRes = await database.query(
        `INSERT INTO animal_care_contexts
           (animal_id, network_id, hospital_id, platform_unique_id, corporate_patient_id,
            enrolled_by, visibility, enrollment_status, enrollment_requested_at, enrollment_responded_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'network_only', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)
         ON CONFLICT (animal_id, network_id) DO UPDATE
           SET enrollment_status = $7, enrollment_responded_at = CURRENT_TIMESTAMP,
               hospital_id = EXCLUDED.hospital_id, is_active = true
         RETURNING id`,
        [animalId, data.networkId, data.hospitalId, animalUniqueId, networkPatientId,
         data.registeredBy, enrollmentStatus, data.reasonForVisit || 'Walk-in registration']
      );

      // Notify owner about walk-in registration (if they have an email)
      if (data.patientEmail && ownerId) {
        try {
          const networkRes = await database.query(`SELECT name FROM hospital_networks WHERE id = $1`, [data.networkId]);
          const networkName = networkRes.rows[0]?.name ?? 'the hospital';
          await NotificationService.createNotification(
            ownerId, 'walkin_registered',
            'Walk-in Registration Completed',
            `Your animal "${data.animalName}" has been registered at ${networkName}. ${data.consentCollected ? 'Consent was collected at registration.' : 'Please log in to review and confirm the enrollment.'}`,
            data.consentCollected ? 'in_app' : 'all',
            { networkId: data.networkId, animalId, consentRequired: !data.consentCollected }
          );
        } catch (notifErr: any) {
          logger.warn('Failed to send walk-in registration notification', { error: notifErr.message });
        }
      }

      logger.info('Walk-in patient registered directly', { networkPatientId, animalName: data.animalName, hospitalId: data.hospitalId });

      return {
        patientId: contextRes.rows[0].id,
        ownerId,
        networkPatientId,
        animalId
      };
    } catch (err: any) {
      if (err instanceof ForbiddenError || err instanceof ValidationError) throw err;
      throw new DatabaseError(`Walk-in registration failed: ${err.message}`);
    }
  }

  async getPendingEnrollments(networkId: string): Promise<any[]> {
    try {
      const result = await database.query(
        `SELECT acc.id, acc.animal_id AS "animalId", acc.enrollment_status AS "enrollmentStatus",
                acc.corporate_patient_id AS "networkPatientId",
                acc.enrollment_requested_at AS "enrollmentRequestedAt",
                acc.enrollment_responded_at AS "enrollmentRespondedAt",
                a.name AS "animalName", a.species, a.breed,
                u.name AS "ownerName", u.email AS "ownerEmail"
         FROM animal_care_contexts acc
         JOIN animals a ON acc.animal_id = a.id
         JOIN users u ON a.owner_id = u.id
         WHERE acc.network_id = $1
         ORDER BY acc.enrollment_status, acc.enrollment_requested_at DESC`,
        [networkId]
      );
      return result.rows;
    } catch (err: any) {
      throw new DatabaseError(`Get pending enrollments failed: ${err.message}`);
    }
  }

  // Fix 7: Deactivate a network (only network corporate_admin or platform admin)
  async deactivateNetwork(networkId: string, userId: string, userRole: string): Promise<any> {
    if (userRole !== 'admin') {
      const membership = await database.query(
        `SELECT network_role FROM hospital_network_members 
         WHERE network_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
        [networkId, userId]
      );
      if (membership.rows.length === 0 || membership.rows[0].network_role !== 'corporate_admin') {
        throw new ForbiddenError('Only network administrators can deactivate a network');
      }
    }
    const result = await database.query(
      `UPDATE hospital_networks SET is_active = false, updated_at = NOW() 
       WHERE id = $1 RETURNING id, name, is_active AS "isActive"`,
      [networkId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Hospital network');
    return result.rows[0];
  }

  private mapNetworkRow(row: any): HospitalNetwork {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legal_name,
      registrationNumber: row.registration_number,
      taxId: row.tax_id,
      networkType: row.network_type,
      country: row.country,
      headquartersAddress: row.headquarters_address,
      headquartersCity: row.headquarters_city,
      headquartersState: row.headquarters_state,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      website: row.website,
      logoUrl: row.logo_url,
      dpoName: row.dpo_name,
      dpoEmail: row.dpo_email,
      dataResidencyRegion: row.data_residency_region,
      isActive: row.is_active,
      isApproved: row.is_approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      metadata: row.metadata,
      idPrefix: row.id_prefix,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedByName: row.approvedByName,
      memberCount: row.memberCount !== undefined ? parseInt(row.memberCount) : undefined,
      hospitalCount: row.hospitalCount !== undefined ? parseInt(row.hospitalCount) : undefined,
      createdBy: row.created_by,
    };
  }

  private mapMemberRow(row: any): NetworkMember {
    return {
      id: row.id,
      networkId: row.network_id,
      userId: row.user_id,
      networkRole: row.network_role,
      hospitalId: row.hospital_id,
      isActive: row.is_active,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      notes: row.notes,
      userName: row.userName,
      userEmail: row.userEmail,
      userRole: row.userRole,
      hospitalName: row.hospitalName,
    };
  }

  private mapConsentRow(row: any): PatientConsent {
    return {
      id: row.id,
      animalId: row.animal_id,
      ownerId: row.owner_id,
      grantedToUserId: row.granted_to_user_id,
      grantedToHospitalId: row.granted_to_hospital_id,
      grantedToNetworkId: row.granted_to_network_id,
      consentScope: row.consent_scope,
      allowMedicalRecords: row.allow_medical_records,
      allowVaccinationRecords: row.allow_vaccination_records,
      allowPrescriptions: row.allow_prescriptions,
      allowLabResults: row.allow_lab_results,
      allowGeneticData: row.allow_genetic_data,
      includeHospitalRecords: row.include_hospital_records,
      allowView: row.allow_view,
      allowCreateNotes: row.allow_create_notes,
      allowPrescribe: row.allow_prescribe,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      isActive: row.is_active,
      revokedAt: row.revoked_at,
      revokedReason: row.revoked_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      animalName: row.animalName,
      grantedToUserName: row.grantedToUserName,
      grantedToHospitalName: row.grantedToHospitalName,
      grantedToNetworkName: row.grantedToNetworkName,
    };
  }

  // ─── Network Referrals ───────────────────────────────────────

  async createNetworkReferral(data: {
    networkId: string;
    fromHospitalId: string;
    toHospitalId: string;
    fromVetId: string;
    toVetId?: string;
    animalId: string;
    consultationId?: string;
    reason: string;
    priority?: string;
    clinicalNotes?: string;
    createdBy: string;
  }): Promise<any> {
    const fromMember = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND hospital_id = $2 AND is_active = true LIMIT 1`,
      [data.networkId, data.fromHospitalId]
    );
    if (fromMember.rows.length === 0) {
      throw new ValidationError('Referring hospital is not a member of this network');
    }
    const toMember = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND hospital_id = $2 AND is_active = true LIMIT 1`,
      [data.networkId, data.toHospitalId]
    );
    if (toMember.rows.length === 0) {
      throw new ValidationError('Receiving hospital is not a member of this network');
    }

    // Verify caller is a member of this network
    const callerMember = await database.query(
      `SELECT id, network_role FROM hospital_network_members 
       WHERE network_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
      [data.networkId, data.createdBy]
    );
    if (callerMember.rows.length === 0) {
      throw new ForbiddenError('You are not a member of this network');
    }

    const result = await database.query(
      `INSERT INTO network_referrals
        (network_id, from_hospital_id, to_hospital_id, from_vet_id, to_vet_id,
         animal_id, consultation_id, reason, priority, clinical_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.networkId, data.fromHospitalId, data.toHospitalId,
        data.fromVetId, data.toVetId || null,
        data.animalId, data.consultationId || null,
        data.reason, data.priority || 'normal',
        data.clinicalNotes || null, data.createdBy,
      ]
    );
    return result.rows[0];
  }

  async updateNetworkReferralStatus(
    referralId: string,
    status: 'accepted' | 'rejected' | 'completed' | 'cancelled',
    userId: string,
    responseNotes?: string
  ): Promise<any> {
    // First fetch the referral to check authorization
    const referralCheck = await database.query(
      `SELECT r.network_id, r.from_hospital_id, r.to_hospital_id
       FROM network_referrals r WHERE r.id = $1`,
      [referralId]
    );
    if (referralCheck.rows.length === 0) throw new NotFoundError('Network referral');

    const referral = referralCheck.rows[0];
    // Verify caller is a member of this network
    const callerMember = await database.query(
      `SELECT id FROM hospital_network_members 
       WHERE network_id = $1 AND user_id = $2 AND is_active = true LIMIT 1`,
      [referral.network_id, userId]
    );
    if (callerMember.rows.length === 0) {
      throw new ForbiddenError('You are not authorized to update this referral');
    }

    const statusField = status === 'accepted' ? ', accepted_at = NOW()'
      : status === 'rejected' ? ', rejected_at = NOW()' : '';

    const result = await database.query(
      `UPDATE network_referrals
       SET status = $1, response_notes = $2, updated_at = NOW() ${statusField}
       WHERE id = $3
       RETURNING *`,
      [status, responseNotes || null, referralId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Network referral');
    return result.rows[0];
  }

  async listNetworkReferrals(params: {
    networkId?: string;
    hospitalId?: string;
    direction?: 'incoming' | 'outgoing' | 'all';
    animalId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const { page = 1, limit = 20, direction = 'all' } = params;
    const offset = (page - 1) * limit;
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIdx = 1;

    if (params.networkId)  { conditions.push(`nr.network_id = $${paramIdx++}`);  values.push(params.networkId); }
    if (params.animalId)   { conditions.push(`nr.animal_id = $${paramIdx++}`);   values.push(params.animalId); }
    if (params.status)     { conditions.push(`nr.status = $${paramIdx++}`);      values.push(params.status); }
    if (params.hospitalId && direction === 'incoming') {
      conditions.push(`nr.to_hospital_id = $${paramIdx++}`); values.push(params.hospitalId);
    } else if (params.hospitalId && direction === 'outgoing') {
      conditions.push(`nr.from_hospital_id = $${paramIdx++}`); values.push(params.hospitalId);
    } else if (params.hospitalId) {
      conditions.push(`(nr.from_hospital_id = $${paramIdx} OR nr.to_hospital_id = $${paramIdx})`);
      values.push(params.hospitalId); paramIdx++;
    }

    const whereClause = conditions.join(' AND ');
    values.push(limit, offset);

    const result = await database.query(
      `SELECT
         nr.*,
         fh.name AS "fromHospitalName",
         th.name AS "toHospitalName",
         a.name AS "animalName", a.species AS "animalSpecies",
         CONCAT(fv.first_name, ' ', fv.last_name) AS "fromVetName",
         CONCAT(tv.first_name, ' ', tv.last_name) AS "toVetName",
         hn.name AS "networkName"
       FROM network_referrals nr
       LEFT JOIN vet_hospitals fh ON fh.id = nr.from_hospital_id
       LEFT JOIN vet_hospitals th ON th.id = nr.to_hospital_id
       LEFT JOIN animals a ON a.id = nr.animal_id
       LEFT JOIN users fv ON fv.id = nr.from_vet_id
       LEFT JOIN users tv ON tv.id = nr.to_vet_id
       LEFT JOIN hospital_networks hn ON hn.id = nr.network_id
       WHERE ${whereClause}
       ORDER BY nr.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      values
    );

    const countVals = values.slice(0, -2);
    const countResult = await database.query(
      `SELECT COUNT(*) FROM network_referrals nr WHERE ${whereClause}`,
      countVals
    );

    return {
      referrals: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  }

  async getCorporateDashboardStats(userId: string): Promise<{
    totalNetworks: number;
    approvedNetworks: number;
    pendingNetworks: number;
    totalHospitals: number;
    totalMembers: number;
    recentNetworks: any[];
  }> {
    const [networksRes, hospitalsRes, membersRes, recentRes] = await Promise.all([
      database.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_approved = true) as approved,
           COUNT(*) FILTER (WHERE is_approved = false) as pending
         FROM hospital_networks WHERE created_by = $1`,
        [userId]
      ),
      database.query(
        `SELECT COUNT(DISTINCT hnh.hospital_id) as total
         FROM hospital_network_hospitals hnh
         JOIN hospital_networks hn ON hnh.network_id = hn.id
         WHERE hn.created_by = $1`,
        [userId]
      ),
      database.query(
        `SELECT COUNT(DISTINCT hnm.user_id) as total
         FROM hospital_network_members hnm
         JOIN hospital_networks hn ON hnm.network_id = hn.id
         WHERE hn.created_by = $1`,
        [userId]
      ),
      database.query(
        `SELECT id, name, network_type as "networkType", is_approved as "isApproved",
                created_at as "createdAt"
         FROM hospital_networks WHERE created_by = $1
         ORDER BY created_at DESC LIMIT 5`,
        [userId]
      ),
    ]);

    return {
      totalNetworks: parseInt(networksRes.rows[0]?.total || '0'),
      approvedNetworks: parseInt(networksRes.rows[0]?.approved || '0'),
      pendingNetworks: parseInt(networksRes.rows[0]?.pending || '0'),
      totalHospitals: parseInt(hospitalsRes.rows[0]?.total || '0'),
      totalMembers: parseInt(membersRes.rows[0]?.total || '0'),
      recentNetworks: recentRes.rows,
    };
  }

  async createBranchHospital(networkId: string, data: {
    name: string;
    hospitalType?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    description?: string;
    specializations?: string[];
  }, createdById: string): Promise<any> {
    const netCheck = await database.query(
      `SELECT id, created_by FROM hospital_networks WHERE id = $1`,
      [networkId]
    );
    if (netCheck.rows.length === 0) throw new NotFoundError('Hospital network not found');

    // Verify requester has access to this network (admin bypasses)
    const userCheck = await database.query(`SELECT role FROM users WHERE id = $1`, [createdById]);
    if (userCheck.rows.length === 0) throw new ValidationError('Invalid requester');
    if (userCheck.rows[0].role !== 'admin') {
      const accessCheck = await database.query(
        `SELECT id FROM hospital_networks WHERE id = $1 AND created_by = $2
         UNION
         SELECT network_id as id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true
         LIMIT 1`,
        [networkId, createdById]
      );
      if (accessCheck.rows.length === 0) throw new ForbiddenError('You do not have permission to create branch hospitals in this network');
    }

    // Duplicate name check within the same network
    const dupCheck = await database.query(
      `SELECT id FROM vet_hospitals WHERE branch_network_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [networkId, data.name]
    );
    if (dupCheck.rows.length > 0) throw new ConflictError(`A branch hospital named "${data.name}" already exists in this network`);

    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');

      const hospitalResult = await client.query(
        `INSERT INTO vet_hospitals (name, hospital_type, address, city, state, country, postal_code, phone, email,
          description, specializations, owner_id, is_network_branch, branch_network_id, is_verified, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, false, 'approved')
         RETURNING id, name, city, state, hospital_type as "hospitalType"`,
        [
          data.name, data.hospitalType || 'multi_specialty', data.address || null,
          data.city || null, data.state || null, data.country || 'IN',
          data.postalCode || null, data.phone || null, data.email || null,
          data.description || null, data.specializations || [],
          createdById, networkId
        ]
      );

      const hospital = hospitalResult.rows[0];

      await client.query(
        `INSERT INTO hospital_network_hospitals (network_id, hospital_id, joined_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (network_id, hospital_id) DO NOTHING`,
        [networkId, hospital.id]
      );

      await client.query('COMMIT');
      logger.info('Branch hospital created', { networkId, hospitalId: hospital.id, createdById });
      return hospital;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to create branch hospital', { error: error.message, stack: error.stack });
      if (error.code === '23505') throw new ConflictError('A branch hospital with this name already exists');
      if (error.code === '23503') throw new ValidationError('Invalid reference: check that the network and user exist');
      throw new DatabaseError(`Failed to create branch hospital: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // ─── Financial Summary ────────────────────────────────────────
  async getNetworkFinancialSummary(networkId: string): Promise<any> {
    try {
      // Get branch hospital IDs
      const hospitalsResult = await database.query(
        `SELECT hospital_id FROM hospital_network_hospitals WHERE network_id = $1`,
        [networkId]
      );
      const hospitalIds = hospitalsResult.rows.map((r: any) => r.hospital_id);

      if (hospitalIds.length === 0) {
        return {
          totalConsultations: 0, totalBookings: 0, monthlyConsultations: [],
          hospitalBreakdown: [], staffCounts: {}
        };
      }

      const placeholders = hospitalIds.map((_: any, i: number) => `$${i + 1}`).join(',');

      const [consultations, bookings, monthly, perHospital, staffByRole] = await Promise.all([
        database.query(
          `SELECT COUNT(*) as count FROM consultations c
           JOIN bookings b ON b.consultation_id = c.id
           WHERE b.hospital_id IN (${placeholders})`,
          hospitalIds
        ),
        database.query(
          `SELECT COUNT(*) as count FROM bookings WHERE hospital_id IN (${placeholders})`,
          hospitalIds
        ),
        database.query(
          `SELECT DATE_TRUNC('month', c.created_at) as month, COUNT(*) as count
           FROM consultations c
           JOIN bookings b ON b.consultation_id = c.id
           WHERE b.hospital_id IN (${placeholders})
             AND c.created_at >= NOW() - INTERVAL '6 months'
           GROUP BY DATE_TRUNC('month', c.created_at)
           ORDER BY month DESC`,
          hospitalIds
        ),
        database.query(
          `SELECT vh.id, vh.name,
                  (SELECT COUNT(*) FROM bookings WHERE hospital_id = vh.id) as booking_count,
                  (SELECT COUNT(*) FROM appointment_queue WHERE hospital_id = vh.id) as queue_count,
                  (SELECT COUNT(*) FROM inpatient_admissions WHERE hospital_id = vh.id) as inpatient_count
           FROM vet_hospitals vh
           WHERE vh.id IN (${placeholders})`,
          hospitalIds
        ),
        database.query(
          `SELECT network_role, COUNT(*) as count
           FROM hospital_network_members
           WHERE network_id = $1 AND is_active = true
           GROUP BY network_role`,
          [networkId]
        ),
      ]);

      const staffCounts: Record<string, number> = {};
      for (const row of staffByRole.rows) {
        staffCounts[row.network_role] = parseInt(row.count);
      }

      return {
        totalConsultations: parseInt(consultations.rows[0]?.count || '0'),
        totalBookings: parseInt(bookings.rows[0]?.count || '0'),
        monthlyConsultations: monthly.rows.map((r: any) => ({
          month: r.month,
          count: parseInt(r.count),
        })),
        hospitalBreakdown: perHospital.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          bookings: parseInt(r.booking_count || '0'),
          queueVisits: parseInt(r.queue_count || '0'),
          inpatients: parseInt(r.inpatient_count || '0'),
        })),
        staffCounts,
      };
    } catch (error) {
      throw new DatabaseError('Error fetching network financial summary', { originalError: error });
    }
  }

  // ─── Leave Management ───────────────────────────────────────
  async createLeaveRequest(data: {
    networkId: string; hospitalId?: string; userId: string;
    leaveType: string; startDate: string; endDate: string; reason?: string;
  }): Promise<any> {
    const member = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
      [data.networkId, data.userId]
    );
    if (member.rows.length === 0) throw new ValidationError('Not a member of this network');

    const result = await database.query(
      `INSERT INTO staff_leave_requests (network_id, hospital_id, user_id, leave_type, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.networkId, data.hospitalId || null, data.userId, data.leaveType, data.startDate, data.endDate, data.reason || null]
    );
    return result.rows[0];
  }

  async listLeaveRequests(networkId: string, filters: {
    hospitalId?: string; userId?: string; status?: string;
    page?: number; limit?: number;
  } = {}): Promise<{ rows: any[]; total: number }> {
    const conditions: string[] = ['lr.network_id = $1'];
    const params: any[] = [networkId];
    let idx = 1;

    if (filters.hospitalId) { idx++; conditions.push(`lr.hospital_id = $${idx}`); params.push(filters.hospitalId); }
    if (filters.userId) { idx++; conditions.push(`lr.user_id = $${idx}`); params.push(filters.userId); }
    if (filters.status) { idx++; conditions.push(`lr.status = $${idx}`); params.push(filters.status); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const [rowsResult, countResult] = await Promise.all([
      database.query(
        `SELECT lr.*,
                COALESCE(u.first_name || ' ' || u.last_name, '') as "userName",
                COALESCE(ap.first_name || ' ' || ap.last_name, '') as "approverName",
                vh.name as "hospitalName"
         FROM staff_leave_requests lr
         LEFT JOIN users u ON u.id = lr.user_id
         LEFT JOIN users ap ON ap.id = lr.approved_by
         LEFT JOIN vet_hospitals vh ON vh.id = lr.hospital_id
         ${where}
         ORDER BY lr.created_at DESC
         LIMIT $${idx + 1} OFFSET $${idx + 2}`,
        [...params, limit, offset]
      ),
      database.query(
        `SELECT COUNT(*) as count FROM staff_leave_requests lr ${where}`,
        params
      ),
    ]);

    return {
      rows: rowsResult.rows,
      total: parseInt(countResult.rows[0]?.count || '0'),
    };
  }

  async updateLeaveRequestStatus(
    requestId: string, status: 'approved' | 'rejected' | 'cancelled',
    userId: string, rejectionReason?: string
  ): Promise<any> {
    const extraFields = status === 'approved' ? ', approved_by = $4, approved_at = NOW()' : '';
    const result = await database.query(
      `UPDATE staff_leave_requests
       SET status = $1, rejection_reason = $2, updated_at = NOW() ${extraFields}
       WHERE id = $3 RETURNING *`,
      status === 'approved'
        ? [status, rejectionReason || null, requestId, userId]
        : [status, rejectionReason || null, requestId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Leave request');
    return result.rows[0];
  }

  // ─── Patient Transfer ───────────────────────────────────────
  async createPatientTransfer(data: {
    networkId: string; fromHospitalId: string; toHospitalId: string;
    animalId: string; reason: string; transferReason?: string;
    clinicalNotes?: string; createdBy: string;
  }): Promise<any> {
    const fromCheck = await database.query(
      `SELECT id FROM hospital_network_hospitals WHERE network_id = $1 AND hospital_id = $2`,
      [data.networkId, data.fromHospitalId]
    );
    if (fromCheck.rows.length === 0) throw new ValidationError('Source hospital is not in this network');

    const toCheck = await database.query(
      `SELECT id FROM hospital_network_hospitals WHERE network_id = $1 AND hospital_id = $2`,
      [data.networkId, data.toHospitalId]
    );
    if (toCheck.rows.length === 0) throw new ValidationError('Destination hospital is not in this network');

    const callerCheck = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
      [data.networkId, data.createdBy]
    );
    if (callerCheck.rows.length === 0) throw new ForbiddenError('Not authorized to create transfers');

    const result = await database.query(
      `INSERT INTO network_referrals
        (network_id, from_hospital_id, to_hospital_id, animal_id, reason,
         clinical_notes, transfer_reason, referral_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'transfer', $8)
       RETURNING *`,
      [data.networkId, data.fromHospitalId, data.toHospitalId, data.animalId,
       data.reason, data.clinicalNotes || null, data.transferReason || null, data.createdBy]
    );
    return result.rows[0];
  }

  async completePatientTransfer(transferId: string, userId: string): Promise<any> {
    const transfer = await database.query(
      `SELECT * FROM network_referrals WHERE id = $1 AND referral_type = 'transfer'`,
      [transferId]
    );
    if (transfer.rows.length === 0) throw new NotFoundError('Patient transfer');

    const callerCheck = await database.query(
      `SELECT id FROM hospital_network_members
       WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
      [transfer.rows[0].network_id, userId]
    );
    if (callerCheck.rows.length === 0) throw new ForbiddenError('Not authorized');

    await database.query(
      `UPDATE animal_care_contexts
       SET hospital_id = $1
       WHERE network_id = $2 AND animal_id = $3 AND is_active = true`,
      [transfer.rows[0].to_hospital_id, transfer.rows[0].network_id, transfer.rows[0].animal_id]
    );

    const result = await database.query(
      `UPDATE network_referrals
       SET status = 'completed', transferred_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transferId]
    );
    return result.rows[0];
  }
}

export default new HospitalNetworkService();

// ─── Update Branch Hospital───────────────────────────────────────────────────
export async function updateBranchHospital(hospitalId: string, networkId: string, data: {
  name?: string; hospitalType?: string; address?: string; city?: string; state?: string;
  country?: string; postalCode?: string; phone?: string; email?: string;
  description?: string; specializations?: string[];
}) {
  const result = await database.query(
    `UPDATE vet_hospitals SET
       name = COALESCE($1, name),
       hospital_type = COALESCE($2, hospital_type),
       address = COALESCE($3, address),
       city = COALESCE($4, city),
       state = COALESCE($5, state),
       country = COALESCE($6, country),
       postal_code = COALESCE($7, postal_code),
       phone = COALESCE($8, phone),
       email = COALESCE($9, email),
       description = COALESCE($10, description),
       specializations = COALESCE($11, specializations),
       updated_at = NOW()
     WHERE id = $12 AND branch_network_id = $13 AND is_network_branch = true
     RETURNING id, name, city, state, hospital_type AS "hospitalType", phone, email, description, specializations`,
    [
      data.name || null, data.hospitalType || null, data.address || null,
      data.city || null, data.state || null, data.country || null,
      data.postalCode || null, data.phone || null, data.email || null,
      data.description || null, data.specializations ? JSON.stringify(data.specializations) : null,
      hospitalId, networkId
    ]
  );
  if (result.rows.length === 0) throw new NotFoundError('Branch hospital not found in this network');
  return result.rows[0];
}

// ─── Delete Branch Hospital ───────────────────────────────────────────────────
export async function deleteBranchHospital(hospitalId: string, networkId: string) {
  const check = await database.query(
    `SELECT id FROM vet_hospitals WHERE id = $1 AND branch_network_id = $2 AND is_network_branch = true`,
    [hospitalId, networkId]
  );
  if (check.rows.length === 0) throw new NotFoundError('Branch hospital not found in this network');
  // Remove from junction table
  await database.query(`DELETE FROM hospital_network_hospitals WHERE hospital_id = $1 AND network_id = $2`, [hospitalId, networkId]);
  // Mark hospital as inactive rather than hard delete
  await database.query(`UPDATE vet_hospitals SET is_active = false, updated_at = NOW() WHERE id = $1`, [hospitalId]);
  return { success: true };
}
