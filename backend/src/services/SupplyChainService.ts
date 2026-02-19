import database from '../utils/database';
import logger from '../utils/logger';
import crypto from 'crypto';

class SupplyChainService {

  // ─── Product Batches ──────────────────────────────────────

  async listBatches(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['pb.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.status) { conds.push(`pb.status = $${idx++}`); params.push(filters.status); }
    if (filters.productType) { conds.push(`pb.product_type = $${idx++}`); params.push(filters.productType); }
    if (filters.search) { conds.push(`(pb.batch_number ILIKE $${idx} OR pb.description ILIKE $${idx})`); params.push(`%${filters.search}%`); idx++; }

    const result = await database.query(
      `SELECT pb.*, ag.name as group_name
       FROM product_batches pb
       LEFT JOIN animal_groups ag ON ag.id = pb.source_group_id
       WHERE ${conds.join(' AND ')}
       ORDER BY pb.created_at DESC
       LIMIT ${filters.limit || 50} OFFSET ${filters.offset || 0}`,
      params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createBatch(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO product_batches (enterprise_id, batch_number, product_type, description,
        quantity, unit, source_animal_ids, source_group_id, production_date, expiry_date,
        quality_grade, certifications, current_holder, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [data.enterpriseId, data.batchNumber, data.productType, data.description || null,
       data.quantity || 0, data.unit || 'kg',
       data.sourceAnimalIds || '{}', data.sourceGroupId || null,
       data.productionDate || null, data.expiryDate || null,
       data.qualityGrade || null, JSON.stringify(data.certifications || []),
       data.currentHolder || null, data.status || 'in_production']
    );
    return result.rows[0];
  }

  async updateBatch(id: string, data: any): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      status: 'status', quantity: 'quantity', qualityGrade: 'quality_grade',
      currentHolder: 'current_holder', expiryDate: 'expiry_date',
      description: 'description'
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(data[k]); }
    }
    if (data.certifications) { sets.push(`certifications = $${idx++}`); params.push(JSON.stringify(data.certifications)); }
    if (!sets.length) return {};
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await database.query(
      `UPDATE product_batches SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0];
  }

  // ─── Traceability Events ──────────────────────────────────

  async listEvents(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['te.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.batchId) { conds.push(`te.batch_id = $${idx++}`); params.push(filters.batchId); }
    if (filters.eventType) { conds.push(`te.event_type = $${idx++}`); params.push(filters.eventType); }

    const result = await database.query(
      `SELECT te.*, u.first_name || ' ' || u.last_name as recorded_by_name,
        pb.batch_number, a.name as animal_name
       FROM traceability_events te
       LEFT JOIN users u ON u.id = te.recorded_by
       LEFT JOIN product_batches pb ON pb.id = te.batch_id
       LEFT JOIN animals a ON a.id = te.animal_id
       WHERE ${conds.join(' AND ')}
       ORDER BY te.event_date DESC
       LIMIT ${filters.limit || 50}`,
      params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createEvent(data: any): Promise<any> {
    const hash = crypto.createHash('sha256').update(JSON.stringify({
      enterpriseId: data.enterpriseId, batchId: data.batchId, title: data.title,
      eventDate: data.eventDate || new Date().toISOString(), ts: Date.now()
    })).digest('hex');

    const result = await database.query(
      `INSERT INTO traceability_events (enterprise_id, batch_id, animal_id, event_type, title, description,
        location, gps_lat, gps_lng, recorded_by, verification_hash, metadata, event_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, COALESCE($13, NOW())) RETURNING *`,
      [data.enterpriseId, data.batchId || null, data.animalId || null,
       data.eventType, data.title, data.description || null,
       data.location || null, data.gpsLat || null, data.gpsLng || null,
       data.recordedBy, hash, JSON.stringify(data.metadata || {}),
       data.eventDate || null]
    );
    return result.rows[0];
  }

  async verifyEvent(id: string, userId: string): Promise<any> {
    const result = await database.query(
      `UPDATE traceability_events SET verified_by = $2 WHERE id = $1 RETURNING *`, [id, userId]
    );
    return result.rows[0];
  }

  // ─── QR Codes ─────────────────────────────────────────────

  async generateQRCode(data: any): Promise<any> {
    const codeData = JSON.stringify({
      type: data.entityType, id: data.entityId,
      enterprise: data.enterpriseId, ts: Date.now()
    });
    const result = await database.query(
      `INSERT INTO qr_codes (enterprise_id, entity_type, entity_id, code_data, short_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.enterpriseId, data.entityType, data.entityId, codeData, data.shortUrl || null]
    );
    return result.rows[0];
  }

  async listQRCodes(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT * FROM qr_codes WHERE enterprise_id = $1 AND is_active = true ORDER BY created_at DESC`, [enterpriseId]
    );
    return { items: result.rows };
  }

  async incrementScan(id: string): Promise<void> {
    await database.query(`UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = $1`, [id]);
  }

  /** Full traceability chain for a batch */
  async getBatchTraceability(batchId: string): Promise<any> {
    const batch = await database.query(`SELECT * FROM product_batches WHERE id = $1`, [batchId]);
    const events = await database.query(
      `SELECT te.*, u.first_name || ' ' || u.last_name as recorded_by_name
       FROM traceability_events te LEFT JOIN users u ON u.id = te.recorded_by
       WHERE te.batch_id = $1 ORDER BY te.event_date ASC`, [batchId]
    );
    const qrCodes = await database.query(
      `SELECT * FROM qr_codes WHERE entity_type = 'batch' AND entity_id = $1`, [batchId]
    );
    return {
      batch: batch.rows[0],
      chainOfCustody: events.rows,
      qrCodes: qrCodes.rows,
      verificationCount: events.rows.filter((e: any) => e.verified_by).length,
      totalEvents: events.rowCount
    };
  }

  /** Supply chain dashboard */
  async getSupplyChainDashboard(enterpriseId: string): Promise<any> {
    const batchStatus = await database.query(
      `SELECT status, COUNT(*) as count FROM product_batches WHERE enterprise_id = $1 GROUP BY status`, [enterpriseId]
    );
    const eventTypes = await database.query(
      `SELECT event_type, COUNT(*) as count FROM traceability_events
       WHERE enterprise_id = $1 AND event_date > NOW() - INTERVAL '90 days'
       GROUP BY event_type ORDER BY count DESC`, [enterpriseId]
    );
    const recentEvents = await database.query(
      `SELECT te.*, pb.batch_number FROM traceability_events te
       LEFT JOIN product_batches pb ON pb.id = te.batch_id
       WHERE te.enterprise_id = $1 ORDER BY te.event_date DESC LIMIT 10`, [enterpriseId]
    );
    const expiringBatches = await database.query(
      `SELECT * FROM product_batches WHERE enterprise_id = $1 AND expiry_date IS NOT NULL
       AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days' ORDER BY expiry_date`, [enterpriseId]
    );

    return {
      batchStatusDistribution: batchStatus.rows,
      eventTypeCounts: eventTypes.rows,
      recentEvents: recentEvents.rows,
      expiringBatches: expiringBatches.rows,
      summary: {
        totalBatches: batchStatus.rows.reduce((s: number, r: any) => s + +r.count, 0),
        activeBatches: batchStatus.rows.find((r: any) => r.status === 'in_production')?.count || 0,
        expiringBatches: expiringBatches.rows.length
      }
    };
  }
}

export default new SupplyChainService();
