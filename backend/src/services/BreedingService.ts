import database from '../utils/database';
import logger from '../utils/logger';

class BreedingService {

  async create(data: any): Promise<any> {
    const gestationDays = data.gestationDays || this.estimateGestation(data.species);
    const expectedDue = data.expectedDueDate || (gestationDays
      ? new Date(new Date(data.breedingDate).getTime() + gestationDays * 86400000).toISOString().split('T')[0]
      : null);

    const result = await database.query(
      `INSERT INTO breeding_records (enterprise_id, dam_id, sire_id, breeding_method, breeding_date,
        expected_due_date, gestation_days, status, semen_batch, technician_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.enterpriseId, data.damId || null, data.sireId || null, data.breedingMethod || 'natural',
       data.breedingDate, expectedDue, gestationDays, data.status || 'bred',
       data.semenBatch || null, data.technicianId || null, data.notes || null]
    );

    // Update dam breeding status
    if (data.damId) {
      await database.query(
        `UPDATE animals SET breeding_status = 'bred', last_breeding_date = $1, expected_due_date = $2, updated_at = NOW() WHERE id = $3`,
        [data.breedingDate, expectedDue, data.damId]
      );
    }

    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: any): Promise<any> {
    const result = await database.query(
      `UPDATE breeding_records SET
        breeding_method = COALESCE($2, breeding_method),
        expected_due_date = COALESCE($3, expected_due_date),
        actual_birth_date = COALESCE($4, actual_birth_date),
        offspring_count = COALESCE($5, offspring_count),
        live_births = COALESCE($6, live_births),
        stillbirths = COALESCE($7, stillbirths),
        status = COALESCE($8, status),
        pregnancy_confirmed = COALESCE($9, pregnancy_confirmed),
        pregnancy_check_date = COALESCE($10, pregnancy_check_date),
        notes = COALESCE($11, notes),
        outcome = COALESCE($12, outcome),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.breedingMethod, data.expectedDueDate, data.actualBirthDate,
       data.offspringCount, data.liveBirths, data.stillbirths, data.status,
       data.pregnancyConfirmed, data.pregnancyCheckDate, data.notes, data.outcome]
    );

    // Update dam status based on breeding record status
    const record = result.rows[0];
    if (record && record.dam_id) {
      let breedingStatus = record.status;
      if (record.status === 'delivered') breedingStatus = 'open';
      await database.query(
        `UPDATE animals SET breeding_status = $1, updated_at = NOW() WHERE id = $2`,
        [breedingStatus, record.dam_id]
      );
    }

    return this.mapRow(result.rows[0]);
  }

  async list(enterpriseId: string, filters: any = {}): Promise<any> {
    const conditions = ['br.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.status) { conditions.push(`br.status = $${idx++}`); params.push(filters.status); }
    if (filters.damId) { conditions.push(`br.dam_id = $${idx++}`); params.push(filters.damId); }

    const result = await database.query(
      `SELECT br.*, 
        d.name as dam_name, d.species as dam_species, d.breed as dam_breed,
        s.name as sire_name, s.species as sire_species,
        t.first_name || ' ' || t.last_name as technician_name
       FROM breeding_records br
       LEFT JOIN animals d ON d.id = br.dam_id
       LEFT JOIN animals s ON s.id = br.sire_id
       LEFT JOIN users t ON t.id = br.technician_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY br.breeding_date DESC
       LIMIT ${filters.limit || 50} OFFSET ${filters.offset || 0}`,
      params
    );
    return { items: result.rows.map((r: any) => this.mapRow(r)), total: result.rowCount };
  }

  async getById(id: string): Promise<any> {
    const result = await database.query(
      `SELECT br.*, d.name as dam_name, s.name as sire_name
       FROM breeding_records br LEFT JOIN animals d ON d.id = br.dam_id LEFT JOIN animals s ON s.id = br.sire_id
       WHERE br.id = $1`, [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Upcoming due dates in next N days */
  async getUpcomingDueDates(enterpriseId: string, days: number = 30): Promise<any[]> {
    const result = await database.query(
      `SELECT br.*, d.name as dam_name, d.species as dam_species
       FROM breeding_records br LEFT JOIN animals d ON d.id = br.dam_id
       WHERE br.enterprise_id = $1 AND br.status IN ('bred', 'confirmed')
         AND br.expected_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int
       ORDER BY br.expected_due_date`, [enterpriseId, days]
    );
    return result.rows.map((r: any) => this.mapRow(r));
  }

  /** Breeding stats */
  async getBreedingStats(enterpriseId: string): Promise<any> {
    const stats = await database.query(
      `SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'bred') as bred_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        SUM(live_births) as total_live_births,
        SUM(stillbirths) as total_stillbirths,
        AVG(gestation_days) FILTER (WHERE gestation_days > 0) as avg_gestation
       FROM breeding_records WHERE enterprise_id = $1 AND created_at > NOW() - INTERVAL '12 months'`,
      [enterpriseId]
    );
    return stats.rows[0];
  }

  private estimateGestation(species?: string): number | null {
    if (!species) return null;
    const map: Record<string, number> = {
      cattle: 283, cow: 283, horse: 340, pig: 114, sheep: 148,
      goat: 150, dog: 63, cat: 65, rabbit: 31, chicken: 21,
    };
    return map[species.toLowerCase()] || null;
  }

  private mapRow(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, damId: row.dam_id, sireId: row.sire_id,
      breedingMethod: row.breeding_method, breedingDate: row.breeding_date,
      expectedDueDate: row.expected_due_date, actualBirthDate: row.actual_birth_date,
      gestationDays: row.gestation_days, offspringCount: row.offspring_count,
      liveBirths: row.live_births, stillbirths: row.stillbirths, status: row.status,
      semenBatch: row.semen_batch, technicianId: row.technician_id,
      pregnancyConfirmed: row.pregnancy_confirmed, pregnancyCheckDate: row.pregnancy_check_date,
      notes: row.notes, outcome: row.outcome, createdAt: row.created_at, updatedAt: row.updated_at,
      damName: row.dam_name, damSpecies: row.dam_species, damBreed: row.dam_breed,
      sireName: row.sire_name, sireSpecies: row.sire_species, technicianName: row.technician_name,
    };
  }
}

export default new BreedingService();
