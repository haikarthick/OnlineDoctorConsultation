import database from '../../src/utils/database';
jest.mock('../../src/utils/database');
const pool = database;

import sustainabilityService from '../../src/services/SustainabilityService';

describe('SustainabilityService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createMetric', () => {
    it('should create a sustainability metric', async () => {
      const metric = { id: 'm1', enterprise_id: 'e1', metric_type: 'water', value: 100 };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [metric] });
      const result = await sustainabilityService.createMetric({ enterprise_id: 'e1', metric_type: 'water', value: 100 });
      expect(result).toEqual(metric);
    });
  });

  describe('listMetrics', () => {
    it('should list metrics for an enterprise', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'm1' }, { id: 'm2' }] });
      const result = await sustainabilityService.listMetrics('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by category', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await sustainabilityService.listMetrics('e1', { category: 'energy' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('updateMetric', () => {
    it('should update a metric', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'm1', value: 200 }] });
      const result = await sustainabilityService.updateMetric('m1', { value: 200 });
      expect(result).toBeDefined();
    });
  });

  describe('deleteMetric', () => {
    it('should delete a metric', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await sustainabilityService.deleteMetric('m1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['m1']);
    });
  });

  describe('createGoal', () => {
    it('should create a sustainability goal', async () => {
      const goal = { id: 'go1', enterprise_id: 'e1', name: 'Reduce water' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'go1' }] })
        .mockResolvedValueOnce({ rows: [goal] });
      const result = await sustainabilityService.createGoal({ enterprise_id: 'e1', name: 'Reduce water' });
      expect(result).toBeDefined();
    });
  });

  describe('listGoals', () => {
    it('should list goals for an enterprise', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'go1' }] });
      const result = await sustainabilityService.listGoals('e1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateGoal', () => {
    it('should update a goal', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'go1' }] });
      const result = await sustainabilityService.updateGoal('go1', { target_value: 50 });
      expect(result).toBeDefined();
    });
  });

  describe('deleteGoal', () => {
    it('should delete a goal', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await sustainabilityService.deleteGoal('go1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['go1']);
    });
  });

  describe('estimateCarbonFootprint', () => {
    it('should estimate carbon footprint', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '100' }] });
      const result = await sustainabilityService.estimateCarbonFootprint('e1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalEstimatedCO2kg');
    });
  });

  describe('getDashboard', () => {
    it('should return sustainability dashboard', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await sustainabilityService.getDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});
