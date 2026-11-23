import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, validateBody } from '../middleware/auth';
import { saveFarmRecordSchema, groupEventSchema } from '../middleware/validation';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import FarmRecordService from '../services/FarmRecordService';
import FarmEventService from '../services/FarmEventService';
import FarmDueService from '../services/FarmDueService';
import { isFarmRecordsEnabled } from '../services/farmRecords/FarmRecordsConfig';

// ═══════════════════════════════════════════════════════════════════
// Farm daily records (docs/FARM_MANAGEMENT_PLAN.md Phase 4, migration 045).
// Dark-launched behind system setting farm.records.enabled: while it is off every route except
// GET /farm-records/enabled answers 404, as if the module did not exist.
//
// Tenant scoping lives in FarmRecordService (assertFarmAccess: owner, active member or admin; a
// farm the caller has no claim on answers 404). No route here trusts an id it was handed.
// ═══════════════════════════════════════════════════════════════════

const router = Router();
const caller = (req: Request) => ({ userId: (req as any).userId as string, role: (req as any).userRole as string | undefined });

async function farmRecordsEnabled(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { if (await isFarmRecordsEnabled()) return next(); } catch { /* fall through to 404 */ }
  res.status(404).json({ success: false, message: 'Not found' });
}

// The client asks this first so it can hide the Record entry points while the module is dark.
router.get('/farm-records/enabled', authMiddleware, asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: await isFarmRecordsEnabled() } });
}));

router.get('/farm-records', authMiddleware, farmRecordsEnabled, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const items = await FarmRecordService.list({
    enterpriseId: q.enterpriseId, animalId: q.animalId, groupId: q.groupId, recordType: q.recordType,
    from: q.from, to: q.to, limit: q.limit ? Number(q.limit) : undefined, wholeFarm: q.wholeFarm,
  }, caller(req));
  res.json({ success: true, data: { items } });
}));

router.get('/farm-records/summary', authMiddleware, farmRecordsEnabled, asyncHandler(async (req: Request, res: Response) => {
  const enterpriseId = String(req.query.enterpriseId || '');
  if (!enterpriseId) return res.status(400).json({ success: false, message: 'enterpriseId is required' });
  res.json({ success: true, data: { items: await FarmRecordService.summary(enterpriseId, Number(req.query.days) || 7, caller(req)) } });
}));

// What is coming up: expected births, vaccinations due, withdrawals ending (recorded dates only).
router.get('/farm-records/due', authMiddleware, farmRecordsEnabled, asyncHandler(async (req: Request, res: Response) => {
  const enterpriseId = String(req.query.enterpriseId || '');
  if (!enterpriseId) return res.status(400).json({ success: false, message: 'enterpriseId is required' });
  res.json({ success: true, data: { items: await FarmDueService.list(enterpriseId, caller(req)) } });
}));

router.post('/farm-records', authMiddleware, farmRecordsEnabled, validateBody(saveFarmRecordSchema), asyncHandler(async (req: Request, res: Response) => {
  const saved = await FarmRecordService.save(req.body, caller(req));
  res.status(saved.replaced ? 200 : 201).json({ success: true, data: saved });
}));

// Events on a batch group (place flock, stock pond, cull, partial sale / harvest, clear-out): they
// change the group's head count, so they are written through the population ledger.
router.post('/farm-records/events', authMiddleware, farmRecordsEnabled, validateBody(groupEventSchema), asyncHandler(async (req: Request, res: Response) => {
  // A phone that was offline sends the entry again later with the same Idempotency-Key: the answer given the first
  // time is returned, and nothing is counted twice (migration 049).
  const key = String(req.headers['idempotency-key'] || '').trim().slice(0, 80);
  const who = caller(req);
  if (key) {
    const seen = await database.query(`SELECT response FROM farm_event_receipts WHERE user_id = $1 AND idempotency_key = $2`, [who.userId, key]);
    if (seen.rows.length) return res.status(200).json({ success: true, data: seen.rows[0].response, replayed: true });
  }
  const data = await FarmEventService.recordEvent(req.body, who);
  if (key) {
    await database.query(
      `INSERT INTO farm_event_receipts (user_id, idempotency_key, response) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING`,
      [who.userId, key, JSON.stringify(data)]).catch(() => { /* the entry is saved; a missing receipt only loses the replay protection */ });
  }
  res.status(201).json({ success: true, data });
}));

router.delete('/farm-records/:id', authMiddleware, farmRecordsEnabled, asyncHandler(async (req: Request, res: Response) => {
  await FarmRecordService.remove(req.params.id, caller(req));
  res.json({ success: true });
}));

export default router;
