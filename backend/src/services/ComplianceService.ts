import database from '../utils/database';
import logger from '../utils/logger';

class ComplianceService {

  async create(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO compliance_documents (enterprise_id, document_type, title, description, reference_number,
        issued_date, expiry_date, issuing_authority, status, related_campaign_id, related_movement_id,
        animal_ids, group_ids, document_data, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [data.enterpriseId, data.documentType, data.title, data.description || null,
       data.referenceNumber || null, data.issuedDate || null, data.expiryDate || null,
       data.issuingAuthority || null, data.status || 'draft',
       data.relatedCampaignId || null, data.relatedMovementId || null,
       data.animalIds || null, data.groupIds || null,
       data.documentData ? JSON.stringify(data.documentData) : null, data.notes || null]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: any): Promise<any> {
    const result = await database.query(
      `UPDATE compliance_documents SET
        title = COALESCE($2, title), description = COALESCE($3, description),
        reference_number = COALESCE($4, reference_number), issued_date = COALESCE($5, issued_date),
        expiry_date = COALESCE($6, expiry_date), issuing_authority = COALESCE($7, issuing_authority),
        status = COALESCE($8, status), notes = COALESCE($9, notes), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.title, data.description, data.referenceNumber, data.issuedDate,
       data.expiryDate, data.issuingAuthority, data.status, data.notes]
    );
    return this.mapRow(result.rows[0]);
  }

  async verify(id: string, verifiedBy: string): Promise<any> {
    const result = await database.query(
      `UPDATE compliance_documents SET status = 'verified', verified_by = $2, verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`, [id, verifiedBy]
    );
    return this.mapRow(result.rows[0]);
  }

  async list(enterpriseId: string, filters: any = {}): Promise<any> {
    const conditions = ['cd.enterprise_id = $1', 'cd.is_active = true'];
    const params: any[] = [enterpriseId];
    let idx = 2;
    if (filters.documentType) { conditions.push(`cd.document_type = $${idx++}`); params.push(filters.documentType); }
    if (filters.status) { conditions.push(`cd.status = $${idx++}`); params.push(filters.status); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 50, 1), 200));
    params.push(Math.max(parseInt(filters.offset) || 0, 0));
    const result = await database.query(
      `SELECT cd.*, v.first_name || ' ' || v.last_name as verified_by_name
       FROM compliance_documents cd LEFT JOIN users v ON v.id = cd.verified_by
       WHERE ${conditions.join(' AND ')} ORDER BY cd.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`, params
    );
    return { items: result.rows.map((r: any) => this.mapRow(r)) };
  }

  async getById(id: string): Promise<any> {
    const result = await database.query(
      `SELECT cd.*, v.first_name || ' ' || v.last_name as verified_by_name
       FROM compliance_documents cd LEFT JOIN users v ON v.id = cd.verified_by
       WHERE cd.id = $1`, [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<void> {
    await database.query(`UPDATE compliance_documents SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  /** Compliance dashboard: expiring docs, summary by type */
  async getComplianceSummary(enterpriseId: string): Promise<any> {
    const expiringSoon = await database.query(
      `SELECT * FROM compliance_documents WHERE enterprise_id = $1 AND is_active = true
       AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 ORDER BY expiry_date`, [enterpriseId]
    );
    const expired = await database.query(
      `SELECT * FROM compliance_documents WHERE enterprise_id = $1 AND is_active = true
       AND expiry_date < CURRENT_DATE AND status != 'expired' ORDER BY expiry_date`, [enterpriseId]
    );
    const byType = await database.query(
      `SELECT document_type, status, COUNT(*) as count FROM compliance_documents
       WHERE enterprise_id = $1 AND is_active = true GROUP BY document_type, status
       ORDER BY document_type`, [enterpriseId]
    );
    const byStatus = await database.query(
      `SELECT status, COUNT(*) as count FROM compliance_documents
       WHERE enterprise_id = $1 AND is_active = true GROUP BY status`, [enterpriseId]
    );
    return {
      expiringSoon: expiringSoon.rows.map((r: any) => this.mapRow(r)),
      expired: expired.rows.map((r: any) => this.mapRow(r)),
      byType: byType.rows,
      byStatus: byStatus.rows,
    };
  }

  private mapRow(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, documentType: row.document_type,
      title: row.title, description: row.description, referenceNumber: row.reference_number,
      issuedDate: row.issued_date, expiryDate: row.expiry_date,
      issuingAuthority: row.issuing_authority, status: row.status,
      relatedCampaignId: row.related_campaign_id, relatedMovementId: row.related_movement_id,
      animalIds: row.animal_ids, groupIds: row.group_ids,
      documentData: row.document_data, fileUrl: row.file_url,
      verifiedBy: row.verified_by, verifiedAt: row.verified_at,
      verifiedByName: row.verified_by_name, notes: row.notes,
      isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }
}

export default new ComplianceService();
