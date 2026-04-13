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
        throw new Error('Network ID prefix is already in use by another network. Please choose a different prefix.');
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
            dpo_name, dpo_email, data_residency_region, metadata, id_prefix)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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

  async listNetworkHospitals(networkId: string, page: number = 1, limit: number = 20): Promise<any> {
    const offset = (page - 1) * limit;
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
       ORDER BY vh.name ASC
       LIMIT $2 OFFSET $3`,
      [networkId, limit, offset]
    );
    const countResult = await database.query(
      `SELECT COUNT(DISTINCT hnm.hospital_id) AS count
       FROM hospital_network_members hnm
       WHERE hnm.network_id = $1 AND hnm.hospital_id IS NOT NULL AND hnm.is_active = true`,
      [networkId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0');
    return {
      hospitals: result.rows,
      total,
      page,
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
          throw new Error('Hospital is not a member of this network');
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
        throw new Error('You do not have permission to enroll patients in this network');
      }

      const animalRes = await database.query(
        `SELECT a.id, a.species, a.unique_id, a.name AS animal_name, a.owner_id,
                u.name AS owner_name
         FROM animals a JOIN users u ON a.owner_id = u.id
         WHERE a.id = $1 AND a.is_active = true`, [data.animalId]
      );
      if (!animalRes.rows[0]) throw new Error('Animal not found');
      const animal = animalRes.rows[0];

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

      // TODO: Send in-app notification to animal owner via NotificationService
      // (not inlined here to avoid circular dependencies — caller may handle separately)
      logger.info('Enrollment request created', { networkName, animalName: animal.animal_name, ownerId: animal.owner_id });

      return result.rows[0];
    } catch (err: any) {
      throw new Error(`Enroll animal failed: ${err.message}`);
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
      throw new Error(`Get network patients failed: ${err.message}`);
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
      throw new Error(`Search patients failed: ${err.message}`);
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
      if (!check.rows[0]) throw new Error('Enrollment request not found or already responded');
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
      throw new Error(`Accept enrollment failed: ${err.message}`);
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
      if (!result.rows[0]) throw new Error('Enrollment request not found');
    } catch (err: any) {
      throw new Error(`Decline enrollment failed: ${err.message}`);
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
      throw new Error(`Get my enrollments failed: ${err.message}`);
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
      throw new Error(`Invite walk-in patient failed: ${err.message}`);
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
        throw new Error('Invitation not found. Please check the link and try again.');
      }
      const invite = inviteRes.rows[0];

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw new Error('This invitation has expired. Please request a new invitation.');
      }
      if (invite.status !== 'pending') {
        throw new Error(`This invitation has already been ${invite.status}.`);
      }

      await database.query(
        `UPDATE hospital_patient_invites
         SET status = 'accepted', accepted_at = NOW(), accepted_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [acceptedByUserId, invite.id]
      );
      return { id: invite.id, networkId: invite.network_id, hospitalId: invite.hospital_id };
    } catch (err: any) {
      throw new Error(err.message);
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
      throw new Error(`Get pending enrollments failed: ${err.message}`);
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
        throw new Error('Only network administrators can deactivate a network');
      }
    }
    const result = await database.query(
      `UPDATE hospital_networks SET is_active = false, updated_at = NOW() 
       WHERE id = $1 RETURNING id, name, is_active AS "isActive"`,
      [networkId]
    );
    if (result.rows.length === 0) throw new Error('Network not found');
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
