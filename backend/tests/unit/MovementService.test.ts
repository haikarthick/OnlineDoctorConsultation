import database from '../../src/utils/database';
import movementService from '../../src/services/MovementService';

jest.mock('../../src/utils/database');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('MovementService', () => {
  beforeEach(() => jest.resetAllMocks());

  const snakeMovement = {
    id: 'm1', enterprise_id: 'e1', animal_id: 'a1', group_id: null,
    from_location_id: 'l1', to_location_id: 'l2', movement_type: 'transfer',
    reason: 'Rotation', animal_count: '1', transport_method: null,
    transport_date: '2024-01-15', regulatory_permit: null,
    approved_by: null, recorded_by: 'u1', notes: null, metadata: null,
    created_at: '2024-01-01',
    animal_name: 'Bessie', group_name: null,
    from_location_name: 'Barn A', to_location_name: 'Barn B',
    recorded_by_name: 'John Doe'
  };

  describe('createMovement', () => {
    it('should create a movement record', async () => {
      const movement = { id: 'mock-uuid', enterprise_id: 'e1', animal_id: 'a1', from_location_id: 'l1', to_location_id: 'l2', movement_type: 'transfer', reason: 'Rotation', recorded_by: 'u1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // withdrawal status check (no treatment holds anything back)
        .mockResolvedValueOnce({ rows: [{}] })          // animal is on the farm
        .mockResolvedValueOnce({ rows: [{}] })          // from-place is on the farm
        .mockResolvedValueOnce({ rows: [{}] })          // to-place is on the farm
        .mockResolvedValueOnce({ rows: [movement] })   // INSERT
        .mockResolvedValueOnce({ rows: [] });           // UPDATE animal location
      const result = await movementService.createMovement('u1', { enterpriseId: 'e1', animalId: 'a1', fromLocationId: 'l1', toLocationId: 'l2', movementType: 'transfer', reason: 'Rotation' });
      expect(result).toEqual(expect.objectContaining({ id: 'mock-uuid' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO movement_records'), expect.any(Array));
    });
  });

  describe('farm boundaries and decisions', () => {
    it('refuses an animal that is not on the farm, in words, and writes nothing', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // withdrawal status check (no treatment holds anything back)
        .mockResolvedValueOnce({ rows: [] });                           // animal is NOT on the farm
      await expect(movementService.createMovement('u1', { enterpriseId: 'e1', animalId: 'other', toLocationId: 'l2', movementType: 'transfer' }))
        .rejects.toThrow(/not on this farm/);
      expect((database.query as jest.Mock).mock.calls.some(c => String(c[0]).includes('INSERT INTO movement_records'))).toBe(false);
    });

    it('only a pending movement can be decided', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(movementService.setDecision('m1', 'approve', 'u1')).rejects.toThrow(/already been decided/);
    });

    it('records who decided and returns the new status', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'm1' }] });
      await expect(movementService.setDecision('m1', 'reject', 'u1')).resolves.toBe('rejected');
    });
  });

  describe('listByEnterprise', () => {
    it('should list movements for an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })   // COUNT
        .mockResolvedValueOnce({ rows: [snakeMovement, { ...snakeMovement, id: 'm2' }] }); // SELECT
      const result = await movementService.listByEnterprise('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should respect limit and offset', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '20' }] })
        .mockResolvedValueOnce({ rows: [snakeMovement] });
      const result = await movementService.listByEnterprise('e1', 1, 10);
      expect(result.total).toBe(20);
    });
  });

  describe('getMovement', () => {
    it('should return a movement by id', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [snakeMovement] });
      const result = await movementService.getMovement('m1');
      expect(result).toEqual(expect.objectContaining({ id: 'm1', animalId: 'a1', fromLocationId: 'l1', toLocationId: 'l2' }));
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(movementService.getMovement('nonexistent')).rejects.toThrow();
    });
  });
});
