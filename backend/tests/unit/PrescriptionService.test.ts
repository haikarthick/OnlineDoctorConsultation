import PrescriptionService from '../../src/services/PrescriptionService';
import database from '../../src/utils/database';
import { NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');

const mockPrescription = {
  id: 'presc-1',
  veterinarianId: 'vet-1',
  consultationId: 'cons-1',
  petOwnerId: 'owner-1',
  animalId: 'animal-1',
  medications: [
    { name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily', duration: '7 days', instructions: 'With food' }
  ],
  instructions: 'Complete the full course',
  diagnosis: 'Bacterial infection',
  validUntil: '2025-01-01',
  followUpDate: '2024-02-15',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PrescriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPrescription', () => {
    it('should create a prescription', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPrescription] });

      const result = await PrescriptionService.createPrescription('vet-1', {
        consultationId: 'cons-1',
        petOwnerId: 'owner-1',
        animalId: 'animal-1',
        medications: [{ name: 'Amoxicillin', dosage: '250mg', frequency: 'Twice daily' }],
        instructions: 'Complete the full course',
      } as any);

      expect(result).toBeDefined();
      expect(result.medications).toHaveLength(1);
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prescriptions'),
        expect.any(Array)
      );
    });
  });

  describe('getPrescription', () => {
    it('should return prescription by id', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPrescription] });

      const result = await PrescriptionService.getPrescription('presc-1');
      expect(result.id).toBe('presc-1');
      expect(result.medications).toHaveLength(1);
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(PrescriptionService.getPrescription('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listByConsultation', () => {
    it('should list prescriptions by consultation', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPrescription] });

      const result = await PrescriptionService.listByConsultation('cons-1');
      expect(result).toHaveLength(1);
    });

    it('should return empty array if no prescriptions', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await PrescriptionService.listByConsultation('cons-999');
      expect(result).toHaveLength(0);
    });
  });

  describe('listByPetOwner', () => {
    it('should list prescriptions for pet owner', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPrescription] });

      const result = await PrescriptionService.listByPetOwner('owner-1');
      expect(result).toHaveLength(1);
    });

    it('should support pagination', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await PrescriptionService.listByPetOwner('owner-1', { limit: 5, offset: 10 });
      expect(database.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['owner-1'])
      );
    });
  });

  describe('listByVeterinarian', () => {
    it('should list prescriptions for veterinarian', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockPrescription] });

      const result = await PrescriptionService.listByVeterinarian('vet-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('listByAnimal', () => {
    it('should list prescriptions for animal with total', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockPrescription] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const result = await PrescriptionService.listByAnimal('animal-1');
      expect(result.prescriptions).toHaveLength(1);
      expect(result.total).toBe(3);
    });
  });

  describe('deactivatePrescription', () => {
    it('should deactivate a prescription', async () => {
      const deactivated = { ...mockPrescription, isActive: false };
      (database.query as jest.Mock).mockResolvedValue({ rows: [deactivated] });

      const result = await PrescriptionService.deactivatePrescription('presc-1');
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundError if not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(PrescriptionService.deactivatePrescription('non-existent')).rejects.toThrow(NotFoundError);
    });
  });
});
