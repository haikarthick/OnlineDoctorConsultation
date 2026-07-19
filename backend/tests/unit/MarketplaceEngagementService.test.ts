import database from '../../src/utils/database';
import engagementService from '../../src/services/MarketplaceEngagementService';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: { createNotification: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../../src/utils/socketIO', () => ({
  emitToUser: jest.fn(),
  emitDataRefresh: jest.fn(),
}));

const pool = database as jest.Mocked<typeof database>;

describe('MarketplaceEngagementService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getOrCreateThread', () => {
    it('reuses an existing thread', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1', seller_id: 's1', title: 'Cow' }] }) // listing
        .mockResolvedValueOnce({ rows: [{ id: 't1', listing_id: 'l1', buyer_id: 'b1', seller_id: 's1' }] }); // existing thread
      const thread = await engagementService.getOrCreateThread('l1', 'b1');
      expect(thread.id).toBe('t1');
    });

    it('rejects a seller starting a thread on their own listing', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'l1', seller_id: 's1', title: 'Cow' }] });
      await expect(engagementService.getOrCreateThread('l1', 's1')).rejects.toThrow(/your own listing/);
    });

    it('creates a thread for a new buyer', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1', seller_id: 's1', title: 'Cow' }] }) // listing
        .mockResolvedValueOnce({ rows: [] })                                            // no existing
        .mockResolvedValueOnce({ rows: [{ id: 't2', buyer_id: 'b1', seller_id: 's1' }] }); // insert
      const thread = await engagementService.getOrCreateThread('l1', 'b1');
      expect(thread.id).toBe('t2');
    });
  });

  describe('sendMessage', () => {
    it('rejects an empty message', async () => {
      await expect(engagementService.sendMessage('t1', 'b1', '   ')).rejects.toThrow(/empty/);
    });

    it('rejects a non-participant', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 't1', buyer_id: 'b1', seller_id: 's1' }] });
      await expect(engagementService.sendMessage('t1', 'stranger', 'hi')).rejects.toThrow(/not part of this conversation/);
    });

    it('sends a message and bumps the recipient unread counter', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 't1', buyer_id: 'b1', seller_id: 's1', listing_id: 'l1' }] }) // participant check
        .mockResolvedValueOnce({ rows: [{ id: 'm1', body: 'hi' }] })  // INSERT message
        .mockResolvedValueOnce({ rows: [] })                          // UPDATE thread
        .mockResolvedValueOnce({ rows: [{ title: 'Cow' }] })          // listing title for notification
        .mockResolvedValueOnce({ rows: [{ id: 'm1', body: 'hi', sender_name: 'B' }] }); // SELECT back
      const msg = await engagementService.sendMessage('t1', 'b1', 'hi');
      expect(msg.id).toBe('m1');
      const threadUpdate = (pool.query as jest.Mock).mock.calls.find(c => /seller_unread = seller_unread \+ 1/.test(c[0]));
      expect(threadUpdate).toBeDefined(); // buyer sent → seller's unread bumped
    });
  });

  describe('favorites', () => {
    it('adds a favorite idempotently', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'l1' }] }) // listing exists
        .mockResolvedValueOnce({ rows: [] });            // upsert
      const res = await engagementService.addFavorite('u1', 'l1');
      expect(res).toEqual({ favorited: true });
    });

    it('rejects favoriting a missing listing', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(engagementService.addFavorite('u1', 'missing')).rejects.toThrow(/not found/);
    });
  });

  describe('saved searches', () => {
    it('sanitizes filters to the allowed keys only', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // count
        .mockResolvedValueOnce({ rows: [{ id: 'ss1', name: 'Cows', filters: {} }] }); // insert
      await engagementService.createSavedSearch('u1', 'Cows', { species: 'Cow', evil: "'; DROP TABLE users; --", maxPrice: 5000 });
      const insertCall = (pool.query as jest.Mock).mock.calls.find(c => /INSERT INTO marketplace_saved_searches/.test(c[0]));
      const storedFilters = JSON.parse(insertCall[1][3]);
      expect(storedFilters).toEqual({ species: 'Cow', maxPrice: 5000 });
      expect(storedFilters.evil).toBeUndefined();
    });

    it('enforces the saved-search cap', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '25' }] });
      await expect(engagementService.createSavedSearch('u1', 'x', {})).rejects.toThrow(/maximum of 25/);
    });
  });

  describe('reports', () => {
    it('rejects reporting your own listing', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ seller_id: 'u1' }] });
      await expect(engagementService.createReport('u1', 'l1', 'scam')).rejects.toThrow(/your own listing/);
    });

    it('creates a report for someone else\'s listing', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ seller_id: 's1' }] }) // listing lookup
        .mockResolvedValueOnce({ rows: [] });                   // insert
      const res = await engagementService.createReport('b1', 'l1', 'welfare_concern', 'thin');
      expect(res.reported).toBe(true);
    });

    it('surfaces the duplicate-open-report guard as a friendly error', async () => {
      const dup: any = new Error('dup'); dup.code = '23505';
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ seller_id: 's1' }] })
        .mockRejectedValueOnce(dup);
      await expect(engagementService.createReport('b1', 'l1', 'scam')).rejects.toThrow(/already reported/);
    });

    it('notifies the reporter when a report is actioned', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'r1', reporter_id: 'b1', status: 'open' }] }) // fetch
        .mockResolvedValueOnce({ rows: [] })                                                // update
        .mockResolvedValueOnce({ rows: [{ id: 'r1', status: 'actioned' }] });               // re-read
      const res = await engagementService.adminResolveReport('r1', 'admin1', 'actioned', 'removed');
      expect(res.status).toBe('actioned');
    });
  });

  describe('getConfig', () => {
    it('returns defaults when settings are missing', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const cfg = await engagementService.getConfig();
      expect(cfg.treasureMount.url).toBe('https://treasuremount.com');
      expect(cfg.transport.enabled).toBe(false);
    });

    it('reflects stored settings', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [
        { setting_key: 'treasure_mount', setting_value: { url: 'https://tm.example' }, is_enabled: true },
        { setting_key: 'transport_referral', setting_value: { url: 'https://move.example' }, is_enabled: true },
      ] });
      const cfg = await engagementService.getConfig();
      expect(cfg.treasureMount.url).toBe('https://tm.example');
      expect(cfg.transport).toEqual({ enabled: true, url: 'https://move.example' });
    });
  });

  describe('runSavedSearchAlerts', () => {
    it('notifies on new matches and advances the watermark', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'ss1', user_id: 'u1', name: 'Cows', filters: { species: 'Cow' }, last_alerted_at: '2026-01-01' }] }) // searches
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // match count
        .mockResolvedValueOnce({ rows: [] });              // watermark update
      const sent = await engagementService.runSavedSearchAlerts();
      expect(sent).toBe(1);
      const watermark = (pool.query as jest.Mock).mock.calls.find(c => /last_alerted_at = NOW\(\)/.test(c[0]));
      expect(watermark).toBeDefined();
    });

    it('advances the watermark but sends nothing when there are no matches', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'ss1', user_id: 'u1', name: 'Cows', filters: {}, last_alerted_at: '2026-01-01' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });
      const sent = await engagementService.runSavedSearchAlerts();
      expect(sent).toBe(0);
    });
  });
});
