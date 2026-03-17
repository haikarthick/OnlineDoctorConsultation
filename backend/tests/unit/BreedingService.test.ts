import database from '../../src/utils/database';
import breedingService from '../../src/services/BreedingService';

jest.mock('../../src/utils/database');

describe('BreedingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a breeding record', async () => {
      const record = { id: 'b1', enterprise_id: 'e1', sire_id: 'a1', dam_id: 'a2', breeding_date: '2024-06-01', status: 'planned' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [record] });
      const result = await breedingService.create({ enterprise_id: 'e1', sire_id: 'a1', dam_id: 'a2', breeding_date: '2024-06-01' });
      expect(result).toEqual(expect.objectContaining({ id: 'b1', enterpriseId: 'e1', sireId: 'a1', damId: 'a2' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO breeding_records'), expect.any(Array));
    });
  });

  describe('update', () => {
    it('should update a breeding record', async () => {
      const updated = { id: 'b1', status: 'confirmed' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await breedingService.update('b1', { status: 'confirmed' });
      expect(result).toEqual(expect.objectContaining({ id: 'b1', status: 'confirmed' }));
    });
  });

  describe('list', () => {
    it('should list breeding records for an enterprise', async () => {
      const records = [{ id: 'b1' }, { id: 'b2' }];
      (database.query as jest.Mock).mockResolvedValue({ rows: records, rowCount: 2 });
      const result = await breedingService.list('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await breedingService.list('e1', { status: 'confirmed' });
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('status'), expect.arrayContaining(['confirmed']));
    });
  });

  describe('getById', () => {
    it('should return a breeding record by id', async () => {
      const record = { id: 'b1', sire_id: 'a1', dam_id: 'a2' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [record] });
      const result = await breedingService.getById('b1');
      expect(result).toEqual(expect.objectContaining({ id: 'b1', sireId: 'a1', damId: 'a2' }));
    });

    it('should return null if not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await breedingService.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getUpcomingDueDates', () => {
    it('should return upcoming due dates within default range', async () => {
      const upcoming = [{ id: 'b1', expected_due_date: '2024-07-15' }];
      (database.query as jest.Mock).mockResolvedValue({ rows: upcoming });
      const result = await breedingService.getUpcomingDueDates('e1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 'b1', expectedDueDate: '2024-07-15' }));
    });

    it('should accept custom days parameter', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await breedingService.getUpcomingDueDates('e1', 60);
      expect(database.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['e1']));
    });
  });

  describe('getBreedingStats', () => {
    it('should return breeding statistics', async () => {
      const stats = { total_records: '10', bred_count: '5', delivered_count: '3' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [stats] });
      const result = await breedingService.getBreedingStats('e1');
      expect(result).toBeDefined();
    });
  });
});
