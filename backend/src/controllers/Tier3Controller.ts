import { Request, Response } from 'express';
import diseasePredictionService from '../services/DiseasePredictionService';
import genomicLineageService from '../services/GenomicLineageService';
import iotSensorService from '../services/IoTSensorService';
import supplyChainService from '../services/SupplyChainService';
import workforceService from '../services/WorkforceService';
import reportBuilderService from '../services/ReportBuilderService';
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

class Tier3Controller {

  // ═══════════════════ AI Disease Prediction ═══════════════════

  async getRiskDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await diseasePredictionService.getRiskDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listPredictions(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await diseasePredictionService.listPredictions(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createPrediction(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await diseasePredictionService.createPrediction({ ...req.body, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async resolvePrediction(req: Request, res: Response) {
    try {
      await diseasePredictionService.resolvePrediction(req.params.id, req.body.outcome || 'resolved');
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listOutbreakZones(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await diseasePredictionService.listOutbreakZones(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createOutbreakZone(req: Request, res: Response) {
    try {
      const data = await diseasePredictionService.createOutbreakZone(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async resolveOutbreakZone(req: Request, res: Response) {
    try {
      await diseasePredictionService.resolveOutbreakZone(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Genomic Lineage ════════════════════════

  async listGeneticProfiles(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await genomicLineageService.listProfiles(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createGeneticProfile(req: Request, res: Response) {
    try {
      const data = await genomicLineageService.createProfile(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateGeneticProfile(req: Request, res: Response) {
    try {
      const data = await genomicLineageService.updateProfile(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getLineageTree(req: Request, res: Response) {
    try {
      const depth = parseInt(req.query.depth as string) || 4;
      const data = await genomicLineageService.getLineageTree(req.params.animalId, depth);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listPairRecommendations(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await genomicLineageService.listPairRecommendations(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createPairRecommendation(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await genomicLineageService.createPairRecommendation({ ...req.body, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getGeneticDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await genomicLineageService.getGeneticDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ IoT Sensors ════════════════════════════

  async getSensorDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await iotSensorService.getSensorDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listSensors(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await iotSensorService.listSensors(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createSensor(req: Request, res: Response) {
    try {
      const data = await iotSensorService.createSensor(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateSensor(req: Request, res: Response) {
    try {
      const data = await iotSensorService.updateSensor(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteSensor(req: Request, res: Response) {
    try {
      await iotSensorService.deleteSensor(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async recordSensorReading(req: Request, res: Response) {
    try {
      const data = await iotSensorService.recordReading(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listSensorReadings(req: Request, res: Response) {
    try {
      const data = await iotSensorService.listReadings(req.params.sensorId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Supply Chain ═══════════════════════════

  async getSupplyChainDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await supplyChainService.getSupplyChainDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listBatches(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await supplyChainService.listBatches(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createBatch(req: Request, res: Response) {
    try {
      const data = await supplyChainService.createBatch(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateBatch(req: Request, res: Response) {
    try {
      const data = await supplyChainService.updateBatch(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listTraceabilityEvents(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await supplyChainService.listEvents(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createTraceabilityEvent(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await supplyChainService.createEvent({ ...req.body, recordedBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async verifyTraceabilityEvent(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await supplyChainService.verifyEvent(req.params.id, userId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getBatchTraceability(req: Request, res: Response) {
    try {
      const data = await supplyChainService.getBatchTraceability(req.params.batchId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async generateQRCode(req: Request, res: Response) {
    try {
      const data = await supplyChainService.generateQRCode(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listQRCodes(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await supplyChainService.listQRCodes(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Workforce & Tasks ═════════════════════

  async getWorkforceDashboard(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await workforceService.getWorkforceDashboard(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listTasks(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await workforceService.listTasks(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createTask(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await workforceService.createTask({ ...req.body, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateTask(req: Request, res: Response) {
    try {
      const data = await workforceService.updateTask(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteTask(req: Request, res: Response) {
    try {
      await workforceService.deleteTask(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listShifts(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await workforceService.listShifts(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createShift(req: Request, res: Response) {
    try {
      const data = await workforceService.createShift(req.body);
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateShift(req: Request, res: Response) {
    try {
      const data = await workforceService.updateShift(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async checkInShift(req: Request, res: Response) {
    try {
      await workforceService.checkIn(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async checkOutShift(req: Request, res: Response) {
    try {
      await workforceService.checkOut(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteShift(req: Request, res: Response) {
    try {
      await workforceService.deleteShift(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ Report Builder ═════════════════════════

  async listReportTemplates(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await reportBuilderService.listTemplates(enterpriseId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async createReportTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await reportBuilderService.createTemplate({ ...req.body, createdBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateReportTemplate(req: Request, res: Response) {
    try {
      const data = await reportBuilderService.updateTemplate(req.params.id, req.body);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteReportTemplate(req: Request, res: Response) {
    try {
      await reportBuilderService.deleteTemplate(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async generateReport(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const data = await reportBuilderService.generateReport({ ...req.body, generatedBy: userId });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listGeneratedReports(req: Request, res: Response) {
    try {
      const { enterpriseId } = req.params;
      if (!await ensureAccess(req, res, enterpriseId)) return;
      const data = await reportBuilderService.listGeneratedReports(enterpriseId, req.query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getReport(req: Request, res: Response) {
    try {
      const data = await reportBuilderService.getReport(req.params.id);
      if (!data) return res.status(404).json({ error: { message: 'Report not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async deleteReport(req: Request, res: Response) {
    try {
      await reportBuilderService.deleteReport(req.params.id);
      res.json({ data: { success: true } });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }
}

export default new Tier3Controller();
