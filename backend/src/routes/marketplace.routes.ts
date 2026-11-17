import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { authMiddleware, roleMiddleware, validateBody } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import database from '../utils/database';
import logger from '../utils/logger';
import cacheManager from '../utils/cacheManager';
import { emitRoleRefresh } from '../utils/socketIO';
import { getAllFeatureFlags } from '../config/featureFlags';
import AdminService from '../services/AdminService';
import Tier4Controller from '../controllers/Tier4Controller';
import { FileController } from '../controllers/FileController';
import { uploadAny, uploadImage, uploadVideo } from '../middleware/upload';
import {
  createMarketplaceListingSchema, updateMarketplaceListingSchema, placeBidSchema, createMarketplaceOrderSchema, updateOrderStatusSchema,
  confirmDealSchema, cancelDealSchema,
  startThreadSchema, sendMessageSchema, createSavedSearchSchema, updateSavedSearchSchema,
  reportListingSchema, resolveReportSchema,
  updateMonetizationSettingSchema, createMarketplacePlanSchema as createMPlanSchema, updateMarketplacePlanSchema as updateMPlanSchema,
  boostListingSchema, createInquirySchema, respondInquirySchema, createSubscriptionSchema,
  createSustainabilityMetricSchema, updateSustainabilityMetricSchema, createSustainabilityGoalSchema, updateSustainabilityGoalSchema,
  createWellnessScorecardSchema, updateWellnessScorecardSchema, createWellnessReminderSchema, snoozeReminderSchema,
  createGeofenceZoneSchema, updateGeofenceZoneSchema, createGeospatialEventSchema,
} from '../middleware/validation';

const router = Router();

// ─── Marketplace & Auctions ─────────────────────────
router.get('/marketplace/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceDashboard(req, res)));
router.get('/marketplace/listings', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceListings(req, res)));
router.get('/marketplace/listings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceListing(req, res)));
router.post('/marketplace/listings', authMiddleware, validateBody(createMarketplaceListingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('admin', 'marketplace') } })
  await Tier4Controller.createMarketplaceListing(req, res)
}));
router.put('/marketplace/listings/:id', authMiddleware, validateBody(updateMarketplaceListingSchema), asyncHandler(async (req: Request, res: Response) => {
  res.on('finish', () => { if (res.statusCode < 300) { emitRoleRefresh('admin', 'marketplace') } })
  await Tier4Controller.updateMarketplaceListing(req, res)
}));
router.delete('/marketplace/listings/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplaceListing(req, res)));
router.get('/marketplace/listings/:listingId/bids', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceBids(req, res)));
router.post('/marketplace/listings/:listingId/bids', authMiddleware, validateBody(placeBidSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.placeMarketplaceBid(req, res)));
router.get('/marketplace/orders', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceOrders(req, res)));
router.post('/marketplace/orders', authMiddleware, validateBody(createMarketplaceOrderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceOrder(req, res)));
router.patch('/marketplace/orders/:id/status', authMiddleware, validateBody(updateOrderStatusSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateOrderStatus(req, res)));
// Deal handshake: both parties confirm off-platform settlement; either can cancel a reservation
router.post('/marketplace/orders/:id/confirm', authMiddleware, validateBody(confirmDealSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.confirmMarketplaceDeal(req, res)));
router.post('/marketplace/orders/:id/cancel', authMiddleware, validateBody(cancelDealSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.cancelMarketplaceDeal(req, res)));
router.get('/marketplace/prices', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketPrices(req, res)));
// ─── Marketplace Engagement (Phase 3): messaging, favorites, saved searches ───
router.get('/marketplace/threads', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceThreads(req, res)));
router.get('/marketplace/threads/unread-count', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceUnreadCount(req, res)));
router.post('/marketplace/listings/:listingId/threads', authMiddleware, validateBody(startThreadSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.startMarketplaceThread(req, res)));
router.get('/marketplace/threads/:id/messages', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceThreadMessages(req, res)));
router.post('/marketplace/threads/:id/messages', authMiddleware, validateBody(sendMessageSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.sendMarketplaceMessage(req, res)));
router.get('/marketplace/favorites', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceFavorites(req, res)));
router.get('/marketplace/favorites/ids', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceFavoriteIds(req, res)));
router.post('/marketplace/listings/:listingId/favorite', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.addMarketplaceFavorite(req, res)));
router.delete('/marketplace/listings/:listingId/favorite', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.removeMarketplaceFavorite(req, res)));
router.get('/marketplace/config', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceConfig(req, res)));
router.post('/marketplace/listings/:listingId/report', authMiddleware, validateBody(reportListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.reportMarketplaceListing(req, res)));
router.get('/marketplace/admin/reports', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminListMarketplaceReports(req, res)));
router.patch('/marketplace/admin/reports/:id', authMiddleware, roleMiddleware(['admin']), validateBody(resolveReportSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.adminResolveMarketplaceReport(req, res)));
router.get('/marketplace/saved-searches', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceSavedSearches(req, res)));
router.post('/marketplace/saved-searches', authMiddleware, validateBody(createSavedSearchSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceSavedSearch(req, res)));
router.put('/marketplace/saved-searches/:id', authMiddleware, validateBody(updateSavedSearchSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMarketplaceSavedSearch(req, res)));
router.delete('/marketplace/saved-searches/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplaceSavedSearch(req, res)));
// Admin marketplace controls
router.get('/marketplace/admin/listings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminListMarketplaceListings(req, res)));
router.get('/marketplace/admin/stats', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMarketplaceStats(req, res)));
router.patch('/marketplace/admin/listings/:id/approve', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminApproveMarketplaceListing(req, res)));
router.patch('/marketplace/admin/listings/:id/reject', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminRejectMarketplaceListing(req, res)));
router.patch('/marketplace/admin/listings/:id/hot-deal', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminToggleHotDeal(req, res)));
router.patch('/marketplace/admin/listings/:id/featured', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.adminToggleFeatured(req, res)));
// Marketplace Monetization - Admin
router.get('/marketplace/admin/monetization/settings', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMonetizationSettings(req, res)));
router.put('/marketplace/admin/monetization/settings/:key', authMiddleware, roleMiddleware(['admin']), validateBody(updateMonetizationSettingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMonetizationSetting(req, res)));
router.get('/marketplace/admin/monetization/plans', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplacePlans(req, res)));
router.post('/marketplace/admin/monetization/plans', authMiddleware, roleMiddleware(['admin']), validateBody(createMPlanSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplacePlan(req, res)));
router.put('/marketplace/admin/monetization/plans/:id', authMiddleware, roleMiddleware(['admin']), validateBody(updateMPlanSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateMarketplacePlan(req, res)));
router.delete('/marketplace/admin/monetization/plans/:id', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.deleteMarketplacePlan(req, res)));
router.get('/marketplace/admin/monetization/dashboard', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.getMonetizationDashboard(req, res)));
// Marketplace Monetization - User
router.get('/marketplace/subscription', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getUserSubscription(req, res)));
router.post('/marketplace/subscription', authMiddleware, validateBody(createSubscriptionSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createUserSubscription(req, res)));
router.delete('/marketplace/subscription', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.cancelUserSubscription(req, res)));
router.post('/marketplace/listings/:id/boost', authMiddleware, validateBody(boostListingSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.boostMarketplaceListing(req, res)));
router.post('/marketplace/listings/:listingId/inquiries', authMiddleware, validateBody(createInquirySchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createMarketplaceInquiry(req, res)));
router.get('/marketplace/inquiries', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listMarketplaceInquiries(req, res)));
router.patch('/marketplace/inquiries/:id/respond', authMiddleware, validateBody(respondInquirySchema), asyncHandler((req: Request, res: Response) => Tier4Controller.respondToMarketplaceInquiry(req, res)));
router.get('/marketplace/monetization-status', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getUserMonetizationStatus(req, res)));
// Auction feature flag - readable by any authenticated user, writable by admin only
router.get('/marketplace/auction-enabled', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getAuctionEnabled(req, res)));
router.put('/marketplace/admin/auction-enabled', authMiddleware, roleMiddleware(['admin']), asyncHandler((req: Request, res: Response) => Tier4Controller.setAuctionEnabled(req, res)));

// ─── Sustainability & Carbon Tracking ───────────────
router.get('/enterprises/:enterpriseId/sustainability/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getSustainabilityDashboard(req, res)));
router.get('/enterprises/:enterpriseId/sustainability/metrics', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listSustainabilityMetrics(req, res)));
router.post('/enterprises/:enterpriseId/sustainability/metrics', authMiddleware, validateBody(createSustainabilityMetricSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createSustainabilityMetric(req, res)));
router.put('/sustainability/metrics/:id', authMiddleware, validateBody(updateSustainabilityMetricSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateSustainabilityMetric(req, res)));
router.delete('/sustainability/metrics/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteSustainabilityMetric(req, res)));
router.get('/enterprises/:enterpriseId/sustainability/goals', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listSustainabilityGoals(req, res)));
router.post('/enterprises/:enterpriseId/sustainability/goals', authMiddleware, validateBody(createSustainabilityGoalSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createSustainabilityGoal(req, res)));
router.put('/sustainability/goals/:id', authMiddleware, validateBody(updateSustainabilityGoalSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateSustainabilityGoal(req, res)));
router.delete('/sustainability/goals/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteSustainabilityGoal(req, res)));
router.get('/enterprises/:enterpriseId/sustainability/carbon-footprint', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getCarbonFootprint(req, res)));

// ─── Client Portal & Wellness ───────────────────────
router.get('/wellness/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getWellnessDashboard(req, res)));
router.get('/wellness/scorecards', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listWellnessScorecards(req, res)));
router.post('/wellness/scorecards', authMiddleware, validateBody(createWellnessScorecardSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createWellnessScorecard(req, res)));
router.put('/wellness/scorecards/:id', authMiddleware, validateBody(updateWellnessScorecardSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateWellnessScorecard(req, res)));
router.delete('/wellness/scorecards/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteWellnessScorecard(req, res)));
router.get('/wellness/reminders', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listWellnessReminders(req, res)));
router.post('/wellness/reminders', authMiddleware, validateBody(createWellnessReminderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createWellnessReminder(req, res)));
router.patch('/wellness/reminders/:id/complete', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.completeReminder(req, res)));
router.patch('/wellness/reminders/:id/snooze', authMiddleware, validateBody(snoozeReminderSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.snoozeReminder(req, res)));
router.delete('/wellness/reminders/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteWellnessReminder(req, res)));

// ─── Geospatial Analytics & Geofencing ──────────────
router.get('/enterprises/:enterpriseId/geospatial/dashboard', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getGeospatialDashboard(req, res)));
router.get('/enterprises/:enterpriseId/geospatial/zones', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listGeofenceZones(req, res)));
router.post('/enterprises/:enterpriseId/geospatial/zones', authMiddleware, validateBody(createGeofenceZoneSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createGeofenceZone(req, res)));
router.put('/geospatial/zones/:id', authMiddleware, validateBody(updateGeofenceZoneSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.updateGeofenceZone(req, res)));
router.delete('/geospatial/zones/:id', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.deleteGeofenceZone(req, res)));
router.get('/enterprises/:enterpriseId/geospatial/events', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.listGeospatialEvents(req, res)));
router.post('/enterprises/:enterpriseId/geospatial/events', authMiddleware, validateBody(createGeospatialEventSchema), asyncHandler((req: Request, res: Response) => Tier4Controller.createGeospatialEvent(req, res)));
router.get('/enterprises/:enterpriseId/geospatial/heatmap', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getHeatmapData(req, res)));
router.get('/geospatial/animals/:animalId/trail', authMiddleware, asyncHandler((req: Request, res: Response) => Tier4Controller.getMovementTrail(req, res)));

// ═══════════════════════════════════════════════════════════════

// ─── Public settings (no auth) ───────────────────────────────
router.get('/settings/public', asyncHandler(async (_req: Request, res: Response) => {
  const settings = await AdminService.getPublicSettings();
  res.json({ success: true, data: settings });
}));

// ─── Public Marketplace (no auth required) ───────────────────
router.get('/public/marketplace/listings', asyncHandler((req: Request, res: Response) => Tier4Controller.publicListMarketplaceListings(req, res)));
router.get('/public/marketplace/listings/:id', asyncHandler((req: Request, res: Response) => Tier4Controller.publicGetMarketplaceListing(req, res)));
router.get('/public/marketplace/stats', asyncHandler((req: Request, res: Response) => Tier4Controller.publicGetMarketplaceStats(req, res)));

// ─── Health check & feature flags ────────────────────────────
router.get('/health', async (_req, res) => {
  const checks: Record<string, any> = { api: 'ok' };
  let httpStatus = 200;

  // Database connectivity check
  try {
    const dbResult = await database.query('SELECT 1 AS ok');
    checks.database = dbResult.rows?.[0]?.ok === 1 ? 'ok' : 'degraded';
  } catch {
    checks.database = 'down';
    httpStatus = 503;
  }

  // Schema + users table check (critical for login)
  try {
    const schema = process.env.DB_SCHEMA || 'public';
    const tableCheck = await database.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users') AS users_exists`, [schema]
    );
    const usersExists = tableCheck.rows[0]?.users_exists;
    if (usersExists) {
      const countCheck = await database.query('SELECT COUNT(*)::int AS cnt FROM users');
      checks.schema = schema;
      checks.usersTable = 'ok';
      checks.userCount = countCheck.rows[0]?.cnt ?? 0;
    } else {
      checks.schema = schema;
      checks.usersTable = 'missing';
      httpStatus = 503;
    }
  } catch (e: any) {
    checks.usersTable = 'error: ' + e.message;
    httpStatus = 503;
  }

  // Cache check
  try {
    const cacheOk = cacheManager !== undefined;
    checks.cache = cacheOk ? 'ok' : 'unavailable';
  } catch {
    checks.cache = 'unavailable';
  }

  const overall = httpStatus === 200 ? 'healthy' : 'unhealthy';

  res.status(httpStatus).json({
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  });
});

router.get('/features', (_req, res) => {
  res.json({ success: true, data: getAllFeatureFlags() });
});

// ─── Emergency diagnostics (break-glass token required) ──────
/**
 * These two endpoints exist for the case where a deploy left the database in a
 * state the app cannot start against (the 2026-07-26 Render investigation). That
 * is exactly the case where `authMiddleware` would be useless as the gate: if the
 * schema is missing or wrong, nobody can log in to authorise the repair - so
 * requiring a login would break the emergency they exist to solve.
 *
 * The gate is therefore a pre-shared secret in EMERGENCY_DIAGNOSTIC_TOKEN,
 * compared in constant time. If that env var is unset the endpoints are disabled
 * outright: fail closed, so an operator who never opted in is never exposed.
 *
 * Both respond 404 rather than 401/403 - an anonymous prober should not even be
 * able to confirm the route exists.
 *
 * To use during an incident:
 *   curl -H "x-emergency-token: $EMERGENCY_DIAGNOSTIC_TOKEN" .../api/v1/debug/db-state
 */
const emergencyGate = (req: Request, res: Response, next: NextFunction): void => {
  const expected = process.env.EMERGENCY_DIAGNOSTIC_TOKEN || '';
  const provided = req.get('x-emergency-token') || '';
  const deny = (reason: string): void => {
    logger.warn('Emergency diagnostic endpoint denied', { path: req.path, ip: req.ip, reason });
    res.status(404).json({ success: false, error: 'Not found' });
  };

  // Unset (or trivially short) token means the break-glass path is not enabled.
  if (expected.length < 16) return deny('EMERGENCY_DIAGNOSTIC_TOKEN unset or too short (min 16 chars)');

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return deny('token mismatch');

  logger.warn('Emergency diagnostic endpoint AUTHORISED via break-glass token', { path: req.path, ip: req.ip });
  next();
};

router.get('/debug/db-state', emergencyGate, async (_req, res) => {
  try {
    const schema = process.env.DB_SCHEMA || 'public';
    const rows: Record<string, any> = {};

    // current search_path
    const spResult = await database.query('SHOW search_path');
    rows.searchPath = spResult.rows[0]?.search_path;

    // list all non-system schemas
    const schemas = await database.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name`);
    rows.schemas = schemas.rows.map((r: any) => r.schema_name);

    // tables in target schema
    const tables = await database.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`, [schema]);
    rows.tablesInSchema = tables.rows.map((r: any) => r.table_name);

    // tables in public schema
    const publicTables = await database.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    rows.tablesInPublic = publicTables.rows.map((r: any) => r.table_name);

    // user count (try both schemas)
    try {
      const uc = await database.query(`SELECT COUNT(*)::int AS cnt FROM "${schema}".users`);
      rows.userCountInSchema = uc.rows[0]?.cnt;
    } catch { rows.userCountInSchema = 'error - table likely missing'; }

    res.json({ status: 'ok', targetSchema: schema, ...rows });
  } catch (e: any) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

router.post('/repair-schema', emergencyGate, async (_req, res) => {
  try {
    const result = await database.repairSchema();
    if (result.success) {
      // Also seed demo users
      try {
        const { fixDemoPasswords } = await import('../utils/fixDemoPasswords');
        await fixDemoPasswords();
        (result as any).demoUsers = 'seeded';
      } catch (se: any) {
        (result as any).demoUsers = 'error: ' + se.message;
      }
    }
    res.status(result.success ? 200 : 500).json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── File Uploads ────────────────────────────────────────────
router.post('/files/upload', authMiddleware, uploadAny.single('file'), asyncHandler((req: Request, res: Response) => FileController.upload(req, res)));
router.post('/files/upload-image', authMiddleware, uploadImage.single('file'), asyncHandler((req: Request, res: Response) => FileController.upload(req, res)));
router.post('/files/upload-video', authMiddleware, uploadVideo.single('file'), asyncHandler((req: Request, res: Response) => FileController.uploadVideo(req, res)));
router.post('/files/upload-multiple', authMiddleware, uploadAny.array('files', 10), asyncHandler((req: Request, res: Response) => FileController.uploadMultiple(req, res)));
router.get('/files', authMiddleware, asyncHandler((req: Request, res: Response) => FileController.list(req, res)));
router.delete('/files/*', authMiddleware, asyncHandler((req: Request, res: Response) => FileController.remove(req, res)));


export default router;
