import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

// ─── Interfaces ──────────────────────────────────────────────
export interface AnimalGroup {
  id: string;
  enterpriseId: string;
  name: string;
  groupType: string;
  species?: string;
  breed?: string;
  purpose?: string;
  targetCount: number;
  currentCount: number;
  description?: string;
  colorCode?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  // joined
  enterpriseName?: string;
}

export interface AnimalGroupCreateDTO {
  enterpriseId: string;
  name: string;
  groupType: string;
  species?: string;
  breed?: string;
  purpose?: string;
  targetCount?: number;
  description?: string;
  colorCode?: string;
}

export class AnimalGroupService {

  async createGroup(data: AnimalGroupCreateDTO): Promise<AnimalGroup> {
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO animal_groups (id, enterprise_id, name, group_type, species, breed, purpose, target_count, description, color_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [id, data.enterpriseId, data.name, data.groupType, data.species, data.breed,
         data.purpose, data.targetCount || 0, data.description, data.colorCode]
      );
      logger.info(`Animal group created: ${data.name}`, { groupId: id });
      return this.mapRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create animal group', { error: error.message });
      throw new DatabaseError('Failed to create animal group');
    }
  }

  async getGroup(id: string): Promise<AnimalGroup> {
    const result = await database.query(
      `SELECT ag.*, e.name as enterprise_name,
              (SELECT COUNT(*) FROM animals WHERE group_id = ag.id AND is_active = true) as actual_count
       FROM animal_groups ag
       JOIN enterprises e ON ag.enterprise_id = e.id
       WHERE ag.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Animal group not found');
    const row = result.rows[0];
    const mapped = this.mapRow(row);
    mapped.currentCount = parseInt(row.actual_count || '0');
    return mapped;
  }

  async listByEnterprise(enterpriseId: string, limit = 50, offset = 0): Promise<{ items: AnimalGroup[]; total: number }> {
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM animal_groups WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]
    );
    const result = await database.query(
      `SELECT ag.*, e.name as enterprise_name,
              (SELECT COUNT(*) FROM animals WHERE group_id = ag.id AND is_active = true) as actual_count
       FROM animal_groups ag
       JOIN enterprises e ON ag.enterprise_id = e.id
       WHERE ag.enterprise_id = $1 AND ag.is_active = true
       ORDER BY ag.name ASC
       LIMIT $2 OFFSET $3`,
      [enterpriseId, limit, offset]
    );
    return {
      items: result.rows.map((r: any) => {
        const mapped = this.mapRow(r);
        mapped.currentCount = parseInt(r.actual_count || '0');
        return mapped;
      }),
      total: parseInt(countResult.rows[0]?.total || '0'),
    };
  }

  async updateGroup(id: string, data: Partial<AnimalGroupCreateDTO>): Promise<AnimalGroup> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', groupType: 'group_type', species: 'species', breed: 'breed',
      purpose: 'purpose', targetCount: 'target_count', description: 'description', colorCode: 'color_code',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push((data as any)[key]);
      }
    }
    if (setClauses.length === 0) throw new Error('No fields to update');
    params.push(id);

    await database.query(`UPDATE animal_groups SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    return this.getGroup(id);
  }

  async deleteGroup(id: string): Promise<void> {
    // Unlink animals from group first
    await database.query(`UPDATE animals SET group_id = NULL WHERE group_id = $1`, [id]);
    await database.query(`UPDATE animal_groups SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  /** Assign animal to group */
  async assignAnimal(groupId: string, animalId: string): Promise<void> {
    await database.query(`UPDATE animals SET group_id = $1, updated_at = NOW() WHERE id = $2`, [groupId, animalId]);
    await this.updateGroupCount(groupId);
  }

  /** Remove animal from group */
  async removeAnimal(groupId: string, animalId: string): Promise<void> {
    await database.query(`UPDATE animals SET group_id = NULL, updated_at = NOW() WHERE id = $1 AND group_id = $2`, [animalId, groupId]);
    await this.updateGroupCount(groupId);
  }

  /** Recalculate current_count */
  private async updateGroupCount(groupId: string): Promise<void> {
    await database.query(
      `UPDATE animal_groups SET current_count = (SELECT COUNT(*) FROM animals WHERE group_id = $1 AND is_active = true), updated_at = NOW() WHERE id = $1`,
      [groupId]
    );
  }

  private mapRow(row: any): AnimalGroup {
    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      name: row.name,
      groupType: row.group_type,
      species: row.species,
      breed: row.breed,
      purpose: row.purpose,
      targetCount: parseInt(row.target_count || '0'),
      currentCount: parseInt(row.current_count || '0'),
      description: row.description,
      colorCode: row.color_code,
      isActive: row.is_active,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      enterpriseName: row.enterprise_name,
    };
  }
}

export default new AnimalGroupService();
