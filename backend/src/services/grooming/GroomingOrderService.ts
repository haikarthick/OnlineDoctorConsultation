import database from '../../utils/database';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import GroomingModuleConfig from './GroomingModuleConfig';
import GroomingProviderService from './GroomingProviderService';

/**
 * Grooming order lifecycle (P2): create → pay → confirmed, plus customer/provider reads and cancel.
 * Self-contained payment path (demo) that mirrors the payment module's commission-snapshot +
 * clearing-earnings pattern but stays SEPARATE from consultation bookings/payments and uses the
 * dedicated grooming_earnings ledger. Real gateway integration layers on later.
 */

const ORDER_SELECT = `
  o.id, o.order_number as "orderNumber", o.pet_owner_id as "petOwnerId", o.animal_id as "animalId",
  o.provider_id as "providerId", o.location_id as "locationId", o.primary_service_id as "primaryServiceId",
  o.service_mode as "serviceMode", o.scheduled_date as "scheduledDate",
  o.time_slot_start as "timeSlotStart", o.time_slot_end as "timeSlotEnd", o.status,
  o.assigned_staff_id as "assignedStaffId", o.assigned_resource_id as "assignedResourceId",
  o.subtotal, o.addons_total as "addonsTotal", o.variable_total as "variableTotal",
  o.discount_total as "discountTotal", o.tax_total as "taxTotal", o.grand_total as "grandTotal",
  o.deposit_due as "depositDue", o.amount_paid as "amountPaid", o.currency,
  o.commission_percent as "commissionPercent", o.commission_amount as "commissionAmount",
  o.handling_notes as "handlingNotes", o.owner_notes as "ownerNotes",
  o.cancellation_reason as "cancellationReason", o.eta_minutes as "etaMinutes",
  o.completed_at as "completedAt", o.created_at as "createdAt", o.updated_at as "updatedAt"
`;

function genOrderNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GRM-${y}-${rand}`;
}

class GroomingOrderService {
  /** Owner of the order, or staff of its provider. */
  private async resolveOrderAccess(userId: string, orderId: string): Promise<{ order: any; isOwner: boolean; providerRole: string | null }> {
    const r = await database.query(`SELECT ${ORDER_SELECT} FROM grooming_orders o WHERE o.id = $1`, [orderId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
    const order = r.rows[0];
    const isOwner = order.petOwnerId === userId;
    const providerRole = isOwner ? null : await GroomingProviderService.resolveProviderAccess(userId, order.providerId);
    if (!isOwner && !providerRole) throw new NotFoundError('GroomingOrder', orderId);
    return { order, isOwner, providerRole };
  }

  async createOrder(userId: string, data: any): Promise<any> {
    if (!data.providerId || !data.serviceId) throw new ValidationError('providerId and serviceId are required');
    if (!data.scheduledDate || !data.timeSlotStart) throw new ValidationError('scheduledDate and timeSlotStart are required');

    const provider = await GroomingProviderService.getProviderById(data.providerId);
    if (provider.verificationStatus !== 'verified' || provider.isPaused) throw new ValidationError('Provider is not available for booking');

    const svcRes = await database.query(
      `SELECT id, base_price, tax_percent, payment_rule, deposit_amount, currency, is_active, is_paused, name
       FROM grooming_services WHERE id = $1 AND provider_id = $2`,
      [data.serviceId, data.providerId]);
    if (svcRes.rows.length === 0) throw new NotFoundError('GroomingService', data.serviceId);
    const svc = svcRes.rows[0];
    if (!svc.is_active || svc.is_paused) throw new ValidationError('Service is not available');

    // Animal (optional) must belong to the customer
    if (data.animalId) {
      const a = await database.query(`SELECT 1 FROM animals WHERE id = $1 AND owner_id = $2`, [data.animalId, userId]);
      if (a.rows.length === 0) throw new ForbiddenError('Animal does not belong to you');
    }

    // ── Pricing (all ex-tax service value, then tax passthrough) ──
    const serviceValue = Number(svc.base_price) || 0;
    const addons: Array<{ name: string; price: number }> = Array.isArray(data.addons)
      ? data.addons.map((x: any) => ({ name: String(x.name || 'Add-on'), price: Number(x.price) || 0 })) : [];
    const addonsTotal = addons.reduce((s, x) => s + x.price, 0);
    const gross = serviceValue + addonsTotal;
    const taxPct = Number(svc.tax_percent) || 0;
    const taxTotal = +(gross * taxPct / 100).toFixed(2);
    const grandTotal = +(gross + taxTotal).toFixed(2);
    const commissionPct = provider.commissionOverridePercent != null
      ? Number(provider.commissionOverridePercent)
      : await GroomingModuleConfig.getCommissionDefaultPercent();
    const flatFee = await GroomingModuleConfig.getCommissionFlatFee();
    const commissionAmount = +((gross * commissionPct / 100) + flatFee).toFixed(2);
    const depositDue = svc.payment_rule === 'deposit' ? (Number(svc.deposit_amount) || 0) : grandTotal;
    const currency = svc.currency || await GroomingModuleConfig.getCurrency();

    const result = await database.query(
      `INSERT INTO grooming_orders
         (order_number, pet_owner_id, animal_id, provider_id, location_id, primary_service_id, service_mode,
          scheduled_date, time_slot_start, subtotal, addons_total, tax_total, grand_total, deposit_due,
          currency, commission_percent, commission_amount, handling_notes, owner_notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'payment_pending')
       RETURNING id`,
      [genOrderNumber(), userId, data.animalId || null, data.providerId, data.locationId || null, data.serviceId,
       data.serviceMode || 'premises', data.scheduledDate, data.timeSlotStart, serviceValue, addonsTotal,
       taxTotal, grandTotal, depositDue, currency, commissionPct, commissionAmount,
       data.handlingNotes || null, data.ownerNotes || null]);
    const orderId = result.rows[0].id;

    // Line items
    await database.query(
      `INSERT INTO grooming_order_items (order_id, service_id, item_type, name, unit_price, tax_percent, line_total)
       VALUES ($1,$2,'service',$3,$4,$5,$6)`,
      [orderId, svc.id, svc.name, serviceValue, taxPct, +(serviceValue * (1 + taxPct / 100)).toFixed(2)]);
    for (const ad of addons) {
      await database.query(
        `INSERT INTO grooming_order_items (order_id, item_type, name, unit_price, tax_percent, line_total)
         VALUES ($1,'addon',$2,$3,$4,$5)`,
        [orderId, ad.name, ad.price, taxPct, +(ad.price * (1 + taxPct / 100)).toFixed(2)]);
    }
    await this.addHistory(orderId, null, 'payment_pending', userId, 'Order created');
    return this.getOrderById(orderId);
  }

  private async addHistory(orderId: string, from: string | null, to: string, userId: string | null, note?: string) {
    await database.query(
      `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES ($1,$2,$3,$4,$5)`, [orderId, from, to, userId, note || null]);
  }

  async getOrderById(orderId: string): Promise<any> {
    const r = await database.query(`SELECT ${ORDER_SELECT} FROM grooming_orders o WHERE o.id = $1`, [orderId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
    const order = r.rows[0];
    const items = await database.query(
      `SELECT id, item_type as "itemType", name, quantity, unit_price as "unitPrice",
              tax_percent as "taxPercent", line_total as "lineTotal", status, approval_status as "approvalStatus"
       FROM grooming_order_items WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]);
    order.items = items.rows;
    return order;
  }

  async getOrder(userId: string, orderId: string): Promise<any> {
    await this.resolveOrderAccess(userId, orderId);
    return this.getOrderById(orderId);
  }

  /** Demo/manual payment: marks the order confirmed, records amount, opens a clearing earning. */
  async payOrder(userId: string, orderId: string, opts?: { deposit?: boolean }): Promise<any> {
    const { order, isOwner } = await this.resolveOrderAccess(userId, orderId);
    if (!isOwner) throw new ForbiddenError('Only the customer can pay for this order');
    if (order.status !== 'payment_pending') throw new ValidationError('Order is not awaiting payment');

    const payAmount = opts?.deposit ? Number(order.depositDue) : Number(order.grandTotal);
    const clearanceDays = await GroomingModuleConfig.getClearanceDays();

    return database.transaction(async (client: any) => {
      await client.query(
        `UPDATE grooming_orders SET status = 'confirmed', amount_paid = $2, updated_at = NOW() WHERE id = $1`,
        [orderId, payAmount]);
      // Provider earning enters the clearing ledger (manual settlement releases it after the window).
      const gross = Number(order.subtotal) + Number(order.addonsTotal);
      const net = +(gross - Number(order.commissionAmount)).toFixed(2);
      await client.query(
        `INSERT INTO grooming_earnings
           (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, available_at)
         VALUES ($1,$2,$3,$4,$5,$6,'earning','clearing', NOW() + ($7 || ' days')::interval)`,
        [order.providerId, orderId, gross, Number(order.commissionAmount), Number(order.taxTotal), net, String(clearanceDays)]);
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'payment_pending','confirmed',$2,'Payment received (demo)')`, [orderId, userId]);
      const r = await client.query(`SELECT ${ORDER_SELECT} FROM grooming_orders o WHERE o.id = $1`, [orderId]);
      return r.rows[0];
    });
  }

  async listMyOrders(userId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT ${ORDER_SELECT}, gp.business_name as "providerName", gs.name as "serviceName"
       FROM grooming_orders o
       JOIN grooming_providers gp ON gp.id = o.provider_id
       LEFT JOIN grooming_services gs ON gs.id = o.primary_service_id
       WHERE o.pet_owner_id = $1 ORDER BY o.created_at DESC`, [userId]);
    return r.rows;
  }

  async listProviderOrders(userId: string, providerId: string, status?: string): Promise<any[]> {
    const role = await GroomingProviderService.resolveProviderAccess(userId, providerId);
    if (!role) throw new NotFoundError('GroomingProvider', providerId);
    const params: any[] = [providerId]; let where = `WHERE o.provider_id = $1`;
    if (status) { params.push(status); where += ` AND o.status = $2`; }
    const r = await database.query(
      `SELECT ${ORDER_SELECT}, gs.name as "serviceName",
              u.first_name as "ownerFirstName", u.last_name as "ownerLastName"
       FROM grooming_orders o
       LEFT JOIN grooming_services gs ON gs.id = o.primary_service_id
       LEFT JOIN users u ON u.id = o.pet_owner_id
       ${where} ORDER BY o.scheduled_date ASC, o.time_slot_start ASC`, params);
    return r.rows;
  }

  async cancelOrder(userId: string, orderId: string, reason: string): Promise<any> {
    const { order, isOwner, providerRole } = await this.resolveOrderAccess(userId, orderId);
    if (['completed', 'closed', 'cancelled_by_customer', 'cancelled_by_provider'].includes(order.status))
      throw new ValidationError('Order can no longer be cancelled');
    const newStatus = isOwner ? 'cancelled_by_customer' : 'cancelled_by_provider';
    void providerRole;
    await database.query(
      `UPDATE grooming_orders SET status = $2, cancellation_reason = $3, cancelled_by = $4, cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1`, [orderId, newStatus, reason || null, userId]);
    // Reverse any clearing earning for this order (nothing settled yet in P2).
    await database.query(
      `UPDATE grooming_earnings SET status = 'reversed', updated_at = NOW()
       WHERE order_id = $1 AND status = 'clearing'`, [orderId]);
    await this.addHistory(orderId, order.status, newStatus, userId, reason || undefined);
    return this.getOrderById(orderId);
  }
}

export default new GroomingOrderService();
