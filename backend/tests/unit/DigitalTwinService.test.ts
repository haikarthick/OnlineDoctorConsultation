import database from '../../src/utils/database';
jest.mock('../../src/utils/database');
const pool = database;

import digitalTwinService from '../../src/services/DigitalTwinService';

describe('DigitalTwinService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createTwin', () => {
    it('should create a digital twin', async () => {
      const twin = { id: 't1', enterprise_id: 'e1', animal_id: 'a1' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [twin] });
      const result = await digitalTwinService.createTwin({ enterprise_id: 'e1', animal_id: 'a1' });
      expect(result).toEqual(twin);
    });
  });

  describe('listTwins', () => {
    it('should list twins for an enterprise', async () => {
      const twins = [{ id: 't1' }, { id: 't2' }];
      (pool.query as jest.Mock).mockResolvedValue({ rows: twins });
      const result = await digitalTwinService.listTwins('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('updateTwin', () => {
    it('should update a twin', async () => {
      const updated = { id: 't1', name: 'Updated' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await digitalTwinService.updateTwin('t1', { name: 'Updated' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteTwin', () => {
    it('should delete a twin', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await digitalTwinService.deleteTwin('t1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['t1']);
    });
  });

  describe('runSimulation', () => {
    it('should run a simulation', async () => {
      const twin = { id: 't1', parameters: {}, enterprise_id: 'e1', current_state: {} };
      const sim = { id: 's1', twin_id: 't1', scenario_type: 'disease_spread' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [twin] })    // SELECT twin
        .mockResolvedValueOnce({ rows: [] })         // INSERT simulation
        .mockResolvedValueOnce({ rows: [sim] });     // SELECT simulation with JOIN
      const result = await digitalTwinService.runSimulation({ twinId: 't1', scenarioType: 'disease_spread', enterpriseId: 'e1' });
      expect(result).toBeDefined();
    });
  });

  describe('listSimulations', () => {
    it('should list simulations', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 's1' }] });
      const result = await digitalTwinService.listSimulations('e1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getSimulation', () => {
    it('should return a simulation or null', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 's1' }] });
      const result = await digitalTwinService.getSimulation('s1');
      expect(result).toEqual({ id: 's1' });
    });

    it('should return null if not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await digitalTwinService.getSimulation('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteSimulation', () => {
    it('should delete a simulation', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await digitalTwinService.deleteSimulation('s1');
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard data', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '2', active: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await digitalTwinService.getDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});
