/**
 * Controller: Next-Generation Innovative Modules
 * AI Vet Copilot, Digital Twin, Marketplace, Sustainability, Wellness, Geospatial
 */
import { Request, Response } from 'express';
import aiCopilotService from '../services/AiCopilotService';
import digitalTwinService from '../services/DigitalTwinService';
import marketplaceService from '../services/MarketplaceService';
import sustainabilityService from '../services/SustainabilityService';
import wellnessService from '../services/WellnessService';
import geospatialService from '../services/GeospatialService';
import enterpriseService from '../services/EnterpriseService';
import logger from '../utils/logger';

async function ensureAccess(req: Request, res: Response, enterpriseId: string): Promise<boolean> {
  const userId = (req as any).userId;
  const role = (req as any).userRole;
  if (role === 'admin') return true;
  const hasAccess = await enterpriseService.hasAccess(enterpriseId, userId);
  if (!hasAccess) {
    res.status(403).json({ error: { message: 'No access to this enterprise' } });
    return false;
  }
  return true;
}

class Tier4Controller {

  // ═══════════════════ AI Veterinary Copilot ═══════════════════

  async listChatSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await aiCopilotService.listSessions(userId, req.query);
      res.json({ data });
    } catch (err: any) { logger.error('listChatSessions failed', { error: err.message, userId: (req as any).userId }); res.status(500).json({ error: { message: err.message } }); }
  }

  async createChatSession(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await aiCopilotService.createSession({ ...req.body, userId });
      res.status(201).json({ data });
    } catch (err: any) { logger.error('createChatSession failed', { error: err.message, userId: (req as any).userId, body: req.body }); res.status(500).json({ error: { message: err.message } }); }
  }

  async getChatSession(req: Request, res: Response) {
    try {
      const data = await aiCopilotService.getSession(req.params.id);
      if (!data) return res.status(404).json({ error: { message: 'Session not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteChatSession(req: Request, res: Response) {
    try {
      await aiCopilotService.deleteSession(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listChatMessages(req: Request, res: Response) {
    try {
      const data = await aiCopilotService.listMessages(req.params.sessionId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async sendChatMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await aiCopilotService.sendMessage(req.params.sessionId, userId, req.body.content);
      res.status(201).json({ data });
    } catch (err: any) { logger.error('sendChatMessage failed', { error: err.message, sessionId: req.params.sessionId }); res.status(500).json({ error: { message: err.message } }); }
  }

  async checkDrugInteractions(req: Request, res: Response) {
    try {
      const data = await aiCopilotService.checkDrugInteractions(req.body.drugs || []);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async analyzeSymptoms(req: Request, res: Response) {
    try {
      const data = await aiCopilotService.analyzeSymptoms(req.body.symptoms || [], req.body.species);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async analyzeScan(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: { message: 'No image file uploaded. Please attach a scan/X-ray/MRI image.' } });
      }
      const imageBase64 = file.buffer.toString('base64');
      const mimeType = file.mimetype;
      const context = {
        species: req.body.species,
        scanType: req.body.scanType,
        bodyPart: req.body.bodyPart,
        notes: req.body.notes,
      };
      const data = await aiCopilotService.analyzeScan(imageBase64, mimeType, context);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Digital Twin & Simulator ═══════════════════

  async listDigitalTwins(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await digitalTwinService.listTwins(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createDigitalTwin(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await digitalTwinService.createTwin({ ...req.body, enterpriseId: req.params.enterpriseId, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateDigitalTwin(req: Request, res: Response) {
    try {
      const data = await digitalTwinService.updateTwin(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteDigitalTwin(req: Request, res: Response) {
    try {
      await digitalTwinService.deleteTwin(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listSimulations(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await digitalTwinService.listSimulations(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async runSimulation(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await digitalTwinService.runSimulation({ ...req.body, enterpriseId: req.params.enterpriseId, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getSimulation(req: Request, res: Response) {
    try {
      const data = await digitalTwinService.getSimulation(req.params.id);
      if (!data) return res.status(404).json({ error: { message: 'Simulation not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteSimulation(req: Request, res: Response) {
    try {
      await digitalTwinService.deleteSimulation(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getDigitalTwinDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await digitalTwinService.getDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Public Marketplace (no auth) ═══════════════════

  async publicListMarketplaceListings(req: Request, res: Response) {
    try {
      const data = await marketplaceService.listPublicListings(req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async publicGetMarketplaceListing(req: Request, res: Response) {
    try {
      const data = await marketplaceService.getPublicListing(req.params.id);
      if (!data) return res.status(404).json({ error: { message: 'Listing not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async publicGetMarketplaceStats(req: Request, res: Response) {
    try {
      const data = await marketplaceService.getPublicStats();
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Marketplace & Auctions ═══════════════════

  async listMarketplaceListings(req: Request, res: Response) {
    try {
      const data = await marketplaceService.listListings(req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getMarketplaceListing(req: Request, res: Response) {
    try {
      const data = await marketplaceService.getListing(req.params.id);
      if (!data) return res.status(404).json({ error: { message: 'Listing not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createMarketplaceListing(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await marketplaceService.createListing({ ...req.body, sellerId: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateMarketplaceListing(req: Request, res: Response) {
    try {
      const data = await marketplaceService.updateListing(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteMarketplaceListing(req: Request, res: Response) {
    try {
      await marketplaceService.deleteListing(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listMarketplaceBids(req: Request, res: Response) {
    try {
      const data = await marketplaceService.listBids(req.params.listingId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async placeMarketplaceBid(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await marketplaceService.placeBid({ ...req.body, listingId: req.params.listingId, bidderId: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listMarketplaceOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const role = (req.query.role as string) || 'buyer';
      const data = await marketplaceService.listOrders(userId, role as any);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createMarketplaceOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await marketplaceService.createOrder({ ...req.body, buyerId: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const data = await marketplaceService.updateOrderStatus(req.params.id, req.body.status);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getMarketplaceDashboard(req: Request, res: Response) {
    try {
      const data = await marketplaceService.getDashboard(req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ── Admin Marketplace Controls ──

  async adminListMarketplaceListings(req: Request, res: Response) {
    try {
      const data = await marketplaceService.adminListAllListings(req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async adminApproveMarketplaceListing(req: Request, res: Response) {
    try {
      const data = await marketplaceService.adminApproveListing(req.params.id, req.body.notes);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async adminRejectMarketplaceListing(req: Request, res: Response) {
    try {
      const data = await marketplaceService.adminRejectListing(req.params.id, req.body.reason);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async adminToggleHotDeal(req: Request, res: Response) {
    try {
      const data = await marketplaceService.adminToggleHotDeal(req.params.id, req.body.isHotDeal);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async adminToggleFeatured(req: Request, res: Response) {
    try {
      const data = await marketplaceService.adminToggleFeatured(req.params.id, req.body.featured);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getMarketplaceStats(req: Request, res: Response) {
    try {
      const data = await marketplaceService.getMarketplaceStats();
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getMarketPrices(req: Request, res: Response) {
    try {
      const data = await marketplaceService.getMarketPrices(req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Sustainability & Carbon ═══════════════════

  async listSustainabilityMetrics(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await sustainabilityService.listMetrics(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createSustainabilityMetric(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await sustainabilityService.createMetric({ ...req.body, enterpriseId: req.params.enterpriseId, recordedBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateSustainabilityMetric(req: Request, res: Response) {
    try {
      const data = await sustainabilityService.updateMetric(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteSustainabilityMetric(req: Request, res: Response) {
    try {
      await sustainabilityService.deleteMetric(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listSustainabilityGoals(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await sustainabilityService.listGoals(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createSustainabilityGoal(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await sustainabilityService.createGoal({ ...req.body, enterpriseId: req.params.enterpriseId, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateSustainabilityGoal(req: Request, res: Response) {
    try {
      const data = await sustainabilityService.updateGoal(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteSustainabilityGoal(req: Request, res: Response) {
    try {
      await sustainabilityService.deleteGoal(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getCarbonFootprint(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await sustainabilityService.estimateCarbonFootprint(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getSustainabilityDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await sustainabilityService.getDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Client Portal & Wellness ═══════════════════

  async listWellnessScorecards(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await wellnessService.listScorecards(userId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createWellnessScorecard(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await wellnessService.createScorecard({ ...req.body, ownerId: userId, assessedBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateWellnessScorecard(req: Request, res: Response) {
    try {
      const data = await wellnessService.updateScorecard(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteWellnessScorecard(req: Request, res: Response) {
    try {
      await wellnessService.deleteScorecard(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listWellnessReminders(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await wellnessService.listReminders(userId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createWellnessReminder(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await wellnessService.createReminder({ ...req.body, ownerId: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async completeReminder(req: Request, res: Response) {
    try {
      const data = await wellnessService.completeReminder(req.params.id);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async snoozeReminder(req: Request, res: Response) {
    try {
      const data = await wellnessService.snoozeReminder(req.params.id, req.body.until);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteWellnessReminder(req: Request, res: Response) {
    try {
      await wellnessService.deleteReminder(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getWellnessDashboard(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await wellnessService.getDashboard(userId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Geospatial Analytics ═══════════════════

  async listGeofenceZones(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await geospatialService.listZones(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createGeofenceZone(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await geospatialService.createZone({ ...req.body, enterpriseId: req.params.enterpriseId, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateGeofenceZone(req: Request, res: Response) {
    try {
      const data = await geospatialService.updateZone(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteGeofenceZone(req: Request, res: Response) {
    try {
      await geospatialService.deleteZone(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listGeospatialEvents(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await geospatialService.listEvents(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createGeospatialEvent(req: Request, res: Response) {
    try {
      const data = await geospatialService.createEvent({ ...req.body, enterpriseId: req.params.enterpriseId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getHeatmapData(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await geospatialService.getHeatmapData(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getMovementTrail(req: Request, res: Response) {
    try {
      const data = await geospatialService.getMovementTrail(req.params.animalId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getGeospatialDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await geospatialService.getDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }
}

export default new Tier4Controller();
