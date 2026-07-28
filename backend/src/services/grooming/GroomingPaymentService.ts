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
    // Part-payment is not modelled end-to-end yet: confirmation books the provider's earning and
    // issues the GST invoice for the FULL order value, so collecting only the deposit would credit
    // and invoice money that was never taken. Refused until the balance leg exists.
    if (deposit) throw new ValidationError('Deposit part-payment is not available yet — the full amount is due at booking.');
    const amount = Number(o.grand_total);
    if (!(amount > 0)) throw new ValidationError('Nothing to pay');
    const currency = o.currency || await GroomingModuleConfig.getCurrency();
    const gateway = await getActiveGateway();

    // Reuse the order's existing pending payment row rather than stacking a new one per click —
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
                payee_id = $6, payment_source = 'grooming', updated_at = NOW() WHERE id = $1`,
        [paymentId, amount, currency, gateway.mode, Number(o.tax_total), o.providerOwnerId]);
    } else {
      const payRes = await database.query(
        `INSERT INTO payments (user_id, payer_id, payee_id, amount, currency, status, gateway, tax_amount, payment_source)
         VALUES ($1,$1,$2,$3,$4,'pending',$5,$6,'grooming') RETURNING id`,
        [userId, o.providerOwnerId, amount, currency, gateway.mode, Number(o.tax_total)]);
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
    // Refuse the booking AND return the money — never both keep the payment and drop the slot.
    if (o.status === 'payment_expired') {
      const GroomingRefundService = (await import('./GroomingRefundService')).default;
      const lateId = body.gatewayPaymentId || o.gateway_payment_id || '';
      await GroomingRefundService.refundExpiredCapture(orderId, lateId);
      throw new ValidationError('This booking expired before the payment completed. The full amount has been refunded — please book again.');
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

    // A signature only proves the callback came from the gateway — it does not prove the money
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
   * Gateway-driven completion for a grooming payment — used by the Razorpay webhook and the
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
    // customer no longer holds is not an option — return it in full instead of confirming.
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
   * Slot-hold expiry (grooming's own — consultations expire via
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
   * The single transactional completion path. Locks the order row FIRST and re-checks its status
   * inside the transaction, so concurrent confirms (double-click, browser retry, webhook racing
   * the callback) collapse to exactly one earning and one GST invoice. Checking the status before
   * the transaction — as this used to — let 8 parallel calls book 6 earnings and 6 invoices.
   */
  private async finalizeConfirmedOrder(orderId: string, opts: {
    gatewayPaymentId: string; mode: string; actorUserId: string | null;
  }): Promise<any> {
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

      if (o.status === 'confirmed') {
        return { orderId, status: 'confirmed', invoiceNumber: o.invoice_number, alreadyPaid: true };
      }
      if (o.status !== 'payment_pending') throw new ValidationError('Order is not awaiting payment');
      if (!o.payment_id) throw new ValidationError('No payment initiated for this order');

      const payRes = await client.query(`SELECT amount, status FROM payments WHERE id = $1 FOR UPDATE`, [o.payment_id]);
      const payAmount = Number(payRes.rows[0]?.amount) || Number(o.grand_total);

      await client.query(
        `UPDATE payments SET status = 'completed', transaction_id = $2, gateway_payment_id = $2,
                payment_source = 'grooming', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [o.payment_id, opts.gatewayPaymentId]);
      await client.query(
        `UPDATE grooming_orders SET status = 'confirmed', amount_paid = $2, gateway_payment_id = $3, updated_at = NOW() WHERE id = $1`,
        [orderId, payAmount, opts.gatewayPaymentId]);

      // Provider earning enters the dedicated clearing ledger.
      const gross = Number(o.subtotal) + Number(o.addons_total) + Number(o.variable_total);
      const net = +(gross - Number(o.commission_amount)).toFixed(2);
      await client.query(
        `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, available_at)
         VALUES ($1,$2,$3,$4,$5,$6,'earning','clearing', NOW() + ($7 || ' days')::interval)`,
        [o.provider_id, orderId, gross, Number(o.commission_amount), Number(o.tax_total), net, String(clearanceDays)]);
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'payment_pending','confirmed',$2,$3)`, [orderId, opts.actorUserId, `Payment received (${opts.mode})`]);

      const items = await client.query(
        `SELECT name, quantity, unit_price, tax_percent, line_total FROM grooming_order_items
         WHERE order_id = $1 AND (approval_status IS NULL OR approval_status <> 'declined') ORDER BY created_at ASC`, [orderId]);

      // GST invoice (GRM/FY series)
      const invoiceNumber = await this.nextGroomingInvoiceNumber(client, prefix);
      const taxRate = gross > 0 ? +(Number(o.tax_total) / gross * 100).toFixed(2) : 0;
      await client.query(
        `INSERT INTO invoices (invoice_number, invoice_type, payment_id, issuer_details, recipient_details,
           line_items, subtotal, tax_amount, total, sac_code, tax_rate, currency)
         VALUES ($1,'grooming',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [invoiceNumber, o.payment_id,
         JSON.stringify({ name: o.providerLegal || o.providerName, gstin: o.providerGstin || null, address: o.providerAddress || null }),
         JSON.stringify({ orderNumber: o.order_number, userId: o.pet_owner_id }),
         JSON.stringify(items.rows.map((it: any) => ({ name: it.name, qty: it.quantity, unitPrice: Number(it.unit_price), taxPercent: Number(it.tax_percent), lineTotal: Number(it.line_total) }))),
         gross, Number(o.tax_total), Number(o.grand_total), sac, taxRate, o.currency || 'INR']);
      await client.query(`UPDATE grooming_orders SET invoice_number = $2 WHERE id = $1`, [orderId, invoiceNumber]);

      // Audit trail on the shared payment ledger, same as consultations (non-fatal).
      try {
        await client.query(
          `INSERT INTO payment_events (id, payment_id, event_type, from_status, to_status, actor_user_id, payload, created_at)
           VALUES (gen_random_uuid(), $1, 'grooming_payment_completed', 'pending', 'completed', $2, $3, NOW())`,
          [o.payment_id, opts.actorUserId,
           JSON.stringify({ orderId, gatewayPaymentId: opts.gatewayPaymentId, mode: opts.mode, invoiceNumber, amountPaid: payAmount })]);
      } catch (err: any) {
        logger.warn('grooming payment_events insert failed (non-blocking)', { orderId, error: err.message });
      }

      return { orderId, status: 'confirmed', invoiceNumber, amountPaid: payAmount };
    });
  }

  /**
   * Race-safe sequential GRM/FY invoice number (separate series from consultation VC/…).
   *
   * Continues from the HIGHEST suffix already issued, never from COUNT(*). Counting rows
   * assumes the series is a contiguous 1..N; the moment it has a gap — one invoice deleted,
   * a partial clean_start_launch.sql, any manual cleanup — COUNT(*)+1 lands on a number that
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
