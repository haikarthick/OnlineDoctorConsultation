import database from '../../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { resolveNetworkAccess } from '../../middleware/networkAccess';
  // ─── P5-ANALYTICS ─────────────────────────────────────────────────────────
  export async function getNetworkAnalytics(networkId: string): Promise<Record<string, any>> {
    try {
      const result = await database.query(
        `SELECT
          (SELECT COUNT(*) FROM hospital_network_members
           WHERE network_id = $1 AND is_active = true
           AND (valid_until IS NULL OR valid_until > NOW())) AS "totalMembers",
          (SELECT COUNT(*) FROM vet_hospitals WHERE branch_network_id = $1) AS "totalHospitals",
          (SELECT COUNT(DISTINCT animal_id) FROM animal_care_contexts
           WHERE network_id = $1 AND enrollment_status = 'active') AS "totalPatients",
          (SELECT COUNT(*) FROM consultations WHERE network_id = $1
           AND status IN ('scheduled','in_progress')
           AND created_at > NOW() - INTERVAL '30 days') AS "activeConsultations",
          (SELECT COUNT(*) FROM network_referrals WHERE network_id = $1
           AND created_at > NOW() - INTERVAL '30 days') AS "referrals30d",
          (SELECT COUNT(*) FROM network_referrals WHERE network_id = $1
           AND created_at > NOW() - INTERVAL '30 days' AND status = 'accepted') AS "acceptedReferrals30d",
          (SELECT COUNT(*) FROM network_security_audit WHERE network_id = $1
           AND created_at > NOW() - INTERVAL '7 days') AS "auditEvents7d",
          (SELECT COUNT(*) FROM hospital_staff_invites WHERE network_id = $1
           AND status = 'pending' AND expires_at > NOW()) AS "pendingInvites"
        FROM hospital_networks WHERE id = $1`,
        [networkId]
      );
      return result.rows[0] || {};
    } catch (err: any) {
      throw new DatabaseError(`Analytics query failed: ${err.message}`);
    }
  }

  export async function getPatientEnrollmentTrend(networkId: string): Promise<Array<{ month: string; count: number }>> {
    try {
      const result = await database.query(
        `SELECT
          DATE_TRUNC('month', enrolled_at) AS "month",
          COUNT(*) AS "count"
         FROM animal_care_contexts
         WHERE network_id = $1 AND enrollment_status = 'active'
         GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
        [networkId]
      );
      return result.rows;
    } catch (err: any) {
      throw new DatabaseError(`Enrollment trend query failed: ${err.message}`);
    }
  }

  // ─── P5-PATIENT-SEARCH ────────────────────────────────────────────────────
  export async function searchNetworkPatients(networkId: string, query: string, limit = 20, userHospitalId: string | null = null): Promise<any[]> {
    try {
      const q = `%${query}%`;
      const result = await database.query(
        `SELECT
          a.id AS "animalId",
          a.name AS "animalName",
          a.species,
          a.unique_id AS "animalUniqueId",
          acc.corporate_patient_id AS "networkPatientId",
          u.name AS "ownerName",
          u.phone AS "ownerPhone",
          acc.enrollment_status AS "enrollmentStatus",
          acc.hospital_id AS "branchHospitalId",
          vh.name AS "branchHospitalName"
         FROM animal_care_contexts acc
         JOIN animals a ON a.id = acc.animal_id
         JOIN users u ON u.id = a.owner_id
         LEFT JOIN vet_hospitals vh ON vh.id = acc.hospital_id
         WHERE acc.network_id = $1
           AND acc.enrollment_status = 'active'
           AND ($2 = '' OR a.name ILIKE $3 OR u.name ILIKE $3
                OR a.unique_id ILIKE $3 OR acc.corporate_patient_id ILIKE $3)
           AND ($4::uuid IS NULL OR acc.hospital_id = $4)
         ORDER BY a.name
         LIMIT $5`,
        [networkId, query, q, userHospitalId, limit]
      );
      return result.rows;
    } catch (err: any) {
      throw new DatabaseError(`Network patient search failed: ${err.message}`);
    }
  }

  // ─── P5-COMPLIANCE-EXPORT ─────────────────────────────────────────────────
  export async function generateComplianceReport(networkId: string, from: string, to: string): Promise<Record<string, any>> {
    try {
      const netRes = await database.query(
        `SELECT id, name FROM hospital_networks WHERE id = $1`,
        [networkId]
      );
      if (!netRes.rows.length) throw new NotFoundError('Network not found');
      const network = netRes.rows[0];

      const auditRes = await database.query(
        `SELECT nsa.id, nsa.action, nsa.target_type, nsa.target_id,
                nsa.old_value, nsa.new_value, nsa.ip_address, nsa.created_at,
                u.name AS "actorName", u.email AS "actorEmail"
         FROM network_security_audit nsa
         JOIN users u ON u.id = nsa.actor_id
         WHERE nsa.network_id = $1 AND nsa.created_at >= $2 AND nsa.created_at <= $3
         ORDER BY nsa.created_at DESC`,
        [networkId, from, to]
      );

      const memberRes = await database.query(
        `SELECT nsa.id, nsa.action, nsa.target_type, nsa.target_id,
                nsa.old_value, nsa.new_value, nsa.created_at,
                u.name AS "actorName"
         FROM network_security_audit nsa
         JOIN users u ON u.id = nsa.actor_id
         WHERE nsa.network_id = $1 AND nsa.created_at >= $2 AND nsa.created_at <= $3
           AND nsa.target_type = 'member'
         ORDER BY nsa.created_at DESC`,
        [networkId, from, to]
      );

      const consentRes = await database.query(
        `SELECT nsa.id, nsa.action, nsa.target_type, nsa.target_id,
                nsa.old_value, nsa.new_value, nsa.created_at,
                u.name AS "actorName"
         FROM network_security_audit nsa
         JOIN users u ON u.id = nsa.actor_id
         WHERE nsa.network_id = $1 AND nsa.created_at >= $2 AND nsa.created_at <= $3
           AND nsa.target_type IN ('enrollment', 'consent')
         ORDER BY nsa.created_at DESC`,
        [networkId, from, to]
      );

      const enrollRes = await database.query(
        `SELECT COUNT(*) AS "count" FROM animal_care_contexts
         WHERE network_id = $1 AND enrolled_at >= $2 AND enrolled_at <= $3`,
        [networkId, from, to]
      );

      const referralRes = await database.query(
        `SELECT COUNT(*) AS "count" FROM network_referrals
         WHERE network_id = $1 AND created_at >= $2 AND created_at <= $3`,
        [networkId, from, to]
      );

      return {
        networkId,
        networkName: network.name,
        reportPeriod: { from, to },
        generatedAt: new Date().toISOString(),
        summary: {
          totalAuditEvents: auditRes.rows.length,
          memberChanges: memberRes.rows.length,
          consentChanges: consentRes.rows.length,
          patientEnrollments: parseInt(enrollRes.rows[0]?.count ?? '0'),
          referrals: parseInt(referralRes.rows[0]?.count ?? '0'),
        },
        auditLog: auditRes.rows,
        memberHistory: memberRes.rows,
        consentHistory: consentRes.rows,
      };
    } catch (err: any) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseError(`Compliance report failed: ${err.message}`);
    }
  }

  export async function completePatientTransfer(transferId: string, userId: string, userRole: string): Promise<any> {
    const transfer = await database.query(
      `SELECT * FROM network_referrals WHERE id = $1 AND referral_type = 'transfer'`,
      [transferId]
    );
    if (transfer.rows.length === 0) throw new NotFoundError('Patient transfer');

    // Was a bare "is an active member" check - now checks the patientTransfers matrix
    // action, same as createPatientTransfer, so compliance_officer/auditor (false in the
    // matrix) can't complete a transfer even though they could see it exists.
    const access = await resolveNetworkAccess(transfer.rows[0].network_id, userId, userRole, 'patientTransfers');
    if (!access.allowed) throw new ForbiddenError('Not authorized');

    await database.query(
      `UPDATE animal_care_contexts
       SET hospital_id = $1
       WHERE network_id = $2 AND animal_id = $3 AND is_active = true`,
      [transfer.rows[0].to_hospital_id, transfer.rows[0].network_id, transfer.rows[0].animal_id]
    );

    const result = await database.query(
      `UPDATE network_referrals
       SET status = 'completed', transferred_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transferId]
    );
    return result.rows[0];
  }
