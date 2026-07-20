/**
 * Marketplace & Auction Service — Buy & Sell Marketplace
 * Buy and sell animals, equipment, and supplies with fixed-price listings,
 * live auction bidding, order processing, and search.
 * Compliant with PCA Act 1960, Dog Breeding Rules 2017, Pet Shop Rules 2018.
 * Enhanced with livestock-specific fields, admin controls, and market intelligence.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import NotificationService from './NotificationService';
import logger from '../utils/logger';

// Categories that involve a live animal (or germplasm) must pass admin review
// before going public — Pet Shop Rules 2018 compliance posture.
const MODERATED_CATEGORIES = ['animal', 'semen_embryo'];
// Free fair-use cap when the user has no subscription plan quota.
const MAX_FREE_ACTIVE_LISTINGS = 20;
// How long a reservation holds a listing before auto-release.
const RESERVATION_DAYS = 7;

// Notifications must never break the main flow, but failures must not be silent.
async function notifySafe(userId: string, type: string, title: string, message: string, metadata?: Record<string, any>) {
  try {
    await NotificationService.createNotification(userId, type, title, message, 'in_app', metadata);
  } catch (err: any) {
    logger.warn('[Marketplace] notification failed', { userId, type, error: err.message });
  }
}

// Fields that must never reach a non-owner, non-admin client.
function stripSensitive(row: any, requestingUserId?: string, isAdmin = false) {
  if (!row) return row;
  const isOwner = requestingUserId && row.seller_id === requestingUserId;
  if (!isOwner && !isAdmin) {
    delete row.admin_notes;
    delete row.rejection_reason;
  }
  return row;
}

class MarketplaceService {

  // ── Listings ──
  // requestingUserId/isAdmin control visibility: sellers always see their own
  // unapproved listings; only admins may see everyone's unapproved ones.
  async listListings(filters: any = {}, requestingUserId?: string, isAdmin = false) {
    const {
      category, status = 'active', listingType, minPrice, maxPrice, search,
      sellerId, enterpriseId, limit = 50, offset = 0,
      species, breed, minMilkYield, maxMilkYield, pregnancyStatus, gender,
      listingTier, isHotDeal, vaccinationStatus, healthCertificate, sortBy,
      userLat, userLng, radiusKm,
    } = filters;

    // Shared WHERE builder so the count query always matches the item query
    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const add = (clause: string, ...vals: any[]) => {
      where.push(clause.replace(/\$\?/g, () => `$${idx++}`));
      params.push(...vals);
    };

    if (status) add('l.status = $?', status);
    if (category) add('l.category = $?', category);
    if (listingType) add('l.listing_type = $?', listingType);
    if (minPrice) add('l.price >= $?', minPrice);
    if (maxPrice) add('l.price <= $?', maxPrice);
    if (sellerId) add('l.seller_id = $?', sellerId);
    if (enterpriseId) add('l.enterprise_id = $?', enterpriseId);
    // Full-text search with relevance ranking; ILIKE kept as a substring fallback
    let ftsRankExpr = '';
    if (search) {
      const qIdx = idx++; params.push(search);
      const likeIdx = idx++; params.push(`%${search}%`);
      const tsvec = `to_tsvector('english', coalesce(l.title,'')||' '||coalesce(l.description,'')||' '||coalesce(l.breed,'')||' '||coalesce(l.species,''))`;
      where.push(`(${tsvec} @@ plainto_tsquery('english', $${qIdx}) OR l.title ILIKE $${likeIdx} OR l.breed ILIKE $${likeIdx})`);
      ftsRankExpr = `ts_rank(${tsvec}, plainto_tsquery('english', $${qIdx}))`;
    }
    if (species) add('l.species = $?', species);
    if (breed) add('l.breed ILIKE $?', `%${breed}%`);
    if (minMilkYield) add('l.daily_milk_yield >= $?', minMilkYield);
    if (maxMilkYield) add('l.daily_milk_yield <= $?', maxMilkYield);
    if (pregnancyStatus) add('l.pregnancy_status = $?', pregnancyStatus);
    if (gender) add('l.gender = $?', gender);
    if (listingTier) add('l.listing_tier = $?', listingTier);
    if (isHotDeal === 'true' || isHotDeal === true) where.push('l.is_hot_deal = true');
    if (vaccinationStatus) add('l.vaccination_status = $?', vaccinationStatus);
    if (healthCertificate === 'true' || healthCertificate === true) where.push('l.health_certificate = true');
    // Approval visibility: admin sees all; a seller additionally sees their own pending/rejected
    if (!isAdmin) {
      if (requestingUserId) add('(l.admin_approved = true OR l.admin_approved IS NULL OR l.seller_id = $?)', requestingUserId);
      else where.push('(l.admin_approved = true OR l.admin_approved IS NULL)');
    }
    // Proximity filter (requires earthdistance extension); coordinates are
    // numerically coerced — non-numeric input is rejected, never interpolated
    const latN = Number(userLat); const lngN = Number(userLng); const radN = Number(radiusKm);
    const hasGeo = Number.isFinite(latN) && Number.isFinite(lngN);
    if (hasGeo && Number.isFinite(radN) && radN > 0) {
      add('l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND earth_distance(ll_to_earth($?::float8, $?::float8), ll_to_earth(l.latitude::float8, l.longitude::float8)) <= $?::float8 * 1000',
        latN, lngN, radN);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Default: relevance when searching, else promoted-then-recent
    let orderBy = ftsRankExpr
      ? `${ftsRankExpr} DESC, l.is_hot_deal DESC NULLS LAST, l.created_at DESC`
      : 'l.is_hot_deal DESC NULLS LAST, l.listing_tier DESC NULLS LAST, l.featured DESC, l.created_at DESC';
    if (sortBy === 'price_asc') orderBy = 'l.price ASC NULLS LAST';
    else if (sortBy === 'price_desc') orderBy = 'l.price DESC NULLS LAST';
    else if (sortBy === 'newest') orderBy = 'l.created_at DESC';
    else if (sortBy === 'milk_yield') orderBy = 'l.daily_milk_yield DESC NULLS LAST';
    else if (sortBy === 'views') orderBy = 'l.views_count DESC';
    else if (sortBy === 'distance' && hasGeo) orderBy = `earth_distance(ll_to_earth(${latN}::float8, ${lngN}::float8), ll_to_earth(l.latitude::float8, l.longitude::float8)) ASC NULLS LAST`;

    // Aggregated LEFT JOIN instead of correlated subqueries (avoids N+1 per row)
    const query = `SELECT l.*, u.first_name || ' ' || u.last_name as seller_name, e.name as enterprise_name,
                 COALESCE(b.bid_count, 0) as bid_count, b.highest_bid,
                 AVG(l.price) OVER (PARTITION BY l.species, l.breed) as breed_avg_price,
                 EXISTS(SELECT 1 FROM vaccination_records v WHERE v.animal_id = l.linked_animal_id AND v.is_valid = true) as has_health_passport
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.id
                 LEFT JOIN enterprises e ON l.enterprise_id = e.id
                 LEFT JOIN (
                   SELECT listing_id, COUNT(*) as bid_count, MAX(amount) as highest_bid
                   FROM marketplace_bids WHERE status = 'active' GROUP BY listing_id
                 ) b ON b.listing_id = l.id
                 ${whereSql}
                 ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx}`;
    const result = await pool.query(query, [...params, Math.min(+limit, 100), offset]);

    const countResult = await pool.query(`SELECT COUNT(*) FROM marketplace_listings l ${whereSql}`, params);

    // Contact stays gated until a deal/inquiry reveals it; moderation fields stay private
    for (const row of result.rows) {
      if (!isAdmin && row.seller_id !== requestingUserId) row.contact_phone = null;
      stripSensitive(row, requestingUserId, isAdmin);
    }

    return { items: result.rows, total: +(countResult.rows[0]?.count || 0) };
  }

  async getListing(id: string, requestingUserId?: string, isAdmin = false) {
    const result = await pool.query(
      `SELECT l.*, u.first_name || ' ' || u.last_name as seller_name, e.name as enterprise_name
       FROM marketplace_listings l LEFT JOIN users u ON l.seller_id = u.id LEFT JOIN enterprises e ON l.enterprise_id = e.id WHERE l.id = $1`, [id]
    );
    const listing = result.rows[0];
    if (!listing) return null;
    const isOwner = !!requestingUserId && listing.seller_id === requestingUserId;
    // Unapproved listings are visible only to their seller and admins
    if (listing.admin_approved === false && !isOwner && !isAdmin) return null;
    // Count views only for genuine third-party visits
    if (!isOwner && !isAdmin) {
      await pool.query('UPDATE marketplace_listings SET views_count = views_count + 1 WHERE id = $1', [id]);
      listing.views_count = (listing.views_count || 0) + 1;
    }
    // Gate contact_phone: reveal to seller, admins, buyers with a revealed
    // inquiry, or buyers with a live/completed reservation on this listing
    if (!isOwner && !isAdmin) {
      let revealed = false;
      if (requestingUserId) {
        const revealCheck = await pool.query(
          `SELECT 1 FROM marketplace_inquiries WHERE listing_id = $1 AND buyer_id = $2 AND contact_revealed = true
           UNION ALL
           SELECT 1 FROM marketplace_orders WHERE listing_id = $1 AND buyer_id = $2 AND status IN ('reserved', 'completed')
           LIMIT 1`,
          [id, requestingUserId]
        );
        revealed = !!revealCheck.rows[0];
      }
      if (!revealed) listing.contact_phone = null;
    }
    return stripSensitive(listing, requestingUserId, isAdmin);
  }

  async createListing(data: any) {
    // Free fair-use cap (marketplace is free — cap prevents spam); a plan with a
    // larger max_listings can raise it, but plans are optional and default-off
    const sub = await pool.query(
      `SELECT mp.max_listings FROM marketplace_subscriptions ms
       JOIN marketplace_plans mp ON ms.plan_id = mp.id
       WHERE ms.user_id = $1 AND ms.status = 'active' AND ms.expires_at > NOW()
       ORDER BY mp.max_listings DESC LIMIT 1`,
      [data.sellerId]
    );
    const planMax = sub.rows[0]?.max_listings;
    const maxListings = planMax && planMax > 0 ? Math.max(planMax, MAX_FREE_ACTIVE_LISTINGS) : MAX_FREE_ACTIVE_LISTINGS;
    const cnt = await pool.query(
      `SELECT COUNT(*) FROM marketplace_listings WHERE seller_id = $1 AND status NOT IN ('deleted','rejected','rehomed','sold','expired')`,
      [data.sellerId]
    );
    if (+cnt.rows[0].count >= maxListings) {
      throw new Error(`Listing limit (${maxListings}) reached. Please close or delete an existing listing before adding a new one.`);
    }

    // A linked animal must belong to the seller — prevents borrowing another
    // owner's health-passport badge and VC-ID
    if (data.linkedAnimalId) {
      const owned = await pool.query('SELECT 1 FROM animals WHERE id = $1 AND owner_id = $2', [data.linkedAnimalId, data.sellerId]);
      if (!owned.rows[0]) throw new Error('Linked animal not found in your animals');
    }

    // Animal-category listings require admin review before going public
    const category = data.category || 'animal';
    const adminApproved = MODERATED_CATEGORIES.includes(category) ? false : true;
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
        seller_type, registration_number, welfare_attestation, terms_accepted, terms_accepted_at,
        video_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)`,
      [
        id, data.enterpriseId || null, data.sellerId, data.title, data.description || null,
        category, data.listingType || 'fixed_price', data.price || null,
        data.currency || 'INR', data.quantity || 1, data.unit || null, data.condition || 'new',
        JSON.stringify(data.images || []), data.location || null, JSON.stringify(data.shippingOptions || []),
        JSON.stringify(data.tags || []),
        // Promotion flags are admin-granted, never self-assigned
        false, data.expiresAt || null,
        data.species || null, data.breed || null, data.animalAgeMonths || null,
        data.animalWeightKg || null, data.gender || null,
        data.lactationNumber || null, data.dailyMilkYield || null,
        data.pregnancyStatus || null, data.pregnancyMonth || null,
        data.vaccinationStatus || 'unknown', data.healthCertificate || false,
        'standard', false,
        data.linkedAnimalId || null, data.auctionEndTime || null, data.reservePrice || null,
        data.contactPhone || null, data.latitude || null, data.longitude || null,
        adminApproved,
        data.sellerType || 'individual', data.registrationNumber || null,
        data.welfareAttestation || false, data.termsAccepted || false,
        data.termsAccepted ? new Date().toISOString() : null,
        data.videoUrl || null,
      ]
    );
    const result = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    return result.rows[0];
  }

  async updateListing(id: string, data: any, userId?: string, isAdmin = false) {
    // Ownership guard: only the seller or an admin may modify a listing
    const existing = await pool.query('SELECT seller_id, status FROM marketplace_listings WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new Error('Listing not found');
    if (!isAdmin && existing.rows[0].seller_id !== userId) throw new Error('You can only edit your own listings');
    // Sellers may only move a listing between self-service statuses; system/admin
    // statuses (reserved, rejected, pending_closure...) are managed elsewhere
    if (!isAdmin && data.status !== undefined) {
      const sellerStatuses = ['active', 'sold', 'rehomed', 'deleted'];
      if (!sellerStatuses.includes(data.status)) throw new Error(`Status must be one of: ${sellerStatuses.join(', ')}`);
      if (existing.rows[0].status === 'reserved') throw new Error('Listing is reserved — complete or cancel the deal first');
    }

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
    // String/enum fields (promotion tier is admin-granted only)
    const enumFields: Record<string, string> = {
      pregnancyStatus: 'pregnancy_status',
      auctionEndTime: 'auction_end_time',
      ...(isAdmin ? { listingTier: 'listing_tier' } : {}),
    };
    for (const [camel, snake] of Object.entries(enumFields)) {
      if (data[camel] !== undefined) { sets.push(`${snake} = $${idx++}`); vals.push(data[camel]); }
    }
    // Boolean fields — promotion and verification flags are admin-only
    if (isAdmin && data.isHotDeal !== undefined) { sets.push(`is_hot_deal = $${idx++}`); vals.push(data.isHotDeal); }
    if (data.healthCertificate !== undefined) { sets.push(`health_certificate = $${idx++}`); vals.push(data.healthCertificate); }
    if (isAdmin && data.featured !== undefined) { sets.push(`featured = $${idx++}`); vals.push(data.featured); }
    if (data.welfareAttestation !== undefined) { sets.push(`welfare_attestation = $${idx++}`); vals.push(data.welfareAttestation); }
    if (isAdmin && data.breederVerified !== undefined) { sets.push(`breeder_verified = $${idx++}`); vals.push(data.breederVerified); }
    if (data.images) { sets.push(`images = $${idx++}`); vals.push(JSON.stringify(data.images)); }
    if (data.tags) { sets.push(`tags = $${idx++}`); vals.push(JSON.stringify(data.tags)); }
    if (data.videoUrl !== undefined) { sets.push(`video_url = $${idx++}`); vals.push(data.videoUrl || null); }
    if (sets.length === 0) return null;
    sets.push('updated_at = NOW()'); vals.push(id);
    await pool.query(`UPDATE marketplace_listings SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    const result = await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    return result.rows[0];
  }

  async deleteListing(id: string, userId?: string, isAdmin = false) {
    const existing = await pool.query('SELECT seller_id, status FROM marketplace_listings WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new Error('Listing not found');
    if (!isAdmin && existing.rows[0].seller_id !== userId) throw new Error('You can only delete your own listings');
    if (!isAdmin && existing.rows[0].status === 'reserved') throw new Error('Listing is reserved — complete or cancel the deal first');
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
    // Check auction feature is enabled platform-wide
    const auctionEnabled = await this.getAuctionEnabled();
    if (!auctionEnabled) throw new Error('Auction feature is currently disabled. Contact the platform admin for more information.');

    const id = uuidv4();
    let outbidUserId: string | null = null;
    let sellerId: string | null = null;
    let listingTitle = '';
    let extended = false;
    // Anti-snipe: a bid inside the final window pushes the end time out so
    // last-second sniping can't win uncontested. Min increment stops 1-rupee
    // nudge wars.
    const ANTI_SNIPE_MS = 2 * 60 * 1000;
    // Serialize concurrent bids on the same listing via a row lock so the
    // max-bid check and insert are atomic
    await pool.transaction(async (client: any) => {
      const listing = await client.query('SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE', [data.listingId]);
      const l = listing.rows[0];
      if (!l) throw new Error('Listing not found');
      if (l.listing_type !== 'auction') throw new Error('This listing does not accept bids');
      if (l.status !== 'active') throw new Error('Listing is not active');
      if (l.admin_approved === false) throw new Error('Listing is not active');
      if (l.seller_id === data.bidderId) throw new Error('You cannot bid on your own listing');
      if (l.auction_end_time && new Date(l.auction_end_time).getTime() <= Date.now()) throw new Error('This auction has ended');
      sellerId = l.seller_id; listingTitle = l.title;

      const maxBid = await client.query(
        `SELECT bidder_id, amount FROM marketplace_bids WHERE listing_id = $1 AND status = 'active' ORDER BY amount DESC LIMIT 1`,
        [data.listingId]
      );
      const currentMax = +(maxBid.rows[0]?.amount || l.price || 0);
      // Minimum increment: 1% of the current price, floored at 1
      const minIncrement = Math.max(1, Math.round(currentMax * 0.01));
      const minAcceptable = currentMax + (maxBid.rows[0] || l.price ? minIncrement : 0);
      if (+data.amount < minAcceptable) throw new Error(`Bid must be at least ${minAcceptable}`);
      if (maxBid.rows[0] && maxBid.rows[0].bidder_id !== data.bidderId) outbidUserId = maxBid.rows[0].bidder_id;

      await client.query('UPDATE marketplace_bids SET is_winning = false WHERE listing_id = $1', [data.listingId]);
      await client.query(
        `INSERT INTO marketplace_bids (id, listing_id, bidder_id, amount, message, is_winning)
         VALUES ($1,$2,$3,$4,$5,true)`,
        [id, data.listingId, data.bidderId, data.amount, data.message || null]
      );

      // Anti-snipe extension
      if (l.auction_end_time) {
        const remaining = new Date(l.auction_end_time).getTime() - Date.now();
        if (remaining > 0 && remaining < ANTI_SNIPE_MS) {
          await client.query(
            `UPDATE marketplace_listings SET auction_end_time = NOW() + INTERVAL '2 minutes', updated_at = NOW() WHERE id = $1`,
            [data.listingId]
          );
          extended = true;
        }
      }
    });

    if (sellerId) await notifySafe(sellerId, 'marketplace_bid', 'New bid received', `A bid of ${data.amount} was placed on "${listingTitle}"`, { listingId: data.listingId });
    if (outbidUserId) await notifySafe(outbidUserId, 'marketplace_outbid', 'You have been outbid', `Someone placed a higher bid on "${listingTitle}"`, { listingId: data.listingId });
    if (extended && outbidUserId) await notifySafe(outbidUserId, 'marketplace_auction_extended', 'Auction extended', `The auction for "${listingTitle}" was extended by a late bid.`, { listingId: data.listingId });

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

  /**
   * Reserve a listing (free classifieds deal — no payment is processed).
   * Creates a 'reserved' order that holds the listing while buyer and seller
   * connect, inspect, and settle directly between themselves. The deal is
   * completed by BOTH parties confirming via confirmDeal(); only then does a
   * linked animal's ownership record transfer.
   */
  async createOrder(data: any) {
    const id = uuidv4();
    let sellerId = '';
    let listingTitle = '';
    // Lock the listing row so two buyers cannot reserve it simultaneously
    await pool.transaction(async (client: any) => {
      const listing = await client.query('SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE', [data.listingId]);
      const l = listing.rows[0];
      if (!l) throw new Error('Listing not found');
      if (l.status !== 'active') throw new Error(l.status === 'reserved' ? 'This listing has just been reserved by another buyer' : 'Listing is no longer active');
      if (l.admin_approved === false && !data.systemCall) throw new Error('Listing is not active');
      if (l.seller_id === data.buyerId) throw new Error('Cannot reserve your own listing');
      if (l.price == null && data.unitPrice == null)
        throw new Error('This is a contact-for-fee listing — please use Inquire to contact the seller');
      sellerId = l.seller_id; listingTitle = l.title;

      const unitPrice = data.unitPrice != null ? +data.unitPrice : +l.price;
      const qty = data.quantity || 1;
      const total = unitPrice * qty;

      await client.query(
        `INSERT INTO marketplace_orders (id, listing_id, buyer_id, seller_id, quantity, unit_price, total_price, shipping_address, notes, status, reserved_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved', NOW() + INTERVAL '${RESERVATION_DAYS} days')`,
        [id, data.listingId, data.buyerId, l.seller_id, qty, unitPrice, total,
         JSON.stringify(data.shippingAddress || {}), data.notes || null]
      );
      await client.query(`UPDATE marketplace_listings SET status = 'reserved', updated_at = NOW() WHERE id = $1`, [data.listingId]);
    });

    await notifySafe(sellerId, 'marketplace_reserved', 'Your listing was reserved',
      `A buyer reserved "${listingTitle}". Connect with them to arrange inspection and settle directly.`, { listingId: data.listingId, orderId: id });
    await notifySafe(data.buyerId, 'marketplace_reserved', 'Reservation confirmed',
      `You reserved "${listingTitle}". Contact the seller, inspect, pay them directly, then confirm the deal.`, { listingId: data.listingId, orderId: id });

    const result = await pool.query('SELECT * FROM marketplace_orders WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Two-sided completion handshake. Buyer confirms they received the animal/item;
   * seller confirms they received the payment (settled off-platform). When both
   * have confirmed, the deal completes: listing closes and a linked animal's
   * ownership record transfers to the buyer.
   */
  async confirmDeal(orderId: string, userId: string, paymentMethod?: string) {
    let completed = false;
    let counterpartyId = '';
    let listingTitle = '';
    await pool.transaction(async (client: any) => {
      const orderRes = await client.query('SELECT * FROM marketplace_orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = orderRes.rows[0];
      if (!order) throw new Error('Deal not found');
      if (order.buyer_id !== userId && order.seller_id !== userId) throw new Error('You are not part of this deal');
      if (order.status !== 'reserved') throw new Error(`Deal is ${order.status} — only reserved deals can be confirmed`);

      const isBuyer = order.buyer_id === userId;
      counterpartyId = isBuyer ? order.seller_id : order.buyer_id;
      if (isBuyer && order.buyer_confirmed_at) throw new Error('You have already confirmed this deal');
      if (!isBuyer && order.seller_confirmed_at) throw new Error('You have already confirmed this deal');

      const confirmCol = isBuyer ? 'buyer_confirmed_at' : 'seller_confirmed_at';
      await client.query(
        `UPDATE marketplace_orders SET ${confirmCol} = NOW(), payment_method = COALESCE($2, payment_method), updated_at = NOW() WHERE id = $1`,
        [orderId, paymentMethod || null]
      );

      const updated = await client.query('SELECT * FROM marketplace_orders WHERE id = $1', [orderId]);
      const o = updated.rows[0];
      if (o.buyer_confirmed_at && o.seller_confirmed_at) {
        completed = true;
        await client.query(
          `UPDATE marketplace_orders SET status = 'completed', payment_status = 'settled_offline', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [orderId]
        );
        const listingRes = await client.query('SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE', [o.listing_id]);
        const l = listingRes.rows[0];
        if (l) {
          listingTitle = l.title;
          const closedStatus = MODERATED_CATEGORIES.includes(l.category) ? 'rehomed' : 'sold';
          await client.query(`UPDATE marketplace_listings SET status = $1, updated_at = NOW() WHERE id = $2`, [closedStatus, o.listing_id]);
          // Ownership record follows the animal only after both sides confirmed
          if (l.linked_animal_id) {
            await client.query(
              `UPDATE animals SET owner_id = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3`,
              [o.buyer_id, l.linked_animal_id, o.seller_id]
            );
          }
        }
      } else {
        const listingRes = await client.query('SELECT title FROM marketplace_listings WHERE id = $1', [o.listing_id]);
        listingTitle = listingRes.rows[0]?.title || '';
      }
    });

    if (completed) {
      await notifySafe(counterpartyId, 'marketplace_deal_completed', 'Deal completed',
        `The deal for "${listingTitle}" is complete — both parties confirmed.`, { orderId });
      await notifySafe(userId, 'marketplace_deal_completed', 'Deal completed',
        `The deal for "${listingTitle}" is complete — both parties confirmed.`, { orderId });
    } else {
      await notifySafe(counterpartyId, 'marketplace_deal_confirm', 'Deal confirmation received',
        `The other party confirmed the deal for "${listingTitle}". Please confirm from your side to complete it.`, { orderId });
    }

    return (await pool.query('SELECT * FROM marketplace_orders WHERE id = $1', [orderId])).rows[0];
  }

  /** Either party can cancel a reservation; the listing returns to the market. */
  async cancelDeal(orderId: string, userId: string, reason?: string) {
    let counterpartyId = '';
    let listingTitle = '';
    await pool.transaction(async (client: any) => {
      const orderRes = await client.query('SELECT * FROM marketplace_orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = orderRes.rows[0];
      if (!order) throw new Error('Deal not found');
      if (order.buyer_id !== userId && order.seller_id !== userId) throw new Error('You are not part of this deal');
      if (order.status !== 'reserved') throw new Error(`Deal is ${order.status} — only reserved deals can be cancelled`);
      counterpartyId = order.buyer_id === userId ? order.seller_id : order.buyer_id;

      await client.query(
        `UPDATE marketplace_orders SET status = 'cancelled', cancelled_by = $2, cancel_reason = $3, updated_at = NOW() WHERE id = $1`,
        [orderId, userId, reason || null]
      );
      const listingRes = await client.query(
        `UPDATE marketplace_listings SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'reserved' RETURNING title`,
        [order.listing_id]
      );
      listingTitle = listingRes.rows[0]?.title || '';
    });

    await notifySafe(counterpartyId, 'marketplace_deal_cancelled', 'Reservation cancelled',
      `The reservation for "${listingTitle}" was cancelled. The listing is available again.`, { orderId });

    return (await pool.query('SELECT * FROM marketplace_orders WHERE id = $1', [orderId])).rows[0];
  }

  /** Scheduler job: auto-release reservations whose hold window lapsed. */
  async expireReservations(): Promise<number> {
    const expired = await pool.query(
      `UPDATE marketplace_orders SET status = 'cancelled', cancel_reason = 'Reservation expired', updated_at = NOW()
       WHERE status = 'reserved' AND reserved_until IS NOT NULL AND reserved_until < NOW()
       RETURNING id, listing_id, buyer_id, seller_id`
    );
    for (const o of expired.rows) {
      await pool.query(`UPDATE marketplace_listings SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'reserved'`, [o.listing_id]);
      await notifySafe(o.buyer_id, 'marketplace_deal_expired', 'Reservation expired', 'Your reservation expired and the listing is back on the market.', { orderId: o.id });
      await notifySafe(o.seller_id, 'marketplace_deal_expired', 'Reservation expired', 'A reservation on your listing expired — it is active again.', { orderId: o.id });
    }
    return expired.rows.length;
  }

  async updateOrderStatus(id: string, status: string, userId?: string, isAdmin = false) {
    // Participant guard: only the buyer, the seller, or an admin may touch an order
    const existing = await pool.query('SELECT buyer_id, seller_id, status FROM marketplace_orders WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new Error('Order not found');
    const o = existing.rows[0];
    if (!isAdmin && o.buyer_id !== userId && o.seller_id !== userId) throw new Error('You are not part of this order');
    if (['completed', 'cancelled'].includes(o.status) && !isAdmin) throw new Error(`Order is already ${o.status}`);
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
                 COALESCE(b.bid_count, 0) as bid_count
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.id
                 LEFT JOIN enterprises e ON l.enterprise_id = e.id
                 LEFT JOIN (
                   SELECT listing_id, COUNT(*) as bid_count
                   FROM marketplace_bids WHERE status = 'active' GROUP BY listing_id
                 ) b ON b.listing_id = l.id WHERE 1=1`;
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
    const row = (await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id])).rows[0];
    if (row) await notifySafe(row.seller_id, 'marketplace_listing_approved', 'Listing approved', `Your listing "${row.title}" is now live on the marketplace.`, { listingId: id });
    return row;
  }

  async adminRejectListing(id: string, reason: string) {
    await pool.query(
      `UPDATE marketplace_listings SET admin_approved = false, rejection_reason = $1, status = 'rejected', updated_at = NOW() WHERE id = $2`,
      [reason, id]
    );
    const row = (await pool.query('SELECT * FROM marketplace_listings WHERE id = $1', [id])).rows[0];
    if (row) await notifySafe(row.seller_id, 'marketplace_listing_rejected', 'Listing rejected', `Your listing "${row.title}" was rejected: ${reason}`, { listingId: id });
    return row;
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
      userLat, userLng, radiusKm,
    } = filters;

    // Build WHERE clause once, shared by the page query and the count query
    // so the reported total always matches the applied filters.
    const PUB_TSVEC = `to_tsvector('english', coalesce(l.title,'')||' '||coalesce(l.description,'')||' '||coalesce(l.breed,'')||' '||coalesce(l.species,''))`;
    let where = `l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)`;
    const params: any[] = []; let idx = 1;

    if (category) { where += ` AND l.category = $${idx++}`; params.push(category); }
    if (listingType) { where += ` AND l.listing_type = $${idx++}`; params.push(listingType); }
    if (minPrice) { where += ` AND l.price >= $${idx++}`; params.push(minPrice); }
    if (maxPrice) { where += ` AND l.price <= $${idx++}`; params.push(maxPrice); }
    let pubFtsRank = '';
    if (search) {
      const qIdx = idx++; params.push(search);
      const likeIdx = idx++; params.push(`%${search}%`);
      where += ` AND (${PUB_TSVEC} @@ plainto_tsquery('english', $${qIdx}) OR l.title ILIKE $${likeIdx} OR l.breed ILIKE $${likeIdx})`;
      pubFtsRank = `ts_rank(${PUB_TSVEC}, plainto_tsquery('english', $${qIdx}))`;
    }
    if (species) { where += ` AND l.species = $${idx++}`; params.push(species); }
    if (breed) { where += ` AND l.breed ILIKE $${idx++}`; params.push(`%${breed}%`); }
    if (minMilkYield) { where += ` AND l.daily_milk_yield >= $${idx++}`; params.push(minMilkYield); }
    if (maxMilkYield) { where += ` AND l.daily_milk_yield <= $${idx++}`; params.push(maxMilkYield); }
    if (pregnancyStatus) { where += ` AND l.pregnancy_status = $${idx++}`; params.push(pregnancyStatus); }
    if (gender) { where += ` AND l.gender = $${idx++}`; params.push(gender); }
    if (vaccinationStatus) { where += ` AND l.vaccination_status = $${idx++}`; params.push(vaccinationStatus); }
    if (healthCertificate === 'true' || healthCertificate === true) { where += ` AND l.health_certificate = true`; }
    // Proximity filter (requires earthdistance extension)
    if (userLat && userLng && radiusKm) {
      where += ` AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL AND earth_distance(ll_to_earth($${idx}::float8, $${idx+1}::float8), ll_to_earth(l.latitude::float8, l.longitude::float8)) <= $${idx+2}::float8 * 1000`;
      params.push(+userLat, +userLng, +radiusKm);
      idx += 3;
    }

    // Count with the identical WHERE + params (before limit/offset are appended)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM marketplace_listings l WHERE ${where}`, params.slice()
    );

    // Only select safe public columns — no seller email/phone/id
    let query = `SELECT l.id, l.title, l.description, l.category, l.listing_type, l.price, l.currency,
                 l.quantity, l.unit, l.condition, l.images, l.location, l.tags, l.featured,
                 l.species, l.breed, l.animal_age_months, l.animal_weight_kg, l.gender,
                 l.lactation_number, l.daily_milk_yield, l.pregnancy_status, l.pregnancy_month,
                 l.vaccination_status, l.health_certificate, l.listing_tier, l.is_hot_deal,
                 l.video_url, l.auction_end_time, l.views_count, l.created_at, l.status,
                 l.seller_type, l.breeder_verified, l.welfare_attestation,
                 u.first_name as seller_name, l.location as seller_location,
                 a.unique_id as animal_unique_id,
                 (SELECT COUNT(*) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as bid_count,
                 (SELECT MAX(amount) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as highest_bid,
                 AVG(l.price) OVER (PARTITION BY l.species, l.breed) as breed_avg_price,
                 EXISTS(SELECT 1 FROM vaccination_records v WHERE v.animal_id = l.linked_animal_id AND v.is_valid = true) as has_health_passport
                 FROM marketplace_listings l
                 LEFT JOIN users u ON l.seller_id = u.id
                 LEFT JOIN animals a ON a.id = l.linked_animal_id
                 WHERE ${where}`;

    let orderBy = pubFtsRank
      ? `${pubFtsRank} DESC, l.is_hot_deal DESC NULLS LAST, l.created_at DESC`
      : 'l.is_hot_deal DESC NULLS LAST, l.listing_tier DESC NULLS LAST, l.featured DESC, l.created_at DESC';
    if (sortBy === 'price_asc') orderBy = 'l.price ASC NULLS LAST';
    else if (sortBy === 'price_desc') orderBy = 'l.price DESC NULLS LAST';
    else if (sortBy === 'newest') orderBy = 'l.created_at DESC';
    else if (sortBy === 'milk_yield') orderBy = 'l.daily_milk_yield DESC NULLS LAST';
    else if (sortBy === 'distance' && userLat && userLng) orderBy = `earth_distance(ll_to_earth(${+userLat}::float8, ${+userLng}::float8), ll_to_earth(l.latitude::float8, l.longitude::float8)) ASC NULLS LAST`;

    query += ` ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx}`;
    params.push(Math.min(+limit, 50), offset);
    const result = await pool.query(query, params);

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
              l.video_url, l.auction_end_time, l.reserve_price, l.views_count, l.created_at, l.status,
              l.seller_type, l.breeder_verified, l.welfare_attestation,
              u.first_name as seller_name, l.location as seller_location,
              e.name as enterprise_name,
              a.unique_id as animal_unique_id,
              (SELECT COUNT(*) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as bid_count,
              (SELECT MAX(amount) FROM marketplace_bids WHERE listing_id = l.id AND status = 'active') as highest_bid
       FROM marketplace_listings l
       LEFT JOIN users u ON l.seller_id = u.id
       LEFT JOIN enterprises e ON l.enterprise_id = e.id
       LEFT JOIN animals a ON a.id = l.linked_animal_id
       WHERE l.id = $1 AND l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)`, [id]
    );
    return result.rows[0] || null;
  }

  async getPublicStats() {
    const [totals, speciesFacets, categoryFacets] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active_listings,
          COUNT(DISTINCT species) FILTER (WHERE status = 'active' AND species IS NOT NULL) as species_count,
          COUNT(DISTINCT category) FILTER (WHERE status = 'active') as category_count,
          COUNT(DISTINCT seller_id) FILTER (WHERE status = 'active') as seller_count
         FROM marketplace_listings WHERE (admin_approved = true OR admin_approved IS NULL)`
      ),
      pool.query(
        `SELECT species, COUNT(*)::int as count FROM marketplace_listings
         WHERE status = 'active' AND (admin_approved = true OR admin_approved IS NULL) AND species IS NOT NULL
         GROUP BY species ORDER BY count DESC, species ASC`
      ),
      pool.query(
        `SELECT category, COUNT(*)::int as count FROM marketplace_listings
         WHERE status = 'active' AND (admin_approved = true OR admin_approved IS NULL)
         GROUP BY category ORDER BY count DESC, category ASC`
      ),
    ]);
    return {
      ...(totals.rows[0] || {}),
      species_facets: speciesFacets.rows,
      category_facets: categoryFacets.rows,
    };
  }

  // ── Auction Feature Flag ──
  async getAuctionEnabled(): Promise<boolean> {
    try {
      const res = await pool.query(
        `SELECT is_enabled FROM marketplace_monetization_settings WHERE setting_key = 'auction_enabled' LIMIT 1`
      );
      return res.rows[0]?.is_enabled === true;
    } catch { return false; }
  }

  async setAuctionEnabled(enabled: boolean): Promise<void> {
    await pool.query(
      `INSERT INTO marketplace_monetization_settings (setting_key, is_enabled, description, category)
       VALUES ('auction_enabled', $1, 'Enable or disable the auction feature platform-wide', 'feature')
       ON CONFLICT (setting_key) DO UPDATE SET is_enabled = $1, updated_at = NOW()`,
      [enabled]
    );
  }

  // ── Scheduled Maintenance Jobs ──
  async closeExpiredAuctions(): Promise<number> {
    const enabled = await this.getAuctionEnabled();
    if (!enabled) return 0;

    const expired = await pool.query(
      `UPDATE marketplace_listings SET status = 'pending_closure', updated_at = NOW()
       WHERE listing_type = 'auction' AND auction_end_time < NOW() AND status = 'active'
       RETURNING id, seller_id, linked_animal_id, reserve_price, title`
    );

    for (const listing of expired.rows) {
      try {
        const winBid = await pool.query(
          `SELECT * FROM marketplace_bids WHERE listing_id = $1 AND is_winning = true AND status = 'active' ORDER BY amount DESC LIMIT 1`,
          [listing.id]
        );
        const metReserve = winBid.rows[0] && (!listing.reserve_price || +winBid.rows[0].amount >= +listing.reserve_price);
        if (metReserve) {
          // Winner gets a reservation (free classifieds — settlement happens
          // off-platform, then both sides confirm via the deal handshake)
          await pool.query(`UPDATE marketplace_listings SET status = 'active', updated_at = NOW() WHERE id = $1`, [listing.id]);
          await this.createOrder({
            listingId: listing.id,
            buyerId: winBid.rows[0].bidder_id,
            unitPrice: winBid.rows[0].amount,
            quantity: 1,
            systemCall: true,
          });
          await notifySafe(winBid.rows[0].bidder_id, 'marketplace_auction_won', 'You won the auction',
            `You won "${listing.title}" at ${winBid.rows[0].amount}. Contact the seller to complete the deal.`, { listingId: listing.id });
        } else {
          // No winner (or reserve not met): close the auction without destroying the listing
          await pool.query(`UPDATE marketplace_listings SET status = 'expired', updated_at = NOW() WHERE id = $1`, [listing.id]);
          await notifySafe(listing.seller_id, 'marketplace_auction_closed', 'Auction ended without a sale',
            winBid.rows[0] ? `"${listing.title}" ended below your reserve price.` : `"${listing.title}" ended with no bids.`, { listingId: listing.id });
        }
      } catch (err: any) {
        // Leave the listing recoverable — never destroy data on a job failure
        logger.error('[Marketplace] auction close failed for listing', { listingId: listing.id, error: err.message });
        await pool.query(`UPDATE marketplace_listings SET status = 'expired', updated_at = NOW() WHERE id = $1`, [listing.id]);
      }
    }
    return expired.rows.length;
  }

  async expireListings(): Promise<number> {
    const result = await pool.query(
      `UPDATE marketplace_listings SET status = 'expired', updated_at = NOW()
       WHERE expires_at IS NOT NULL AND expires_at < NOW() AND status = 'active'
       RETURNING id`
    );
    return result.rows.length;
  }

  async expireBoosts(): Promise<number> {
    const result = await pool.query(
      `UPDATE listing_boosts SET is_active = false WHERE expires_at < NOW() AND is_active = true RETURNING listing_id`
    );
    // Reset featured/tier flags for listings whose boosts expired and have no active boost
    for (const row of result.rows) {
      const stillBoosted = await pool.query(
        `SELECT 1 FROM listing_boosts WHERE listing_id = $1 AND is_active = true LIMIT 1`, [row.listing_id]
      );
      if (!stillBoosted.rows[0]) {
        await pool.query(
          `UPDATE marketplace_listings SET featured = false, updated_at = NOW() WHERE id = $1 AND listing_tier = 'standard'`,
          [row.listing_id]
        );
      }
    }
    return result.rows.length;
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
