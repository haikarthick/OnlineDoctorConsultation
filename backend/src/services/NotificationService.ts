import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import emailService from './EmailService';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  channel: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class NotificationService {
  async createNotification(userId: string, type: string, title: string, message: string, channel: string = 'in_app', metadata?: Record<string, any>): Promise<Notification> {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO notifications (id, user_id, type, title, message, is_read, channel, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, false, $6, $7, NOW())
        RETURNING id, user_id as "userId", type, title, message, is_read as "isRead",
                  channel, metadata, created_at as "createdAt"
      `;
      const result = await database.query(query, [
        id, userId, type, title, message, channel, metadata ? JSON.stringify(metadata) : null,
      ]);
      logger.info('Notification created', { id, userId, type });

      // If channel includes email, fire off an email asynchronously
      if (channel === 'email' || channel === 'all') {
        this.dispatchEmail(userId, title, message, type, metadata).catch(err =>
          logger.error('Failed to dispatch email notification', { userId, error: err })
        );
      }

      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating notification', { originalError: error });
    }
  }

  /** Look up user email and send notification email */
  private async dispatchEmail(userId: string, title: string, message: string, type: string, metadata?: Record<string, any>) {
    const userResult = await database.query('SELECT email, first_name as "firstName" FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user?.email) return;

    // Map notification type to email template if available
    const templateMap: Record<string, string> = {
      'consultation_booked': 'consultation_booked',
      'consultation_completed': 'consultation_completed',
      'payment_received': 'payment_receipt',
      'password_reset': 'password_reset',
      'booking_cancelled': 'booking_cancelled',
      'booking_refund': 'booking_refund',
    };

    const template = templateMap[type];
    if (template) {
      await emailService.send({
        to: user.email,
        subject: title,
        template,
        data: { ...metadata, firstName: user.firstName, userName: user.firstName },
      });
    } else {
      // Generic email for other notification types
      await emailService.send({
        to: user.email,
        subject: title,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#667eea">${title}</h2>
          <p>${message}</p>
          <p style="margin-top:32px;color:#999;font-size:12px">- VetCare Notifications</p>
        </div>`,
        text: `${title}\n\n${message}\n\n- VetCare Notifications`,
      });
    }
  }

  async listNotifications(userId: string, unreadOnly: boolean = false, limit: number = 20, offset: number = 0): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    try {
      let query = `
        SELECT id, user_id as "userId", type, title, message, is_read as "isRead",
               channel, metadata, created_at as "createdAt"
        FROM notifications WHERE user_id = $1
      `;
      const params: any[] = [userId];
      let idx = 1;

      if (unreadOnly) {
        query += ` AND is_read = false`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`;
      params.push(limit, offset);

      const countQuery = `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1`;
      const unreadQuery = `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`;

      const [notificationsResult, countResult, unreadResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, [userId]),
        database.query(unreadQuery, [userId]),
      ]);

      return {
        notifications: notificationsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
        unreadCount: parseInt(unreadResult.rows[0]?.count || '0', 10),
      };
    } catch (error) {
      throw new DatabaseError('Error listing notifications', { originalError: error });
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await database.query(
        `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
        [notificationId, userId]
      );
    } catch (error) {
      throw new DatabaseError('Error marking notification as read', { originalError: error });
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      await database.query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
    } catch (error) {
      throw new DatabaseError('Error marking all notifications as read', { originalError: error });
    }
  }

  /** Send a weekly or daily network digest email to a recipient */
  async sendNetworkDigest(networkId: string, recipientUserId: string, digestType: 'weekly' | 'daily'): Promise<void> {
    try {
      const days = digestType === 'weekly' ? 7 : 1;
      const since = `NOW() - INTERVAL '${days} days'`;

      // Check user preference
      const prefRes = await database.query(
        `SELECT digest_emails_enabled FROM users WHERE id = $1`,
        [recipientUserId]
      );
      if (prefRes.rows[0]?.digest_emails_enabled === false) return;

      const [networkRes, newPatientsRes, newStaffRes, referralsRes, pendingInvitesRes] = await Promise.all([
        database.query(`SELECT name FROM hospital_networks WHERE id = $1`, [networkId]),
        database.query(
          `SELECT COUNT(*) AS count FROM animal_care_contexts WHERE network_id = $1 AND created_at >= ${since}`,
          [networkId]
        ),
        database.query(
          `SELECT COUNT(*) AS count FROM hospital_network_members WHERE network_id = $1 AND granted_at >= ${since}`,
          [networkId]
        ),
        database.query(
          `SELECT COUNT(*) AS count FROM network_referrals WHERE network_id = $1 AND created_at >= ${since}`,
          [networkId]
        ),
        database.query(
          `SELECT COUNT(*) AS count FROM hospital_staff_invites WHERE network_id = $1 AND status = 'pending'`,
          [networkId]
        ),
      ]);

      const networkName = networkRes.rows[0]?.name ?? 'Your Network';
      const newPatients = parseInt(newPatientsRes.rows[0]?.count ?? '0', 10);
      const newStaff = parseInt(newStaffRes.rows[0]?.count ?? '0', 10);
      const referrals = parseInt(referralsRes.rows[0]?.count ?? '0', 10);
      const pendingInvites = parseInt(pendingInvitesRes.rows[0]?.count ?? '0', 10);

      const label = digestType === 'weekly' ? 'Weekly' : 'Daily';
      const subject = `VetCare Network ${label} Summary - ${networkName}`;
      const message = `Here is your ${label.toLowerCase()} summary for ${networkName}:\n\n` +
        `• New Patients Enrolled: ${newPatients}\n` +
        `• Referrals This Period: ${referrals}\n` +
        `• New Staff Members: ${newStaff}\n` +
        `• Pending Staff Invites: ${pendingInvites}`;

      await this.createNotification(recipientUserId, 'network_digest', subject, message, 'email', {
        networkId, digestType, newPatients, referrals, newStaff, pendingInvites,
      });

      logger.info(`Network ${label} digest sent`, { networkId, recipientUserId });
    } catch (err: any) {
      logger.error('Failed to send network digest', { networkId, recipientUserId, error: err.message });
    }
  }
}

export default new NotificationService();
