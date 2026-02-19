import database from '../utils/database';
import logger from '../utils/logger';

class DiseasePredictionService {

  // ─── Predictions ───────────────────────────────────────────

  async listPredictions(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['dp.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.status) { conds.push(`dp.status = $${idx++}`); params.push(filters.status); }
    if (filters.diseaseName) { conds.push(`dp.disease_name ILIKE $${idx++}`); params.push(`%${filters.diseaseName}%`); }
    if (filters.minRisk) { conds.push(`dp.risk_score >= $${idx++}`); params.push(+filters.minRisk); }

    const result = await database.query(
      `SELECT dp.*, a.name as animal_name, a.species, u.first_name || ' ' || u.last_name as created_by_name
       FROM disease_predictions dp
       LEFT JOIN animals a ON a.id = dp.animal_id
       LEFT JOIN users u ON u.id = dp.created_by
       WHERE ${conds.join(' AND ')}
       ORDER BY dp.risk_score DESC, dp.created_at DESC
       LIMIT ${filters.limit || 50} OFFSET ${filters.offset || 0}`,
      params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createPrediction(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO disease_predictions (enterprise_id, animal_id, group_id, disease_name, risk_score, confidence,
        predicted_onset, risk_factors, recommended_actions, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.enterpriseId, data.animalId || null, data.groupId || null, data.diseaseName,
       data.riskScore || 0, data.confidence || 0, data.predictedOnset || null,
       JSON.stringify(data.riskFactors || []), JSON.stringify(data.recommendedActions || []),
       data.status || 'active', data.createdBy]
    );
    return result.rows[0];
  }

  async resolvePrediction(id: string, outcome: string): Promise<void> {
    await database.query(
      `UPDATE disease_predictions SET status = 'resolved', outcome = $2, resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id, outcome]
    );
  }

  /** AI-style risk analysis dashboard — aggregated disease risk data */
  async getRiskDashboard(enterpriseId: string): Promise<any> {
    const activePredictions = await database.query(
      `SELECT disease_name, AVG(risk_score) as avg_risk, MAX(risk_score) as max_risk, COUNT(*) as count
       FROM disease_predictions WHERE enterprise_id = $1 AND status = 'active'
       GROUP BY disease_name ORDER BY avg_risk DESC`, [enterpriseId]
    );

    const riskTimeline = await database.query(
      `SELECT date_trunc('week', created_at) as week, AVG(risk_score) as avg_risk, COUNT(*) as predictions
       FROM disease_predictions WHERE enterprise_id = $1 AND created_at > NOW() - INTERVAL '12 weeks'
       GROUP BY week ORDER BY week`, [enterpriseId]
    );

    const outcomeDist = await database.query(
      `SELECT outcome, COUNT(*) as count FROM disease_predictions
       WHERE enterprise_id = $1 AND status = 'resolved' GROUP BY outcome`, [enterpriseId]
    );

    const topRiskAnimals = await database.query(
      `SELECT a.id, a.name, a.species, a.breed, MAX(dp.risk_score) as highest_risk, COUNT(dp.id) as prediction_count
       FROM disease_predictions dp JOIN animals a ON a.id = dp.animal_id
       WHERE dp.enterprise_id = $1 AND dp.status = 'active'
       GROUP BY a.id, a.name, a.species, a.breed
       ORDER BY highest_risk DESC LIMIT 10`, [enterpriseId]
    );

    return {
      activePredictions: activePredictions.rows,
      riskTimeline: riskTimeline.rows,
      outcomeDistribution: outcomeDist.rows,
      topRiskAnimals: topRiskAnimals.rows,
      summary: {
        totalActive: activePredictions.rows.reduce((s: number, r: any) => s + +r.count, 0),
        avgRisk: activePredictions.rows.length ? +(activePredictions.rows.reduce((s: number, r: any) => s + +r.avg_risk, 0) / activePredictions.rows.length).toFixed(1) : 0,
        diseases: activePredictions.rows.length,
      }
    };
  }

  // ─── Outbreak Zones ────────────────────────────────────────

  async listOutbreakZones(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT oz.*, l.name as location_name
       FROM outbreak_zones oz LEFT JOIN locations l ON l.id = oz.location_id
       WHERE oz.enterprise_id = $1 ORDER BY oz.started_at DESC`, [enterpriseId]
    );
    return { items: result.rows };
  }

  async createOutbreakZone(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO outbreak_zones (enterprise_id, location_id, disease_name, severity, affected_count, total_at_risk,
        radius_km, center_lat, center_lng, containment_status, containment_actions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.enterpriseId, data.locationId || null, data.diseaseName, data.severity || 'low',
       data.affectedCount || 0, data.totalAtRisk || 0, data.radiusKm || null,
       data.centerLat || null, data.centerLng || null,
       data.containmentStatus || 'monitoring', JSON.stringify(data.containmentActions || [])]
    );
    return result.rows[0];
  }

  async resolveOutbreakZone(id: string): Promise<void> {
    await database.query(
      `UPDATE outbreak_zones SET containment_status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]
    );
  }
}

export default new DiseasePredictionService();
