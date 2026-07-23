import database from '../../src/utils/database';
import staffWorkflowService from '../../src/services/StaffWorkflowService';

jest.mock('../../src/utils/database');

describe('StaffWorkflowService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listStaffPositions', () => {
    it('should list staff positions for a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'sp1', hospital_id: 'h1', position: 'Nurse' }] });
      const result = await staffWorkflowService.listStaffPositions('h1');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'sp1');
    });
  });

  describe('addStaffPosition', () => {
    it('should add a staff position', async () => {
      const pos = { id: 'sp1', hospital_id: 'h1', user_id: 'u1', position: 'Nurse' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [pos] });
      const result = await staffWorkflowService.addStaffPosition({ hospitalId: 'h1', userId: 'u1', position: 'Nurse' });
      expect(result).toEqual(pos);
    });
  });

  describe('updateStaffPosition', () => {
    it('should update a staff position', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'sp1', position: 'Senior Nurse' }] });
      const result = await staffWorkflowService.updateStaffPosition('sp1', { position: 'Senior Nurse' });
      expect(result).toBeDefined();
    });

    it('should return null if no fields provided', async () => {
      const result = await staffWorkflowService.updateStaffPosition('sp1', {});
      expect(result).toBeNull();
    });
  });

  describe('removeStaffPosition', () => {
    it('should remove a staff position', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await staffWorkflowService.removeStaffPosition('sp1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['sp1']);
    });
  });

  describe('getQueue', () => {
    it('should get the queue for a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'q1', hospital_id: 'h1' }] });
      const result = await staffWorkflowService.getQueue('h1');
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await staffWorkflowService.getQueue('h1', 'waiting');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('checkInToQueue', () => {
    it('should check in a patient to the queue', async () => {
      const entry = { id: 'q1', hospital_id: 'h1', animal_id: 'a1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })                 // duplicate check — none found
        .mockResolvedValueOnce({ rows: [{ next_num: 1 }] })  // next queue number
        .mockResolvedValueOnce({ rows: [entry] });           // INSERT
      const result = await staffWorkflowService.checkInToQueue({ hospitalId: 'h1', animalId: 'a1', ownerId: 'o1', reason: 'Checkup' });
      expect(result).toEqual(entry);
    });
  });

  describe('triagePatient', () => {
    it('should triage a patient', async () => {
      const triaged = { id: 'q1', triage_level: 3 };
      (database.query as jest.Mock).mockResolvedValue({ rows: [triaged] });
      const result = await staffWorkflowService.triagePatient('q1', { triageLevel: 3, triagedBy: 'u1' });
      expect(result).toEqual(triaged);
    });
  });

  describe('updateQueueStatus', () => {
    it('should update queue entry status', async () => {
      const updated = { id: 'q1', status: 'in_progress' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await staffWorkflowService.updateQueueStatus('q1', 'in_progress', 'u1');
      expect(result).toEqual(updated);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = { total_waiting: '5', total_in_progress: '2' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [stats] });
      const result = await staffWorkflowService.getQueueStats('h1');
      expect(result).toEqual(stats);
    });
  });

  describe('createWorkflowCase', () => {
    it('should create a workflow case', async () => {
      const wfCase = { id: 'wf1', hospital_id: 'h1', chief_complaint: 'Limping' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [wfCase] });
      const result = await staffWorkflowService.createWorkflowCase({ hospitalId: 'h1', chiefComplaint: 'Limping', createdBy: 'u1' });
      expect(result).toEqual(wfCase);
    });
  });

  describe('listWorkflowCases', () => {
    it('should list workflow cases', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'wf1' }] });
      const result = await staffWorkflowService.listWorkflowCases('h1');
      expect(result).toHaveLength(1);
    });

    it('should filter by stage', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await staffWorkflowService.listWorkflowCases('h1', { stage: 'triage' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('transitionWorkflowStage', () => {
    it('should transition a workflow stage', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'wf1', current_stage: 'triage' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'wf1', current_stage: 'examination' }] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await staffWorkflowService.transitionWorkflowStage('wf1', 'examination', 'u1');
      expect(result).toBeDefined();
    });
  });

  describe('getWorkflowCaseDetail', () => {
    it('should get workflow case detail with transitions', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'wf1', chief_complaint: 'Limping' }] })
        .mockResolvedValueOnce({ rows: [{ id: 't1', from_stage: 'triage', to_stage: 'examination' }] });
      const result = await staffWorkflowService.getWorkflowCaseDetail('wf1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('transitions');
    });

    it('should return null if case not found', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await staffWorkflowService.getWorkflowCaseDetail('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getWorkflowDashboard', () => {
    it('should return workflow dashboard', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ stage: 'triage', count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ priority: 'high', count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ created_today: '5' }] })
        .mockResolvedValueOnce({ rows: [{ avg_duration: '120' }] });
      const result = await staffWorkflowService.getWorkflowDashboard('h1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('stageCounts');
    });
  });

  describe('createReferral', () => {
    it('should create a referral', async () => {
      const referral = { id: 'r1', from_vet_id: 'v1', to_vet_id: 'v2' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [referral] });
      const result = await staffWorkflowService.createReferral({ hospitalId: 'h1', fromVetId: 'v1', toVetId: 'v2', reason: 'Specialist needed' });
      expect(result).toEqual(referral);
    });
  });

  describe('listReferrals', () => {
    it('should list referrals for a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'r1' }] });
      const result = await staffWorkflowService.listReferrals('h1');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateReferralStatus', () => {
    it('should update referral status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'r1', status: 'accepted' }] });
      const result = await staffWorkflowService.updateReferralStatus('r1', 'accepted');
      expect(result).toBeDefined();
    });
  });

  describe('admitPatient', () => {
    it('should admit a patient', async () => {
      const admission = { id: 'adm1', hospital_id: 'h1', animal_id: 'a1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })          // duplicate admission check — none found
        .mockResolvedValueOnce({ rows: [admission] }); // INSERT
      const result = await staffWorkflowService.admitPatient({ hospitalId: 'h1', animalId: 'a1', ownerId: 'o1', admittedBy: 'u1', admissionType: 'emergency' });
      expect(result).toEqual(admission);
    });
  });

  describe('listInpatients', () => {
    it('should list inpatients', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'adm1' }] });
      const result = await staffWorkflowService.listInpatients('h1');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateInpatientStatus', () => {
    it('should update inpatient status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'adm1', status: 'discharged' }] });
      const result = await staffWorkflowService.updateInpatientStatus('adm1', 'discharged');
      expect(result).toBeDefined();
    });
  });

  describe('addVitalsLog', () => {
    it('should add vitals log for an inpatient', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'adm1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'v1', temperature: 38.5 }] });
      const result = await staffWorkflowService.addVitalsLog('adm1', { temperature: 38.5, recordedBy: 'u1' });
      expect(result).toBeDefined();
    });
  });

  describe('updateInpatientDetails', () => {
    it('should update inpatient details', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'adm1', room_number: '201' }] });
      const result = await staffWorkflowService.updateInpatientDetails('adm1', { roomNumber: '201' });
      expect(result).toBeDefined();
    });
  });

  describe('getInpatientDashboard', () => {
    it('should return inpatient dashboard', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ total_admitted: '10', total_discharged: '5' }] });
      const result = await staffWorkflowService.getInpatientDashboard('h1');
      expect(result).toBeDefined();
    });
  });
});
