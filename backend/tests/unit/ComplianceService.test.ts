import database from '../../src/utils/database';
import complianceService from '../../src/services/ComplianceService';

jest.mock('../../src/utils/database');

describe('ComplianceService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a compliance document', async () => {
      const doc = { id: 'c1', enterprise_id: 'e1', document_type: 'license', title: 'Farm License', status: 'pending' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [doc] });
      const result = await complianceService.create({ enterprise_id: 'e1', document_type: 'license', title: 'Farm License' });
      expect(result).toEqual(expect.objectContaining({ id: 'c1', documentType: 'license', title: 'Farm License', status: 'pending' }));
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO compliance_documents'), expect.any(Array));
    });
  });

  describe('verify', () => {
    it('should verify a compliance document', async () => {
      const verified = { id: 'c1', verified_at: '2024-06-01', verified_by: 'admin1' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [verified] });
      const result = await complianceService.verify('c1', 'admin1');
      expect(result).toEqual(expect.objectContaining({ id: 'c1', verifiedAt: '2024-06-01', verifiedBy: 'admin1' }));
    });
  });

  describe('list', () => {
    it('should list compliance documents for an enterprise', async () => {
      const docs = [{ id: 'c1' }, { id: 'c2' }];
      (database.query as jest.Mock).mockResolvedValue({ rows: docs });
      const result = await complianceService.list('e1');
      expect(result.items).toHaveLength(2);
    });

    it('should filter by documentType', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await complianceService.list('e1', { documentType: 'certificate' });
      expect(database.query).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await complianceService.list('e1', { status: 'verified' });
      expect(database.query).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return a compliance document by id', async () => {
      const doc = { id: 'c1', title: 'Farm License' };
      (database.query as jest.Mock).mockResolvedValue({ rows: [doc] });
      const result = await complianceService.getById('c1');
      expect(result).toEqual(expect.objectContaining({ id: 'c1', title: 'Farm License' }));
    });

    it('should return null if not found', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await complianceService.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should soft-delete a compliance document', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await complianceService.delete('c1');
      expect(database.query).toHaveBeenCalledWith(expect.stringContaining('is_active = false'), ['c1']);
    });
  });

  describe('getComplianceSummary', () => {
    it('should return compliance summary', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await complianceService.getComplianceSummary('e1');
      expect(result).toBeDefined();
    });
  });
});
