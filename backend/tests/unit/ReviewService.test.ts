import database from '../../src/utils/database';
import reviewService from '../../src/services/ReviewService';

jest.mock('../../src/utils/database');

describe('ReviewService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createReview', () => {
    it('should create a review and update vet profile', async () => {
      const review = { id: 'r1', reviewer_id: 'u1', consultation_id: 'c1', veterinarian_id: 'v1', rating: 5, comment: 'Great' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'c1', veterinarian_id: 'v1', status: 'completed' }] }) // consultation ownership/status check
        .mockResolvedValueOnce({ rows: [] })       // duplicate review check — none found
        .mockResolvedValueOnce({ rows: [review] }) // INSERT
        .mockResolvedValueOnce({ rows: [] });      // UPDATE vet_profiles rating
      const result = await reviewService.createReview('u1', 'c1', 'v1', 5, 'Great');
      expect(result).toEqual(review);
      expect(database.query).toHaveBeenCalledTimes(4);
    });
  });

  describe('listReviewsByVet', () => {
    it('should list reviews with total and average rating', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'r1', rating: 5 }] })
        .mockResolvedValueOnce({ rows: [{ count: '10', avgRating: '4.5' }] });
      const result = await reviewService.listReviewsByVet('v1');
      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.averageRating).toBe(4.5);
    });

    it('should handle no reviews', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0', avgRating: null }] });
      const result = await reviewService.listReviewsByVet('v1');
      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should accept limit and offset', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0', avgRating: null }] });
      await reviewService.listReviewsByVet('v1', 10, 5);
      expect(database.query).toHaveBeenCalled();
    });
  });
});
