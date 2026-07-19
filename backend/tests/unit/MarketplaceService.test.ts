import database from '../../src/utils/database';
import marketplaceService from '../../src/services/MarketplaceService';

jest.mock('../../src/utils/database');
// Notifications are fire-and-forget side effects — stub them so tests stay focused on data flow
jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: { createNotification: jest.fn().mockResolvedValue({}) },
}));

const pool = database as jest.Mocked<typeof database>;

// The service runs its multi-statement writes inside pool.transaction(cb).
// Route the callback to a client whose query() draws from the same mock queue.
function wireTransaction() {
  (pool as any).transaction = jest.fn(async (cb: any) => cb({ query: pool.query }));
}

describe('MarketplaceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireTransaction();
  });

  describe('createListing', () => {
    it('should create a listing', async () => {
      const listing = { id: 'l1', title: 'Dog Food', price: 25.99, status: 'active' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })            // subscription lookup
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // active listing count (quota)
        .mockResolvedValueOnce({ rows: [] })            // INSERT
        .mockResolvedValueOnce({ rows: [listing] });    // SELECT back
      const result = await marketplaceService.createListing({ title: 'Dog Food', price: 25.99, sellerId: 's1', category: 'feed' });
      expect(result).toEqual(listing);
    });

    it('should reject when the free listing cap is reached', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })              // no subscription
        .mockResolvedValueOnce({ rows: [{ count: '20' }] }); // at the free cap
      await expect(marketplaceService.createListing({ title: 'x', sellerId: 's1', category: 'feed' }))
        .rejects.toThrow(/Listing limit/);
    });
  });

  describe('listListings', () => {
    it('should list all listings', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1', seller_id: 's1' }] })
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
    it('should get a listing by id and hide contact from non-owners', async () => {
      const listing = { id: 'l1', title: 'Dog Food', seller_id: 's1', contact_phone: '99999', admin_approved: true };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [listing] })      // main SELECT
        .mockResolvedValueOnce({ rows: [] })             // view count bump
        .mockResolvedValueOnce({ rows: [] });            // reveal check → not revealed
      const result = await marketplaceService.getListing('l1', 'someone-else');
      expect(result.id).toBe('l1');
      expect(result.contact_phone).toBeNull();
    });

    it('should return null if not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await marketplaceService.getListing('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateListing', () => {
    it('should update a listing owned by the caller', async () => {
      const updated = { id: 'l1', title: 'Updated', price: 30 };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ seller_id: 's1', status: 'active' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })            // UPDATE
        .mockResolvedValueOnce({ rows: [updated] });    // SELECT back
      const result = await marketplaceService.updateListing('l1', { title: 'Updated', price: 30 }, 's1');
      expect(result).toEqual(updated);
    });

    it('should reject edits from a non-owner (IDOR guard)', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ seller_id: 's1', status: 'active' }] });
      await expect(marketplaceService.updateListing('l1', { title: 'x' }, 'attacker'))
        .rejects.toThrow(/only edit your own/);
    });
  });

  describe('deleteListing', () => {
    it('should soft delete a listing owned by the caller', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ seller_id: 's1', status: 'active' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [{ id: 'l1', status: 'deleted' }] });       // UPDATE
      await marketplaceService.deleteListing('l1', 's1');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('status'), expect.any(Array));
    });

    it('should reject deletes from a non-owner (IDOR guard)', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ seller_id: 's1', status: 'active' }] });
      await expect(marketplaceService.deleteListing('l1', 'attacker')).rejects.toThrow(/only delete your own/);
    });
  });

  describe('placeBid', () => {
    it('should place a bid on an active auction', async () => {
      const bid = { id: 'bid1', listing_id: 'l1', bidder_id: 'u1', amount: 30 };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ is_enabled: true }] })  // getAuctionEnabled
        .mockResolvedValueOnce({ rows: [{ id: 'l1', listing_type: 'auction', status: 'active', seller_id: 's1', price: 10 }] }) // SELECT ... FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ amount: 20 }] })        // current max bid
        .mockResolvedValueOnce({ rows: [] })                      // mark previous outbid
        .mockResolvedValueOnce({ rows: [] })                      // INSERT bid
        .mockResolvedValueOnce({ rows: [bid] });                  // SELECT back
      const result = await marketplaceService.placeBid({ listingId: 'l1', bidderId: 'u1', amount: 30 });
      expect(result).toBeDefined();
    });

    it('should reject a seller bidding on their own listing', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ is_enabled: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 'l1', listing_type: 'auction', status: 'active', seller_id: 's1', price: 10 }] });
      await expect(marketplaceService.placeBid({ listingId: 'l1', bidderId: 's1', amount: 30 }))
        .rejects.toThrow(/cannot bid on your own/);
    });
  });

  describe('listBids', () => {
    it('should list bids for a listing', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'bid1' }] });
      const result = await marketplaceService.listBids('l1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('createOrder (reserve)', () => {
    it('should reserve a listing without transferring ownership', async () => {
      const order = { id: 'o1', listing_id: 'l1', buyer_id: 'u1', status: 'reserved' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1', status: 'active', seller_id: 's1', price: 100, linked_animal_id: 'a1', title: 'Cow' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] })   // INSERT order
        .mockResolvedValueOnce({ rows: [] })   // UPDATE listing → reserved
        .mockResolvedValueOnce({ rows: [order] }); // SELECT back
      const result = await marketplaceService.createOrder({ listingId: 'l1', buyerId: 'u1' });
      expect(result).toEqual(order);
      // Ownership must NOT transfer at reservation time
      const animalUpdate = (pool.query as jest.Mock).mock.calls.find(c => /UPDATE animals SET owner_id/.test(c[0]));
      expect(animalUpdate).toBeUndefined();
    });

    it('should reject reserving your own listing', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1', status: 'active', seller_id: 's1', price: 100 }] });
      await expect(marketplaceService.createOrder({ listingId: 'l1', buyerId: 's1' }))
        .rejects.toThrow(/Cannot reserve your own/);
    });
  });

  describe('confirmDeal', () => {
    it('should transfer ownership only after both parties confirm', async () => {
      const reserved = { id: 'o1', listing_id: 'l1', buyer_id: 'u1', seller_id: 's1', status: 'reserved', buyer_confirmed_at: null, seller_confirmed_at: '2026-01-01' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [reserved] })   // SELECT FOR UPDATE order
        .mockResolvedValueOnce({ rows: [] })           // UPDATE buyer_confirmed_at
        .mockResolvedValueOnce({ rows: [{ ...reserved, buyer_confirmed_at: '2026-01-02', seller_confirmed_at: '2026-01-01' }] }) // re-read order (both now confirmed)
        .mockResolvedValueOnce({ rows: [] })           // UPDATE order → completed
        .mockResolvedValueOnce({ rows: [{ id: 'l1', category: 'animal', linked_animal_id: 'a1', seller_id: 's1', title: 'Cow' }] }) // SELECT listing FOR UPDATE
        .mockResolvedValueOnce({ rows: [] })           // UPDATE listing → rehomed
        .mockResolvedValueOnce({ rows: [] })           // UPDATE animals owner
        .mockResolvedValueOnce({ rows: [{ id: 'o1', status: 'completed' }] }); // final SELECT
      const result = await marketplaceService.confirmDeal('o1', 'u1');
      expect(result.status).toBe('completed');
      const animalUpdate = (pool.query as jest.Mock).mock.calls.find(c => /UPDATE animals SET owner_id/.test(c[0]));
      expect(animalUpdate).toBeDefined();
    });

    it('should reject confirmation from someone not in the deal', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'o1', buyer_id: 'u1', seller_id: 's1', status: 'reserved' }] });
      await expect(marketplaceService.confirmDeal('o1', 'stranger')).rejects.toThrow(/not part of this deal/);
    });
  });

  describe('listOrders', () => {
    it('should list orders for a buyer', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'o1' }] });
      const result = await marketplaceService.listOrders('u1', 'buyer');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should list orders for a seller', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'o1' }] });
      const result = await marketplaceService.listOrders('u1', 'seller');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status for a participant', async () => {
      const updated = { id: 'o1', status: 'shipped' };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ buyer_id: 'u1', seller_id: 's1', status: 'pending' }] }) // participant check
        .mockResolvedValueOnce({ rows: [] })          // UPDATE
        .mockResolvedValueOnce({ rows: [updated] });  // SELECT back
      const result = await marketplaceService.updateOrderStatus('o1', 'shipped', 'u1');
      expect(result).toEqual(updated);
    });

    it('should reject status change from a non-participant', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ buyer_id: 'u1', seller_id: 's1', status: 'pending' }] });
      await expect(marketplaceService.updateOrderStatus('o1', 'shipped', 'attacker'))
        .rejects.toThrow(/not part of this order/);
    });
  });

  describe('getDashboard', () => {
    it('should return marketplace dashboard', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ active: '5', sold: '3', total: '8' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await marketplaceService.getDashboard();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('summary');
    });
  });
});
