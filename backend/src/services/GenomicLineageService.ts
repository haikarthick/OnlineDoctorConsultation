import database from '../utils/database';
import logger from '../utils/logger';

class GenomicLineageService {

  // ─── Genetic Profiles ─────────────────────────────────────

  async listProfiles(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['gp.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.animalId) { conds.push(`gp.animal_id = $${idx++}`); params.push(filters.animalId); }
    if (filters.minInbreeding !== undefined) { conds.push(`gp.inbreeding_coefficient >= $${idx++}`); params.push(+filters.minInbreeding); }

    const result = await database.query(
      `SELECT gp.*, a.name as animal_name, a.species, a.breed,
        sire.name as sire_name, dam.name as dam_name
       FROM genetic_profiles gp
       JOIN animals a ON a.id = gp.animal_id
       LEFT JOIN animals sire ON sire.id = gp.sire_id
       LEFT JOIN animals dam ON dam.id = gp.dam_id
       WHERE ${conds.join(' AND ')}
       ORDER BY gp.created_at DESC
       LIMIT ${filters.limit || 50} OFFSET ${filters.offset || 0}`,
      params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createProfile(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO genetic_profiles (animal_id, enterprise_id, sire_id, dam_id, generation,
        inbreeding_coefficient, genetic_traits, dna_test_date, dna_lab, dna_sample_id, known_markers, breed_purity_pct, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [data.animalId, data.enterpriseId, data.sireId || null, data.damId || null,
       data.generation || 0, data.inbreedingCoefficient || 0,
       JSON.stringify(data.geneticTraits || {}), data.dnaTestDate || null,
       data.dnaLab || null, data.dnaSampleId || null,
       JSON.stringify(data.knownMarkers || []), data.breedPurityPct || null, data.notes || null]
    );
    return result.rows[0];
  }

  async updateProfile(id: string, data: any): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      sireId: 'sire_id', damId: 'dam_id', generation: 'generation',
      inbreedingCoefficient: 'inbreeding_coefficient',
      geneticTraits: 'genetic_traits', dnaTestDate: 'dna_test_date',
      dnaLab: 'dna_lab', dnaSampleId: 'dna_sample_id',
      knownMarkers: 'known_markers', breedPurityPct: 'breed_purity_pct', notes: 'notes'
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) {
        const val = (k === 'geneticTraits' || k === 'knownMarkers') ? JSON.stringify(data[k]) : data[k];
        sets.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }
    if (!sets.length) return {};
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await database.query(
      `UPDATE genetic_profiles SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0];
  }

  /** Build ancestry tree up to N generations */
  async getLineageTree(animalId: string, depth: number = 4): Promise<any> {
    // Recursive CTE to fetch ancestors
    const result = await database.query(
      `WITH RECURSIVE lineage AS (
         SELECT gp.animal_id, gp.sire_id, gp.dam_id, a.name, a.species, a.breed, gp.inbreeding_coefficient, 0 as gen
         FROM genetic_profiles gp JOIN animals a ON a.id = gp.animal_id
         WHERE gp.animal_id = $1
         UNION ALL
         SELECT gp.animal_id, gp.sire_id, gp.dam_id, a.name, a.species, a.breed, gp.inbreeding_coefficient, l.gen + 1
         FROM lineage l
         JOIN genetic_profiles gp ON gp.animal_id = l.sire_id OR gp.animal_id = l.dam_id
         JOIN animals a ON a.id = gp.animal_id
         WHERE l.gen < $2
       )
       SELECT * FROM lineage ORDER BY gen`,
      [animalId, depth]
    );
    return { tree: result.rows };
  }

  // ─── Lineage Pair Recommendations ─────────────────────────

  async listPairRecommendations(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT lp.*, s.name as sire_name, s.breed as sire_breed, d.name as dam_name, d.breed as dam_breed
       FROM lineage_pairs lp
       JOIN animals s ON s.id = lp.sire_id
       JOIN animals d ON d.id = lp.dam_id
       WHERE lp.enterprise_id = $1 ORDER BY lp.compatibility_score DESC`, [enterpriseId]
    );
    return { items: result.rows };
  }

  async createPairRecommendation(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO lineage_pairs (enterprise_id, sire_id, dam_id, compatibility_score,
        predicted_inbreeding, predicted_traits, recommendation, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.enterpriseId, data.sireId, data.damId,
       data.compatibilityScore || 0, data.predictedInbreeding || 0,
       JSON.stringify(data.predictedTraits || {}),
       data.recommendation || 'neutral', data.reason || null, data.createdBy]
    );
    return result.rows[0];
  }

  /** Genetic diversity dashboard */
  async getGeneticDashboard(enterpriseId: string): Promise<any> {
    const avgInbreeding = await database.query(
      `SELECT AVG(inbreeding_coefficient) as avg, MAX(inbreeding_coefficient) as max, MIN(inbreeding_coefficient) as min, COUNT(*) as total
       FROM genetic_profiles WHERE enterprise_id = $1`, [enterpriseId]
    );
    const bySpecies = await database.query(
      `SELECT a.species, AVG(gp.inbreeding_coefficient) as avg_inbreeding, COUNT(*) as count
       FROM genetic_profiles gp JOIN animals a ON a.id = gp.animal_id
       WHERE gp.enterprise_id = $1 GROUP BY a.species`, [enterpriseId]
    );
    const generationDist = await database.query(
      `SELECT generation, COUNT(*) as count FROM genetic_profiles WHERE enterprise_id = $1 GROUP BY generation ORDER BY generation`,
      [enterpriseId]
    );
    const highRisk = await database.query(
      `SELECT gp.*, a.name, a.species FROM genetic_profiles gp JOIN animals a ON a.id = gp.animal_id
       WHERE gp.enterprise_id = $1 AND gp.inbreeding_coefficient > 0.0625 ORDER BY gp.inbreeding_coefficient DESC LIMIT 10`,
      [enterpriseId]
    );

    return {
      summary: avgInbreeding.rows[0],
      bySpecies: bySpecies.rows,
      generationDistribution: generationDist.rows,
      highRiskInbreeding: highRisk.rows
    };
  }
}

export default new GenomicLineageService();
