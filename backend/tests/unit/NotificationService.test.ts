import database from '../../src/utils/database';
import notificationService from '../../src/services/NotificationService';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/EmailService', () => ({
  __esModule: true,
  default: { sendEmail: jest.fn().mockResolvedValue(undefined) }
}));

describe('NotificationService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const notification = { id: 'n1', user_id: 'u1', type: 'info', title: 'Test', message: 'Hello' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [notification] });
      const result = await notificationService.createNotification('u1', 'info', 'Test', 'Hello');
      expect(result).toEqual(notification);
    });

    it('should create with email channel', async () => {
      const notification = { id: 'n1', user_id: 'u1', type: 'info', title: 'Test', message: 'Hello', channel: 'email' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [notification] });
      const result = await notificationService.createNotification('u1', 'info', 'Test', 'Hello', 'email');
      expect(result).toBeDefined();
    });
  });

  describe('listNotifications', () => {
    it('should list notifications with total and unread count', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'n1', title: 'Test' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });
      const result = await notificationService.listNotifications('u1');
      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(5);
      expect(result.unreadCount).toBe(2);
    });

    it('should filter unread only', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const result = await notificationService.listNotifications('u1', true);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await notificationService.markAsRead('n1', 'u1');
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read'),
        expect.arrayContaining(['n1', 'u1'])
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await notificationService.markAllAsRead('u1');
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read'),
        expect.arrayContaining(['u1'])
      );
    });
  });
});
