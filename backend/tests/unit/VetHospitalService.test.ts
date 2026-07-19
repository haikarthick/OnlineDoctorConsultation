import database from '../../src/utils/database';
import vetHospitalService from '../../src/services/VetHospitalService';

jest.mock('../../src/utils/database');
// inviteDoctor sends a real invite email — without this mock (and before the
// test-env guard in EmailService), running this suite locally sent an actual
// email through the developer's Gmail SMTP credentials in .env.
jest.mock('../../src/services/EmailService', () => ({
  __esModule: true,
  default: { send: jest.fn().mockResolvedValue({ messageId: 'test-msg', mode: 'mock' }) }
}));

describe('VetHospitalService', () => {
  beforeEach(() => { jest.clearAllMocks(); (database.query as jest.Mock).mockReset(); });

  const mockHospitalRow = {
    id: 'h1', name: 'VetCare Hospital', hospital_type: 'general', registration_number: 'REG001',
    city: 'NYC', state: 'NY', country: 'US', postal_code: '10001',
    gps_latitude: '40.7128', gps_longitude: '-74.0060', phone: '123',
    email: 'h@test.com', is_24_hours: true, has_emergency: true, has_pharmacy: false,
    has_lab: false, has_imaging: false, has_surgery: false, has_icu: false,
    has_ambulance: false, owner_id: 'o1', is_verified: false, is_active: true,
    verification_status: 'pending', total_reviews: '0', total_consultations: '0',
    created_at: '2024-01-01', updated_at: '2024-01-01'
  };

  describe('createHospital', () => {
    it('should create a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockHospitalRow] });
      const result = await vetHospitalService.createHospital('o1', { name: 'VetCare Hospital', hospitalType: 'general', phone: '123', email: 'h@test.com', address: '123 St', city: 'NYC', state: 'NY', country: 'US' });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'h1');
      expect(result).toHaveProperty('hospitalType', 'general');
    });
  });

  describe('getHospital', () => {
    it('should get a hospital by id', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockHospitalRow] });
      const result = await vetHospitalService.getHospital('h1');
      expect(result).toHaveProperty('id', 'h1');
      expect(result).toHaveProperty('hospitalType');
    });

    it('should throw if hospital not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(vetHospitalService.getHospital('nonexistent')).rejects.toThrow();
    });
  });

  describe('listHospitals', () => {
    it('should list hospitals', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })        // COUNT
        .mockResolvedValueOnce({ rows: [mockHospitalRow] });       // SELECT
      const result = await vetHospitalService.listHospitals({});
      expect(result.hospitals).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateHospital', () => {
    it('should update a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ ...mockHospitalRow, name: 'Updated' }] });
      const result = await vetHospitalService.updateHospital('h1', { name: 'Updated' });
      expect(result).toHaveProperty('id', 'h1');
    });
  });

  describe('deleteHospital', () => {
    it('should soft delete a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await vetHospitalService.deleteHospital('h1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('is_active'), expect.any(Array));
    });
  });

  describe('verifyHospital', () => {
    it('should verify a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ ...mockHospitalRow, is_verified: true, verification_status: 'approved' }] });
      const result = await vetHospitalService.verifyHospital('h1', true);
      expect(result).toHaveProperty('isVerified', true);
    });
  });

  describe('addDoctor', () => {
    it('should add a doctor to a hospital', async () => {
      const doctorRow = { id: 'd1', hospital_id: 'h1', doctor_id: 'doc1', hospital_role: 'staff', is_active: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [doctorRow] });
      const result = await vetHospitalService.addDoctor('h1', { doctorId: 'doc1' });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('hospitalId', 'h1');
    });
  });

  describe('listDoctors', () => {
    it('should list doctors in a hospital', async () => {
      const doctorRow = { id: 'd1', hospital_id: 'h1', doctor_id: 'doc1', hospital_role: 'staff', is_active: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [doctorRow] });
      const result = await vetHospitalService.listDoctors('h1');
      expect(result).toHaveLength(1);
    });
  });

  describe('removeDoctor', () => {
    it('should soft remove a doctor', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await vetHospitalService.removeDoctor('h1', 'doc1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('createDepartment', () => {
    it('should create a department', async () => {
      const deptRow = { id: 'dep1', hospital_id: 'h1', name: 'Surgery', is_active: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [deptRow] });
      const result = await vetHospitalService.createDepartment('h1', { name: 'Surgery' });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('hospitalId', 'h1');
    });
  });

  describe('listDepartments', () => {
    it('should list departments', async () => {
      const deptRow = { id: 'dep1', hospital_id: 'h1', name: 'Surgery', is_active: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [deptRow] });
      const result = await vetHospitalService.listDepartments('h1');
      expect(result).toHaveLength(1);
    });
  });

  describe('addService', () => {
    it('should add a service', async () => {
      const svcRow = { id: 's1', hospital_id: 'h1', service_name: 'X-Ray', is_available: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [svcRow] });
      const result = await vetHospitalService.addService('h1', { serviceName: 'X-Ray', category: 'imaging' });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('serviceName', 'X-Ray');
    });
  });

  describe('listServices', () => {
    it('should list services', async () => {
      const svcRow = { id: 's1', hospital_id: 'h1', service_name: 'X-Ray', is_available: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [svcRow] });
      const result = await vetHospitalService.listServices('h1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getHospitalStats', () => {
    it('should return hospital statistics', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ hospital_role: 'doctor', count: '5' }] })  // doctors grouped
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })                            // departments
        .mockResolvedValueOnce({ rows: [{ category: 'surgery', count: '2' }] });      // services
      const result = await vetHospitalService.getHospitalStats('h1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalDoctors');
    });
  });

  describe('isAdminOrOwner', () => {
    it('should return true for hospital owner', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ hospital_role: 'owner' }] });
      const result = await vetHospitalService.isAdminOrOwner('h1', 'u1', 'veterinarian');
      expect(result).toBe(true);
    });
  });

  describe('inviteDoctor', () => {
    it('should create a doctor invite', async () => {
      const invite = { id: 'inv1', hospital_id: 'h1', email: 'doc@test.com' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })          // check existing invite
        .mockResolvedValueOnce({ rows: [] })          // check existing user
        .mockResolvedValueOnce({ rows: [invite] })    // INSERT invite
        .mockResolvedValueOnce({ rows: [mockHospitalRow] }); // getHospital for email
      const result = await vetHospitalService.inviteDoctor('h1', { email: 'doc@test.com' }, 'u1');
      expect(result).toBeDefined();
    });
  });

  describe('listInvites', () => {
    it('should list hospital invites', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'inv1' }] });
      const result = await vetHospitalService.listInvites('h1');
      expect(result).toHaveLength(1);
    });
  });
});
