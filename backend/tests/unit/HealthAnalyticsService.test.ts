import database from '../../src/utils/database';
import healthAnalyticsService from '../../src/services/HealthAnalyticsService';

jest.mock('../../src/utils/database');

describe('HealthAnalyticsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createObservation', () => {
    it('should create a health observation', async () => {
      const obs = { id: 'o1', enterprise_id: 'e1', animal_id: 'a1', observation_type: 'symptom', description: 'Limping', severity: 'moderate' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [obs] });
      const result = await healthAnalyticsService.createObservation({ enterprise_id: 'e1', animal_id: 'a1', observation_type: 'symptom', description: 'Limping', severity: 'moderate' });
      expect(result).toEqual(expect.objectContaining({ id: 'o1', observationType: 'symptom', severity: 'moderate' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO health_observations'), expect.any(Array));
    });
  });

  describe('listObservations', () => {
    it('should list observations for an enterprise', async () => {
      const observations = [{ id: 'o1' }, { id: 'o2' }];
      (database.query as jest.Mock).mockResolvedValue({ rows: observations, rowCount: 2 });
      const result = await healthAnalyticsService.listObservations('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by animalId', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await healthAnalyticsService.listObservations('e1', { animalId: 'a1' });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by observationType', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await healthAnalyticsService.listObservations('e1', { observationType: 'symptom' });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by severity', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await healthAnalyticsService.listObservations('e1', { severity: 'critical' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('resolveObservation', () => {
    it('should resolve an observation', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await healthAnalyticsService.resolveObservation('o1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('is_resolved'), ['o1']);
    });
  });

  describe('getHealthDashboard', () => {
    it('should return health dashboard data', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const result = await healthAnalyticsService.getHealthDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});
