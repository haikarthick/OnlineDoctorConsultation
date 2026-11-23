import database from '../utils/database';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Feed Inventory = what feed the farm has in store and what it costs (migration 063). It is NOT where feed given is
 * recorded: that is Daily records only (FarmRecordService), which takes the feed out of stock through `takeFromStock`
 * here. Reports read the one table of feed given, farm_daily_records.
 *
 * A stock item can name the library feed it is (`ingredient_id`), so nutrition rations take its price and
 * composition from it. Stock kept in bags / bales / litres says how many kg one of them is (`kg_per_unit`), so the
 * farmer always records feed in kg.
 */

const WEIGHT_KG: Record<string, number> = { kg: 1, g: 0.001, ton: 1000, lb: 0.45359237 };
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export const FEED_GIVEN_MOVED_MESSAGE =
  'Feed given is now recorded in one place: Daily records. Open Daily records, choose the animal, group or "All my animals", tap Feed and pick the feed - it is taken out of stock automatically.';

/** kg in one stock unit: a weight unit converts itself; a bag / bale / litre needs the farmer's figure. */
export function kgPerUnit(feed: { unit?: string | null; kg_per_unit?: unknown }): number | null {
  const own = num(feed.kg_per_unit);
  if (own && own > 0) return own;
  return WEIGHT_KG[String(feed.unit || '').toLowerCase()] ?? null;
}

class FeedInventoryService {

  // ── Stock items ──
  private checkItem(data: any, creating: boolean) {
    if (creating && !String(data.feedName || '').trim()) throw new ValidationError('Give the feed a name, as you call it on the farm.');
    const unit = data.unit === undefined ? undefined : String(data.unit || 'kg').toLowerCase();
    const perUnit = num(data.kgPerUnit);
    if (perUnit !== null && perUnit <= 0) throw new ValidationError('How many kg one unit weighs must be more than zero.');
    if (unit && !WEIGHT_KG[unit] && creating && perUnit === null) {
      throw new ValidationError(`Say how many kg one ${unit} weighs, so feed recorded in kg can be taken out of stock.`);
    }
    for (const [key, label] of [['currentStock', 'Stock'], ['minimumStock', 'Minimum stock'], ['costPerUnit', 'Price']] as const) {
      const v = num(data[key]);
      if (v !== null && v < 0) throw new ValidationError(`${label} cannot be below zero.`);
    }
  }

  async createFeed(enterpriseId: string, data: any): Promise<any> {
    this.checkItem(data, true);
    const ingredientId = await this.checkIngredient(data.ingredientId);
    const unit = String(data.unit || 'kg').toLowerCase();
    const result = await database.query(
      `INSERT INTO feed_inventory (enterprise_id, location_id, feed_name, feed_type, brand, unit, kg_per_unit,
        current_stock, minimum_stock, cost_per_unit, supplier, batch_number, expiry_date, storage_location, ingredient_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [enterpriseId, data.locationId || null, String(data.feedName).trim().slice(0, 200), data.feedType || 'grain',
       data.brand || null, unit, num(data.kgPerUnit) ?? WEIGHT_KG[unit] ?? null, num(data.currentStock) ?? 0, num(data.minimumStock) ?? 0,
       num(data.costPerUnit) ?? 0, data.supplier || null, data.batchNumber || null,
       data.expiryDate || null, data.storageLocation || null, ingredientId]
    );
    return this.getFeed(result.rows[0].id);
  }

  async updateFeed(id: string, data: any): Promise<any> {
    this.checkItem(data, false);
    const ingredientId = data.ingredientId === undefined ? undefined : await this.checkIngredient(data.ingredientId);
    await database.query(
      `UPDATE feed_inventory SET
        feed_name = COALESCE($2, feed_name), feed_type = COALESCE($3, feed_type),
        brand = COALESCE($4, brand), unit = COALESCE($5, unit), kg_per_unit = COALESCE($6, kg_per_unit),
        current_stock = COALESCE($7, current_stock), minimum_stock = COALESCE($8, minimum_stock),
        cost_per_unit = COALESCE($9, cost_per_unit), supplier = COALESCE($10, supplier),
        batch_number = COALESCE($11, batch_number), expiry_date = COALESCE($12, expiry_date),
        storage_location = COALESCE($13, storage_location),
        ingredient_id = CASE WHEN $14::boolean THEN $15::uuid ELSE ingredient_id END,
        updated_at = NOW()
       WHERE id = $1`,
      [id, data.feedName ? String(data.feedName).trim().slice(0, 200) : null, data.feedType || null, data.brand ?? null,
       data.unit ? String(data.unit).toLowerCase() : null, num(data.kgPerUnit), num(data.currentStock), num(data.minimumStock),
       num(data.costPerUnit), data.supplier ?? null, data.batchNumber ?? null, data.expiryDate || null, data.storageLocation ?? null,
       ingredientId !== undefined, ingredientId ?? null]
    );
    return this.getFeed(id);
  }

  /** A shared library feed (or none). A farm can only link the shared library, not another farm's own feed. */
  private async checkIngredient(id: unknown): Promise<string | null> {
    if (!id) return null;
    const r = await database.query(
      `SELECT id FROM nutrition_ingredients WHERE id = $1 AND is_active = true AND owner_id IS NULL AND enterprise_id IS NULL`, [id]);
    if (!r.rows[0]) throw new ValidationError('Choose what the feed is from the list.');
    return r.rows[0].id;
  }

  /** The farm an item belongs to (for the access check), or not found. */
  async enterpriseOf(id: string): Promise<string> {
    const r = await database.query(`SELECT enterprise_id FROM feed_inventory WHERE id = $1 AND is_active = true`, [id]);
    if (!r.rows[0]) throw new NotFoundError('Feed');
    return r.rows[0].enterprise_id;
  }

  async getFeed(id: string): Promise<any> {
    const r = await database.query(
      `SELECT fi.*, l.name AS location_name, ni.label AS ingredient_label
         FROM feed_inventory fi
         LEFT JOIN locations l ON l.id = fi.location_id
         LEFT JOIN nutrition_ingredients ni ON ni.id = fi.ingredient_id
        WHERE fi.id = $1`, [id]);
    if (!r.rows[0]) throw new NotFoundError('Feed');
    return this.mapFeed(r.rows[0]);
  }

  async listFeeds(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT fi.*, l.name AS location_name, ni.label AS ingredient_label
         FROM feed_inventory fi
         LEFT JOIN locations l ON l.id = fi.location_id
         LEFT JOIN nutrition_ingredients ni ON ni.id = fi.ingredient_id
        WHERE fi.enterprise_id = $1 AND fi.is_active = true ORDER BY fi.feed_name`, [enterpriseId]
    );
    return { items: result.rows.map((r: any) => this.mapFeed(r)) };
  }

  /** The shared feed library a stock item can say it is (feeds, not pet foods). */
  async library(): Promise<any> {
    const r = await database.query(
      `SELECT id, code, label, label_key, label_hi, label_kn, label_ml, label_ta, label_te, kind
         FROM nutrition_ingredients
        WHERE owner_id IS NULL AND enterprise_id IS NULL AND is_active = true AND status <> 'retired'
          AND kind IN ('forage', 'concentrate', 'compound_feed', 'mineral', 'supplement', 'aqua_feed')
        ORDER BY kind, label`);
    return {
      items: r.rows.map((x: any) => ({
        id: x.id, code: x.code, label: x.label, labelKey: x.label_key, labelHi: x.label_hi, labelKn: x.label_kn,
        labelMl: x.label_ml, labelTa: x.label_ta, labelTe: x.label_te, kind: x.kind,
      })),
    };
  }

  /**
   * A purchase: stock goes up, the price paid becomes the item's price, and - when a price is given - the expense is
   * written to the farm's finances once, here (owner decision 2026-11-23: each rupee entered once).
   */
  async restock(id: string, input: { quantity: number; pricePerUnit?: number | null; supplier?: string | null }, userId: string): Promise<any> {
    const qty = num(input.quantity);
    if (qty === null || qty <= 0) throw new ValidationError('How much did you buy? Enter a number above zero.');
    const price = num(input.pricePerUnit);
    if (price !== null && price < 0) throw new ValidationError('The price cannot be below zero.');
    await database.transaction(async (client: any) => {
      const r = await client.query(
        `UPDATE feed_inventory SET current_stock = current_stock + $2, cost_per_unit = COALESCE($3, cost_per_unit),
                supplier = COALESCE($4, supplier), last_restocked_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND is_active = true RETURNING enterprise_id, feed_name, unit`,
        [id, qty, price, input.supplier || null]
      );
      const f = r.rows[0];
      if (!f) throw new NotFoundError('Feed');
      if (price !== null && price > 0) {
        const cur = await client.query(`SELECT value FROM system_settings WHERE key = 'payment.currency'`);
        await client.query(
          `INSERT INTO financial_records (enterprise_id, record_type, category, description, amount, currency, transaction_date,
                                          reference_id, reference_type, recorded_by, vendor)
           VALUES ($1, 'expense', 'feed', $2, $3, $4, CURRENT_DATE, $5, 'feed_restock', $6, $7)`,
          [f.enterprise_id, `${f.feed_name}: ${qty} ${f.unit}`.slice(0, 500), Math.round(qty * price * 100) / 100,
           String(cur.rows[0]?.value || 'INR').slice(0, 3), id, userId, input.supplier || null]
        );
      }
    });
    return this.getFeed(id);
  }

  async deleteFeed(id: string): Promise<void> {
    await database.query(`UPDATE feed_inventory SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  /**
   * Called by FarmRecordService inside its transaction when feed given is saved, changed or deleted: converts kg to the
   * item's unit and moves stock by the difference. Returns the stock units now taken out and the cost of `kg`.
   */
  async takeFromStock(client: any, feedId: string, enterpriseId: string, kg: number, previouslyTaken: number): Promise<{ taken: number; cost: number; unit: string }> {
    const r = await client.query(
      `SELECT id, feed_name, unit, kg_per_unit, cost_per_unit, current_stock FROM feed_inventory
        WHERE id = $1 AND enterprise_id = $2 AND is_active = true FOR UPDATE`, [feedId, enterpriseId]);
    const f = r.rows[0];
    if (!f) throw new ValidationError('That feed is not in this farm\'s stock any more. Choose it again.');
    const per = kgPerUnit(f);
    if (!per) throw new ValidationError(`Say how many kg one ${f.unit} of ${f.feed_name} weighs (Feed Inventory > Edit), so it can be taken out of stock.`);
    const wanted = Math.round((kg / per) * 10000) / 10000;
    const delta = wanted - previouslyTaken;
    // The farm may have fed from a bag that was never entered into stock: the entry is still saved (the animals were fed),
    // stock stops at zero, and what is stored as "taken out" is what REALLY left stock - so deleting or correcting the entry
    // later can never put back more than was taken.
    const have = num(f.current_stock) ?? 0;
    const newStock = Math.max(0, have - delta);
    const reallyMoved = have - newStock;
    if (delta !== 0) {
      await client.query(`UPDATE feed_inventory SET current_stock = $2, updated_at = NOW() WHERE id = $1`, [feedId, newStock]);
    }
    const taken = Math.max(0, Math.round((previouslyTaken + reallyMoved) * 10000) / 10000);
    return { taken, cost: Math.round(wanted * (num(f.cost_per_unit) || 0) * 100) / 100, unit: f.unit };
  }

  /** Puts back what a deleted / changed feed entry had taken out. */
  async returnToStock(client: any, feedId: string, units: number): Promise<void> {
    if (!units) return;
    await client.query(`UPDATE feed_inventory SET current_stock = current_stock + $2, updated_at = NOW() WHERE id = $1`, [feedId, units]);
  }

  // ── Feed given (read from Daily records - the one place it is recorded) ──
  /** Stock value, low stock, and feed given over the last 30 days by type and by day - all from the one record. */
  async getFeedAnalytics(enterpriseId: string): Promise<any> {
    const [lowStock, byType, byDay, value, otherUnits] = await Promise.all([
      database.query(
        `SELECT fi.*, ni.label AS ingredient_label FROM feed_inventory fi LEFT JOIN nutrition_ingredients ni ON ni.id = fi.ingredient_id
          WHERE fi.enterprise_id = $1 AND fi.is_active = true AND fi.current_stock <= fi.minimum_stock`, [enterpriseId]),
      database.query(
        `SELECT COALESCE(fi.feed_type, 'home_grown') AS feed_type, SUM(CASE WHEN r.unit = 'kg' THEN r.quantity ELSE 0 END) AS total_kg, SUM(COALESCE(r.cost, 0)) AS total_cost
           FROM farm_daily_records r LEFT JOIN feed_inventory fi ON fi.id = r.feed_id
          WHERE r.enterprise_id = $1 AND r.record_type = 'feed' AND r.record_date > CURRENT_DATE - 30
          GROUP BY 1 ORDER BY total_cost DESC, total_kg DESC`, [enterpriseId]),
      database.query(
        `SELECT r.record_date::text AS day, SUM(CASE WHEN r.unit = 'kg' THEN r.quantity ELSE 0 END) AS total_kg, SUM(COALESCE(r.cost, 0)) AS total_cost
           FROM farm_daily_records r
          WHERE r.enterprise_id = $1 AND r.record_type = 'feed' AND r.record_date > CURRENT_DATE - 30
          GROUP BY r.record_date ORDER BY r.record_date`, [enterpriseId]),
      database.query(
        `SELECT COALESCE(SUM(current_stock * cost_per_unit), 0) AS total_value FROM feed_inventory WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]),
      // Feed recorded in a unit that is not a weight (an old log in bags with no kg per bag): never dropped from the report, listed by its own unit.
      database.query(
        `SELECT r.unit, SUM(r.quantity) AS quantity FROM farm_daily_records r
          WHERE r.enterprise_id = $1 AND r.record_type = 'feed' AND r.unit IS NOT NULL AND r.unit <> 'kg' AND r.record_date > CURRENT_DATE - 30
          GROUP BY r.unit ORDER BY r.unit`, [enterpriseId]),
    ]);
    return {
      totalInventoryValue: num(value.rows[0]?.total_value) || 0,
      lowStockAlerts: lowStock.rows.map((r: any) => this.mapFeed(r)),
      consumptionByType: byType.rows.map((r: any) => ({ feedType: r.feed_type, totalKg: num(r.total_kg) || 0, totalCost: num(r.total_cost) || 0 })),
      otherUnits: (otherUnits?.rows || []).map((r: any) => ({ unit: r.unit, quantity: num(r.quantity) || 0 })),
      dailyConsumptionTrend: byDay.rows.map((r: any) => ({ day: r.day, totalKg: num(r.total_kg) || 0, totalCost: num(r.total_cost) || 0 })),
    };
  }

  mapFeed(row: any): any {
    if (!row) return null;
    const stock = num(row.current_stock) || 0;
    const per = kgPerUnit(row);
    return {
      id: row.id, enterpriseId: row.enterprise_id, locationId: row.location_id,
      feedName: row.feed_name, feedType: row.feed_type, brand: row.brand,
      unit: row.unit, kgPerUnit: num(row.kg_per_unit), currentStock: stock, stockKg: per ? Math.round(stock * per * 10) / 10 : null,
      minimumStock: num(row.minimum_stock) || 0, costPerUnit: num(row.cost_per_unit) || 0,
      costPerKg: per && num(row.cost_per_unit) ? Math.round((Number(row.cost_per_unit) / per) * 100) / 100 : null,
      supplier: row.supplier, batchNumber: row.batch_number, expiryDate: row.expiry_date,
      storageLocation: row.storage_location, ingredientId: row.ingredient_id || null, ingredientLabel: row.ingredient_label || null,
      isActive: row.is_active, lastRestockedAt: row.last_restocked_at, isLow: stock <= (num(row.minimum_stock) || 0),
      createdAt: row.created_at, updatedAt: row.updated_at, locationName: row.location_name,
    };
  }
}

export default new FeedInventoryService();
