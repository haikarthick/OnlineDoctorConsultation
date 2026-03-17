import PermissionService from '../../src/services/PermissionService';
import database from '../../src/utils/database';

jest.mock('../../src/utils/database');

describe('PermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureTable', () => {
    it('should create table without error', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(PermissionService.ensureTable()).resolves.not.toThrow();
    });
  });

  describe('seedDefaults', () => {
    it('should seed default permissions', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(PermissionService.seedDefaults()).resolves.not.toThrow();
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return permissions for a role', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [
          { permission: 'consultations', is_enabled: true },
          { permission: 'animals', is_enabled: true },
          { permission: 'medical_records', is_enabled: false },
        ]
      });

      const result = await PermissionService.getPermissionsForRole('pet_owner');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getFullPermissionMatrix', () => {
    it('should return full permission matrix', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [
          { role: 'pet_owner', permission: 'consultations', is_enabled: true },
          { role: 'veterinarian', permission: 'consultations', is_enabled: true },
        ]
      });

      const result = await PermissionService.getFullPermissionMatrix();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('updatePermission', () => {
    it('should update a single permission', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        PermissionService.updatePermission('pet_owner', 'consultations', true, 'admin-1')
      ).resolves.not.toThrow();
    });
  });

  describe('bulkUpdatePermissions', () => {
    it('should bulk update permissions for a role', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        PermissionService.bulkUpdatePermissions('pet_owner', { consultations: true, animals: true }, 'admin-1')
      ).resolves.not.toThrow();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset permissions to defaults', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(PermissionService.resetToDefaults('pet_owner')).resolves.not.toThrow();
    });
  });

  describe('hasPermission', () => {
    it('should return true when permission is enabled', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [{ is_enabled: true }]
      });

      const result = await PermissionService.hasPermission('pet_owner', 'consultations');
      expect(result).toBe(true);
    });

    it('should return false when permission is disabled', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [{ is_enabled: false }]
      });

      const result = await PermissionService.hasPermission('pet_owner', 'admin_dashboard');
      expect(result).toBe(false);
    });
  });

  describe('getPermissionMetadata', () => {
    it('should return metadata synchronously', () => {
      const result = PermissionService.getPermissionMetadata();
      expect(result).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.allPermissions).toBeDefined();
      expect(result.roles).toBeDefined();
    });
  });
});
