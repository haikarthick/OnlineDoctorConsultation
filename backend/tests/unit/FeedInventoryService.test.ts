import database from '../../src/utils/database';
import feedInventoryService from '../../src/services/FeedInventoryService';

jest.mock('../../src/utils/database');

describe('FeedInventoryService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createFeed', () => {
    it('should create a feed item', async () => {
      const feed = { id: 'f1', enterprise_id: 'e1', feed_name: 'Hay', feed_type: 'forage', current_stock: '100', minimum_stock: '20', cost_per_unit: '5.5' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [feed] });
      const result = await feedInventoryService.createFeed({ enterprise_id: 'e1', feed_name: 'Hay', feed_type: 'forage', current_stock: 100 });
      expect(result).toEqual(expect.objectContaining({ id: 'f1', feedName: 'Hay', feedType: 'forage' }));
    });
  });

  describe('updateFeed', () => {
    it('should update a feed item', async () => {
      const updated = { id: 'f1', feed_name: 'Updated Hay', current_stock: '150' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await feedInventoryService.updateFeed('f1', { feed_name: 'Updated Hay' });
      expect(result).toEqual(expect.objectContaining({ id: 'f1', feedName: 'Updated Hay' }));
    });
  });

  describe('listFeeds', () => {
    it('should list feeds for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'f1' }, { id: 'f2' }] });
      const result = await feedInventoryService.listFeeds('e1');
      expect(result.items).toHaveLength(2);
    });
  });

  describe('restock', () => {
    it('should restock a feed item', async () => {
      const restocked = { id: 'f1', current_stock: '200' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [restocked] });
      const result = await feedInventoryService.restock('f1', 100);
      expect(result).toEqual(expect.objectContaining({ id: 'f1' }));
    });
  });

  describe('deleteFeed', () => {
    it('should soft-delete a feed item', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await feedInventoryService.deleteFeed('f1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('is_active'), ['f1']);
    });
  });

  describe('logConsumption', () => {
    it('should log feed consumption', async () => {
      const log = { id: 'cl1', feed_id: 'f1', quantity: '10', consumption_date: '2024-06-01' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [log] });
      const result = await feedInventoryService.logConsumption({ feed_id: 'f1', enterprise_id: 'e1', quantity: 10 });
      expect(result).toEqual(expect.objectContaining({ id: 'cl1', feedId: 'f1' }));
    });
  });

  describe('listConsumptionLogs', () => {
    it('should list consumption logs', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'cl1' }] });
      const result = await feedInventoryService.listConsumptionLogs('e1');
      expect(result.items).toHaveLength(1);
    });

    it('should filter by feedId', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await feedInventoryService.listConsumptionLogs('e1', { feedId: 'f1' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('getFeedAnalytics', () => {
    it('should return feed analytics', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });
      const result = await feedInventoryService.getFeedAnalytics('e1');
      expect(result).toBeDefined();
    });
  });
});
