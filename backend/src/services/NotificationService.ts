import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

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
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating notification', { originalError: error });
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
}

export default new NotificationService();
