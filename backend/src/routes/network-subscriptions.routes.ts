import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import {
  createNetworkPlanSchema, updateNetworkPlanSchema,
  setNetworkSubscriptionSchema, overrideSeatLimitSchema,
  suspendNetworkSchema,
} from '../middleware/validation';

const router = Router();

// NETWORK SUBSCRIPTION PLANS (platform admin only)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/network-subscription-plans', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const isAdmin = authReq.userRole === 'admin';
  const result = await db.query(
    isAdmin
      ? `SELECT * FROM network_subscription_plans ORDER BY sort_order, name`
      : `SELECT id, name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, sort_order FROM network_subscription_plans WHERE is_published = true AND is_active = true ORDER BY sort_order, name`
  );
  res.json({ success: true, data: result.rows });
}));

router.post('/admin/network-subscription-plans', authMiddleware, roleMiddleware(['admin']), validateBody(createNetworkPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, is_published, sort_order } = req.body;
  const result = await db.query(
    `INSERT INTO network_subscription_plans (name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, is_published, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [name, description||null, max_seats||null, max_hospitals||null, price_monthly||null, price_annually||null, currency||'INR', features ? JSON.stringify(features) : '{}', is_published||false, sort_order||0]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.put('/admin/network-subscription-plans/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateNetworkPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const allowedFields = ['name','description','max_seats','max_hospitals','price_monthly','price_annually','currency','features','is_published','sort_order','is_active'];
  const fields = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowedFields.includes(k)));
  if (Object.keys(fields).length === 0) return res.status(400).json({ success: false, message: 'No valid fields to update' });
  const setClauses = Object.keys(fields).map((k, i) => `"${k}" = $${i + 2}`).join(', ');
  const values = Object.values(fields);
  const result = await db.query(`UPDATE network_subscription_plans SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id, ...values]);
  if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Plan not found' });
  res.json({ success: true, data: result.rows[0] });
}));

router.delete('/admin/network-subscription-plans/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const inUse = await db.query(`SELECT COUNT(*) FROM network_subscriptions WHERE plan_id = $1`, [req.params.id]);
  if (parseInt(inUse.rows[0].count) > 0) return res.status(400).json({ success: false, message: 'Plan is in use by one or more networks' });
  await db.query(`UPDATE network_subscription_plans SET is_active = false, updated_at = NOW() WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
}));

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK SUBSCRIPTIONS ADMIN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

async function countSeatsUsed(db: any, networkId: string): Promise<number> {
  const r = await db.query(`SELECT COUNT(*) FROM hospital_network_members WHERE network_id = $1 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW())`, [networkId]);
  return parseInt(r.rows[0].count);
}
export async function checkSeatLimit(networkId: string, db: any): Promise<{ allowed: boolean; used: number; limit: number; status: string }> {
  const sub = await db.query(`SELECT seat_limit, status FROM network_subscriptions WHERE network_id = $1`, [networkId]);
  if (sub.rows.length === 0) return { allowed: true, used: 0, limit: 5, status: 'trial' };
  const { seat_limit, status } = sub.rows[0];
  if (status === 'suspended') return { allowed: false, used: 0, limit: seat_limit, status };
  const used = await countSeatsUsed(db, networkId);
  return { allowed: used < seat_limit, used, limit: seat_limit, status };
}

router.get('/admin/network-subscriptions', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const result = await db.query(`
    SELECT hn.id AS "networkId", hn.name AS "networkName", hn.is_approved AS "isApproved",
      ns.id AS "subscriptionId", ns.seat_limit AS "seatLimit", ns.status,
      ns.billing_cycle AS "billingCycle", ns.suspended_at AS "suspendedAt",
      ns.suspension_reason AS "suspensionReason", ns.admin_notes AS "adminNotes",
      nsp.name AS "planName", nsp.id AS "planId",
      (SELECT COUNT(*) FROM hospital_network_members m WHERE m.network_id = hn.id AND m.is_active = true AND (m.valid_until IS NULL OR m.valid_until > NOW())) AS "seatsUsed",
      (SELECT COUNT(*) FROM hospital_network_hospitals hnh WHERE hnh.network_id = hn.id AND hnh.is_active = true) AS "hospitalsCount"
    FROM hospital_networks hn
    LEFT JOIN network_subscriptions ns ON ns.network_id = hn.id
    LEFT JOIN network_subscription_plans nsp ON nsp.id = ns.plan_id
    WHERE hn.is_active = true ORDER BY hn.name
  `);
  res.json({ success: true, data: result.rows });
}));

router.post('/admin/networks/:id/set-subscription', authMiddleware, roleMiddleware(['admin']), validateBody(setNetworkSubscriptionSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { plan_id, seat_limit, status, billing_cycle, ends_at, admin_notes } = req.body;
  const result = await db.query(
    `INSERT INTO network_subscriptions (network_id, plan_id, seat_limit, status, billing_cycle, ends_at, admin_notes) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (network_id) DO UPDATE SET plan_id=EXCLUDED.plan_id, seat_limit=EXCLUDED.seat_limit, status=EXCLUDED.status, billing_cycle=EXCLUDED.billing_cycle, ends_at=EXCLUDED.ends_at, admin_notes=EXCLUDED.admin_notes, updated_at=NOW() RETURNING *`,
    [req.params.id, plan_id||null, seat_limit, status||'trial', billing_cycle||'none', ends_at||null, admin_notes||null]
  );
  res.json({ success: true, data: result.rows[0] });
}));

router.put('/admin/networks/:id/override-seat-limit', authMiddleware, roleMiddleware(['admin']), validateBody(overrideSeatLimitSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const { seat_limit, admin_notes } = req.body;
  const result = await db.query(
    `INSERT INTO network_subscriptions (network_id, seat_limit, admin_notes) VALUES ($1,$2,$3)
     ON CONFLICT (network_id) DO UPDATE SET seat_limit=EXCLUDED.seat_limit, admin_notes=COALESCE(EXCLUDED.admin_notes,network_subscriptions.admin_notes), updated_at=NOW() RETURNING *`,
    [req.params.id, seat_limit, admin_notes||null]
  );
  res.json({ success: true, data: result.rows[0] });
}));

router.post('/admin/networks/:id/suspend', authMiddleware, roleMiddleware(['admin']), validateBody(suspendNetworkSchema), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const { suspension_reason } = req.body;
  await db.query(
    `INSERT INTO network_subscriptions (network_id, seat_limit, status, suspended_at, suspended_by, suspension_reason) VALUES ($1,5,'suspended',NOW(),$2,$3)
     ON CONFLICT (network_id) DO UPDATE SET status='suspended', suspended_at=NOW(), suspended_by=$2, suspension_reason=$3, updated_at=NOW()`,
    [req.params.id, authReq.userId, suspension_reason]
  );
  res.json({ success: true, message: 'Network suspended' });
}));

router.post('/admin/networks/:id/unsuspend', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  await db.query(`UPDATE network_subscriptions SET status='active', suspended_at=NULL, suspended_by=NULL, suspension_reason=NULL, updated_at=NOW() WHERE network_id=$1`, [req.params.id]);
  res.json({ success: true, message: 'Network unsuspended' });
}));

export default router;
