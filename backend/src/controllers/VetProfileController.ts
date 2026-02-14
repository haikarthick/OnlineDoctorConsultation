import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import VetProfileService from '../services/VetProfileService';
import { ValidationError, ForbiddenError } from '../utils/errors';

export class VetProfileController {
  async createProfile(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'veterinarian') {
      throw new ForbiddenError('Only veterinarians can create a vet profile');
    }
    const { licenseNumber } = req.body;
    if (!licenseNumber) throw new ValidationError('License number is required');

    const profile = await VetProfileService.createProfile(req.userId!, req.body);
    res.status(201).json({ success: true, data: profile });
  }

  async getMyProfile(req: AuthRequest, res: Response): Promise<void> {
    const profile = await VetProfileService.getProfileByUserId(req.userId!);
    res.json({ success: true, data: profile });
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    const profile = await VetProfileService.getProfileByUserId(req.params.userId);
    res.json({ success: true, data: profile });
  }

  async listVets(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const specialization = req.query.specialization as string | undefined;
    const result = await VetProfileService.listVets(limit, offset, specialization);
    res.json({ success: true, data: result });
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'veterinarian') {
      throw new ForbiddenError('Only veterinarians can update their profile');
    }
    const profile = await VetProfileService.updateProfile(req.userId!, req.body);
    res.json({ success: true, data: profile });
  }
}

export default new VetProfileController();
