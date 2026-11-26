import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PaymentService from '../services/PaymentService';
import { ValidationError } from '../utils/errors';

export class PaymentController {
  async getGatewaySettings(req: AuthRequest, res: Response): Promise<void> {
    const settings = await PaymentService.getGatewaySettings();
    res.json({ success: true, data: settings });
  }

  async listPayments(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await PaymentService.listPaymentsByUser(req.userId!, limit, offset);
    res.json({ success: true, data: result });
  }
}

export default new PaymentController();
