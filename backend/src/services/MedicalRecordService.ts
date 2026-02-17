import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

// ─── Interfaces ─────────────────────────────────────────────
export interface MedicalRecord {
  id: string;
  userId: string;
  animalId?: string;
  consultationId?: string;
  veterinarianId?: string;
  recordType: string;
  recordNumber: string;
  title: string;
  content: string;
  severity: string;
  status: string;
  medications: any[];
  attachments: any[];
  isConfidential: boolean;
  followUpDate?: string;
  tags: string[];
  fileUrl?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  ownerName?: string;
  animalName?: string;
  animalUniqueId?: string;
  ownerUniqueId?: string;
  veterinarianName?: string;
}

export interface MedicalRecordCreateDTO {
  animalId?: string;
  consultationId?: string;
  veterinarianId?: string;
  recordType: string;
  title: string;
  content: string;
  severity?: string;
  medications?: any[];
  attachments?: any[];
  isConfidential?: boolean;
  followUpDate?: string;
  tags?: string[];
  fileUrl?: string;
  userId?: string;
}

export interface VaccinationRecord {
  id: string;
  animalId: string;
  vaccineName: string;
  vaccineType?: string;
  batchNumber?: string;
  manufacturer?: string;
  dateAdministered: string;
  nextDueDate?: string;
  administeredBy?: string;
  siteOfAdministration?: string;
  dosage?: string;
  reactionNotes?: string;
  isValid: boolean;
  certificateNumber?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  administeredByName?: string;
  animalName?: string;
  animalUniqueId?: string;
}

export interface WeightRecord {
  id: string;
  animalId: string;
  weight: number;
  unit: string;
  recordedAt: string;
  recordedBy?: string;
  notes?: string;
  createdAt: Date;
  recordedByName?: string;
}

export interface AllergyRecord {
  id: string;
  animalId: string;
  allergen: string;
  reaction?: string;
  severity: string;
  identifiedDate?: string;
  isActive: boolean;
  notes?: string;
  reportedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  reportedByName?: string;
}

export interface LabResult {
  id: string;
  animalId: string;
  consultationId?: string;
  medicalRecordId?: string;
  testName: string;
  testCategory?: string;
  testDate: string;
  resultValue?: string;
  normalRange?: string;
  unit?: string;
  status: string;
  interpretation?: string;
  labName?: string;
  orderedBy?: string;
  verifiedBy?: string;
  isAbnormal: boolean;
  attachments: any[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  orderedByName?: string;
  verifiedByName?: string;
  animalName?: string;
  animalUniqueId?: string;
}

export interface MedicalAuditEntry {
  id: string;
  recordId: string;
  recordType: string;
  action: string;
  changedBy?: string;
  changedByName?: string;
  oldValues?: any;
  newValues?: any;
  changeReason?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface MedicalTimeline {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  severity?: string;
  status?: string;
  createdBy?: string;
  createdByName?: string;
  metadata?: any;
}

// ─── Helpers ────────────────────────────────────────────────
async function generateRecordNumber(): Promise<string> {
  try {
    const result = await database.query(`SELECT COUNT(*) as count FROM medical_records`);
    const count = parseInt(result.rows[0]?.count || '0', 10) + 1;
    return `MR-${count.toString().padStart(6, '0')}`;
  } catch {
    return `MR-${Date.now().toString(36).toUpperCase()}`;
  }
}

async function generateUniqueId(prefix: string, table: string): Promise<string> {
  try {
    const result = await database.query(`SELECT COUNT(*) as count FROM ${table}`);
    const count = parseInt(result.rows[0]?.count || '0', 10) + 1;
    return `${prefix}-${count.toString().padStart(5, '0')}`;
  } catch {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }
}

async function logMedicalAudit(
  recordId: string, recordType: string, action: string,
  changedBy: string | undefined, changedByName: string | undefined,
  oldValues?: any, newValues?: any, changeReason?: string, ipAddress?: string
): Promise<void> {
  try {
    await database.query(`
      INSERT INTO medical_record_audit_log (id, record_id, record_type, action, changed_by, changed_by_name, old_values, new_values, change_reason, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    `, [
      uuidv4(), recordId, recordType, action,
      changedBy || null, changedByName || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changeReason || null, ipAddress || null
    ]);
  } catch (err) {
    logger.error('Medical audit log failed', { err, recordId, action });
  }
}

// ─── SQL Fragments ──────────────────────────────────────────
const RECORD_SELECT = `
  mr.id, mr.user_id as "userId", mr.animal_id as "animalId",
  mr.consultation_id as "consultationId", mr.veterinarian_id as "veterinarianId",
  mr.record_type as "recordType", mr.record_number as "recordNumber",
  mr.title, mr.content, mr.severity, mr.status,
  mr.medications, mr.attachments, mr.is_confidential as "isConfidential",
  mr.follow_up_date as "followUpDate", mr.tags, mr.file_url as "fileUrl",
  mr.created_by as "createdBy", mr.created_at as "createdAt", mr.updated_at as "updatedAt",
  COALESCE(ou.first_name || ' ' || ou.last_name, '') as "ownerName",
  COALESCE(ou.unique_id, '') as "ownerUniqueId",
  COALESCE(a.name, '') as "animalName",
  COALESCE(a.unique_id, '') as "animalUniqueId",
  COALESCE(vu.first_name || ' ' || vu.last_name, '') as "veterinarianName"
`;

const RECORD_FROM = `
  FROM medical_records mr
  LEFT JOIN users ou ON ou.id = mr.user_id
  LEFT JOIN animals a ON a.id = mr.animal_id
  LEFT JOIN users vu ON vu.id = mr.veterinarian_id
`;

// ─── Service ────────────────────────────────────────────────
export class MedicalRecordService {

  // ═══ MEDICAL RECORDS CRUD ═════════════════════════════════

  async createRecord(userId: string, data: MedicalRecordCreateDTO, createdBy?: string, createdByName?: string): Promise<MedicalRecord> {
    try {
      const id = uuidv4();
      const recordNumber = await generateRecordNumber();
      const targetUserId = data.userId || userId;
      const query = `
        INSERT INTO medical_records (
          id, user_id, animal_id, consultation_id, veterinarian_id,
          record_type, record_number, title, content, severity, status,
          medications, attachments, is_confidential, follow_up_date, tags,
          file_url, created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
        RETURNING id
      `;
      await database.query(query, [
        id, targetUserId, data.animalId || null, data.consultationId || null,
        data.veterinarianId || null, data.recordType, recordNumber,
        data.title, data.content, data.severity || 'normal', 'active',
        JSON.stringify(data.medications || []), JSON.stringify(data.attachments || []),
        data.isConfidential || false, data.followUpDate || null,
        data.tags || [], data.fileUrl || null, createdBy || userId
      ]);
      await logMedicalAudit(id, 'medical_record', 'CREATE', createdBy || userId, createdByName, null, { recordType: data.recordType, title: data.title });
      logger.info('Medical record created', { id, recordNumber, userId: targetUserId });
      return this.getRecord(id);
    } catch (error) {
      throw new DatabaseError('Error creating medical record', { originalError: error });
    }
  }

  async getRecord(recordId: string): Promise<MedicalRecord> {
    try {
      const query = `SELECT ${RECORD_SELECT} ${RECORD_FROM} WHERE mr.id = $1`;
      const result = await database.query(query, [recordId]);
      if (result.rows.length === 0) throw new NotFoundError('MedicalRecord', recordId);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching medical record', { originalError: error });
    }
  }

  async listRecords(filters: {
    userId?: string; animalId?: string; recordType?: string;
    status?: string; severity?: string; veterinarianId?: string;
    search?: string; limit?: number; offset?: number; isAdmin?: boolean;
  }): Promise<{ records: MedicalRecord[]; total: number }> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 0;

      if (filters.userId && !filters.isAdmin) {
        idx++; conditions.push(`(mr.user_id = $${idx} OR mr.created_by = $${idx} OR mr.veterinarian_id = $${idx})`);
        params.push(filters.userId);
      }
      if (filters.animalId) { idx++; conditions.push(`mr.animal_id = $${idx}`); params.push(filters.animalId); }
      if (filters.recordType) { idx++; conditions.push(`mr.record_type = $${idx}`); params.push(filters.recordType); }
      if (filters.status) { idx++; conditions.push(`mr.status = $${idx}`); params.push(filters.status); }
      if (filters.severity) { idx++; conditions.push(`mr.severity = $${idx}`); params.push(filters.severity); }
      if (filters.veterinarianId) { idx++; conditions.push(`mr.veterinarian_id = $${idx}`); params.push(filters.veterinarianId); }
      if (filters.search) {
        idx++; conditions.push(`(mr.title ILIKE $${idx} OR mr.content ILIKE $${idx} OR mr.record_number ILIKE $${idx} OR a.name ILIKE $${idx})`);
        params.push(`%${filters.search}%`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(filters.limit || 20, 100);
      const offset = filters.offset || 0;

      const query = `SELECT ${RECORD_SELECT} ${RECORD_FROM} ${where} ORDER BY mr.created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`;
      const countQuery = `SELECT COUNT(*) as count FROM medical_records mr LEFT JOIN animals a ON a.id = mr.animal_id ${where}`;

      const [recordsResult, countResult] = await Promise.all([
        database.query(query, [...params, limit, offset]),
        database.query(countQuery, params),
      ]);
      return { records: recordsResult.rows, total: parseInt(countResult.rows[0]?.count || '0', 10) };
    } catch (error) {
      throw new DatabaseError('Error listing medical records', { originalError: error });
    }
  }

  async updateRecord(recordId: string, updates: Partial<MedicalRecordCreateDTO>, updatedBy?: string, updatedByName?: string, changeReason?: string): Promise<MedicalRecord> {
    try {
      const oldRecord = await this.getRecord(recordId);
      const fieldMap: Record<string, string> = {
        recordType: 'record_type', title: 'title', content: 'content',
        severity: 'severity', status: 'status', fileUrl: 'file_url',
        animalId: 'animal_id', consultationId: 'consultation_id',
        veterinarianId: 'veterinarian_id', isConfidential: 'is_confidential',
        followUpDate: 'follow_up_date',
      };
      const entries = Object.entries(updates).filter(([k, v]) => v !== undefined && k !== 'userId' && k !== 'medications' && k !== 'attachments' && k !== 'tags');
      const sets: string[] = [];
      const values: any[] = [recordId];
      let paramIdx = 1;
      for (const [key, val] of entries) {
        paramIdx++;
        sets.push(`${fieldMap[key] || key} = $${paramIdx}`);
        values.push(val);
      }
      if (updates.medications !== undefined) { paramIdx++; sets.push(`medications = $${paramIdx}`); values.push(JSON.stringify(updates.medications)); }
      if (updates.attachments !== undefined) { paramIdx++; sets.push(`attachments = $${paramIdx}`); values.push(JSON.stringify(updates.attachments)); }
      if (updates.tags !== undefined) { paramIdx++; sets.push(`tags = $${paramIdx}`); values.push(updates.tags); }
      if (sets.length === 0) return oldRecord;

      const query = `UPDATE medical_records SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING id`;
      const result = await database.query(query, values);
      if (result.rows.length === 0) throw new NotFoundError('MedicalRecord', recordId);

      const newRecord = await this.getRecord(recordId);
      await logMedicalAudit(recordId, 'medical_record', 'UPDATE', updatedBy, updatedByName,
        { title: oldRecord.title, content: oldRecord.content, severity: oldRecord.severity },
        { title: newRecord.title, content: newRecord.content, severity: newRecord.severity }, changeReason);
      return newRecord;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error updating medical record', { originalError: error });
    }
  }

  async deleteRecord(recordId: string, deletedBy?: string, deletedByName?: string, reason?: string): Promise<void> {
    try {
      const record = await this.getRecord(recordId);
      await database.query(`UPDATE medical_records SET status = 'archived', updated_at = NOW() WHERE id = $1`, [recordId]);
      await logMedicalAudit(recordId, 'medical_record', 'ARCHIVE', deletedBy, deletedByName,
        { status: record.status }, { status: 'archived' }, reason || 'Record archived');
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error archiving medical record', { originalError: error });
    }
  }

  // ═══ VACCINATION RECORDS ══════════════════════════════════

  async createVaccination(animalId: string, data: Partial<VaccinationRecord>, createdBy?: string, createdByName?: string): Promise<VaccinationRecord> {
    try {
      const id = uuidv4();
      await database.query(`
        INSERT INTO vaccination_records (
          id, animal_id, vaccine_name, vaccine_type, batch_number, manufacturer,
          date_administered, next_due_date, administered_by, site_of_administration,
          dosage, reaction_notes, is_valid, certificate_number, created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
      `, [
        id, animalId, data.vaccineName, data.vaccineType || null, data.batchNumber || null,
        data.manufacturer || null, data.dateAdministered, data.nextDueDate || null,
        data.administeredBy || createdBy || null, data.siteOfAdministration || null,
        data.dosage || null, data.reactionNotes || null, true,
        data.certificateNumber || null, createdBy || null
      ]);
      await logMedicalAudit(id, 'vaccination', 'CREATE', createdBy, createdByName, null, { vaccineName: data.vaccineName, animalId });
      return this.getVaccination(id);
    } catch (error) {
      throw new DatabaseError('Error creating vaccination record', { originalError: error });
    }
  }

  async getVaccination(id: string): Promise<VaccinationRecord> {
    try {
      const query = `
        SELECT vr.id, vr.animal_id as "animalId", vr.vaccine_name as "vaccineName",
               vr.vaccine_type as "vaccineType", vr.batch_number as "batchNumber",
               vr.manufacturer, vr.date_administered as "dateAdministered",
               vr.next_due_date as "nextDueDate", vr.administered_by as "administeredBy",
               vr.site_of_administration as "siteOfAdministration", vr.dosage,
               vr.reaction_notes as "reactionNotes", vr.is_valid as "isValid",
               vr.certificate_number as "certificateNumber",
               vr.created_by as "createdBy", vr.created_at as "createdAt", vr.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "administeredByName",
               COALESCE(a.name, '') as "animalName", COALESCE(a.unique_id, '') as "animalUniqueId"
        FROM vaccination_records vr
        LEFT JOIN users u ON u.id = vr.administered_by
        LEFT JOIN animals a ON a.id = vr.animal_id
        WHERE vr.id = $1
      `;
      const result = await database.query(query, [id]);
      if (result.rows.length === 0) throw new NotFoundError('VaccinationRecord', id);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching vaccination record', { originalError: error });
    }
  }

  async listVaccinations(animalId: string, limit = 50, offset = 0): Promise<{ records: VaccinationRecord[]; total: number }> {
    try {
      const query = `
        SELECT vr.id, vr.animal_id as "animalId", vr.vaccine_name as "vaccineName",
               vr.vaccine_type as "vaccineType", vr.batch_number as "batchNumber",
               vr.manufacturer, vr.date_administered as "dateAdministered",
               vr.next_due_date as "nextDueDate", vr.administered_by as "administeredBy",
               vr.dosage, vr.reaction_notes as "reactionNotes",
               vr.is_valid as "isValid", vr.certificate_number as "certificateNumber",
               vr.created_at as "createdAt", vr.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "administeredByName",
               COALESCE(a.name, '') as "animalName", COALESCE(a.unique_id, '') as "animalUniqueId"
        FROM vaccination_records vr
        LEFT JOIN users u ON u.id = vr.administered_by
        LEFT JOIN animals a ON a.id = vr.animal_id
        WHERE vr.animal_id = $1
        ORDER BY vr.date_administered DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM vaccination_records WHERE animal_id = $1`;
      const [data, cnt] = await Promise.all([
        database.query(query, [animalId, limit, offset]),
        database.query(countQuery, [animalId])
      ]);
      return { records: data.rows, total: parseInt(cnt.rows[0]?.count || '0', 10) };
    } catch (error) {
      throw new DatabaseError('Error listing vaccination records', { originalError: error });
    }
  }

  async updateVaccination(id: string, updates: Partial<VaccinationRecord>, updatedBy?: string, updatedByName?: string): Promise<VaccinationRecord> {
    try {
      const old = await this.getVaccination(id);
      const fieldMap: Record<string, string> = {
        vaccineName: 'vaccine_name', vaccineType: 'vaccine_type', batchNumber: 'batch_number',
        manufacturer: 'manufacturer', dateAdministered: 'date_administered', nextDueDate: 'next_due_date',
        administeredBy: 'administered_by', siteOfAdministration: 'site_of_administration',
        dosage: 'dosage', reactionNotes: 'reaction_notes', isValid: 'is_valid', certificateNumber: 'certificate_number'
      };
      const entries = Object.entries(updates).filter(([k, v]) => v !== undefined && fieldMap[k]);
      if (entries.length === 0) return old;
      const sets = entries.map(([k], i) => `${fieldMap[k]} = $${i + 2}`);
      const vals = entries.map(([_, v]) => v);
      const result = await database.query(`UPDATE vaccination_records SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING id`, [id, ...vals]);
      if (result.rows.length === 0) throw new NotFoundError('VaccinationRecord', id);
      await logMedicalAudit(id, 'vaccination', 'UPDATE', updatedBy, updatedByName, { vaccineName: old.vaccineName }, updates);
      return this.getVaccination(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error updating vaccination record', { originalError: error });
    }
  }

  async deleteVaccination(id: string, deletedBy?: string, deletedByName?: string): Promise<void> {
    try {
      await database.query(`UPDATE vaccination_records SET is_valid = false, updated_at = NOW() WHERE id = $1`, [id]);
      await logMedicalAudit(id, 'vaccination', 'INVALIDATE', deletedBy, deletedByName);
    } catch (error) {
      throw new DatabaseError('Error invalidating vaccination record', { originalError: error });
    }
  }

  // ═══ WEIGHT HISTORY ═══════════════════════════════════════

  async addWeight(animalId: string, weight: number, unit: string, recordedBy?: string, notes?: string): Promise<WeightRecord> {
    try {
      const id = uuidv4();
      await database.query(`
        INSERT INTO weight_history (id, animal_id, weight, unit, recorded_at, recorded_by, notes, created_at)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW())
      `, [id, animalId, weight, unit || 'kg', recordedBy || null, notes || null]);
      await database.query(`UPDATE animals SET weight = $1, updated_at = NOW() WHERE id = $2`, [weight, animalId]);
      await logMedicalAudit(id, 'weight', 'CREATE', recordedBy, undefined, undefined, { weight, unit, animalId });

      const result = await database.query(`
        SELECT wh.id, wh.animal_id as "animalId", wh.weight, wh.unit,
               wh.recorded_at as "recordedAt", wh.recorded_by as "recordedBy",
               wh.notes, wh.created_at as "createdAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "recordedByName"
        FROM weight_history wh LEFT JOIN users u ON u.id = wh.recorded_by WHERE wh.id = $1
      `, [id]);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error adding weight record', { originalError: error });
    }
  }

  async listWeightHistory(animalId: string, limit = 50): Promise<WeightRecord[]> {
    try {
      const result = await database.query(`
        SELECT wh.id, wh.animal_id as "animalId", wh.weight, wh.unit,
               wh.recorded_at as "recordedAt", wh.recorded_by as "recordedBy",
               wh.notes, wh.created_at as "createdAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "recordedByName"
        FROM weight_history wh LEFT JOIN users u ON u.id = wh.recorded_by
        WHERE wh.animal_id = $1 ORDER BY wh.recorded_at DESC LIMIT $2
      `, [animalId, limit]);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Error listing weight history', { originalError: error });
    }
  }

  // ═══ ALLERGY RECORDS ══════════════════════════════════════

  async createAllergy(animalId: string, data: Partial<AllergyRecord>, createdBy?: string, createdByName?: string): Promise<AllergyRecord> {
    try {
      const id = uuidv4();
      await database.query(`
        INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, NOW(), NOW())
      `, [id, animalId, data.allergen, data.reaction || null, data.severity || 'mild', data.identifiedDate || null, data.notes || null, createdBy || null]);
      await logMedicalAudit(id, 'allergy', 'CREATE', createdBy, createdByName, null, { allergen: data.allergen, animalId });
      return this.getAllergy(id);
    } catch (error) {
      throw new DatabaseError('Error creating allergy record', { originalError: error });
    }
  }

  async getAllergy(id: string): Promise<AllergyRecord> {
    try {
      const result = await database.query(`
        SELECT ar.id, ar.animal_id as "animalId", ar.allergen, ar.reaction,
               ar.severity, ar.identified_date as "identifiedDate", ar.is_active as "isActive",
               ar.notes, ar.reported_by as "reportedBy",
               ar.created_at as "createdAt", ar.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "reportedByName"
        FROM allergy_records ar LEFT JOIN users u ON u.id = ar.reported_by WHERE ar.id = $1
      `, [id]);
      if (result.rows.length === 0) throw new NotFoundError('AllergyRecord', id);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching allergy record', { originalError: error });
    }
  }

  async listAllergies(animalId: string): Promise<AllergyRecord[]> {
    try {
      const result = await database.query(`
        SELECT ar.id, ar.animal_id as "animalId", ar.allergen, ar.reaction,
               ar.severity, ar.identified_date as "identifiedDate", ar.is_active as "isActive",
               ar.notes, ar.reported_by as "reportedBy",
               ar.created_at as "createdAt", ar.updated_at as "updatedAt",
               COALESCE(u.first_name || ' ' || u.last_name, '') as "reportedByName"
        FROM allergy_records ar LEFT JOIN users u ON u.id = ar.reported_by
        WHERE ar.animal_id = $1 ORDER BY ar.is_active DESC, ar.created_at DESC
      `, [animalId]);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Error listing allergies', { originalError: error });
    }
  }

  async updateAllergy(id: string, updates: Partial<AllergyRecord>, updatedBy?: string, updatedByName?: string): Promise<AllergyRecord> {
    try {
      const fieldMap: Record<string, string> = {
        allergen: 'allergen', reaction: 'reaction', severity: 'severity',
        identifiedDate: 'identified_date', isActive: 'is_active', notes: 'notes'
      };
      const entries = Object.entries(updates).filter(([k, v]) => v !== undefined && fieldMap[k]);
      if (entries.length === 0) return this.getAllergy(id);
      const sets = entries.map(([k], i) => `${fieldMap[k]} = $${i + 2}`);
      const vals = entries.map(([_, v]) => v);
      await database.query(`UPDATE allergy_records SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...vals]);
      await logMedicalAudit(id, 'allergy', 'UPDATE', updatedBy, updatedByName, null, updates);
      return this.getAllergy(id);
    } catch (error) {
      throw new DatabaseError('Error updating allergy record', { originalError: error });
    }
  }

  // ═══ LAB RESULTS ══════════════════════════════════════════

  async createLabResult(animalId: string, data: Partial<LabResult>, createdBy?: string, createdByName?: string): Promise<LabResult> {
    try {
      const id = uuidv4();
      await database.query(`
        INSERT INTO lab_results (
          id, animal_id, consultation_id, medical_record_id, test_name, test_category,
          test_date, result_value, normal_range, unit, status, interpretation,
          lab_name, ordered_by, verified_by, is_abnormal, attachments, notes, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
      `, [
        id, animalId, data.consultationId || null, data.medicalRecordId || null,
        data.testName, data.testCategory || null, data.testDate,
        data.resultValue || null, data.normalRange || null, data.unit || null,
        data.status || 'pending', data.interpretation || null,
        data.labName || null, data.orderedBy || createdBy || null,
        data.verifiedBy || null, data.isAbnormal || false,
        JSON.stringify(data.attachments || []), data.notes || null
      ]);
      await logMedicalAudit(id, 'lab_result', 'CREATE', createdBy, createdByName, null, { testName: data.testName, animalId });
      return this.getLabResult(id);
    } catch (error) {
      throw new DatabaseError('Error creating lab result', { originalError: error });
    }
  }

  async getLabResult(id: string): Promise<LabResult> {
    try {
      const result = await database.query(`
        SELECT lr.id, lr.animal_id as "animalId", lr.consultation_id as "consultationId",
               lr.medical_record_id as "medicalRecordId", lr.test_name as "testName",
               lr.test_category as "testCategory", lr.test_date as "testDate",
               lr.result_value as "resultValue", lr.normal_range as "normalRange",
               lr.unit, lr.status, lr.interpretation, lr.lab_name as "labName",
               lr.ordered_by as "orderedBy", lr.verified_by as "verifiedBy",
               lr.is_abnormal as "isAbnormal", lr.attachments, lr.notes,
               lr.created_at as "createdAt", lr.updated_at as "updatedAt",
               COALESCE(ou.first_name || ' ' || ou.last_name, '') as "orderedByName",
               COALESCE(vu.first_name || ' ' || vu.last_name, '') as "verifiedByName",
               COALESCE(a.name, '') as "animalName", COALESCE(a.unique_id, '') as "animalUniqueId"
        FROM lab_results lr
        LEFT JOIN users ou ON ou.id = lr.ordered_by
        LEFT JOIN users vu ON vu.id = lr.verified_by
        LEFT JOIN animals a ON a.id = lr.animal_id
        WHERE lr.id = $1
      `, [id]);
      if (result.rows.length === 0) throw new NotFoundError('LabResult', id);
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('Error fetching lab result', { originalError: error });
    }
  }

  async listLabResults(animalId: string, limit = 50, offset = 0): Promise<{ records: LabResult[]; total: number }> {
    try {
      const query = `
        SELECT lr.id, lr.animal_id as "animalId", lr.test_name as "testName",
               lr.test_category as "testCategory", lr.test_date as "testDate",
               lr.result_value as "resultValue", lr.normal_range as "normalRange",
               lr.unit, lr.status, lr.interpretation, lr.lab_name as "labName",
               lr.is_abnormal as "isAbnormal", lr.notes,
               lr.created_at as "createdAt", lr.updated_at as "updatedAt",
               COALESCE(ou.first_name || ' ' || ou.last_name, '') as "orderedByName",
               COALESCE(a.name, '') as "animalName"
        FROM lab_results lr LEFT JOIN users ou ON ou.id = lr.ordered_by LEFT JOIN animals a ON a.id = lr.animal_id
        WHERE lr.animal_id = $1 ORDER BY lr.test_date DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM lab_results WHERE animal_id = $1`;
      const [data, cnt] = await Promise.all([
        database.query(query, [animalId, limit, offset]),
        database.query(countQuery, [animalId])
      ]);
      return { records: data.rows, total: parseInt(cnt.rows[0]?.count || '0', 10) };
    } catch (error) {
      throw new DatabaseError('Error listing lab results', { originalError: error });
    }
  }

  async updateLabResult(id: string, updates: Partial<LabResult>, updatedBy?: string, updatedByName?: string): Promise<LabResult> {
    try {
      const fieldMap: Record<string, string> = {
        testName: 'test_name', testCategory: 'test_category', testDate: 'test_date',
        resultValue: 'result_value', normalRange: 'normal_range', unit: 'unit',
        status: 'status', interpretation: 'interpretation', labName: 'lab_name',
        orderedBy: 'ordered_by', verifiedBy: 'verified_by', isAbnormal: 'is_abnormal', notes: 'notes'
      };
      const entries = Object.entries(updates).filter(([k, v]) => v !== undefined && fieldMap[k]);
      if (entries.length === 0) return this.getLabResult(id);
      const sets = entries.map(([k], i) => `${fieldMap[k]} = $${i + 2}`);
      const vals = entries.map(([_, v]) => v);
      await database.query(`UPDATE lab_results SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...vals]);
      await logMedicalAudit(id, 'lab_result', 'UPDATE', updatedBy, updatedByName, null, updates);
      return this.getLabResult(id);
    } catch (error) {
      throw new DatabaseError('Error updating lab result', { originalError: error });
    }
  }

  // ═══ TIMELINE ═════════════════════════════════════════════

  async getAnimalTimeline(animalId: string, limit = 100): Promise<MedicalTimeline[]> {
    try {
      const timeline: MedicalTimeline[] = [];

      const [mrResult, vaxResult, labResultData, rxResult, weightResult] = await Promise.all([
        database.query(`
          SELECT mr.id, mr.record_type as type, mr.title, mr.content as description,
                 mr.created_at as date, mr.severity, mr.status,
                 mr.created_by, COALESCE(u.first_name || ' ' || u.last_name, '') as "createdByName"
          FROM medical_records mr LEFT JOIN users u ON u.id = mr.created_by
          WHERE mr.animal_id = $1 AND mr.status != 'archived' ORDER BY mr.created_at DESC LIMIT $2
        `, [animalId, limit]),
        database.query(`
          SELECT vr.id, vr.vaccine_name, vr.date_administered as date, vr.next_due_date, vr.is_valid,
                 COALESCE(u.first_name || ' ' || u.last_name, '') as "createdByName"
          FROM vaccination_records vr LEFT JOIN users u ON u.id = vr.administered_by
          WHERE vr.animal_id = $1 ORDER BY vr.date_administered DESC LIMIT $2
        `, [animalId, limit]),
        database.query(`
          SELECT lr.id, lr.test_name, lr.test_date as date, lr.status, lr.is_abnormal,
                 lr.result_value, lr.normal_range,
                 COALESCE(u.first_name || ' ' || u.last_name, '') as "createdByName"
          FROM lab_results lr LEFT JOIN users u ON u.id = lr.ordered_by
          WHERE lr.animal_id = $1 ORDER BY lr.test_date DESC LIMIT $2
        `, [animalId, limit]),
        database.query(`
          SELECT p.id, p.medications, p.instructions, p.created_at as date, p.is_active,
                 COALESCE(u.first_name || ' ' || u.last_name, '') as "createdByName"
          FROM prescriptions p LEFT JOIN users u ON u.id = p.veterinarian_id
          WHERE p.animal_id = $1 ORDER BY p.created_at DESC LIMIT $2
        `, [animalId, limit]),
        database.query(`
          SELECT wh.id, wh.weight, wh.unit, wh.recorded_at as date, wh.notes,
                 COALESCE(u.first_name || ' ' || u.last_name, '') as "createdByName"
          FROM weight_history wh LEFT JOIN users u ON u.id = wh.recorded_by
          WHERE wh.animal_id = $1 ORDER BY wh.recorded_at DESC LIMIT $2
        `, [animalId, limit])
      ]);

      mrResult.rows.forEach((r: any) => timeline.push({
        id: r.id, type: `record_${r.type}`, title: r.title || r.type,
        description: r.description?.substring(0, 200) || '', date: r.date,
        severity: r.severity, status: r.status, createdBy: r.created_by, createdByName: r.createdByName
      }));
      vaxResult.rows.forEach((r: any) => timeline.push({
        id: r.id, type: 'vaccination', title: `Vaccination: ${r.vaccine_name}`,
        description: r.next_due_date ? `Next due: ${r.next_due_date}` : 'No follow-up scheduled',
        date: r.date, status: r.is_valid ? 'valid' : 'expired', createdByName: r.createdByName
      }));
      labResultData.rows.forEach((r: any) => timeline.push({
        id: r.id, type: 'lab_result', title: `Lab: ${r.test_name}`,
        description: r.result_value ? `Result: ${r.result_value}${r.normal_range ? ` (Normal: ${r.normal_range})` : ''}` : 'Pending',
        date: r.date, status: r.status, severity: r.is_abnormal ? 'high' : 'normal', createdByName: r.createdByName
      }));
      rxResult.rows.forEach((r: any) => {
        const meds = Array.isArray(r.medications) ? r.medications.map((m: any) => m.name).join(', ') : '';
        timeline.push({
          id: r.id, type: 'prescription', title: `Prescription: ${meds || 'Medications'}`,
          description: r.instructions || '', date: r.date,
          status: r.is_active ? 'active' : 'expired', createdByName: r.createdByName
        });
      });
      weightResult.rows.forEach((r: any) => timeline.push({
        id: r.id, type: 'weight', title: `Weight: ${r.weight} ${r.unit}`,
        description: r.notes || '', date: r.date, createdByName: r.createdByName
      }));

      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return timeline.slice(0, limit);
    } catch (error) {
      throw new DatabaseError('Error building medical timeline', { originalError: error });
    }
  }

  // ═══ AUDIT LOG ════════════════════════════════════════════

  async getAuditLog(filters: { recordId?: string; recordType?: string; action?: string; limit?: number; offset?: number }): Promise<{ entries: MedicalAuditEntry[]; total: number }> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 0;
      if (filters.recordId) { idx++; conditions.push(`record_id = $${idx}`); params.push(filters.recordId); }
      if (filters.recordType) { idx++; conditions.push(`record_type = $${idx}`); params.push(filters.recordType); }
      if (filters.action) { idx++; conditions.push(`action = $${idx}`); params.push(filters.action); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(filters.limit || 50, 200);
      const offset = filters.offset || 0;

      const [data, cnt] = await Promise.all([
        database.query(`
          SELECT id, record_id as "recordId", record_type as "recordType",
                 action, changed_by as "changedBy", changed_by_name as "changedByName",
                 old_values as "oldValues", new_values as "newValues",
                 change_reason as "changeReason", ip_address as "ipAddress",
                 created_at as "createdAt"
          FROM medical_record_audit_log ${where}
          ORDER BY created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}
        `, [...params, limit, offset]),
        database.query(`SELECT COUNT(*) as count FROM medical_record_audit_log ${where}`, params)
      ]);
      return { entries: data.rows, total: parseInt(cnt.rows[0]?.count || '0', 10) };
    } catch (error) {
      throw new DatabaseError('Error fetching medical audit log', { originalError: error });
    }
  }

  // ═══ STATS ════════════════════════════════════════════════

  async getMedicalStats(userId?: string, isAdmin?: boolean): Promise<any> {
    try {
      const userFilter = userId && !isAdmin ? `WHERE mr.user_id = '${userId}' OR mr.created_by = '${userId}' OR mr.veterinarian_id = '${userId}'` : '';
      const animalFilter = userId && !isAdmin ? `WHERE a.owner_id = '${userId}'` : '';
      // Vets: include animals from their consultations
      const vetAnimalFilter = userId && !isAdmin ?
        `WHERE (a.owner_id = '${userId}' OR a.id IN (SELECT animal_id FROM consultations WHERE veterinarian_id = '${userId}' AND animal_id IS NOT NULL) OR a.id IN (SELECT animal_id FROM bookings WHERE veterinarian_id = '${userId}' AND animal_id IS NOT NULL))` :
        '';
      const prescriptionFilter = userId && !isAdmin ? `WHERE p.veterinarian_id = '${userId}' OR p.pet_owner_id = '${userId}'` : '';
      const consultationFilter = userId && !isAdmin ? `WHERE c.veterinarian_id = '${userId}' OR c.user_id = '${userId}'` : '';

      const [records, vaccinations, allergies, labs, upcoming, prescriptions, consultations] = await Promise.all([
        database.query(`SELECT COUNT(*) as count, record_type as type FROM medical_records mr ${userFilter} GROUP BY record_type`),
        database.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN next_due_date <= CURRENT_DATE + INTERVAL '30 days' AND next_due_date >= CURRENT_DATE THEN 1 END) as upcoming FROM vaccination_records vr LEFT JOIN animals a ON a.id = vr.animal_id ${vetAnimalFilter}`),
        database.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN ar.is_active THEN 1 END) as active FROM allergy_records ar LEFT JOIN animals a ON a.id = ar.animal_id ${vetAnimalFilter}`),
        database.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending FROM lab_results lr LEFT JOIN animals a ON a.id = lr.animal_id ${vetAnimalFilter}`),
        database.query(`SELECT COUNT(*) as count FROM medical_records mr ${userFilter ? userFilter + ' AND' : 'WHERE'} follow_up_date IS NOT NULL AND follow_up_date >= CURRENT_DATE AND follow_up_date <= CURRENT_DATE + INTERVAL '7 days'`),
        database.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN is_active THEN 1 END) as active FROM prescriptions p ${prescriptionFilter}`),
        database.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed FROM consultations c ${consultationFilter}`),
      ]);

      const recordsByType: Record<string, number> = {};
      records.rows.forEach((r: any) => { recordsByType[r.type] = parseInt(r.count); });

      return {
        totalRecords: Object.values(recordsByType).reduce((a: number, b: number) => a + b, 0),
        recordsByType,
        vaccinations: { total: parseInt(vaccinations.rows[0]?.total || '0'), upcomingDue: parseInt(vaccinations.rows[0]?.upcoming || '0') },
        allergies: { total: parseInt(allergies.rows[0]?.total || '0'), active: parseInt(allergies.rows[0]?.active || '0') },
        labResults: { total: parseInt(labs.rows[0]?.total || '0'), pending: parseInt(labs.rows[0]?.pending || '0') },
        prescriptions: { total: parseInt(prescriptions.rows[0]?.total || '0'), active: parseInt(prescriptions.rows[0]?.active || '0') },
        consultations: { total: parseInt(consultations.rows[0]?.total || '0'), completed: parseInt(consultations.rows[0]?.completed || '0') },
        upcomingFollowUps: parseInt(upcoming.rows[0]?.count || '0'),
      };
    } catch (error) {
      throw new DatabaseError('Error fetching medical stats', { originalError: error });
    }
  }

  // ═══ CONSULTATIONS BY ANIMAL ═══════════════════════════════

  async getConsultationsByAnimal(animalId: string, limit: number = 50, offset: number = 0): Promise<{ consultations: any[]; total: number }> {
    try {
      const query = `
        SELECT c.id, c.booking_id as "bookingId", c.status,
               c.diagnosis, c.notes, c.follow_up_date as "followUpDate",
               c.started_at as "startTime", c.completed_at as "endTime",
               c.scheduled_at as "scheduledAt",
               c.created_at as "createdAt",
               COALESCE(vet.first_name || ' ' || vet.last_name, 'Unknown') as "veterinarianName",
               COALESCE(own.first_name || ' ' || own.last_name, 'Unknown') as "ownerName",
               a.name as "animalName", a.unique_id as "animalUniqueId",
               (SELECT COUNT(*) FROM prescriptions p WHERE p.consultation_id = c.id) as "prescriptionCount"
        FROM consultations c
        LEFT JOIN users vet ON vet.id = c.veterinarian_id
        LEFT JOIN users own ON own.id = c.user_id
        LEFT JOIN animals a ON a.id = c.animal_id
        WHERE c.animal_id = $1
        ORDER BY c.created_at DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count FROM consultations WHERE animal_id = $1`;
      const [result, countResult] = await Promise.all([
        database.query(query, [animalId, limit, offset]),
        database.query(countQuery, [animalId]),
      ]);
      return {
        consultations: result.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error fetching consultations by animal', { originalError: error });
    }
  }

  // ═══ UNIQUE ID HELPERS ════════════════════════════════════

  async ensureUserUniqueId(userId: string, role: string): Promise<string> {
    try {
      const existing = await database.query(`SELECT unique_id FROM users WHERE id = $1`, [userId]);
      if (existing.rows[0]?.unique_id) return existing.rows[0].unique_id;
      const prefix = role === 'veterinarian' ? 'VET' : role === 'admin' ? 'ADM' : 'OWN';
      const uniqueId = await generateUniqueId(prefix, 'users');
      await database.query(`UPDATE users SET unique_id = $1 WHERE id = $2`, [uniqueId, userId]);
      return uniqueId;
    } catch (error) {
      throw new DatabaseError('Error ensuring user unique ID', { originalError: error });
    }
  }

  async ensureAnimalUniqueId(animalId: string): Promise<string> {
    try {
      const existing = await database.query(`SELECT unique_id FROM animals WHERE id = $1`, [animalId]);
      if (existing.rows[0]?.unique_id) return existing.rows[0].unique_id;
      const uniqueId = await generateUniqueId('PET', 'animals');
      await database.query(`UPDATE animals SET unique_id = $1 WHERE id = $2`, [uniqueId, animalId]);
      return uniqueId;
    } catch (error) {
      throw new DatabaseError('Error ensuring animal unique ID', { originalError: error });
    }
  }
}

export default new MedicalRecordService();
