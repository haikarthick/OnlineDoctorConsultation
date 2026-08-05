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

    // Completing a campaign now leaves a real health record.
    //
    // Until this existed, TreatmentCampaignService only ever moved completed_count. Vaccinating
    // a whole flock through Campaigns therefore left NO history that any other screen could
    // read: Herd Medical showed nothing, and there was no evidence of what had been treated.
    // The record is written against the GROUP, so a 5,000-bird campaign is still one row.
    if (data.status === 'completed') {
      await this.emitCampaignHealthRecord(id);
    }

    return this.getCampaign(id);
  }

  /**
   * Write the group-subject health record for a completed campaign. Idempotent: re-completing a
   * campaign must not produce a second record, so it checks campaign_id first.
   */
  private async emitCampaignHealthRecord(campaignId: string): Promise<void> {
    try {
      const c = await database.query(
        `SELECT tc.*, e.owner_id
           FROM treatment_campaigns tc
           JOIN enterprises e ON e.id = tc.enterprise_id
          WHERE tc.id = $1`, [campaignId]
      );
      if (!c.rows.length) return;
      const camp = c.rows[0];

      // A campaign with no group is enterprise-wide planning, not a treatment of a known
      // population - there is no subject to attach a record to.
      if (!camp.group_id) return;

      const isVaccination = camp.campaign_type === 'vaccination';
      const table = isVaccination ? 'vaccination_records' : 'medical_records';
      const existing = await database.query(
        `SELECT 1 FROM ${table} WHERE campaign_id = $1 LIMIT 1`, [campaignId]
      );
      if (existing.rows.length) return;

      const cycle = await database.query(
        `SELECT id FROM group_cycles WHERE group_id = $1 AND status = 'active' LIMIT 1`, [camp.group_id]
      );
      const cycleId = cycle.rows[0]?.id || null;
      const head = camp.completed_count || camp.target_count || null;
      const when = camp.completed_at ? new Date(camp.completed_at).toISOString().slice(0, 10)
                                     : new Date().toISOString().slice(0, 10);

      if (isVaccination) {
        await database.query(
          `INSERT INTO vaccination_records
             (group_id, cycle_id, campaign_id, vaccine_name, dosage, date_administered,
              head_count_treated, administered_by, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
          [camp.group_id, cycleId, campaignId, camp.product_used || camp.name,
           camp.dosage || null, when, head, camp.administered_by || camp.owner_id]
        );
      } else {
        await database.query(
          `INSERT INTO medical_records
             (user_id, group_id, cycle_id, campaign_id, record_type, title, content,
              event_date, head_count_treated, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$1)`,
          [camp.owner_id, camp.group_id, cycleId, campaignId, 'other',
           camp.name,
           [camp.description, camp.product_used ? `Product: ${camp.product_used}` : null,
            camp.dosage ? `Dosage: ${camp.dosage}` : null]
             .filter(Boolean).join('\n') || camp.campaign_type,
           when, head]
        );
      }
      logger.info('Campaign health record emitted', { campaignId, groupId: camp.group_id, isVaccination });
    } catch (err: any) {
      // Never fail the campaign update because the derived record could not be written - the
      // campaign itself is the user's action. Logged loudly so it is not lost.
      logger.error('Failed to emit campaign health record', { campaignId, error: err.message });
    }
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
