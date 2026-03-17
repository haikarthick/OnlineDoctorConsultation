import database from '../../src/utils/database';
jest.mock('../../src/utils/database');
const pool = database;

import wellnessService from '../../src/services/WellnessService';

describe('WellnessService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createScorecard', () => {
    it('should create a wellness scorecard', async () => {
      const sc = { id: 'sc1', owner_id: 'u1', animal_id: 'a1' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'sc1' }] })
        .mockResolvedValueOnce({ rows: [sc] });
      const result = await wellnessService.createScorecard({ owner_id: 'u1', animal_id: 'a1', nutrition_score: 8 });
      expect(result).toBeDefined();
    });
  });

  describe('listScorecards', () => {
    it('should list scorecards for an owner', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'sc1' }] });
      const result = await wellnessService.listScorecards('u1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by animalId', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await wellnessService.listScorecards('u1', { animalId: 'a1' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('updateScorecard', () => {
    it('should update a scorecard', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'sc1', nutrition_score: 7, activity_score: 6, vaccination_score: 8, dental_score: 7 }] })  // SELECT current
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'sc1' }] });        // SELECT result
      const result = await wellnessService.updateScorecard('sc1', { nutritionScore: 9 });
      expect(result).toBeDefined();
    });
  });

  describe('deleteScorecard', () => {
    it('should delete a scorecard', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await wellnessService.deleteScorecard('sc1');
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('createReminder', () => {
    it('should create a reminder', async () => {
      const rem = { id: 'r1', owner_id: 'u1', animal_id: 'a1', title: 'Vaccination' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] })
        .mockResolvedValueOnce({ rows: [rem] });
      const result = await wellnessService.createReminder({ owner_id: 'u1', animal_id: 'a1', title: 'Vaccination' });
      expect(result).toBeDefined();
    });
  });

  describe('listReminders', () => {
    it('should list reminders for an owner', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'r1' }] });
      const result = await wellnessService.listReminders('u1');
      expect(result.items).toHaveLength(1);
    });

    it('should filter by status', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await wellnessService.listReminders('u1', { status: 'pending' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('completeReminder', () => {
    it('should complete a reminder', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })                                      // UPDATE completed
        .mockResolvedValueOnce({ rows: [{ id: 'r1', recurrence: null }] })        // SELECT recurrence check
        .mockResolvedValueOnce({ rows: [{ id: 'r1', status: 'completed' }] });    // SELECT final
      const result = await wellnessService.completeReminder('r1');
      expect(result).toBeDefined();
    });
  });

  describe('snoozeReminder', () => {
    it('should snooze a reminder', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
      const result = await wellnessService.snoozeReminder('r1', '2024-07-01');
      expect(result).toBeDefined();
    });
  });

  describe('deleteReminder', () => {
    it('should delete a reminder', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await wellnessService.deleteReminder('r1');
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('should return wellness dashboard', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total_animals: '3', avg_score: '7.5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await wellnessService.getDashboard('u1');
      expect(result).toBeDefined();
    });
  });
});
