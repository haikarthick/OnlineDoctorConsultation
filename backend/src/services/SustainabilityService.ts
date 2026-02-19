/**
 * Sustainability & Carbon Tracker Service
 * ESG scoring, carbon footprint per animal, water/energy/waste tracking,
 * sustainability goals with progress monitoring.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const METRIC_TYPES = [
  'carbon_emissions', 'water_usage', 'energy_consumption', 'waste_generated',
  'feed_waste', 'methane_output', 'land_use', 'biodiversity_index',
  'renewable_energy_pct', 'recycling_rate', 'water_recycled',
];

const EMISSION_FACTORS: Record<string, number> = {
  cattle: 2300,     // kg CO2e per head per year
  dairy: 3100,
  poultry: 45,
  swine: 670,
  sheep: 390,
  goat: 260,
  horse: 800,
  fish: 25,
  default: 500,
};

class SustainabilityService {

  // ── Metrics CRUD ──
  async listMetrics(enterpriseId: string, filters: any = {}) {
    const { metricType, category, periodStart, periodEnd, limit = 100, offset = 0 } = filters;
    let query = `SELECT m.*, u.first_name || ' ' || u.last_name as recorded_by_name
                 FROM sustainability_metrics m LEFT JOIN users u ON m.recorded_by = u.id
                 WHERE m.enterprise_id = $1`;
    const params: any[] = [enterpriseId]; let idx = 2;
    if (metricType) { query += ` AND m.metric_type = $${idx++}`; params.push(metricType); }
    if (category) { query += ` AND m.category = $${idx++}`; params.push(category); }
    if (periodStart) { query += ` AND m.period_start >= $${idx++}`; params.push(periodStart); }
    if (periodEnd) { query += ` AND m.period_end <= $${idx++}`; params.push(periodEnd); }
    query += ` ORDER BY m.period_start DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async createMetric(data: any) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO sustainability_metrics (id, enterprise_id, metric_type, metric_name, value, unit, period_start, period_end, category, scope, data_source, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, data.enterpriseId, data.metricType, data.metricName, data.value, data.unit || null,
       data.periodStart, data.periodEnd, data.category || 'general', data.scope || 'scope_1',
       data.dataSource || null, data.notes || null, data.recordedBy || null]
    );
    const result = await pool.query('SELECT * FROM sustainability_metrics WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateMetric(id: string, data: any) {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    for (const field of ['metric_name', 'value', 'unit', 'notes', 'category', 'scope', 'data_source']) {
      const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (data[camel] !== undefined) { sets.push(`${field} = $${idx++}`); vals.push(data[camel]); }
      else if (data[field] !== undefined) { sets.push(`${field} = $${idx++}`); vals.push(data[field]); }
    }
    sets.push('updated_at = NOW()'); vals.push(id);
    await pool.query(`UPDATE sustainability_metrics SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return (await pool.query('SELECT * FROM sustainability_metrics WHERE id = $1', [id])).rows[0];
  }

  async deleteMetric(id: string) {
    await pool.query('DELETE FROM sustainability_metrics WHERE id = $1', [id]);
  }

  // ── Goals ──
  async listGoals(enterpriseId: string) {
    const result = await pool.query(
      `SELECT g.*, u.first_name || ' ' || u.last_name as creator_name
       FROM sustainability_goals g LEFT JOIN users u ON g.created_by = u.id
       WHERE g.enterprise_id = $1 ORDER BY g.target_date ASC`, [enterpriseId]
    );
    return { items: result.rows, total: result.rows.length };
  }

  async createGoal(data: any) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO sustainability_goals (id, enterprise_id, goal_name, description, metric_type, target_value, current_value, unit, baseline_value, baseline_date, target_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, data.enterpriseId, data.goalName, data.description || null, data.metricType,
       data.targetValue, data.currentValue || 0, data.unit || null, data.baselineValue || null,
       data.baselineDate || null, data.targetDate, data.createdBy || null]
    );
    return (await pool.query('SELECT * FROM sustainability_goals WHERE id = $1', [id])).rows[0];
  }

  async updateGoal(id: string, data: any) {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (data.currentValue !== undefined) { sets.push(`current_value = $${idx++}`); vals.push(data.currentValue); }
    if (data.status) { sets.push(`status = $${idx++}`); vals.push(data.status); }
    if (data.goalName) { sets.push(`goal_name = $${idx++}`); vals.push(data.goalName); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(data.description); }

    // Auto-calculate progress
    if (data.currentValue !== undefined) {
      const goal = await pool.query('SELECT target_value, baseline_value FROM sustainability_goals WHERE id = $1', [id]);
      if (goal.rows[0]) {
        const target = +goal.rows[0].target_value;
        const baseline = +(goal.rows[0].baseline_value || 0);
        const current = +data.currentValue;
        const progress = target !== baseline ? Math.min(100, Math.max(0, ((current - baseline) / (target - baseline)) * 100)) : 0;
        sets.push(`progress_pct = $${idx++}`); vals.push(progress.toFixed(2));
      }
    }

    sets.push('updated_at = NOW()'); vals.push(id);
    await pool.query(`UPDATE sustainability_goals SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return (await pool.query('SELECT * FROM sustainability_goals WHERE id = $1', [id])).rows[0];
  }

  async deleteGoal(id: string) {
    await pool.query('DELETE FROM sustainability_goals WHERE id = $1', [id]);
  }

  // ── Carbon Footprint Estimator ──
  async estimateCarbonFootprint(enterpriseId: string) {
    // Get animal counts by species
    const animalRes = await pool.query(
      `SELECT species, COUNT(*) as count FROM animals WHERE enterprise_id = $1 GROUP BY species`, [enterpriseId]
    );
    const estimates: any[] = [];
    let totalCO2 = 0;
    for (const row of animalRes.rows) {
      const factor = EMISSION_FACTORS[row.species?.toLowerCase()] || EMISSION_FACTORS.default;
      const co2 = factor * +row.count;
      totalCO2 += co2;
      estimates.push({ species: row.species, count: +row.count, emissionFactor: factor, annualCO2kg: co2 });
    }

    // Get any tracked metrics for comparison
    const tracked = await pool.query(
      `SELECT metric_type, SUM(value) as total, unit FROM sustainability_metrics
       WHERE enterprise_id = $1 AND metric_type = 'carbon_emissions' AND period_start >= NOW() - INTERVAL '1 year'
       GROUP BY metric_type, unit`, [enterpriseId]
    );

    return {
      estimates,
      totalEstimatedCO2kg: totalCO2,
      totalEstimatedCO2tons: (totalCO2 / 1000).toFixed(2),
      trackedEmissions: tracked.rows,
      methodology: 'Based on IPCC Tier 1 emission factors per head per year',
    };
  }

  // ── Dashboard ──
  async getDashboard(enterpriseId: string) {
    const [metricSummary, goals, recentMetrics, carbonEst] = await Promise.all([
      pool.query(`SELECT metric_type, COUNT(*) as entries, SUM(value) as total_value, AVG(value) as avg_value, unit
                  FROM sustainability_metrics WHERE enterprise_id = $1 GROUP BY metric_type, unit`, [enterpriseId]),
      pool.query(`SELECT * FROM sustainability_goals WHERE enterprise_id = $1 ORDER BY progress_pct DESC`, [enterpriseId]),
      pool.query(`SELECT * FROM sustainability_metrics WHERE enterprise_id = $1 ORDER BY created_at DESC LIMIT 10`, [enterpriseId]),
      this.estimateCarbonFootprint(enterpriseId),
    ]);

    const activeGoals = goals.rows.filter((g: any) => g.status === 'active');
    const avgProgress = activeGoals.length > 0 ? activeGoals.reduce((s: number, g: any) => s + +g.progress_pct, 0) / activeGoals.length : 0;

    return {
      summary: {
        totalMetricEntries: metricSummary.rows.reduce((s: number, r: any) => s + +r.entries, 0),
        metricTypes: metricSummary.rows.length,
        activeGoals: activeGoals.length,
        avgGoalProgress: avgProgress.toFixed(1),
        estimatedCO2tons: carbonEst.totalEstimatedCO2tons,
      },
      byMetricType: metricSummary.rows,
      goals: goals.rows,
      recentMetrics: recentMetrics.rows,
      carbonEstimate: carbonEst,
    };
  }
}

export default new SustainabilityService();
