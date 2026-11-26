import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { CodedError, DatabaseError } from '../utils/errors';
import logger from '../utils/logger';

export interface Review {
  id: string;
  consultationId: string;
  reviewerId: string;
  veterinarianId: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
  status: string;
  helpfulCount: number;
  reportCount: number;
  responseFromVet?: string;
  /** Set only when the list is read by a signed-in person: did THIS person already mark / report it. */
  markedHelpful?: boolean;
  reportedByMe?: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  reviewerFirstName?: string;
  reviewerLastName?: string;
  vetName?: string;
  consultationDate?: string;
  consultationReason?: string;
}

export interface ReviewableConsultation {
  consultationId: string;
  bookingId: string;
  vetId: string;
  vetName: string;
  vetSpecialization: string;
  vetAvatarUrl?: string;
  vetClinicName?: string;
  consultationDate: string;
  consultationReason?: string;
  consultationType: string;
}

class ReviewValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ReviewService {
  async getReviewableConsultations(userId: string): Promise<ReviewableConsultation[]> {
    try {
      const result = await database.query(`
        SELECT
          c.id AS "consultationId",
          b.id AS "bookingId",
          c.veterinarian_id AS "vetId",
          u.first_name || ' ' || u.last_name AS "vetName",
          COALESCE(array_to_string(vp.specializations, ', '), 'General Practice') AS "vetSpecialization",
          vp.profile_image AS "vetAvatarUrl",
          vp.clinic_name AS "vetClinicName",
          COALESCE(b.scheduled_date::TEXT, c.scheduled_at::DATE::TEXT) AS "consultationDate",
          COALESCE(b.reason_for_visit, c.symptom_description) AS "consultationReason",
          COALESCE(b.booking_type, c.consultation_type) AS "consultationType"
        FROM consultations c
        JOIN users u ON u.id = c.veterinarian_id
        LEFT JOIN vet_profiles vp ON vp.user_id = c.veterinarian_id
        LEFT JOIN bookings b ON b.id = c.booking_id
        WHERE c.status = 'completed'
          AND (c.user_id = $1 OR b.pet_owner_id = $1)
          AND NOT EXISTS (
            SELECT 1 FROM reviews r
            WHERE r.consultation_id = c.id AND r.reviewer_id = $1
          )
        ORDER BY COALESCE(b.scheduled_date, c.scheduled_at::DATE) DESC
        LIMIT 20
      `, [userId]);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Error fetching reviewable consultations', { originalError: error });
    }
  }

  async createReview(
    reviewerId: string,
    consultationId: string,
    veterinarianId: string,
    rating: number,
    comment?: string,
    isPublic: boolean = true
  ): Promise<Review> {
    // Validate consultation belongs to this user and is completed
    const consultationCheck = await database.query(`
      SELECT c.id, c.veterinarian_id, c.status
      FROM consultations c
      LEFT JOIN bookings b ON b.id = c.booking_id
      WHERE c.id = $1 AND c.status = 'completed'
        AND (c.user_id = $2 OR b.pet_owner_id = $2)
    `, [consultationId, reviewerId]);

    if (consultationCheck.rows.length === 0) {
      throw new ReviewValidationError('You can only review consultations you completed', 403);
    }

    // Check for duplicate
    const existing = await database.query(
      `SELECT id FROM reviews WHERE consultation_id = $1 AND reviewer_id = $2`,
      [consultationId, reviewerId]
    );
    if (existing.rows.length > 0) {
      throw new ReviewValidationError('You have already reviewed this consultation', 409);
    }

    try {
      const id = uuidv4();
      const result = await database.query(`
        INSERT INTO reviews (id, consultation_id, reviewer_id, veterinarian_id, rating, comment, is_public, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, consultation_id as "consultationId", reviewer_id as "reviewerId",
                  veterinarian_id as "veterinarianId", rating, comment,
                  is_public as "isPublic", status, helpful_count as "helpfulCount",
                  report_count as "reportCount", response_from_vet as "responseFromVet",
                  created_at as "createdAt", updated_at as "updatedAt"
      `, [id, consultationId, reviewerId, veterinarianId, rating, comment || null, isPublic]);

      // Update vet profile rating and review count (fix: was total_consultations, now correct total_reviews)
      await database.query(`
        UPDATE vet_profiles SET
          rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.veterinarian_id = $1 AND r.status = 'active'),
          total_reviews = (SELECT COUNT(*) FROM reviews r WHERE r.veterinarian_id = $1 AND r.status = 'active')
        WHERE user_id = $1
      `, [veterinarianId]);

      logger.info('Review created', { id, reviewerId, veterinarianId, rating });
      return result.rows[0];
    } catch (error: any) {
      if (error instanceof ReviewValidationError) throw error;
      throw new DatabaseError('Error creating review', { originalError: error });
    }
  }

  async listReviewsByVet(
    veterinarianId: string,
    limit: number = 20,
    offset: number = 0,
    viewerId?: string
  ): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    try {
      const query = `
        SELECT r.id, r.consultation_id as "consultationId", r.reviewer_id as "reviewerId",
               r.veterinarian_id as "veterinarianId", r.rating, r.comment,
               r.is_public as "isPublic", r.status, r.helpful_count as "helpfulCount",
               r.report_count as "reportCount", r.response_from_vet as "responseFromVet",
               u.first_name as "reviewerFirstName", u.last_name as "reviewerLastName",
               COALESCE(b.scheduled_date::TEXT, c.scheduled_at::DATE::TEXT) as "consultationDate",
               COALESCE(b.reason_for_visit, c.symptom_description) as "consultationReason",
               EXISTS (SELECT 1 FROM review_reactions x WHERE x.review_id = r.id AND x.user_id = $4 AND x.kind = 'helpful') as "markedHelpful",
               EXISTS (SELECT 1 FROM review_reactions x WHERE x.review_id = r.id AND x.user_id = $4 AND x.kind = 'report') as "reportedByMe",
               r.created_at as "createdAt", r.updated_at as "updatedAt"
        FROM reviews r
        JOIN users u ON u.id = r.reviewer_id
        LEFT JOIN consultations c ON c.id = r.consultation_id
        LEFT JOIN bookings b ON b.id = c.booking_id
        WHERE r.veterinarian_id = $1 AND r.status = 'active'
        ORDER BY r.created_at DESC LIMIT $2 OFFSET $3
      `;
      const countQuery = `
        SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as "avgRating"
        FROM reviews WHERE veterinarian_id = $1 AND status = 'active'
      `;
      const [reviewsResult, countResult] = await Promise.all([
        database.query(query, [veterinarianId, limit, offset, viewerId || null]),
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

  /** Only the reviewed vet may answer; saying it again replaces the earlier answer (the vet can correct it). */
  async addVetResponse(reviewId: string, vetUserId: string, response: string): Promise<Review> {
    const check = await database.query(
      `SELECT id FROM reviews WHERE id = $1 AND veterinarian_id = $2`,
      [reviewId, vetUserId]
    );
    if (check.rows.length === 0) {
      throw new CodedError(403, 'RV_NOT_YOUR_REVIEW', 'You can only reply to reviews written about you.');
    }
    try {
      const result = await database.query(`
        UPDATE reviews SET response_from_vet = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, response_from_vet as "responseFromVet", updated_at as "updatedAt"
      `, [response.slice(0, 1000), reviewId]);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Error adding vet response', { originalError: error });
    }
  }

  /** The review a person reacts to: it must exist, be visible, and not be their own. */
  private async reactableReview(reviewId: string, userId: string): Promise<void> {
    const r = await database.query(`SELECT reviewer_id, status FROM reviews WHERE id = $1`, [reviewId]);
    if (r.rows.length === 0 || !['active', 'flagged'].includes(r.rows[0].status)) {
      throw new CodedError(404, 'RV_NOT_FOUND', 'This review is no longer available.');
    }
    if (r.rows[0].reviewer_id === userId) {
      throw new CodedError(403, 'RV_OWN_REVIEW', 'This is your own review, so you cannot mark or report it.');
    }
  }

  /** "Helpful" is a toggle: one per person; pressing it again takes it back. */
  async markHelpful(reviewId: string, userId: string): Promise<{ helpfulCount: number; marked: boolean }> {
    await this.reactableReview(reviewId, userId);
    try {
      const del = await database.query(
        `DELETE FROM review_reactions WHERE review_id = $1 AND user_id = $2 AND kind = 'helpful'`,
        [reviewId, userId]
      );
      const marked = (del.rowCount || 0) === 0;
      if (marked) {
        await database.query(
          `INSERT INTO review_reactions (review_id, user_id, kind) VALUES ($1, $2, 'helpful') ON CONFLICT DO NOTHING`,
          [reviewId, userId]
        );
      }
      const result = await database.query(`
        UPDATE reviews SET helpful_count = (SELECT COUNT(*) FROM review_reactions WHERE review_id = $1 AND kind = 'helpful')
        WHERE id = $1 RETURNING helpful_count as "helpfulCount"
      `, [reviewId]);
      return { helpfulCount: Number(result.rows[0]?.helpfulCount || 0), marked };
    } catch (error: any) {
      throw new DatabaseError('Error marking review helpful', { originalError: error });
    }
  }

  /** One report per person per review, with a reason; three different people flag the review for the admin. */
  async reportReview(reviewId: string, userId: string, reason: string): Promise<void> {
    await this.reactableReview(reviewId, userId);
    try {
      await database.query(
        `INSERT INTO review_reactions (review_id, user_id, kind, reason) VALUES ($1, $2, 'report', $3) ON CONFLICT DO NOTHING`,
        [reviewId, userId, reason]
      );
      await database.query(
        `UPDATE reviews SET report_count = (SELECT COUNT(*) FROM review_reactions WHERE review_id = $1 AND kind = 'report'),
                            updated_at = NOW()
         WHERE id = $1`,
        [reviewId]
      );
      // Auto-flag reviews reported by 3 different people
      await database.query(
        `UPDATE reviews SET status = 'flagged', updated_at = NOW()
         WHERE id = $1 AND report_count >= 3 AND status = 'active'`,
        [reviewId]
      );
    } catch (error) {
      throw new DatabaseError('Error reporting review', { originalError: error });
    }
  }
}

export const REVIEW_REPORT_REASONS = ['inappropriate', 'fake', 'spam', 'other'] as const;

export default new ReviewService();
