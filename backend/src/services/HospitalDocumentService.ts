/**
 * HospitalDocumentService
 *
 * Manages KYC / compliance document uploads for vet hospitals.
 * Workflow:
 *   1. Hospital owner uploads docs (PAN, GST, Aadhaar, Bank, Vet Council, Trade Licence, Drug Licence)
 *   2. Once all 7 required doc types are uploaded → hospital status → under_review
 *   3. Admin reviews each doc individually (approve / reject)
 *   4. When all 7 types are approved → hospital activated (verification_status = approved, is_verified = true)
 *   5. Nightly job checks expiry dates:
 *      - 30 days before expiry → in-app notification to owner
 *      - 0 days (expired)     → hospital auto-suspended
 */

import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';
import NotificationService from './NotificationService';

// ─── Constants ───────────────────────────────────────────────

export const REQUIRED_DOC_TYPES = [
  'pan', 'gst', 'aadhaar', 'bank_account', 'vet_council', 'trade_license', 'drug_license',
] as const;

export type DocType = typeof REQUIRED_DOC_TYPES[number];

export const EXPIRY_DOC_TYPES: DocType[] = ['vet_council', 'trade_license', 'drug_license'];

export const DOC_LABELS: Record<DocType, string> = {
  pan:           'PAN Card',
  gst:           'GST Certificate',
  aadhaar:       'Aadhaar Card (Owner)',
  bank_account:  'Bank Account Proof / Cancelled Cheque',
  vet_council:   'Veterinary Council Registration',
  trade_license: 'Trade License',
  drug_license:  'Drug License',
};

export type DocStatus = 'pending_review' | 'approved' | 'rejected';

export type VerificationStatus =
  | 'pending_documents'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

// ─── Interfaces ──────────────────────────────────────────────

export interface HospitalDocument {
  id: string;
  hospitalId: string;
  docType: DocType;
  fileName: string;
  fileUrl: string;
  expiryDate?: string | null;
  status: DocStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadDocumentDTO {
  docType: DocType;
  fileName: string;
  fileUrl: string;
  expiryDate?: string | null;
}

export interface ReviewDocumentDTO {
  status: 'approved' | 'rejected';
  rejectionReason?: string;
}

// ─── Service ─────────────────────────────────────────────────

export class HospitalDocumentService {

  // ─── Schema setup (called from VetHospitalService.ensureTables) ──────

  async ensureTables(): Promise<void> {
    try {
      // Add new columns to vet_hospitals if they don't exist yet
      await database.query(`
        ALTER TABLE vet_hospitals
          ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'pending_documents'
            CHECK (verification_status IN (
              'pending_documents','under_review','approved','rejected','suspended'
            )),
          ADD COLUMN IF NOT EXISTS drug_license_expiry DATE,
          ADD COLUMN IF NOT EXISTS trade_license_expiry DATE,
          ADD COLUMN IF NOT EXISTS registration_renewal_date DATE;
      `);

      // Add tagline column if it doesn't exist
      await database.query(`
        ALTER TABLE vet_hospitals
          ADD COLUMN IF NOT EXISTS tagline VARCHAR(500);
      `);

      // hospital_documents table
      await database.query(`
        CREATE TABLE IF NOT EXISTS hospital_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hospital_id UUID NOT NULL REFERENCES vet_hospitals(id) ON DELETE CASCADE,
          doc_type VARCHAR(30) NOT NULL
            CHECK (doc_type IN (
              'pan','gst','aadhaar','bank_account',
              'vet_council','trade_license','drug_license'
            )),
          file_name VARCHAR(500) NOT NULL,
          file_url TEXT NOT NULL,
          expiry_date DATE,
          status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
            CHECK (status IN ('pending_review','approved','rejected')),
          rejection_reason TEXT,
          reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (hospital_id, doc_type)
        );

        CREATE INDEX IF NOT EXISTS idx_hospital_docs_hospital ON hospital_documents(hospital_id);
        CREATE INDEX IF NOT EXISTS idx_hospital_docs_status ON hospital_documents(status);
        CREATE INDEX IF NOT EXISTS idx_hospital_docs_expiry ON hospital_documents(expiry_date)
          WHERE expiry_date IS NOT NULL;
      `);

      logger.info('HospitalDocument tables/columns ensured');
    } catch (error: any) {
      logger.error('Failed to ensure HospitalDocument tables', { error: error.message });
      throw error;
    }
  }

  // ─── Upload / Re-upload a document ───────────────────────────

  async uploadDocument(
    hospitalId: string,
    ownerId: string,
    dto: UploadDocumentDTO,
  ): Promise<HospitalDocument> {
    // Verify caller owns or manages the hospital
    await this._assertOwnerOrAdmin(hospitalId, ownerId, 'veterinarian');

    const { docType, fileName, fileUrl, expiryDate } = dto;

    // Upsert — if the doc type was rejected, the owner can re-upload
    const result = await database.query(
      `INSERT INTO hospital_documents
         (id, hospital_id, doc_type, file_name, file_url, expiry_date, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', NOW())
       ON CONFLICT (hospital_id, doc_type)
       DO UPDATE SET
         file_name       = EXCLUDED.file_name,
         file_url        = EXCLUDED.file_url,
         expiry_date     = EXCLUDED.expiry_date,
         status          = 'pending_review',
         rejection_reason = NULL,
         reviewed_by     = NULL,
         reviewed_at     = NULL,
         updated_at      = NOW()
       RETURNING *`,
      [uuidv4(), hospitalId, docType, fileName, fileUrl, expiryDate || null],
    );

    // Sync expiry date shortcuts on vet_hospitals row
    if (docType === 'drug_license' && expiryDate) {
      await database.query(
        `UPDATE vet_hospitals SET drug_license_expiry = $1, updated_at = NOW() WHERE id = $2`,
        [expiryDate, hospitalId],
      );
    }
    if (docType === 'trade_license' && expiryDate) {
      await database.query(
        `UPDATE vet_hospitals SET trade_license_expiry = $1, updated_at = NOW() WHERE id = $2`,
        [expiryDate, hospitalId],
      );
    }
    if (docType === 'vet_council' && expiryDate) {
      await database.query(
        `UPDATE vet_hospitals SET registration_renewal_date = $1, updated_at = NOW() WHERE id = $2`,
        [expiryDate, hospitalId],
      );
    }

    // Advance hospital status if all required docs are now uploaded
    await this._advanceStatusIfReady(hospitalId);

    logger.info(`Hospital doc uploaded: ${docType}`, { hospitalId });
    return this._mapRow(result.rows[0]);
  }

  // ─── Get all documents for a hospital ────────────────────────

  async getDocuments(hospitalId: string): Promise<HospitalDocument[]> {
    const result = await database.query(
      `SELECT d.*,
              u.first_name || ' ' || u.last_name AS reviewer_name
       FROM hospital_documents d
       LEFT JOIN users u ON d.reviewed_by = u.id
       WHERE d.hospital_id = $1
       ORDER BY
         CASE d.doc_type
           WHEN 'pan' THEN 1 WHEN 'gst' THEN 2 WHEN 'aadhaar' THEN 3
           WHEN 'bank_account' THEN 4 WHEN 'vet_council' THEN 5
           WHEN 'trade_license' THEN 6 WHEN 'drug_license' THEN 7
           ELSE 8
         END`,
      [hospitalId],
    );
    return result.rows.map(this._mapRow);
  }

  // ─── Admin: review a document ─────────────────────────────

  async reviewDocument(
    docId: string,
    adminId: string,
    dto: ReviewDocumentDTO,
  ): Promise<HospitalDocument> {
    const existing = await database.query(
      `SELECT * FROM hospital_documents WHERE id = $1`, [docId],
    );
    if (!existing.rows[0]) throw new NotFoundError('Document not found');

    const result = await database.query(
      `UPDATE hospital_documents
       SET status           = $1,
           rejection_reason = $2,
           reviewed_by      = $3,
           reviewed_at      = NOW(),
           updated_at       = NOW()
       WHERE id = $4
       RETURNING *`,
      [dto.status, dto.rejectionReason || null, adminId, docId],
    );

    const doc = this._mapRow(result.rows[0]);
    const hospitalId = doc.hospitalId;

    if (dto.status === 'approved') {
      // Check if all required docs are now approved → activate hospital
      await this._checkAndActivate(hospitalId);
    } else {
      // Rejected — push hospital back to under_review so owner sees rejection
      await database.query(
        `UPDATE vet_hospitals
         SET verification_status = 'rejected', is_verified = false, updated_at = NOW()
         WHERE id = $1`,
        [hospitalId],
      );
      // Notify hospital owner
      const hospital = await database.query(
        `SELECT owner_id, name FROM vet_hospitals WHERE id = $1`, [hospitalId],
      );
      if (hospital.rows[0]) {
        await NotificationService.createNotification(
          hospital.rows[0].owner_id,
          'hospital_doc_rejected',
          `Document Rejected — ${DOC_LABELS[doc.docType as DocType] || doc.docType}`,
          `Your ${DOC_LABELS[doc.docType as DocType] || doc.docType} for ${hospital.rows[0].name} was rejected.` +
          (dto.rejectionReason ? ` Reason: ${dto.rejectionReason}` : ' Please re-upload a valid document.'),
          'all',
          { hospitalId, docType: doc.docType, rejectionReason: dto.rejectionReason },
        ).catch(() => {});
      }
    }

    return doc;
  }

  // ─── Admin: list hospitals pending document review ────────

  async listPendingVerification(params: {
    status?: VerificationStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ hospitals: any[]; total: number }> {
    const limit = Math.min(params.limit || 20, 100);
    const offset = params.offset || 0;
    const status = params.status || 'under_review';

    const countRes = await database.query(
      `SELECT COUNT(*) FROM vet_hospitals WHERE verification_status = $1`, [status],
    );
    const rows = await database.query(
      `SELECT h.*,
              u.first_name || ' ' || u.last_name AS owner_name,
              u.email AS owner_email,
              (SELECT COUNT(*) FROM hospital_documents
               WHERE hospital_id = h.id AND status = 'approved') AS approved_docs,
              (SELECT COUNT(*) FROM hospital_documents
               WHERE hospital_id = h.id AND status = 'pending_review') AS pending_docs,
              (SELECT COUNT(*) FROM hospital_documents
               WHERE hospital_id = h.id AND status = 'rejected') AS rejected_docs
       FROM vet_hospitals h
       JOIN users u ON h.owner_id = u.id
       WHERE h.verification_status = $1
       ORDER BY h.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset],
    );

    return {
      hospitals: rows.rows,
      total: parseInt(countRes.rows[0].count),
    };
  }

  // ─── Nightly expiry check (called by scheduler) ───────────

  async runExpiryCheck(): Promise<void> {
    logger.info('Running hospital document expiry check...');
    const today = new Date();

    try {
      // 1. Find docs expiring in exactly 30 days
      const expiring30 = await database.query(`
        SELECT d.*, h.owner_id, h.name AS hospital_name
        FROM hospital_documents d
        JOIN vet_hospitals h ON h.id = d.hospital_id
        WHERE d.expiry_date IS NOT NULL
          AND d.expiry_date = CURRENT_DATE + INTERVAL '30 days'
          AND d.status = 'approved'
          AND h.verification_status = 'approved'
      `);

      for (const row of expiring30.rows) {
        const label = DOC_LABELS[row.doc_type as DocType] || row.doc_type;
        await NotificationService.createNotification(
          row.owner_id,
          'hospital_doc_expiry_warning',
          `Document Expiring Soon — ${label}`,
          `Your ${label} for ${row.hospital_name} will expire on ${row.expiry_date}. Please renew it before it lapses to avoid suspension.`,
          'all',
          { hospitalId: row.hospital_id, docType: row.doc_type, expiryDate: row.expiry_date },
        ).catch(() => {});
        logger.info(`Expiry warning sent: ${row.doc_type}`, { hospitalId: row.hospital_id });
      }

      // 2. Find approved hospitals with any expired required doc
      const expiredHospitals = await database.query(`
        SELECT DISTINCT h.id, h.owner_id, h.name,
               d.doc_type, d.expiry_date
        FROM hospital_documents d
        JOIN vet_hospitals h ON h.id = d.hospital_id
        WHERE d.expiry_date IS NOT NULL
          AND d.expiry_date < CURRENT_DATE
          AND d.status = 'approved'
          AND h.verification_status = 'approved'
          AND h.is_active = true
      `);

      for (const row of expiredHospitals.rows) {
        // Suspend the hospital
        await database.query(
          `UPDATE vet_hospitals
           SET verification_status = 'suspended', is_verified = false, updated_at = NOW()
           WHERE id = $1`,
          [row.id],
        );
        const label = DOC_LABELS[row.doc_type as DocType] || row.doc_type;
        // Notify owner
        await NotificationService.createNotification(
          row.owner_id,
          'hospital_auto_suspended',
          `Hospital Suspended — Expired Document`,
          `Your hospital "${row.name}" has been suspended because the ${label} expired on ${row.expiry_date}. Please upload a renewed document and contact support for re-activation.`,
          'all',
          { hospitalId: row.id, docType: row.doc_type, expiryDate: row.expiry_date },
        ).catch(() => {});
        logger.warn(`Hospital auto-suspended (expired doc): ${row.name}`, {
          hospitalId: row.id, docType: row.doc_type,
        });
      }

      logger.info('Expiry check complete', {
        warningsSent: expiring30.rows.length,
        hospitalsSuspended: new Set(expiredHospitals.rows.map((r: any) => r.id)).size,
      });
    } catch (error: any) {
      logger.error('Expiry check failed', { error: error.message });
    }
  }

  // ─── Internal helpers ─────────────────────────────────────

  /** When all 7 doc types are uploaded (any status), move hospital → under_review */
  private async _advanceStatusIfReady(hospitalId: string): Promise<void> {
    const hospital = await database.query(
      `SELECT verification_status FROM vet_hospitals WHERE id = $1`, [hospitalId],
    );
    if (!hospital.rows[0]) return;
    const currentStatus = hospital.rows[0].verification_status;
    if (currentStatus !== 'pending_documents') return; // already advanced

    const uploaded = await database.query(
      `SELECT doc_type FROM hospital_documents WHERE hospital_id = $1`, [hospitalId],
    );
    const uploadedTypes = new Set(uploaded.rows.map((r: any) => r.doc_type));
    const allUploaded = REQUIRED_DOC_TYPES.every(t => uploadedTypes.has(t));

    if (allUploaded) {
      await database.query(
        `UPDATE vet_hospitals
         SET verification_status = 'under_review', updated_at = NOW()
         WHERE id = $1`,
        [hospitalId],
      );
      // Notify owner
      const h = await database.query(
        `SELECT owner_id, name FROM vet_hospitals WHERE id = $1`, [hospitalId],
      );
      if (h.rows[0]) {
        await NotificationService.createNotification(
          h.rows[0].owner_id,
          'hospital_under_review',
          'Documents Submitted — Under Review',
          `All required documents for "${h.rows[0].name}" have been submitted. Our team will review them within 2-3 business days. Your hospital account will be activated once approved.`,
          'all',
          { hospitalId },
        ).catch(() => {});
      }
      logger.info(`Hospital moved to under_review`, { hospitalId });
    }
  }

  /** When all 7 required doc types are approved → activate hospital */
  private async _checkAndActivate(hospitalId: string): Promise<void> {
    const approved = await database.query(
      `SELECT doc_type FROM hospital_documents
       WHERE hospital_id = $1 AND status = 'approved'`,
      [hospitalId],
    );
    const approvedTypes = new Set(approved.rows.map((r: any) => r.doc_type));
    const allApproved = REQUIRED_DOC_TYPES.every(t => approvedTypes.has(t));

    if (allApproved) {
      await database.query(
        `UPDATE vet_hospitals
         SET verification_status = 'approved', is_verified = true, updated_at = NOW()
         WHERE id = $1`,
        [hospitalId],
      );
      const h = await database.query(
        `SELECT owner_id, name FROM vet_hospitals WHERE id = $1`, [hospitalId],
      );
      if (h.rows[0]) {
        await NotificationService.createNotification(
          h.rows[0].owner_id,
          'hospital_approved',
          'Hospital Account Approved! 🎉',
          `Congratulations! Your hospital "${h.rows[0].name}" has been verified and is now live on VetCare. Patients can now discover and book appointments.`,
          'all',
          { hospitalId },
        ).catch(() => {});
      }
      logger.info(`Hospital activated after all docs approved`, { hospitalId });
    }
  }

  private async _assertOwnerOrAdmin(
    hospitalId: string,
    userId: string,
    _userRole: string,
  ): Promise<void> {
    const res = await database.query(
      `SELECT owner_id FROM vet_hospitals WHERE id = $1`, [hospitalId],
    );
    if (!res.rows[0]) throw new NotFoundError('Hospital not found');
    if (res.rows[0].owner_id !== userId) {
      throw new ForbiddenError('Only the hospital owner can upload documents');
    }
  }

  private _mapRow(row: any): HospitalDocument {
    return {
      id: row.id,
      hospitalId: row.hospital_id,
      docType: row.doc_type,
      fileName: row.file_name,
      fileUrl: row.file_url,
      expiryDate: row.expiry_date,
      status: row.status,
      rejectionReason: row.rejection_reason,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.reviewer_name ? { reviewerName: row.reviewer_name } : {}),
    };
  }
}

export default new HospitalDocumentService();
