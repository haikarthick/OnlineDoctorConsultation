import database from '../../src/utils/database';
jest.mock('../../src/utils/database');
const pool = database;

import geospatialService from '../../src/services/GeospatialService';

describe('GeospatialService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createZone', () => {
    it('should create a zone', async () => {
      const zone = { id: 'z1', enterprise_id: 'e1', name: 'Pasture A', zone_type: 'pasture' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'z1' }] })
        .mockResolvedValueOnce({ rows: [zone] });
      const result = await geospatialService.createZone({ enterprise_id: 'e1', name: 'Pasture A', zone_type: 'pasture' });
      expect(result).toBeDefined();
    });
  });

  describe('listZones', () => {
    it('should list zones for an enterprise', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'z1' }, { id: 'z2' }] });
      const result = await geospatialService.listZones('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by zoneType', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await geospatialService.listZones('e1', { zoneType: 'barn' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('updateZone', () => {
    it('should update a zone', async () => {
      const updated = { id: 'z1', name: 'Updated' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [updated] });
      const result = await geospatialService.updateZone('z1', { name: 'Updated' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteZone', () => {
    it('should delete a zone', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await geospatialService.deleteZone('z1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['z1']);
    });
  });

  describe('createEvent', () => {
    it('should create a geospatial event', async () => {
      const event = { id: 'ev1', enterprise_id: 'e1', event_type: 'entry' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'ev1' }] })
        .mockResolvedValueOnce({ rows: [event] });
      const result = await geospatialService.createEvent({ enterprise_id: 'e1', event_type: 'entry' });
      expect(result).toBeDefined();
    });
  });

  describe('listEvents', () => {
    it('should list events for an enterprise', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'ev1' }] });
      const result = await geospatialService.listEvents('e1');
      expect(result.items).toHaveLength(1);
    });

    it('should filter by eventType', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      await geospatialService.listEvents('e1', { eventType: 'exit' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('getHeatmapData', () => {
    it('should return heatmap data', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await geospatialService.getHeatmapData('e1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('points');
    });
  });

  describe('getMovementTrail', () => {
    it('should return movement trail for an animal', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await geospatialService.getMovementTrail('a1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('trail');
    });
  });

  describe('getDashboard', () => {
    it('should return geospatial dashboard', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await geospatialService.getDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});
