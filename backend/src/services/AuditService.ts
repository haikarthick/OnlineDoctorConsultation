import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { isFeatureEnabled } from '../config/featureFlags';
import logger from '../utils/logger';

export class AuditService {
  async log(
    userId: string | undefined,
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!isFeatureEnabled('auditLogging')) return;

    try {
      const id = uuidv4();
      await database.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          id,
          userId || null,
          action,
          entityType,
          entityId || null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          ipAddress || null,
          userAgent || null,
        ]
      );
    } catch (error) {
      // Audit logging should never break the main flow
      logger.error('Audit log failed', { error, action, entityType });
    }
  }

  async getAuditLogs(limit: number = 50, offset: number = 0, entityType?: string): Promise<any[]> {
    try {
      let query = `
        SELECT id, user_id as "userId", action, entity_type as "entityType",
               entity_id as "entityId", old_values as "oldValues", new_values as "newValues",
               ip_address as "ipAddress", created_at as "createdAt"
        FROM audit_logs
      `;
      const params: any[] = [];
      let idx = 0;

      if (entityType) {
        idx++;
        query += ` WHERE entity_type = $${idx}`;
        params.push(entityType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`;
      params.push(limit, offset);

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching audit logs', { error });
      return [];
    }
  }
}

export default new AuditService();
