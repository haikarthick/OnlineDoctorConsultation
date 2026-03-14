import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { isFeatureEnabled } from '../config/featureFlags';
import logger from '../utils/logger';

// HIPAA-grade audit event categories
export const HIPAA_CATEGORIES = {
  PHI_ACCESS: 'phi_access',          // Protected Health Info viewed
  PHI_MODIFY: 'phi_modify',          // Protected Health Info changed
  PHI_CREATE: 'phi_create',          // Protected Health Info created
  PHI_DELETE: 'phi_delete',          // Protected Health Info deleted/archived
  PHI_EXPORT: 'phi_export',          // Protected Health Info exported/downloaded
  AUTH_LOGIN: 'auth_login',          // User login
  AUTH_LOGOUT: 'auth_logout',        // User logout
  AUTH_FAILED: 'auth_failed',        // Failed login attempt
  AUTH_PASSWORD: 'auth_password',    // Password change
  CONSENT_GRANT: 'consent_grant',    // Consent given
  CONSENT_REVOKE: 'consent_revoke',  // Consent revoked
  ADMIN_ACTION: 'admin_action',      // Admin-level change
  DATA_BREACH: 'data_breach',        // Potential breach event
  ACCESS_DENIED: 'access_denied',    // Access denied event
  SYSTEM: 'system',                  // System event
} as const;

// Entities containing Protected Health Information (PHI)
const PHI_ENTITIES = [
  'medical_record', 'prescription', 'consultation', 'vaccination',
  'lab_result', 'allergy', 'diagnosis', 'treatment', 'scan_analysis',
];

export class AuditService {
  // Determine HIPAA category automatically based on action + entity
  private categorize(action: string, entityType: string): string {
    if (action.includes('login')) return HIPAA_CATEGORIES.AUTH_LOGIN;
    if (action.includes('logout')) return HIPAA_CATEGORIES.AUTH_LOGOUT;
    if (action.includes('failed')) return HIPAA_CATEGORIES.AUTH_FAILED;
    if (action.includes('password')) return HIPAA_CATEGORIES.AUTH_PASSWORD;
    if (action.includes('consent')) return action.includes('revoke') ? HIPAA_CATEGORIES.CONSENT_REVOKE : HIPAA_CATEGORIES.CONSENT_GRANT;
    if (action.includes('export') || action.includes('download')) return HIPAA_CATEGORIES.PHI_EXPORT;

    const isPHI = PHI_ENTITIES.some(e => entityType.includes(e));
    if (isPHI) {
      if (action.includes('delete') || action.includes('archive')) return HIPAA_CATEGORIES.PHI_DELETE;
      if (action.includes('create') || action.includes('add')) return HIPAA_CATEGORIES.PHI_CREATE;
      if (action.includes('update') || action.includes('edit') || action.includes('modify')) return HIPAA_CATEGORIES.PHI_MODIFY;
      return HIPAA_CATEGORIES.PHI_ACCESS;
    }

    if (action.startsWith('admin')) return HIPAA_CATEGORIES.ADMIN_ACTION;
    return HIPAA_CATEGORIES.SYSTEM;
  }

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
      const hipaaCategory = this.categorize(action, entityType);
      const severity = [HIPAA_CATEGORIES.DATA_BREACH, HIPAA_CATEGORIES.PHI_DELETE, HIPAA_CATEGORIES.PHI_EXPORT]
        .includes(hipaaCategory as any) ? 'high'
        : [HIPAA_CATEGORIES.PHI_MODIFY, HIPAA_CATEGORIES.AUTH_FAILED, HIPAA_CATEGORIES.ACCESS_DENIED]
        .includes(hipaaCategory as any) ? 'medium' : 'low';

      await database.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
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
          JSON.stringify({ hipaaCategory, severity }),
        ]
      );
    } catch (error) {
      logger.error('Audit log failed', { error, action, entityType });
    }
  }

  async getAuditLogs(limit: number = 50, offset: number = 0, entityType?: string): Promise<any[]> {
    try {
      let query = `
        SELECT al.id, al.user_id as "userId", al.action, al.entity_type as "entityType",
               al.entity_id as "entityId", al.old_values as "oldValues", al.new_values as "newValues",
               al.ip_address as "ipAddress", al.user_agent as "userAgent", al.details,
               al.created_at as "createdAt",
               u.first_name || ' ' || u.last_name as "userName", u.email as "userEmail", u.role as "userRole"
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
      `;
      const params: any[] = [];
      let idx = 0;

      if (entityType) {
        idx++;
        query += ` WHERE al.entity_type = $${idx}`;
        params.push(entityType);
      }

      query += ` ORDER BY al.created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`;
      params.push(limit, offset);

      const result = await database.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching audit logs', { error });
      return [];
    }
  }

  /** HIPAA Compliance Dashboard — aggregate stats */
  async getComplianceDashboard(): Promise<any> {
    try {
      // Total audit events (last 30 days)
      const totalEvents = await database.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE created_at > NOW() - INTERVAL '30 days'`
      );

      // PHI access events (last 30 days)
      const phiEvents = await database.query(
        `SELECT COUNT(*) as count FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '30 days'
         AND details->>'hipaaCategory' IN ('phi_access','phi_modify','phi_create','phi_delete','phi_export')`
      );

      // Failed login attempts (last 30 days)
      const failedLogins = await database.query(
        `SELECT COUNT(*) as count FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '30 days'
         AND details->>'hipaaCategory' = 'auth_failed'`
      );

      // Events by category (last 30 days)
      const byCategory = await database.query(
        `SELECT details->>'hipaaCategory' as category, COUNT(*) as count
         FROM audit_logs WHERE created_at > NOW() - INTERVAL '30 days'
         AND details->>'hipaaCategory' IS NOT NULL
         GROUP BY details->>'hipaaCategory' ORDER BY count DESC`
      );

      // Events by severity (last 30 days)
      const bySeverity = await database.query(
        `SELECT details->>'severity' as severity, COUNT(*) as count
         FROM audit_logs WHERE created_at > NOW() - INTERVAL '30 days'
         AND details->>'severity' IS NOT NULL
         GROUP BY details->>'severity'`
      );

      // Recent high-severity events
      const highSeverity = await database.query(
        `SELECT al.id, al.user_id as "userId", al.action, al.entity_type as "entityType",
                al.ip_address as "ipAddress", al.details, al.created_at as "createdAt",
                u.first_name || ' ' || u.last_name as "userName", u.email as "userEmail"
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         WHERE al.details->>'severity' IN ('high','medium')
         AND al.created_at > NOW() - INTERVAL '7 days'
         ORDER BY al.created_at DESC LIMIT 20`
      );

      // Daily event counts (last 14 days)
      const dailyTrend = await database.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM audit_logs WHERE created_at > NOW() - INTERVAL '14 days'
         GROUP BY DATE(created_at) ORDER BY date`
      );

      // Active sessions count
      const activeSessions = await database.query(
        `SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW()`
      );

      // User count
      const userCount = await database.query(
        `SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role`
      );

      // Data privacy: confidential records count
      const confidentialRecords = await database.query(
        `SELECT COUNT(*) as count FROM medical_records WHERE is_confidential = true`
      );

      return {
        totalAuditEvents: parseInt(totalEvents.rows[0]?.count || '0'),
        phiAccessEvents: parseInt(phiEvents.rows[0]?.count || '0'),
        failedLoginAttempts: parseInt(failedLogins.rows[0]?.count || '0'),
        activeSessions: parseInt(activeSessions.rows[0]?.count || '0'),
        confidentialRecords: parseInt(confidentialRecords.rows[0]?.count || '0'),
        eventsByCategory: byCategory.rows,
        eventsBySeverity: bySeverity.rows,
        highSeverityEvents: highSeverity.rows,
        dailyTrend: dailyTrend.rows,
        usersByRole: userCount.rows,
      };
    } catch (error) {
      logger.error('Error generating compliance dashboard', { error });
      return {};
    }
  }

  /** Get PHI access log — who accessed medical data */
  async getPhiAccessLog(limit: number = 50, offset: number = 0, filters: any = {}): Promise<any> {
    try {
      const conditions = [
        `al.details->>'hipaaCategory' IN ('phi_access','phi_modify','phi_create','phi_delete','phi_export')`
      ];
      const params: any[] = [];
      let idx = 0;

      if (filters.userId) {
        idx++;
        conditions.push(`al.user_id = $${idx}`);
        params.push(filters.userId);
      }
      if (filters.entityType) {
        idx++;
        conditions.push(`al.entity_type = $${idx}`);
        params.push(filters.entityType);
      }
      if (filters.startDate) {
        idx++;
        conditions.push(`al.created_at >= $${idx}`);
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        idx++;
        conditions.push(`al.created_at <= $${idx}`);
        params.push(filters.endDate);
      }

      params.push(limit, offset);
      const result = await database.query(
        `SELECT al.id, al.user_id as "userId", al.action, al.entity_type as "entityType",
                al.entity_id as "entityId", al.ip_address as "ipAddress",
                al.user_agent as "userAgent", al.details, al.created_at as "createdAt",
                u.first_name || ' ' || u.last_name as "userName", u.email as "userEmail", u.role as "userRole"
         FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY al.created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`, params
      );

      const countResult = await database.query(
        `SELECT COUNT(*) as count FROM audit_logs al WHERE ${conditions.join(' AND ')}`,
        params.slice(0, idx)
      );

      return { items: result.rows, total: parseInt(countResult.rows[0]?.count || '0') };
    } catch (error) {
      logger.error('Error fetching PHI access log', { error });
      return { items: [], total: 0 };
    }
  }

  /** Get data privacy summary for a specific user (their data footprint) */
  async getUserDataSummary(userId: string): Promise<any> {
    try {
      const medicalRecords = await database.query(
        `SELECT COUNT(*) as count FROM medical_records WHERE user_id = $1`, [userId]
      );
      const consultations = await database.query(
        `SELECT COUNT(*) as count FROM consultations WHERE user_id = $1`, [userId]
      );
      const prescriptions = await database.query(
        `SELECT COUNT(*) as count FROM prescriptions WHERE pet_owner_id = $1`, [userId]
      );
      const animals = await database.query(
        `SELECT COUNT(*) as count FROM animals WHERE owner_id = $1`, [userId]
      );
      const auditTrail = await database.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE user_id = $1`, [userId]
      );
      const sessions = await database.query(
        `SELECT COUNT(*) as count FROM sessions WHERE user_id = $1`, [userId]
      );
      const lastLogin = await database.query(
        `SELECT created_at FROM audit_logs WHERE user_id = $1 AND action LIKE '%login%'
         ORDER BY created_at DESC LIMIT 1`, [userId]
      );

      return {
        medicalRecords: parseInt(medicalRecords.rows[0]?.count || '0'),
        consultations: parseInt(consultations.rows[0]?.count || '0'),
        prescriptions: parseInt(prescriptions.rows[0]?.count || '0'),
        animals: parseInt(animals.rows[0]?.count || '0'),
        auditEntries: parseInt(auditTrail.rows[0]?.count || '0'),
        activeSessions: parseInt(sessions.rows[0]?.count || '0'),
        lastLogin: lastLogin.rows[0]?.created_at || null,
      };
    } catch (error) {
      logger.error('Error generating user data summary', { error, userId });
      return {};
    }
  }

  /** Revoke all sessions for a user (force logout) */
  async revokeUserSessions(userId: string): Promise<void> {
    await database.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  }
}

export default new AuditService();
