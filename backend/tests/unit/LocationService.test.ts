import database from '../../src/utils/database';
import locationService from '../../src/services/LocationService';

jest.mock('../../src/utils/database');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('LocationService', () => {
  beforeEach(() => jest.resetAllMocks());

  const snakeLocation = {
    id: 'l1', enterprise_id: 'e1', name: 'Barn A', location_type: 'barn',
    parent_location_id: null, capacity: '50', current_occupancy: '0',
    area: null, area_unit: 'sqft', gps_latitude: null, gps_longitude: null,
    description: null, is_active: true, metadata: null,
    created_at: '2024-01-01', updated_at: '2024-01-01',
    enterprise_name: 'Farm Co', parent_location_name: null,
    actual_occupancy: '3'
  };

  describe('createLocation', () => {
    it('should create a location', async () => {
      const location = { id: 'mock-uuid', enterprise_id: 'e1', name: 'Barn A', location_type: 'barn', capacity: '50' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [location] });
      const result = await locationService.createLocation({ enterpriseId: 'e1', name: 'Barn A', locationType: 'barn', capacity: 50 });
      expect(result).toEqual(expect.objectContaining({ id: 'mock-uuid', name: 'Barn A' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO locations'), expect.any(Array));
    });
  });

  describe('getLocation', () => {
    it('should return a location by id', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [snakeLocation] });
      const result = await locationService.getLocation('l1');
      expect(result).toEqual(expect.objectContaining({ id: 'l1', name: 'Barn A', enterpriseId: 'e1' }));
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(locationService.getLocation('nonexistent')).rejects.toThrow();
    });
  });

  describe('listByEnterprise', () => {
    it('should list locations for an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })    // COUNT
        .mockResolvedValueOnce({ rows: [snakeLocation, { ...snakeLocation, id: 'l2' }, { ...snakeLocation, id: 'l3' }] }); // SELECT
      const result = await locationService.listByEnterprise('e1');
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });
  });

  describe('updateLocation', () => {
    it('should update a location', async () => {
      const updated = { ...snakeLocation, name: 'Updated Barn' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })              // UPDATE query
        .mockResolvedValueOnce({ rows: [updated] });      // getLocation SELECT
      const result = await locationService.updateLocation('l1', { name: 'Updated Barn' });
      expect(result).toEqual(expect.objectContaining({ id: 'l1', name: 'Updated Barn' }));
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })     // UPDATE
        .mockResolvedValueOnce({ rows: [] });    // getLocation → empty
      await expect(locationService.updateLocation('nonexistent', { name: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteLocation', () => {
    it('should delete a location', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await locationService.deleteLocation('l1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
    });
  });

  describe('getLocationTree', () => {
    it('should return the location tree for an enterprise', async () => {
      const locations = [
        { ...snakeLocation, id: 'l1', name: 'Farm', parent_location_id: null },
        { ...snakeLocation, id: 'l2', name: 'Barn A', parent_location_id: 'l1' },
        { ...snakeLocation, id: 'l3', name: 'Stall 1', parent_location_id: 'l2' }
      ];
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: locations });
      const result = await locationService.getLocationTree('e1');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
