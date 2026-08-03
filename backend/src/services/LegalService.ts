import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import logger from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Versioned legal documents + provable user consent
 * (docs/PAYMENT_MODULE_PLAN.md §17).
 *
 * Published document versions are immutable - editing always creates a new
 * version row. The user_policy_acceptances table is append-only: the server-
 * side row (version, timestamp, IP, user-agent) is the legal proof, not the UI
 * checkbox.
 */

export const LEGAL_DOC_TYPES = [
  'terms', 'privacy', 'refund_policy', 'wallet_terms',
  'doctor_agreement', 'grievance_policy', 'disclaimer',
] as const;
export type LegalDocType = typeof LEGAL_DOC_TYPES[number];

/** Which personas each document applies to (§17.1). Empty = all roles. */
const DOC_ROLE_MAP: Record<LegalDocType, string[]> = {
  terms: [],
  privacy: [],
  grievance_policy: [],
  refund_policy: ['pet_owner', 'farmer'],
  wallet_terms: ['pet_owner', 'farmer'],
  disclaimer: ['pet_owner', 'farmer'],
  doctor_agreement: ['veterinarian'],
};

export function docTypesForRole(role: string): LegalDocType[] {
  return LEGAL_DOC_TYPES.filter((t) => {
    const roles = DOC_ROLE_MAP[t];
    return roles.length === 0 || roles.includes(role);
  });
}

/** Documents that must be explicitly ticked at registration per role. */
export function registrationDocTypesForRole(role: string): LegalDocType[] {
  const base: LegalDocType[] = ['terms', 'privacy'];
  if (role === 'veterinarian') base.push('doctor_agreement');
  return base;
}

class LegalService {
  async getActiveDocument(docType: string): Promise<any> {
    const res = await database.query(
      `SELECT id, doc_type as "docType", version, title, content,
              effective_from as "effectiveFrom", requires_reacceptance as "requiresReacceptance",
              created_at as "createdAt"
       FROM legal_documents WHERE doc_type = $1 AND is_active = true
       ORDER BY version DESC LIMIT 1`,
      [docType]
    );
    if (res.rows.length === 0) throw new NotFoundError('Legal document', docType);
    return res.rows[0];
  }

  async listActiveDocuments(): Promise<any[]> {
    const res = await database.query(
      `SELECT DISTINCT ON (doc_type)
              id, doc_type as "docType", version, title,
              effective_from as "effectiveFrom", requires_reacceptance as "requiresReacceptance"
       FROM legal_documents WHERE is_active = true
       ORDER BY doc_type, version DESC`
    );
    return res.rows;
  }

  /**
   * Record acceptance of the ACTIVE version of each given doc type.
   * user_email is snapshotted so the proof survives account deletion.
   */
  async recordAcceptances(params: {
    userId: string | null;
    userEmail: string;
    docTypes: string[];
    context: 'registration' | 'invite' | 'login_reacceptance' | 'payout_setup';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const uniqueTypes = [...new Set(params.docTypes)].filter((t) =>
      (LEGAL_DOC_TYPES as readonly string[]).includes(t)
    );
    for (const docType of uniqueTypes) {
      let version = 1;
      try {
        const active = await this.getActiveDocument(docType);
        version = active.version;
      } catch { /* no published doc yet - record acceptance of version 1 placeholder */ }
      await database.query(
        `INSERT INTO user_policy_acceptances
           (id, user_id, user_email, doc_type, version, context, ip_address, user_agent, accepted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [uuidv4(), params.userId, params.userEmail, docType, version, params.context,
         params.ipAddress || null, (params.userAgent || '').substring(0, 1000) || null]
      );
    }
    logger.info('Policy acceptances recorded', {
      userId: params.userId, docTypes: uniqueTypes, context: params.context,
    });
  }

  /**
   * Pending re-acceptances for a user (§17.3): active docs flagged
   * requires_reacceptance whose active version the user hasn't accepted yet.
   */
  async getPendingReacceptances(userId: string, role: string): Promise<any[]> {
    const applicable = docTypesForRole(role);
    if (applicable.length === 0) return [];
    const res = await database.query(
      `SELECT d.doc_type as "docType", d.version, d.title
       FROM legal_documents d
       WHERE d.is_active = true
         AND d.requires_reacceptance = true
         AND d.doc_type = ANY($2)
         AND d.version = (SELECT MAX(version) FROM legal_documents x WHERE x.doc_type = d.doc_type AND x.is_active = true)
         AND NOT EXISTS (
           SELECT 1 FROM user_policy_acceptances a
           WHERE a.user_id = $1 AND a.doc_type = d.doc_type AND a.version >= d.version
         )`,
      [userId, applicable]
    );
    return res.rows;
  }

  // ── Admin: Legal & Policies manager ────────────────────────

  async listAllDocuments(): Promise<any[]> {
    const res = await database.query(
      `SELECT id, doc_type as "docType", version, title,
              effective_from as "effectiveFrom", requires_reacceptance as "requiresReacceptance",
              is_active as "isActive", created_by as "createdBy", created_at as "createdAt",
              LENGTH(content) as "contentLength"
       FROM legal_documents ORDER BY doc_type, version DESC`
    );
    return res.rows;
  }

  /** Publishing = insert a new immutable version; previous versions stay for audit. */
  async publishNewVersion(params: {
    docType: string; title: string; content: string;
    requiresReacceptance: boolean; createdBy: string;
  }): Promise<any> {
    if (!(LEGAL_DOC_TYPES as readonly string[]).includes(params.docType)) {
      throw new ValidationError(`Unknown legal document type '${params.docType}'`);
    }
    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(version), 0) as max FROM legal_documents WHERE doc_type = $1`,
        [params.docType]
      );
      const newVersion = parseInt(maxRes.rows[0].max, 10) + 1;
      const res = await client.query(
        `INSERT INTO legal_documents
           (id, doc_type, version, title, content, effective_from, requires_reacceptance, is_active, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, true, $7, NOW())
         RETURNING id, doc_type as "docType", version, title,
                   requires_reacceptance as "requiresReacceptance", created_at as "createdAt"`,
        [uuidv4(), params.docType, newVersion, params.title, params.content,
         params.requiresReacceptance, params.createdBy]
      );
      await client.query('COMMIT');
      logger.info('Legal document version published', {
        docType: params.docType, version: newVersion, requiresReacceptance: params.requiresReacceptance,
      });
      return res.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Acceptance coverage per active document (admin report §17.3). */
  async getAcceptanceStats(): Promise<any[]> {
    const res = await database.query(
      `SELECT d.doc_type as "docType", d.version, d.title,
              d.requires_reacceptance as "requiresReacceptance",
              (SELECT COUNT(DISTINCT a.user_id) FROM user_policy_acceptances a
                WHERE a.doc_type = d.doc_type AND a.version >= d.version) as "acceptedUsers",
              (SELECT COUNT(*) FROM user_policy_acceptances a
                WHERE a.doc_type = d.doc_type) as "totalAcceptances"
       FROM legal_documents d
       WHERE d.is_active = true
         AND d.version = (SELECT MAX(version) FROM legal_documents x WHERE x.doc_type = d.doc_type AND x.is_active = true)
       ORDER BY d.doc_type`
    );
    return res.rows;
  }

  /** Per-user consent history (admin user detail). */
  async getUserAcceptances(userId: string): Promise<any[]> {
    const res = await database.query(
      `SELECT doc_type as "docType", version, context, ip_address as "ipAddress",
              accepted_at as "acceptedAt"
       FROM user_policy_acceptances WHERE user_id = $1 ORDER BY accepted_at DESC`,
      [userId]
    );
    return res.rows;
  }
}

export default new LegalService();
