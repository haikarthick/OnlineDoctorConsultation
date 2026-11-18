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
