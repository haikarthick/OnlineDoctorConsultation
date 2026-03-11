import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import PaymentService from '../services/PaymentService';
import { ValidationError } from '../utils/errors';

export class PaymentController {
  async createPayment(req: AuthRequest, res: Response): Promise<void> {
    const { consultationId, bookingId, amount, currency, paymentMethod } = req.body;
    if (!consultationId || !amount) throw new ValidationError('consultationId and amount are required');

    const payment = await PaymentService.createPayment(req.userId!, {
      consultationId, bookingId, amount, currency, paymentMethod,
    });
    res.status(201).json({ success: true, data: payment });
  }

  async getPayment(req: AuthRequest, res: Response): Promise<void> {
    const payment = await PaymentService.getPayment(req.params.id);
    res.json({ success: true, data: payment });
  }

  async getPaymentByBooking(req: AuthRequest, res: Response): Promise<void> {
    const payment = await PaymentService.getPaymentByBooking(req.params.bookingId);
    res.json({ success: true, data: payment });
  }

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
