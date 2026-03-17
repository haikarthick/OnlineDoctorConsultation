import database from '../../src/utils/database';
import treatmentCampaignService from '../../src/services/TreatmentCampaignService';

jest.mock('../../src/utils/database');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('TreatmentCampaignService', () => {
  beforeEach(() => jest.resetAllMocks());

  const snakeCampaign = {
    id: 'c1', enterprise_id: 'e1', group_id: 'g1', campaign_type: 'deworming',
    name: 'Annual Deworming', description: null, product_used: null, dosage: null,
    target_count: '0', completed_count: '0', status: 'planned',
    scheduled_date: '2024-07-01', started_at: null, completed_at: null,
    administered_by: null, approved_by: null, cost: '0', notes: null,
    metadata: null, created_at: '2024-01-01', updated_at: '2024-01-01',
    group_name: null, administered_by_name: null
  };

  describe('createCampaign', () => {
    it('should create a treatment campaign', async () => {
      const campaign = { id: 'mock-uuid', enterprise_id: 'e1', name: 'Annual Deworming', campaign_type: 'deworming', group_id: 'g1', scheduled_date: '2024-07-01', status: 'planned' };
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [campaign] });
      const result = await treatmentCampaignService.createCampaign({ enterpriseId: 'e1', name: 'Annual Deworming', campaignType: 'deworming', groupId: 'g1', scheduledDate: '2024-07-01' });
      expect(result).toEqual(expect.objectContaining({ id: 'mock-uuid', name: 'Annual Deworming' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO treatment_campaigns'), expect.any(Array));
    });
  });

  describe('getCampaign', () => {
    it('should return a campaign by id', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [snakeCampaign] });
      const result = await treatmentCampaignService.getCampaign('c1');
      expect(result).toEqual(expect.objectContaining({ id: 'c1', name: 'Annual Deworming', enterpriseId: 'e1' }));
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await expect(treatmentCampaignService.getCampaign('nonexistent')).rejects.toThrow();
    });
  });

  describe('listByEnterprise', () => {
    it('should list campaigns for an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })   // COUNT
        .mockResolvedValueOnce({ rows: [snakeCampaign, { ...snakeCampaign, id: 'c2' }, { ...snakeCampaign, id: 'c3' }] }); // SELECT
      const result = await treatmentCampaignService.listByEnterprise('e1');
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });
  });

  describe('updateCampaign', () => {
    it('should update a campaign', async () => {
      const updated = { ...snakeCampaign, status: 'in_progress', completed_count: '50' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })               // UPDATE query
        .mockResolvedValueOnce({ rows: [updated] });       // getCampaign SELECT
      const result = await treatmentCampaignService.updateCampaign('c1', { status: 'in_progress', completedCount: 50 });
      expect(result).toEqual(expect.objectContaining({ id: 'c1', status: 'in_progress' }));
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })     // UPDATE
        .mockResolvedValueOnce({ rows: [] });    // getCampaign → empty
      await expect(treatmentCampaignService.updateCampaign('nonexistent', { status: 'completed' })).rejects.toThrow();
    });
  });

  describe('deleteCampaign', () => {
    it('should delete a campaign', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await treatmentCampaignService.deleteCampaign('c1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['c1']);
    });
  });
});
