import HospitalDocumentService from '../../src/services/HospitalDocumentService';
import database from '../../src/utils/database';
import { NotFoundError, ForbiddenError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/NotificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

// snake_case mock doc matching DB column names (for _mapRow)
const mockDoc = {
  id: 'doc-1',
  hospital_id: 'hosp-1',
  doc_type: 'vet_council',
  file_name: 'vet_council_cert.pdf',
  file_url: '/uploads/vet_council_cert.pdf',
  expiry_date: '2099-12-31',
  status: 'pending',
  uploaded_by: 'owner-1',
  reviewed_by: null,
  rejection_reason: null,
  reviewed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('HospitalDocumentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (database.query as jest.Mock).mockReset();
  });

  describe('ensureTables', () => {
    it('should create tables without error', async () => {
      (database.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(HospitalDocumentService.ensureTables()).resolves.not.toThrow();
    });
  });

  describe('uploadDocument', () => {
    it('should upload a new document', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ owner_id: 'owner-1' }] })  // assertOwnerOrAdmin
        .mockResolvedValueOnce({ rows: [mockDoc] })                    // INSERT/UPSERT
        .mockResolvedValueOnce({ rows: [] })                           // UPDATE vet_hospitals (vet_council expiry sync)
        .mockResolvedValueOnce({ rows: [] });                          // _advanceStatusIfReady

      const result = await HospitalDocumentService.uploadDocument('hosp-1', 'owner-1', {
        docType: 'vet_council',
        fileUrl: '/uploads/vet_council_cert.pdf',
        fileName: 'vet_council_cert.pdf',
        expiryDate: '2099-12-31',
      } as any);

      expect(result).toBeDefined();
      expect(result.hospitalId).toBe('hosp-1');
    });

    it('should throw ForbiddenError for non-owner', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ owner_id: 'owner-1' }] });

      await expect(
        HospitalDocumentService.uploadDocument('hosp-1', 'random-user', {
          docType: 'vet_council',
          fileUrl: '/uploads/cert.pdf',
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('getDocuments', () => {
    it('should return documents for a hospital', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDoc] });

      const result = await HospitalDocumentService.getDocuments('hosp-1');
      expect(result).toHaveLength(1);
      expect(result[0].hospitalId).toBe('hosp-1');
    });

    it('should return empty array if no documents', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await HospitalDocumentService.getDocuments('hosp-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('reviewDocument', () => {
    it('should approve a document', async () => {
      const approved = { ...mockDoc, status: 'approved', reviewed_by: 'admin-1' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDoc] })           // get doc
        .mockResolvedValueOnce({ rows: [approved] })          // update doc
        .mockResolvedValueOnce({ rows: [] });                  // _checkAndActivate

      const result = await HospitalDocumentService.reviewDocument('doc-1', 'admin-1', {
        status: 'approved',
      } as any);

      expect(result).toBeDefined();
    });

    it('should reject a document with reason', async () => {
      const rejected = { ...mockDoc, status: 'rejected', rejection_reason: 'Expired certificate' };
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockDoc] })           // get doc
        .mockResolvedValueOnce({ rows: [rejected] })          // update doc
        .mockResolvedValueOnce({ rows: [] })                   // UPDATE vet_hospitals (rejection)
        .mockResolvedValueOnce({ rows: [{ owner_id: 'owner-1', name: 'Test Hospital' }] }); // SELECT hospital for notification

      const result = await HospitalDocumentService.reviewDocument('doc-1', 'admin-1', {
        status: 'rejected',
        rejectionReason: 'Expired certificate',
      } as any);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundError for non-existent document', async () => {
      (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        HospitalDocumentService.reviewDocument('non-existent', 'admin-1', { status: 'approved' } as any)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listPendingVerification', () => {
    it('should return hospitals with pending documents', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ hospital_id: 'hosp-1', hospital_name: 'Test Hospital' }] });

      const result = await HospitalDocumentService.listPendingVerification({});
      expect(result).toBeDefined();
    });
  });

  describe('runExpiryCheck', () => {
    it('should run expiry check without error', async () => {
      (database.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })   // find expired docs
        .mockResolvedValueOnce({ rows: [] });  // update expired

      await expect(HospitalDocumentService.runExpiryCheck()).resolves.not.toThrow();
    });
  });
});
