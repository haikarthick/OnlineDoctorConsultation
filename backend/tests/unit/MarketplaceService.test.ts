import database from '../../src/utils/database';
import marketplaceService from '../../src/services/MarketplaceService';

jest.mock('../../src/utils/database');
const pool = database;

describe('MarketplaceService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createListing', () => {
    it('should create a listing', async () => {
      const listing = { id: 'l1', title: 'Dog Food', price: 25.99, status: 'active' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [listing] });
      const result = await marketplaceService.createListing({ title: 'Dog Food', price: 25.99, seller_id: 's1' });
      expect(result).toEqual(listing);
    });
  });

  describe('listListings', () => {
    it('should list all listings', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await marketplaceService.listListings();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      await marketplaceService.listListings({ category: 'food' });
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('getListing', () => {
    it('should get a listing by id', async () => {
      const listing = { id: 'l1', title: 'Dog Food' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [listing] });
      const result = await marketplaceService.getListing('l1');
      expect(result).toEqual(listing);
    });

    it('should return null if not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await marketplaceService.getListing('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateListing', () => {
    it('should update a listing', async () => {
      const updated = { id: 'l1', title: 'Updated', price: 30 };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await marketplaceService.updateListing('l1', { title: 'Updated', price: 30 });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteListing', () => {
    it('should soft delete a listing', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'l1', status: 'deleted' }] });
      await marketplaceService.deleteListing('l1');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.any(Array)
      );
    });
  });

  describe('placeBid', () => {
    it('should place a bid on a listing', async () => {
      const bid = { id: 'bid1', listing_id: 'l1', bidder_id: 'u1', amount: 30 };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1', listing_type: 'auction', status: 'active', seller_id: 's1' }] })
        .mockResolvedValueOnce({ rows: [{ amount: 20 }] })
        .mockResolvedValueOnce({ rows: [bid] });
      const result = await marketplaceService.placeBid({ listing_id: 'l1', bidder_id: 'u1', amount: 30 });
      expect(result).toBeDefined();
    });
  });

  describe('listBids', () => {
    it('should list bids for a listing', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'bid1' }] });
      const result = await marketplaceService.listBids('l1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('createOrder', () => {
    it('should create an order', async () => {
      const order = { id: 'o1', listing_id: 'l1', buyer_id: 'u1' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [order] });
      const result = await marketplaceService.createOrder({ listing_id: 'l1', buyer_id: 'u1' });
      expect(result).toEqual(order);
    });
  });

  describe('listOrders', () => {
    it('should list orders for a buyer', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'o1' }] });
      const result = await marketplaceService.listOrders('u1', 'buyer');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should list orders for a seller', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'o1' }] });
      const result = await marketplaceService.listOrders('u1', 'seller');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const updated = { id: 'o1', status: 'shipped' };
      (pool.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await marketplaceService.updateOrderStatus('o1', 'shipped');
      expect(result).toEqual(updated);
    });
  });

  describe('getDashboard', () => {
    it('should return marketplace dashboard', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ active: '5', sold: '3', total: '8' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await marketplaceService.getDashboard();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('summary');
    });
  });
});
