import database from '../../src/utils/database';
import diseasePredictionService from '../../src/services/DiseasePredictionService';

jest.mock('../../src/utils/database');

describe('DiseasePredictionService', () => {
  beforeEach(() => { jest.clearAllMocks(); (database.query as jest.Mock).mockReset(); });

  describe('createPrediction', () => {
    it('should create a disease prediction', async () => {
      const pred = { id: 'p1', enterprise_id: 'e1', disease_name: 'BVD', risk_score: 0.8 };
      (database.query as jest.Mock).mockResolvedValue({ rows: [pred] });
      const result = await diseasePredictionService.createPrediction({ enterpriseId: 'e1', diseaseName: 'BVD', riskScore: 0.8 });
      expect(result).toEqual(pred);
    });
  });

  describe('listPredictions', () => {
    it('should list predictions for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'p1' }, { id: 'p2' }], rowCount: 2 });
      const result = await diseasePredictionService.listPredictions('e1');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
      await diseasePredictionService.listPredictions('e1', { status: 'active' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('resolvePrediction', () => {
    it('should resolve a prediction', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await diseasePredictionService.resolvePrediction('p1', 'confirmed');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('getRiskDashboard', () => {
    it('should return risk dashboard', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })    // activePredictions
        .mockResolvedValueOnce({ rows: [] })    // riskTimeline
        .mockResolvedValueOnce({ rows: [] })    // outcomeDist
        .mockResolvedValueOnce({ rows: [] });   // topRiskAnimals
      const result = await diseasePredictionService.getRiskDashboard('e1');
      expect(result).toBeDefined();
    });
  });

  describe('createOutbreakZone', () => {
    it('should create an outbreak zone', async () => {
      const zone = { id: 'z1', enterprise_id: 'e1', disease_name: 'Avian Flu', status: 'active' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [zone] });
      const result = await diseasePredictionService.createOutbreakZone({ enterpriseId: 'e1', diseaseName: 'Avian Flu' });
      expect(result).toEqual(zone);
    });
  });

  describe('listOutbreakZones', () => {
    it('should list outbreak zones for an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'z1', disease: 'Avian Flu' }] });
      const result = await diseasePredictionService.listOutbreakZones('e1');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('resolveOutbreakZone', () => {
    it('should resolve an outbreak zone', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await diseasePredictionService.resolveOutbreakZone('z1');
      expect(database.query).toHaveBeenCalled();
    });
  });
});
