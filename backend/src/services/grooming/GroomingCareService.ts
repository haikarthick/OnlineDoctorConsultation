import database from '../../utils/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import GroomingProviderService from './GroomingProviderService';

/**
 * P5 — the care-continuum moat: groomer→vet safety escalation and the per-pet Grooming Passport
 * (grooming history + non-medical S.C.E.N.T. wellness trend + "vet-advised" nudges). Groomers only
 * ESCALATE — they never diagnose/prescribe (enforced by role perms; no medical writes here).
 */
class GroomingCareService {
  private async loadOrder(orderId: string): Promise<any> {
    const r = await database.query(
      `SELECT id, pet_owner_id, provider_id, animal_id, status FROM grooming_orders WHERE id = $1`, [orderId]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingOrder', orderId);
    return r.rows[0];
  }

  private async requireProvider(userId: string, order: any): Promise<void> {
    const role = await GroomingProviderService.resolveProviderAccess(userId, order.provider_id);
    if (!role) throw new ForbiddenError('Provider staff access required');
  }

  private escSelect = `
    id, order_id as "orderId", raised_by as "raisedBy", issue_type as "issueType", description,
    photos, consultation_booking_id as "consultationBookingId", status, created_at as "createdAt"`;

  async raiseEscalation(userId: string, orderId: string, data: any): Promise<any> {
    const order = await this.loadOrder(orderId);
    await this.requireProvider(userId, order);
    if (!data.issueType?.trim()) throw new ValidationError('issueType is required');
    const r = await database.query(
      `INSERT INTO grooming_safety_escalations (order_id, raised_by, issue_type, description, photos, status)
       VALUES ($1,$2,$3,$4,$5,'open') RETURNING id`,
      [orderId, userId, data.issueType.trim(), data.description || null, Array.isArray(data.photos) ? data.photos : []]);
    await database.query(
      `INSERT INTO grooming_order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES ($1,$2,$2,$3,$4)`, [orderId, order.status, userId, `Safety escalation: ${data.issueType.trim()}`]);
    return this.getEscalation(r.rows[0].id);
  }

  async getEscalation(id: string): Promise<any> {
    const r = await database.query(`SELECT ${this.escSelect} FROM grooming_safety_escalations WHERE id = $1`, [id]);
    if (r.rows.length === 0) throw new NotFoundError('GroomingEscalation', id);
    return r.rows[0];
  }

  async listEscalations(userId: string, orderId: string): Promise<any[]> {
    const order = await this.loadOrder(orderId);
    if (order.pet_owner_id !== userId) await this.requireProvider(userId, order);
    const r = await database.query(
      `SELECT ${this.escSelect} FROM grooming_safety_escalations WHERE order_id = $1 ORDER BY created_at DESC`, [orderId]);
    return r.rows;
  }

  /** Owner links a booked consult / resolves; provider may dismiss. */
  async respondEscalation(userId: string, escalationId: string, data: { status: string; consultationBookingId?: string }): Promise<any> {
    const e = await database.query(
      `SELECT e.id, e.status, o.pet_owner_id, o.provider_id
       FROM grooming_safety_escalations e JOIN grooming_orders o ON o.id = e.order_id WHERE e.id = $1`, [escalationId]);
    if (e.rows.length === 0) throw new NotFoundError('GroomingEscalation', escalationId);
    const esc = e.rows[0];
    const isOwner = esc.pet_owner_id === userId;
    if (!isOwner) { const role = await GroomingProviderService.resolveProviderAccess(userId, esc.provider_id); if (!role) throw new NotFoundError('GroomingEscalation', escalationId); }
    const valid = ['owner_notified', 'consult_booked', 'resolved', 'dismissed'];
    if (!valid.includes(data.status)) throw new ValidationError('Invalid escalation status');
    await database.query(
      `UPDATE grooming_safety_escalations SET status = $2, consultation_booking_id = COALESCE($3, consultation_booking_id), updated_at = NOW() WHERE id = $1`,
      [escalationId, data.status, data.consultationBookingId || null]);
    return this.getEscalation(escalationId);
  }

  /** Per-pet grooming passport (owner only): history + S.C.E.N.T. wellness trend + vet-advised nudges. */
  async getPetPassport(userId: string, animalId: string): Promise<any> {
    const a = await database.query(`SELECT id, name, species, breed FROM animals WHERE id = $1 AND owner_id = $2`, [animalId, userId]);
    if (a.rows.length === 0) throw new ForbiddenError('This pet is not yours');
    const animal = a.rows[0];

    const orders = await database.query(
      `SELECT o.id, o.order_number as "orderNumber", o.scheduled_date as "scheduledDate", o.status,
              o.grand_total as "grandTotal", gp.business_name as "providerName", gs.name as "serviceName"
       FROM grooming_orders o
       JOIN grooming_providers gp ON gp.id = o.provider_id
       LEFT JOIN grooming_services gs ON gs.id = o.primary_service_id
       WHERE o.animal_id = $1 ORDER BY o.scheduled_date DESC`, [animalId]);

    const scentRows = await database.query(
      `SELECT gi.order_id as "orderId", gi.scent_skin as "skin", gi.scent_coat as "coat", gi.scent_ears as "ears",
              gi.scent_nails as "nails", gi.scent_teeth as "teeth", gi.scent_notes as "notes", gi.created_at as "createdAt"
       FROM grooming_intake gi JOIN grooming_orders o ON o.id = gi.order_id
       WHERE o.animal_id = $1 ORDER BY gi.created_at DESC`, [animalId]);

    // Latest non-null value per S.C.E.N.T. category (rows already newest-first) + vet-advised flags.
    const cats = ['skin', 'coat', 'ears', 'nails', 'teeth'] as const;
    const latest: Record<string, string | null> = {};
    for (const c of cats) {
      latest[c] = null;
      for (const row of scentRows.rows) { if (row[c]) { latest[c] = row[c]; break; } }
    }
    const vetAdvised = cats.filter(c => latest[c] === 'vet_advised');

    return { animal, orders: orders.rows, scentHistory: scentRows.rows, latestScent: latest, vetAdvised };
  }
}

export default new GroomingCareService();
