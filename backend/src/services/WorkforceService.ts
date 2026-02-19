import database from '../utils/database';
import logger from '../utils/logger';

class WorkforceService {

  // ─── Tasks ────────────────────────────────────────────────

  async listTasks(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['wt.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.status) { conds.push(`wt.status = $${idx++}`); params.push(filters.status); }
    if (filters.assignedTo) { conds.push(`wt.assigned_to = $${idx++}`); params.push(filters.assignedTo); }
    if (filters.priority) { conds.push(`wt.priority = $${idx++}`); params.push(filters.priority); }
    if (filters.taskType) { conds.push(`wt.task_type = $${idx++}`); params.push(filters.taskType); }

    const result = await database.query(
      `SELECT wt.*, 
        u_assign.first_name || ' ' || u_assign.last_name as assigned_to_name,
        u_create.first_name || ' ' || u_create.last_name as created_by_name,
        a.name as animal_name, ag.name as group_name, l.name as location_name
       FROM workforce_tasks wt
       LEFT JOIN users u_assign ON u_assign.id = wt.assigned_to
       LEFT JOIN users u_create ON u_create.id = wt.created_by
       LEFT JOIN animals a ON a.id = wt.animal_id
       LEFT JOIN animal_groups ag ON ag.id = wt.group_id
       LEFT JOIN locations l ON l.id = wt.location_id
       WHERE ${conds.join(' AND ')}
       ORDER BY CASE wt.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, wt.due_date ASC NULLS LAST
       LIMIT ${filters.limit || 50} OFFSET ${filters.offset || 0}`,
      params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createTask(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO workforce_tasks (enterprise_id, title, description, task_type, priority, status,
        assigned_to, created_by, location_id, animal_id, group_id, checklist, due_date, estimated_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [data.enterpriseId, data.title, data.description || null,
       data.taskType || 'general', data.priority || 'medium', data.status || 'pending',
       data.assignedTo || null, data.createdBy,
       data.locationId || null, data.animalId || null, data.groupId || null,
       JSON.stringify(data.checklist || []), data.dueDate || null,
       data.estimatedHours || null]
    );
    return result.rows[0];
  }

  async updateTask(id: string, data: any): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      title: 'title', description: 'description', taskType: 'task_type',
      priority: 'priority', status: 'status', assignedTo: 'assigned_to',
      dueDate: 'due_date', estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours', notes: 'notes'
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(data[k]); }
    }
    if (data.checklist) { sets.push(`checklist = $${idx++}`); params.push(JSON.stringify(data.checklist)); }
    if (data.status === 'in_progress' && !data.skipStarted) { sets.push(`started_at = COALESCE(started_at, NOW())`); }
    if (data.status === 'completed') { sets.push(`completed_at = NOW()`); }
    if (!sets.length) return {};
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await database.query(
      `UPDATE workforce_tasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0];
  }

  async deleteTask(id: string): Promise<void> {
    await database.query(`DELETE FROM workforce_tasks WHERE id = $1`, [id]);
  }

  // ─── Shift Schedules ─────────────────────────────────────

  async listShifts(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['ss.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.userId) { conds.push(`ss.user_id = $${idx++}`); params.push(filters.userId); }
    if (filters.from) { conds.push(`ss.shift_date >= $${idx++}`); params.push(filters.from); }
    if (filters.to) { conds.push(`ss.shift_date <= $${idx++}`); params.push(filters.to); }
    if (filters.status) { conds.push(`ss.status = $${idx++}`); params.push(filters.status); }

    const result = await database.query(
      `SELECT ss.*, u.first_name || ' ' || u.last_name as user_name, l.name as location_name
       FROM shift_schedules ss
       LEFT JOIN users u ON u.id = ss.user_id
       LEFT JOIN locations l ON l.id = ss.location_id
       WHERE ${conds.join(' AND ')}
       ORDER BY ss.shift_date ASC, ss.start_time ASC
       LIMIT ${filters.limit || 100}`, params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createShift(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO shift_schedules (enterprise_id, user_id, shift_date, start_time, end_time,
        role_on_shift, location_id, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.enterpriseId, data.userId, data.shiftDate, data.startTime, data.endTime,
       data.roleOnShift || null, data.locationId || null,
       data.status || 'scheduled', data.notes || null]
    );
    return result.rows[0];
  }

  async updateShift(id: string, data: any): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      shiftDate: 'shift_date', startTime: 'start_time', endTime: 'end_time',
      roleOnShift: 'role_on_shift', locationId: 'location_id', status: 'status', notes: 'notes'
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(data[k]); }
    }
    if (!sets.length) return {};
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await database.query(
      `UPDATE shift_schedules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0];
  }

  async checkIn(id: string): Promise<void> {
    await database.query(
      `UPDATE shift_schedules SET check_in_at = NOW(), status = 'active', updated_at = NOW() WHERE id = $1`, [id]
    );
  }

  async checkOut(id: string): Promise<void> {
    await database.query(
      `UPDATE shift_schedules SET check_out_at = NOW(), status = 'completed', updated_at = NOW() WHERE id = $1`, [id]
    );
  }

  async deleteShift(id: string): Promise<void> {
    await database.query(`DELETE FROM shift_schedules WHERE id = $1`, [id]);
  }

  /** Workforce dashboard */
  async getWorkforceDashboard(enterpriseId: string): Promise<any> {
    const taskStatus = await database.query(
      `SELECT status, COUNT(*) as count FROM workforce_tasks WHERE enterprise_id = $1 GROUP BY status`, [enterpriseId]
    );
    const taskPriority = await database.query(
      `SELECT priority, COUNT(*) as count FROM workforce_tasks WHERE enterprise_id = $1 AND status != 'completed' GROUP BY priority`, [enterpriseId]
    );
    const overdueTasks = await database.query(
      `SELECT wt.*, u.first_name || ' ' || u.last_name as assigned_to_name
       FROM workforce_tasks wt LEFT JOIN users u ON u.id = wt.assigned_to
       WHERE wt.enterprise_id = $1 AND wt.status NOT IN ('completed','cancelled') AND wt.due_date < NOW()
       ORDER BY wt.due_date ASC LIMIT 10`, [enterpriseId]
    );
    const topWorkers = await database.query(
      `SELECT wt.assigned_to, u.first_name || ' ' || u.last_name as name,
        COUNT(*) FILTER (WHERE wt.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE wt.status IN ('pending','in_progress')) as active,
        AVG(wt.actual_hours) as avg_hours
       FROM workforce_tasks wt JOIN users u ON u.id = wt.assigned_to
       WHERE wt.enterprise_id = $1 AND wt.assigned_to IS NOT NULL
       GROUP BY wt.assigned_to, u.first_name, u.last_name
       ORDER BY completed DESC LIMIT 10`, [enterpriseId]
    );
    const todayShifts = await database.query(
      `SELECT ss.*, u.first_name || ' ' || u.last_name as user_name
       FROM shift_schedules ss JOIN users u ON u.id = ss.user_id
       WHERE ss.enterprise_id = $1 AND ss.shift_date = CURRENT_DATE
       ORDER BY ss.start_time`, [enterpriseId]
    );

    return {
      taskStatusDistribution: taskStatus.rows,
      taskPriorityDistribution: taskPriority.rows,
      overdueTasks: overdueTasks.rows,
      topWorkers: topWorkers.rows,
      todayShifts: todayShifts.rows,
      summary: {
        totalTasks: taskStatus.rows.reduce((s: number, r: any) => s + +r.count, 0),
        pendingTasks: taskStatus.rows.find((r: any) => r.status === 'pending')?.count || 0,
        overdue: overdueTasks.rows.length,
        todayShiftCount: todayShifts.rows.length
      }
    };
  }
}

export default new WorkforceService();
