import database from '../../src/utils/database';
import medicalRecordService from '../../src/services/MedicalRecordService';

jest.mock('../../src/utils/database');

describe('MedicalRecordService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createRecord', () => {
    it('should create a medical record', async () => {
      const record = { id: 'mr1', animal_id: 'a1', record_type: 'examination' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'mr1' }] })   // INSERT
        .mockResolvedValueOnce({ rows: [] })                 // logMedicalAudit
        .mockResolvedValueOnce({ rows: [record] });          // getRecord
      const result = await medicalRecordService.createRecord('u1', { animalId: 'a1', recordType: 'examination', title: 'Checkup', content: 'Routine' });
      expect(result).toBeDefined();
    });
  });

  describe('getRecord', () => {
    it('should get a medical record', async () => {
      const record = { id: 'mr1', animal_id: 'a1' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [record] });
      const result = await medicalRecordService.getRecord('mr1');
      expect(result).toEqual(record);
    });
  });

  describe('listRecords', () => {
    it('should list records with total', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'mr1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await medicalRecordService.listRecords({ userId: 'u1' });
      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by animalId', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      await medicalRecordService.listRecords({ animalId: 'a1' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateRecord', () => {
    it('should update a medical record', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'mr1', title: 'Old', content: 'Old', severity: 'normal' }] })  // getRecord (old)
        .mockResolvedValueOnce({ rows: [{ id: 'mr1' }] })                                                     // UPDATE RETURNING
        .mockResolvedValueOnce({ rows: [{ id: 'mr1', title: 'Updated', content: 'Old', severity: 'normal' }] }) // getRecord (new)
        .mockResolvedValueOnce({ rows: [] });                                                                   // logMedicalAudit
      const result = await medicalRecordService.updateRecord('mr1', { title: 'Updated' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteRecord', () => {
    it('should soft delete a record', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'mr1', status: 'active' }] })  // getRecord
        .mockResolvedValueOnce({ rows: [] })                                  // UPDATE status=archived
        .mockResolvedValueOnce({ rows: [] });                                 // logMedicalAudit
      await medicalRecordService.deleteRecord('mr1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('createVaccination', () => {
    it('should create a vaccination record', async () => {
      const vaccination = { id: 'v1', animal_id: 'a1', vaccine_name: 'Rabies' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [vaccination] });
      const result = await medicalRecordService.createVaccination('a1', { vaccineName: 'Rabies', dateAdministered: '2024-01-01' });
      expect(result).toBeDefined();
    });
  });

  describe('listVaccinations', () => {
    it('should list vaccinations for an animal', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await medicalRecordService.listVaccinations('a1');
      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('addWeight', () => {
    it('should add a weight record', async () => {
      const weight = { id: 'w1', animal_id: 'a1', weight: 25.5 };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'w1' }] })   // INSERT weight_history
        .mockResolvedValueOnce({ rows: [] })                // UPDATE animals weight
        .mockResolvedValueOnce({ rows: [] })                // logMedicalAudit
        .mockResolvedValueOnce({ rows: [weight] });         // SELECT weight_history
      const result = await medicalRecordService.addWeight('a1', 25.5, 'kg');
      expect(result).toBeDefined();
    });
  });

  describe('listWeightHistory', () => {
    it('should list weight history', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'w1', weight: 25.5 }] });
      const result = await medicalRecordService.listWeightHistory('a1');
      expect(result).toHaveLength(1);
    });
  });

  describe('createAllergy', () => {
    it('should create an allergy record', async () => {
      const allergy = { id: 'al1', animal_id: 'a1', allergen: 'Pollen' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'al1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [allergy] });
      const result = await medicalRecordService.createAllergy('a1', { allergen: 'Pollen', severity: 'mild' });
      expect(result).toBeDefined();
    });
  });

  describe('listAllergies', () => {
    it('should list allergies', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'al1' }] });
      const result = await medicalRecordService.listAllergies('a1');
      expect(result).toHaveLength(1);
    });
  });

  describe('createLabResult', () => {
    it('should create a lab result', async () => {
      const lab = { id: 'lr1', animal_id: 'a1', test_name: 'Blood Test' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'lr1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [lab] });
      const result = await medicalRecordService.createLabResult('a1', { testName: 'Blood Test', testDate: '2024-01-01' });
      expect(result).toBeDefined();
    });
  });

  describe('listLabResults', () => {
    it('should list lab results', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'lr1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await medicalRecordService.listLabResults('a1');
      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getAnimalTimeline', () => {
    it('should return a timeline of events', async () => {
      (database.query as jest.Mock)
        .mockResolvedValue({ rows: [] });
      const result = await medicalRecordService.getAnimalTimeline('a1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAuditLog', () => {
    it('should return audit log entries', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'audit1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await medicalRecordService.getAuditLog({});
      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
