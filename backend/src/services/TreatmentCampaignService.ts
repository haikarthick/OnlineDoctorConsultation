import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

// ─── Interfaces ──────────────────────────────────────────────
export interface TreatmentCampaign {
  id: string;
  enterpriseId: string;
  groupId?: string;
  campaignType: string;
  name: string;
  description?: string;
  productUsed?: string;
  dosage?: string;
  targetCount: number;
  completedCount: number;
  status: string;
  scheduledDate?: string;
  startedAt?: Date;
  completedAt?: Date;
  administeredBy?: string;
  approvedBy?: string;
  cost: number;
  notes?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  // joined
  groupName?: string;
  administeredByName?: string;
}

export interface TreatmentCampaignCreateDTO {
  enterpriseId: string;
  groupId?: string;
  campaignType: string;
  name: string;
  description?: string;
  productUsed?: string;
  dosage?: string;
  targetCount?: number;
  scheduledDate?: string;
  cost?: number;
  notes?: string;
}

export class TreatmentCampaignService {

  async createCampaign(data: TreatmentCampaignCreateDTO): Promise<TreatmentCampaign> {
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO treatment_campaigns (id, enterprise_id, group_id, campaign_type, name, description,
           product_used, dosage, target_count, scheduled_date, cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [id, data.enterpriseId, data.groupId, data.campaignType, data.name, data.description,
         data.productUsed, data.dosage, data.targetCount || 0, data.scheduledDate, data.cost || 0, data.notes]
      );
      logger.info(`Treatment campaign created: ${data.name}`, { campaignId: id });
      return this.mapRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create treatment campaign', { error: error.message });
      throw new DatabaseError('Failed to create treatment campaign');
    }
  }

  async getCampaign(id: string): Promise<TreatmentCampaign> {
    const result = await database.query(
      `SELECT tc.*, ag.name as group_name,
              u.first_name || ' ' || u.last_name as administered_by_name
       FROM treatment_campaigns tc
       LEFT JOIN animal_groups ag ON tc.group_id = ag.id
       LEFT JOIN users u ON tc.administered_by = u.id
       WHERE tc.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Treatment campaign not found');
    return this.mapRow(result.rows[0]);
  }

  async listByEnterprise(enterpriseId: string, limit = 50, offset = 0): Promise<{ items: TreatmentCampaign[]; total: number }> {
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM treatment_campaigns WHERE enterprise_id = $1`, [enterpriseId]
    );
    const result = await database.query(
      `SELECT tc.*, ag.name as group_name,
              u.first_name || ' ' || u.last_name as administered_by_name
       FROM treatment_campaigns tc
       LEFT JOIN animal_groups ag ON tc.group_id = ag.id
       LEFT JOIN users u ON tc.administered_by = u.id
       WHERE tc.enterprise_id = $1
       ORDER BY tc.scheduled_date DESC NULLS LAST, tc.created_at DESC
       LIMIT $2 OFFSET $3`,
      [enterpriseId, limit, offset]
    );
    return {
      items: result.rows.map((r: any) => this.mapRow(r)),
      total: parseInt(countResult.rows[0]?.total || '0'),
    };
  }

  async updateCampaign(id: string, data: Partial<TreatmentCampaignCreateDTO> & { status?: string; completedCount?: number; administeredBy?: string }): Promise<TreatmentCampaign> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', campaignType: 'campaign_type', description: 'description',
      productUsed: 'product_used', dosage: 'dosage', targetCount: 'target_count',
      scheduledDate: 'scheduled_date', cost: 'cost', notes: 'notes',
      status: 'status', completedCount: 'completed_count', administeredBy: 'administered_by',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push((data as any)[key]);
      }
    }

    // Auto-set timestamps based on status
    if (data.status === 'in_progress') {
      setClauses.push(`started_at = COALESCE(started_at, NOW())`);
    }
    if (data.status === 'completed') {
      setClauses.push(`completed_at = NOW()`);
    }

    if (setClauses.length === 0) throw new Error('No fields to update');
    params.push(id);

    await database.query(`UPDATE treatment_campaigns SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    return this.getCampaign(id);
  }

  async deleteCampaign(id: string): Promise<void> {
    await database.query(`DELETE FROM treatment_campaigns WHERE id = $1`, [id]);
  }

  private mapRow(row: any): TreatmentCampaign {
    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      groupId: row.group_id,
      campaignType: row.campaign_type,
      name: row.name,
      description: row.description,
      productUsed: row.product_used,
      dosage: row.dosage,
      targetCount: parseInt(row.target_count || '0'),
      completedCount: parseInt(row.completed_count || '0'),
      status: row.status,
      scheduledDate: row.scheduled_date,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      administeredBy: row.administered_by,
      approvedBy: row.approved_by,
      cost: parseFloat(row.cost || '0'),
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      groupName: row.group_name,
      administeredByName: row.administered_by_name,
    };
  }
}

export default new TreatmentCampaignService();
