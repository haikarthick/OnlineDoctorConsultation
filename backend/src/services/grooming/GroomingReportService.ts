import database from '../../utils/database';
import { NotFoundError } from '../../utils/errors';
import GroomingProviderService from './GroomingProviderService';

/**
 * P7 — grooming reports. Provider report (own business) and platform report (admin), including the
 * two moat metrics: grooming→consultation escalation rate and wellness-nudge conversion.
 */
class GroomingReportService {
  async providerReport(userId: string, providerId: string, isAdmin: boolean): Promise<any> {
    if (!isAdmin) {
      const role = await GroomingProviderService.resolveProviderAccess(userId, providerId);
      if (role !== 'owner' && role !== 'manager') throw new NotFoundError('GroomingProvider', providerId);
    }
    const statusCounts = await database.query(
      `SELECT status, COUNT(*)::int AS count FROM grooming_orders WHERE provider_id = $1 GROUP BY status`, [providerId]);
    const fin = await database.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS collected,
              COALESCE(SUM(commission_amount) FILTER (WHERE status NOT IN ('draft','payment_pending','payment_expired')),0) AS commission,
              COALESCE(SUM(tax_total) FILTER (WHERE status NOT IN ('draft','payment_pending','payment_expired')),0) AS tax
       FROM grooming_orders WHERE provider_id = $1`, [providerId]);
    const earn = await database.query(
      `SELECT status, COALESCE(SUM(net_amount),0) AS total FROM grooming_earnings WHERE provider_id = $1 GROUP BY status`, [providerId]);
    const byService = await database.query(
      `SELECT COALESCE(gs.name,'—') AS name, COUNT(*)::int AS count, COALESCE(SUM(o.grand_total),0) AS revenue
       FROM grooming_orders o LEFT JOIN grooming_services gs ON gs.id = o.primary_service_id
       WHERE o.provider_id = $1 AND o.status NOT IN ('draft','payment_pending','payment_expired')
       GROUP BY gs.name ORDER BY revenue DESC LIMIT 10`, [providerId]);
    const disputes = await database.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE d.status IN ('open','under_review'))::int AS open
       FROM grooming_disputes d JOIN grooming_orders o ON o.id = d.order_id WHERE o.provider_id = $1`, [providerId]);

    const byStatus: Record<string, number> = {};
    for (const r of statusCounts.rows) byStatus[r.status] = r.count;
    const earnings: Record<string, number> = {};
    for (const r of earn.rows) earnings[r.status] = Number(r.total);
    return {
      ordersByStatus: byStatus,
      financials: fin.rows[0],
      earnings,
      revenueByService: byService.rows,
      disputes: disputes.rows[0],
    };
  }

  async platformReport(): Promise<any> {
    const providers = await database.query(`SELECT verification_status AS status, COUNT(*)::int AS count FROM grooming_providers GROUP BY 1`);
    const orders = await database.query(`SELECT status, COUNT(*)::int AS count FROM grooming_orders GROUP BY 1`);
    const fin = await database.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS collected,
              COALESCE(SUM(commission_amount) FILTER (WHERE status NOT IN ('draft','payment_pending','payment_expired')),0) AS commission
       FROM grooming_orders`);
    const ledger = await database.query(`SELECT status, COALESCE(SUM(net_amount),0) AS total FROM grooming_earnings GROUP BY status`);
    const settled = await database.query(`SELECT COALESCE(SUM(net_paid),0) AS total FROM grooming_settlements WHERE status = 'paid'`);
    const topProviders = await database.query(
      `SELECT gp.business_name AS name, COUNT(*)::int AS orders, COALESCE(SUM(o.amount_paid),0) AS revenue
       FROM grooming_orders o JOIN grooming_providers gp ON gp.id = o.provider_id
       WHERE o.status NOT IN ('draft','payment_pending','payment_expired')
       GROUP BY gp.business_name ORDER BY revenue DESC LIMIT 5`);
    const disputes = await database.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('open','under_review'))::int AS open,
              COUNT(*) FILTER (WHERE status = 'partially_refunded')::int AS refunded FROM grooming_disputes`);
    // Moat metrics
    const completed = await database.query(`SELECT COUNT(*)::int AS c FROM grooming_orders WHERE status IN ('completed','closed')`);
    const esc = await database.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('consult_booked','resolved'))::int AS converted FROM grooming_safety_escalations`);
    const completedCount = completed.rows[0].c || 0;
    const escTotal = esc.rows[0].total || 0;

    const ledgerByStatus: Record<string, number> = {};
    for (const r of ledger.rows) ledgerByStatus[r.status] = Number(r.total);
    const providersByStatus: Record<string, number> = {};
    for (const r of providers.rows) providersByStatus[r.status] = r.count;
    const ordersByStatus: Record<string, number> = {};
    for (const r of orders.rows) ordersByStatus[r.status] = r.count;

    return {
      providersByStatus,
      ordersByStatus,
      financials: fin.rows[0],
      ledger: ledgerByStatus,
      payableNow: ledgerByStatus['available'] || 0,
      totalSettled: Number(settled.rows[0].total),
      topProviders: topProviders.rows,
      disputes: disputes.rows[0],
      moat: {
        escalationRatePct: completedCount > 0 ? +(escTotal / completedCount * 100).toFixed(1) : 0,
        wellnessNudgeConversionPct: escTotal > 0 ? +(esc.rows[0].converted / escTotal * 100).toFixed(1) : 0,
        escalations: escTotal,
      },
    };
  }
}

export default new GroomingReportService();
