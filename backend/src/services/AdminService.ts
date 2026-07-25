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
    // payment_source = 'consultation' excludes network-hospital pharmacy dispensing revenue
    // (that's the hospital's own revenue, not platform marketplace revenue)
    const paymentsResult = await database.query(`SELECT status, SUM(amount) as total, COUNT(*) as count FROM payments WHERE payment_source = 'consultation' GROUP BY status`, []);
    const reviewsResult = await database.query(`SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as "avgRating" FROM reviews`, []);
    const bookingsResult = await database.query(`SELECT COUNT(*) as count FROM bookings`, []);
    const videoResult = await database.query(`SELECT COUNT(*) as count FROM video_sessions WHERE status IN ('waiting', 'active')`, []);
    const pendingNetworksResult = await database.query(
      `SELECT COUNT(*) as count FROM hospital_networks WHERE is_approved = false`,
      []
    );
    const pendingNetworkApprovals = parseInt(pendingNetworksResult.rows[0]?.count || '0');
    const pendingUsersResult = await database.query(
      `SELECT COUNT(*) as count FROM users WHERE account_status = 'pending_approval'`
    );
    const pendingUserApprovals = parseInt(pendingUsersResult.rows[0]?.count || '0');

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
      pendingNetworkApprovals,
      pendingUserApprovals,
      pendingActions: pendingNetworkApprovals + pendingUserApprovals,
      systemHealth: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0,
        activeConnections: 0
      }
    };
  }

  private userReturnCols = `
    id, email, first_name as "firstName", last_name as "lastName", role, phone,
    is_active as "isActive", account_status as "accountStatus",
    freeze_reason as "freezeReason", frozen_at as "frozenAt",
    created_at as "createdAt", updated_at as "updatedAt"`;

  async listAllUsers(params: { limit?: number; offset?: number; role?: string; search?: string; isActive?: boolean; accountStatus?: string }): Promise<PaginatedResponse<any>> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (params.role) {
      queryParams.push(params.role);
      conditions.push(`role = $${queryParams.length}`);
    }
    if (params.accountStatus) {
      queryParams.push(params.accountStatus);
      conditions.push(`account_status = $${queryParams.length}`);
    } else if (params.isActive !== undefined) {
      queryParams.push(params.isActive);
      conditions.push(`is_active = $${queryParams.length}`);
    }
    if (params.search) {
      queryParams.push(`%${params.search}%`);
      conditions.push(`(email ILIKE $${queryParams.length} OR first_name ILIKE $${queryParams.length} OR last_name ILIKE $${queryParams.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database.query(`SELECT COUNT(*) as count FROM users ${whereClause}`, [...queryParams]);
    const result = await database.query(
      `SELECT ${this.userReturnCols} FROM users ${whereClause}
       ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );
    return { items: result.rows, total: parseInt(countResult.rows[0]?.count || '0', 10), limit, offset, hasMore: result.rows.length === limit };
  }

  async listPendingUsers(): Promise<any[]> {
    const result = await database.query(
      `SELECT u.id, u.email,
              u.first_name as "firstName", u.last_name as "lastName",
              u.role, u.phone,
              u.is_active as "isActive", u.account_status as "accountStatus",
              u.freeze_reason as "freezeReason", u.frozen_at as "frozenAt",
              u.created_at as "createdAt", u.updated_at as "updatedAt",
              vp.license_number as "licenseNumber",
              vp.years_of_experience as "yearsOfExperience",
              vp.specializations, vp.qualifications, vp.clinic_name as "clinicName"
       FROM users u
       LEFT JOIN vet_profiles vp ON vp.user_id = u.id
       WHERE u.account_status = 'pending_approval'
       ORDER BY u.created_at ASC`
    );
    return result.rows;
  }

  async approveUser(userId: string, adminId: string): Promise<any> {
    const result = await database.query(
      `UPDATE users SET account_status = 'active', is_active = true, updated_at = NOW()
       WHERE id = $1 AND account_status = 'pending_approval'
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
                 account_status as "accountStatus"`,
      [userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    // Mark vet as verified on approval
    await database.query(
      `UPDATE vet_profiles SET is_verified = true, is_available = true, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    ).catch(() => {});
    logger.info('User approved', { userId, adminId });
    return result.rows[0];
  }

  async rejectUser(userId: string, adminId: string, reason: string): Promise<any> {
    if (!reason?.trim()) throw new Error('Rejection reason is required');
    const result = await database.query(
      `UPDATE users SET account_status = 'suspended', is_active = false,
              freeze_reason = $2, frozen_by = $3, frozen_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND account_status = 'pending_approval'
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
                 account_status as "accountStatus"`,
      [userId, reason.trim(), adminId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User registration rejected', { userId, adminId, reason });
    return result.rows[0];
  }

  async freezeUser(userId: string, adminId: string, reason: string): Promise<any> {
    if (!reason?.trim()) throw new Error('Freeze reason is required');
    const result = await database.query(
      `UPDATE users SET account_status = 'frozen', is_active = false,
              freeze_reason = $2, frozen_by = $3, frozen_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND account_status IN ('active', 'pending_approval')
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
                 account_status as "accountStatus", freeze_reason as "freezeReason"`,
      [userId, reason.trim(), adminId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User account frozen', { userId, adminId, reason });
    return result.rows[0];
  }

  async unfreezeUser(userId: string, adminId: string): Promise<any> {
    const result = await database.query(
      `UPDATE users SET account_status = 'active', is_active = true,
              freeze_reason = NULL, frozen_by = NULL, frozen_at = NULL, updated_at = NOW()
       WHERE id = $1 AND account_status = 'frozen'
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
                 account_status as "accountStatus"`,
      [userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User account unfrozen', { userId, adminId });
    return result.rows[0];
  }

  async suspendUser(userId: string, adminId: string, reason?: string): Promise<any> {
    const result = await database.query(
      `UPDATE users SET account_status = 'suspended', is_active = false,
              freeze_reason = $2, frozen_by = $3, frozen_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
                 account_status as "accountStatus"`,
      [userId, reason?.trim() || null, adminId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User suspended', { userId, adminId });
    return result.rows[0];
  }

  async reactivateUser(userId: string, adminId: string): Promise<any> {
    const result = await database.query(
      `UPDATE users SET account_status = 'active', is_active = true,
              freeze_reason = NULL, frozen_by = NULL, frozen_at = NULL, updated_at = NOW()
       WHERE id = $1 AND account_status = 'suspended'
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
                 account_status as "accountStatus"`,
      [userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User reactivated', { userId, adminId });
    return result.rows[0];
  }

  async toggleUserStatus(userId: string, isActive: boolean): Promise<any> {
    const newStatus = isActive ? 'active' : 'suspended';
    const result = await database.query(
      `UPDATE users SET is_active = $1, account_status = $2, updated_at = NOW() WHERE id = $3
       RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
       is_active as "isActive", account_status as "accountStatus", updated_at as "updatedAt"`,
      [isActive, newStatus, userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User', userId);
    logger.info('User status toggled', { userId, isActive, newStatus });
    return result.rows[0];
  }

  async changeUserRole(
    userId: string,
    newRole: string,
    profile?: { licenseNumber?: string; specializations?: string[]; qualifications?: string[]; yearsOfExperience?: number; consultationFee?: number; clinicName?: string }
  ): Promise<any> {
    // Provision the vet_profiles satellite row in the same transaction as the role flip, so a
    // user assigned the veterinarian role is always visible/bookable in Find Doctor (INNER JOIN
    // vet_profiles). ON CONFLICT DO NOTHING never clobbers an existing (possibly verified) profile.
    // is_verified=true only when the admin supplied a license (that entry IS the verification).
    return database.transaction(async (client: any) => {
      const result = await client.query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, email, first_name as "firstName", last_name as "lastName", role,
         is_active as "isActive", account_status as "accountStatus", updated_at as "updatedAt"`,
        [newRole, userId]
      );
      if (result.rows.length === 0) throw new NotFoundError('User', userId);

      if (newRole === 'veterinarian') {
        const p = profile || {};
        const license = (p.licenseNumber || '').toString().trim();
        await client.query(
          `INSERT INTO vet_profiles
             (user_id, license_number, specializations, qualifications, years_of_experience,
              clinic_name, consultation_fee, is_verified, is_available)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
           ON CONFLICT (user_id) DO NOTHING`,
          [
            userId,
            license,
            Array.isArray(p.specializations) ? p.specializations : [],
            Array.isArray(p.qualifications) ? p.qualifications : [],
            Number(p.yearsOfExperience) || 0,
            (p.clinicName || '').toString().trim(),
            Number(p.consultationFee) || 0,
            license !== '',
          ]
        );
      }

      logger.info('User role changed', { userId, newRole, vetProfileEnsured: newRole === 'veterinarian' });
      return result.rows[0];
    });
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
    // Marketplace consultation payments only -- excludes network-hospital pharmacy
    // dispensing revenue, which is the hospital's own, not the platform's.
    const conditions: string[] = [`payment_source = 'consultation'`];
    const queryParams: any[] = [];

    if (params.status) {
      queryParams.push(params.status);
      conditions.push(`status = $${queryParams.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
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

  async moderateReview(reviewId: string, action: 'approve' | 'hide' | 'remove' | 'flag' | 'unflag'): Promise<any> {
    const statusMap: Record<string, string> = { approve: 'active', hide: 'hidden', remove: 'removed', flag: 'flagged', unflag: 'active' };
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
    // Return display.*, consultation.*, booking.*, cancellation.*, payment.*, prescription.*, cert.*, maintenance.* settings — safe for all authenticated users
    const result = await database.query(
      `SELECT key, value, description FROM system_settings
       WHERE key LIKE 'display.%' OR key LIKE 'consultation.%' OR key LIKE 'booking.%' OR key LIKE 'cancellation.%' OR key LIKE 'payment.%' OR key LIKE 'prescription.%' OR key LIKE 'cert.%' OR key LIKE 'maintenance.%' ORDER BY key`,
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
      conditions.push(`al.user_id = $${queryParams.length}`);
    }
    if (params.action) {
      queryParams.push(params.action);
      conditions.push(`al.action = $${queryParams.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await database.query(
      `SELECT al.id, al.user_id as "userId", al.user_email as "userEmail",
       COALESCE(u.first_name || ' ' || u.last_name, al.user_email, 'System') as "userName",
       al.action, al.resource, al.resource_id as "resourceId",
       al.details, al.ip_address as "ipAddress", al.user_agent as "userAgent", al.timestamp
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause} ORDER BY al.timestamp DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const countResult2 = await database.query(
      `SELECT COUNT(*) as count FROM audit_logs al ${whereClause}`,
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
