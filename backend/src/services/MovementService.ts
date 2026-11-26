import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import BatchManagementService from './BatchManagementService';

// ─── Interfaces ──────────────────────────────────────────────
export interface MovementRecord {
  id: string;
  enterpriseId: string;
  animalId?: string;
  groupId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  movementType: string;
  reason?: string;
  animalCount: number;
  transportMethod?: string;
  transportDate: Date;
  regulatoryPermit?: string;
  approvedBy?: string;
  /** pending (waiting for the owner or a manager), approved, rejected or completed. */
  status: string;
  recordedBy: string;
  notes?: string;
  metadata?: any;
  createdAt: Date;
  // joined
  animalName?: string;
  groupName?: string;
  fromLocationName?: string;
  toLocationName?: string;
  recordedByName?: string;
}

export interface MovementCreateDTO {
  enterpriseId: string;
  animalId?: string;
  groupId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  movementType: string;
  reason?: string;
  animalCount?: number;
  transportMethod?: string;
  transportDate?: string;
  regulatoryPermit?: string;
  notes?: string;
}

export class MovementService {

  /**
   * Everything a movement names must belong to the farm it is recorded on. Before this, anyone with a role on ONE farm
   * could name another farm's animal and move it (the animal's current location is rewritten), or file a movement
   * against another farm's group or location.
   */
  private async assertBelongsToFarm(data: MovementCreateDTO): Promise<void> {
    const check = async (table: 'animals' | 'animal_groups' | 'locations', id: string | undefined, message: string) => {
      if (!id) return;
      const r = await database.query(`SELECT 1 FROM ${table} WHERE id = $1 AND enterprise_id = $2`, [id, data.enterpriseId]);
      if (r.rows.length === 0) throw new ValidationError(message);
    };
    await check('animals', data.animalId, 'That animal is not on this farm. Add it to the farm first, or choose another animal.');
    await check('animal_groups', data.groupId, 'That group is not on this farm. Choose a group from this farm.');
    await check('locations', data.fromLocationId, 'The place it is moving from is not on this farm. Choose a place from this farm.');
    await check('locations', data.toLocationId, 'The place it is moving to is not on this farm. Choose a place from this farm.');
  }

  /** The farm a movement belongs to (so the caller can check the person's role on it). */
  async farmOf(id: string): Promise<string> {
    const found = await database.query(`SELECT enterprise_id FROM movement_records WHERE id = $1`, [id]);
    if (found.rows.length === 0) throw new NotFoundError('We could not find that movement. It may have been removed.');
    return found.rows[0].enterprise_id;
  }

  /** The owner's or a manager's decision. Only a pending movement can be decided. */
  async setDecision(id: string, action: 'approve' | 'reject', decidedBy: string): Promise<string> {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const r = await database.query(
      `UPDATE movement_records SET status = $1, approved_by = $2 WHERE id = $3 AND status = 'pending' RETURNING id`,
      [status, decidedBy, id]
    );
    if (r.rows.length === 0) throw new ValidationError('This movement has already been decided. Refresh the list to see what was decided.');
    return status;
  }

  async createMovement(recordedBy: string, data: MovementCreateDTO): Promise<MovementRecord> {
    // Food-safety interlock. A movement that sends animals to slaughter or off the holding must
    // not happen while a withdrawal period is running - Phase 1 records the date, this refuses
    // the action. Internal moves (pen to pen) are exempt: the animals are not leaving.
    const INTERNAL = ['internal', 'pen_change', 'relocation'];
    if (!INTERNAL.includes(String(data.movementType))) {
      const kind = String(data.movementType) === 'slaughter' ? 'meat' : 'any';
      await BatchManagementService.assertNotUnderWithdrawal(
        { animalId: data.animalId, groupId: data.groupId }, kind as any
      );
    }
    await this.assertBelongsToFarm(data);
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO movement_records (id, enterprise_id, animal_id, group_id, from_location_id, to_location_id,
           movement_type, reason, animal_count, transport_method, transport_date, regulatory_permit, recorded_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [id, data.enterpriseId, data.animalId, data.groupId, data.fromLocationId, data.toLocationId,
         data.movementType, data.reason, data.animalCount || 1, data.transportMethod,
         data.transportDate || new Date().toISOString(), data.regulatoryPermit, recordedBy, data.notes]
      );

      // Update animal's current location if individual animal movement
      if (data.animalId && data.toLocationId) {
        await database.query(
          `UPDATE animals SET current_location_id = $1, updated_at = NOW() WHERE id = $2`,
          [data.toLocationId, data.animalId]
        );
      }

      logger.info(`Movement recorded: ${data.movementType}`, { movementId: id });
      return this.mapRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create movement record', { error: error.message });
      throw new DatabaseError('Failed to create movement record');
    }
  }

  async listByEnterprise(enterpriseId: string, limit = 50, offset = 0): Promise<{ items: MovementRecord[]; total: number }> {
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM movement_records WHERE enterprise_id = $1`, [enterpriseId]
    );
    const result = await database.query(
      `SELECT mr.*,
              a.name as animal_name,
              ag.name as group_name,
              fl.name as from_location_name,
              tl.name as to_location_name,
              u.first_name || ' ' || u.last_name as recorded_by_name
       FROM movement_records mr
       LEFT JOIN animals a ON mr.animal_id = a.id
       LEFT JOIN animal_groups ag ON mr.group_id = ag.id
       LEFT JOIN locations fl ON mr.from_location_id = fl.id
       LEFT JOIN locations tl ON mr.to_location_id = tl.id
       JOIN users u ON mr.recorded_by = u.id
       WHERE mr.enterprise_id = $1
       ORDER BY mr.transport_date DESC
       LIMIT $2 OFFSET $3`,
      [enterpriseId, limit, offset]
    );
    return {
      items: result.rows.map((r: any) => this.mapRow(r)),
      total: parseInt(countResult.rows[0]?.total || '0'),
    };
  }

  private mapRow(row: any): MovementRecord {
    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      animalId: row.animal_id,
      groupId: row.group_id,
      fromLocationId: row.from_location_id,
      toLocationId: row.to_location_id,
      movementType: row.movement_type,
      reason: row.reason,
      animalCount: parseInt(row.animal_count || '1'),
      transportMethod: row.transport_method,
      transportDate: row.transport_date,
      regulatoryPermit: row.regulatory_permit,
      approvedBy: row.approved_by,
      status: row.status || 'pending',
      recordedBy: row.recorded_by,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      animalName: row.animal_name,
      groupName: row.group_name,
      fromLocationName: row.from_location_name,
      toLocationName: row.to_location_name,
      recordedByName: row.recorded_by_name,
    };
  }
}

export default new MovementService();
