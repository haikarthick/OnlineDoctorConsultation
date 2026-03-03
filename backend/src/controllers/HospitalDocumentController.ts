/**
 * HospitalDocumentController
 *
 * Routes handled:
 *   POST   /vet-hospitals/:id/documents          — upload a document (vet owner)
 *   GET    /vet-hospitals/:id/documents          — list docs for a hospital
 *   PUT    /vet-hospitals/:id/documents/:docId/review  — admin review (approve/reject)
 *   GET    /vet-hospitals/admin/pending          — admin: list hospitals pending verification
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import HospitalDocumentService from '../services/HospitalDocumentService';
import { ForbiddenError, ValidationError } from '../utils/errors';
import type { DocType } from '../services/HospitalDocumentService';
import { REQUIRED_DOC_TYPES } from '../services/HospitalDocumentService';
import storage from '../utils/storage';

class HospitalDocumentController {

  // ── Upload document ──────────────────────────────────────
  async uploadDocument(req: AuthRequest, res: Response): Promise<void> {
    const { id: hospitalId } = req.params;
    const { docType, expiryDate } = req.body as { docType: DocType; expiryDate?: string };

    if (!docType || !REQUIRED_DOC_TYPES.includes(docType)) {
      throw new ValidationError(
        `docType must be one of: ${REQUIRED_DOC_TYPES.join(', ')}`
      );
    }

    let fileUrl: string;
    let fileName: string;

    // multer .any() populates req.files (array), not req.file
    const uploadedFile = req.file || (req.files as Express.Multer.File[] | undefined)?.[0];

    if (uploadedFile) {
      // Actual file upload via multipart/form-data
      const stored = await storage.save(uploadedFile, `hospital-docs/${hospitalId}`);
      fileUrl = stored.url;
      fileName = uploadedFile.originalname;
    } else if (req.body.fileUrl) {
      // Allow passing a pre-uploaded URL (e.g. from /api/files/upload)
      fileUrl = req.body.fileUrl;
      fileName = req.body.fileName || 'document';
    } else {
      throw new ValidationError('Provide a file (multipart) or a fileUrl in the body');
    }

    const doc = await HospitalDocumentService.uploadDocument(
      hospitalId,
      req.userId!,
      { docType, fileName, fileUrl, expiryDate: expiryDate || null },
    );
    res.status(201).json({ success: true, data: doc });
  }

  // ── List documents for a hospital ───────────────────────
  async listDocuments(req: AuthRequest, res: Response): Promise<void> {
    const { id: hospitalId } = req.params;
    const docs = await HospitalDocumentService.getDocuments(hospitalId);
    res.json({ success: true, data: docs });
  }

  // ── Admin: review a document ─────────────────────────────
  async reviewDocument(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin') throw new ForbiddenError('Admin only');
    const { docId } = req.params;
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      throw new ValidationError('status must be "approved" or "rejected"');
    }
    const doc = await HospitalDocumentService.reviewDocument(docId, req.userId!, {
      status, rejectionReason,
    });
    res.json({ success: true, data: doc });
  }

  // ── Admin: list hospitals pending verification ───────────
  async listPendingVerification(req: AuthRequest, res: Response): Promise<void> {
    if (req.userRole !== 'admin') throw new ForbiddenError('Admin only');
    const { status, limit, offset } = req.query as any;
    const result = await HospitalDocumentService.listPendingVerification({
      status, limit: parseInt(limit) || 20, offset: parseInt(offset) || 0,
    });
    res.json({ success: true, data: result });
  }
}

export default new HospitalDocumentController();
