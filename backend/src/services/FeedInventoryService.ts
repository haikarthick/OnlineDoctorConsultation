import database from '../utils/database';
import logger from '../utils/logger';

class FeedInventoryService {

  // ── Feed Items ──
  async createFeed(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO feed_inventory (enterprise_id, location_id, feed_name, feed_type, brand, unit,
        current_stock, minimum_stock, cost_per_unit, supplier, batch_number, expiry_date, storage_location, nutritional_info)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [data.enterpriseId, data.locationId || null, data.feedName, data.feedType || 'grain',
       data.brand || null, data.unit || 'kg', data.currentStock || 0, data.minimumStock || 0,
       data.costPerUnit || 0, data.supplier || null, data.batchNumber || null,
       data.expiryDate || null, data.storageLocation || null, data.nutritionalInfo ? JSON.stringify(data.nutritionalInfo) : null]
    );
    return this.mapFeed(result.rows[0]);
  }

  async updateFeed(id: string, data: any): Promise<any> {
    const result = await database.query(
      `UPDATE feed_inventory SET
        feed_name = COALESCE($2, feed_name), feed_type = COALESCE($3, feed_type),
        brand = COALESCE($4, brand), unit = COALESCE($5, unit),
        current_stock = COALESCE($6, current_stock), minimum_stock = COALESCE($7, minimum_stock),
        cost_per_unit = COALESCE($8, cost_per_unit), supplier = COALESCE($9, supplier),
        batch_number = COALESCE($10, batch_number), expiry_date = COALESCE($11, expiry_date),
        storage_location = COALESCE($12, storage_location),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.feedName, data.feedType, data.brand, data.unit, data.currentStock,
       data.minimumStock, data.costPerUnit, data.supplier, data.batchNumber,
       data.expiryDate, data.storageLocation]
    );
    return this.mapFeed(result.rows[0]);
  }

  async listFeeds(enterpriseId: string): Promise<any> {
    const result = await database.query(
      `SELECT fi.*, l.name as location_name FROM feed_inventory fi
       LEFT JOIN locations l ON l.id = fi.location_id
       WHERE fi.enterprise_id = $1 AND fi.is_active = true ORDER BY fi.feed_name`, [enterpriseId]
    );
    return { items: result.rows.map((r: any) => this.mapFeed(r)) };
  }

  async restock(id: string, quantity: number): Promise<any> {
    const result = await database.query(
      `UPDATE feed_inventory SET current_stock = current_stock + $2, last_restocked_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`, [id, quantity]
    );
    return this.mapFeed(result.rows[0]);
  }

  async deleteFeed(id: string): Promise<void> {
    await database.query(`UPDATE feed_inventory SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  // ── Consumption Logs ──
  async logConsumption(data: any): Promise<any> {
    // Deduct from inventory
    const feedResult = await database.query(`SELECT cost_per_unit, unit FROM feed_inventory WHERE id = $1`, [data.feedId]);
    const costPerUnit = feedResult.rows[0]?.cost_per_unit || 0;
    const cost = parseFloat(costPerUnit) * parseFloat(data.quantity);

    const result = await database.query(
      `INSERT INTO feed_consumption_logs (enterprise_id, feed_id, group_id, location_id, animal_id, quantity, unit, consumption_date, recorded_by, cost, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.enterpriseId, data.feedId, data.groupId || null, data.locationId || null,
       data.animalId || null, data.quantity, data.unit || 'kg',
       data.consumptionDate || new Date().toISOString().split('T')[0],
       data.recordedBy, cost, data.notes || null]
    );

    // Deduct stock
    await database.query(
      `UPDATE feed_inventory SET current_stock = GREATEST(0, current_stock - $2), updated_at = NOW() WHERE id = $1`,
      [data.feedId, data.quantity]
    );

    return this.mapLog(result.rows[0]);
  }

  async listConsumptionLogs(enterpriseId: string, filters: any = {}): Promise<any> {
    const conditions = ['cl.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;
    if (filters.feedId) { conditions.push(`cl.feed_id = $${idx++}`); params.push(filters.feedId); }
    if (filters.fromDate) { conditions.push(`cl.consumption_date >= $${idx++}`); params.push(filters.fromDate); }
    if (filters.toDate) { conditions.push(`cl.consumption_date <= $${idx++}`); params.push(filters.toDate); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 50, 1), 200));
    params.push(Math.max(parseInt(filters.offset) || 0, 0));
    const result = await database.query(
      `SELECT cl.*, fi.feed_name, fi.feed_type, ag.name as group_name,
        u.first_name || ' ' || u.last_name as recorded_by_name
       FROM feed_consumption_logs cl
       LEFT JOIN feed_inventory fi ON fi.id = cl.feed_id
       LEFT JOIN animal_groups ag ON ag.id = cl.group_id
       LEFT JOIN users u ON u.id = cl.recorded_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY cl.consumption_date DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );
    return { items: result.rows.map((r: any) => this.mapLog(r)) };
  }

  /** Feed analytics: consumption by type, cost totals, low stock alerts */
  async getFeedAnalytics(enterpriseId: string): Promise<any> {
    const lowStock = await database.query(
      `SELECT * FROM feed_inventory WHERE enterprise_id = $1 AND is_active = true AND current_stock <= minimum_stock`,
      [enterpriseId]
    );

    const consumptionByType = await database.query(
      `SELECT fi.feed_type, SUM(cl.quantity) as total_quantity, SUM(cl.cost) as total_cost
       FROM feed_consumption_logs cl JOIN feed_inventory fi ON fi.id = cl.feed_id
       WHERE cl.enterprise_id = $1 AND cl.consumption_date > NOW() - INTERVAL '30 days'
       GROUP BY fi.feed_type ORDER BY total_cost DESC`, [enterpriseId]
    );

    const dailyConsumption = await database.query(
      `SELECT consumption_date, SUM(quantity) as total_quantity, SUM(cost) as total_cost
       FROM feed_consumption_logs WHERE enterprise_id = $1 AND consumption_date > NOW() - INTERVAL '30 days'
       GROUP BY consumption_date ORDER BY consumption_date`, [enterpriseId]
    );

    const totalInventoryValue = await database.query(
      `SELECT SUM(current_stock * cost_per_unit) as total_value, COUNT(*) as item_count
       FROM feed_inventory WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]
    );

    return {
      lowStockAlerts: lowStock.rows.map((r: any) => this.mapFeed(r)),
      consumptionByType: consumptionByType.rows,
      dailyConsumption: dailyConsumption.rows,
      inventoryValue: totalInventoryValue.rows[0],
    };
  }

  private mapFeed(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, locationId: row.location_id,
      feedName: row.feed_name, feedType: row.feed_type, brand: row.brand,
      unit: row.unit, currentStock: parseFloat(row.current_stock || 0),
      minimumStock: parseFloat(row.minimum_stock || 0), costPerUnit: parseFloat(row.cost_per_unit || 0),
      supplier: row.supplier, batchNumber: row.batch_number, expiryDate: row.expiry_date,
      storageLocation: row.storage_location, nutritionalInfo: row.nutritional_info,
      isActive: row.is_active, lastRestockedAt: row.last_restocked_at,
      createdAt: row.created_at, updatedAt: row.updated_at, locationName: row.location_name,
    };
  }

  private mapLog(row: any): any {
    if (!row) return null;
    return {
      id: row.id, enterpriseId: row.enterprise_id, feedId: row.feed_id,
      groupId: row.group_id, locationId: row.location_id, animalId: row.animal_id,
      quantity: parseFloat(row.quantity), unit: row.unit,
      consumptionDate: row.consumption_date, recordedBy: row.recorded_by,
      cost: parseFloat(row.cost || 0), notes: row.notes, createdAt: row.created_at,
      feedName: row.feed_name, feedType: row.feed_type, groupName: row.group_name,
      recordedByName: row.recorded_by_name,
    };
  }
}

export default new FeedInventoryService();
