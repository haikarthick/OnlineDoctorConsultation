import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import WalletService from '../services/WalletService';

export class WalletController {
  async getWallet(req: AuthRequest, res: Response): Promise<void> {
    const wallet = await WalletService.getOrCreateWallet(req.userId!);
    res.json({ success: true, data: wallet });
  }

  async listTransactions(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await WalletService.listTransactions(req.userId!, limit, offset);
    res.json({ success: true, data: result });
  }
}

export default new WalletController();
