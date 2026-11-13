import database from '../../utils/database';
import logger from '../../utils/logger';
import type { NetworkDashboard, AccessLogEntry } from './types';
  // ─── Dashboard ─────────────────────────────────────────────────
  export async function getNetworkDashboard(networkId: string): Promise<NetworkDashboard> {
    const [members, hospitals, patients, consents, accessLogs, membersByRole] = await Promise.all([
      database.query(
        `SELECT COUNT(*) AS count FROM hospital_network_members WHERE network_id = $1 AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(DISTINCT hospital_id) AS count FROM hospital_network_members
         WHERE network_id = $1 AND hospital_id IS NOT NULL AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(*) AS count FROM animal_care_contexts WHERE network_id = $1 AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(*) AS count FROM patient_data_consent
         WHERE granted_to_network_id = $1 AND is_active = true`,
        [networkId]
      ),
      database.query(
        `SELECT COUNT(*) AS count FROM clinical_data_access_log
         WHERE accessor_network_id = $1 AND accessed_at >= NOW() - INTERVAL '30 days'`,
        [networkId]
      ),
      database.query(
        `SELECT network_role AS role, COUNT(*) AS count
         FROM hospital_network_members WHERE network_id = $1 AND is_active = true
         GROUP BY network_role`,
        [networkId]
      ),
    ]);

    const membersByRoleMap: Record<string, number> = {};
    for (const row of membersByRole.rows) {
      membersByRoleMap[row.role] = parseInt(row.count);
    }

    return {
      totalMembers: parseInt(members.rows[0]?.count || '0'),
      totalHospitals: parseInt(hospitals.rows[0]?.count || '0'),
      totalPatients: parseInt(patients.rows[0]?.count || '0'),
      activeConsents: parseInt(consents.rows[0]?.count || '0'),
      recentAccessLogs: parseInt(accessLogs.rows[0]?.count || '0'),
      membersByRole: membersByRoleMap,
    };
  }

  export async function getHospitalStaffDashboard(userId: string): Promise<any> {
    // Find user's network and hospital
    const memberResult = await database.query(
      `SELECT hnm.network_id, hnm.hospital_id, hn.name as network_name, vh.name as hospital_name
       FROM hospital_network_members hnm
       LEFT JOIN hospital_networks hn ON hn.id = hnm.network_id
       LEFT JOIN vet_hospitals vh ON vh.id = hnm.hospital_id
       WHERE hnm.user_id = $1 AND hnm.is_active = true LIMIT 1`,
      [userId]
    );
    if (memberResult.rows.length === 0) {
      return {
        networkName: '', hospitalName: '',
        enrolledPatients: 0, todayQueueCount: 0, activeInpatients: 0,
        pendingReferrals: 0, staffCount: 0, recentActivity: []
      };
    }
    const { network_id, hospital_id, network_name, hospital_name } = memberResult.rows[0];

    const queries = await Promise.all([
      // Enrolled patients in network
      database.query(
        `SELECT COUNT(*) as count FROM animal_care_contexts 
         WHERE network_id = $1 AND enrollment_status = 'active' AND is_active = true`,
        [network_id]
      ),
      // Today's queue (if hospital assigned)
      hospital_id ? database.query(
        `SELECT COUNT(*) as count FROM appointment_queue 
         WHERE hospital_id = $1 AND created_at::date = CURRENT_DATE`,
        [hospital_id]
      ) : Promise.resolve({ rows: [{ count: '0' }] }),
      // Active inpatients
      hospital_id ? database.query(
        `SELECT COUNT(*) as count FROM inpatient_admissions 
         WHERE hospital_id = $1 AND status = 'admitted'`,
        [hospital_id]
      ) : Promise.resolve({ rows: [{ count: '0' }] }),
      // Pending referrals
      database.query(
        `SELECT COUNT(*) as count FROM network_referrals 
         WHERE network_id = $1 AND status = 'pending'`,
        [network_id]
      ),
      // Staff count at hospital
      hospital_id ? database.query(
        `SELECT COUNT(*) as count FROM hospital_network_members 
         WHERE network_id = $1 AND hospital_id = $2 AND is_active = true`,
        [network_id, hospital_id]
      ) : database.query(
        `SELECT COUNT(*) as count FROM hospital_network_members 
         WHERE network_id = $1 AND is_active = true`,
        [network_id]
      ),
    ]);

    return {
      networkName: network_name || '',
      hospitalName: hospital_name || '',
      networkId: network_id,
      hospitalId: hospital_id,
      enrolledPatients: parseInt(queries[0].rows[0]?.count || '0'),
      todayQueueCount: parseInt(queries[1].rows[0]?.count || '0'),
      activeInpatients: parseInt(queries[2].rows[0]?.count || '0'),
      pendingReferrals: parseInt(queries[3].rows[0]?.count || '0'),
      staffCount: parseInt(queries[4].rows[0]?.count || '0'),
    };
  }

  // ─── Audit Log ────────────────────────────────────────────────
  export async function getAuditLogs(
    networkId: string,
    filters: { page?: number; limit?: number; recordType?: string; accessGranted?: boolean; animalId?: string } = {}
  ): Promise<{ rows: any[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['cal.accessor_network_id = $1'];
    const params: any[] = [networkId];
    let idx = 2;

    if (filters.recordType) { conditions.push(`cal.record_type = $${idx++}`); params.push(filters.recordType); }
    if (filters.accessGranted !== undefined) { conditions.push(`cal.access_granted = $${idx++}`); params.push(filters.accessGranted); }
    if (filters.animalId) { conditions.push(`cal.animal_id = $${idx++}`); params.push(filters.animalId); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataRes, countRes] = await Promise.all([
      database.query(
        `SELECT cal.*,
                u.first_name || ' ' || u.last_name AS "accessorName",
                u.email AS "accessorEmail",
                COALESCE(a.name, '[Animal ID: ' || cal.animal_id || ']') AS "animalName",
                a.unique_id AS "animalUniqueId"
         FROM clinical_data_access_log cal
         LEFT JOIN users u ON cal.accessed_by = u.id
         LEFT JOIN animals a ON cal.animal_id = a.id
         ${where}
         ORDER BY cal.accessed_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      database.query(
        `SELECT COUNT(*) AS total FROM clinical_data_access_log cal ${where}`,
        params
      ),
    ]);

    return {
      rows: dataRes.rows.map((r: any) => ({
        id: r.id,
        accessedBy: r.accessed_by,
        accessorName: r.accessorName,
        accessorEmail: r.accessorEmail,
        accessorRole: r.accessor_role,
        animalId: r.animal_id,
        animalName: r.animalName,
        animalUniqueId: r.animalUniqueId,
        recordType: r.record_type,
        accessType: r.access_type,
        accessGranted: r.access_granted,
        denialReason: r.denial_reason,
        consentId: r.consent_id,
        accessedAt: r.accessed_at,
      })),
      total: parseInt(countRes.rows[0]?.total || '0'),
    };
  }

  export async function logAccess(entry: AccessLogEntry): Promise<void> {
    try {
      await database.query(
        `INSERT INTO clinical_data_access_log
           (accessed_by, accessor_role, accessor_network_id, animal_id, record_type,
            record_id, access_type, consent_id, ip_address, user_agent, access_granted, denial_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          entry.accessedBy,
          entry.accessorRole,
          entry.accessorNetworkId ?? null,
          entry.animalId ?? null,
          entry.recordType ?? null,
          entry.recordId ?? null,
          entry.accessType,
          entry.consentId ?? null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          entry.accessGranted,
          entry.denialReason ?? null,
        ]
      );
    } catch (error: any) {
      // Non-fatal: log the error but don't block the calling operation
      logger.error('Failed to write clinical data access log', { error: error.message });
    }
  }

