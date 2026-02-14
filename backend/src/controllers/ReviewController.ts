import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ReviewService from '../services/ReviewService';
import { ValidationError } from '../utils/errors';

export class ReviewController {
  async createReview(req: AuthRequest, res: Response): Promise<void> {
    const { consultationId, veterinarianId, rating, comment } = req.body;
    if (!consultationId || !veterinarianId || !rating) {
      throw new ValidationError('consultationId, veterinarianId, and rating are required');
    }
    if (rating < 1 || rating > 5) throw new ValidationError('Rating must be between 1 and 5');

    const review = await ReviewService.createReview(req.userId!, consultationId, veterinarianId, rating, comment);
    res.status(201).json({ success: true, data: review });
  }

  async listReviews(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const veterinarianId = req.params.vetId || req.userId!;
    const result = await ReviewService.listReviewsByVet(veterinarianId, limit, offset);
    res.json({ success: true, data: result });
  }
}

export default new ReviewController();
