import database from '../utils/database';
import logger from '../utils/logger';

class HealthAnalyticsService {

  /** Get health observations for an enterprise */
  async listObservations(enterpriseId: string, filters: any = {}): Promise<any> {
    const conditions = ['ho.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.animalId) { conditions.push(`ho.animal_id = $${idx++}`); params.push(filters.animalId); }
    if (filters.severity) { conditions.push(`ho.severity = $${idx++}`); params.push(filters.severity); }
    if (filters.observationType) { conditions.push(`ho.observation_type = $${idx++}`); params.push(filters.observationType); }
    if (filters.isResolved !== undefined) { conditions.push(`ho.is_resolved = $${idx++}`); params.push(filters.isResolved); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 50, 1), 200));
    params.push(Math.max(parseInt(filters.offset) || 0, 0));
    const result = await database.query(
      `SELECT ho.*, a.name as animal_name, u.first_name || ' ' || u.last_name as observer_name
       FROM health_observations ho
       LEFT JOIN animals a ON a.id = ho.animal_id
       LEFT JOIN users u ON u.id = ho.observer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ho.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );
    return { items: result.rows.map((r: any) => this.mapObservation(r)), total: result.rowCount };
  }

  /** Create a health observation */
  async createObservation(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO health_observations (enterprise_id, animal_id, group_id, observer_id, observation_type, severity, title, description,
        body_temperature, weight, weight_unit, heart_rate, respiratory_rate, body_condition_score, symptoms, diagnosis, treatment_given, follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [data.enterpriseId, data.animalId || null, data.groupId || null, data.observerId,
       data.observationType || 'general', data.severity || 'normal', data.title, data.description || null,
       data.bodyTemperature || null, data.weight || null, data.weightUnit || 'kg',
       data.heartRate || null, data.respiratoryRate || null, data.bodyConditionScore || null,
       data.symptoms || null, data.diagnosis || null, data.treatmentGiven || null, data.followUpDate || null]
    );

    // Update animal weight and health score if provided
    if (data.animalId && data.weight) {
      await database.query(
        `UPDATE animals SET current_weight = $1, weight_unit = $2, last_weighed_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [data.weight, data.weightUnit || 'kg', data.animalId]
      );
    }

    return this.mapObservation(result.rows[0]);
  }

  /** Resolve an observation */
  async resolveObservation(id: string): Promise<void> {
    await database.query(
      `UPDATE health_observations SET is_resolved = true, resolved_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]
    );
  }

  /** Enterprise health analytics dashboard data */
  async getHealthDashboard(enterpriseId: string): Promise<any> {
    // Severity distribution
    const severityDist = await database.query(
      `SELECT severity, COUNT(*) as count FROM health_observations 
       WHERE enterprise_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       GROUP BY severity ORDER BY count DESC`, [enterpriseId]
    );

    // Observations over time (last 12 weeks)
    const timeline = await database.query(
      `SELECT date_trunc('week', created_at) as week, COUNT(*) as count, severity
       FROM health_observations WHERE enterprise_id = $1 AND created_at > NOW() - INTERVAL '12 weeks'
       GROUP BY week, severity ORDER BY week`, [enterpriseId]
    );

    // Unresolved by type
    const unresolvedByType = await database.query(
      `SELECT observation_type, COUNT(*) as count FROM health_observations
       WHERE enterprise_id = $1 AND is_resolved = false
       GROUP BY observation_type ORDER BY count DESC`, [enterpriseId]
    );

    // Animal health scores distribution
    const healthScores = await database.query(
      `SELECT 
        CASE WHEN health_score >= 80 THEN 'excellent'
             WHEN health_score >= 60 THEN 'good'
             WHEN health_score >= 40 THEN 'fair'
             ELSE 'poor' END as category,
        COUNT(*) as count
       FROM animals WHERE enterprise_id = $1 AND is_active = true
       GROUP BY category`, [enterpriseId]
    );

    // Recent critical/emergency observations
    const criticalRecent = await database.query(
      `SELECT ho.*, a.name as animal_name FROM health_observations ho
       LEFT JOIN animals a ON a.id = ho.animal_id
       WHERE ho.enterprise_id = $1 AND ho.severity IN ('critical', 'emergency') AND ho.is_resolved = false
       ORDER BY ho.created_at DESC LIMIT 10`, [enterpriseId]
    );

    // Mortality (deceased animals last 12 months by month)
    const mortality = await database.query(
      `SELECT date_trunc('month', updated_at) as month, COUNT(*) as count
       FROM animals WHERE enterprise_id = $1 AND status = 'deceased' AND updated_at > NOW() - INTERVAL '12 months'
       GROUP BY month ORDER BY month`, [enterpriseId]
    );

    return {
      severityDistribution: severityDist.rows,
      observationTimeline: timeline.rows,
      unresolvedByType: unresolvedByType.rows,
      healthScoreDistribution: healthScores.rows,
      criticalObservations: criticalRecent.rows.map((r: any) => this.mapObservation(r)),
      mortalityTrend: mortality.rows,
      totalObservations90d: severityDist.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0),
      unresolvedCount: unresolvedByType.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0),
    };
  }

  private mapObservation(row: any): any {
    return {
      id: row.id, enterpriseId: row.enterprise_id, animalId: row.animal_id,
      groupId: row.group_id, observerId: row.observer_id,
      observationType: row.observation_type, severity: row.severity,
      title: row.title, description: row.description,
      bodyTemperature: row.body_temperature ? parseFloat(row.body_temperature) : null,
      weight: row.weight ? parseFloat(row.weight) : null, weightUnit: row.weight_unit,
      heartRate: row.heart_rate, respiratoryRate: row.respiratory_rate,
      bodyConditionScore: row.body_condition_score,
      symptoms: row.symptoms, diagnosis: row.diagnosis,
      treatmentGiven: row.treatment_given, followUpDate: row.follow_up_date,
      isResolved: row.is_resolved, resolvedAt: row.resolved_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
      animalName: row.animal_name, observerName: row.observer_name,
    };
  }
}

export default new HealthAnalyticsService();
