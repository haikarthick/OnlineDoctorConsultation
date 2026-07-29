import database from '../../utils/database';
import logger from '../../utils/logger';
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
  o.deposit_due as "depositDue", o.amount_paid as "amountPaid",
  o.balance_due as "balanceDue", o.currency,
  o.commission_percent as "commissionPercent", o.commission_amount as "commissionAmount",
  o.acceptance_deadline as "acceptanceDeadline", o.accepted_at as "acceptedAt",
  o.declined_at as "declinedAt", o.decline_reason as "declineReason",
  o.handling_notes as "handlingNotes", o.owner_notes as "ownerNotes",
  o.cancellation_reason as "cancellationReason", o.eta_minutes as "etaMinutes",
  o.invoice_number as "invoiceNumber", o.expires_at as "expiresAt",
  o.refund_amount as "refundAmount", o.refund_status as "refundStatus",
  o.refund_destination as "refundDestination", o.refunded_at as "refundedAt",
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

    // Slot-hold window — an unpaid order past this is released by the grooming expiry job.
    const holdMinutes = await GroomingModuleConfig.getHoldMinutes();

    const result = await database.query(
      `INSERT INTO grooming_orders
         (order_number, pet_owner_id, animal_id, provider_id, location_id, primary_service_id, service_mode,
          scheduled_date, time_slot_start, subtotal, addons_total, tax_total, grand_total, deposit_due,
          currency, commission_percent, commission_amount, handling_notes, owner_notes, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'payment_pending',
               NOW() + ($20 || ' minutes')::interval)
       RETURNING id`,
      [genOrderNumber(), userId, data.animalId || null, data.providerId, data.locationId || null, data.serviceId,
       data.serviceMode || 'premises', data.scheduledDate, data.timeSlotStart, serviceValue, addonsTotal,
       taxTotal, grandTotal, depositDue, currency, commissionPct, commissionAmount,
       data.handlingNotes || null, data.ownerNotes || null, String(holdMinutes)]);
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

  // payOrder() was REMOVED with the legacy /pay route: it confirmed an order and credited the
  // provider without collecting a rupee. Payment lives in GroomingPaymentService only.

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
    // declined_by_provider is terminal AND already refunded. Omitting it here let a customer
    // "cancel" a declined booking and run the refund engine a second time on the same payment.
    if (['completed', 'closed', 'cancelled_by_customer', 'cancelled_by_provider', 'declined_by_provider'].includes(order.status))
      throw new ValidationError('Order can no longer be cancelled');
    const newStatus = isOwner ? 'cancelled_by_customer' : 'cancelled_by_provider';
    void providerRole;

    // Cancelling while the provider has not yet accepted is a no-fault exit: the customer is
    // waiting on a commitment that was never made, so the cancellation-window penalties must not
    // apply to them. Anything already accepted follows the normal policy.
    const awaitingAcceptance = order.status === 'pending_provider_acceptance';
    const canceller: 'customer' | 'provider' | 'provider_declined' =
      awaitingAcceptance ? 'provider_declined' : (isOwner ? 'customer' : 'provider');

    await database.query(
      `UPDATE grooming_orders SET status = $2, cancellation_reason = $3, cancelled_by = $4,
              cancelled_at = NOW(), acceptance_deadline = NULL, updated_at = NOW()
       WHERE id = $1`, [orderId, newStatus, reason || null, userId]);
    await this.addHistory(orderId, order.status, newStatus, userId, reason || undefined);

    // Refund + provider-ledger reconciliation (reverses the clearing earning, applies the
    // penalty/compensation entries). Grooming's own engine — see GroomingRefundService's module
    // boundary note; nothing here may reach into the consultation refund path.
    const GroomingRefundService = (await import('./GroomingRefundService')).default;
    await GroomingRefundService.refundForCancellation(
      orderId, canceller,
      reason || (awaitingAcceptance ? 'Cancelled before the provider accepted' : 'Order cancelled'));

    return this.getOrderById(orderId);
  }

  /** What the customer would get back if they cancelled right now (for the cancel dialog). */
  async getRefundPreview(userId: string, orderId: string): Promise<any> {
    const { isOwner } = await this.resolveOrderAccess(userId, orderId);
    const GroomingRefundService = (await import('./GroomingRefundService')).default;
    return GroomingRefundService.computeRefundPreview(orderId, isOwner ? 'customer' : 'provider');
  }

  // ── P3 ops: provider-driven execution workflow ──────────────
  private async requireProviderStaff(userId: string, orderId: string): Promise<{ order: any; providerRole: string }> {
    const { order, providerRole } = await this.resolveOrderAccess(userId, orderId);
    if (!providerRole) throw new ForbiddenError('Provider staff access required');
    return { order, providerRole };
  }

  private static PROVIDER_TRANSITIONS: Record<string, string[]> = {
    // pending_provider_acceptance is deliberately absent: it is left only via acceptOrder() /
    // declineOrder() / the timeout sweep, all of which carry money consequences. Allowing a
    // generic transition out of it would let a provider skip the gate and strand the refund.
    confirmed: ['provider_assigned', 'checked_in', 'en_route', 'in_progress', 'no_show'],
    provider_assigned: ['checked_in', 'en_route', 'in_progress', 'no_show'],
    en_route: ['checked_in', 'in_progress', 'no_show'],
    checked_in: ['intake_done', 'in_progress', 'no_show'],
    intake_done: ['in_progress'],
    in_progress: ['quality_check', 'ready_for_pickup'],
    quality_check: ['ready_for_pickup', 'in_progress'],
    ready_for_pickup: ['completed', 'returning'],
    returning: ['completed'],
  };

  // ── Provider acceptance gate (036) ─────────────────────────────
  /**
   * Provider accepts a paid booking → the appointment is genuinely confirmed.
   *
   * Row is locked and re-checked inside the transaction so an accept racing the timeout sweep
   * (or a double-tap on a phone) resolves to exactly one outcome. Accepting an order the sweep
   * has already refunded must fail rather than "confirm" a refunded booking.
   */
  async acceptOrder(userId: string, orderId: string, note?: string): Promise<any> {
    await this.requireProviderStaff(userId, orderId);
    await database.transaction(async (client: any) => {
      const r = await client.query(
        `SELECT id, status, provider_id FROM grooming_orders WHERE id = $1 FOR UPDATE`, [orderId]);
      if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
      const cur = r.rows[0];
      if (cur.status === 'confirmed') return; // idempotent
      if (cur.status !== 'pending_provider_acceptance')
        throw new ValidationError(`This booking is not awaiting acceptance (it is ${cur.status}).`);

      await client.query(
        `UPDATE grooming_orders SET status = 'confirmed', accepted_at = NOW(), accepted_by = $2,
                acceptance_deadline = NULL, updated_at = NOW() WHERE id = $1`, [orderId, userId]);
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'pending_provider_acceptance','confirmed',$2,$3)`,
        [orderId, userId, note || 'Provider accepted the booking']);
      await client.query(
        `UPDATE grooming_providers SET total_accepted = COALESCE(total_accepted, 0) + 1, updated_at = NOW()
         WHERE id = $1`, [cur.provider_id]);
    });

    const order = await this.getOrderById(orderId);
    try {
      const NotificationService = (await import('../NotificationService')).default;
      await NotificationService.createNotification(
        order.petOwnerId, 'booking', 'Your grooming appointment is confirmed',
        `Good news — your booking ${order.orderNumber} has been confirmed by the groomer. `
        + `We'll remind you before your appointment.`,
        'all', { orderId });
    } catch { /* non-blocking */ }
    return order;
  }

  /**
   * Provider declines a paid booking → full no-fault refund, no penalty to either side.
   *
   * The refund runs AFTER the status write commits, matching cancelOrder(): the refund engine
   * opens its own transaction, so calling it inside this one would nest and deadlock on the
   * same order row.
   */
  async declineOrder(userId: string, orderId: string, reason: string): Promise<any> {
    await this.requireProviderStaff(userId, orderId);
    if (!reason || !reason.trim())
      throw new ValidationError('A reason is required so the customer can be told why.');

    await database.transaction(async (client: any) => {
      const r = await client.query(
        `SELECT id, status, provider_id FROM grooming_orders WHERE id = $1 FOR UPDATE`, [orderId]);
      if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
      const cur = r.rows[0];
      if (cur.status !== 'pending_provider_acceptance')
        throw new ValidationError(`This booking is not awaiting acceptance (it is ${cur.status}).`);

      await client.query(
        `UPDATE grooming_orders SET status = 'declined_by_provider', declined_at = NOW(),
                decline_reason = $2, acceptance_deadline = NULL, updated_at = NOW() WHERE id = $1`,
        [orderId, reason.trim()]);
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'pending_provider_acceptance','declined_by_provider',$2,$3)`,
        [orderId, userId, `Provider declined: ${reason.trim()}`]);
      await client.query(
        `UPDATE grooming_providers SET total_declined = COALESCE(total_declined, 0) + 1, updated_at = NOW()
         WHERE id = $1`, [cur.provider_id]);
    });

    const GroomingRefundService = (await import('./GroomingRefundService')).default;
    await GroomingRefundService.refundForCancellation(
      orderId, 'provider_declined', `Provider declined the booking: ${reason.trim()}`);

    const order = await this.getOrderById(orderId);
    try {
      const NotificationService = (await import('../NotificationService')).default;
      await NotificationService.createNotification(
        order.petOwnerId, 'booking', 'Your grooming booking could not be accepted',
        `Unfortunately the groomer could not take booking ${order.orderNumber} (${reason.trim()}). `
        + `You have not been charged — a full refund is on its way. `
        + `You can book another provider from Find Grooming & Spa.`,
        'all', { orderId });
    } catch { /* non-blocking */ }
    return order;
  }

  /**
   * Sweep bookings whose acceptance window lapsed: full refund to the customer, SLA counter on
   * the provider. Runs from the grooming scheduler — see GroomingPaymentService.expireStaleHolds
   * for the sibling job that releases UNPAID holds.
   *
   * Each order is handled independently so one failure cannot strand the rest of the batch.
   */
  async expireUnacceptedOrders(): Promise<number> {
    if (!(await GroomingModuleConfig.isEnabled())) return 0;
    const due = await database.query(
      `SELECT id, order_number, pet_owner_id, provider_id FROM grooming_orders
       WHERE status = 'pending_provider_acceptance'
         AND acceptance_deadline IS NOT NULL AND acceptance_deadline <= NOW()`);
    if (due.rows.length === 0) return 0;

    const GroomingRefundService = (await import('./GroomingRefundService')).default;
    const NotificationService = (await import('../NotificationService')).default;
    let handled = 0;

    for (const row of due.rows) {
      try {
        // Re-check under a lock: a provider accepting at the deadline must win over the sweep.
        const claimed = await database.query(
          `UPDATE grooming_orders SET status = 'declined_by_provider', declined_at = NOW(),
                  decline_reason = 'Provider did not respond within the acceptance window',
                  acceptance_deadline = NULL, updated_at = NOW()
           WHERE id = $1 AND status = 'pending_provider_acceptance'
           RETURNING id`, [row.id]);
        if (claimed.rows.length === 0) continue;

        await database.query(
          `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
           VALUES ($1,'pending_provider_acceptance','declined_by_provider',NULL,
                   'Acceptance window lapsed — auto-cancelled and refunded')`, [row.id]);
        await database.query(
          `UPDATE grooming_providers
              SET total_acceptance_timeouts = COALESCE(total_acceptance_timeouts, 0) + 1,
                  updated_at = NOW() WHERE id = $1`, [row.provider_id]);

        await GroomingRefundService.refundForCancellation(
          row.id, 'acceptance_timeout', 'Provider did not respond within the acceptance window');

        try {
          await NotificationService.createNotification(
            row.pet_owner_id, 'booking', 'Your grooming booking was cancelled and refunded',
            `The groomer did not confirm booking ${row.order_number} in time, so we've cancelled it `
            + `and refunded you in full. Sorry about that — you can book another provider from `
            + `Find Grooming & Spa.`,
            'all', { orderId: row.id });
        } catch { /* non-blocking */ }
        handled++;
      } catch (err: any) {
        logger.error('Grooming acceptance-timeout sweep failed for one order', { orderId: row.id, error: err.message });
      }
    }
    if (handled > 0) logger.info(`[Grooming] Auto-cancelled ${handled} unaccepted booking(s)`);
    return handled;
  }

  /** Provider advances the order along the workflow. Completion stamps completed_at. */
  async transitionOrder(userId: string, orderId: string, toStatus: string, note?: string): Promise<any> {
    const { order } = await this.requireProviderStaff(userId, orderId);
    const allowed = GroomingOrderService.PROVIDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(toStatus)) throw new ValidationError(`Cannot move from ${order.status} to ${toStatus}`);
    const stampCompleted = toStatus === 'completed';
    // An order cannot be completed while money is still owed on it. This is what makes the
    // balance leg enforceable rather than advisory — approved extras must be collected.
    if (stampCompleted && Number(order.balanceDue || 0) > 0) {
      throw new ValidationError(
        `This order still has ${Number(order.balanceDue).toFixed(2)} outstanding. Collect the balance before completing it.`);
    }
    await database.query(
      `UPDATE grooming_orders SET status = $2, updated_at = NOW()${stampCompleted ? ', completed_at = NOW()' : ''} WHERE id = $1`,
      [orderId, toStatus]);
    await this.addHistory(orderId, order.status, toStatus, userId, note);

    // A no-show closes the money side too: no refund to the customer, but the provider is
    // compensated and the clearing earning is settled rather than left hanging.
    if (toStatus === 'no_show') {
      const GroomingRefundService = (await import('./GroomingRefundService')).default;
      await GroomingRefundService.refundForCancellation(orderId, 'no_show', note || 'Customer did not show up');
    }
    return this.getOrderById(orderId);
  }

  async assignOrder(userId: string, orderId: string, data: { staffId?: string; resourceId?: string; etaMinutes?: number }): Promise<any> {
    await this.requireProviderStaff(userId, orderId);
    const sets: string[] = []; const params: any[] = []; let i = 0;
    if (data.staffId !== undefined) { i++; sets.push(`assigned_staff_id = $${i}`); params.push(data.staffId || null); }
    if (data.resourceId !== undefined) { i++; sets.push(`assigned_resource_id = $${i}`); params.push(data.resourceId || null); }
    if (data.etaMinutes !== undefined) { i++; sets.push(`eta_minutes = $${i}`); params.push(data.etaMinutes ?? null); }
    if (sets.length === 0) return this.getOrderById(orderId);
    i++; params.push(orderId);
    await database.query(`UPDATE grooming_orders SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`, params);
    return this.getOrderById(orderId);
  }

  /** Upsert intake + S.C.E.N.T. wellness (non-medical, observational). */
  async saveIntake(userId: string, orderId: string, data: any): Promise<any> {
    await this.requireProviderStaff(userId, orderId);
    const scent = ['skin', 'coat', 'ears', 'nails', 'teeth'];
    for (const k of scent) {
      const v = data[`scent${k[0].toUpperCase()}${k.slice(1)}`];
      if (v != null && !['good', 'watch', 'vet_advised'].includes(v)) throw new ValidationError(`Invalid S.C.E.N.T. value for ${k}`);
    }
    await database.query(
      `INSERT INTO grooming_intake
         (order_id, recorded_by, arrival_condition, temperament, owner_instructions, allergies, handling_restrictions,
          scent_skin, scent_coat, scent_ears, scent_nails, scent_teeth, scent_notes, before_photos,
          consent_handling, consent_products, consent_photography, consent_emergency_contact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (order_id) DO UPDATE SET
         recorded_by = EXCLUDED.recorded_by, arrival_condition = EXCLUDED.arrival_condition,
         temperament = EXCLUDED.temperament, owner_instructions = EXCLUDED.owner_instructions,
         allergies = EXCLUDED.allergies, handling_restrictions = EXCLUDED.handling_restrictions,
         scent_skin = EXCLUDED.scent_skin, scent_coat = EXCLUDED.scent_coat, scent_ears = EXCLUDED.scent_ears,
         scent_nails = EXCLUDED.scent_nails, scent_teeth = EXCLUDED.scent_teeth, scent_notes = EXCLUDED.scent_notes,
         before_photos = EXCLUDED.before_photos, consent_handling = EXCLUDED.consent_handling,
         consent_products = EXCLUDED.consent_products, consent_photography = EXCLUDED.consent_photography,
         consent_emergency_contact = EXCLUDED.consent_emergency_contact, updated_at = NOW()`,
      [orderId, userId, data.arrivalCondition || null, data.temperament || null, data.ownerInstructions || null,
       data.allergies || null, data.handlingRestrictions || null,
       data.scentSkin || null, data.scentCoat || null, data.scentEars || null, data.scentNails || null, data.scentTeeth || null,
       data.scentNotes || null, Array.isArray(data.beforePhotos) ? data.beforePhotos : [],
       data.consentHandling === true, data.consentProducts === true, data.consentPhotography === true, data.consentEmergencyContact === true]);
    return this.getIntake(userId, orderId);
  }

  async getIntake(userId: string, orderId: string): Promise<any | null> {
    await this.resolveOrderAccess(userId, orderId); // owner or provider staff may view
    const r = await database.query(
      `SELECT order_id as "orderId", arrival_condition as "arrivalCondition", temperament,
              owner_instructions as "ownerInstructions", allergies, handling_restrictions as "handlingRestrictions",
              scent_skin as "scentSkin", scent_coat as "scentCoat", scent_ears as "scentEars",
              scent_nails as "scentNails", scent_teeth as "scentTeeth", scent_notes as "scentNotes",
              before_photos as "beforePhotos", consent_handling as "consentHandling",
              consent_products as "consentProducts", consent_photography as "consentPhotography",
              consent_emergency_contact as "consentEmergencyContact"
       FROM grooming_intake WHERE order_id = $1`, [orderId]);
    return r.rows[0] || null;
  }

  /** Update an execution line item (staff marks pending/started/completed/skipped/…). */
  async updateItemStatus(userId: string, orderId: string, itemId: string, status: string, opts?: { reason?: string; photoUrl?: string }): Promise<any> {
    await this.requireProviderStaff(userId, orderId);
    const valid = ['pending', 'started', 'completed', 'skipped', 'awaiting_approval', 'paused'];
    if (!valid.includes(status)) throw new ValidationError('Invalid item status');
    await database.query(
      `UPDATE grooming_order_items SET status = $3, reason = COALESCE($4, reason), photo_url = COALESCE($5, photo_url), updated_at = NOW()
       WHERE id = $1 AND order_id = $2`, [itemId, orderId, status, opts?.reason || null, opts?.photoUrl || null]);
    return this.getOrderById(orderId);
  }

  /** Create/replace the report card and mark the order completed. */
  async createReportCard(userId: string, orderId: string, data: any): Promise<any> {
    const { order } = await this.requireProviderStaff(userId, orderId);
    await database.query(
      `INSERT INTO grooming_report_card (order_id, after_photos, products_used, aftercare_notes, summary, next_recommended_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (order_id) DO UPDATE SET after_photos = EXCLUDED.after_photos, products_used = EXCLUDED.products_used,
         aftercare_notes = EXCLUDED.aftercare_notes, summary = EXCLUDED.summary, next_recommended_date = EXCLUDED.next_recommended_date`,
      [orderId, Array.isArray(data.afterPhotos) ? data.afterPhotos : [], data.productsUsed || null,
       data.aftercareNotes || null, data.summary || null, data.nextRecommendedDate || null, userId]);
    // Completing via report card if not already terminal. declined_by_provider is terminal and
    // already refunded — completing it would resurrect a cancelled, refunded booking. A booking
    // still sitting at the acceptance gate has not been accepted, let alone performed, so it is
    // excluded too: the report card records work, and no work can have happened yet.
    if (!['completed', 'closed', 'cancelled_by_customer', 'cancelled_by_provider',
          'declined_by_provider', 'pending_provider_acceptance'].includes(order.status)) {
      await database.query(`UPDATE grooming_orders SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [orderId]);
      await this.addHistory(orderId, order.status, 'completed', userId, 'Completed with report card');
    }
    return this.getReportCard(userId, orderId);
  }

  async getReportCard(userId: string, orderId: string): Promise<any | null> {
    await this.resolveOrderAccess(userId, orderId);
    const r = await database.query(
      `SELECT order_id as "orderId", after_photos as "afterPhotos", products_used as "productsUsed",
              aftercare_notes as "aftercareNotes", summary, next_recommended_date as "nextRecommendedDate"
       FROM grooming_report_card WHERE order_id = $1`, [orderId]);
    return r.rows[0] || null;
  }

  /** Full order detail (order + items + intake + report card + history), owner or provider staff. */
  async getOrderDetail(userId: string, orderId: string): Promise<any> {
    await this.resolveOrderAccess(userId, orderId);
    const order = await this.getOrderById(orderId);
    order.intake = await this.getIntake(userId, orderId);
    order.reportCard = await this.getReportCard(userId, orderId);
    const hist = await database.query(
      `SELECT from_status as "fromStatus", to_status as "toStatus", note, created_at as "createdAt"
       FROM grooming_order_status_history WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]);
    order.history = hist.rows;
    return order;
  }

  // ── P4: variable-price approval (transparent extra-work flow) ──
  /** Provider proposes extra work → item enters 'requested' + order moves to awaiting_approval. */
  async requestVariableItem(userId: string, orderId: string, data: any): Promise<any> {
    const { order } = await this.requireProviderStaff(userId, orderId);
    if (!['checked_in', 'intake_done', 'in_progress'].includes(order.status))
      throw new ValidationError('Extra work can only be requested during the service');
    const price = Number(data.price) || 0;
    if (price <= 0 || !data.name?.trim()) throw new ValidationError('name and a positive price are required');
    const gross = Number(order.subtotal) + Number(order.addonsTotal) + Number(order.variableTotal);
    const taxPct = data.taxPercent != null ? Number(data.taxPercent)
      : (gross > 0 ? +(Number(order.taxTotal) / gross * 100).toFixed(2) : 0);
    const lineTotal = +(price * (1 + taxPct / 100)).toFixed(2);
    await database.query(
      `INSERT INTO grooming_order_items
         (order_id, item_type, name, unit_price, tax_percent, line_total, status, approval_status, reason, photo_url)
       VALUES ($1,'variable',$2,$3,$4,$5,'awaiting_approval','requested',$6,$7)`,
      [orderId, data.name.trim(), price, taxPct, lineTotal, data.reason || null, data.photoUrl || null]);
    await database.query(`UPDATE grooming_orders SET status = 'awaiting_approval', updated_at = NOW() WHERE id = $1`, [orderId]);
    await this.addHistory(orderId, order.status, 'awaiting_approval', userId, `Extra work requested: ${data.name.trim()} (+${price})`);
    return this.getOrderDetail(userId, orderId);
  }

  /** Owner approves or declines the extra work; order returns to in_progress. Approving adds the
   *  line to balance_due — it is NOT paid here; GroomingPaymentService collects it. */
  async respondVariableItem(userId: string, orderId: string, itemId: string, approve: boolean): Promise<any> {
    const { order, isOwner } = await this.resolveOrderAccess(userId, orderId);
    if (!isOwner) throw new ForbiddenError('Only the customer can approve extra work');
    if (order.status !== 'awaiting_approval') throw new ValidationError('There is no pending approval on this order');
    const itemRes = await database.query(
      `SELECT id, unit_price, tax_percent, line_total, approval_status
       FROM grooming_order_items WHERE id = $1 AND order_id = $2 AND item_type = 'variable'`, [itemId, orderId]);
    if (itemRes.rows.length === 0) throw new NotFoundError('GroomingOrderItem', itemId);
    const item = itemRes.rows[0];
    if (item.approval_status !== 'requested') throw new ValidationError('This item has already been answered');

    return database.transaction(async (client: any) => {
      if (approve) {
        const price = Number(item.unit_price);
        const taxPct = Number(item.tax_percent);
        const lineTotal = Number(item.line_total);
        const commissionPct = Number(order.commissionPercent) || 0;
        const addCommission = +(price * commissionPct / 100).toFixed(2);
        const addTax = +(price * taxPct / 100).toFixed(2);
        await client.query(
          `UPDATE grooming_order_items SET approval_status = 'approved', status = 'completed', updated_at = NOW() WHERE id = $1`, [itemId]);
        // Approving extra work makes it OWED, not paid. This used to add the line to amount_paid
        // and immediately credit the provider while collecting nothing — the platform paid out
        // money it never took, and the history note even claimed "approved & paid". The earning
        // and the supplementary GST invoice are now booked by GroomingPaymentService when the
        // balance is actually collected.
        await client.query(
          `UPDATE grooming_orders SET
             variable_total = variable_total + $2, tax_total = tax_total + $3,
             grand_total = grand_total + $4, commission_amount = commission_amount + $5,
             balance_due = balance_due + $4, status = 'in_progress', updated_at = NOW()
           WHERE id = $1`, [orderId, price, addTax, lineTotal, addCommission]);
        await client.query(
          `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
           VALUES ($1,'awaiting_approval','in_progress',$2,$3)`,
          [orderId, userId, `Extra work approved — ${lineTotal.toFixed(2)} added to the balance due`]);
      } else {
        await client.query(
          `UPDATE grooming_order_items SET approval_status = 'declined', status = 'skipped', updated_at = NOW() WHERE id = $1`, [itemId]);
        await client.query(`UPDATE grooming_orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [orderId]);
        await client.query(
          `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
           VALUES ($1,'awaiting_approval','in_progress',$2,'Extra work declined')`, [orderId, userId]);
      }
      const r = await client.query(`SELECT ${ORDER_SELECT} FROM grooming_orders o WHERE o.id = $1`, [orderId]);
      return r.rows[0];
    });
  }
}

export default new GroomingOrderService();
