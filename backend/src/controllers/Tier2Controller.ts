import { Request, Response } from 'express';
import healthAnalyticsService from '../services/HealthAnalyticsService';
import breedingService from '../services/BreedingService';
import feedInventoryService, { FEED_GIVEN_MOVED_MESSAGE } from '../services/FeedInventoryService';
import complianceService from '../services/ComplianceService';
import financialService from '../services/FinancialService';
import alertService from '../services/AlertService';
import enterpriseService from '../services/EnterpriseService';
import FarmAccessService from '../services/FarmAccessService';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import database from '../utils/database';

// Helper to check enterprise access
async function ensureAccess(req: Request, res: Response, enterpriseId: string): Promise<boolean> {
  // One rule for every farm screen (services/FarmAccessService.ts): a viewer only looks.
  try {
    await FarmAccessService.assert(enterpriseId, { userId: (req as any).userId, role: (req as any).userRole }, FarmAccessService.actionForMethod(req.method));
    return true;
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      res.status(403).json({ success: false, message: err.message, error: { message: err.message } });
      return false;
    }
    throw err;
  }
}

const FEED_NOT_AVAILABLE_MESSAGE = "We could not find this feed item in your farm's stock. It may have been removed, or it may belong to another farm. Open Feed Inventory to see the feeds you can use.";

/** A feed id that does not exist and one that belongs to a farm the person cannot reach get the SAME answer, so the screen never confirms another farm's stock exists. */
async function ensureFeedAccess(req: Request, res: Response, feedId: string): Promise<boolean> {
  let enterpriseId: string | null = null;
  try { enterpriseId = await feedInventoryService.enterpriseOf(feedId); } catch (err: any) { if (!(err instanceof NotFoundError)) throw err; }
  let canSee = false;
  if (enterpriseId) {
    try {
      await FarmAccessService.assert(enterpriseId, { userId: (req as any).userId, role: (req as any).userRole }, 'read');
      canSee = true;
    } catch (err: any) {
      if (!(err instanceof ForbiddenError)) throw err;
    }
  }
  if (!canSee || !enterpriseId) { res.status(404).json({ success: false, message: FEED_NOT_AVAILABLE_MESSAGE, error: { message: FEED_NOT_AVAILABLE_MESSAGE } }); return false; }
  // The person can see this farm: now the normal rule (a viewer only looks) answers in its own words.
  return ensureAccess(req, res, enterpriseId);
}

/** Feed bought for the farm is recorded ONCE, in Feed Inventory (restock with a price), which writes the expense itself. */
export const FEED_EXPENSE_IN_INVENTORY_MESSAGE = 'Feed you buy is recorded in Feed Inventory: open the feed, tap Restock and enter the price. That adds the expense here for you, so it is not counted twice. Choose another category for other costs.';

/** Tables whose rows belong to a farm and are addressed by their own id (names are fixed here, never taken from the request). */
const FARM_RECORD_TABLES = { financial_records: 'finance entry', compliance_documents: 'document' } as const;

/** One record addressed by its own id: the farm that owns it decides. Unknown and another farm's record get the same plain answer. */
async function ensureFarmRecordAccess(req: Request, res: Response, table: keyof typeof FARM_RECORD_TABLES, id: string): Promise<boolean> {
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await database.query(`SELECT enterprise_id FROM ${table} WHERE id = $1`, [id]) : { rows: [] as any[] };
  const enterpriseId: string | null = found.rows[0]?.enterprise_id || null;
  let canSee = false;
  if (enterpriseId) {
    try { await FarmAccessService.assert(enterpriseId, { userId: (req as any).userId, role: (req as any).userRole }, 'read'); canSee = true; }
    catch (err: any) { if (!(err instanceof ForbiddenError)) throw err; }
  }
  if (!canSee || !enterpriseId) {
    const message = `We could not find this ${FARM_RECORD_TABLES[table]} on your farm. It may have been removed, or it may belong to another farm.`;
    res.status(404).json({ success: false, message, error: { message } });
    return false;
  }
  return ensureAccess(req, res, enterpriseId);
}

class Tier2Controller {

  // ═══════════════════════ Health Analytics ═══════════════════════

  async getHealthDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await healthAnalyticsService.getHealthDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listObservations(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await healthAnalyticsService.listObservations(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  /** The farm is the one in the address and the person must be on its team; the animal or herd named must belong to it. */
  async createObservation(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    const { animalId, groupId } = req.body;
    const belongs = (await Promise.all([
      animalId ? database.query(`SELECT 1 FROM animals WHERE id = $1 AND enterprise_id = $2`, [animalId, enterpriseId]) : null,
      groupId ? database.query(`SELECT 1 FROM animal_groups WHERE id = $1 AND enterprise_id = $2`, [groupId, enterpriseId]) : null,
    ])).every(r => r === null || r.rows.length > 0);
    if (!belongs) {
      const message = "That animal or herd is not part of this farm, so a health note cannot be added for it. Choose one of this farm's animals.";
      res.status(400).json({ success: false, message, error: { message } });
      return;
    }
    res.status(201).json({ data: await healthAnalyticsService.createObservation({ ...req.body, enterpriseId, observerId: userId }) });
  }

  async resolveObservation(req: Request, res: Response) {
    const farm = await database.query(`SELECT enterprise_id FROM health_observations WHERE id = $1`, [req.params.id]);
    // Unknown note and a note of a farm the person cannot reach get the same answer.
    const enterpriseId: string | null = farm.rows[0]?.enterprise_id || null;
    let canSee = false;
    if (enterpriseId) {
      try { await FarmAccessService.assert(enterpriseId, { userId: (req as any).userId, role: (req as any).userRole }, 'read'); canSee = true; }
      catch (err: any) { if (!(err instanceof ForbiddenError)) throw err; }
    }
    if (!canSee || !enterpriseId) {
      const message = 'We could not find this health note on your farm. It may have been removed, or it may belong to another farm.';
      res.status(404).json({ success: false, message, error: { message } });
      return;
    }
    if (!await ensureAccess(req, res, enterpriseId)) return;
    await healthAnalyticsService.resolveObservation(req.params.id);
    res.json({ data: { success: true } });
  }

  // ═══════════════════════ Breeding ═══════════════════════

  async listBreedingRecords(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await breedingService.list(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createBreedingRecord(req: Request, res: Response) {
    try {
      // A breeding record changes the dam's status and births, so the caller must belong to the
      // farm and the animals must be that farm's (or the caller's own) - not someone else's.
      if (!await ensureAccess(req, res, req.body.enterpriseId)) return;
      const allowed = await breedingService.animalsAllowed(req.body.enterpriseId, [req.body.damId, req.body.sireId], (req as any).userId, (req as any).userRole);
      if (!allowed) { res.status(403).json({ error: { message: 'The dam and sire must be animals of this farm' } }); return; }
      const data = await breedingService.create(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateBreedingRecord(req: Request, res: Response) {
    try {
      // Same rule as create: the record's own farm decides, never the id alone.
      const record = await breedingService.getById(req.params.id);
      if (!record) { res.status(404).json({ error: { message: 'Breeding record not found' } }); return; }
      if (!await ensureAccess(req, res, record.enterpriseId)) return;
      const data = await breedingService.update(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getUpcomingDueDates(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const days = parseInt(req.query.days as string) || 30;
      const data = await breedingService.getUpcomingDueDates(enterpriseId, days);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getBreedingStats(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await breedingService.getBreedingStats(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════════ Feed Inventory ═══════════════════════
  // Stock and price only (migration 063). Every write checks the farm that OWNS the item - never an id from the body -
  // and failures go to the shared error handler, which shows the person a plain message, never err.message.

  async listFeeds(req: Request, res: Response) {
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    res.json({ data: await feedInventoryService.listFeeds(enterpriseId) });
  }

  async feedLibrary(req: Request, res: Response) {
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    res.json({ data: await feedInventoryService.library() });
  }

  async createFeed(req: Request, res: Response) {
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    res.status(201).json({ data: await feedInventoryService.createFeed(enterpriseId, req.body) });
  }

  async updateFeed(req: Request, res: Response) {
    if (!await ensureFeedAccess(req, res, req.params.id)) return;
    res.json({ data: await feedInventoryService.updateFeed(req.params.id, req.body) });
  }

  async restockFeed(req: Request, res: Response) {
    if (!await ensureFeedAccess(req, res, req.params.id)) return;
    res.json({ data: await feedInventoryService.restock(req.params.id, req.body, (req as any).userId) });
  }

  async deleteFeed(req: Request, res: Response) {
    if (!await ensureFeedAccess(req, res, req.params.id)) return;
    await feedInventoryService.deleteFeed(req.params.id);
    res.json({ data: { success: true } });
  }

  /** Feed given is recorded only in Daily records now; an old screen still calling here is told where to go. */
  async logFeedConsumption(_req: Request, res: Response) {
    res.status(410).json({ success: false, message: FEED_GIVEN_MOVED_MESSAGE, error: { message: FEED_GIVEN_MOVED_MESSAGE } });
  }

  async getFeedAnalytics(req: Request, res: Response) {
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    res.json({ data: await feedInventoryService.getFeedAnalytics(enterpriseId) });
  }


  // ═══════════════════════ Compliance ═══════════════════════

  async listComplianceDocs(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await complianceService.list(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // The farm is the one in the address; a document is changed only by someone on that farm's team.
  async createComplianceDoc(req: Request, res: Response) {
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    res.status(201).json({ data: await complianceService.create({ ...req.body, enterpriseId }) });
  }

  async updateComplianceDoc(req: Request, res: Response) {
    if (!await ensureFarmRecordAccess(req, res, 'compliance_documents', req.params.id)) return;
    res.json({ data: await complianceService.update(req.params.id, req.body) });
  }

  async verifyComplianceDoc(req: Request, res: Response) {
    if (!await ensureFarmRecordAccess(req, res, 'compliance_documents', req.params.id)) return;
    res.json({ data: await complianceService.verify(req.params.id, (req as any).userId) });
  }

  async deleteComplianceDoc(req: Request, res: Response) {
    if (!await ensureFarmRecordAccess(req, res, 'compliance_documents', req.params.id)) return;
    await complianceService.delete(req.params.id);
    res.json({ data: { success: true } });
  }

  async getComplianceSummary(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await complianceService.getComplianceSummary(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════════ Financial ═══════════════════════

  async listFinancialRecords(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await financialService.list(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createFinancialRecord(req: Request, res: Response) {
    const { enterpriseId } = req.params;
    if (!await ensureAccess(req, res, enterpriseId)) return;
    if (req.body?.recordType === 'expense' && req.body?.category === 'feed') {
      res.status(400).json({ success: false, message: FEED_EXPENSE_IN_INVENTORY_MESSAGE, error: { message: FEED_EXPENSE_IN_INVENTORY_MESSAGE, code: 'FEED_EXPENSE_IN_INVENTORY' } });
      return;
    }
    res.status(201).json({ data: await financialService.create({ ...req.body, enterpriseId, recordedBy: (req as any).userId }) });
  }

  async updateFinancialRecord(req: Request, res: Response) {
    if (!await ensureFarmRecordAccess(req, res, 'financial_records', req.params.id)) return;
    if (req.body?.category === 'feed') {
      res.status(400).json({ success: false, message: FEED_EXPENSE_IN_INVENTORY_MESSAGE, error: { message: FEED_EXPENSE_IN_INVENTORY_MESSAGE, code: 'FEED_EXPENSE_IN_INVENTORY' } });
      return;
    }
    res.json({ data: await financialService.update(req.params.id, req.body) });
  }

  async deleteFinancialRecord(req: Request, res: Response) {
    if (!await ensureFarmRecordAccess(req, res, 'financial_records', req.params.id)) return;
    await financialService.delete(req.params.id);
    res.json({ data: { success: true } });
  }

  async getFinancialDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const months = parseInt(req.query.months as string) || 12;
      const data = await financialService.getFinancialDashboard(enterpriseId, months);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════════ Alerts ═══════════════════════

  async listAlertRules(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await alertService.listRules(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createAlertRule(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await alertService.createRule({ ...req.body, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateAlertRule(req: Request, res: Response) {
    try {
      const data = await alertService.updateRule(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteAlertRule(req: Request, res: Response) {
    try {
      await alertService.deleteRule(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async toggleAlertRule(req: Request, res: Response) {
    try {
      await alertService.toggleRule(req.params.id, req.body.isEnabled);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listAlertEvents(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await alertService.listEvents(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async markAlertRead(req: Request, res: Response) {
    try {
      await alertService.markRead(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async markAllAlertsRead(req: Request, res: Response) {
    try {
      await alertService.markAllRead(req.params.enterpriseId);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async acknowledgeAlert(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      await alertService.acknowledge(req.params.id, userId);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async runAlertChecks(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const triggered = await alertService.runAlertChecks(enterpriseId);
      res.json({ data: { triggered } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }
}

export default new Tier2Controller();
