/**
 * Marketplace Monetization Service
 * Manages monetization settings, subscription plans, boosts, inquiries, and transactions.
 * All features are disabled by default - admin toggles them on when ready.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import NotificationService from './NotificationService';
import logger from '../utils/logger';

async function notifySafe(userId: string, type: string, title: string, message: string, metadata?: Record<string, any>) {
  try {
    await NotificationService.createNotification(userId, type, title, message, 'in_app', metadata);
  } catch (err: any) {
    logger.warn('[MarketplaceMonetization] notification failed', { userId, type, error: err.message });
  }
}

class MarketplaceMonetizationService {

  // ══════════════════════════════════════════
  // Monetization Settings (Admin)
  // ══════════════════════════════════════════

  async getAllSettings() {
    const result = await pool.query(
      `SELECT id, setting_key AS "settingKey", setting_value AS "settingValue",
              is_enabled AS "isEnabled", description, category,
              updated_at AS "updatedAt"
       FROM marketplace_monetization_settings
       ORDER BY category, setting_key`
    );
    return result.rows;
  }

  async getSetting(key: string) {
    const result = await pool.query(
      `SELECT id, setting_key AS "settingKey", setting_value AS "settingValue",
              is_enabled AS "isEnabled", description, category
       FROM marketplace_monetization_settings WHERE setting_key = $1`,
      [key]
    );
    return result.rows[0] || null;
  }

  async updateSetting(key: string, data: { settingValue?: any; isEnabled?: boolean }, updatedBy: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.settingValue !== undefined) {
      fields.push(`setting_value = $${idx++}::jsonb`);
      params.push(JSON.stringify(data.settingValue));
    }
    if (data.isEnabled !== undefined) {
      fields.push(`is_enabled = $${idx++}`);
      params.push(data.isEnabled);
    }
    fields.push(`updated_by = $${idx++}`);
    params.push(updatedBy);
    fields.push(`updated_at = NOW()`);

    params.push(key);
    const result = await pool.query(
      `UPDATE marketplace_monetization_settings SET ${fields.join(', ')} WHERE setting_key = $${idx}
       RETURNING id, setting_key AS "settingKey", setting_value AS "settingValue",
                 is_enabled AS "isEnabled", description, category, updated_at AS "updatedAt"`,
      params
    );
    return result.rows[0];
  }

  // ══════════════════════════════════════════
  // Subscription Plans
  // ══════════════════════════════════════════

  async listPlans(includeInactive = false) {
    const query = includeInactive
      ? `SELECT * FROM marketplace_plans ORDER BY sort_order`
      : `SELECT * FROM marketplace_plans WHERE is_active = true ORDER BY sort_order`;
    const result = await pool.query(query);
    return result.rows;
  }

  async getPlan(id: string) {
    const result = await pool.query(`SELECT * FROM marketplace_plans WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async createPlan(data: any) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO marketplace_plans (id, name, description, price, currency, duration_days, features, max_listings, max_boosts_per_month, priority_support, analytics_access, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [id, data.name, data.description || '', data.price || 0, data.currency || 'INR', data.durationDays || 30,
       JSON.stringify(data.features || {}), data.maxListings || null, data.maxBoostsPerMonth || 0,
       data.prioritySupport || false, data.analyticsAccess || false, data.isActive ?? false, data.sortOrder || 0]
    );
    return result.rows[0];
  }

  async updatePlan(id: string, data: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); params.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }
    if (data.price !== undefined) { fields.push(`price = $${idx++}`); params.push(data.price); }
    if (data.durationDays !== undefined) { fields.push(`duration_days = $${idx++}`); params.push(data.durationDays); }
    if (data.features !== undefined) { fields.push(`features = $${idx++}::jsonb`); params.push(JSON.stringify(data.features)); }
    if (data.maxListings !== undefined) { fields.push(`max_listings = $${idx++}`); params.push(data.maxListings); }
    if (data.maxBoostsPerMonth !== undefined) { fields.push(`max_boosts_per_month = $${idx++}`); params.push(data.maxBoostsPerMonth); }
    if (data.prioritySupport !== undefined) { fields.push(`priority_support = $${idx++}`); params.push(data.prioritySupport); }
    if (data.analyticsAccess !== undefined) { fields.push(`analytics_access = $${idx++}`); params.push(data.analyticsAccess); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); params.push(data.isActive); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${idx++}`); params.push(data.sortOrder); }
    fields.push(`updated_at = NOW()`);

    if (fields.length <= 1) return this.getPlan(id);

    params.push(id);
    const result = await pool.query(
      `UPDATE marketplace_plans SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0];
  }

  async deletePlan(id: string) {
    await pool.query(`DELETE FROM marketplace_plans WHERE id = $1`, [id]);
    return { deleted: true };
  }

  // ══════════════════════════════════════════
  // Inquiries & Contact Tracking
  // ══════════════════════════════════════════

  async createInquiry(listingId: string, buyerId: string, message: string) {
    // Get the listing to find seller
    const listing = await pool.query(`SELECT seller_id FROM marketplace_listings WHERE id = $1`, [listingId]);
    if (!listing.rows[0]) throw new Error('Listing not found');
    const sellerId = listing.rows[0].seller_id;

    if (buyerId === sellerId) throw new Error('Cannot inquire on your own listing');

    // Check if inquiry fee is enabled
    const setting = await this.getSetting('inquiry_fee');
    const isEnabled = setting?.isEnabled;
    const feeConfig = setting?.settingValue || { per_inquiry: 0, free_daily_limit: 50 };

    let feeCharged = 0;
    if (isEnabled && feeConfig.per_inquiry > 0) {
      // Check daily free limit
      const today = await pool.query(
        `SELECT COUNT(*) as cnt FROM marketplace_inquiries
         WHERE buyer_id = $1 AND created_at >= CURRENT_DATE`,
        [buyerId]
      );
      if (parseInt(today.rows[0].cnt) >= feeConfig.free_daily_limit) {
        feeCharged = feeConfig.per_inquiry;
      }
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO marketplace_inquiries (id, listing_id, buyer_id, seller_id, message, fee_charged)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, listingId, buyerId, sellerId, message, feeCharged]
    );

    if (feeCharged > 0) {
      await this.logTransaction(buyerId, 'inquiry_fee', feeCharged, 'INR', id, 'inquiry');
    }

    const listingTitle = (await pool.query(`SELECT title FROM marketplace_listings WHERE id = $1`, [listingId])).rows[0]?.title || '';
    await notifySafe(sellerId, 'marketplace_inquiry', 'New inquiry on your listing',
      `A buyer is interested in "${listingTitle}". Respond to share your contact details.`, { listingId, inquiryId: id });

    return result.rows[0];
  }

  async listInquiries(userId: string, role: 'buyer' | 'seller' = 'buyer') {
    const field = role === 'buyer' ? 'buyer_id' : 'seller_id';
    const result = await pool.query(
      `SELECT i.*, l.title AS "listingTitle", l.price AS "listingPrice",
              u.first_name || ' ' || u.last_name AS "otherPartyName"
       FROM marketplace_inquiries i
       JOIN marketplace_listings l ON i.listing_id = l.id
       JOIN users u ON u.id = ${role === 'buyer' ? 'i.seller_id' : 'i.buyer_id'}
       WHERE i.${field} = $1
       ORDER BY i.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async respondToInquiry(inquiryId: string, sellerId: string, revealContact: boolean) {
    const result = await pool.query(
      `UPDATE marketplace_inquiries
       SET status = 'responded', contact_revealed = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND seller_id = $3
       RETURNING *`,
      [revealContact, inquiryId, sellerId]
    );
    const inquiry = result.rows[0];
    if (inquiry) {
      const listingTitle = (await pool.query(`SELECT title FROM marketplace_listings WHERE id = $1`, [inquiry.listing_id])).rows[0]?.title || '';
      await notifySafe(inquiry.buyer_id, 'marketplace_inquiry_response', 'Seller responded to your inquiry',
        revealContact
          ? `The seller of "${listingTitle}" shared their contact details - open the listing to connect.`
          : `The seller of "${listingTitle}" responded to your inquiry.`,
        { listingId: inquiry.listing_id, inquiryId });
    }
    return inquiry;
  }

  // ══════════════════════════════════════════
  // Transactions & Revenue
  // ══════════════════════════════════════════

  private async logTransaction(userId: string, type: string, amount: number, currency: string, referenceId: string, referenceType: string) {
    await pool.query(
      `INSERT INTO marketplace_transactions (id, user_id, transaction_type, amount, currency, status, reference_id, reference_type)
       VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)`,
      [uuidv4(), userId, type, amount, currency, referenceId, referenceType]
    );
  }

  async getRevenueDashboard() {
    const [totalRevenue, revenueByType, recentTransactions, subscriptionStats, boostStats, inquiryStats] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM marketplace_transactions WHERE status = 'completed'`),
      pool.query(`SELECT transaction_type AS type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM marketplace_transactions WHERE status = 'completed' GROUP BY transaction_type`),
      pool.query(`SELECT t.*, u.first_name || ' ' || u.last_name AS "userName" FROM marketplace_transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 20`),
      pool.query(`SELECT status, COUNT(*) AS count FROM marketplace_subscriptions GROUP BY status`),
      pool.query(`SELECT boost_type, COUNT(*) AS count, COALESCE(SUM(price_paid), 0) AS revenue FROM listing_boosts GROUP BY boost_type`),
      pool.query(`SELECT COUNT(*) AS total, COALESCE(SUM(fee_charged), 0) AS revenue FROM marketplace_inquiries`),
    ]);

    return {
      totalRevenue: totalRevenue.rows[0],
      revenueByType: revenueByType.rows,
      recentTransactions: recentTransactions.rows,
      subscriptionStats: subscriptionStats.rows,
      boostStats: boostStats.rows,
      inquiryStats: inquiryStats.rows[0],
    };
  }
}

export default new MarketplaceMonetizationService();
