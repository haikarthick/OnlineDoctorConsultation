import database from '../utils/database';
import { AdminDashboardStats, AuditLog, SystemSetting, PaginatedResponse } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

class AdminService {
  async getDashboardStats(): Promise<AdminDashboardStats> {
    // Aggregate stats from all tables
    const usersResult = await database.query(`SELECT role, COUNT(*) as count FROM users WHERE is_active = $1 GROUP BY role`, [true]);
    const consultResult = await database.query(`SELECT status, COUNT(*) as count FROM consultations GROUP BY status`, []);
    const paymentsResult = await database.query(`SELECT status, SUM(amount) as total, COUNT(*) as count FROM payments GROUP BY status`, []);
    const reviewsResult = await database.query(`SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as "avgRating" FROM reviews`, []);
    const bookingsResult = await database.query(`SELECT COUNT(*) as count FROM bookings`, []);
    const videoResult = await database.query(`SELECT COUNT(*) as count FROM video_sessions WHERE status IN ('waiting', 'active')`, []);

    const userCounts: Record<string, number> = {};
    (usersResult.rows || []).forEach((r: any) => { userCounts[r.role] = parseInt(r.count || '0'); });

    const consultCounts: Record<string, number> = {};
    (consultResult.rows || []).forEach((r: any) => { consultCounts[r.status] = parseInt(r.count || '0'); });

    const paymentTotals: Record<string, { total: number; count: number }> = {};
    (paymentsResult.rows || []).forEach((r: any) => {
      paymentTotals[r.status] = { total: parseFloat(r.total || '0'), count: parseInt(r.count || '0') };
    });

    const totalUsers = Object.values(userCounts).reduce((a, b) => a + b, 0);
    const totalConsultations = Object.values(consultCounts).reduce((a, b) => a + b, 0);
    const totalPaymentsCount = Object.values(paymentTotals).reduce((a, b) => a + b.count, 0);
    const totalRevenue = Object.values(paymentTotals)
      .filter((_, i) => Object.keys(paymentTotals)[i] === 'completed')
      .reduce((a, b) => a + b.total, 0);

    return {
      totalUsers,
      totalPetOwners: userCounts['pet_owner'] || 0,
      totalVeterinarians: userCounts['veterinarian'] || 0,
      totalConsultations,
      activeConsultations: (consultCounts['in_progress'] || 0) + (consultCounts['scheduled'] || 0),
      completedConsultations: consultCounts['completed'] || 0,
      cancelledConsultations: consultCounts['cancelled'] || 0,
      totalRevenue,
      totalPayments: totalPaymentsCount,
      pendingPayments: paymentTotals['pending']?.count || 0,
      totalReviews: parseInt(reviewsResult.rows[0]?.count || '0'),
      activeUsers: totalUsers,
      totalVets: userCounts['veterinarian'] || 0,
      averageRating: parseFloat(reviewsResult.rows[0]?.avgRating || '0'),
      totalBookings: parseInt(bookingsResult.rows[0]?.count || '0'),
      todayBookings: 0,
      activeVideoSessions: parseInt(videoResult.rows[0]?.count || '0'),
      systemHealth: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0,
        activeConnections: 0
      }
    };
  }

  async listAllUsers(params: { limit?: number; offset?: number; role?: string; search?: string; isActive?: boolean }): Promise<PaginatedResponse<any>> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.role) {
      queryParams.push(params.role);
      conditions.push(`role = $${queryParams.length}`);
    }
    if (params.isActive !== undefined) {
      queryParams.push(params.isActive);
      conditions.push(`is_active = $${queryParams.length}`);
    }
    if (params.search) {
      queryParams.push(`%${params.search}%`);
      conditions.push(`(email ILIKE $${queryParams.length} OR first_name ILIKE $${queryParams.length} OR last_name ILIKE $${queryParams.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      [...queryParams]
    );
    const result = await database.query(
      `SELECT id, email, first_name as "firstName", last_name as "lastName", role, phone,
       is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit
    };
  }

  async toggleUserStatus(userId: string, isActive: boolean): Promise<any> {
    const result = await database.query(
      `UPDATE users SET is_active = $1, updated_at = $2 WHERE id = $3
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
       is_active as "isActive", updated_at as "updatedAt"`,
      [isActive, new Date(), userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User status toggled', { userId, isActive });
    return result.rows[0];
  }

  async changeUserRole(userId: string, newRole: string): Promise<any> {
    const result = await database.query(
      `UPDATE users SET role = $1, updated_at = $2 WHERE id = $3
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
       is_active as "isActive", updated_at as "updatedAt"`,
      [newRole, new Date(), userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User role changed', { userId, newRole });
    return result.rows[0];
  }

  async listAllConsultations(params: { limit?: number; offset?: number; status?: string }): Promise<PaginatedResponse<any>> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.status) {
      queryParams.push(params.status);
      conditions.push(`status = $${queryParams.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM consultations ${whereClause}`,
      [...queryParams]
    );
    const result = await database.query(
      `SELECT id, user_id as "userId", veterinarian_id as "veterinarianId",
       animal_type as "animalType", symptom_description as "symptomDescription",
       status, priority, scheduled_at as "scheduledAt", started_at as "startedAt",
       completed_at as "completedAt", diagnosis, prescription,
       created_at as "createdAt", updated_at as "updatedAt"
       FROM consultations ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit
    };
  }

  async listAllPayments(params: { limit?: number; offset?: number; status?: string }): Promise<PaginatedResponse<any>> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.status) {
      queryParams.push(params.status);
      conditions.push(`status = $${queryParams.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM payments ${whereClause}`,
      [...queryParams]
    );
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", payer_id as "payerId",
       payee_id as "payeeId", amount, currency, status, payment_method as "paymentMethod",
       transaction_id as "transactionId", invoice_number as "invoiceNumber",
       paid_at as "paidAt", created_at as "createdAt", updated_at as "updatedAt"
       FROM payments ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit
    };
  }

  async listAllReviews(params: { limit?: number; offset?: number; status?: string }): Promise<PaginatedResponse<any>> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.status) {
      queryParams.push(params.status);
      conditions.push(`status = $${queryParams.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
      `SELECT id, consultation_id as "consultationId", reviewer_id as "reviewerId",
       veterinarian_id as "veterinarianId", rating, comment,
       response_from_vet as "responseFromVet", is_public as "isPublic",
       status, helpful_count as "helpfulCount", report_count as "reportCount",
       created_at as "createdAt", updated_at as "updatedAt"
       FROM reviews ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const countResult = await database.query(
      `SELECT COUNT(*) as count FROM reviews ${whereClause}`,
      [...queryParams]
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit
    };
  }

  async moderateReview(reviewId: string, action: 'approve' | 'hide' | 'remove'): Promise<any> {
    const statusMap: Record<string, string> = { approve: 'active', hide: 'hidden', remove: 'removed' };
    const result = await database.query(
      `UPDATE reviews SET status = $1, updated_at = $2 WHERE id = $3
       RETURNING id, status, updated_at as "updatedAt"`,
      [statusMap[action], new Date(), reviewId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Review', reviewId);
    logger.info('Review moderated', { reviewId, action });
    return result.rows[0];
  }

  async processRefund(paymentId: string, amount: number, reason: string): Promise<any> {
    const result = await database.query(
      `UPDATE payments SET status = $1, refund_amount = $2, refund_reason = $3, updated_at = $4 WHERE id = $5
       RETURNING id, status, refund_amount as "refundAmount", refund_reason as "refundReason",
       updated_at as "updatedAt"`,
      ['refunded', amount, reason, new Date(), paymentId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Payment', paymentId);
    logger.info('Refund processed', { paymentId, amount, reason });
    return result.rows[0];
  }

  // System settings
  async getPublicSettings(): Promise<SystemSetting[]> {
    // Return display.* and consultation.* settings — safe for unauthenticated access
    const result = await database.query(
      `SELECT key, value, description FROM system_settings
       WHERE key LIKE 'display.%' OR key LIKE 'consultation.%' ORDER BY key`,
      []
    );
    return result.rows;
  }

  async getSystemSettings(): Promise<SystemSetting[]> {
    const result = await database.query(
      `SELECT id, key, value, category, description, updated_by as "updatedBy",
       updated_at as "updatedAt" FROM system_settings ORDER BY category, key`,
      []
    );
    return result.rows;
  }

  async updateSystemSetting(key: string, value: string, updatedBy: string): Promise<SystemSetting> {
    const now = new Date();
    // Try update first
    let result = await database.query(
      `UPDATE system_settings SET value = $1, updated_by = $2, updated_at = $3 WHERE key = $4
       RETURNING id, key, value, category, description, updated_by as "updatedBy", updated_at as "updatedAt"`,
      [value, updatedBy, now, key]
    );

    if (result.rows.length === 0) {
      // Insert if not exists
      const id = uuidv4();
      result = await database.query(
        `INSERT INTO system_settings (id, key, value, category, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, key, value, category, updated_by as "updatedBy", updated_at as "updatedAt"`,
        [id, key, value, 'general', updatedBy, now]
      );
    }

    logger.info('System setting updated', { key, updatedBy });
    return result.rows[0];
  }

  // Audit logs
  async getAuditLogs(params: { limit?: number; offset?: number; userId?: string; action?: string }): Promise<PaginatedResponse<AuditLog>> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.userId) {
      queryParams.push(params.userId);
      conditions.push(`user_id = $${queryParams.length}`);
    }
    if (params.action) {
      queryParams.push(params.action);
      conditions.push(`action = $${queryParams.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
      `SELECT id, user_id as "userId", user_email as "userEmail", action, resource,
       resource_id as "resourceId", details, ip_address as "ipAddress",
       user_agent as "userAgent", timestamp
       FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const countResult2 = await database.query(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      [...queryParams]
    );

    return {
      items: result.rows,
      total: parseInt(countResult2.rows[0]?.count || '0', 10),
      limit, offset,
      hasMore: result.rows.length === limit
    };
  }

  async createAuditLog(data: {
    userId: string; userEmail?: string; action: string; resource: string;
    resourceId?: string; details?: Record<string, any>; ipAddress?: string; userAgent?: string;
  }): Promise<AuditLog> {
    const id = uuidv4();
    const result = await database.query(
      `INSERT INTO audit_logs (id, user_id, user_email, action, resource, resource_id,
       details, ip_address, user_agent, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id as "userId", action, resource, timestamp`,
      [id, data.userId, data.userEmail || null, data.action, data.resource,
       data.resourceId || null, JSON.stringify(data.details || {}),
       data.ipAddress || null, data.userAgent || null, new Date()]
    );
    return result.rows[0];
  }
}

export default new AdminService();
