import VetProfileService from '../../src/services/VetProfileService';
import database from '../../src/utils/database';
import { NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');

const mockProfile = {
  id: 'vp-1',
  userId: 'vet-1',
  licenseNumber: 'LIC-001',
  specializations: ['surgery', 'dermatology'],
  qualifications: ['BVSc', 'MVSc'],
  yearsOfExperience: 10,
  bio: 'Experienced veterinarian',
  clinicName: 'Pet Care Clinic',
  clinicAddress: '123 Vet Street',
  consultationFee: 75,
  currency: 'USD',
  isAvailable: true,
  acceptsEmergency: true,
  availableDays: 'Mon-Fri',
  availableHoursStart: '09:00',
  availableHoursEnd: '17:00',
  languages: ['English', 'Spanish'],
  rating: 4.5,
  totalReviews: 20,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('VetProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('should create a vet profile', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockProfile] });

      const result = await VetProfileService.createProfile('vet-1', {
        licenseNumber: 'LIC-001',
        specializations: ['surgery'],
        yearsOfExperience: 10,
        consultationFee: 75,
      } as any);

      expect(result).toBeDefined();
      expect(result.licenseNumber).toBe('LIC-001');
    });
  });

  describe('getProfileByUserId', () => {
    it('should return profile by user id', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockProfile] });

      const result = await VetProfileService.getProfileByUserId('vet-1');
      expect(result.userId).toBe('vet-1');
    });

    it('should throw NotFoundError if profile not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(VetProfileService.getProfileByUserId('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listVets', () => {
    it('should list vets with default pagination', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockProfile] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await VetProfileService.listVets();
      expect(result.vets).toHaveLength(1);
      expect(result.total).toBe(5);
    });

    it('should filter by specialization', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockProfile] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await VetProfileService.listVets(10, 0, { specialization: 'surgery' });
      expect(result.vets).toHaveLength(1);
    });

    it('should filter by emergency acceptance', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockProfile] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await VetProfileService.listVets(10, 0, { acceptsEmergency: true });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by min rating', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockProfile] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await VetProfileService.listVets(10, 0, { minRating: 4 });
      expect(database.query).toHaveBeenCalled();
    });

    it('should search by name or specialization', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await VetProfileService.listVets(10, 0, { search: 'surgery' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update vet profile', async () => {
      const updated = { ...mockProfile, consultationFee: 100 };
      (database.query as jest.Mock).mockResolvedValue({ rows: [updated] });

      const result = await VetProfileService.updateProfile('vet-1', { consultationFee: 100 } as any);
      expect(result.consultationFee).toBe(100);
    });

    it('should throw NotFoundError if profile not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        VetProfileService.updateProfile('non-existent', { bio: 'test' } as any)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
