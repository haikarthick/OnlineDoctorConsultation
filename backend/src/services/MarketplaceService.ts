/**
 * Marketplace & Auction Service
 * Buy/sell animals, equipment, and supplies with fixed-price listings,
 * live auction bidding, order processing, and search.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

class MarketplaceService {

  // ── Listings ──
  async listListings(filters: any = {}) {
    const { category, status = 'active', listingType, minPrice, maxPrice, search, sellerId, enterpriseId, limit = 50, offset = 0 } = filters;
    let query = `SELECT l.*, u.first_name || ' ' || u.last_name as seller_name, e.name as enterprise_name,
                 (SELECT COUNT(*) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as bid_count,
                 (SELECT MAX(amount) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as highest_bid
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.id
                 LEFT JOIN enterprises e ON l.enterprise_id = e.id
                 WHERE 1=1`;
    const params: any[] = []; let idx = 1;

    if (status) { query += ` AND l.status = $${idx++}`; params.push(status); }
    if (category) { query += ` AND l.category = $${idx++}`; params.push(category); }
    if (listingType) { query += ` AND l.listing_type = $${idx++}`; params.push(listingType); }
    if (minPrice) { query += ` AND l.price >= $${idx++}`; params.push(minPrice); }
    if (maxPrice) { query += ` AND l.price <= $${idx++}`; params.push(maxPrice); }
    if (sellerId) { query += ` AND l.seller_id = $${idx++}`; params.push(sellerId); }
    if (enterpriseId) { query += ` AND l.enterprise_id = $${idx++}`; params.push(enterpriseId); }
    if (search) { query += ` AND (l.title ILIKE $${idx} OR l.description ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    query += ` ORDER BY l.featured DESC, l.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);

    const countResult = await pool.query('SELECT COUNT(*) FROM marketplace_listings WHERE status = $1', [status || 'active']);
    return { items: result.rows, total: +(countResult.rows[0]?.count || 0) };
  }

  async getListing(id: string) {
    // Increment view count
    await pool.query('UPDATE marketplace_listings SET views_count = views_count + 1 WHERE id = $1', [id]);
    const result = await pool.query(
      `SELECT l.*, u.first_name || ' ' || u.last_name as seller_name, e.name as enterprise_name
       FROM marketplace_listings l LEFT JOIN users u ON l.seller_id = u.id LEFT JOIN enterprises e ON l.enterprise_id = e.id WHERE l.id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  async createListing(data: any) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO marketplace_listings (id, enterprise_id, seller_id, title, description, category, listing_type, price, currency, quantity, unit, condition, images, location, shipping_options, tags, featured, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [id, data.enterpriseId || null, data.sellerId, data.title, data.description || null,
       data.category || 'animal', data.listingType || 'fixed_price', data.price || null,
       data.currency || 'USD', data.quantity || 1, data.unit || null, data.condition || 'new',
       JSON.stringify(data.images || []), data.location || null, JSON.stringify(data.shippingOptions || []),
       JSON.stringify(data.tags || []), data.featured || false, data.expiresAt || null]
    );
    const result = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateListing(id: string, data: any) {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (['title', 'description', 'price', 'quantity', 'status', 'category', 'condition', 'location'].includes(key)) {
        sets.push(`${key} = $${idx++}`); vals.push(val);
      }
    }
    if (data.images) { sets.push(`images = $${idx++}`); vals.push(JSON.stringify(data.images)); }
    if (data.tags) { sets.push(`tags = $${idx++}`); vals.push(JSON.stringify(data.tags)); }
    sets.push('updated_at = NOW()'); vals.push(id);
    await pool.query(`UPDATE marketplace_listings SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    const result = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    return result.rows[0];
  }

  async deleteListing(id: string) {
    await pool.query('UPDATE marketplace_listings SET status = $1, updated_at = NOW() WHERE id = $2', ['deleted', id]);
  }

  // ── Bids ──
  async listBids(listingId: string) {
    const result = await pool.query(
      `SELECT b.*, u.first_name || ' ' || u.last_name as bidder_name
       FROM marketplace_bids b JOIN users u ON b.bidder_id = u.id
       WHERE b.listing_id = $1 ORDER BY b.amount DESC, b.created_at ASC`, [listingId]
    );
    return { items: result.rows, total: result.rows.length };
  }

  async placeBid(data: any) {
    const id = uuidv4();
    // Check listing is auction type & active
    const listing = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [data.listingId]);
    if (!listing.rows[0]) throw new Error('Listing not found');
    if (listing.rows[0].listing_type !== 'auction') throw new Error('This listing does not accept bids');
    if (listing.rows[0].status !== 'active') throw new Error('Listing is not active');

    // Check bid is higher than current max
    const maxBid = await pool.query('SELECT MAX(amount) as max FROM marketplace_bids WHERE listing_id = $1 AND status = $2', [data.listingId, 'active']);
    const currentMax = +(maxBid.rows[0]?.max || listing.rows[0].price || 0);
    if (+data.amount <= currentMax) throw new Error(`Bid must be higher than current ${currentMax}`);

    // Mark previous winning bid as outbid
    await pool.query('UPDATE marketplace_bids SET is_winning = false WHERE listing_id = $1', [data.listingId]);

    await pool.query(
      `INSERT INTO marketplace_bids (id, listing_id, bidder_id, amount, message, is_winning)
       VALUES ($1,$2,$3,$4,$5,true)`,
      [id, data.listingId, data.bidderId, data.amount, data.message || null]
    );
    return (await pool.query('SELECT b.*, u.first_name || \' \' || u.last_name as bidder_name FROM marketplace_bids b JOIN users u ON b.bidder_id = u.id WHERE b.id = $1', [id])).rows[0];
  }

  // ── Orders ──
  async listOrders(userId: string, role: 'buyer' | 'seller' = 'buyer') {
    const col = role === 'buyer' ? 'buyer_id' : 'seller_id';
    const result = await pool.query(
      `SELECT o.*, l.title as listing_title, l.category, l.images,
       bu.first_name || ' ' || bu.last_name as buyer_name,
       su.first_name || ' ' || su.last_name as seller_name
       FROM marketplace_orders o
       JOIN marketplace_listings l ON o.listing_id = l.id
       JOIN users bu ON o.buyer_id = bu.id
       JOIN users su ON o.seller_id = su.id
       WHERE o.${col} = $1 ORDER BY o.created_at DESC`, [userId]
    );
    return { items: result.rows, total: result.rows.length };
  }

  async createOrder(data: any) {
    const id = uuidv4();
    const listing = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [data.listingId]);
    if (!listing.rows[0]) throw new Error('Listing not found');

    const unitPrice = data.unitPrice || listing.rows[0].price;
    const qty = data.quantity || 1;
    const total = unitPrice * qty;

    await pool.query(
      `INSERT INTO marketplace_orders (id, listing_id, buyer_id, seller_id, quantity, unit_price, total_price, shipping_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.listingId, data.buyerId, listing.rows[0].seller_id, qty, unitPrice, total,
       JSON.stringify(data.shippingAddress || {}), data.notes || null]
    );

    // Mark listing as sold if fixed_price
    if (listing.rows[0].listing_type === 'fixed_price') {
      await pool.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['sold', data.listingId]);
    }

    const result = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateOrderStatus(id: string, status: string) {
    const completedAt = ['delivered', 'completed'].includes(status) ? 'NOW()' : 'completed_at';
    await pool.query(`UPDATE marketplace_orders SET status = $1, completed_at = ${completedAt}, updated_at = NOW() WHERE id = $2`, [status, id]);
    const result = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1', [id]);
    return result.rows[0];
  }

  // ── Dashboard ──
  async getDashboard(filters: any = {}) {
    const [listingStats, categoryBreakdown, recentListings, topSellers] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM marketplace_listings GROUP BY status`),
      pool.query(`SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM marketplace_listings WHERE status = 'active' GROUP BY category ORDER BY count DESC`),
      pool.query(`SELECT l.id, l.title, l.price, l.category, l.listing_type, l.views_count, l.created_at, u.first_name || ' ' || u.last_name as seller_name
                  FROM marketplace_listings l JOIN users u ON l.seller_id = u.id WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 6`),
      pool.query(`SELECT u.first_name || ' ' || u.last_name as name, COUNT(*) as listings, SUM(l.views_count) as total_views
                  FROM marketplace_listings l JOIN users u ON l.seller_id = u.id WHERE l.status IN ('active','sold') GROUP BY u.id, u.first_name, u.last_name ORDER BY listings DESC LIMIT 5`),
    ]);
    return {
      summary: {
        activeListings: +(listingStats.rows.find((r: any) => r.status === 'active')?.count || 0),
        soldListings: +(listingStats.rows.find((r: any) => r.status === 'sold')?.count || 0),
        totalListings: listingStats.rows.reduce((s: number, r: any) => s + +r.count, 0),
      },
      byCategory: categoryBreakdown.rows,
      recentListings: recentListings.rows,
      topSellers: topSellers.rows,
    };
  }
}

export default new MarketplaceService();
