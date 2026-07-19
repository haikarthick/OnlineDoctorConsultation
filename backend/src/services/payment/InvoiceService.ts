import { v4 as uuidv4 } from 'uuid';
import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import PaymentModuleConfig from './PaymentModuleConfig';

/**
 * GST & invoicing (docs/PAYMENT_MODULE_PLAN.md §7, D8/D13).
 *
 * Two invoice streams:
 *  - consultation: doctor → patient (issued via the platform). Veterinary
 *    healthcare is GST-exempt by default (SAC 998351 pets / 998352 livestock,
 *    rate 0) — rates live in tax_codes and are fully admin-editable (D13).
 *  - commission: platform → doctor per settlement (SAC 998599, default 18%).
 *
 * Amounts are treated as TAX-INCLUSIVE (tax = total × r / (100 + r)) so an
 * admin rate change never alters what was already collected — it only changes
 * how future invoices break the same total down. Invoices are immutable
 * snapshots; numbering is financial-year sequential (VC/2026-27/00001) and
 * race-safe via an advisory lock.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function financialYearLabel(d: Date): string {
  // Indian FY: Apr 1 – Mar 31
  const y = d.getFullYear();
  const fyStart = d.getMonth() >= 3 ? y : y - 1;
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

class InvoiceService {
  private async getTaxCode(sacCode: string): Promise<{ ratePercent: number; label: string }> {
    const res = await database.query(
      `SELECT rate_percent, label FROM tax_codes WHERE sac_code = $1 AND is_active = true`,
      [sacCode]
    );
    if (res.rows.length === 0) return { ratePercent: 0, label: sacCode };
    return { ratePercent: parseFloat(String(res.rows[0].rate_percent)), label: res.rows[0].label };
  }

  /** Race-safe sequential invoice number within the financial year. */
  private async nextInvoiceNumber(client: any): Promise<string> {
    const prefix = await PaymentModuleConfig.getString('tax.invoicePrefix', 'VC');
    const fy = financialYearLabel(new Date());
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('invoice_number_seq'))`);
    const res = await client.query(
      `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE $1`,
      [`${prefix}/${fy}/%`]
    );
    const next = parseInt(res.rows[0].count, 10) + 1;
    return `${prefix}/${fy}/${String(next).padStart(5, '0')}`;
  }

  /** Consultation invoice — created when a payment completes (idempotent per payment). */
  async createConsultationInvoice(paymentId: string): Promise<void> {
    if (!(await PaymentModuleConfig.isEnabled())) return;
    try {
      const existing = await database.query(
        `SELECT id FROM invoices WHERE payment_id = $1 AND invoice_type = 'consultation' LIMIT 1`,
        [paymentId]
      );
      if (existing.rows.length > 0) return;

      const res = await database.query(
        `SELECT p.id, p.amount, p.currency,
                b.enterprise_id, b.booking_type, b.scheduled_date,
                CONCAT(po.first_name, ' ', po.last_name) as patient_name, po.email as patient_email,
                CONCAT('Dr. ', v.first_name, ' ', v.last_name) as doctor_name,
                vp.gstin as doctor_gstin, vp.clinic_name,
                e.name as enterprise_name,
                a.species
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         LEFT JOIN users po ON po.id = p.user_id
         LEFT JOIN users v ON v.id = p.payee_id
         LEFT JOIN vet_profiles vp ON vp.user_id = p.payee_id
         LEFT JOIN enterprises e ON e.id = b.enterprise_id
         LEFT JOIN animals a ON a.id = b.animal_id
         WHERE p.id = $1 AND p.status IN ('completed', 'partially_refunded')`,
        [paymentId]
      );
      if (res.rows.length === 0) return;
      const r = res.rows[0];

      // Livestock/farm context → 998352, otherwise pet services 998351
      const sacCode = r.enterprise_id ? '998352' : '998351';
      const tax = await this.getTaxCode(sacCode);
      const total = parseFloat(String(r.amount));
      const taxAmount = tax.ratePercent > 0 ? round2(total * tax.ratePercent / (100 + tax.ratePercent)) : 0;
      const subtotal = round2(total - taxAmount);
      const platformName = await PaymentModuleConfig.getString('tax.platformLegalName', 'VetCare Platform');
      const platformGstin = await PaymentModuleConfig.getString('tax.platformGstin', '');

      const client = await database.getPool().connect();
      try {
        await client.query('BEGIN');
        const invoiceNumber = await this.nextInvoiceNumber(client);
        await client.query(
          `INSERT INTO invoices (id, invoice_number, invoice_type, payment_id,
            issuer_details, recipient_details, line_items, subtotal, tax_amount, total,
            sac_code, tax_rate, currency, issued_at, created_at)
           VALUES ($1, $2, 'consultation', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [uuidv4(), invoiceNumber, paymentId,
           JSON.stringify({
             name: r.doctor_name, clinic: r.clinic_name || null, gstin: r.doctor_gstin || null,
             facilitatedBy: platformName, platformGstin: platformGstin || null,
           }),
           JSON.stringify({
             name: r.enterprise_name || r.patient_name, email: r.patient_email,
             enterprise: r.enterprise_name || null,
           }),
           JSON.stringify([{
             description: `Veterinary consultation (${r.booking_type || 'video_call'})`,
             sacCode, sacLabel: tax.label, quantity: 1, amount: total,
           }]),
           subtotal, taxAmount, total, sacCode, tax.ratePercent, r.currency || 'INR']
        );
        await client.query('COMMIT');
        logger.info('Consultation invoice created', { paymentId, invoiceNumber });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      logger.error('createConsultationInvoice failed (non-blocking)', { paymentId, error: err.message });
    }
  }

  /** Commission invoice — platform → doctor, created on settlement (idempotent per withdrawal). */
  async createCommissionInvoice(withdrawalId: string): Promise<void> {
    if (!(await PaymentModuleConfig.isEnabled())) return;
    try {
      const existing = await database.query(
        `SELECT id FROM invoices WHERE withdrawal_id = $1 AND invoice_type = 'commission' LIMIT 1`,
        [withdrawalId]
      );
      if (existing.rows.length > 0) return;

      const res = await database.query(
        `SELECT wr.id, wr.doctor_id,
                CONCAT('Dr. ', u.first_name, ' ', u.last_name) as doctor_name, u.email as doctor_email,
                vp.gstin as doctor_gstin,
                COALESCE(SUM(de.commission_amount) FILTER (WHERE de.type = 'consultation'), 0) as commission_total,
                COUNT(*) FILTER (WHERE de.type = 'consultation') as consult_count
         FROM withdrawal_requests wr
         JOIN users u ON u.id = wr.doctor_id
         LEFT JOIN vet_profiles vp ON vp.user_id = wr.doctor_id
         LEFT JOIN doctor_earnings de ON de.withdrawal_id = wr.id
         WHERE wr.id = $1 AND wr.status = 'settled'
         GROUP BY wr.id, wr.doctor_id, u.first_name, u.last_name, u.email, vp.gstin`,
        [withdrawalId]
      );
      if (res.rows.length === 0) return;
      const r = res.rows[0];
      const commissionTotal = round2(parseFloat(String(r.commission_total)));
      if (commissionTotal <= 0) return; // nothing to invoice (e.g. compensation-only settlement)

      const tax = await this.getTaxCode('998599');
      const taxAmount = tax.ratePercent > 0 ? round2(commissionTotal * tax.ratePercent / (100 + tax.ratePercent)) : 0;
      const subtotal = round2(commissionTotal - taxAmount);
      const platformName = await PaymentModuleConfig.getString('tax.platformLegalName', 'VetCare Platform');
      const platformGstin = await PaymentModuleConfig.getString('tax.platformGstin', '');

      const client = await database.getPool().connect();
      try {
        await client.query('BEGIN');
        const invoiceNumber = await this.nextInvoiceNumber(client);
        await client.query(
          `INSERT INTO invoices (id, invoice_number, invoice_type, withdrawal_id,
            issuer_details, recipient_details, line_items, subtotal, tax_amount, total,
            sac_code, tax_rate, currency, issued_at, created_at)
           VALUES ($1, $2, 'commission', $3, $4, $5, $6, $7, $8, $9, '998599', $10, 'INR', NOW(), NOW())`,
          [uuidv4(), invoiceNumber, withdrawalId,
           JSON.stringify({ name: platformName, gstin: platformGstin || null }),
           JSON.stringify({ name: r.doctor_name, email: r.doctor_email, gstin: r.doctor_gstin || null }),
           JSON.stringify([{
             description: `Platform facilitation commission (${r.consult_count} consultation(s), settlement ${withdrawalId.substring(0, 8)})`,
             sacCode: '998599', sacLabel: tax.label, quantity: 1, amount: commissionTotal,
           }]),
           subtotal, taxAmount, commissionTotal, tax.ratePercent]
        );
        await client.query('COMMIT');
        logger.info('Commission invoice created', { withdrawalId, invoiceNumber, commissionTotal });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      logger.error('createCommissionInvoice failed (non-blocking)', { withdrawalId, error: err.message });
    }
  }

  /** Fetch an invoice with access control (payer, payee/doctor, or admin). */
  async getInvoice(invoiceId: string, requesterId: string, requesterRole: string): Promise<any> {
    const res = await database.query(
      `SELECT i.*, p.user_id as payer_id, p.payee_id, wr.doctor_id
       FROM invoices i
       LEFT JOIN payments p ON p.id = i.payment_id
       LEFT JOIN withdrawal_requests wr ON wr.id = i.withdrawal_id
       WHERE i.id = $1`,
      [invoiceId]
    );
    if (res.rows.length === 0) throw new NotFoundError('Invoice', invoiceId);
    const inv = res.rows[0];
    const allowed = requesterRole === 'admin'
      || inv.payer_id === requesterId || inv.payee_id === requesterId || inv.doctor_id === requesterId;
    if (!allowed) throw new ForbiddenError('You do not have access to this invoice');
    return this.mapInvoice(inv);
  }

  async getInvoiceByPayment(paymentId: string, requesterId: string, requesterRole: string): Promise<any | null> {
    const res = await database.query(
      `SELECT i.*, p.user_id as payer_id, p.payee_id, NULL as doctor_id
       FROM invoices i JOIN payments p ON p.id = i.payment_id
       WHERE i.payment_id = $1 AND i.invoice_type = 'consultation' LIMIT 1`,
      [paymentId]
    );
    if (res.rows.length === 0) return null;
    const inv = res.rows[0];
    const allowed = requesterRole === 'admin' || inv.payer_id === requesterId || inv.payee_id === requesterId;
    if (!allowed) throw new ForbiddenError('You do not have access to this invoice');
    return this.mapInvoice(inv);
  }

  /** GST export (§7): commission invoices (taxable) + exempt consultation register, CSV. */
  async gstExportCsv(from: string, to: string): Promise<string> {
    const res = await database.query(
      `SELECT invoice_number, invoice_type, subtotal, tax_amount, total, sac_code, tax_rate,
              issued_at, recipient_details
       FROM invoices
       WHERE issued_at >= $1::date AND issued_at < ($2::date + INTERVAL '1 day')
       ORDER BY issued_at ASC`,
      [from, to]
    );
    const header = 'invoice_number,type,issued_date,recipient,sac_code,tax_rate_percent,taxable_value,tax_amount,total';
    const lines = res.rows.map((r: any) => {
      let recipient = '';
      try {
        const d = typeof r.recipient_details === 'string' ? JSON.parse(r.recipient_details) : r.recipient_details;
        recipient = (d?.name || '').replace(/[",\n]/g, ' ');
      } catch { /* leave blank */ }
      const issued = r.issued_at ? new Date(r.issued_at).toISOString().split('T')[0] : '';
      return `${r.invoice_number},${r.invoice_type},${issued},"${recipient}",${r.sac_code || ''},${r.tax_rate || 0},${r.subtotal},${r.tax_amount},${r.total}`;
    });
    return [header, ...lines].join('\n');
  }

  private mapInvoice(inv: any): any {
    const parse = (v: any) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
      return v;
    };
    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceType: inv.invoice_type,
      paymentId: inv.payment_id,
      withdrawalId: inv.withdrawal_id,
      issuerDetails: parse(inv.issuer_details),
      recipientDetails: parse(inv.recipient_details),
      lineItems: parse(inv.line_items) || [],
      subtotal: parseFloat(String(inv.subtotal)),
      taxAmount: parseFloat(String(inv.tax_amount)),
      total: parseFloat(String(inv.total)),
      sacCode: inv.sac_code,
      taxRate: parseFloat(String(inv.tax_rate || 0)),
      currency: inv.currency,
      issuedAt: inv.issued_at,
    };
  }
}

export default new InvoiceService();
