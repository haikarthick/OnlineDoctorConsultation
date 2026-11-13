import database from '../../utils/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { resolveNetworkAccess } from '../../middleware/networkAccess';
  // ─── Leave Management ───────────────────────────────────────
  export async function createLeaveRequest(data: {
    networkId: string; hospitalId?: string; userId: string;
    leaveType: string; startDate: string; endDate: string; reason?: string;
  }): Promise<any> {
    const member = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true`,
      [data.networkId, data.userId]
    );
    if (member.rows.length === 0) throw new ValidationError('Not a member of this network');

    const result = await database.query(
      `INSERT INTO staff_leave_requests (network_id, hospital_id, user_id, leave_type, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.networkId, data.hospitalId || null, data.userId, data.leaveType, data.startDate, data.endDate, data.reason || null]
    );
    return result.rows[0];
  }

  export async function listLeaveRequests(networkId: string, filters: {
    hospitalId?: string; userId?: string; status?: string;
    page?: number; limit?: number;
  } = {}): Promise<{ rows: any[]; total: number }> {
    const conditions: string[] = ['lr.network_id = $1'];
    const params: any[] = [networkId];
    let idx = 1;

    if (filters.hospitalId) { idx++; conditions.push(`lr.hospital_id = $${idx}`); params.push(filters.hospitalId); }
    if (filters.userId) { idx++; conditions.push(`lr.user_id = $${idx}`); params.push(filters.userId); }
    if (filters.status) { idx++; conditions.push(`lr.status = $${idx}`); params.push(filters.status); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const [rowsResult, countResult] = await Promise.all([
      database.query(
        `SELECT lr.*,
                COALESCE(u.first_name || ' ' || u.last_name, '') as "userName",
                COALESCE(ap.first_name || ' ' || ap.last_name, '') as "approverName",
                vh.name as "hospitalName"
         FROM staff_leave_requests lr
         LEFT JOIN users u ON u.id = lr.user_id
         LEFT JOIN users ap ON ap.id = lr.approved_by
         LEFT JOIN vet_hospitals vh ON vh.id = lr.hospital_id
         ${where}
         ORDER BY lr.created_at DESC
         LIMIT $${idx + 1} OFFSET $${idx + 2}`,
        [...params, limit, offset]
      ),
      database.query(
        `SELECT COUNT(*) as count FROM staff_leave_requests lr ${where}`,
        params
      ),
    ]);

    return {
      rows: rowsResult.rows,
      total: parseInt(countResult.rows[0]?.count || '0'),
    };
  }

  export async function updateLeaveRequestStatus(
    networkId: string, requestId: string, status: 'approved' | 'rejected' | 'cancelled',
    userId: string, rejectionReason?: string
  ): Promise<any> {
    // WHERE network_id = $networkId is the fix: without it, a director/corporate_admin of
    // ANY network could approve/reject/cancel a leave request belonging to a DIFFERENT
    // network just by supplying that request's id - the caller's authority was only ever
    // checked against the URL's :id, never against the request row's own network_id.
    const extraFields = status === 'approved' ? ', approved_by = $5, approved_at = NOW()' : '';
    const result = await database.query(
      `UPDATE staff_leave_requests
       SET status = $1, rejection_reason = $2, updated_at = NOW() ${extraFields}
       WHERE id = $3 AND network_id = $4 RETURNING *`,
      status === 'approved'
        ? [status, rejectionReason || null, requestId, networkId, userId]
        : [status, rejectionReason || null, requestId, networkId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Leave request');
    return result.rows[0];
  }

  // ─── Patient Transfer ───────────────────────────────────────
  export async function createPatientTransfer(data: {
    networkId: string; fromHospitalId: string; toHospitalId: string;
    animalId: string; reason: string; transferReason?: string;
    clinicalNotes?: string; createdBy: string; createdByRole: string;
  }): Promise<any> {
    const fromCheck = await database.query(
      `SELECT id FROM hospital_network_hospitals WHERE network_id = $1 AND hospital_id = $2`,
      [data.networkId, data.fromHospitalId]
    );
    if (fromCheck.rows.length === 0) throw new ValidationError('Source hospital is not in this network');

    const toCheck = await database.query(
      `SELECT id FROM hospital_network_hospitals WHERE network_id = $1 AND hospital_id = $2`,
      [data.networkId, data.toHospitalId]
    );
    if (toCheck.rows.length === 0) throw new ValidationError('Destination hospital is not in this network');

    // Was a bare "is an active member" check - compliance_officer/auditor have
    // patientTransfers=false in the matrix but could still hit this route. Now checks the
    // actual matrix action, same as every other network-gated mutation.
    const access = await resolveNetworkAccess(data.networkId, data.createdBy, data.createdByRole, 'patientTransfers');
    if (!access.allowed) throw new ForbiddenError('Not authorized to create transfers');

    const result = await database.query(
      `INSERT INTO network_referrals
        (network_id, from_hospital_id, to_hospital_id, animal_id, reason,
         clinical_notes, transfer_reason, referral_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'transfer', $8)
       RETURNING *`,
      [data.networkId, data.fromHospitalId, data.toHospitalId, data.animalId,
       data.reason, data.clinicalNotes || null, data.transferReason || null, data.createdBy]
    );
    return result.rows[0];
  }

