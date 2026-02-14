import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import NotificationService from '../services/NotificationService';

export class NotificationController {
  async listNotifications(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await NotificationService.listNotifications(req.userId!, unreadOnly, limit, offset);
    res.json({ success: true, data: result });
  }

  async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    await NotificationService.markAsRead(req.params.id, req.userId!);
    res.json({ success: true, message: 'Notification marked as read' });
  }

  async markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
    await NotificationService.markAllAsRead(req.userId!);
    res.json({ success: true, message: 'All notifications marked as read' });
  }
}

export default new NotificationController();
