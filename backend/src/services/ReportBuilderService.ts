import database from '../utils/database';
import logger from '../utils/logger';

class ReportBuilderService {

  // ─── Report Templates ─────────────────────────────────────

  async listTemplates(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT * FROM report_templates WHERE enterprise_id = $1 OR is_system = true
       ORDER BY is_system DESC, name ASC`, [enterpriseId]
    );
    return { items: result.rows };
  }

  async createTemplate(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO report_templates (enterprise_id, name, description, report_type,
        config, columns, filters, grouping, is_system, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [data.enterpriseId || null, data.name, data.description || null,
       data.reportType, JSON.stringify(data.config || {}),
       JSON.stringify(data.columns || []), JSON.stringify(data.filters || {}),
       JSON.stringify(data.grouping || []), data.isSystem || false, data.createdBy]
    );
    return result.rows[0];
  }

  async updateTemplate(id: string, data: any): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      name: 'name', description: 'description', reportType: 'report_type'
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(data[k]); }
    }
    if (data.config) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(data.config)); }
    if (data.columns) { sets.push(`columns = $${idx++}`); params.push(JSON.stringify(data.columns)); }
    if (data.filters) { sets.push(`filters = $${idx++}`); params.push(JSON.stringify(data.filters)); }
    if (data.grouping) { sets.push(`grouping = $${idx++}`); params.push(JSON.stringify(data.grouping)); }
    if (!sets.length) return {};
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await database.query(
      `UPDATE report_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0];
  }

  async deleteTemplate(id: string): Promise<void> {
    await database.query(`DELETE FROM report_templates WHERE id = $1`, [id]);
  }

  // ─── Generated Reports ────────────────────────────────────

  async generateReport(data: any): Promise<any> {
    // Build dynamic query based on report type
    let resultData: any = {};
    let rowCount = 0;

    try {
      switch (data.reportType) {
        case 'animal_census':
          resultData = await this.runAnimalCensusReport(data.enterpriseId, data.parameters || {});
          break;
        case 'health_summary':
          resultData = await this.runHealthSummaryReport(data.enterpriseId, data.parameters || {});
          break;
        case 'financial_summary':
          resultData = await this.runFinancialSummaryReport(data.enterpriseId, data.parameters || {});
          break;
        case 'breeding_report':
          resultData = await this.runBreedingReport(data.enterpriseId, data.parameters || {});
          break;
        case 'compliance_audit':
          resultData = await this.runComplianceAuditReport(data.enterpriseId, data.parameters || {});
          break;
        case 'task_performance':
          resultData = await this.runTaskPerformanceReport(data.enterpriseId, data.parameters || {});
          break;
        case 'sensor_analytics':
          resultData = await this.runSensorAnalyticsReport(data.enterpriseId, data.parameters || {});
          break;
        default:
          resultData = { message: 'Custom report executed', parameters: data.parameters };
      }
      rowCount = resultData.rows?.length || resultData.totalRows || 0;
    } catch (err: any) {
      logger.error('Report generation error:', err);
      resultData = { error: err.message };
    }

    const result = await database.query(
      `INSERT INTO generated_reports (enterprise_id, template_id, name, report_type, format,
        parameters, result_data, row_count, status, generated_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + INTERVAL '30 days') RETURNING *`,
      [data.enterpriseId, data.templateId || null, data.name, data.reportType,
       data.format || 'json', JSON.stringify(data.parameters || {}),
       JSON.stringify(resultData), rowCount, 'completed', data.generatedBy]
    );
    return result.rows[0];
  }

  async listGeneratedReports(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['gr.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.reportType) { conds.push(`gr.report_type = $${idx++}`); params.push(filters.reportType); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 30, 1), 200));
    const result = await database.query(
      `SELECT gr.*, u.first_name || ' ' || u.last_name as generated_by_name
       FROM generated_reports gr
       LEFT JOIN users u ON u.id = gr.generated_by
       WHERE ${conds.join(' AND ')}
       ORDER BY gr.generated_at DESC
       LIMIT $${idx++}`, params
    );
    return { items: result.rows };
  }

  async getReport(id: string): Promise<any> {
    const result = await database.query(
      `SELECT gr.*, u.first_name || ' ' || u.last_name as generated_by_name
       FROM generated_reports gr LEFT JOIN users u ON u.id = gr.generated_by
       WHERE gr.id = $1`, [id]
    );
    return result.rows[0];
  }

  async deleteReport(id: string): Promise<void> {
    await database.query(`DELETE FROM generated_reports WHERE id = $1`, [id]);
  }

  // ─── Built-in Report Runners ──────────────────────────────

  private async runAnimalCensusReport(enterpriseId: string, params: any): Promise<any> {
    const result = await database.query(
      `SELECT a.species, a.breed, a.gender,
        COUNT(*) as total, AVG(a.current_weight) as avg_weight,
        COUNT(*) FILTER (WHERE a.status = 'active') as active_count,
        MIN(a.date_of_birth) as oldest_dob, MAX(a.date_of_birth) as youngest_dob
       FROM animals a WHERE a.enterprise_id = $1
       GROUP BY a.species, a.breed, a.gender ORDER BY a.species, a.breed`, [enterpriseId]
    );
    return { rows: result.rows, totalRows: result.rowCount, reportDate: new Date().toISOString() };
  }

  private async runHealthSummaryReport(enterpriseId: string, params: any): Promise<any> {
    const days = params.days || 90;
    const result = await database.query(
      `SELECT ho.observation_type, ho.severity, COUNT(*) as count,
        COUNT(*) FILTER (WHERE ho.is_resolved = true) as resolved,
        COUNT(*) FILTER (WHERE ho.is_resolved = false) as unresolved,
        AVG(EXTRACT(EPOCH FROM (ho.resolved_at - ho.created_at))/3600) as avg_resolution_hours
       FROM health_observations ho
       WHERE ho.enterprise_id = $1 AND ho.created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY ho.observation_type, ho.severity ORDER BY count DESC`, [enterpriseId, days]
    );
    return { rows: result.rows, totalRows: result.rowCount, period: `${days} days` };
  }

  private async runFinancialSummaryReport(enterpriseId: string, params: any): Promise<any> {
    const months = params.months || 12;
    const result = await database.query(
      `SELECT date_trunc('month', record_date) as month, category,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net
       FROM financial_records WHERE enterprise_id = $1 AND record_date > NOW() - INTERVAL '1 month' * $2
       GROUP BY month, category ORDER BY month DESC, category`, [enterpriseId, months]
    );
    return { rows: result.rows, totalRows: result.rowCount, period: `${months} months` };
  }

  private async runBreedingReport(enterpriseId: string, params: any): Promise<any> {
    const result = await database.query(
      `SELECT br.breeding_method, br.status,
        COUNT(*) as total, COUNT(*) FILTER (WHERE br.status = 'confirmed_pregnant') as pregnant,
        COUNT(*) FILTER (WHERE br.status = 'delivered') as delivered,
        AVG(br.offspring_count) FILTER (WHERE br.offspring_count > 0) as avg_offspring
       FROM breeding_records br WHERE br.enterprise_id = $1
       GROUP BY br.breeding_method, br.status ORDER BY total DESC`, [enterpriseId]
    );
    return { rows: result.rows, totalRows: result.rowCount };
  }

  private async runComplianceAuditReport(enterpriseId: string, params: any): Promise<any> {
    const result = await database.query(
      `SELECT cd.doc_type, cd.status,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE cd.status = 'verified') as verified,
        COUNT(*) FILTER (WHERE cd.expiry_date < NOW()) as expired,
        COUNT(*) FILTER (WHERE cd.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_soon
       FROM compliance_documents cd WHERE cd.enterprise_id = $1
       GROUP BY cd.doc_type, cd.status ORDER BY total DESC`, [enterpriseId]
    );
    return { rows: result.rows, totalRows: result.rowCount };
  }

  private async runTaskPerformanceReport(enterpriseId: string, params: any): Promise<any> {
    const result = await database.query(
      `SELECT u.first_name || ' ' || u.last_name as worker_name,
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE wt.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE wt.status = 'pending') as pending,
        AVG(wt.actual_hours) as avg_hours,
        COUNT(*) FILTER (WHERE wt.due_date < NOW() AND wt.status NOT IN ('completed','cancelled')) as overdue
       FROM workforce_tasks wt JOIN users u ON u.id = wt.assigned_to
       WHERE wt.enterprise_id = $1 AND wt.assigned_to IS NOT NULL
       GROUP BY u.first_name, u.last_name ORDER BY completed DESC`, [enterpriseId]
    );
    return { rows: result.rows, totalRows: result.rowCount };
  }

  private async runSensorAnalyticsReport(enterpriseId: string, params: any): Promise<any> {
    const result = await database.query(
      `SELECT s.sensor_type, s.sensor_name,
        COUNT(sr.id) as total_readings,
        AVG(sr.value) as avg_value, MIN(sr.value) as min_value, MAX(sr.value) as max_value,
        COUNT(*) FILTER (WHERE sr.is_anomaly = true) as anomaly_count,
        s.unit
       FROM iot_sensors s LEFT JOIN sensor_readings sr ON sr.sensor_id = s.id
       WHERE s.enterprise_id = $1
       GROUP BY s.id, s.sensor_type, s.sensor_name, s.unit
       ORDER BY s.sensor_type, s.sensor_name`, [enterpriseId]
    );
    return { rows: result.rows, totalRows: result.rowCount };
  }
}

export default new ReportBuilderService();
