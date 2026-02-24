/**
 * Digital Twin & Scenario Simulator Service
 * Virtual farm models with what-if simulation, disease spread modeling,
 * resource optimization, and predictive outcome analysis.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const SCENARIO_ENGINES: Record<string, (params: any, state: any) => any> = {
  disease_spread: (params, state) => {
    const animals = state.animalCount || 100;
    const infectionRate = params.infectionRate || 0.15;
    const days = params.simulationDays || 30;
    const vaccinationRate = params.vaccinationRate || 0;
    const timeline: any[] = [];
    let infected = params.initialInfected || 1;
    let recovered = 0;
    let susceptible = animals - infected;
    const recoveryRate = 0.1;

    for (let d = 1; d <= days; d++) {
      const effectiveRate = infectionRate * (1 - vaccinationRate);
      const newInfected = Math.min(Math.round(infected * effectiveRate * (susceptible / animals)), susceptible);
      const newRecovered = Math.round(infected * recoveryRate);
      susceptible -= newInfected;
      infected = infected + newInfected - newRecovered;
      recovered += newRecovered;
      timeline.push({ day: d, susceptible, infected, recovered });
    }
    const peakDay = timeline.reduce((max, t) => t.infected > max.infected ? t : max, timeline[0]);
    return {
      rows: timeline,
      summary: { peakInfected: peakDay.infected, peakDay: peakDay.day, totalRecovered: recovered, finalSusceptible: susceptible },
      totalRows: timeline.length
    };
  },

  resource_optimization: (params, _state) => {
    const workers = params.workers || 10;
    const animals = params.animals || 500;
    const feedBudget = params.feedBudgetPerDay || 1000;
    const rows: any[] = [];
    for (let w = Math.max(1, workers - 3); w <= workers + 5; w++) {
      const animalsPerWorker = Math.round(animals / w);
      const efficiency = Math.min(100, (100 - (animalsPerWorker > 80 ? (animalsPerWorker - 80) * 2 : 0)));
      const feedPerAnimal = feedBudget / animals;
      const score = efficiency * 0.6 + (feedPerAnimal > 2 ? 40 : feedPerAnimal * 20);
      rows.push({ workers: w, animalsPerWorker, efficiency: efficiency.toFixed(1), feedPerAnimal: feedPerAnimal.toFixed(2), optimizationScore: score.toFixed(1) });
    }
    const optimal = rows.reduce((best, r) => +r.optimizationScore > +best.optimizationScore ? r : best, rows[0]);
    return { rows, summary: { optimalWorkers: optimal.workers, bestScore: optimal.optimizationScore }, totalRows: rows.length };
  },

  financial_forecast: (params, _state) => {
    const months = params.months || 12;
    const baseRevenue = params.monthlyRevenue || 50000;
    const baseCost = params.monthlyCost || 35000;
    const growthRate = params.growthRate || 0.02;
    const rows: any[] = [];
    let cumRevenue = 0, cumCost = 0;
    for (let m = 1; m <= months; m++) {
      const revenue = Math.round(baseRevenue * Math.pow(1 + growthRate, m - 1));
      const cost = Math.round(baseCost * Math.pow(1 + growthRate * 0.5, m - 1));
      cumRevenue += revenue; cumCost += cost;
      rows.push({ month: m, revenue, cost, profit: revenue - cost, cumRevenue, cumCost, cumProfit: cumRevenue - cumCost });
    }
    return { rows, summary: { totalRevenue: cumRevenue, totalCost: cumCost, netProfit: cumRevenue - cumCost, avgMonthlyProfit: Math.round((cumRevenue - cumCost) / months) }, totalRows: rows.length };
  },

  capacity_planning: (params, _state) => {
    const currentAnimals = params.currentAnimals || 200;
    const maxCapacity = params.maxCapacity || 500;
    const growthPerMonth = params.growthPerMonth || 15;
    const months = params.months || 24;
    const rows: any[] = [];
    let count = currentAnimals;
    for (let m = 1; m <= months; m++) {
      count = Math.min(count + growthPerMonth, maxCapacity);
      const utilization = ((count / maxCapacity) * 100).toFixed(1);
      const needsExpansion = count >= maxCapacity * 0.9;
      rows.push({ month: m, animalCount: count, utilization, needsExpansion, remainingCapacity: maxCapacity - count });
    }
    const fullMonth = rows.find(r => +r.utilization >= 90);
    return { rows, summary: { reachesCapacityMonth: fullMonth?.month || 'N/A', finalCount: rows[rows.length - 1].animalCount, finalUtilization: rows[rows.length - 1].utilization }, totalRows: rows.length };
  },
};

class DigitalTwinService {

  // ── Twins CRUD ──
  async listTwins(enterpriseId: string, filters: any = {}) {
    const { limit = 50, offset = 0 } = filters;
    const result = await pool.query(
      `SELECT t.*, u.first_name || ' ' || u.last_name as creator_name
       FROM digital_twins t LEFT JOIN users u ON t.created_by = u.id
       WHERE t.enterprise_id = $1 ORDER BY t.updated_at DESC LIMIT $2 OFFSET $3`,
      [enterpriseId, limit, offset]
    );
    return { items: result.rows, total: result.rows.length };
  }

  async createTwin(data: any) {
    const id = uuidv4();
    // Auto-populate model_data from enterprise stats
    let modelData = data.modelData || {};
    if (!data.modelData) {
      try {
        const stats = await pool.query(
          `SELECT
             (SELECT COUNT(*) FROM animals WHERE enterprise_id = $1) as animal_count,
             (SELECT COUNT(*) FROM enterprise_members WHERE enterprise_id = $1) as member_count,
             (SELECT COUNT(*) FROM locations WHERE enterprise_id = $1) as location_count`,
          [data.enterpriseId]
        );
        modelData = stats.rows[0] || {};
      } catch {
        modelData = { animal_count: 0, member_count: 0, location_count: 0 };
      }
    }

    await pool.query(
      `INSERT INTO digital_twins (id, enterprise_id, name, twin_type, description, model_data, current_state, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, data.enterpriseId, data.name, data.twinType || 'farm', data.description || null,
       JSON.stringify(modelData), JSON.stringify(modelData), data.createdBy || null]
    );
    const result = await pool.query('SELECT * FROM digital_twins WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateTwin(id: string, data: any) {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (data.name) { sets.push(`name = $${idx++}`); vals.push(data.name); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(data.description); }
    if (data.modelData) { sets.push(`model_data = $${idx++}`); vals.push(JSON.stringify(data.modelData)); }
    if (data.currentState) { sets.push(`current_state = $${idx++}`); vals.push(JSON.stringify(data.currentState)); }
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    await pool.query(`UPDATE digital_twins SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    const result = await pool.query('SELECT * FROM digital_twins WHERE id = $1', [id]);
    return result.rows[0];
  }

  async deleteTwin(id: string) {
    await pool.query('DELETE FROM digital_twins WHERE id = $1', [id]);
  }

  // ── Simulations ──
  async listSimulations(enterpriseId: string, filters: any = {}) {
    const { twinId, limit = 50, offset = 0 } = filters;
    let query = `SELECT sr.*, dt.name as twin_name
                 FROM simulation_runs sr JOIN digital_twins dt ON sr.twin_id = dt.id
                 WHERE sr.enterprise_id = $1`;
    const params: any[] = [enterpriseId];
    let idx = 2;
    if (twinId) { query += ` AND sr.twin_id = $${idx++}`; params.push(twinId); }
    query += ` ORDER BY sr.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async runSimulation(data: any) {
    const id = uuidv4();
    const startTime = Date.now();

    // Get twin state
    const twinRes = await pool.query('SELECT * FROM digital_twins WHERE id = $1', [data.twinId]);
    const twin = twinRes.rows[0];
    if (!twin) throw new Error('Digital twin not found');

    const engine = SCENARIO_ENGINES[data.scenarioType];
    if (!engine) throw new Error(`Unknown scenario type: ${data.scenarioType}`);

    const inputState = twin.current_state || {};
    const resultData = engine(data.parameters || {}, inputState);
    const duration = Date.now() - startTime;

    await pool.query(
      `INSERT INTO simulation_runs (id, twin_id, enterprise_id, name, scenario_type, parameters, input_state, result_data, outcome_summary, status, started_at, completed_at, duration_ms, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed',$10,NOW(),$11,$12)`,
      [id, data.twinId, data.enterpriseId, data.name, data.scenarioType,
       JSON.stringify(data.parameters || {}), JSON.stringify(inputState), JSON.stringify(resultData),
       JSON.stringify(resultData.summary), new Date(startTime), duration, data.createdBy || null]
    );
    const result = await pool.query(`SELECT sr.*, dt.name as twin_name FROM simulation_runs sr JOIN digital_twins dt ON sr.twin_id = dt.id WHERE sr.id = $1`, [id]);
    return result.rows[0];
  }

  async getSimulation(id: string) {
    const result = await pool.query(`SELECT sr.*, dt.name as twin_name FROM simulation_runs sr JOIN digital_twins dt ON sr.twin_id = dt.id WHERE sr.id = $1`, [id]);
    return result.rows[0] || null;
  }

  async deleteSimulation(id: string) {
    await pool.query('DELETE FROM simulation_runs WHERE id = $1', [id]);
  }

  // ── Dashboard ──
  async getDashboard(enterpriseId: string) {
    const [twins, simCount, recentSims] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM digital_twins WHERE enterprise_id = $1', [enterpriseId]),
      pool.query('SELECT COUNT(*) as total, scenario_type FROM simulation_runs WHERE enterprise_id = $1 GROUP BY scenario_type', [enterpriseId]),
      pool.query(`SELECT sr.id, sr.name, sr.scenario_type, sr.status, sr.duration_ms, sr.created_at, dt.name as twin_name
                  FROM simulation_runs sr JOIN digital_twins dt ON sr.twin_id = dt.id
                  WHERE sr.enterprise_id = $1 ORDER BY sr.created_at DESC LIMIT 5`, [enterpriseId]),
    ]);
    return {
      summary: { totalTwins: +(twins.rows[0]?.total || 0), totalSimulations: simCount.rows.reduce((s: number, r: any) => s + +r.total, 0) },
      byScenarioType: simCount.rows,
      recentSimulations: recentSims.rows,
    };
  }
}

export default new DigitalTwinService();
