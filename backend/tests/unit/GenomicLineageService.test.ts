import database from '../../src/utils/database';
import genomicService from '../../src/services/GenomicLineageService';

jest.mock('../../src/utils/database');

describe('GenomicLineageService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createProfile', () => {
    it('should create a genetic profile', async () => {
      const profile = { id: 'g1', enterprise_id: 'e1', animal_id: 'a1', breed: 'Holstein' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [profile] });
      const result = await genomicService.createProfile({ enterprise_id: 'e1', animal_id: 'a1', breed: 'Holstein' });
      expect(result).toEqual(profile);
    });
  });

  describe('listProfiles', () => {
    it('should list genetic profiles for an enterprise', async () => {
      const profiles = [{ id: 'g1' }, { id: 'g2' }];
      (database.query as jest.Mock).mockResolvedValue({ rows: profiles, rowCount: 2 });
      const result = await genomicService.listProfiles('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by animalId', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await genomicService.listProfiles('e1', { animalId: 'a1' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update a genetic profile', async () => {
      const updated = { id: 'g1', breed: 'Jersey' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });
      const result = await genomicService.updateProfile('g1', { breed: 'Jersey' });
      expect(result).toBeDefined();
    });
  });

  describe('getLineageTree', () => {
    it('should return lineage tree with default depth', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'a1', sire_id: null, dam_id: null }] });
      const result = await genomicService.getLineageTree('a1');
      expect(result).toHaveProperty('tree');
    });

    it('should accept custom depth', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await genomicService.getLineageTree('a1', 2);
      expect(result).toHaveProperty('tree');
    });
  });

  describe('createPairRecommendation', () => {
    it('should create a pair recommendation', async () => {
      const rec = { id: 'pr1', enterprise_id: 'e1', male_id: 'a1', female_id: 'a2' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [rec] });
      const result = await genomicService.createPairRecommendation({ enterprise_id: 'e1', male_id: 'a1', female_id: 'a2' });
      expect(result).toEqual(rec);
    });
  });

  describe('listPairRecommendations', () => {
    it('should list pair recommendations for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'pr1' }] });
      const result = await genomicService.listPairRecommendations('e1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getGeneticDashboard', () => {
    it('should return genetic dashboard', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '5', avg_inbreeding: '0.05' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await genomicService.getGeneticDashboard('e1');
      expect(result).toBeDefined();
    });
  });
});
