import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import SmsService from '../services/SmsService';
import { adminView, applyAdminChanges, PROVIDERS } from '../services/sms/SmsConfig';
import { normalizePhone } from '../services/sms/phone';

// ═══════════════════════════════════════════════════════════════════
// Admin -> SMS Settings (migration 046). Platform admins only. Provider secrets are write-only:
// they are accepted here but never sent back; the screen only learns whether one is set.
// ═══════════════════════════════════════════════════════════════════

const router = Router();
const admin = [authMiddleware, roleMiddleware(['admin'])];

const changesSchema = Joi.object({
  changes: Joi.object().pattern(Joi.string().pattern(/^sms\./).max(100), Joi.alternatives(Joi.string().allow('').max(2000), Joi.valid(null))).required(),
});

router.get('/admin/sms-settings', ...admin, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { settings: await adminView(), providers: PROVIDERS } });
}));

router.put('/admin/sms-settings', ...admin, validateBody(changesSchema), asyncHandler(async (req: Request, res: Response) => {
  const { changes } = req.body as { changes: Record<string, string | null> };
  if (changes['sms.provider'] !== undefined && changes['sms.provider'] !== null && !(PROVIDERS as readonly string[]).includes(changes['sms.provider'])) {
    return res.status(400).json({ success: false, message: `The provider must be one of: ${PROVIDERS.join(', ')}.` });
  }
  const changed = await applyAdminChanges(changes, (req as any).userId);
  res.json({ success: true, data: { changed, settings: await adminView() } });
}));

// Sends a sample farm-invitation text to the number the admin types, so they can check the provider
// details work before real invitations depend on them.
router.post('/admin/sms-settings/test', ...admin, validateBody(Joi.object({ to: Joi.string().max(30).required() })), asyncHandler(async (req: Request, res: Response) => {
  if (!normalizePhone(req.body.to)) {
    return res.status(400).json({ success: false, message: 'Enter a valid mobile number, for example 98765 43210.' });
  }
  const outcome = await SmsService.send({
    to: req.body.to, template: 'farm_invite', requestedBy: (req as any).userId,
    vars: { inviter: 'WayToVet test', farm: 'Sample Farm', role: 'worker', link: 'https://waytovet.example/join' },
  });
  res.json({ success: true, data: outcome });
}));

router.get('/admin/sms-settings/log', ...admin, asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const r = await database.query(
    `SELECT to_masked AS "to", template, provider, status, error, created_at AS "createdAt" FROM sms_log ORDER BY created_at DESC LIMIT ${limit}`, []);
  res.json({ success: true, data: { items: r.rows } });
}));

export default router;
