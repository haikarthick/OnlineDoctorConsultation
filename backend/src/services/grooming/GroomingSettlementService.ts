import database from '../../utils/database';
import { NotFoundError, ValidationError } from '../../utils/errors';
import GroomingProviderService from './GroomingProviderService';

/**
 * Grooming provider earnings + MANUAL settlement (P3). No escrow: the platform collects (MoR),
 * tracks provider dues in the dedicated grooming_earnings ledger (clearing → available after the
 * clearance window), and an admin reconciles + records manual payouts in grooming_settlements.
 * Kept fully separate from doctor_earnings (owner decision 12.2).
 */
class GroomingSettlementService {
  /** Move matured clearing entries to available (idempotent; called when earnings are viewed/settled). */
  async releaseMatured(providerId: string): Promise<void> {
    await database.query(
      `UPDATE grooming_earnings SET status = 'available', updated_at = NOW()
       WHERE provider_id = $1 AND status = 'clearing' AND available_at IS NOT NULL AND available_at <= NOW()`,
      [providerId]);
  }

  private async requireProviderView(userId: string, providerId: string): Promise<void> {
    const role = await GroomingProviderService.resolveProviderAccess(userId, providerId);
    if (role !== 'owner' && role !== 'manager') throw new NotFoundError('GroomingProvider', providerId);
  }

  async getEarnings(userId: string, providerId: string): Promise<any> {
    await this.requireProviderView(userId, providerId);
    await this.releaseMatured(providerId);
    return this.buildEarnings(providerId);
  }

  /** Admin variant (no provider-membership requirement). */
  async getEarningsAdmin(providerId: string): Promise<any> {
    await this.releaseMatured(providerId);
    return this.buildEarnings(providerId);
  }

  private async buildEarnings(providerId: string): Promise<any> {
    const summary = await database.query(
      `SELECT
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'clearing'), 0) AS clearing,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'available'), 0) AS available,
         COALESCE(SUM(net_amount) FILTER (WHERE status = 'paid'), 0) AS paid,
         COALESCE(SUM(gross_amount) FILTER (WHERE status <> 'reversed'), 0) AS gross,
         COALESCE(SUM(commission_amount) FILTER (WHERE status <> 'reversed'), 0) AS commission
       FROM grooming_earnings WHERE provider_id = $1`, [providerId]);
    const entries = await database.query(
      `SELECT ge.id, ge.order_id as "orderId", o.order_number as "orderNumber",
              ge.gross_amount as "grossAmount", ge.commission_amount as "commissionAmount",
              ge.tax_amount as "taxAmount", ge.net_amount as "netAmount", ge.entry_type as "entryType",
              ge.status, ge.available_at as "availableAt", ge.settlement_id as "settlementId", ge.created_at as "createdAt"
       FROM grooming_earnings ge LEFT JOIN grooming_orders o ON o.id = ge.order_id
       WHERE ge.provider_id = $1 ORDER BY ge.created_at DESC LIMIT 200`, [providerId]);
    return { summary: summary.rows[0], entries: entries.rows };
  }

  async listSettlements(userId: string, providerId: string, isAdmin: boolean): Promise<any[]> {
    if (!isAdmin) await this.requireProviderView(userId, providerId);
    const r = await database.query(
      `SELECT id, provider_id as "providerId", amount, tds_amount as "tdsAmount", net_paid as "netPaid",
              method, reference, status, period_from as "periodFrom", period_to as "periodTo",
              notes, settled_at as "settledAt", created_at as "createdAt"
       FROM grooming_settlements WHERE provider_id = $1 ORDER BY created_at DESC`, [providerId]);
    return r.rows;
  }

  /** Admin records a manual payout: pays out all currently-available earnings for the provider. */
  async adminSettle(adminId: string, providerId: string, data: { method?: string; reference?: string; tdsAmount?: number; notes?: string }): Promise<any> {
    await this.releaseMatured(providerId);
    return database.transaction(async (client: any) => {
      const avail = await client.query(
        `SELECT id, net_amount, created_at FROM grooming_earnings
         WHERE provider_id = $1 AND status = 'available' FOR UPDATE`, [providerId]);
      if (avail.rows.length === 0) throw new ValidationError('No available earnings to settle');
      const amount = +avail.rows.reduce((s: number, r: any) => s + Number(r.net_amount), 0).toFixed(2);
      const tds = +(Number(data.tdsAmount) || 0).toFixed(2);
      const netPaid = +(amount - tds).toFixed(2);
      const dates = avail.rows.map((r: any) => new Date(r.created_at));
      const periodFrom = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
      const periodTo = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
      const s = await client.query(
        `INSERT INTO grooming_settlements
           (provider_id, amount, tds_amount, net_paid, method, reference, status, period_from, period_to, notes, settled_by, settled_at)
         VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$9,$10,NOW()) RETURNING id`,
        [providerId, amount, tds, netPaid, data.method || 'bank_transfer', data.reference || null,
         periodFrom, periodTo, data.notes || null, adminId]);
      const settlementId = s.rows[0].id;
      await client.query(
        `UPDATE grooming_earnings SET status = 'paid', settlement_id = $2, updated_at = NOW()
         WHERE provider_id = $1 AND status = 'available'`, [providerId, settlementId]);
      const r = await client.query(
        `SELECT id, amount, tds_amount as "tdsAmount", net_paid as "netPaid", method, reference, status,
                settled_at as "settledAt" FROM grooming_settlements WHERE id = $1`, [settlementId]);
      return r.rows[0];
    });
  }

  /** Platform-wide reconciliation snapshot for admin. */
  async adminReconciliation(): Promise<any> {
    const orders = await database.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'confirmed' OR status NOT IN ('draft','payment_pending','payment_expired','cancelled_by_customer','cancelled_by_provider','no_show')) AS active_orders,
         COALESCE(SUM(amount_paid), 0) AS collected,
         COALESCE(SUM(commission_amount) FILTER (WHERE status NOT IN ('draft','payment_pending','payment_expired')), 0) AS commission,
         COALESCE(SUM(tax_total) FILTER (WHERE status NOT IN ('draft','payment_pending','payment_expired')), 0) AS tax
       FROM grooming_orders`);
    const ledger = await database.query(
      `SELECT status, COALESCE(SUM(net_amount),0) AS total FROM grooming_earnings GROUP BY status`);
    const settled = await database.query(`SELECT COALESCE(SUM(net_paid),0) AS total FROM grooming_settlements WHERE status = 'paid'`);
    const byStatus: Record<string, number> = {};
    for (const row of ledger.rows) byStatus[row.status] = Number(row.total);
    return {
      orders: orders.rows[0],
      ledger: byStatus,
      totalSettled: Number(settled.rows[0].total),
      payableNow: byStatus['available'] || 0,
      clearing: byStatus['clearing'] || 0,
    };
  }
}

export default new GroomingSettlementService();
