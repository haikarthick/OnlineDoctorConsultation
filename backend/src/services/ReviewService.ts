import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface Review {
  id: string;
  consultationId: string;
  reviewerId: string;
  veterinarianId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined
  reviewerFirstName?: string;
  reviewerLastName?: string;
}

export class ReviewService {
  async createReview(reviewerId: string, consultationId: string, veterinarianId: string, rating: number, comment?: string): Promise<Review> {
    try {
      const id = uuidv4();
      const query = `
        INSERT INTO reviews (id, consultation_id, reviewer_id, veterinarian_id, rating, comment, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, consultation_id as "consultationId", reviewer_id as "reviewerId",
                  veterinarian_id as "veterinarianId", rating, comment,
                  created_at as "createdAt", updated_at as "updatedAt"
      `;
      const result = await database.query(query, [id, consultationId, reviewerId, veterinarianId, rating, comment || null]);

      // Update vet profile rating
      await database.query(`
        UPDATE vet_profiles SET
          rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.veterinarian_id = $1),
          total_consultations = (SELECT COUNT(*) FROM reviews r WHERE r.veterinarian_id = $1)
        WHERE user_id = $1
      `, [veterinarianId]);

      logger.info('Review created', { id, reviewerId, veterinarianId, rating });
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error creating review', { originalError: error });
    }
  }

  async listReviewsByVet(veterinarianId: string, limit: number = 20, offset: number = 0): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    try {
      const query = `
        SELECT r.id, r.consultation_id as "consultationId", r.reviewer_id as "reviewerId",
               r.veterinarian_id as "veterinarianId", r.rating, r.comment,
               u.first_name as "reviewerFirstName", u.last_name as "reviewerLastName",
               r.created_at as "createdAt", r.updated_at as "updatedAt"
        FROM reviews r JOIN users u ON u.id = r.reviewer_id
        WHERE r.veterinarian_id = $1
        ORDER BY r.created_at DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as "avgRating" FROM reviews WHERE veterinarian_id = $1`;
      const [reviewsResult, countResult] = await Promise.all([
        database.query(query, [veterinarianId, limit, offset]),
        database.query(countQuery, [veterinarianId]),
      ]);
      return {
        reviews: reviewsResult.rows,
        total: parseInt(countResult.rows[0]?.count || '0', 10),
        averageRating: parseFloat(countResult.rows[0]?.avgRating || '0'),
      };
    } catch (error) {
      throw new DatabaseError('Error listing reviews', { originalError: error });
    }
  }
}

export default new ReviewService();
