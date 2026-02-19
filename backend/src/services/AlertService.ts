import database from '../utils/database';
import logger from '../utils/logger';

class AlertService {

  // ── Alert Rules ──
  async createRule(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO alert_rules (enterprise_id, name, description, alert_type, conditions, severity,
        is_enabled, check_interval_hours, notification_channels, target_roles, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.enterpriseId, data.name, data.description || null, data.alertType,
       JSON.stringify(data.conditions || {}), data.severity || 'info',
       data.isEnabled !== false, data.checkIntervalHours || 24,
       data.notificationChannels || ['in_app'], data.targetRoles || ['owner', 'manager'],
       data.createdBy]
    );
    return this.mapRule(result.rows[0]);
  }

  async updateRule(id: string, data: any): Promise<any> {
    const result = await database.query(
      `UPDATE alert_rules SET
        name = COALESCE($2, name), description = COALESCE($3, description),
        conditions = COALESCE($4, conditions), severity = COALESCE($5, severity),
        is_enabled = COALESCE($6, is_enabled), check_interval_hours = COALESCE($7, check_interval_hours),
        notification_channels = COALESCE($8, notification_channels),
        target_roles = COALESCE($9, target_roles), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.name, data.description,
       data.conditions ? JSON.stringify(data.conditions) : null,
       data.severity, data.isEnabled, data.checkIntervalHours,
       data.notificationChannels, data.targetRoles]
    );
    return this.mapRule(result.rows[0]);
  }

  async listRules(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT ar.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM alert_rules ar LEFT JOIN users u ON u.id = ar.created_by
       WHERE ar.enterprise_id = $1 ORDER BY ar.created_at DESC`,
      [enterpriseId]
    );
    return { items: result.rows.map((r: any) => this.mapRule(r)) };
  }

  async deleteRule(id: string): Promise<void> {
    await database.query(`DELETE FROM alert_rules WHERE id = $1`, [id]);
  }

  async toggleRule(id: string, isEnabled: boolean): Promise<void> {
    await database.query(`UPDATE alert_rules SET is_enabled = $2, updated_at = NOW() WHERE id = $1`, [id, isEnabled]);
  }

  // ── Alert Events ──
  async createEvent(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO alert_events (enterprise_id, rule_id, alert_type, severity, title, message, data,
        related_entity_type, related_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.enterpriseId, data.ruleId || null, data.alertType, data.severity || 'info',
       data.title, data.message, data.data ? JSON.stringify(data.data) : null,
       data.relatedEntityType || null, data.relatedEntityId || null]
    );

    // Update rule last triggered
    if (data.ruleId) {
      await database.query(`UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = $1`, [data.ruleId]);
    }

    return this.mapEvent(result.rows[0]);
  }

  async listEvents(enterpriseId: string, filters: any = {}): Promise<any> {
    const conditions = ['ae.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;
    if (filters.isRead !== undefined) { conditions.push(`ae.is_read = $${idx++}`); params.push(filters.isRead); }
    if (filters.severity) { conditions.push(`ae.severity = $${idx++}`); params.push(filters.severity); }
    if (filters.alertType) { conditions.push(`ae.alert_type = $${idx++}`); params.push(filters.alertType); }

    const result = await database.query(
      `SELECT ae.*, ar.name as rule_name FROM alert_events ae
       LEFT JOIN alert_rules ar ON ar.id = ae.rule_id
       WHERE ${conditions.join(' AND ')} ORDER BY ae.created_at DESC
       LIMIT ${filters.limit || 50} OFFSET ${filters.offset || 0}`, params
    );

    const unreadCount = await database.query(
      `SELECT COUNT(*) as count FROM alert_events WHERE enterprise_id = $1 AND is_read = false`, [enterpriseId]
    );

    return {
      items: result.rows.map((r: any) => this.mapEvent(r)),
      unreadCount: parseInt(unreadCount.rows[0].count),
    };
  }

  async markRead(id: string): Promise<void> {
    await database.query(`UPDATE alert_events SET is_read = true WHERE id = $1`, [id]);
  }

  async markAllRead(enterpriseId: string): Promise<void> {
    await database.query(`UPDATE alert_events SET is_read = true WHERE enterprise_id = $1 AND is_read = false`, [enterpriseId]);
  }

  async acknowledge(id: string, userId: string): Promise<void> {
    await database.query(
      `UPDATE alert_events SET is_acknowledged = true, acknowledged_by = $2, acknowledged_at = NOW() WHERE id = $1`,
      [id, userId]
    );
  }

  /** Run alert checks for an enterprise (called on schedule or manually) */
  async runAlertChecks(enterpriseId: string): Promise<number> {
    const rules = await database.query(
      `SELECT * FROM alert_rules WHERE enterprise_id = $1 AND is_enabled = true`, [enterpriseId]
    );
    let triggered = 0;

    for (const rule of rules.rows) {
      try {
        const alerts = await this.evaluateRule(enterpriseId, rule);
        for (const alert of alerts) {
          await this.createEvent({
            enterpriseId, ruleId: rule.id, alertType: rule.alert_type,
            severity: rule.severity, ...alert,
          });
          triggered++;
        }
      } catch (err) {
        logger.error(`Alert rule evaluation failed for ${rule.id}:`, err);
      }
    }
    return triggered;
  }

  /** Evaluate a single rule and return alerts to create */
  private async evaluateRule(enterpriseId: string, rule: any): Promise<any[]> {
    const alerts: any[] = [];
    const conditions = rule.conditions || {};

    switch (rule.alert_type) {
      case 'vaccination_due': {
        // Check for campaigns due soon
        const campaigns = await database.query(
          `SELECT * FROM treatment_campaigns WHERE enterprise_id = $1 AND status = 'planned'
           AND scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${conditions.daysBefore || 7}`,
          [enterpriseId]
        );
        for (const c of campaigns.rows) {
          alerts.push({
            title: `Vaccination Due: ${c.name}`,
            message: `Campaign "${c.name}" is scheduled for ${c.scheduled_date}`,
            relatedEntityType: 'treatment_campaign', relatedEntityId: c.id,
          });
        }
        break;
      }
      case 'breeding_due': {
        const due = await database.query(
          `SELECT br.*, d.name as dam_name FROM breeding_records br LEFT JOIN animals d ON d.id = br.dam_id
           WHERE br.enterprise_id = $1 AND br.status IN ('bred', 'confirmed')
           AND br.expected_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${conditions.daysBefore || 14}`,
          [enterpriseId]
        );
        for (const b of due.rows) {
          alerts.push({
            title: `Birth Expected: ${b.dam_name || 'Unknown'}`,
            message: `Expected due date: ${b.expected_due_date}`,
            relatedEntityType: 'breeding_record', relatedEntityId: b.id,
          });
        }
        break;
      }
      case 'low_feed_stock': {
        const low = await database.query(
          `SELECT * FROM feed_inventory WHERE enterprise_id = $1 AND is_active = true AND current_stock <= minimum_stock`,
          [enterpriseId]
        );
        for (const f of low.rows) {
          alerts.push({
            title: `Low Feed Stock: ${f.feed_name}`,
            message: `Current stock: ${f.current_stock} ${f.unit} (minimum: ${f.minimum_stock})`,
            relatedEntityType: 'feed_inventory', relatedEntityId: f.id,
          });
        }
        break;
      }
      case 'document_expiry': {
        const expiring = await database.query(
          `SELECT * FROM compliance_documents WHERE enterprise_id = $1 AND is_active = true
           AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${conditions.daysBefore || 30}`,
          [enterpriseId]
        );
        for (const d of expiring.rows) {
          alerts.push({
            title: `Document Expiring: ${d.title}`,
            message: `Expires on ${d.expiry_date}`,
            relatedEntityType: 'compliance_document', relatedEntityId: d.id,
          });
        }
        break;
      }
      case 'health_threshold': {
        const threshold = conditions.healthScoreBelow || 40;
        const unhealthy = await database.query(
          `SELECT * FROM animals WHERE enterprise_id = $1 AND is_active = true AND health_score < $2`,
          [enterpriseId, threshold]
        );
        if (unhealthy.rowCount && unhealthy.rowCount > 0) {
          alerts.push({
            title: `${unhealthy.rowCount} Animals Below Health Threshold`,
            message: `${unhealthy.rowCount} animals have health score below ${threshold}`,
            data: { count: unhealthy.rowCount },
          });
        }
        break;
      }
    }

    return alerts;
  }

  private mapRule(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, name: row.name,
      description: row.description, alertType: row.alert_type,
      conditions: row.conditions, severity: row.severity,
      isEnabled: row.is_enabled, checkIntervalHours: row.check_interval_hours,
      notificationChannels: row.notification_channels, targetRoles: row.target_roles,
      lastTriggeredAt: row.last_triggered_at, createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  private mapEvent(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, ruleId: row.rule_id,
      alertType: row.alert_type, severity: row.severity,
      title: row.title, message: row.message, data: row.data,
      isRead: row.is_read, isAcknowledged: row.is_acknowledged,
      acknowledgedBy: row.acknowledged_by, acknowledgedAt: row.acknowledged_at,
      relatedEntityType: row.related_entity_type, relatedEntityId: row.related_entity_id,
      createdAt: row.created_at, ruleName: row.rule_name,
    };
  }
}

export default new AlertService();
