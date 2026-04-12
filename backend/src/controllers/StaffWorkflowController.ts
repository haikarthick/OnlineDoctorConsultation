import { Request, Response } from 'express';
import staffWorkflowService from '../services/StaffWorkflowService';
import logger from '../utils/logger';

class StaffWorkflowController {

  // ═══════════════════ ANIMAL SEARCH (for workflow) ═══════════════════

  async searchAnimals(req: Request, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      if (query.length < 2) return res.json({ data: [] });
      const data = await staffWorkflowService.searchAnimals(query);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async searchVets(req: Request, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      const authReq = req as any;
      const data = await staffWorkflowService.searchVets(query, authReq.userId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getAnimalMedicalSummary(req: Request, res: Response) {
    try {
      const data = await staffWorkflowService.getAnimalMedicalSummary(req.params.animalId);
      if (!data.animal) return res.status(404).json({ error: { message: 'Animal not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ STAFF POSITIONS ═══════════════════

  async listStaffPositions(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.listStaffPositions(hospitalId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async addStaffPosition(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.addStaffPosition({ hospitalId, ...req.body });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateStaffPosition(req: Request, res: Response) {
    try {
      const data = await staffWorkflowService.updateStaffPosition(req.params.id, req.body);
      if (!data) return res.status(404).json({ error: { message: 'Position not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async removeStaffPosition(req: Request, res: Response) {
    try {
      await staffWorkflowService.removeStaffPosition(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ APPOINTMENT QUEUE ═══════════════════

  async getQueue(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.getQueue(hospitalId, req.query.status as string);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async checkInToQueue(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.checkInToQueue({ hospitalId, ...req.body });
      res.status(201).json({ data });
    } catch (err: any) {
      if (err.message?.startsWith('DUPLICATE_CHECKIN:')) {
        const [, queueNum, status] = err.message.split(':');
        return res.status(409).json({
          error: `This patient is already in the queue as #${queueNum} (${(status || '').replace(/_/g, ' ')}). Discharge or mark no-show before checking in again.`
        });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async triagePatient(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const data = await staffWorkflowService.triagePatient(req.params.id, {
        ...req.body,
        triagedBy: authReq.userId
      });
      if (!data) return res.status(404).json({ error: { message: 'Queue entry not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateQueueStatus(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const data = await staffWorkflowService.updateQueueStatus(req.params.id, req.body.status, authReq.userId);
      if (!data) return res.status(404).json({ error: { message: 'Queue entry not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getQueueStats(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.getQueueStats(hospitalId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ WORKFLOW CASES ═══════════════════

  async createWorkflowCase(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const authReq = req as any;
      const data = await staffWorkflowService.createWorkflowCase({
        hospitalId, ...req.body, createdBy: authReq.userId
      });
      res.status(201).json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async listWorkflowCases(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.listWorkflowCases(hospitalId, {
        stage: req.query.stage as string,
        status: req.query.status as string,
        vetId: req.query.vetId as string,
      });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getWorkflowCaseDetail(req: Request, res: Response) {
    try {
      const data = await staffWorkflowService.getWorkflowCaseDetail(req.params.id);
      if (!data) return res.status(404).json({ error: { message: 'Case not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async transitionWorkflowStage(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const data = await staffWorkflowService.transitionWorkflowStage(
        req.params.id, req.body.toStage, authReq.userId, req.body.notes
      );
      if (!data) return res.status(404).json({ error: { message: 'Case not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateWorkflowCase(req: Request, res: Response) {
    try {
      const data = await staffWorkflowService.updateWorkflowCase(req.params.id, req.body);
      if (!data) return res.status(404).json({ error: { message: 'Case not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getWorkflowDashboard(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.getWorkflowDashboard(hospitalId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ REFERRALS ═══════════════════

  async createReferral(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const authReq = req as any;
      const data = await staffWorkflowService.createReferral({
        hospitalId, fromVetId: authReq.userId, ...req.body
      });
      res.status(201).json({ data });
    } catch (err: any) {
      const status = err.message?.includes('Cannot create') || err.message?.includes('not found') || err.message?.includes('required') ? 400 : 500;
      res.status(status).json({ error: err.message });
    }
  }

  async listReferrals(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.listReferrals(hospitalId, {
        status: req.query.status as string,
        vetId: req.query.vetId as string,
      });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateReferralStatus(req: Request, res: Response) {
    try {
      const data = await staffWorkflowService.updateReferralStatus(
        req.params.id, req.body.status, req.body.responseNotes
      );
      if (!data) return res.status(404).json({ error: { message: 'Referral not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  // ═══════════════════ INPATIENT ADMISSIONS ═══════════════════

  async admitPatient(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const authReq = req as any;
      const data = await staffWorkflowService.admitPatient({
        hospitalId, admittedBy: authReq.userId, ...req.body
      });
      res.status(201).json({ data });
    } catch (err: any) {
      if (err.message?.startsWith('DUPLICATE_ADMIT:')) {
        const existingStatus = err.message.split(':')[1]?.replace(/_/g, ' ') || 'active';
        return res.status(409).json({ error: `This patient already has an active admission (${existingStatus}). Please discharge the current admission first before creating a new one.` });
      }
      res.status(500).json({ error: { message: err.message } });
    }
  }

  async listInpatients(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.listInpatients(hospitalId, req.query.status as string);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateInpatientStatus(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const data = await staffWorkflowService.updateInpatientStatus(
        req.params.id, req.body.status, authReq.userId, req.body.notes
      );
      if (!data) return res.status(404).json({ error: { message: 'Admission not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async addVitalsLog(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const data = await staffWorkflowService.addVitalsLog(req.params.id, {
        ...req.body, recordedBy: authReq.userId
      });
      if (!data) return res.status(404).json({ error: { message: 'Admission not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async updateInpatientDetails(req: Request, res: Response) {
    try {
      const data = await staffWorkflowService.updateInpatientDetails(req.params.id, req.body);
      if (!data) return res.status(404).json({ error: { message: 'Admission not found' } });
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getInpatientDashboard(req: Request, res: Response) {
    try {
      const { hospitalId } = req.params;
      const data = await staffWorkflowService.getInpatientDashboard(hospitalId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }

  async getAnimalHospitalVisits(req: Request, res: Response) {
    try {
      const { animalId } = req.params;
      const data = await staffWorkflowService.getAnimalHospitalVisits(animalId);
      res.json({ data });
    } catch (err: any) { res.status(500).json({ error: { message: err.message } }); }
  }
}

export default new StaffWorkflowController();
