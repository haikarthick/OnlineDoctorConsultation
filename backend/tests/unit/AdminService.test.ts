import database from '../../src/utils/database';
import adminService from '../../src/services/AdminService';

jest.mock('../../src/utils/database');

describe('AdminService', () => {
  beforeEach(() => { jest.clearAllMocks(); (database.query as jest.Mock).mockReset(); });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'pet_owner', count: '60' }, { role: 'veterinarian', count: '20' }] }) // users GROUP BY role
        .mockResolvedValueOnce({ rows: [{ status: 'completed', count: '35' }, { status: 'cancelled', count: '5' }] }) // consultations GROUP BY status
        .mockResolvedValueOnce({ rows: [{ status: 'completed', total: '500', count: '30' }] })                       // payments GROUP BY status
        .mockResolvedValueOnce({ rows: [{ count: '30', avgRating: '4.2' }] })                                        // reviews
        .mockResolvedValueOnce({ rows: [{ count: '80' }] })                                                          // bookings
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })                                                           // active video sessions
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })                                                           // pending network approvals
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });                                                          // pending user approvals
      const result = await adminService.getDashboardStats();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalUsers', 80);
      expect(result.pendingActions).toBe(7);
    });
  });

  describe('listAllUsers', () => {
    it('should list all users with pagination', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })                       // COUNT first
        .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'test@test.com' }] }); // SELECT second
      const result = await adminService.listAllUsers({ limit: 20, offset: 0 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by role', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      await adminService.listAllUsers({ role: 'admin' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('toggleUserStatus', () => {
    it('should toggle user active status', async () => {
      const user = { id: 'u1', is_active: false };
      (database.query as jest.Mock).mockResolvedValue({ rows: [user] });
      const result = await adminService.toggleUserStatus('u1', false);
      expect(result).toEqual(user);
    });
  });

  describe('changeUserRole', () => {
    it('should change user role', async () => {
      const user = { id: 'u1', role: 'veterinarian' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [user] });
      const result = await adminService.changeUserRole('u1', 'veterinarian');
      expect(result).toEqual(user);
    });
  });

  describe('listAllConsultations', () => {
    it('should list all consultations', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })    // COUNT first
        .mockResolvedValueOnce({ rows: [{ id: 'c1' }] });      // SELECT second
      const result = await adminService.listAllConsultations({ limit: 20, offset: 0 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('listAllPayments', () => {
    it('should list all payments', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await adminService.listAllPayments({ limit: 20, offset: 0 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('listAllReviews', () => {
    it('should list all reviews', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await adminService.listAllReviews({ limit: 20, offset: 0 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('moderateReview', () => {
    it('should moderate a review', async () => {
      const review = { id: 'r1', moderation_status: 'approved' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [review] });
      const result = await adminService.moderateReview('r1', 'approve');
      expect(result).toEqual(review);
    });
  });

  describe('processRefund', () => {
    it('should process a refund', async () => {
      const payment = { id: 'p1', status: 'refunded' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [payment] });
      const result = await adminService.processRefund('p1', 50, 'Customer request');
      expect(result).toEqual(payment);
    });
  });

  describe('getSystemSettings', () => {
    it('should return system settings', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ key: 'site_name', value: 'VetCare' }] });
      const result = await adminService.getSystemSettings();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateSystemSetting', () => {
    it('should update a setting', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ key: 'site_name', value: 'VetCare Pro' }] });
      const result = await adminService.updateSystemSetting('site_name', 'VetCare Pro', 'admin1');
      expect(result).toBeDefined();
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'al1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await adminService.getAuditLogs({ limit: 20, offset: 0 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('createAuditLog', () => {
    it('should create an audit log', async () => {
      const log = { id: 'al1', user_id: 'u1', action: 'login' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [log] });
      const result = await adminService.createAuditLog({ userId: 'u1', action: 'login', resource: 'auth' });
      expect(result).toEqual(log);
    });
  });
});
