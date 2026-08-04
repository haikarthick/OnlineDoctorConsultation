import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { getActiveGateway, getGatewayForMode } from '../payment/gateways';
import GroomingModuleConfig from './GroomingModuleConfig';
import NotificationService from '../NotificationService';

/**
 * Real gateway payments + GST invoices for grooming orders. Reuses the shared payment gateway
 * adapters (demo / Razorpay test / live) via getActiveGateway(), but keeps grooming on its own
 * earnings/settlement ledger and its own GST invoice series (GRM/FY). Demo mode auto-verifies so
 * the whole flow is exercisable without Razorpay keys.
 *
 * Completion invariants (mirroring PaymentOrchestrator for consultations):
 *  - The amount is ALWAYS derived server-side from the order, never from the request.
 *  - Completion is idempotent and serialised by a row lock: confirm-payment, the Razorpay
 *    webhook and the reconciliation sweep can all race for the same order and exactly one
 *    earning + one GST invoice results.
 *  - Outside demo mode the capture is re-read from the gateway and the amount re-checked, so a
 *    valid signature alone is never enough to book money.
 */
function financialYearLabel(d: Date): string {
  const y = d.getFullYear(); const m = d.getMonth(); // 0=Jan
  const startYear = m >= 3 ? y : y - 1; // Indian FY starts 1 Apr
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

const ORDER_PAYMENT_SELECT = `
  o.id, o.pet_owner_id, o.provider_id, o.status, o.grand_total, o.deposit_due, o.subtotal,
  o.addons_total, o.variable_total, o.tax_total, o.commission_amount, o.currency,
  o.gateway, o.gateway_order_id, o.amount_paid, o.order_number, o.payment_id, o.invoice_number,
  o.balance_due,
  gp.owner_user_id AS "providerOwnerId", gp.legal_name AS "providerLegal",
  gp.gstin AS "providerGstin", gp.business_name AS "providerName", gp.business_address AS "providerAddress"`;

class GroomingPaymentService {
  private async loadOwnedOrder(userId: string, orderId: string): Promise<any> {
    const r = await database.query(
      `SELECT ${ORDER_PAYMENT_SELECT}
       FROM grooming_orders o JOIN grooming_providers gp ON gp.id = o.provider_id WHERE o.id = $1`, [orderId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
    const o = r.rows[0];
    if (o.pet_owner_id !== userId) throw new ForbiddenError('This order is not yours');
    return o;
  }

  /** Create a gateway checkout order + pending payment row; returns the frontend checkout payload. */
  async createCheckout(userId: string, orderId: string, deposit: boolean): Promise<any> {
    const o = await this.loadOwnedOrder(userId, orderId);
    if (o.status !== 'payment_pending') throw new ValidationError('Order is not awaiting payment');
    // Deposit part-payment is safe now that a balance leg exists: confirmation books the earning
    // and invoices only what was actually collected, and the remainder becomes balance_due which
    // must be collected before the order can be completed.
    const amount = deposit ? Number(o.deposit_due) : Number(o.grand_total);
    if (!(amount > 0)) throw new ValidationError('Nothing to pay');
    const currency = o.currency || await GroomingModuleConfig.getCurrency();
    const gateway = await getActiveGateway();

    // Reuse the order's existing pending payment row rather than stacking a new one per click -
    // repeated checkouts otherwise leave orphaned 'pending' rows that no longer match any order.
    let paymentId: string | null = null;
    if (o.payment_id) {
      const existing = await database.query(
        `SELECT id FROM payments WHERE id = $1 AND status = 'pending'`, [o.payment_id]);
      if (existing.rows.length > 0) paymentId = existing.rows[0].id;
    }
    if (paymentId) {
      await database.query(
        `UPDATE payments SET amount = $2, currency = $3, gateway = $4, tax_amount = $5,
                payee_id = $6, payment_source = 'grooming', grooming_order_id = $7, updated_at = NOW() WHERE id = $1`,
        [paymentId, amount, currency, gateway.mode, Number(o.tax_total), o.providerOwnerId, orderId]);
    } else {
      const payRes = await database.query(
        `INSERT INTO payments (user_id, payer_id, payee_id, amount, currency, status, gateway, tax_amount, payment_source, grooming_order_id)
         VALUES ($1,$1,$2,$3,$4,'pending',$5,$6,'grooming',$7) RETURNING id`,
        [userId, o.providerOwnerId, amount, currency, gateway.mode, Number(o.tax_total), orderId]);
      paymentId = payRes.rows[0].id;
    }

    const go = await gateway.createOrder(amount, currency, paymentId!, { orderId, kind: 'grooming' });
    // gateway_order_id must live on the PAYMENTS row too, not just the grooming order: the
    // Razorpay webhook and the reconciliation sweep both find work by payments.gateway_order_id.
    // Without it a lost browser callback stranded a paid order with no way to ever recover it.
    await database.query(
      `UPDATE payments SET gateway_order_id = $2, updated_at = NOW() WHERE id = $1`,
      [paymentId, go.gatewayOrderId]);
    await database.query(
      `UPDATE grooming_orders SET payment_id = $2, gateway_order_id = $3, gateway = $4, updated_at = NOW() WHERE id = $1`,
      [orderId, paymentId, go.gatewayOrderId, gateway.mode]);
    return { paymentId, mode: gateway.mode, gatewayOrderId: go.gatewayOrderId, amount, currency, checkoutPayload: go.checkoutPayload };
  }

  /** Verify the gateway checkout (demo always verifies) → finalize order + earning + GST invoice. */
  async confirmCheckout(userId: string, orderId: string, body: any): Promise<any> {
    const o = await this.loadOwnedOrder(userId, orderId);
    if (o.status === 'confirmed') return { orderId, status: 'confirmed', invoiceNumber: o.invoice_number, alreadyPaid: true };
    // The customer paid, but the slot hold had already lapsed by the time the callback arrived.
    // Refuse the booking AND return the money - never both keep the payment and drop the slot.
    if (o.status === 'payment_expired') {
      const GroomingRefundService = (await import('./GroomingRefundService')).default;
      const lateId = body.gatewayPaymentId || o.gateway_payment_id || '';
      await GroomingRefundService.refundExpiredCapture(orderId, lateId);
      throw new ValidationError('This booking expired before the payment completed. The full amount has been refunded - please book again.');
    }
    if (o.status !== 'payment_pending') throw new ValidationError('Order is not awaiting payment');

    const mode = o.gateway || 'demo';
    const gateway = await getGatewayForMode(mode);
    const gwOrderId = body.gatewayOrderId || o.gateway_order_id;
    const gwPaymentId = body.gatewayPaymentId || `demo_pay_${String(o.gateway_order_id || '').replace('demo_order_', '')}`;
    const signature = body.gatewaySignature || body.signature || 'demo';
    if (!gateway.verifyCheckoutSignature(gwOrderId, gwPaymentId, signature)) throw new ValidationError('Payment verification failed');

    if (!o.payment_id) throw new ValidationError('No payment initiated for this order');
    const payRow = await database.query(`SELECT amount FROM payments WHERE id = $1`, [o.payment_id]);
    const payAmount = Number(payRow.rows[0]?.amount) || Number(o.grand_total);

    // A signature only proves the callback came from the gateway - it does not prove the money
    // was captured, nor how much. Consultations already re-read the capture (PaymentOrchestrator
    // .completeRazorpayCheckout); grooming did not, so a signed callback for an authorised-then-
    // failed payment would still have confirmed the booking and credited the provider.
    if (mode !== 'demo') {
      const gwPayment = await gateway.fetchPayment(gwPaymentId);
      if (gwPayment.status !== 'captured' && gwPayment.status !== 'authorized') {
        throw new ValidationError(`Payment is not captured at the gateway (status: ${gwPayment.status}).`);
      }
      if (Math.abs(gwPayment.amount - payAmount) > 0.01) {
        logger.error('Grooming payment amount mismatch', { orderId, expected: payAmount, got: gwPayment.amount });
        throw new ValidationError('Paid amount does not match the order amount. Please contact support.');
      }
    }

    return this.finalizeConfirmedOrder(orderId, { gatewayPaymentId: gwPaymentId, mode, actorUserId: userId });
  }

  /**
   * Gateway-driven completion for a grooming payment - used by the Razorpay webhook and the
   * reconciliation sweep, where there is no browser callback to verify. Both callers have already
   * established authenticity (webhook signature / direct gateway read), so this only resolves the
   * payment back to its order and runs the same idempotent finalisation.
   */
  async completeFromGateway(paymentId: string, gatewayPaymentId: string): Promise<void> {
    const r = await database.query(
      `SELECT o.id, o.gateway, o.status FROM grooming_orders o WHERE o.payment_id = $1`, [paymentId]);
    if (r.rows.length === 0) {
      logger.warn('Grooming completion requested for a payment with no order', { paymentId });
      return;
    }
    // The slot was already released before this capture landed. Keeping the money for a slot the
    // customer no longer holds is not an option - return it in full instead of confirming.
    if (r.rows[0].status === 'payment_expired') {
      const GroomingRefundService = (await import('./GroomingRefundService')).default;
      await GroomingRefundService.refundExpiredCapture(r.rows[0].id, gatewayPaymentId);
      return;
    }
    await this.finalizeConfirmedOrder(r.rows[0].id, {
      gatewayPaymentId, mode: r.rows[0].gateway || 'demo', actorUserId: null,
    });
  }

  /**
   * Slot-hold expiry (grooming's own - consultations expire via
   * PaymentOrchestrator.expireStalePaymentHolds against `bookings`, and the two must stay apart).
   *
   * Releases orders that were never paid for within grooming.holdMinutes. Only touches orders
   * whose payment has NOT completed, so a confirmed booking can never be expired out from under
   * the customer; and a capture that lands afterwards is refunded in full by completeFromGateway
   * rather than silently kept.
   */
  async expireStaleHolds(): Promise<number> {
    if (!(await GroomingModuleConfig.isEnabled())) return 0;
    const expired = await database.query(
      `UPDATE grooming_orders o SET status = 'payment_expired', updated_at = NOW()
       WHERE o.status = 'payment_pending'
         AND o.expires_at IS NOT NULL AND o.expires_at < NOW()
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = o.payment_id AND p.status = 'completed')
       RETURNING o.id, o.pet_owner_id, o.payment_id`);

    for (const row of expired.rows) {
      try {
        if (row.payment_id) {
          await database.query(
            `UPDATE payments SET status = 'expired', updated_at = NOW()
             WHERE id = $1 AND status IN ('created', 'pending')`, [row.payment_id]);
        }
        await database.query(
          `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
           VALUES ($1,'payment_pending','payment_expired',NULL,'Slot hold expired before payment')`, [row.id]);
        await NotificationService.createNotification(
          row.pet_owner_id, 'payment', 'Grooming Booking Expired',
          'Your grooming slot was released because payment was not completed in time. You can book again if the slot is still available.',
          'all', { orderId: row.id });
      } catch (err: any) {
        logger.error('Grooming hold expiry post-processing failed', { orderId: row.id, error: err.message });
      }
    }
    if (expired.rows.length > 0) logger.info(`[Grooming] Expired ${expired.rows.length} stale slot hold(s)`);
    return expired.rows.length;
  }

  /**
   * Human-readable booking facts for notification copy - pet, service, provider, customer and a
   * formatted date/time. Read outside the confirming transaction on purpose: notifications are
   * best-effort and must never widen the row lock or fail the payment. Every field degrades to a
   * sensible phrase so the copy still reads correctly when a column is null.
   */
  private async loadNotificationContext(orderId: string): Promise<{
    serviceLine: string; petLine: string; whenLine: string;
    providerName: string; customerName: string; currencySymbol: string;
    acceptanceDeadlineLabel: string; acceptanceWindowLabel: string;
  }> {
    const fallback = {
      serviceLine: 'your grooming appointment', petLine: '', whenLine: 'the scheduled date',
      providerName: 'your grooming provider', customerName: 'A customer', currencySymbol: '',
      acceptanceDeadlineLabel: 'the acceptance deadline', acceptanceWindowLabel: 'a short while',
    };
    try {
      const r = await database.query(
        `SELECT gs.name AS "serviceName", a.name AS "petName", gp.business_name AS "providerName",
                o.scheduled_date AS "scheduledDate", o.time_slot_start AS "timeSlotStart", o.currency,
                o.acceptance_deadline AS "acceptanceDeadline",
                u.first_name AS "firstName", u.last_name AS "lastName"
         FROM grooming_orders o
         JOIN grooming_providers gp ON gp.id = o.provider_id
         LEFT JOIN grooming_services gs ON gs.id = o.primary_service_id
         LEFT JOIN animals a ON a.id = o.animal_id
         LEFT JOIN users u ON u.id = o.pet_owner_id
         WHERE o.id = $1`, [orderId]);
      if (r.rows.length === 0) return fallback;
      const x = r.rows[0];

      // scheduled_date is a DATE - render it in a stable, unambiguous form rather than an ISO
      // timestamp, which is what a groomer scanning a phone notification actually needs.
      let whenLine = fallback.whenLine;
      if (x.scheduledDate) {
        const d = new Date(x.scheduledDate);
        if (!isNaN(d.getTime())) {
          whenLine = d.toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
          });
          if (x.timeSlotStart) whenLine += ` at ${String(x.timeSlotStart).slice(0, 5)}`;
        }
      }
      // The acceptance deadline is a real wall-clock moment the provider is held to, so it is
      // shown as a time (with the date only when it lands on a different day), plus a relative
      // "within 2 hours" phrasing for the customer, who cares about the wait not the timestamp.
      let acceptanceDeadlineLabel = fallback.acceptanceDeadlineLabel;
      let acceptanceWindowLabel = fallback.acceptanceWindowLabel;
      if (x.acceptanceDeadline) {
        const dl = new Date(x.acceptanceDeadline);
        if (!isNaN(dl.getTime())) {
          const sameDay = dl.toDateString() === new Date().toDateString();
          acceptanceDeadlineLabel = dl.toLocaleString('en-IN', {
            ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
          });
          const mins = Math.max(Math.round((dl.getTime() - Date.now()) / 60000), 1);
          acceptanceWindowLabel = mins >= 120 ? `${Math.round(mins / 60)} hours`
            : mins >= 60 ? 'an hour' : `${mins} minutes`;
        }
      }
      const customerName = [x.firstName, x.lastName].filter(Boolean).join(' ').trim();
      return {
        serviceLine: x.serviceName || fallback.serviceLine,
        petLine: x.petName ? ` for ${x.petName}` : '',
        whenLine,
        providerName: x.providerName || fallback.providerName,
        customerName: customerName || fallback.customerName,
        currencySymbol: (x.currency || 'INR') === 'INR' ? '₹' : `${x.currency} `,
        acceptanceDeadlineLabel, acceptanceWindowLabel,
      };
    } catch {
      return fallback;
    }
  }

  /**
   * The single transactional completion path for the FIRST collection on an order (full amount or
   * deposit). Locks the order row FIRST and re-checks its status inside the transaction, so
   * concurrent confirms (double-click, browser retry, webhook racing the callback) collapse to
   * exactly one earning and one GST invoice. Checking the status before the transaction - as this
   * used to - let 8 parallel calls book 6 earnings and 6 invoices.
   *
   * Only what was actually COLLECTED is credited and invoiced. Anything still owed becomes
   * balance_due and is billed by a supplementary invoice when collected.
   */
  private async finalizeConfirmedOrder(orderId: string, opts: {
    gatewayPaymentId: string; mode: string; actorUserId: string | null; paymentId?: string;
  }): Promise<any> {
    const clearanceDays = await GroomingModuleConfig.getClearanceDays();
    const sac = await GroomingModuleConfig.getSacCode();
    const prefix = await GroomingModuleConfig.getInvoicePrefix();
    // Acceptance gate (036): payment no longer confirms the booking on its own - the provider
    // must accept it. autoAccept restores the old behaviour for operators who want it.
    const autoAccept = await GroomingModuleConfig.isAutoAcceptEnabled();
    const acceptanceWindowMinutes = await GroomingModuleConfig.getAcceptanceWindowMinutes();
    const paidStatus = autoAccept ? 'confirmed' : 'pending_provider_acceptance';

    const result: any = await database.transaction(async (client: any) => {
      const lockRes = await client.query(
        `SELECT ${ORDER_PAYMENT_SELECT}
         FROM grooming_orders o JOIN grooming_providers gp ON gp.id = o.provider_id
         WHERE o.id = $1 FOR UPDATE OF o`, [orderId]);
      if (lockRes.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
      const o = lockRes.rows[0];

      // Idempotency guard: a retry must collapse onto whichever post-payment state this order
      // already reached, not just 'confirmed' - otherwise a double-click on a gated order falls
      // through to the 'not awaiting payment' error instead of returning the first result.
      if (o.status === 'confirmed' || o.status === 'pending_provider_acceptance') {
        return { orderId, status: o.status, invoiceNumber: o.invoice_number, alreadyPaid: true };
      }
      if (o.status !== 'payment_pending') throw new ValidationError('Order is not awaiting payment');
      const paymentId = opts.paymentId || o.payment_id;
      if (!paymentId) throw new ValidationError('No payment initiated for this order');

      const payRes = await client.query(`SELECT amount, status FROM payments WHERE id = $1 FOR UPDATE`, [paymentId]);
      const collected = Number(payRes.rows[0]?.amount) || Number(o.grand_total);
      const balanceDue = +(Number(o.grand_total) - collected).toFixed(2);

      await client.query(
        `UPDATE payments SET status = 'completed', transaction_id = $2, gateway_payment_id = $2,
                payment_source = 'grooming', grooming_order_id = $3, paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [paymentId, opts.gatewayPaymentId, orderId]);
      await client.query(
        `UPDATE grooming_orders SET status = $5, amount_paid = $2, balance_due = $3,
                gateway_payment_id = $4,
                acceptance_deadline = CASE WHEN $5 = 'pending_provider_acceptance'
                                          THEN NOW() + ($6 || ' minutes')::interval ELSE NULL END,
                accepted_at = CASE WHEN $5 = 'confirmed' THEN NOW() ELSE NULL END,
                updated_at = NOW() WHERE id = $1`,
        [orderId, collected, Math.max(balanceDue, 0), opts.gatewayPaymentId,
         paidStatus, String(acceptanceWindowMinutes)]);

      // Provider earning: only the collected share. A deposit credits the provider pro-rata; the
      // remainder is booked when the balance is collected.
      const grossTotal = Number(o.subtotal) + Number(o.addons_total) + Number(o.variable_total);
      const share = Number(o.grand_total) > 0 ? collected / Number(o.grand_total) : 1;
      const gross = +(grossTotal * share).toFixed(2);
      const commission = +(Number(o.commission_amount) * share).toFixed(2);
      const taxPortion = +(Number(o.tax_total) * share).toFixed(2);
      const net = +(gross - commission).toFixed(2);
      await client.query(
        `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, available_at)
         VALUES ($1,$2,$3,$4,$5,$6,'earning','clearing', NOW() + ($7 || ' days')::interval)`,
        [o.provider_id, orderId, gross, commission, taxPortion, net, String(clearanceDays)]);
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'payment_pending',$4,$2,$3)`,
        [orderId, opts.actorUserId,
         (balanceDue > 0 ? `Deposit received (${opts.mode}) - balance ${balanceDue.toFixed(2)} due`
                         : `Payment received (${opts.mode})`)
         + (paidStatus === 'pending_provider_acceptance'
              ? ` - awaiting provider acceptance (${acceptanceWindowMinutes} min)` : ''),
         paidStatus]);

      const items = await client.query(
        `SELECT id, name, quantity, unit_price, tax_percent, line_total FROM grooming_order_items
         WHERE order_id = $1 AND (approval_status IS NULL OR approval_status <> 'declined') ORDER BY created_at ASC`, [orderId]);

      // GST invoice (GRM/FY series) for what was collected.
      const invoiceNumber = await this.nextGroomingInvoiceNumber(client, prefix);
      const taxRate = gross > 0 ? +(taxPortion / gross * 100).toFixed(2) : 0;
      await client.query(
        `INSERT INTO invoices (invoice_number, invoice_type, payment_id, issuer_details, recipient_details,
           line_items, subtotal, tax_amount, total, sac_code, tax_rate, currency)
         VALUES ($1,'grooming',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [invoiceNumber, paymentId,
         JSON.stringify({ name: o.providerLegal || o.providerName, gstin: o.providerGstin || null, address: o.providerAddress || null }),
         JSON.stringify({ orderNumber: o.order_number, userId: o.pet_owner_id, kind: balanceDue > 0 ? 'advance' : 'full' }),
         JSON.stringify(items.rows.map((it: any) => ({ name: it.name, qty: it.quantity, unitPrice: Number(it.unit_price), taxPercent: Number(it.tax_percent), lineTotal: Number(it.line_total) }))),
         gross, taxPortion, collected, sac, taxRate, o.currency || 'INR']);
      await client.query(`UPDATE grooming_orders SET invoice_number = $2 WHERE id = $1`, [orderId, invoiceNumber]);
      // Mark these lines billed so a later supplementary invoice covers only new work.
      await client.query(
        `UPDATE grooming_order_items SET invoice_number = $2 WHERE order_id = $1 AND invoice_number IS NULL
           AND (approval_status IS NULL OR approval_status <> 'declined')`, [orderId, invoiceNumber]);

      // Audit trail on the shared payment ledger, same as consultations (non-fatal).
      try {
        await client.query(
          `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, actor_user_id, payload, created_at)
           VALUES (gen_random_uuid(), $1, 'grooming_payment_completed', 'pending', 'completed', $2, $3, NOW())`,
          [paymentId, opts.actorUserId,
           JSON.stringify({ orderId, gatewayPaymentId: opts.gatewayPaymentId, mode: opts.mode, invoiceNumber, amountPaid: collected, balanceDue })]);
      } catch (err: any) {
        logger.warn('grooming payment_events insert failed (non-blocking)', { orderId, error: err.message });
      }

      return {
        orderId, status: paidStatus, invoiceNumber, amountPaid: collected,
        balanceDue: Math.max(balanceDue, 0),
        notify: { customerId: o.pet_owner_id, providerOwnerId: o.providerOwnerId, orderNumber: o.order_number },
      };
    });

    // Both sides hear about it once the money is booked. Previously nobody was told a grooming
    // order had been paid - the provider had no signal that a booking even existed.
    if (result && result.notify) {
      const n = result.notify;
      if (!result.alreadyPaid) {
        // The old copy ("Please review and assign it") named no pet, service, date or customer,
        // so neither recipient could tell what the message was about or who it was for. Both
        // notifications now lead with the concrete booking.
        const ctx = await this.loadNotificationContext(orderId);
        const gated = result.status === 'pending_provider_acceptance';
        const balanceNote = result.balanceDue > 0
          ? ` A balance of ${ctx.currencySymbol}${result.balanceDue.toFixed(2)} is due before your appointment can be completed -`
            + ` you can pay it from My Grooming Bookings.`
          : '';
        try {
          await NotificationService.createNotification(
            n.customerId, 'payment',
            gated ? 'Payment received - waiting for the groomer to confirm' : 'Grooming booking confirmed',
            gated
              // Do not tell the customer they are confirmed when they are not. The gate can still
              // end in a full refund, and promising confirmation here is what would make that
              // refund feel like a broken promise rather than a normal outcome.
              ? `We've received your payment for ${ctx.serviceLine}${ctx.petLine} at ${ctx.providerName} on ${ctx.whenLine}. `
                + `${ctx.providerName} now has ${ctx.acceptanceWindowLabel} to confirm the appointment. `
                + `We'll let you know as soon as they do - and if they can't take it, you'll be refunded in full automatically. `
                + `Booking reference ${n.orderNumber}, invoice ${result.invoiceNumber}.${balanceNote}`
              : `Your booking for ${ctx.serviceLine}${ctx.petLine} at ${ctx.providerName} on ${ctx.whenLine} is confirmed. `
                + `Booking reference ${n.orderNumber}, invoice ${result.invoiceNumber}.${balanceNote}`,
            'all', { orderId, invoiceNumber: result.invoiceNumber });
        } catch { /* non-blocking */ }
        try {
          if (n.providerOwnerId) {
            await NotificationService.createNotification(
              n.providerOwnerId, 'booking',
              gated ? `Action needed - accept or decline by ${ctx.acceptanceDeadlineLabel}`
                    : `New booking - ${ctx.whenLine}`,
              gated
                ? `${ctx.customerName} has booked and paid for ${ctx.serviceLine}${ctx.petLine} on ${ctx.whenLine}. `
                  + `Open booking ${n.orderNumber} and accept it to confirm the appointment, or decline if you can't take it. `
                  + `If you don't respond by ${ctx.acceptanceDeadlineLabel} the booking is cancelled automatically and the `
                  + `customer is refunded in full.`
                : `${ctx.customerName} has booked and paid for ${ctx.serviceLine}${ctx.petLine} on ${ctx.whenLine}. `
                  + `Open booking ${n.orderNumber} to assign a groomer and station for it.`,
              'all', { orderId });
          }
        } catch { /* non-blocking */ }
      }
      delete result.notify;
    }
    return result;
  }

  /**
   * Balance collection - the money leg for approved extra work and for the remainder after a
   * deposit. Creates its OWN payments row (an order can have several), linked by
   * payments.grooming_order_id the same way consultations link by booking_id.
   */
  async createBalanceCheckout(userId: string, orderId: string): Promise<any> {
    const o = await this.loadOwnedOrder(userId, orderId);
    const balance = Number(o.balance_due) || 0;
    if (!(balance > 0)) throw new ValidationError('This order has no balance to pay');
    if (['cancelled_by_customer', 'cancelled_by_provider', 'payment_expired', 'closed'].includes(o.status)) {
      throw new ValidationError('This order is no longer payable');
    }
    const currency = o.currency || await GroomingModuleConfig.getCurrency();
    const gateway = await getActiveGateway();

    // Reuse an outstanding pending balance payment rather than stacking one per click.
    const existing = await database.query(
      `SELECT id FROM payments WHERE grooming_order_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [orderId]);
    let paymentId: string;
    if (existing.rows.length > 0) {
      paymentId = existing.rows[0].id;
      await database.query(
        `UPDATE payments SET amount = $2, currency = $3, gateway = $4, payee_id = $5, updated_at = NOW() WHERE id = $1`,
        [paymentId, balance, currency, gateway.mode, o.providerOwnerId]);
    } else {
      const payRes = await database.query(
        `INSERT INTO payments (user_id, payer_id, payee_id, amount, currency, status, gateway, payment_source, grooming_order_id)
         VALUES ($1,$1,$2,$3,$4,'pending',$5,'grooming',$6) RETURNING id`,
        [userId, o.providerOwnerId, balance, currency, gateway.mode, orderId]);
      paymentId = payRes.rows[0].id;
    }

    const go = await gateway.createOrder(balance, currency, paymentId, { orderId, kind: 'grooming_balance' });
    await database.query(
      `UPDATE payments SET gateway_order_id = $2, updated_at = NOW() WHERE id = $1`, [paymentId, go.gatewayOrderId]);
    return { paymentId, mode: gateway.mode, gatewayOrderId: go.gatewayOrderId, amount: balance, currency, checkoutPayload: go.checkoutPayload };
  }

  /** Verify + book a balance payment (extras / deposit remainder). */
  async confirmBalancePayment(userId: string, orderId: string, body: any): Promise<any> {
    const o = await this.loadOwnedOrder(userId, orderId);
    if (!(Number(o.balance_due) > 0)) return { orderId, balanceDue: 0, alreadyPaid: true };

    const payRes = await database.query(
      `SELECT id, amount, gateway, gateway_order_id FROM payments
       WHERE grooming_order_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`, [orderId]);
    if (payRes.rows.length === 0) throw new ValidationError('No balance payment initiated for this order');
    const pay = payRes.rows[0];

    const mode = pay.gateway || o.gateway || 'demo';
    const gateway = await getGatewayForMode(mode);
    const gwOrderId = body.gatewayOrderId || pay.gateway_order_id;
    const gwPaymentId = body.gatewayPaymentId || `demo_pay_${String(pay.gateway_order_id || '').replace('demo_order_', '')}`;
    const signature = body.gatewaySignature || body.signature || 'demo';
    if (!gateway.verifyCheckoutSignature(gwOrderId, gwPaymentId, signature)) throw new ValidationError('Payment verification failed');

    if (mode !== 'demo') {
      const gwPayment = await gateway.fetchPayment(gwPaymentId);
      if (gwPayment.status !== 'captured' && gwPayment.status !== 'authorized') {
        throw new ValidationError(`Payment is not captured at the gateway (status: ${gwPayment.status}).`);
      }
      if (Math.abs(gwPayment.amount - Number(pay.amount)) > 0.01) {
        throw new ValidationError('Paid amount does not match the balance due. Please contact support.');
      }
    }
    return this.finalizeBalancePayment(orderId, pay.id, gwPaymentId, mode, userId);
  }

  /**
   * Books a collected balance: the incremental provider earning (whatever of the order's net has
   * not been credited yet) plus a SUPPLEMENTARY GST invoice covering only the lines not already
   * billed. Locked and idempotent like the initial confirmation.
   */
  private async finalizeBalancePayment(orderId: string, paymentId: string, gatewayPaymentId: string,
    mode: string, actorUserId: string | null): Promise<any> {
    const clearanceDays = await GroomingModuleConfig.getClearanceDays();
    const sac = await GroomingModuleConfig.getSacCode();
    const prefix = await GroomingModuleConfig.getInvoicePrefix();

    return database.transaction(async (client: any) => {
      const lockRes = await client.query(
        `SELECT ${ORDER_PAYMENT_SELECT}
         FROM grooming_orders o JOIN grooming_providers gp ON gp.id = o.provider_id
         WHERE o.id = $1 FOR UPDATE OF o`, [orderId]);
      if (lockRes.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
      const o = lockRes.rows[0];
      if (!(Number(o.balance_due) > 0)) return { orderId, balanceDue: 0, alreadyPaid: true };

      const payLock = await client.query(`SELECT amount, status FROM payments WHERE id = $1 FOR UPDATE`, [paymentId]);
      if (payLock.rows[0]?.status === 'completed') return { orderId, balanceDue: Number(o.balance_due), alreadyPaid: true };
      const collected = Number(payLock.rows[0]?.amount) || Number(o.balance_due);

      await client.query(
        `UPDATE payments SET status = 'completed', transaction_id = $2, gateway_payment_id = $2,
                paid_at = NOW(), updated_at = NOW() WHERE id = $1`, [paymentId, gatewayPaymentId]);
      const newBalance = +(Number(o.balance_due) - collected).toFixed(2);
      await client.query(
        `UPDATE grooming_orders SET amount_paid = amount_paid + $2, balance_due = $3, updated_at = NOW() WHERE id = $1`,
        [orderId, collected, Math.max(newBalance, 0)]);

      // Credit whatever of this order's net has not been credited yet - self-correcting, so it
      // stays right however the order was split across deposit and extras.
      const grossTotal = Number(o.subtotal) + Number(o.addons_total) + Number(o.variable_total);
      const netTotal = +(grossTotal - Number(o.commission_amount)).toFixed(2);
      const already = await client.query(
        `SELECT COALESCE(SUM(net_amount), 0) AS net, COALESCE(SUM(gross_amount), 0) AS gross,
                COALESCE(SUM(commission_amount), 0) AS commission, COALESCE(SUM(tax_amount), 0) AS tax
         FROM grooming_earnings WHERE order_id = $1 AND entry_type = 'earning'`, [orderId]);
      const deltaNet = +(netTotal - Number(already.rows[0].net)).toFixed(2);
      const deltaGross = +(grossTotal - Number(already.rows[0].gross)).toFixed(2);
      const deltaCommission = +(Number(o.commission_amount) - Number(already.rows[0].commission)).toFixed(2);
      const deltaTax = +(Number(o.tax_total) - Number(already.rows[0].tax)).toFixed(2);
      if (deltaNet !== 0) {
        await client.query(
          `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, available_at, note)
           VALUES ($1,$2,$3,$4,$5,$6,'earning','clearing', NOW() + ($7 || ' days')::interval, 'Balance collected')`,
          [o.provider_id, orderId, deltaGross, deltaCommission, deltaTax, deltaNet, String(clearanceDays)]);
      }

      // Supplementary GST invoice for the lines not billed yet.
      const items = await client.query(
        `SELECT id, name, quantity, unit_price, tax_percent, line_total FROM grooming_order_items
         WHERE order_id = $1 AND invoice_number IS NULL
           AND (approval_status IS NULL OR approval_status <> 'declined') ORDER BY created_at ASC`, [orderId]);
      const invoiceNumber = await this.nextGroomingInvoiceNumber(client, prefix);
      const taxRate = deltaGross > 0 ? +(deltaTax / deltaGross * 100).toFixed(2) : 0;
      await client.query(
        `INSERT INTO invoices (invoice_number, invoice_type, payment_id, issuer_details, recipient_details,
           line_items, subtotal, tax_amount, total, sac_code, tax_rate, currency)
         VALUES ($1,'grooming',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [invoiceNumber, paymentId,
         JSON.stringify({ name: o.providerLegal || o.providerName, gstin: o.providerGstin || null, address: o.providerAddress || null }),
         JSON.stringify({ orderNumber: o.order_number, userId: o.pet_owner_id, kind: 'supplementary', supplementaryTo: o.invoice_number }),
         JSON.stringify(items.rows.map((it: any) => ({ name: it.name, qty: it.quantity, unitPrice: Number(it.unit_price), taxPercent: Number(it.tax_percent), lineTotal: Number(it.line_total) }))),
         Math.max(deltaGross, 0), Math.max(deltaTax, 0), collected, sac, taxRate, o.currency || 'INR']);
      await client.query(
        `UPDATE grooming_order_items SET invoice_number = $2 WHERE order_id = $1 AND invoice_number IS NULL
           AND (approval_status IS NULL OR approval_status <> 'declined')`, [orderId, invoiceNumber]);

      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,$2,$2,$3,$4)`,
        [orderId, o.status, actorUserId, `Balance ${collected.toFixed(2)} collected (${mode}) - invoice ${invoiceNumber}`]);
      try {
        await client.query(
          `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, actor_user_id, payload, created_at)
           VALUES (gen_random_uuid(), $1, 'grooming_balance_collected', 'pending', 'completed', $2, $3, NOW())`,
          [paymentId, actorUserId, JSON.stringify({ orderId, collected, invoiceNumber, remainingBalance: Math.max(newBalance, 0) })]);
      } catch { /* non-blocking */ }

      return { orderId, collected, invoiceNumber, balanceDue: Math.max(newBalance, 0) };
    });
  }

  /**
   * Race-safe sequential GRM/FY invoice number (separate series from consultation VC/…).
   *
   * Continues from the HIGHEST suffix already issued, never from COUNT(*). Counting rows
   * assumes the series is a contiguous 1..N; the moment it has a gap - one invoice deleted,
   * a partial clean_start_launch.sql, any manual cleanup - COUNT(*)+1 lands on a number that
   * already exists and the UNIQUE index on invoice_number aborts the whole confirm transaction.
   * That surfaced as a bare 500 on payment confirmation with the customer already charged at
   * the gateway, and it never self-heals: every later attempt recomputes the same taken number.
   */
  private async nextGroomingInvoiceNumber(client: any, prefix: string): Promise<string> {
    const fy = financialYearLabel(new Date());
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('grooming_invoice_number_seq'))`);
    const res = await client.query(
      `SELECT COALESCE(MAX(substring(invoice_number from '([0-9]+)$')::bigint), 0) AS last
       FROM invoices WHERE invoice_number LIKE $1 AND invoice_number ~ '/[0-9]+$'`,
      [`${prefix}/${fy}/%`]);
    const next = Number(res.rows[0].last) + 1;
    return `${prefix}/${fy}/${String(next).padStart(5, '0')}`;
  }
}

export default new GroomingPaymentService();
