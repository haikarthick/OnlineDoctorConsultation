import AuditService from '../../src/services/AuditService';
import database from '../../src/utils/database';

jest.mock('../../src/utils/database');
jest.mock('../../src/config/featureFlags', () => ({
  isFeatureEnabled: jest.fn().mockReturnValue(true),
}));

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log an audit entry when feature enabled', async () => {
      const { isFeatureEnabled } = require('../../src/config/featureFlags');
      isFeatureEnabled.mockReturnValue(true);
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        AuditService.log('user-1', 'create', 'animal', 'animal-1', undefined, { name: 'Rex' })
      ).resolves.not.toThrow();

      expect(database.query).toHaveBeenCalled();
    });

    it('should skip logging when feature disabled', async () => {
      const { isFeatureEnabled } = require('../../src/config/featureFlags');
      isFeatureEnabled.mockReturnValue(false);

      await AuditService.log('user-1', 'create', 'animal', 'animal-1');

      expect(database.query).not.toHaveBeenCalled();
    });

    it('should not throw on database error', async () => {
      const { isFeatureEnabled } = require('../../src/config/featureFlags');
      isFeatureEnabled.mockReturnValue(true);
      (database.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        AuditService.log('user-1', 'create', 'animal', 'animal-1')
      ).resolves.not.toThrow();
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs', async () => {
      (database.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'audit-1', action: 'create', entity_type: 'animal' }]
      });

      const result = await AuditService.getAuditLogs();
      expect(result).toHaveLength(1);
    });

    it('should filter by entity type', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });

      await AuditService.getAuditLogs(10, 0, 'animal');
      expect(database.query).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      (database.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await AuditService.getAuditLogs();
      expect(result).toEqual([]);
    });
  });

  describe('getComplianceDashboard', () => {
    it('should return compliance dashboard data', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ action: 'create', count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ entity_type: 'animal', count: '30' }] });

      const result = await AuditService.getComplianceDashboard();
      expect(result).toBeDefined();
    });
  });
});
