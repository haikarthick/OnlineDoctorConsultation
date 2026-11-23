import database from '../utils/database';
import logger from '../utils/logger';
import BodyMeasurementService from './BodyMeasurementService';

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
      `SELECT ho.*, a.name as animal_name, u.first_name || ' ' || u.last_name as observer_name,
              -- an animal's weight and body condition live in ONE place (its body-measurement history); older rows keep their own copy
              COALESCE(wh.weight, ho.weight) AS obs_weight, COALESCE(wh.unit, ho.weight_unit) AS obs_weight_unit,
              COALESCE(wh.body_condition_score, ho.body_condition_score) AS obs_bcs
       FROM health_observations ho
       LEFT JOIN weight_history wh ON wh.source = 'health_observation' AND wh.source_id::text = ho.id::text
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
    return database.transaction(async (client: any) => {
    const result = await client.query(
      `INSERT INTO health_observations (enterprise_id, animal_id, group_id, observer_id, observation_type, severity, title, description,
        body_temperature, weight, weight_unit, heart_rate, respiratory_rate, body_condition_score, symptoms, diagnosis, treatment_given, follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [data.enterpriseId, data.animalId || null, data.groupId || null, data.observerId,
       data.observationType || 'general', data.severity || 'normal', data.title, data.description || null,
       // An animal's weight and body condition go ONLY to its body-measurement history (below); a herd or farm-wide
       // observation has no animal there, so those keep the figure on the observation itself.
       data.bodyTemperature || null, data.animalId ? null : (data.weight || null), data.weightUnit || 'kg',
       data.heartRate || null, data.respiratoryRate || null, data.animalId ? null : (data.bodyConditionScore || null),
       data.symptoms || null, data.diagnosis || null, data.treatmentGiven || null, data.followUpDate || null]
    );

    // A weight or body condition score taken during an observation goes into the ONE body-measurement
    // history (migration 056), which also keeps the animal's current weight up to date. Before, only
    // animals.current_weight changed: the weight never reached the weight history and the score was
    // invisible to every other screen.
    if (data.animalId && (data.weight || data.bodyConditionScore)) {
      await BodyMeasurementService.record({
        animalId: data.animalId,
        weight: data.weight || null,
        unit: data.weightUnit || 'kg',
        bodyConditionScore: data.bodyConditionScore || null,
        source: 'health_observation',
        sourceId: result.rows[0].id,
        recordedBy: data.observerId || null,
      }, client);
    }

    return this.mapObservation({ ...result.rows[0], obs_weight: data.weight || null, obs_weight_unit: data.weightUnit || 'kg', obs_bcs: data.bodyConditionScore || null });
    });
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

    // Mortality, last 12 months by month: individually-kept animals that died PLUS the deaths recorded against flocks and
    // batches (the population ledger). Counting only animal rows made a flock that lost 300 birds read as zero deaths.
    const mortality = await database.query(
      `SELECT month, SUM(count)::int as count FROM (
         SELECT date_trunc('month', updated_at) as month, COUNT(*) as count
           FROM animals WHERE enterprise_id = $1 AND status = 'deceased' AND updated_at > NOW() - INTERVAL '12 months'
          GROUP BY 1
         UNION ALL
         SELECT date_trunc('month', e.event_date) as month, SUM(-e.quantity) as count
           FROM group_population_events e JOIN animal_groups g ON g.id = e.group_id
          WHERE g.enterprise_id = $1 AND e.event_type = 'mortality' AND e.event_date > NOW() - INTERVAL '12 months'
          GROUP BY 1
       ) m GROUP BY month ORDER BY month`, [enterpriseId]
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
      weight: (row.obs_weight ?? row.weight) ? parseFloat(row.obs_weight ?? row.weight) : null, weightUnit: row.obs_weight_unit ?? row.weight_unit,
      heartRate: row.heart_rate, respiratoryRate: row.respiratory_rate,
      bodyConditionScore: row.obs_bcs ?? row.body_condition_score,
      symptoms: row.symptoms, diagnosis: row.diagnosis,
      treatmentGiven: row.treatment_given, followUpDate: row.follow_up_date,
      isResolved: row.is_resolved, resolvedAt: row.resolved_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
      animalName: row.animal_name, observerName: row.observer_name,
    };
  }
}

export default new HealthAnalyticsService();
