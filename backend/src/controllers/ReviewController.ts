import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ReviewService from '../services/ReviewService';
import { ValidationError } from '../utils/errors';

export class ReviewController {
  async listReviewableConsultations(req: AuthRequest, res: Response): Promise<void> {
    const consultations = await ReviewService.getReviewableConsultations((req as any).userId);
    res.json({ success: true, data: consultations });
  }

  async createReview(req: AuthRequest, res: Response): Promise<void> {
    const { consultationId, veterinarianId, rating, comment, isPublic } = req.body;
    if (!consultationId || !veterinarianId || !rating) {
      throw new ValidationError('consultationId, veterinarianId, and rating are required');
    }
    if (rating < 1 || rating > 5) throw new ValidationError('Rating must be between 1 and 5');

    try {
      const review = await ReviewService.createReview(
        (req as any).userId,
        consultationId,
        veterinarianId,
        rating,
        comment,
        isPublic !== undefined ? isPublic : true
      );
      res.status(201).json({ success: true, data: review });
    } catch (err: any) {
      if (err.statusCode === 403) {
        res.status(403).json({ success: false, error: err.message });
      } else if (err.statusCode === 409) {
        res.status(409).json({ success: false, error: err.message });
      } else {
        throw err;
      }
    }
  }

  async listReviews(req: AuthRequest, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const veterinarianId = req.params.vetId || (req as any).userId;
    const result = await ReviewService.listReviewsByVet(veterinarianId, limit, offset);
    res.json({ success: true, data: result });
  }

  async addVetResponse(req: AuthRequest, res: Response): Promise<void> {
    const { response } = req.body;
    if (!response || typeof response !== 'string' || response.trim().length === 0) {
      throw new ValidationError('response is required');
    }
    const result = await ReviewService.addVetResponse(req.params.id, (req as any).userId, response.trim());
    res.json({ success: true, data: result });
  }

  async markHelpful(req: AuthRequest, res: Response): Promise<void> {
    const result = await ReviewService.markHelpful(req.params.id);
    res.json({ success: true, data: result });
  }

  async reportReview(req: AuthRequest, res: Response): Promise<void> {
    await ReviewService.reportReview(req.params.id);
    res.json({ success: true, message: 'Review reported' });
  }
}

export default new ReviewController();
