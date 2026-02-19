/**
 * Client Portal & Wellness Service
 * Pet owner wellness scorecards, vaccination reminders, health timelines,
 * and personalized animal wellness tracking.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

class WellnessService {

  // ── Scorecards ──
  async listScorecards(ownerId: string, filters: any = {}) {
    const { animalId, limit = 50, offset = 0 } = filters;
    let query = `SELECT ws.*, a.name as animal_name, a.species, a.breed,
                 u.first_name || ' ' || u.last_name as assessed_by_name
                 FROM wellness_scorecards ws
                 JOIN animals a ON ws.animal_id = a.id
                 LEFT JOIN users u ON ws.assessed_by = u.id
                 WHERE ws.owner_id = $1`;
    const params: any[] = [ownerId]; let idx = 2;
    if (animalId) { query += ` AND ws.animal_id = $${idx++}`; params.push(animalId); }
    query += ` ORDER BY ws.assessed_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async createScorecard(data: any) {
    const id = uuidv4();
    const overall = ((+(data.nutritionScore || 0) + +(data.activityScore || 0) + +(data.vaccinationScore || 0) + +(data.dentalScore || 0)) / 4).toFixed(2);

    await pool.query(
      `INSERT INTO wellness_scorecards (id, animal_id, enterprise_id, owner_id, overall_score, nutrition_score, activity_score, vaccination_score, dental_score, weight_status, next_checkup, recommendations, risk_flags, assessed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, data.animalId, data.enterpriseId || null, data.ownerId, overall,
       data.nutritionScore || 0, data.activityScore || 0, data.vaccinationScore || 0,
       data.dentalScore || 0, data.weightStatus || 'normal', data.nextCheckup || null,
       JSON.stringify(data.recommendations || []), JSON.stringify(data.riskFlags || []),
       data.assessedBy || null]
    );
    return (await pool.query(`SELECT ws.*, a.name as animal_name, a.species FROM wellness_scorecards ws JOIN animals a ON ws.animal_id = a.id WHERE ws.id = $1`, [id])).rows[0];
  }

  async updateScorecard(id: string, data: any) {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    for (const field of ['nutrition_score', 'activity_score', 'vaccination_score', 'dental_score', 'weight_status', 'next_checkup']) {
      const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (data[camel] !== undefined) { sets.push(`${field} = $${idx++}`); vals.push(data[camel]); }
    }
    if (data.recommendations) { sets.push(`recommendations = $${idx++}`); vals.push(JSON.stringify(data.recommendations)); }
    if (data.riskFlags) { sets.push(`risk_flags = $${idx++}`); vals.push(JSON.stringify(data.riskFlags)); }

    // Recalculate overall
    const current = await pool.query('SELECT * FROM wellness_scorecards WHERE id = $1', [id]);
    if (current.rows[0]) {
      const n = data.nutritionScore ?? current.rows[0].nutrition_score;
      const a = data.activityScore ?? current.rows[0].activity_score;
      const v = data.vaccinationScore ?? current.rows[0].vaccination_score;
      const d = data.dentalScore ?? current.rows[0].dental_score;
      sets.push(`overall_score = $${idx++}`); vals.push(((+n + +a + +v + +d) / 4).toFixed(2));
    }

    sets.push('updated_at = NOW()'); vals.push(id);
    await pool.query(`UPDATE wellness_scorecards SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return (await pool.query('SELECT * FROM wellness_scorecards WHERE id = $1', [id])).rows[0];
  }

  async deleteScorecard(id: string) {
    await pool.query('DELETE FROM wellness_scorecards WHERE id = $1', [id]);
  }

  // ── Reminders ──
  async listReminders(ownerId: string, filters: any = {}) {
    const { status, animalId, priority, limit = 100, offset = 0 } = filters;
    let query = `SELECT wr.*, a.name as animal_name, a.species
                 FROM wellness_reminders wr
                 JOIN animals a ON wr.animal_id = a.id
                 WHERE wr.owner_id = $1`;
    const params: any[] = [ownerId]; let idx = 2;
    if (status) { query += ` AND wr.status = $${idx++}`; params.push(status); }
    if (animalId) { query += ` AND wr.animal_id = $${idx++}`; params.push(animalId); }
    if (priority) { query += ` AND wr.priority = $${idx++}`; params.push(priority); }
    query += ` ORDER BY CASE WHEN wr.status = 'pending' THEN 0 WHEN wr.status = 'snoozed' THEN 1 ELSE 2 END, wr.due_date ASC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async createReminder(data: any) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO wellness_reminders (id, animal_id, owner_id, reminder_type, title, description, due_date, priority, recurrence, recurrence_interval)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.animalId, data.ownerId, data.reminderType, data.title, data.description || null,
       data.dueDate, data.priority || 'medium', data.recurrence || null, data.recurrenceInterval || null]
    );
    return (await pool.query(`SELECT wr.*, a.name as animal_name FROM wellness_reminders wr JOIN animals a ON wr.animal_id = a.id WHERE wr.id = $1`, [id])).rows[0];
  }

  async completeReminder(id: string) {
    await pool.query(`UPDATE wellness_reminders SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);

    // If recurrence set, create next reminder
    const reminder = await pool.query('SELECT * FROM wellness_reminders WHERE id = $1', [id]);
    if (reminder.rows[0]?.recurrence) {
      const r = reminder.rows[0];
      const interval = r.recurrence_interval || 1;
      const unit = r.recurrence === 'daily' ? 'days' : r.recurrence === 'weekly' ? 'weeks' : r.recurrence === 'monthly' ? 'months' : 'years';
      const newDate = new Date(r.due_date);
      if (unit === 'days') newDate.setDate(newDate.getDate() + interval);
      else if (unit === 'weeks') newDate.setDate(newDate.getDate() + interval * 7);
      else if (unit === 'months') newDate.setMonth(newDate.getMonth() + interval);
      else newDate.setFullYear(newDate.getFullYear() + interval);

      await this.createReminder({
        animalId: r.animal_id, ownerId: r.owner_id, reminderType: r.reminder_type,
        title: r.title, description: r.description, dueDate: newDate.toISOString().split('T')[0],
        priority: r.priority, recurrence: r.recurrence, recurrenceInterval: r.recurrence_interval,
      });
    }
    return (await pool.query('SELECT * FROM wellness_reminders WHERE id = $1', [id])).rows[0];
  }

  async snoozeReminder(id: string, until: string) {
    await pool.query(`UPDATE wellness_reminders SET status = 'snoozed', snoozed_until = $1, updated_at = NOW() WHERE id = $2`, [until, id]);
    return (await pool.query('SELECT * FROM wellness_reminders WHERE id = $1', [id])).rows[0];
  }

  async deleteReminder(id: string) {
    await pool.query('DELETE FROM wellness_reminders WHERE id = $1', [id]);
  }

  // ── Wellness Dashboard ──
  async getDashboard(ownerId: string) {
    const [scorecards, upcomingReminders, overdueReminders, animalBreakdown] = await Promise.all([
      pool.query(`SELECT ws.*, a.name as animal_name, a.species
                  FROM wellness_scorecards ws JOIN animals a ON ws.animal_id = a.id
                  WHERE ws.owner_id = $1 AND ws.id IN (
                    SELECT DISTINCT ON (animal_id) id FROM wellness_scorecards WHERE owner_id = $1 ORDER BY animal_id, assessed_at DESC
                  )`, [ownerId]),
      pool.query(`SELECT wr.*, a.name as animal_name FROM wellness_reminders wr JOIN animals a ON wr.animal_id = a.id
                  WHERE wr.owner_id = $1 AND wr.status = 'pending' AND wr.due_date >= CURRENT_DATE AND wr.due_date <= CURRENT_DATE + INTERVAL '14 days'
                  ORDER BY wr.due_date ASC LIMIT 10`, [ownerId]),
      pool.query(`SELECT COUNT(*) as count FROM wellness_reminders WHERE owner_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE`, [ownerId]),
      pool.query(`SELECT a.species, COUNT(*) as count, AVG(ws.overall_score) as avg_score
                  FROM animals a LEFT JOIN wellness_scorecards ws ON ws.animal_id = a.id AND ws.owner_id = $1
                  WHERE a.owner_id = $1 GROUP BY a.species`, [ownerId]),
    ]);

    const allScores = scorecards.rows.map((s: any) => +s.overall_score);
    const avgScore = allScores.length > 0 ? allScores.reduce((s: number, v: number) => s + v, 0) / allScores.length : 0;

    return {
      summary: {
        totalAnimals: animalBreakdown.rows.reduce((s: number, r: any) => s + +r.count, 0),
        avgWellnessScore: avgScore.toFixed(1),
        overdueReminders: +(overdueReminders.rows[0]?.count || 0),
        upcomingReminders: upcomingReminders.rows.length,
      },
      latestScorecards: scorecards.rows,
      upcomingReminders: upcomingReminders.rows,
      bySpecies: animalBreakdown.rows,
    };
  }
}

export default new WellnessService();
