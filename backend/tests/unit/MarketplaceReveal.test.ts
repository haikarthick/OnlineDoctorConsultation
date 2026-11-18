import database from '../../src/utils/database';
import marketplaceService, { maskPhone, REVEAL_DAILY_LIMIT } from '../../src/services/MarketplaceService';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: { createNotification: jest.fn().mockResolvedValue({}) },
}));

const pool = database as jest.Mocked<typeof database>;
const q = pool.query as jest.Mock;

describe('maskPhone', () => {
  it('keeps the first two and last three digits', () => {
    expect(maskPhone('9876543210')).toBe('98•••••210');
    expect(maskPhone('+91 98765 43210')).toBe('91•••••••210');
  });
  it('hides a number too short to mask meaningfully, and returns null for none', () => {
    expect(maskPhone('12345')).toBe('••••');
    expect(maskPhone('')).toBeNull();
    expect(maskPhone(null)).toBeNull();
  });
});

describe('listing responses never carry the phone, only the masked form', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('getListing: masked for a stranger, phone null', async () => {
    q.mockResolvedValueOnce({ rows: [{ id: 'l1', seller_id: 's1', contact_phone: '9876543210', admin_approved: true }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const r = await marketplaceService.getListing('l1', 'buyer');
    expect(r.contact_phone).toBeNull();
    expect(r.contact_phone_masked).toBe('98•••••210');
  });

  it('listListings: masked per row, phone null for non-sellers', async () => {
    q.mockResolvedValueOnce({ rows: [{ id: 'l1', seller_id: 's1', contact_phone: '9876543210' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const r = await marketplaceService.listListings({}, 'buyer', false);
    expect(r.items[0].contact_phone).toBeNull();
    expect(r.items[0].contact_phone_masked).toBe('98•••••210');
  });
});

describe('revealContact', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  const listing = { id: 'l1', title: 'Gir cow', seller_id: 's1', status: 'active', admin_approved: true, contact_phone: '9876543210' };

  it('shows the number, logs the tap, and tells the seller on the first view', async () => {
    q.mockResolvedValueOnce({ rows: [listing] })
      .mockResolvedValueOnce({ rows: [{ n: '2', already: false }] })
      .mockResolvedValueOnce({ rows: [] }); // INSERT
    const r = await marketplaceService.revealContact('l1', 'buyer', 'whatsapp');
    expect(r.phone).toBe('9876543210');
    const insert = q.mock.calls.find(c => /INSERT INTO marketplace_contact_reveals/.test(c[0]));
    expect(insert![1]).toEqual(['l1', 'buyer', 's1', 'whatsapp']);
  });

  it('stops at the daily limit with a plain message, and logs nothing', async () => {
    q.mockResolvedValueOnce({ rows: [listing] })
      .mockResolvedValueOnce({ rows: [{ n: String(REVEAL_DAILY_LIMIT), already: false }] });
    await expect(marketplaceService.revealContact('l1', 'buyer')).rejects.toMatchObject({ userFacing: true, message: expect.stringMatching(/try again tomorrow/i) });
    expect(q.mock.calls.some(c => /INSERT INTO marketplace_contact_reveals/.test(c[0]))).toBe(false);
  });

  it('lets the buyer re-open a number they already revealed today even at the limit', async () => {
    q.mockResolvedValueOnce({ rows: [listing] })
      .mockResolvedValueOnce({ rows: [{ n: String(REVEAL_DAILY_LIMIT), already: true }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(marketplaceService.revealContact('l1', 'buyer')).resolves.toEqual({ phone: '9876543210' });
  });

  it('says so plainly when the seller added no phone', async () => {
    q.mockResolvedValueOnce({ rows: [{ ...listing, contact_phone: null }] });
    await expect(marketplaceService.revealContact('l1', 'buyer')).rejects.toMatchObject({ userFacing: true, message: expect.stringMatching(/message/i) });
  });

  it('does not reveal an unapproved or deleted listing to a stranger', async () => {
    q.mockResolvedValueOnce({ rows: [{ ...listing, admin_approved: false }] });
    await expect(marketplaceService.revealContact('l1', 'buyer')).rejects.toMatchObject({ userFacing: true, message: expect.stringMatching(/not found/i) });
    q.mockResolvedValueOnce({ rows: [{ ...listing, status: 'deleted' }] });
    await expect(marketplaceService.revealContact('l1', 'buyer')).rejects.toMatchObject({ userFacing: true });
  });

  it('gives the seller their own number without logging', async () => {
    q.mockResolvedValueOnce({ rows: [listing] });
    await expect(marketplaceService.revealContact('l1', 's1')).resolves.toEqual({ phone: '9876543210' });
    expect(q).toHaveBeenCalledTimes(1);
  });
});

describe('listContactViews', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('is for the seller only', async () => {
    q.mockResolvedValueOnce({ rows: [{ seller_id: 's1' }] });
    await expect(marketplaceService.listContactViews('l1', 'someone-else')).rejects.toMatchObject({ userFacing: true });
  });
  it('lists newest first', async () => {
    q.mockResolvedValueOnce({ rows: [{ seller_id: 's1' }] }).mockResolvedValueOnce({ rows: [
      { created_at: '2026-11-17T10:00:00Z', first_name: 'A', last_initial: 'K', channel: 'call' },
      { created_at: '2026-11-18T10:00:00Z', first_name: 'B', last_initial: 'M', channel: 'whatsapp' },
    ] });
    const r = await marketplaceService.listContactViews('l1', 's1');
    expect(r.items.map((i: any) => i.first_name)).toEqual(['B', 'A']);
  });
});

describe('listListings: place and age filters', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('binds state, district, pincode and age as parameters, in order, never into the SQL text', async () => {
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
    await marketplaceService.listListings({ state: 'Kerala', district: 'Thrissur', pincode: '680001', minAge: '12', maxAge: '36' });
    const [sql, params] = q.mock.calls[0];
    expect(sql).toMatch(/LOWER\(l\.state\) = LOWER\(\$\d+\)/);
    expect(sql).toMatch(/l\.pincode = \$\d+/);
    expect(sql).toMatch(/l\.animal_age_months >= \$\d+/);
    expect(sql).not.toMatch(/Kerala|Thrissur|680001/);
    expect(params.slice(1, 6)).toEqual(['Kerala', 'Thrissur', '680001', '12', '36']);
  });
  it('adds distance_km only when the buyer shared a position', async () => {
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
    await marketplaceService.listListings({ userLat: '10.5', userLng: '76.2', radiusKm: '25' });
    expect(q.mock.calls[0][0]).toMatch(/as distance_km/);
    q.mockClear();
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
    await marketplaceService.listListings({});
    expect(q.mock.calls[0][0]).not.toMatch(/distance_km/);
  });
});

describe('exact farm coordinates stay private', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  const row = () => ({ id: 'l1', seller_id: 's1', contact_phone: '9876543210', admin_approved: true, latitude: '10.523456', longitude: '76.214567' });

  it('a stranger gets a ~1 km rounded pin and no exact coordinates', async () => {
    q.mockResolvedValueOnce({ rows: [row()] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const r = await marketplaceService.getListing('l1', 'buyer');
    expect(r.latitude).toBeUndefined();
    expect(r.longitude).toBeUndefined();
    expect(r.map_lat).toBe(10.52);
    expect(r.map_lng).toBe(76.21);
  });

  it('the seller keeps their own exact coordinates', async () => {
    q.mockResolvedValueOnce({ rows: [row()] });
    const r = await marketplaceService.getListing('l1', 's1');
    expect(r.latitude).toBe('10.523456');
    expect(r.map_lat).toBe(10.52);
  });

  it('list results strip them for everyone but the seller', async () => {
    q.mockResolvedValueOnce({ rows: [row(), { ...row(), id: 'l2', seller_id: 'buyer' }] }).mockResolvedValueOnce({ rows: [{ count: '2' }] });
    const r = await marketplaceService.listListings({}, 'buyer', false);
    expect(r.items[0].latitude).toBeUndefined();
    expect(r.items[1].latitude).toBe('10.523456');
  });
});

import { parseSearchAliases } from '../../src/services/MarketplaceService';

describe('search aliases', () => {
  it('parses a | separated list: trimmed, lower-cased, de-duplicated, at most 10, none too long', () => {
    expect(parseSearchAliases(' Gir | gir |Murrah')).toEqual(['gir', 'murrah']);
    expect(parseSearchAliases(Array.from({ length: 30 }, (_, i) => `b${i}`).join('|'))).toHaveLength(10);
    expect(parseSearchAliases('x'.repeat(101))).toEqual([]);
    expect(parseSearchAliases(undefined)).toEqual([]);
    expect(parseSearchAliases('')).toEqual([]);
  });

  it('binds the aliases as one array parameter and matches breed or species case-insensitively; the words never enter the SQL text', async () => {
    jest.clearAllMocks();
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
    await marketplaceService.listListings({ search: 'गिर', searchAliases: 'Gir|cattle' });
    const [sql, params] = q.mock.calls[0];
    expect(sql).toMatch(/LOWER\(l\.breed\) = ANY\(\$\d+::text\[\]\)/);
    expect(sql).toMatch(/LOWER\(l\.species\) = ANY\(\$\d+::text\[\]\)/);
    expect(sql).toMatch(/l\.description ILIKE \$\d+/);
    // every search placeholder must be a real $n, never a bare number
    expect(sql).toMatch(/plainto_tsquery\('english', \$\d+\)/);
    expect(sql).not.toMatch(/ILIKE\s+\d/);
    expect(sql).not.toMatch(/Gir|गिर/);
    expect(params).toContainEqual(['gir', 'cattle']);
  });

  it('adds no alias clause when none were sent', async () => {
    jest.clearAllMocks();
    q.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
    await marketplaceService.listListings({ search: 'cow' });
    expect(q.mock.calls[0][0]).not.toMatch(/ANY\(/);
  });

  it('the public query takes the aliases too', async () => {
    jest.clearAllMocks();
    q.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [] });
    await marketplaceService.listPublicListings({ search: 'गिर', searchAliases: 'Gir' });
    expect(q.mock.calls[0][0]).toMatch(/LOWER\(l\.breed\) = ANY/);
    expect(q.mock.calls[0][1]).toContainEqual(['gir']);
  });
});
