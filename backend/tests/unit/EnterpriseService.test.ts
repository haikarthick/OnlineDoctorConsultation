import database from '../../src/utils/database';
import enterpriseService from '../../src/services/EnterpriseService';

jest.mock('../../src/utils/database');

describe('EnterpriseService', () => {
  beforeEach(() => { jest.clearAllMocks(); (database.query as jest.Mock).mockReset(); });

  const mockRow = {
    id: 'e1', name: 'Test Farm', enterprise_type: 'farm', address: '123 Farm Rd',
    city: 'Rural', state: 'TX', country: 'US', postal_code: '75001',
    gps_latitude: '32.7', gps_longitude: '-96.8', total_area: '100',
    area_unit: 'acres', owner_id: 'o1', is_active: true,
    created_at: '2024-01-01', updated_at: '2024-01-01'
  };

  describe('createEnterprise', () => {
    it('should create an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });
      const result = await enterpriseService.createEnterprise('o1', { name: 'Test Farm', enterpriseType: 'farm', address: '123 Farm Rd', city: 'Rural', state: 'TX', country: 'US' });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'e1');
      expect(result).toHaveProperty('enterpriseType', 'farm');
    });
  });

  describe('getEnterprise', () => {
    it('should get an enterprise', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [mockRow] });
      const result = await enterpriseService.getEnterprise('e1');
      expect(result).toHaveProperty('id', 'e1');
      expect(result).toHaveProperty('ownerId', 'o1');
    });
  });

  describe('listEnterprisesForUser', () => {
    it('should list enterprises for a user', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })     // COUNT first
        .mockResolvedValueOnce({ rows: [mockRow] });            // SELECT second
      const result = await enterpriseService.listEnterprisesForUser('o1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('listAllEnterprises', () => {
    it('should list all enterprises', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })     // COUNT first
        .mockResolvedValueOnce({ rows: [mockRow] });            // SELECT second
      const result = await enterpriseService.listAllEnterprises();
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateEnterprise', () => {
    it('should update an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'e1' }] })
        .mockResolvedValueOnce({ rows: [{ ...mockRow, name: 'Updated' }] });
      const result = await enterpriseService.updateEnterprise('e1', { name: 'Updated' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteEnterprise', () => {
    it('should soft delete', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await enterpriseService.deleteEnterprise('e1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('is_active'), expect.any(Array));
    });
  });

  describe('addMember', () => {
    it('should add a member to an enterprise', async () => {
      const memberRow = { id: 'm1', enterprise_id: 'e1', user_id: 'u1', role: 'manager', is_active: true };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'm1' }] })
        .mockResolvedValueOnce({ rows: [memberRow] });
      const result = await enterpriseService.addMember('e1', 'u1', 'manager');
      expect(result).toBeDefined();
    });
  });

  describe('removeMember', () => {
    it('should soft remove a member', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await enterpriseService.removeMember('e1', 'u1');
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('listMembers', () => {
    it('should list members', async () => {
      const memberRow = { id: 'm1', enterprise_id: 'e1', user_id: 'u1', role: 'manager', is_active: true };
      (database.query as jest.Mock).mockResolvedValue({ rows: [memberRow] });
      const result = await enterpriseService.listMembers('e1');
      expect(result).toHaveLength(1);
    });
  });

  describe('hasAccess', () => {
    it('should return true for members', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'm1' }] });
      const result = await enterpriseService.hasAccess('e1', 'u1');
      expect(result).toBe(true);
    });

    it('should return false for non-members', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await enterpriseService.hasAccess('e1', 'stranger');
      expect(result).toBe(false);
    });
  });

  describe('listEnterpriseAnimals', () => {
    it('should list animals for an enterprise', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'a1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const result = await enterpriseService.listEnterpriseAnimals('e1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getEnterpriseStats', () => {
    it('should return enterprise stats', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ total: '20', recent: '5', vaccinations: '15', overdue: '2', upcoming: '3' }] });
      const result = await enterpriseService.getEnterpriseStats('e1');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalAnimals');
    });
  });
});
