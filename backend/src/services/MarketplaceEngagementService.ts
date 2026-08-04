/**
 * Marketplace Engagement Service (Phase 3)
 * Buyer<->seller messaging threads, favorites/watchlist, and saved searches
 * with new-listing alerts. All free - no payment touches this module.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import NotificationService from './NotificationService';
import logger from '../utils/logger';
import { emitToUser, emitDataRefresh } from '../utils/socketIO';

async function notifySafe(userId: string, type: string, title: string, message: string, metadata?: Record<string, any>) {
  try {
    await NotificationService.createNotification(userId, type, title, message, 'in_app', metadata);
  } catch (err: any) {
    logger.warn('[MarketplaceEngagement] notification failed', { userId, type, error: err.message });
  }
}

class MarketplaceEngagementService {

  // ══════════════════════════════════════════
  // Messaging threads
  // ══════════════════════════════════════════

  /**
   * Get (or lazily create) the thread between a user and a listing. Only the
   * listing's seller or the initiating buyer may ever access it. A seller
   * cannot open a thread on their own listing without a buyer.
   */
  async getOrCreateThread(listingId: string, userId: string): Promise<any> {
    const listing = (await pool.query('SELECT id, seller_id, title FROM marketplace_listings WHERE id = $1', [listingId])).rows[0];
    if (!listing) throw new Error('Listing not found');
    if (listing.seller_id === userId) throw new Error('You cannot start a conversation on your own listing');

    const existing = await pool.query(
      'SELECT * FROM marketplace_threads WHERE listing_id = $1 AND buyer_id = $2',
      [listingId, userId]
    );
    if (existing.rows[0]) return existing.rows[0];

    const id = uuidv4();
    const inserted = await pool.query(
      `INSERT INTO marketplace_threads (id, listing_id, buyer_id, seller_id, last_message_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [id, listingId, userId, listing.seller_id]
    );
    return inserted.rows[0];
  }

  /** List a user's threads (as buyer and as seller), newest activity first. */
  async listThreads(userId: string) {
    const result = await pool.query(
      `SELECT t.*, l.title AS listing_title, l.images AS listing_images, l.status AS listing_status,
              l.price AS listing_price,
              CASE WHEN t.buyer_id = $1 THEN 'buyer' ELSE 'seller' END AS my_role,
              CASE WHEN t.buyer_id = $1 THEN t.buyer_unread ELSE t.seller_unread END AS my_unread,
              bu.first_name || ' ' || bu.last_name AS buyer_name,
              su.first_name || ' ' || su.last_name AS seller_name
       FROM marketplace_threads t
       JOIN marketplace_listings l ON t.listing_id = l.id
       JOIN users bu ON t.buyer_id = bu.id
       JOIN users su ON t.seller_id = su.id
       WHERE t.buyer_id = $1 OR t.seller_id = $1
       ORDER BY t.last_message_at DESC`,
      [userId]
    );
    return { items: result.rows, total: result.rows.length };
  }

  private async assertThreadParticipant(threadId: string, userId: string) {
    const thread = (await pool.query('SELECT * FROM marketplace_threads WHERE id = $1', [threadId])).rows[0];
    if (!thread) throw new Error('Conversation not found');
    if (thread.buyer_id !== userId && thread.seller_id !== userId) throw new Error('You are not part of this conversation');
    return thread;
  }

  /** Fetch a thread's messages and mark the caller's side as read. */
  async getMessages(threadId: string, userId: string) {
    const thread = await this.assertThreadParticipant(threadId, userId);
    const messages = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name AS sender_name
       FROM marketplace_messages m JOIN users u ON m.sender_id = u.id
       WHERE m.thread_id = $1 ORDER BY m.created_at ASC`,
      [threadId]
    );
    // Clear the caller's unread counter and stamp read_at on inbound messages
    const isBuyer = thread.buyer_id === userId;
    const unreadCol = isBuyer ? 'buyer_unread' : 'seller_unread';
    await pool.query(`UPDATE marketplace_threads SET ${unreadCol} = 0 WHERE id = $1`, [threadId]);
    await pool.query(
      `UPDATE marketplace_messages SET read_at = NOW() WHERE thread_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
      [threadId, userId]
    );
    return { thread, items: messages.rows, total: messages.rows.length };
  }

  /** Send a message; creates the thread if the caller is a buyer opening one. */
  async sendMessage(threadId: string, userId: string, body: string) {
    const trimmed = (body || '').trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    const thread = await this.assertThreadParticipant(threadId, userId);

    const isBuyer = thread.buyer_id === userId;
    const recipientId = isBuyer ? thread.seller_id : thread.buyer_id;
    const recipientUnreadCol = isBuyer ? 'seller_unread' : 'buyer_unread';

    const id = uuidv4();
    const inserted = await pool.query(
      `INSERT INTO marketplace_messages (id, thread_id, sender_id, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, threadId, userId, trimmed]
    );
    await pool.query(
      `UPDATE marketplace_threads
       SET last_message = $2, last_message_at = NOW(), last_sender_id = $3,
           ${recipientUnreadCol} = ${recipientUnreadCol} + 1, updated_at = NOW()
       WHERE id = $1`,
      [threadId, trimmed.slice(0, 200), userId]
    );

    const listingTitle = (await pool.query('SELECT title FROM marketplace_listings WHERE id = $1', [thread.listing_id])).rows[0]?.title || '';
    await notifySafe(recipientId, 'marketplace_message', 'New message', `New message about "${listingTitle}"`, { threadId, listingId: thread.listing_id });
    // Realtime nudge so open chat windows refresh instantly
    emitToUser(recipientId, 'marketplace:message', { threadId, listingId: thread.listing_id });
    emitDataRefresh(recipientId, 'marketplace-messages');

    const withName = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name AS sender_name
       FROM marketplace_messages m JOIN users u ON m.sender_id = u.id WHERE m.id = $1`,
      [id]
    );
    return withName.rows[0] || inserted.rows[0];
  }

  /** Total unread messages across all a user's threads (for a nav badge). */
  async getUnreadCount(userId: string): Promise<number> {
    const res = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN buyer_id = $1 THEN buyer_unread ELSE seller_unread END), 0) AS unread
       FROM marketplace_threads WHERE buyer_id = $1 OR seller_id = $1`,
      [userId]
    );
    return +(res.rows[0]?.unread || 0);
  }

  // ══════════════════════════════════════════
  // Favorites / watchlist
  // ══════════════════════════════════════════

  async addFavorite(userId: string, listingId: string) {
    const listing = (await pool.query('SELECT id FROM marketplace_listings WHERE id = $1', [listingId])).rows[0];
    if (!listing) throw new Error('Listing not found');
    await pool.query(
      `INSERT INTO marketplace_favorites (id, user_id, listing_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [uuidv4(), userId, listingId]
    );
    return { favorited: true };
  }

  async removeFavorite(userId: string, listingId: string) {
    await pool.query('DELETE FROM marketplace_favorites WHERE user_id = $1 AND listing_id = $2', [userId, listingId]);
    return { favorited: false };
  }

  /** The user's saved listings (only ones still visible/approved). */
  async listFavorites(userId: string) {
    const result = await pool.query(
      `SELECT l.*, u.first_name || ' ' || u.last_name AS seller_name,
              f.created_at AS favorited_at
       FROM marketplace_favorites f
       JOIN marketplace_listings l ON f.listing_id = l.id
       LEFT JOIN users u ON l.seller_id = u.id
       WHERE f.user_id = $1 AND l.status NOT IN ('deleted', 'rejected')
             AND (l.admin_approved = true OR l.admin_approved IS NULL OR l.seller_id = $1)
       ORDER BY f.created_at DESC`,
      [userId]
    );
    // Never leak seller contact or moderation fields for others' listings
    for (const row of result.rows) {
      if (row.seller_id !== userId) {
        row.contact_phone = null;
        delete row.admin_notes;
        delete row.rejection_reason;
      }
    }
    return { items: result.rows, total: result.rows.length };
  }

  /** IDs the user has favorited, for hydrating heart icons on cards. */
  async getFavoriteIds(userId: string): Promise<string[]> {
    const result = await pool.query('SELECT listing_id FROM marketplace_favorites WHERE user_id = $1', [userId]);
    return result.rows.map((r: any) => r.listing_id);
  }

  // ══════════════════════════════════════════
  // Saved searches + alerts
  // ══════════════════════════════════════════

  // Only these filter keys are honored - anything else is ignored so a saved
  // search can never smuggle arbitrary SQL fragments into the matcher.
  private static readonly ALLOWED_FILTERS = ['category', 'species', 'breed', 'gender', 'listingType', 'minPrice', 'maxPrice', 'vaccinationStatus', 'search'];

  private sanitizeFilters(filters: any): Record<string, any> {
    const clean: Record<string, any> = {};
    if (filters && typeof filters === 'object') {
      for (const key of MarketplaceEngagementService.ALLOWED_FILTERS) {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') clean[key] = filters[key];
      }
    }
    return clean;
  }

  async listSavedSearches(userId: string) {
    const result = await pool.query(
      `SELECT id, name, filters, alerts_enabled AS "alertsEnabled", last_alerted_at AS "lastAlertedAt", created_at AS "createdAt"
       FROM marketplace_saved_searches WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return { items: result.rows, total: result.rows.length };
  }

  async createSavedSearch(userId: string, name: string, filters: any, alertsEnabled = true) {
    const cnt = await pool.query('SELECT COUNT(*) FROM marketplace_saved_searches WHERE user_id = $1', [userId]);
    if (+cnt.rows[0].count >= 25) throw new Error('You have reached the maximum of 25 saved searches.');
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO marketplace_saved_searches (id, user_id, name, filters, alerts_enabled)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id, name, filters, alerts_enabled AS "alertsEnabled", created_at AS "createdAt"`,
      [id, userId, name, JSON.stringify(this.sanitizeFilters(filters)), alertsEnabled]
    );
    return result.rows[0];
  }

  async updateSavedSearch(id: string, userId: string, data: { name?: string; filters?: any; alertsEnabled?: boolean }) {
    const owned = (await pool.query('SELECT id FROM marketplace_saved_searches WHERE id = $1 AND user_id = $2', [id, userId])).rows[0];
    if (!owned) throw new Error('Saved search not found');
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (data.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(data.name); }
    if (data.filters !== undefined) { sets.push(`filters = $${idx++}::jsonb`); vals.push(JSON.stringify(this.sanitizeFilters(data.filters))); }
    if (data.alertsEnabled !== undefined) { sets.push(`alerts_enabled = $${idx++}`); vals.push(data.alertsEnabled); }
    if (sets.length === 0) return owned;
    sets.push('updated_at = NOW()');
    vals.push(id);
    const result = await pool.query(
      `UPDATE marketplace_saved_searches SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, filters, alerts_enabled AS "alertsEnabled", created_at AS "createdAt"`,
      vals
    );
    return result.rows[0];
  }

  async deleteSavedSearch(id: string, userId: string) {
    await pool.query('DELETE FROM marketplace_saved_searches WHERE id = $1 AND user_id = $2', [id, userId]);
    return { deleted: true };
  }

  /** Build a parameterized WHERE fragment from sanitized saved-search filters. */
  private buildMatchClause(filters: Record<string, any>, params: any[], startIdx: number): string {
    const clauses: string[] = [];
    let idx = startIdx;
    if (filters.category) { clauses.push(`l.category = $${idx++}`); params.push(filters.category); }
    if (filters.species) { clauses.push(`l.species = $${idx++}`); params.push(filters.species); }
    if (filters.breed) { clauses.push(`l.breed ILIKE $${idx++}`); params.push(`%${filters.breed}%`); }
    if (filters.gender) { clauses.push(`l.gender = $${idx++}`); params.push(filters.gender); }
    if (filters.listingType) { clauses.push(`l.listing_type = $${idx++}`); params.push(filters.listingType); }
    if (filters.vaccinationStatus) { clauses.push(`l.vaccination_status = $${idx++}`); params.push(filters.vaccinationStatus); }
    if (filters.minPrice) { clauses.push(`l.price >= $${idx++}`); params.push(filters.minPrice); }
    if (filters.maxPrice) { clauses.push(`l.price <= $${idx++}`); params.push(filters.maxPrice); }
    if (filters.search) { clauses.push(`(l.title ILIKE $${idx} OR l.description ILIKE $${idx} OR l.breed ILIKE $${idx})`); params.push(`%${filters.search}%`); idx++; }
    return clauses.length ? ' AND ' + clauses.join(' AND ') : '';
  }

  // ══════════════════════════════════════════
  // Listing reports (trust & safety)
  // ══════════════════════════════════════════

  async createReport(userId: string, listingId: string, reason: string, details?: string) {
    const listing = (await pool.query('SELECT seller_id FROM marketplace_listings WHERE id = $1', [listingId])).rows[0];
    if (!listing) throw new Error('Listing not found');
    if (listing.seller_id === userId) throw new Error('You cannot report your own listing');
    try {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO marketplace_reports (id, listing_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4, $5)`,
        [id, listingId, userId, reason, details || null]
      );
      return { reported: true, id };
    } catch (err: any) {
      // Partial unique index blocks a second open report from the same user
      if (err.code === '23505') throw new Error('You have already reported this listing - it is under review.');
      throw err;
    }
  }

  async adminListReports(filters: any = {}) {
    const { status } = filters;
    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE r.status = $1`; }
    const result = await pool.query(
      `SELECT r.*, l.title AS listing_title, l.status AS listing_status, l.seller_id,
              u.first_name || ' ' || u.last_name AS reporter_name
       FROM marketplace_reports r
       JOIN marketplace_listings l ON r.listing_id = l.id
       JOIN users u ON r.reporter_id = u.id
       ${where}
       ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.created_at DESC`,
      params
    );
    const counts = await pool.query(`SELECT status, COUNT(*) AS count FROM marketplace_reports GROUP BY status`);
    return { items: result.rows, total: result.rows.length, counts: counts.rows };
  }

  async adminResolveReport(id: string, adminId: string, status: string, resolution?: string) {
    if (!['reviewing', 'actioned', 'dismissed'].includes(status)) throw new Error('Invalid status');
    const report = (await pool.query('SELECT * FROM marketplace_reports WHERE id = $1', [id])).rows[0];
    if (!report) throw new Error('Report not found');
    const isFinal = status === 'actioned' || status === 'dismissed';
    await pool.query(
      `UPDATE marketplace_reports SET status = $1, resolution = $2,
              resolved_by = $3, resolved_at = ${isFinal ? 'NOW()' : 'NULL'}, updated_at = NOW()
       WHERE id = $4`,
      [status, resolution || null, isFinal ? adminId : null, id]
    );
    if (isFinal) {
      await notifySafe(report.reporter_id, 'marketplace_report_resolved', 'Your report was reviewed',
        status === 'actioned'
          ? 'Thanks - we reviewed the listing you reported and took action.'
          : 'Thanks for your report. After review, no action was needed on that listing.',
        { reportId: id });
    }
    return (await pool.query('SELECT * FROM marketplace_reports WHERE id = $1', [id])).rows[0];
  }

  // ══════════════════════════════════════════
  // Interlink / referral config (marketplace is free - these are just links)
  // ══════════════════════════════════════════

  async getConfig() {
    const res = await pool.query(
      `SELECT setting_key, setting_value, is_enabled FROM marketplace_monetization_settings
       WHERE setting_key IN ('treasure_mount', 'transport_referral')`
    );
    const map: Record<string, any> = {};
    for (const r of res.rows) map[r.setting_key] = { enabled: r.is_enabled === true, value: r.setting_value || {} };
    const tm = map['treasure_mount'] || {};
    const tr = map['transport_referral'] || {};
    return {
      treasureMount: { enabled: tm.enabled ?? true, url: (tm.value?.url) || 'https://treasuremount.com' },
      transport: { enabled: tr.enabled ?? false, url: (tr.value?.url) || '' },
    };
  }

  /**
   * Scheduler job: for each alert-enabled saved search, count new public
   * listings created since the last alert and notify the owner. Never alerts a
   * user about their own listings.
   */
  async runSavedSearchAlerts(): Promise<number> {
    const searches = await pool.query(
      `SELECT id, user_id, name, filters, last_alerted_at FROM marketplace_saved_searches WHERE alerts_enabled = true`
    );
    let alertsSent = 0;
    for (const s of searches.rows) {
      try {
        const filters = typeof s.filters === 'string' ? JSON.parse(s.filters) : (s.filters || {});
        const params: any[] = [s.user_id, s.last_alerted_at];
        const matchClause = this.buildMatchClause(filters, params, 3);
        const countRes = await pool.query(
          `SELECT COUNT(*) FROM marketplace_listings l
           WHERE l.status = 'active' AND (l.admin_approved = true OR l.admin_approved IS NULL)
             AND l.seller_id <> $1 AND l.created_at > $2${matchClause}`,
          params
        );
        const newCount = +countRes.rows[0].count;
        // Always advance the watermark so the same listings never re-alert
        await pool.query('UPDATE marketplace_saved_searches SET last_alerted_at = NOW() WHERE id = $1', [s.id]);
        if (newCount > 0) {
          await notifySafe(
            s.user_id, 'marketplace_saved_search',
            'New matches for your saved search',
            `${newCount} new listing${newCount > 1 ? 's' : ''} match "${s.name}".`,
            { savedSearchId: s.id }
          );
          emitDataRefresh(s.user_id, 'marketplace-saved-searches');
          alertsSent++;
        }
      } catch (err: any) {
        logger.error('[MarketplaceEngagement] saved-search alert failed', { savedSearchId: s.id, error: err.message });
      }
    }
    return alertsSent;
  }
}

export default new MarketplaceEngagementService();
