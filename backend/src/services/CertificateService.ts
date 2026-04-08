import database from '../utils/database';
import logger from '../utils/logger';

// 18 valid certificate types (14 original + 4 new farm/enterprise types)
const VALID_CERT_TYPES = [
  'health_certificate', 'fitness_to_travel', 'rabies_vaccination', 'vaccination_record',
  'pre_travel', 'sterilization', 'treatment', 'animal_injury', 'post_mortem',
  'breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation',
  'fitness_for_sale', 'animal_valuation',
  // Farm/enterprise-specific types
  'movement_permit', 'herd_health_certificate', 'slaughter_fitness', 'export_health_certificate',
];

export interface CertificateData {
  certificateType: string;
  animalId?: string;
  petOwnerId?: string;
  consultationId?: string;
  bookingId?: string;
  enterpriseId?: string;
  examinationDate?: string;
  clinicalFindings?: string;
  diagnosis?: string;
  treatmentSummary?: string;
  recommendations?: string;
  vaccinationDetails?: object;
  travelDetails?: object;
  breedingDetails?: object;
  valuationDetails?: object;
  movementDetails?: object;  // farm: fromLocation, toLocation, vehicleNumber, transportDate, driverName
  herdDetails?: object;       // farm: groupName, animalCount, species, purpose, animalIds
  validUntil?: string;
  notes?: string;
}

class CertificateService {
  private async generateCertNumber(): Promise<string> {
    // Get prefix from system_settings
    const prefixRow = await database.query(
      `SELECT value FROM system_settings WHERE key = 'cert.autoNumberPrefix'`
    );
    const prefix = prefixRow.rows[0]?.value || 'VC';
    const year = new Date().getFullYear();
    // Sequence: MAX of serial part for this year
    const seqRow = await database.query(
      `SELECT certificate_number FROM vet_certificates
       WHERE certificate_number LIKE $1
       ORDER BY certificate_number DESC LIMIT 1`,
      [`${prefix}-${year}-%`]
    );
    let seq = 1;
    if (seqRow.rows.length > 0) {
      const last = seqRow.rows[0].certificate_number;
      const parts = last.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }

  async create(vetId: string, data: CertificateData): Promise<any> {
    if (!VALID_CERT_TYPES.includes(data.certificateType)) {
      throw new Error(`Invalid certificate type: ${data.certificateType}`);
    }
    // Draft: no certificate number yet until issued
    const result = await database.query(
      `INSERT INTO vet_certificates (
         id, certificate_number, certificate_type, status, veterinarian_id,
         pet_owner_id, animal_id, consultation_id, booking_id, enterprise_id,
         examination_date, clinical_findings, diagnosis, treatment_summary,
         recommendations, vaccination_details, travel_details, breeding_details,
         valuation_details, movement_details, herd_details, valid_until, notes
       ) VALUES (
         gen_random_uuid(), $1, $2, 'draft', $3,
         $4, $5, $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20, $21
       )
       RETURNING *`,
      [
        `DRAFT-${Date.now()}`,  // Temporary placeholder — replaced on issue
        data.certificateType, vetId,
        data.petOwnerId || null, data.animalId || null,
        data.consultationId || null, data.bookingId || null, data.enterpriseId || null,
        data.examinationDate || null, data.clinicalFindings || null,
        data.diagnosis || null, data.treatmentSummary || null,
        data.recommendations || null,
        data.vaccinationDetails ? JSON.stringify(data.vaccinationDetails) : null,
        data.travelDetails ? JSON.stringify(data.travelDetails) : null,
        data.breedingDetails ? JSON.stringify(data.breedingDetails) : null,
        data.valuationDetails ? JSON.stringify(data.valuationDetails) : null,
        data.movementDetails ? JSON.stringify(data.movementDetails) : null,
        data.herdDetails ? JSON.stringify(data.herdDetails) : null,
        data.validUntil || null, data.notes || null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, vetId: string, role: string, data: Partial<CertificateData>): Promise<any> {
    // Only vet who created it (or admin) can update; only drafts can be edited
    const existing = await database.query(
      `SELECT * FROM vet_certificates WHERE id = $1`, [id]
    );
    if (!existing.rows.length) throw new Error('Certificate not found');
    const cert = existing.rows[0];
    if (cert.status !== 'draft') throw new Error('Only draft certificates can be edited');
    if (role !== 'admin' && cert.veterinarian_id !== vetId) throw new Error('Unauthorized');

    const fields: string[] = [];
    const vals: any[] = [];
    let p = 1;

    const setField = (col: string, val: any) => {
      if (val !== undefined) { fields.push(`${col} = $${p++}`); vals.push(val); }
    };

    setField('examination_date', data.examinationDate);
    setField('clinical_findings', data.clinicalFindings);
    setField('diagnosis', data.diagnosis);
    setField('treatment_summary', data.treatmentSummary);
    setField('recommendations', data.recommendations);
    setField('valid_until', data.validUntil);
    setField('notes', data.notes);
    setField('vaccination_details', data.vaccinationDetails ? JSON.stringify(data.vaccinationDetails) : undefined);
    setField('travel_details', data.travelDetails ? JSON.stringify(data.travelDetails) : undefined);
    setField('breeding_details', data.breedingDetails ? JSON.stringify(data.breedingDetails) : undefined);
    setField('valuation_details', data.valuationDetails ? JSON.stringify(data.valuationDetails) : undefined);
    setField('movement_details', data.movementDetails ? JSON.stringify(data.movementDetails) : undefined);
    setField('herd_details', data.herdDetails ? JSON.stringify(data.herdDetails) : undefined);
    if (data.animalId !== undefined) setField('animal_id', data.animalId);
    if (data.petOwnerId !== undefined) setField('pet_owner_id', data.petOwnerId);
    if (data.consultationId !== undefined) setField('consultation_id', data.consultationId);
    if (data.enterpriseId !== undefined) setField('enterprise_id', data.enterpriseId || null);

    if (fields.length === 0) return cert;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(id);

    const result = await database.query(
      `UPDATE vet_certificates SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
      vals
    );
    return result.rows[0];
  }

  async issue(id: string, vetId: string, role: string): Promise<any> {
    const existing = await database.query(
      `SELECT * FROM vet_certificates WHERE id = $1`, [id]
    );
    if (!existing.rows.length) throw new Error('Certificate not found');
    const cert = existing.rows[0];
    if (cert.status !== 'draft') throw new Error('Only draft certificates can be issued');
    if (role !== 'admin' && cert.veterinarian_id !== vetId) throw new Error('Unauthorized');

    const certNumber = await this.generateCertNumber();
    const result = await database.query(
      `UPDATE vet_certificates
       SET certificate_number = $1, status = 'active', issued_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [certNumber, id]
    );
    return result.rows[0];
  }

  async revoke(id: string, vetId: string, role: string, reason: string): Promise<any> {
    const existing = await database.query(
      `SELECT * FROM vet_certificates WHERE id = $1`, [id]
    );
    if (!existing.rows.length) throw new Error('Certificate not found');
    const cert = existing.rows[0];
    if (cert.status === 'revoked') throw new Error('Certificate is already revoked');
    if (role !== 'admin' && cert.veterinarian_id !== vetId) throw new Error('Unauthorized');

    const result = await database.query(
      `UPDATE vet_certificates
       SET status = 'revoked', revocation_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );
    return result.rows[0];
  }

  async deleteDraft(id: string, vetId: string, role: string): Promise<void> {
    const existing = await database.query(
      `SELECT * FROM vet_certificates WHERE id = $1`, [id]
    );
    if (!existing.rows.length) throw new Error('Certificate not found');
    const cert = existing.rows[0];
    if (cert.status !== 'draft') throw new Error('Only draft certificates can be deleted');
    if (role !== 'admin' && cert.veterinarian_id !== vetId) throw new Error('Unauthorized');

    await database.query(`DELETE FROM vet_certificates WHERE id = $1`, [id]);
  }

  async getById(id: string): Promise<any> {
    const result = await database.query(
      `SELECT
         vc.*,
         u_vet.first_name as "vetFirstName", u_vet.last_name as "vetLastName",
         u_vet.email as "vetEmail",
         vp.license_number as "vetLicenseNumber", vp.specializations as "vetSpecializations",
         vp.clinic_name as "vetClinicName",
         u_owner.first_name as "ownerFirstName", u_owner.last_name as "ownerLastName",
         u_owner.email as "ownerEmail",
         a.name as "animalName", a.species as "animalSpecies", a.breed as "animalBreed",
         a.date_of_birth as "animalDob", a.gender as "animalGender"
       FROM vet_certificates vc
       LEFT JOIN users u_vet ON u_vet.id = vc.veterinarian_id
       LEFT JOIN vet_profiles vp ON vp.user_id = vc.veterinarian_id
       LEFT JOIN users u_owner ON u_owner.id = vc.pet_owner_id
       LEFT JOIN animals a ON a.id = vc.animal_id
       WHERE vc.id = $1`,
      [id]
    );
    if (!result.rows.length) return null;
    return this.mapRow(result.rows[0]);
  }

  async listByVet(vetId: string, params: { limit?: number; offset?: number; type?: string; status?: string; animalId?: string; enterpriseId?: string }): Promise<{ certificates: any[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    let where = `WHERE vc.veterinarian_id = $1`;
    const vals: any[] = [vetId];
    let p = 2;

    if (params.type) { where += ` AND vc.certificate_type = $${p++}`; vals.push(params.type); }
    if (params.status) { where += ` AND vc.status = $${p++}`; vals.push(params.status); }
    if (params.animalId) { where += ` AND vc.animal_id = $${p++}`; vals.push(params.animalId); }
    if (params.enterpriseId) { where += ` AND vc.enterprise_id = $${p++}`; vals.push(params.enterpriseId); }

    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM vet_certificates vc ${where}`, vals
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await database.query(
      `SELECT vc.*, 
         u_owner.first_name as "ownerFirstName", u_owner.last_name as "ownerLastName",
         a.name as "animalName", a.species as "animalSpecies", a.unique_id as "animalUniqueId",
         e.name as "enterpriseName"
       FROM vet_certificates vc
       LEFT JOIN users u_owner ON u_owner.id = vc.pet_owner_id
       LEFT JOIN animals a ON a.id = vc.animal_id
       LEFT JOIN enterprises e ON e.id = vc.enterprise_id
       ${where}
       ORDER BY vc.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...vals, limit, offset]
    );
    return { certificates: result.rows.map((r: any) => this.mapListRow(r)), total };
  }

  async listByOwner(ownerId: string, params: { limit?: number; offset?: number; type?: string; status?: string; animalId?: string; enterpriseId?: string }): Promise<{ certificates: any[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    let where = `WHERE vc.pet_owner_id = $1`;
    const vals: any[] = [ownerId];
    let p = 2;

    if (params.type) { where += ` AND vc.certificate_type = $${p++}`; vals.push(params.type); }
    if (params.status) { where += ` AND vc.status = $${p++}`; vals.push(params.status); }
    if (params.animalId) { where += ` AND vc.animal_id = $${p++}`; vals.push(params.animalId); }
    if (params.enterpriseId) { where += ` AND vc.enterprise_id = $${p++}`; vals.push(params.enterpriseId); }

    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM vet_certificates vc ${where}`, vals
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await database.query(
      `SELECT vc.*,
         u_vet.first_name as "vetFirstName", u_vet.last_name as "vetLastName",
         a.name as "animalName", a.species as "animalSpecies", a.unique_id as "animalUniqueId",
         e.name as "enterpriseName"
       FROM vet_certificates vc
       LEFT JOIN users u_vet ON u_vet.id = vc.veterinarian_id
       LEFT JOIN animals a ON a.id = vc.animal_id
       LEFT JOIN enterprises e ON e.id = vc.enterprise_id
       ${where}
       ORDER BY vc.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...vals, limit, offset]
    );
    return { certificates: result.rows.map((r: any) => this.mapListRow(r)), total };
  }

  async listByAnimal(animalId: string): Promise<{ certificates: any[]; total: number }> {
    const result = await database.query(
      `SELECT vc.*,
         u_vet.first_name as "vetFirstName", u_vet.last_name as "vetLastName",
         u_owner.first_name as "ownerFirstName", u_owner.last_name as "ownerLastName",
         a.unique_id as "animalUniqueId", e.name as "enterpriseName"
       FROM vet_certificates vc
       LEFT JOIN users u_vet ON u_vet.id = vc.veterinarian_id
       LEFT JOIN users u_owner ON u_owner.id = vc.pet_owner_id
       LEFT JOIN animals a ON a.id = vc.animal_id
       LEFT JOIN enterprises e ON e.id = vc.enterprise_id
       WHERE vc.animal_id = $1
       ORDER BY vc.created_at DESC`,
      [animalId]
    );
    return { certificates: result.rows.map((r: any) => this.mapListRow(r)), total: result.rows.length };
  }

  async listAll(params: { limit?: number; offset?: number; type?: string; status?: string; search?: string; enterpriseId?: string }): Promise<{ certificates: any[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    let where = `WHERE 1=1`;
    const vals: any[] = [];
    let p = 1;

    if (params.type) { where += ` AND vc.certificate_type = $${p++}`; vals.push(params.type); }
    if (params.status) { where += ` AND vc.status = $${p++}`; vals.push(params.status); }
    if (params.enterpriseId) { where += ` AND vc.enterprise_id = $${p++}`; vals.push(params.enterpriseId); }
    if (params.search) {
      where += ` AND (u_vet.first_name ILIKE $${p} OR u_vet.last_name ILIKE $${p}
                 OR u_owner.first_name ILIKE $${p} OR u_owner.last_name ILIKE $${p}
                 OR a.name ILIKE $${p} OR a.unique_id ILIKE $${p} OR vc.certificate_number ILIKE $${p})`;
      vals.push(`%${params.search}%`); p++;
    }

    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM vet_certificates vc
       LEFT JOIN users u_vet ON u_vet.id = vc.veterinarian_id
       LEFT JOIN users u_owner ON u_owner.id = vc.pet_owner_id
       LEFT JOIN animals a ON a.id = vc.animal_id
       ${where}`, vals
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await database.query(
      `SELECT vc.*,
         u_vet.first_name as "vetFirstName", u_vet.last_name as "vetLastName",
         u_owner.first_name as "ownerFirstName", u_owner.last_name as "ownerLastName",
         a.name as "animalName", a.species as "animalSpecies", a.unique_id as "animalUniqueId",
         e.name as "enterpriseName"
       FROM vet_certificates vc
       LEFT JOIN users u_vet ON u_vet.id = vc.veterinarian_id
       LEFT JOIN users u_owner ON u_owner.id = vc.pet_owner_id
       LEFT JOIN animals a ON a.id = vc.animal_id
       LEFT JOIN enterprises e ON e.id = vc.enterprise_id
       ${where}
       ORDER BY vc.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...vals, limit, offset]
    );
    return { certificates: result.rows.map((r: any) => this.mapListRow(r)), total };
  }

  private mapListRow(r: any): any {
    return {
      id: r.id,
      certificateNumber: r.certificate_number,
      certificateType: r.certificate_type,
      status: r.status,
      veterinarianId: r.veterinarian_id,
      petOwnerId: r.pet_owner_id,
      animalId: r.animal_id,
      enterpriseId: r.enterprise_id,
      examinationDate: r.examination_date,
      issuedAt: r.issued_at,
      validUntil: r.valid_until,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      vetFirstName: r.vetFirstName,
      vetLastName: r.vetLastName,
      ownerFirstName: r.ownerFirstName,
      ownerLastName: r.ownerLastName,
      animalName: r.animalName,
      animalSpecies: r.animalSpecies,
      animalUniqueId: r.animalUniqueId,
      enterpriseName: r.enterpriseName,
    };
  }

  private mapRow(r: any): any {
    return {
      id: r.id,
      certificateNumber: r.certificate_number,
      certificateType: r.certificate_type,
      status: r.status,
      veterinarianId: r.veterinarian_id,
      petOwnerId: r.pet_owner_id,
      animalId: r.animal_id,
      consultationId: r.consultation_id,
      bookingId: r.booking_id,
      enterpriseId: r.enterprise_id,
      examinationDate: r.examination_date,
      clinicalFindings: r.clinical_findings,
      diagnosis: r.diagnosis,
      treatmentSummary: r.treatment_summary,
      recommendations: r.recommendations,
      vaccinationDetails: r.vaccination_details,
      travelDetails: r.travel_details,
      breedingDetails: r.breeding_details,
      valuationDetails: r.valuation_details,
      movementDetails: r.movement_details,
      herdDetails: r.herd_details,
      issuedAt: r.issued_at,
      validUntil: r.valid_until,
      notes: r.notes,
      revocationReason: r.revocation_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      vetFirstName: r.vetFirstName,
      vetLastName: r.vetLastName,
      vetEmail: r.vetEmail,
      vetLicenseNumber: r.vetLicenseNumber,
      vetSpecializations: r.vetSpecializations,
      vetClinicName: r.vetClinicName,
      ownerFirstName: r.ownerFirstName,
      ownerLastName: r.ownerLastName,
      ownerEmail: r.ownerEmail,
      animalName: r.animalName,
      animalSpecies: r.animalSpecies,
      animalBreed: r.animalBreed,
      animalDob: r.animalDob,
      animalGender: r.animalGender,
    };
  }
}

export default new CertificateService();
