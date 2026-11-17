import { Request, Response } from 'express';
import healthAnalyticsService from '../services/HealthAnalyticsService';
import breedingService from '../services/BreedingService';
import feedInventoryService from '../services/FeedInventoryService';
import complianceService from '../services/ComplianceService';
import financialService from '../services/FinancialService';
import alertService from '../services/AlertService';
import enterpriseService from '../services/EnterpriseService';
import FarmAccessService from '../services/FarmAccessService';
import { ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

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

  async createObservation(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await healthAnalyticsService.createObservation({ ...req.body, observerId: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async resolveObservation(req: Request, res: Response) {
    try {
      await healthAnalyticsService.resolveObservation(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
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

  async listFeeds(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await feedInventoryService.listFeeds(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createFeed(req: Request, res: Response) {
    try {
      const data = await feedInventoryService.createFeed(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateFeed(req: Request, res: Response) {
    try {
      const data = await feedInventoryService.updateFeed(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async restockFeed(req: Request, res: Response) {
    try {
      const data = await feedInventoryService.restock(req.params.id, req.body.quantity);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteFeed(req: Request, res: Response) {
    try {
      await feedInventoryService.deleteFeed(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async logFeedConsumption(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await feedInventoryService.logConsumption({ ...req.body, recordedBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listConsumptionLogs(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await feedInventoryService.listConsumptionLogs(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getFeedAnalytics(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await feedInventoryService.getFeedAnalytics(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
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

  async createComplianceDoc(req: Request, res: Response) {
    try {
      const data = await complianceService.create(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateComplianceDoc(req: Request, res: Response) {
    try {
      const data = await complianceService.update(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async verifyComplianceDoc(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await complianceService.verify(req.params.id, userId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteComplianceDoc(req: Request, res: Response) {
    try {
      await complianceService.delete(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
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
    try {
      const userId = (req as any).userId;
      const data = await financialService.create({ ...req.body, recordedBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateFinancialRecord(req: Request, res: Response) {
    try {
      const data = await financialService.update(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteFinancialRecord(req: Request, res: Response) {
    try {
      await financialService.delete(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
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
