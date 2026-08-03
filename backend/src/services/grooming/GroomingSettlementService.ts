import database from '../../utils/database';
import logger from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import GroomingProviderService from './GroomingProviderService';
import GroomingModuleConfig from './GroomingModuleConfig';

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

  /**
   * Platform-wide maturity sweep for the scheduler. releaseMatured() above is per-provider and
   * only ran when someone happened to LOOK at a provider's earnings, so a provider who never
   * opened the screen could sit on matured money that still showed as clearing. Consultations
   * have had a scheduled equivalent all along; grooming now has its own.
   */
  async releaseAllMatured(): Promise<number> {
    if (!(await GroomingModuleConfig.isEnabled())) return 0;
    const res = await database.query(
      `UPDATE grooming_earnings SET status = 'available', updated_at = NOW()
       WHERE status = 'clearing' AND available_at IS NOT NULL AND available_at <= NOW()
       RETURNING id`);
    if (res.rows.length > 0) logger.info(`[Grooming] Matured ${res.rows.length} earning(s) to available`);
    return res.rows.length;
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

  /**
   * THE PAYABLES REGISTER - "who do I owe, and how much, right now".
   *
   * This did not exist. adminReconciliation() returned platform-wide totals only, and the
   * per-provider earnings route needed a providerId the admin had to already know. With manual
   * settlement that meant there was no way to answer the basic operational question without
   * guessing which provider to look at, so a provider could sit unpaid indefinitely simply by
   * not being checked.
   *
   * Ordered by payable amount so the largest debts surface first, and every row carries the
   * things needed to actually pay it: bank/UPI details, how long the money has been waiting,
   * and when they were last paid.
   */
  async adminPayables(): Promise<any> {
    // Mature everything platform-wide first, or a provider whose money came due minutes ago
    // would be reported as 'clearing' and skipped.
    await this.releaseAllMatured();

    const r = await database.query(
      `SELECT gp.id AS "providerId", gp.business_name AS "businessName", gp.legal_name AS "legalName",
              gp.gstin, gp.verification_status AS "verificationStatus",
              gp.payout_account_name AS "payoutAccountName", gp.payout_account_number AS "payoutAccountNumber",
              gp.payout_ifsc AS "payoutIfsc", gp.payout_upi AS "payoutUpi",
              u.email AS "ownerEmail",
              COALESCE(SUM(ge.net_amount) FILTER (WHERE ge.status = 'available'), 0) AS "payableNow",
              COALESCE(SUM(ge.net_amount) FILTER (WHERE ge.status = 'clearing'), 0) AS "clearing",
              COALESCE(SUM(ge.net_amount) FILTER (WHERE ge.status = 'paid'), 0) AS "paidToDate",
              COUNT(*) FILTER (WHERE ge.status = 'available') AS "entryCount",
              MIN(ge.created_at) FILTER (WHERE ge.status = 'available') AS "oldestAvailableAt",
              (SELECT MAX(settled_at) FROM grooming_settlements s
                WHERE s.provider_id = gp.id AND s.status = 'paid') AS "lastSettledAt"
       FROM grooming_providers gp
       JOIN users u ON u.id = gp.owner_user_id
       LEFT JOIN grooming_earnings ge ON ge.provider_id = gp.id
       GROUP BY gp.id, u.email
       HAVING COALESCE(SUM(ge.net_amount) FILTER (WHERE ge.status IN ('available','clearing')), 0) <> 0
       ORDER BY COALESCE(SUM(ge.net_amount) FILTER (WHERE ge.status = 'available'), 0) DESC`);

    const rows = r.rows.map((x: any) => {
      const payableNow = Number(x.payableNow);
      const hasBank = !!(x.payoutAccountNumber && x.payoutIfsc);
      return {
        ...x,
        payableNow,
        clearing: Number(x.clearing),
        paidToDate: Number(x.paidToDate),
        entryCount: Number(x.entryCount),
        // Surfaces the two reasons a payable cannot actually be paid today, rather than letting
        // the admin discover them only after clicking Settle.
        canPay: payableNow > 0 && (hasBank || !!x.payoutUpi),
        missingPayoutDetails: payableNow > 0 && !hasBank && !x.payoutUpi,
        ageDays: x.oldestAvailableAt
          ? Math.floor((Date.now() - new Date(x.oldestAvailableAt).getTime()) / 86400000) : null,
      };
    });

    return {
      providers: rows,
      totalPayableNow: +rows.reduce((s: number, x: any) => s + x.payableNow, 0).toFixed(2),
      totalClearing: +rows.reduce((s: number, x: any) => s + x.clearing, 0).toFixed(2),
      blockedCount: rows.filter((x: any) => x.missingPayoutDetails).length,
    };
  }

  /** Everything a provider needs to reconcile one payout: the settlement + the entries it paid. */
  async getSettlementStatement(userId: string, settlementId: string, isAdmin: boolean): Promise<any> {
    const s = await database.query(
      `SELECT gs.id, gs.provider_id as "providerId", gs.amount, gs.tds_amount as "tdsAmount",
              gs.net_paid as "netPaid", gs.method, gs.reference, gs.status,
              gs.period_from as "periodFrom", gs.period_to as "periodTo", gs.notes,
              gs.settled_at as "settledAt", gs.created_at as "createdAt",
              gp.business_name as "businessName", gp.legal_name as "legalName", gp.gstin
       FROM grooming_settlements gs
       JOIN grooming_providers gp ON gp.id = gs.provider_id
       WHERE gs.id = $1`, [settlementId]);
    if (s.rows.length === 0) throw new NotFoundError('GroomingSettlement', settlementId);
    const statement = s.rows[0];
    if (!isAdmin) await this.requireProviderView(userId, statement.providerId);

    const lines = await database.query(
      `SELECT ge.id, ge.order_id as "orderId", o.order_number as "orderNumber",
              ge.gross_amount as "grossAmount", ge.commission_amount as "commissionAmount",
              ge.net_amount as "netAmount", ge.entry_type as "entryType", ge.created_at as "createdAt"
       FROM grooming_earnings ge
       LEFT JOIN grooming_orders o ON o.id = ge.order_id
       WHERE ge.settlement_id = $1 ORDER BY ge.created_at ASC`, [settlementId]);
    statement.lines = lines.rows;
    return statement;
  }

  /**
   * Admin records a manual payout: pays out all currently-available earnings for the provider.
   *
   * A payment reference is now REQUIRED. Manual settlement means the money moves outside this
   * system, so the reference is the only evidence that it happened - without it neither side can
   * prove a payout, and the provider was previously told nothing at all.
   */
  async adminSettle(adminId: string, providerId: string, data: { method?: string; reference?: string; tdsAmount?: number; notes?: string }): Promise<any> {
    if (!data.reference?.trim())
      throw new ValidationError('A payment reference (UTR/transaction ID) is required so the provider has evidence of payment.');
    await this.releaseMatured(providerId);
    const settlement = await database.transaction(async (client: any) => {
      const avail = await client.query(
        `SELECT id, net_amount, created_at FROM grooming_earnings
         WHERE provider_id = $1 AND status = 'available' FOR UPDATE`, [providerId]);
      if (avail.rows.length === 0) throw new ValidationError('No available earnings to settle');
      const amount = +avail.rows.reduce((s: number, r: any) => s + Number(r.net_amount), 0).toFixed(2);
      // TDS defaults to the configured grooming rate rather than 0 - an admin who forgets to type
      // a figure was previously paying out gross and under-withholding. An explicit tdsAmount
      // (including 0) still wins, so a manual override remains possible.
      const tds = data.tdsAmount !== undefined && data.tdsAmount !== null
        ? +(Number(data.tdsAmount) || 0).toFixed(2)
        : +(amount * (await GroomingModuleConfig.getTdsRatePercent()) / 100).toFixed(2);
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
      return { ...r.rows[0], entryCount: avail.rows.length, periodFrom, periodTo };
    });

    // Tell the provider they have been paid, with the evidence. Previously nothing was sent at
    // all: money left the platform and the vendor had no way to know it had happened, which is
    // what makes a manual settlement process fall apart in practice. Non-blocking - the payout
    // is already recorded and must not be rolled back by a notification failure.
    try {
      const owner = await database.query(
        `SELECT gp.owner_user_id AS "ownerUserId", gp.business_name AS "businessName"
         FROM grooming_providers gp WHERE gp.id = $1`, [providerId]);
      const ownerUserId = owner.rows[0]?.ownerUserId;
      if (ownerUserId) {
        const NotificationService = (await import('../NotificationService')).default;
        const period = `${new Date(settlement.periodFrom).toLocaleDateString('en-IN')}-${new Date(settlement.periodTo).toLocaleDateString('en-IN')}`;
        const tdsLine = Number(settlement.tdsAmount) > 0
          ? ` after ${Number(settlement.tdsAmount).toFixed(2)} TDS withheld` : '';
        await NotificationService.createNotification(
          ownerUserId, 'payment', 'Payout sent',
          `We've paid you ${Number(settlement.netPaid).toFixed(2)} for ${settlement.entryCount} completed `
          + `booking(s) (${period})${tdsLine}. `
          + `Paid by ${String(settlement.method).replace(/_/g, ' ')}, reference ${settlement.reference}. `
          + `Open Earnings & Payouts to see the full statement of what this covers.`,
          'all', { settlementId: settlement.id, reference: settlement.reference, netPaid: settlement.netPaid });
      }
    } catch (err: any) {
      logger.warn('Grooming settlement notification failed (non-blocking)', { providerId, error: err.message });
    }

    logger.info('Grooming settlement recorded', {
      providerId, adminId, settlementId: settlement.id, netPaid: settlement.netPaid, reference: settlement.reference,
    });
    return settlement;
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
