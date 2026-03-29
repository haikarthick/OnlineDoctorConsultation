/**
 * Marketplace & Auction Service — Pet Rehoming & Adoption Board
 * Rehome and adopt animals, equipment, and supplies with fixed-price listings,
 * live auction bidding, order processing, and search.
 * Compliant with PCA Act 1960, Dog Breeding Rules 2017, Pet Shop Rules 2018.
 * Enhanced with livestock-specific fields, admin controls, and market intelligence.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

class MarketplaceService {

  // ── Listings ──
  async listListings(filters: any = {}) {
    const {
      category, status = 'active', listingType, minPrice, maxPrice, search,
      sellerId, enterpriseId, limit = 50, offset = 0,
      species, breed, minMilkYield, maxMilkYield, pregnancyStatus, gender,
      listingTier, isHotDeal, vaccinationStatus, healthCertificate, sortBy,
    } = filters;
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
    if (search) { query += ` AND (l.title ILIKE $${idx} OR l.description ILIKE $${idx} OR l.breed ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    // Livestock-specific filters
    if (species) { query += ` AND l.species = $${idx++}`; params.push(species); }
    if (breed) { query += ` AND l.breed ILIKE $${idx++}`; params.push(`%${breed}%`); }
    if (minMilkYield) { query += ` AND l.daily_milk_yield >= $${idx++}`; params.push(minMilkYield); }
    if (maxMilkYield) { query += ` AND l.daily_milk_yield <= $${idx++}`; params.push(maxMilkYield); }
    if (pregnancyStatus) { query += ` AND l.pregnancy_status = $${idx++}`; params.push(pregnancyStatus); }
    if (gender) { query += ` AND l.gender = $${idx++}`; params.push(gender); }
    if (listingTier) { query += ` AND l.listing_tier = $${idx++}`; params.push(listingTier); }
    if (isHotDeal === 'true' || isHotDeal === true) { query += ` AND l.is_hot_deal = true`; }
    if (vaccinationStatus) { query += ` AND l.vaccination_status = $${idx++}`; params.push(vaccinationStatus); }
    if (healthCertificate === 'true' || healthCertificate === true) { query += ` AND l.health_certificate = true`; }
    // Non-admin users only see approved listings
    if (!filters.includeUnapproved) { query += ` AND (l.admin_approved = true OR l.admin_approved IS NULL)`; }

    // Sorting
    let orderBy = 'l.is_hot_deal DESC NULLS LAST, l.listing_tier DESC NULLS LAST, l.featured DESC, l.created_at DESC';
    if (sortBy === 'price_asc') orderBy = 'l.price ASC NULLS LAST';
    else if (sortBy === 'price_desc') orderBy = 'l.price DESC NULLS LAST';
    else if (sortBy === 'newest') orderBy = 'l.created_at DESC';
    else if (sortBy === 'milk_yield') orderBy = 'l.daily_milk_yield DESC NULLS LAST';
    else if (sortBy === 'views') orderBy = 'l.views_count DESC';

    query += ` ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx}`;
    params.push(Math.min(+limit, 100), offset);
    const result = await pool.query(query, params);

    // Count with same filters
    let countQuery = `SELECT COUNT(*) FROM marketplace_listings l WHERE 1=1`;
    const countParams: any[] = []; let cIdx = 1;
    if (status) { countQuery += ` AND l.status = $${cIdx++}`; countParams.push(status); }
    if (category) { countQuery += ` AND l.category = $${cIdx++}`; countParams.push(category); }
    if (species) { countQuery += ` AND l.species = $${cIdx++}`; countParams.push(species); }
    if (!filters.includeUnapproved) { countQuery += ` AND (l.admin_approved = true OR l.admin_approved IS NULL)`; }
    const countResult = await pool.query(countQuery, countParams);

    return { items: result.rows, total: +(countResult.rows[0]?.count || 0) };
  }

  async getListing(id: string) {
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
      `INSERT INTO marketplace_listings (
        id, enterprise_id, seller_id, title, description, category, listing_type, price, currency,
        quantity, unit, condition, images, location, shipping_options, tags, featured, expires_at,
        species, breed, animal_age_months, animal_weight_kg, gender,
        lactation_number, daily_milk_yield, pregnancy_status, pregnancy_month,
        vaccination_status, health_certificate, listing_tier, is_hot_deal,
        linked_animal_id, auction_end_time, reserve_price, contact_phone,
        latitude, longitude, admin_approved,
        seller_type, registration_number, welfare_attestation, terms_accepted, terms_accepted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43)`,
      [
        id, data.enterpriseId || null, data.sellerId, data.title, data.description || null,
        data.category || 'animal', data.listingType || 'fixed_price', data.price || null,
        data.currency || 'INR', data.quantity || 1, data.unit || null, data.condition || 'new',
        JSON.stringify(data.images || []), data.location || null, JSON.stringify(data.shippingOptions || []),
        JSON.stringify(data.tags || []), data.featured || false, data.expiresAt || null,
        data.species || null, data.breed || null, data.animalAgeMonths || null,
        data.animalWeightKg || null, data.gender || null,
        data.lactationNumber || null, data.dailyMilkYield || null,
        data.pregnancyStatus || null, data.pregnancyMonth || null,
        data.vaccinationStatus || 'unknown', data.healthCertificate || false,
        data.listingTier || 'standard', data.isHotDeal || false,
        data.linkedAnimalId || null, data.auctionEndTime || null, data.reservePrice || null,
        data.contactPhone || null, data.latitude || null, data.longitude || null,
        data.adminApproved !== undefined ? data.adminApproved : true,
        data.sellerType || 'individual', data.registrationNumber || null,
        data.welfareAttestation || false, data.termsAccepted || false,
        data.termsAccepted ? new Date().toISOString() : null,
      ]
    );
    const result = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateListing(id: string, data: any) {
    const allowedFields = [
      'title', 'description', 'price', 'quantity', 'status', 'category', 'condition', 'location',
      'species', 'breed', 'gender', 'listing_type',
      'vaccination_status', 'contact_phone', 'seller_type', 'registration_number',
    ];
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      // Convert camelCase to snake_case for DB columns
      const snakeKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      if (allowedFields.includes(key) || allowedFields.includes(snakeKey)) {
        sets.push(`${snakeKey} = $${idx++}`); vals.push(val);
      }
    }
    // Numeric livestock fields
    const numericFields: Record<string, string> = {
      animalAgeMonths: 'animal_age_months', animalWeightKg: 'animal_weight_kg',
      lactationNumber: 'lactation_number', dailyMilkYield: 'daily_milk_yield',
      pregnancyMonth: 'pregnancy_month', reservePrice: 'reserve_price',
      latitude: 'latitude', longitude: 'longitude',
    };
    for (const [camel, snake] of Object.entries(numericFields)) {
      if (data[camel] !== undefined) { sets.push(`${snake} = $${idx++}`); vals.push(data[camel]); }
    }
    // String/enum fields
    const enumFields: Record<string, string> = {
      pregnancyStatus: 'pregnancy_status', listingTier: 'listing_tier',
      auctionEndTime: 'auction_end_time',
    };
    for (const [camel, snake] of Object.entries(enumFields)) {
      if (data[camel] !== undefined) { sets.push(`${snake} = $${idx++}`); vals.push(data[camel]); }
    }
    // Boolean fields
    if (data.isHotDeal !== undefined) { sets.push(`is_hot_deal = $${idx++}`); vals.push(data.isHotDeal); }
    if (data.healthCertificate !== undefined) { sets.push(`health_certificate = $${idx++}`); vals.push(data.healthCertificate); }
    if (data.featured !== undefined) { sets.push(`featured = $${idx++}`); vals.push(data.featured); }
    if (data.welfareAttestation !== undefined) { sets.push(`welfare_attestation = $${idx++}`); vals.push(data.welfareAttestation); }
    if (data.breederVerified !== undefined) { sets.push(`breeder_verified = $${idx++}`); vals.push(data.breederVerified); }
    if (data.images) { sets.push(`images = $${idx++}`); vals.push(JSON.stringify(data.images)); }
    if (data.tags) { sets.push(`tags = $${idx++}`); vals.push(JSON.stringify(data.tags)); }
    if (sets.length === 0) return null;
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
      `SELECT o.*, l.title as listing_title, l.category, l.images, l.species, l.breed,
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
    if (listing.rows[0].status !== 'active') throw new Error('Listing is no longer active');

    const unitPrice = data.unitPrice || listing.rows[0].price;
    const qty = data.quantity || 1;
    const total = unitPrice * qty;

    await pool.query(
      `INSERT INTO marketplace_orders (id, listing_id, buyer_id, seller_id, quantity, unit_price, total_price, shipping_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.listingId, data.buyerId, listing.rows[0].seller_id, qty, unitPrice, total,
       JSON.stringify(data.shippingAddress || {}), data.notes || null]
    );

    if (listing.rows[0].listing_type === 'fixed_price') {
      await pool.query('UPDATE marketplace_listings SET status = $1 WHERE id = $2', ['rehomed', data.listingId]);
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
    const [listingStats, categoryBreakdown, recentListings, topSellers, speciesBreakdown, hotDeals] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM marketplace_listings GROUP BY status`),
      pool.query(`SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM marketplace_listings WHERE status = 'active' AND (admin_approved = true OR admin_approved IS NULL) GROUP BY category ORDER BY count DESC`),
      pool.query(`SELECT l.id, l.title, l.price, l.category, l.listing_type, l.views_count, l.created_at,
                  l.species, l.breed, l.daily_milk_yield, l.is_hot_deal, l.listing_tier, l.images,
                  u.first_name || ' ' || u.last_name as seller_name
                  FROM marketplace_listings l JOIN users u ON l.seller_id = u.id
                  WHERE l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)
                  ORDER BY l.is_hot_deal DESC NULLS LAST, l.created_at DESC LIMIT 8`),
      pool.query(`SELECT u.first_name || ' ' || u.last_name as name, COUNT(*) as listings, SUM(l.views_count) as total_views
                  FROM marketplace_listings l JOIN users u ON l.seller_id = u.id WHERE l.status IN ('active','sold','rehomed') GROUP BY u.id, u.first_name, u.last_name ORDER BY listings DESC LIMIT 5`),
      pool.query(`SELECT species, COUNT(*) as count, AVG(price) as avg_price, AVG(daily_milk_yield) as avg_milk_yield
                  FROM marketplace_listings WHERE status = 'active' AND species IS NOT NULL AND (admin_approved = true OR admin_approved IS NULL) GROUP BY species ORDER BY count DESC`),
      pool.query(`SELECT l.id, l.title, l.price, l.species, l.breed, l.daily_milk_yield, l.images, l.listing_tier,
                  u.first_name || ' ' || u.last_name as seller_name
                  FROM marketplace_listings l JOIN users u ON l.seller_id = u.id
                  WHERE l.status = 'active' AND l.is_hot_deal = true AND (l.admin_approved = true OR l.admin_approved IS NULL)
                  ORDER BY l.created_at DESC LIMIT 6`),
    ]);
    return {
      summary: {
        activeListings: +(listingStats.rows.find((r: any) => r.status === 'active')?.count || 0),
        soldListings: +(listingStats.rows.find((r: any) => r.status === 'sold')?.count || 0) + +(listingStats.rows.find((r: any) => r.status === 'rehomed')?.count || 0),
        totalListings: listingStats.rows.reduce((s: number, r: any) => s + +r.count, 0),
        pendingApproval: +(listingStats.rows.find((r: any) => r.status === 'pending')?.count || 0),
      },
      byCategory: categoryBreakdown.rows,
      bySpecies: speciesBreakdown.rows,
      recentListings: recentListings.rows,
      hotDeals: hotDeals.rows,
      topSellers: topSellers.rows,
    };
  }

  // ── Admin Controls ──
  async adminListAllListings(filters: any = {}) {
    const { status, adminApproved, category, species, limit = 50, offset = 0 } = filters;
    let query = `SELECT l.*, u.first_name || ' ' || u.last_name as seller_name, e.name as enterprise_name,
                 (SELECT COUNT(*) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as bid_count
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.id
                 LEFT JOIN enterprises e ON l.enterprise_id = e.id WHERE 1=1`;
    const params: any[] = []; let idx = 1;
    if (status) { query += ` AND l.status = $${idx++}`; params.push(status); }
    if (adminApproved !== undefined) { query += ` AND l.admin_approved = $${idx++}`; params.push(adminApproved === 'true' || adminApproved === true); }
    if (category) { query += ` AND l.category = $${idx++}`; params.push(category); }
    if (species) { query += ` AND l.species = $${idx++}`; params.push(species); }
    query += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(Math.min(+limit, 100), offset);
    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM marketplace_listings');
    return { items: result.rows, total: +(countResult.rows[0]?.count || 0) };
  }

  async adminApproveListing(id: string, notes?: string) {
    await pool.query(
      `UPDATE marketplace_listings SET admin_approved = true, admin_notes = $1, rejection_reason = NULL, status = 'active', updated_at = NOW() WHERE id = $2`,
      [notes || null, id]
    );
    return (await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id])).rows[0];
  }

  async adminRejectListing(id: string, reason: string) {
    await pool.query(
      `UPDATE marketplace_listings SET admin_approved = false, rejection_reason = $1, status = 'rejected', updated_at = NOW() WHERE id = $2`,
      [reason, id]
    );
    return (await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id])).rows[0];
  }

  async adminToggleHotDeal(id: string, isHotDeal: boolean) {
    await pool.query('UPDATE marketplace_listings SET is_hot_deal = $1, updated_at = NOW() WHERE id = $2', [isHotDeal, id]);
    return (await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id])).rows[0];
  }

  async adminToggleFeatured(id: string, featured: boolean) {
    await pool.query('UPDATE marketplace_listings SET featured = $1, updated_at = NOW() WHERE id = $2', [featured, id]);
    return (await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id])).rows[0];
  }

  async getMarketplaceStats() {
    const [overview, speciesStats, priceRanges, auctionStats, orderStats] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) as total_listings,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
        COUNT(CASE WHEN status IN ('sold','rehomed') THEN 1 END) as sold_listings,
        COUNT(CASE WHEN admin_approved = false THEN 1 END) as rejected_listings,
        COUNT(CASE WHEN admin_approved IS NULL OR admin_approved = false THEN 1 END) as pending_review,
        COUNT(CASE WHEN is_hot_deal = true THEN 1 END) as hot_deals,
        COUNT(CASE WHEN listing_type = 'auction' THEN 1 END) as auctions,
        AVG(price) as avg_price, MAX(price) as max_price, SUM(views_count) as total_views
        FROM marketplace_listings`),
      pool.query(`SELECT species, COUNT(*) as count, AVG(price) as avg_price, AVG(daily_milk_yield) as avg_milk_yield, AVG(animal_weight_kg) as avg_weight
                  FROM marketplace_listings WHERE species IS NOT NULL GROUP BY species ORDER BY count DESC`),
      pool.query(`SELECT
        COUNT(CASE WHEN price < 10000 THEN 1 END) as under_10k,
        COUNT(CASE WHEN price >= 10000 AND price < 50000 THEN 1 END) as range_10k_50k,
        COUNT(CASE WHEN price >= 50000 AND price < 100000 THEN 1 END) as range_50k_100k,
        COUNT(CASE WHEN price >= 100000 THEN 1 END) as above_100k
        FROM marketplace_listings WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*) as total_bids, COUNT(DISTINCT listing_id) as listings_with_bids, AVG(amount) as avg_bid
                  FROM marketplace_bids WHERE status = 'active'`),
      pool.query(`SELECT status, COUNT(*) as count, SUM(total_price) as total_value
                  FROM marketplace_orders GROUP BY status`),
    ]);
    return {
      overview: overview.rows[0],
      bySpecies: speciesStats.rows,
      priceDistribution: priceRanges.rows[0],
      auctions: auctionStats.rows[0],
      orders: orderStats.rows,
    };
  }

  // ── Public Browse (no auth) ──
  async listPublicListings(filters: any = {}) {
    const {
      category, listingType, minPrice, maxPrice, search,
      limit = 24, offset = 0,
      species, breed, minMilkYield, maxMilkYield, pregnancyStatus, gender,
      vaccinationStatus, healthCertificate, sortBy,
    } = filters;
    // Only select safe public columns — no seller email/phone/id
    let query = `SELECT l.id, l.title, l.description, l.category, l.listing_type, l.price, l.currency,
                 l.quantity, l.unit, l.condition, l.images, l.location, l.tags, l.featured,
                 l.species, l.breed, l.animal_age_months, l.animal_weight_kg, l.gender,
                 l.lactation_number, l.daily_milk_yield, l.pregnancy_status, l.pregnancy_month,
                 l.vaccination_status, l.health_certificate, l.listing_tier, l.is_hot_deal,
                 l.auction_end_time, l.views_count, l.created_at, l.status,
                 l.seller_type, l.breeder_verified, l.welfare_attestation,
                 u.first_name as seller_name, l.location as seller_location,
                 (SELECT COUNT(*) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as bid_count,
                 (SELECT MAX(amount) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as highest_bid
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.id
                 WHERE l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)`;
    const params: any[] = []; let idx = 1;

    if (category) { query += ` AND l.category = $${idx++}`; params.push(category); }
    if (listingType) { query += ` AND l.listing_type = $${idx++}`; params.push(listingType); }
    if (minPrice) { query += ` AND l.price >= $${idx++}`; params.push(minPrice); }
    if (maxPrice) { query += ` AND l.price <= $${idx++}`; params.push(maxPrice); }
    if (search) { query += ` AND (l.title ILIKE $${idx} OR l.description ILIKE $${idx} OR l.breed ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (species) { query += ` AND l.species = $${idx++}`; params.push(species); }
    if (breed) { query += ` AND l.breed ILIKE $${idx++}`; params.push(`%${breed}%`); }
    if (minMilkYield) { query += ` AND l.daily_milk_yield >= $${idx++}`; params.push(minMilkYield); }
    if (maxMilkYield) { query += ` AND l.daily_milk_yield <= $${idx++}`; params.push(maxMilkYield); }
    if (pregnancyStatus) { query += ` AND l.pregnancy_status = $${idx++}`; params.push(pregnancyStatus); }
    if (gender) { query += ` AND l.gender = $${idx++}`; params.push(gender); }
    if (vaccinationStatus) { query += ` AND l.vaccination_status = $${idx++}`; params.push(vaccinationStatus); }
    if (healthCertificate === 'true' || healthCertificate === true) { query += ` AND l.health_certificate = true`; }

    let orderBy = 'l.is_hot_deal DESC NULLS LAST, l.listing_tier DESC NULLS LAST, l.featured DESC, l.created_at DESC';
    if (sortBy === 'price_asc') orderBy = 'l.price ASC NULLS LAST';
    else if (sortBy === 'price_desc') orderBy = 'l.price DESC NULLS LAST';
    else if (sortBy === 'newest') orderBy = 'l.created_at DESC';
    else if (sortBy === 'milk_yield') orderBy = 'l.daily_milk_yield DESC NULLS LAST';

    query += ` ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx}`;
    params.push(Math.min(+limit, 50), offset);
    const result = await pool.query(query, params);

    // Count
    let countQuery = `SELECT COUNT(*) FROM marketplace_listings l WHERE l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)`;
    const countParams: any[] = []; let cIdx = 1;
    if (category) { countQuery += ` AND l.category = $${cIdx++}`; countParams.push(category); }
    if (species) { countQuery += ` AND l.species = $${cIdx++}`; countParams.push(species); }
    if (search) { countQuery += ` AND (l.title ILIKE $${cIdx} OR l.description ILIKE $${cIdx} OR l.breed ILIKE $${cIdx})`; countParams.push(`%${search}%`); cIdx++; }
    const countResult = await pool.query(countQuery, countParams);

    return { items: result.rows, total: +(countResult.rows[0]?.count || 0) };
  }

  async getPublicListing(id: string) {
    // Increment views
    await pool.query('UPDATE marketplace_listings SET views_count = views_count + 1 WHERE id = $1', [id]);
    // Return listing without sensitive seller info (no email, phone, seller_id)
    const result = await pool.query(
      `SELECT l.id, l.title, l.description, l.category, l.listing_type, l.price, l.currency,
              l.quantity, l.unit, l.condition, l.images, l.location, l.tags, l.featured,
              l.species, l.breed, l.animal_age_months, l.animal_weight_kg, l.gender,
              l.lactation_number, l.daily_milk_yield, l.pregnancy_status, l.pregnancy_month,
              l.vaccination_status, l.health_certificate, l.listing_tier, l.is_hot_deal,
              l.auction_end_time, l.reserve_price, l.views_count, l.created_at, l.status,
              l.seller_type, l.breeder_verified, l.welfare_attestation,
              u.first_name as seller_name, l.location as seller_location,
              e.name as enterprise_name,
              (SELECT COUNT(*) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as bid_count,
              (SELECT MAX(amount) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as highest_bid
       FROM marketplace_listings l
       LEFT JOIN users u ON l.seller_id = u.id
       LEFT JOIN enterprises e ON l.enterprise_id = e.id
       WHERE l.id = $1 AND l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)`, [id]
    );
    return result.rows[0] || null;
  }

  async getPublicStats() {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_listings,
        COUNT(DISTINCT species) FILTER (WHERE status = 'active' AND species IS NOT NULL) as species_count,
        COUNT(DISTINCT category) FILTER (WHERE status = 'active') as category_count,
        COUNT(DISTINCT seller_id) FILTER (WHERE status = 'active') as seller_count
       FROM marketplace_listings WHERE (admin_approved = true OR admin_approved IS NULL)`
    );
    return result.rows[0] || {};
  }

  // ── Market Intelligence ──
  async getMarketPrices(filters: any = {}) {
    const { species, breed } = filters;
    let query = `SELECT species, breed, 
      COUNT(*) as total_listings, AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price,
      AVG(daily_milk_yield) as avg_milk_yield, AVG(animal_weight_kg) as avg_weight
      FROM marketplace_listings WHERE status IN ('active', 'sold', 'rehomed') AND species IS NOT NULL`;
    const params: any[] = []; let idx = 1;
    if (species) { query += ` AND species = $${idx++}`; params.push(species); }
    if (breed) { query += ` AND breed ILIKE $${idx++}`; params.push(`%${breed}%`); }
    query += ` GROUP BY species, breed ORDER BY total_listings DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }
}

export default new MarketplaceService();
