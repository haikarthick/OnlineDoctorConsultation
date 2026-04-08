import database from '../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

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
  // joined
  approvedByName?: string;
  memberCount?: number;
  hospitalCount?: number;
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

export class HospitalNetworkService {

  // ─── Network CRUD ─────────────────────────────────────────────
  async createNetwork(data: HospitalNetworkCreateDTO, createdById: string): Promise<HospitalNetwork> {
    try {
      const result = await database.query(
        `INSERT INTO hospital_networks
           (name, legal_name, registration_number, tax_id, network_type,
            country, headquarters_address, headquarters_city, headquarters_state,
            contact_email, contact_phone, website, logo_url,
            dpo_name, dpo_email, data_residency_region, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
        ]
      );

      // Auto-add creator as corporate_admin
      await database.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, granted_by)
         VALUES ($1, $2, 'corporate_admin', $2)`,
        [result.rows[0].id, createdById]
      );

      logger.info(`Hospital network created: ${data.name}`, { networkId: result.rows[0].id, createdById });
      return this.mapNetworkRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create hospital network', { error: error.message });
      throw new DatabaseError('Failed to create hospital network');
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

    if (setClauses.length === 0) throw new Error('No fields to update');
    params.push(id);

    await database.query(
      `UPDATE hospital_networks SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      params
    );

    return this.getNetworkById(id);
  }

  async approveNetwork(id: string, approverId: string): Promise<void> {
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
    grantedBy?: string
  ): Promise<void> {
    try {
      await database.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, hospital_id, granted_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (network_id, user_id)
         DO UPDATE SET network_role = $3, hospital_id = $4, is_active = true, granted_at = NOW()`,
        [networkId, userId, role, hospitalId ?? null, grantedBy ?? null]
      );
    } catch (error: any) {
      logger.error('Failed to add network member', { error: error.message });
      throw new DatabaseError('Failed to add network member');
    }
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

  // ─── Hospital Assignment ───────────────────────────────────────
  async assignHospitalToNetwork(networkId: string, hospitalId: string, assignedBy: string): Promise<void> {
    // Verify network exists
    await this.getNetworkById(networkId);

    try {
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

  async listNetworkHospitals(networkId: string): Promise<any[]> {
    const result = await database.query(
      `SELECT DISTINCT vh.id,
              vh.name,
              vh.city,
              vh.state,
              vh.contact_email AS "contactEmail",
              vh.contact_phone AS "contactPhone",
              vh.is_verified AS "isVerified",
              vh.specializations,
              (SELECT COUNT(*) FROM hospital_network_members
               WHERE network_id = $1 AND hospital_id = vh.id AND is_active = true) AS "staffCount"
       FROM hospital_network_members hnm
       JOIN vet_hospitals vh ON hnm.hospital_id = vh.id
       WHERE hnm.network_id = $1 AND hnm.hospital_id IS NOT NULL AND hnm.is_active = true
       ORDER BY vh.name ASC`,
      [networkId]
    );
    return result.rows;
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
                a.name AS "animalName",
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedByName: row.approvedByName,
      memberCount: row.memberCount !== undefined ? parseInt(row.memberCount) : undefined,
      hospitalCount: row.hospitalCount !== undefined ? parseInt(row.hospitalCount) : undefined,
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
}

export default new HospitalNetworkService();
