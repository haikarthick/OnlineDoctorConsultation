import { Router, Request, Response } from 'express';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import { updatePricingSettingsSchema } from '../middleware/validation';

const router = Router();

// PRICING VISIBILITY (public endpoint + admin management)
// ─────────────────────────────────────────────────────────────────────────────

// system_settings values are free-text editable (generic admin settings table,
// not just the dedicated Pricing Settings page) - normalize case/whitespace so
// a typo like 'True' doesn't silently disable visibility. See payment.enabled
// incident (2026-07-06) for why this must never be a strict '=== "true"'.
const isSettingTrue = (value: string | undefined | null): boolean =>
  typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase());

router.get('/pricing/plans', asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const [plansResult, settingsResult] = await Promise.all([
    db.query(`SELECT id, name, description, max_seats, max_hospitals, price_monthly, price_annually, currency, features, sort_order FROM network_subscription_plans WHERE is_published = true AND is_active = true ORDER BY sort_order`),
    db.query(`SELECT key, value FROM system_settings WHERE key LIKE 'pricing.%'`),
  ]);
  const settings: Record<string, string> = {};
  for (const row of settingsResult.rows) settings[row.key] = row.value;
  const globalVisible = isSettingTrue(settings['pricing.visibility.global']);
  res.json({ success: true, data: {
    isVisible: globalVisible,
    plans: globalVisible ? plansResult.rows : [],
    ctaText: settings['pricing.cta_text'] || 'Contact us for pricing',
    ctaEmail: settings['pricing.cta_email'] || '',
    ctaPhone: settings['pricing.cta_phone'] || '',
    visibility: {
      global: globalVisible,
      landing_page: isSettingTrue(settings['pricing.visibility.landing_page']),
      registration: isSettingTrue(settings['pricing.visibility.registration']),
      corp_dashboard: isSettingTrue(settings['pricing.visibility.corp_dashboard']),
      upgrade_prompts: isSettingTrue(settings['pricing.visibility.upgrade_prompts']),
    },
  }});
}));

router.get('/admin/pricing-settings', authMiddleware, roleMiddleware(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  const [plansResult, settingsResult] = await Promise.all([
    db.query(`SELECT * FROM network_subscription_plans ORDER BY sort_order`),
    db.query(`SELECT key, value FROM system_settings WHERE key LIKE 'pricing.%'`),
  ]);
  const settings: Record<string, string> = {};
  for (const row of settingsResult.rows) settings[row.key] = row.value;
  res.json({ success: true, data: { plans: plansResult.rows, settings } });
}));

router.put('/admin/pricing-settings', authMiddleware, roleMiddleware(['admin']), validateBody(updatePricingSettingsSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = (await import('../utils/database')).default;
  for (const [key, value] of Object.entries(req.body)) {
    await db.query(`INSERT INTO system_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`, [key, String(value)]);
  }
  res.json({ success: true });
}));

router.get('/my-network-subscription', authMiddleware, roleMiddleware(['corporate_admin', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as any;
  const db = (await import('../utils/database')).default;
  const netResult = await db.query(
    `SELECT id FROM hospital_networks WHERE id IN (SELECT network_id FROM hospital_network_members WHERE user_id=$1 AND network_role='corporate_admin' AND is_active=true AND (valid_until IS NULL OR valid_until > NOW())) LIMIT 1`,
    [authReq.userId]
  );
  if (netResult.rows.length === 0) return res.json({ success: true, data: null });
  const networkId = netResult.rows[0].id;
  const result = await db.query(
    `SELECT ns.*, nsp.name AS "planName", nsp.price_monthly AS "priceMonthly", nsp.price_annually AS "priceAnnually",
      (SELECT COUNT(*) FROM hospital_network_members m WHERE m.network_id=ns.network_id AND m.is_active=true AND (m.valid_until IS NULL OR m.valid_until > NOW())) AS "seatsUsed"
     FROM network_subscriptions ns LEFT JOIN network_subscription_plans nsp ON nsp.id=ns.plan_id WHERE ns.network_id=$1`,
    [networkId]
  );
  const vis = await db.query(`SELECT value FROM system_settings WHERE key='pricing.visibility.corp_dashboard'`);
  const showPrice = isSettingTrue(vis.rows[0]?.value);
  const sub = result.rows[0] || { network_id: networkId, seat_limit: 5, status: 'trial', seatsUsed: 0, planName: 'Trial' };
  if (!showPrice) { delete sub.priceMonthly; delete sub.priceAnnually; }
  res.json({ success: true, data: sub });
}));


export default router;
