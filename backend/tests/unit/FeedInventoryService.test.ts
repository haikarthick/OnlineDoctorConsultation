import database from '../../src/utils/database';
import feedInventoryService, { kgPerUnit } from '../../src/services/FeedInventoryService';

jest.mock('../../src/utils/database');

const query = database.query as jest.Mock;
const transaction = database.transaction as jest.Mock;

/**
 * Feed Inventory = stock and price only (migration 063). Feed GIVEN is recorded in Daily records, which takes it out
 * of stock through takeFromStock; restocking with a price writes the feed expense once.
 */
describe('FeedInventoryService', () => {
  beforeEach(() => jest.resetAllMocks());

  it('kg per unit: weight units convert themselves; a bag needs the farmer\'s figure', () => {
    expect(kgPerUnit({ unit: 'kg' })).toBe(1);
    expect(kgPerUnit({ unit: 'ton' })).toBe(1000);
    expect(kgPerUnit({ unit: 'bag' })).toBeNull();
    expect(kgPerUnit({ unit: 'bag', kg_per_unit: '50' })).toBe(50);
  });

  it('creates an item on the farm from the URL, and refuses a bag with no weight', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'f1' }] }).mockResolvedValueOnce({ rows: [{ id: 'f1', feed_name: 'Hay', unit: 'kg', current_stock: '100' }] });
    const r = await feedInventoryService.createFeed('e1', { feedName: 'Hay', unit: 'kg', currentStock: 100 });
    expect(query.mock.calls[0][1][0]).toBe('e1');
    expect(r).toMatchObject({ id: 'f1', feedName: 'Hay', currentStock: 100, stockKg: 100 });
    await expect(feedInventoryService.createFeed('e1', { feedName: 'Cattle feed', unit: 'bag' })).rejects.toThrow(/how many kg one bag/);
  });

  it('a restock with a price writes the feed expense once; without a price, none', async () => {
    const calls: string[] = [];
    transaction.mockImplementation(async (cb: any) => cb({
      query: async (sql: string) => {
        calls.push(sql);
        if (/UPDATE feed_inventory/.test(sql)) return { rows: [{ enterprise_id: 'e1', feed_name: 'Cattle feed', unit: 'bag' }] };
        if (/system_settings/.test(sql)) return { rows: [{ value: 'INR' }] };
        return { rows: [] };
      },
    }));
    query.mockResolvedValue({ rows: [{ id: 'f1', feed_name: 'Cattle feed', unit: 'bag', kg_per_unit: '50', current_stock: '10' }] });
    await feedInventoryService.restock('f1', { quantity: 10, pricePerUnit: 1200 }, 'u1');
    expect(calls.filter(s => /INSERT INTO financial_records/.test(s))).toHaveLength(1);
    calls.length = 0;
    await feedInventoryService.restock('f1', { quantity: 10 }, 'u1');
    expect(calls.filter(s => /INSERT INTO financial_records/.test(s))).toHaveLength(0);
    await expect(feedInventoryService.restock('f1', { quantity: 0 }, 'u1')).rejects.toThrow(/above zero/);
  });

  it('takeFromStock converts kg to bags, moves only the difference, and prices it', async () => {
    const client = { query: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [{ id: 'f1', feed_name: 'Cattle feed', unit: 'bag', kg_per_unit: '50', cost_per_unit: '1200', current_stock: '10' }] });
    const r = await feedInventoryService.takeFromStock(client, 'f1', 'e1', 100, 0);
    expect(r).toEqual({ taken: 2, cost: 2400, unit: 'bag' });
    expect(client.query.mock.calls[1][1]).toEqual(['f1', 8]); // 10 in store - 2 bags
    // correcting 100 kg to 150 kg takes one more bag, not three
    client.query.mockReset();
    client.query.mockResolvedValueOnce({ rows: [{ id: 'f1', feed_name: 'Cattle feed', unit: 'bag', kg_per_unit: '50', cost_per_unit: '1200', current_stock: '8' }] });
    const again = await feedInventoryService.takeFromStock(client, 'f1', 'e1', 150, 2);
    expect(client.query.mock.calls[1][1]).toEqual(['f1', 7]); // one more bag, not three
    expect(again.taken).toBe(3);
  });

  it('takeFromStock refuses another farm\'s feed and a bag with no weight, in words', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    await expect(feedInventoryService.takeFromStock(client, 'f9', 'e1', 10, 0)).rejects.toThrow(/not in this farm's stock/);
    client.query.mockResolvedValueOnce({ rows: [{ id: 'f1', feed_name: 'Mineral block', unit: 'pcs', kg_per_unit: null }] });
    await expect(feedInventoryService.takeFromStock(client, 'f1', 'e1', 10, 0)).rejects.toThrow(/how many kg one pcs/);
  });

  it('stock never goes below zero, and what is stored as taken out is what really left (a later delete cannot inflate stock)', async () => {
    const client = { query: jest.fn() };
    // 2 bags in store, the farm fed 5 bags' worth (250 kg of a 50 kg bag): only 2 bags can come out of stock
    client.query.mockResolvedValueOnce({ rows: [{ id: 'f1', feed_name: 'Cattle feed', unit: 'bag', kg_per_unit: '50', cost_per_unit: '1200', current_stock: '2' }] });
    const r = await feedInventoryService.takeFromStock(client, 'f1', 'e1', 250, 0);
    expect(r.taken).toBe(2);
    expect(r.cost).toBe(6000);
    expect(client.query.mock.calls[1][1]).toEqual(['f1', 0]);
  });

  it('analytics are read from Daily records - the one place feed given is recorded', async () => {
    query.mockResolvedValue({ rows: [] });
    const a = await feedInventoryService.getFeedAnalytics('e1');
    expect(query.mock.calls.some(c => /feed_consumption_logs/.test(c[0]))).toBe(false);
    expect(a).toMatchObject({ totalInventoryValue: 0, lowStockAlerts: [], consumptionByType: [], otherUnits: [], dailyConsumptionTrend: [] });
  });
});
