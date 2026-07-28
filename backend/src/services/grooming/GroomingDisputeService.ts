import database from '../../utils/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import GroomingProviderService from './GroomingProviderService';

/**
 * P6 — grooming disputes & refunds. Owner raises a dispute on a completed order; provider/admin
 * respond (resolve / partial refund / reject). A refund is recorded as a negative
 * 'refund_adjustment' entry on the dedicated grooming_earnings ledger so the provider's payable
 * balance drops without touching consultation finances (platform bears no cost — decision 12.2).
 */
const DISPUTE_SELECT = `
  d.id, d.order_id as "orderId", d.raised_by as "raisedBy", d.reason, d.comments, d.images,
  d.requested_resolution as "requestedResolution", d.status, d.resolution_note as "resolutionNote",
  d.resolved_by as "resolvedBy", d.resolved_at as "resolvedAt", d.created_at as "createdAt"`;

class GroomingDisputeService {
  private async loadOrder(orderId: string): Promise<any> {
    const r = await database.query(`SELECT id, pet_owner_id, provider_id, status, amount_paid FROM grooming_orders WHERE id = $1`, [orderId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
    return r.rows[0];
  }

  async getDispute(id: string): Promise<any> {
    const r = await database.query(`SELECT ${DISPUTE_SELECT} FROM grooming_disputes d WHERE d.id = $1`, [id]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingDispute', id);
    return r.rows[0];
  }

  async raiseDispute(userId: string, orderId: string, data: any): Promise<any> {
    const order = await this.loadOrder(orderId);
    if (order.pet_owner_id !== userId) throw new ForbiddenError('Only the customer can raise a dispute');
    if (!['completed', 'closed', 'ready_for_pickup'].includes(order.status))
      throw new ValidationError('Disputes can only be raised on a completed order');
    if (!data.reason?.trim()) throw new ValidationError('reason is required');
    const existing = await database.query(
      `SELECT 1 FROM grooming_disputes WHERE order_id = $1 AND status IN ('open','under_review')`, [orderId]);
    if (existing.rows.length > 0) throw new ValidationError('An open dispute already exists for this order');
    const r = await database.query(
      `INSERT INTO grooming_disputes (order_id, raised_by, reason, comments, images, requested_resolution, status)
       VALUES ($1,$2,$3,$4,$5,$6,'open') RETURNING id`,
      [orderId, userId, data.reason.trim(), data.comments || null, Array.isArray(data.images) ? data.images : [],
       data.requestedResolution || null]);
    await database.query(`UPDATE grooming_orders SET status = 'disputed', updated_at = NOW() WHERE id = $1`, [orderId]);
    return this.getDispute(r.rows[0].id);
  }

  async listMyDisputes(userId: string): Promise<any[]> {
    const r = await database.query(
      `SELECT ${DISPUTE_SELECT}, o.order_number as "orderNumber", gp.business_name as "providerName"
       FROM grooming_disputes d JOIN grooming_orders o ON o.id = d.order_id
       JOIN grooming_providers gp ON gp.id = o.provider_id
       WHERE d.raised_by = $1 ORDER BY d.created_at DESC`, [userId]);
    return r.rows;
  }

  async listProviderDisputes(userId: string, providerId: string): Promise<any[]> {
    const role = await GroomingProviderService.resolveProviderAccess(userId, providerId);
    if (role !== 'owner' && role !== 'manager') throw new NotFoundError('GroomingProvider', providerId);
    const r = await database.query(
      `SELECT ${DISPUTE_SELECT}, o.order_number as "orderNumber"
       FROM grooming_disputes d JOIN grooming_orders o ON o.id = d.order_id
       WHERE o.provider_id = $1 ORDER BY d.created_at DESC`, [providerId]);
    return r.rows;
  }

  async adminListDisputes(status?: string): Promise<any[]> {
    const params: any[] = []; let where = '';
    if (status) { params.push(status); where = 'WHERE d.status = $1'; }
    const r = await database.query(
      `SELECT ${DISPUTE_SELECT}, o.order_number as "orderNumber", o.grand_total as "grandTotal",
              gp.business_name as "providerName", u.email as "customerEmail"
       FROM grooming_disputes d JOIN grooming_orders o ON o.id = d.order_id
       JOIN grooming_providers gp ON gp.id = o.provider_id
       LEFT JOIN users u ON u.id = d.raised_by ${where} ORDER BY d.created_at ASC`, params);
    return r.rows;
  }

  /** Provider staff or admin responds. A refundAmount books a negative earnings adjustment. */
  async respondDispute(userId: string, isAdmin: boolean, disputeId: string, data: { status: string; resolutionNote?: string; refundAmount?: number }): Promise<any> {
    const d = await database.query(
      `SELECT d.id, d.status, d.order_id, o.provider_id FROM grooming_disputes d
       JOIN grooming_orders o ON o.id = d.order_id WHERE d.id = $1`, [disputeId]);
    if (d.rows.length === 0) throw new NotFoundError('GroomingDispute', disputeId);
    const dispute = d.rows[0];
    if (!isAdmin) { const role = await GroomingProviderService.resolveProviderAccess(userId, dispute.provider_id);
      if (role !== 'owner' && role !== 'manager') throw new NotFoundError('GroomingDispute', disputeId); }
    const valid = ['under_review', 'resolved', 'partially_refunded', 'rejected'];
    if (!valid.includes(data.status)) throw new ValidationError('Invalid dispute status');
    const refund = Number(data.refundAmount) || 0;
    if (refund < 0) throw new ValidationError('refundAmount cannot be negative');

    const result = await database.transaction(async (client: any) => {
      // $2 is cast explicitly at BOTH uses. Assigned to a varchar column and compared against
      // string literals, Postgres deduced it as varchar in one place and text in the other and
      // rejected the whole statement ("inconsistent types deduced for parameter $2" / 42P08) —
      // which meant every dispute response 500'd and no dispute could ever be resolved.
      await client.query(
        `UPDATE grooming_disputes SET status = $2::varchar, resolution_note = COALESCE($3, resolution_note),
                resolved_by = $4,
                resolved_at = CASE WHEN $2::varchar IN ('resolved','partially_refunded','rejected') THEN NOW() ELSE resolved_at END,
                updated_at = NOW()
         WHERE id = $1`, [disputeId, data.status, data.resolutionNote || null, userId]);
      if (['resolved', 'partially_refunded', 'rejected'].includes(data.status)) {
        await client.query(`UPDATE grooming_orders SET status = 'closed', updated_at = NOW() WHERE id = $1 AND status = 'disputed'`, [dispute.order_id]);
      }
      const r = await client.query(`SELECT ${DISPUTE_SELECT} FROM grooming_disputes d WHERE d.id = $1`, [disputeId]);
      return r.rows[0];
    });

    // The agreed refund must actually reach the customer. This used to insert only a negative
    // provider-ledger entry, which reduced what the platform owed the provider but returned
    // nothing to the person who paid. The refund service performs both legs (customer money out,
    // provider ledger debited) and caps the total at what was collected.
    if (refund > 0 && ['resolved', 'partially_refunded'].includes(data.status)) {
      const GroomingRefundService = (await import('./GroomingRefundService')).default;
      await GroomingRefundService.refundDiscretionary(
        dispute.order_id, refund, `Refund for dispute ${disputeId}`);
    }
    return result;
  }
}

export default new GroomingDisputeService();
