import database from '../../utils/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { getActiveGateway, getGatewayForMode } from '../payment/gateways';
import GroomingModuleConfig from './GroomingModuleConfig';

/**
 * Real gateway payments + GST invoices for grooming orders. Reuses the shared payment gateway
 * adapters (demo / Razorpay test / live) via getActiveGateway(), but keeps grooming on its own
 * earnings/settlement ledger and its own GST invoice series (GRM/FY). Demo mode auto-verifies so
 * the whole flow is exercisable without Razorpay keys.
 */
function financialYearLabel(d: Date): string {
  const y = d.getFullYear(); const m = d.getMonth(); // 0=Jan
  const startYear = m >= 3 ? y : y - 1; // Indian FY starts 1 Apr
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

class GroomingPaymentService {
  private async loadOwnedOrder(userId: string, orderId: string): Promise<any> {
    const r = await database.query(
      `SELECT o.id, o.pet_owner_id, o.provider_id, o.status, o.grand_total, o.deposit_due, o.subtotal,
              o.addons_total, o.variable_total, o.tax_total, o.commission_amount, o.currency,
              o.gateway, o.gateway_order_id, o.amount_paid, o.order_number,
              gp.owner_user_id AS "providerOwnerId", gp.legal_name AS "providerLegal",
              gp.gstin AS "providerGstin", gp.business_name AS "providerName", gp.business_address AS "providerAddress"
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
    const amount = deposit ? Number(o.deposit_due) : Number(o.grand_total);
    if (!(amount > 0)) throw new ValidationError('Nothing to pay');
    const currency = o.currency || await GroomingModuleConfig.getCurrency();
    const gateway = await getActiveGateway();

    const payRes = await database.query(
      `INSERT INTO payments (user_id, payer_id, payee_id, amount, currency, status, gateway, tax_amount)
       VALUES ($1,$1,$2,$3,$4,'pending',$5,$6) RETURNING id`,
      [userId, o.providerOwnerId, amount, currency, gateway.mode, Number(o.tax_total)]);
    const paymentId = payRes.rows[0].id;
    const go = await gateway.createOrder(amount, currency, paymentId, { orderId, kind: 'grooming' });
    await database.query(
      `UPDATE grooming_orders SET payment_id = $2, gateway_order_id = $3, gateway = $4, updated_at = NOW() WHERE id = $1`,
      [orderId, paymentId, go.gatewayOrderId, gateway.mode]);
    return { paymentId, mode: gateway.mode, gatewayOrderId: go.gatewayOrderId, amount, currency, checkoutPayload: go.checkoutPayload };
  }

  /** Verify the gateway checkout (demo always verifies) → finalize order + earning + GST invoice. */
  async confirmCheckout(userId: string, orderId: string, body: any): Promise<any> {
    const o = await this.loadOwnedOrder(userId, orderId);
    if (o.status === 'confirmed') return { orderId, status: 'confirmed', invoiceNumber: null, alreadyPaid: true };
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
    const clearanceDays = await GroomingModuleConfig.getClearanceDays();

    const items = await database.query(
      `SELECT name, quantity, unit_price, tax_percent, line_total FROM grooming_order_items
       WHERE order_id = $1 AND (approval_status IS NULL OR approval_status <> 'declined') ORDER BY created_at ASC`, [orderId]);

    return database.transaction(async (client: any) => {
      await client.query(
        `UPDATE payments SET status = 'completed', transaction_id = $2, paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [o.payment_id, gwPaymentId]);
      await client.query(
        `UPDATE grooming_orders SET status = 'confirmed', amount_paid = $2, gateway_payment_id = $3, updated_at = NOW() WHERE id = $1`,
        [orderId, payAmount, gwPaymentId]);
      // Provider earning enters the dedicated clearing ledger.
      const gross = Number(o.subtotal) + Number(o.addons_total) + Number(o.variable_total);
      const net = +(gross - Number(o.commission_amount)).toFixed(2);
      await client.query(
        `INSERT INTO grooming_earnings (provider_id, order_id, gross_amount, commission_amount, tax_amount, net_amount, entry_type, status, available_at)
         VALUES ($1,$2,$3,$4,$5,$6,'earning','clearing', NOW() + ($7 || ' days')::interval)`,
        [o.provider_id, orderId, gross, Number(o.commission_amount), Number(o.tax_total), net, String(clearanceDays)]);
      await client.query(
        `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
         VALUES ($1,'payment_pending','confirmed',$2,$3)`, [orderId, userId, `Payment received (${mode})`]);

      // GST invoice (GRM/FY series)
      const invoiceNumber = await this.nextGroomingInvoiceNumber(client);
      const sac = await GroomingModuleConfig.getSacCode();
      const gross2 = gross;
      const taxRate = gross2 > 0 ? +(Number(o.tax_total) / gross2 * 100).toFixed(2) : 0;
      await client.query(
        `INSERT INTO invoices (invoice_number, invoice_type, payment_id, issuer_details, recipient_details,
           line_items, subtotal, tax_amount, total, sac_code, tax_rate, currency)
         VALUES ($1,'grooming',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [invoiceNumber, o.payment_id,
         JSON.stringify({ name: o.providerLegal || o.providerName, gstin: o.providerGstin || null, address: o.providerAddress || null }),
         JSON.stringify({ orderNumber: o.order_number, userId }),
         JSON.stringify(items.rows.map((it: any) => ({ name: it.name, qty: it.quantity, unitPrice: Number(it.unit_price), taxPercent: Number(it.tax_percent), lineTotal: Number(it.line_total) }))),
         gross2, Number(o.tax_total), Number(o.grand_total), sac, taxRate, o.currency || 'INR']);
      await client.query(`UPDATE grooming_orders SET invoice_number = $2 WHERE id = $1`, [orderId, invoiceNumber]);

      return { orderId, status: 'confirmed', invoiceNumber, amountPaid: payAmount };
    });
  }

  /** Race-safe sequential GRM/FY invoice number (separate series from consultation VC/…). */
  private async nextGroomingInvoiceNumber(client: any): Promise<string> {
    const prefix = await GroomingModuleConfig.getInvoicePrefix();
    const fy = financialYearLabel(new Date());
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('grooming_invoice_number_seq'))`);
    const res = await client.query(`SELECT COUNT(*) AS count FROM invoices WHERE invoice_number LIKE $1`, [`${prefix}/${fy}/%`]);
    const next = parseInt(res.rows[0].count, 10) + 1;
    return `${prefix}/${fy}/${String(next).padStart(5, '0')}`;
  }
}

export default new GroomingPaymentService();
