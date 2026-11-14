import database from '../../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors';
import logger from '../../utils/logger';
  // ─── Network Referrals ───────────────────────────────────────

  export async function createNetworkReferral(data: {
    networkId: string;
    fromHospitalId: string;
    toHospitalId: string;
    fromVetId: string;
    toVetId?: string;
    animalId: string;
    consultationId?: string;
    reason: string;
    priority?: string;
    clinicalNotes?: string;
    createdBy: string;
  }): Promise<any> {
    const fromMember = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND hospital_id = $2 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
      [data.networkId, data.fromHospitalId]
    );
    if (fromMember.rows.length === 0) {
      throw new ValidationError('Referring hospital is not a member of this network');
    }
    const toMember = await database.query(
      `SELECT id FROM hospital_network_members WHERE network_id = $1 AND hospital_id = $2 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
      [data.networkId, data.toHospitalId]
    );
    if (toMember.rows.length === 0) {
      throw new ValidationError('Receiving hospital is not a member of this network');
    }

    // Verify caller is a member of this network
    const callerMember = await database.query(
      `SELECT id, network_role FROM hospital_network_members
       WHERE network_id = $1 AND user_id = $2 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
      [data.networkId, data.createdBy]
    );
    if (callerMember.rows.length === 0) {
      throw new ForbiddenError('You are not a member of this network');
    }

    const result = await database.query(
      `INSERT INTO network_referrals
        (network_id, from_hospital_id, to_hospital_id, from_vet_id, to_vet_id,
         animal_id, consultation_id, reason, priority, clinical_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.networkId, data.fromHospitalId, data.toHospitalId,
        data.fromVetId, data.toVetId || null,
        data.animalId, data.consultationId || null,
        data.reason, data.priority || 'normal',
        data.clinicalNotes || null, data.createdBy,
      ]
    );
    return result.rows[0];
  }

  export async function updateNetworkReferralStatus(
    referralId: string,
    status: 'accepted' | 'rejected' | 'completed' | 'cancelled',
    userId: string,
    responseNotes?: string
  ): Promise<any> {
    // First fetch the referral to check authorization
    const referralCheck = await database.query(
      `SELECT r.network_id, r.from_hospital_id, r.to_hospital_id
       FROM network_referrals r WHERE r.id = $1`,
      [referralId]
    );
    if (referralCheck.rows.length === 0) throw new NotFoundError('Network referral');

    const referral = referralCheck.rows[0];
    // Verify caller is a member of this network
    const callerMember = await database.query(
      `SELECT id FROM hospital_network_members
       WHERE network_id = $1 AND user_id = $2 AND is_active = true AND (valid_until IS NULL OR valid_until > NOW()) LIMIT 1`,
      [referral.network_id, userId]
    );
    if (callerMember.rows.length === 0) {
      throw new ForbiddenError('You are not authorized to update this referral');
    }

    const statusField = status === 'accepted' ? ', accepted_at = NOW()'
      : status === 'rejected' ? ', rejected_at = NOW()' : '';

    const result = await database.query(
      `UPDATE network_referrals
       SET status = $1, response_notes = $2, updated_at = NOW() ${statusField}
       WHERE id = $3
       RETURNING *`,
      [status, responseNotes || null, referralId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Network referral');
    return result.rows[0];
  }

  export async function listNetworkReferrals(params: {
    networkId?: string;
    hospitalId?: string;
    direction?: 'incoming' | 'outgoing' | 'all';
    animalId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const { page = 1, limit = 20, direction = 'all' } = params;
    const offset = (page - 1) * limit;
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIdx = 1;

    if (params.networkId)  { conditions.push(`nr.network_id = $${paramIdx++}`);  values.push(params.networkId); }
    if (params.animalId)   { conditions.push(`nr.animal_id = $${paramIdx++}`);   values.push(params.animalId); }
    if (params.status)     { conditions.push(`nr.status = $${paramIdx++}`);      values.push(params.status); }
    if (params.hospitalId && direction === 'incoming') {
      conditions.push(`nr.to_hospital_id = $${paramIdx++}`); values.push(params.hospitalId);
    } else if (params.hospitalId && direction === 'outgoing') {
      conditions.push(`nr.from_hospital_id = $${paramIdx++}`); values.push(params.hospitalId);
    } else if (params.hospitalId) {
      conditions.push(`(nr.from_hospital_id = $${paramIdx} OR nr.to_hospital_id = $${paramIdx})`);
      values.push(params.hospitalId); paramIdx++;
    }

    const whereClause = conditions.join(' AND ');
    values.push(limit, offset);

    const result = await database.query(
      `SELECT
         nr.*,
         fh.name AS "fromHospitalName",
         th.name AS "toHospitalName",
         a.name AS "animalName", a.species AS "animalSpecies",
         CONCAT(fv.first_name, ' ', fv.last_name) AS "fromVetName",
         CONCAT(tv.first_name, ' ', tv.last_name) AS "toVetName",
         hn.name AS "networkName"
       FROM network_referrals nr
       LEFT JOIN vet_hospitals fh ON fh.id = nr.from_hospital_id
       LEFT JOIN vet_hospitals th ON th.id = nr.to_hospital_id
       LEFT JOIN animals a ON a.id = nr.animal_id
       LEFT JOIN users fv ON fv.id = nr.from_vet_id
       LEFT JOIN users tv ON tv.id = nr.to_vet_id
       LEFT JOIN hospital_networks hn ON hn.id = nr.network_id
       WHERE ${whereClause}
       ORDER BY nr.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      values
    );

    const countVals = values.slice(0, -2);
    const countResult = await database.query(
      `SELECT COUNT(*) FROM network_referrals nr WHERE ${whereClause}`,
      countVals
    );

    return {
      referrals: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  }

  export async function getCorporateDashboardStats(userId: string): Promise<{
    totalNetworks: number;
    approvedNetworks: number;
    pendingNetworks: number;
    totalHospitals: number;
    totalMembers: number;
    recentNetworks: any[];
  }> {
    const [networksRes, hospitalsRes, membersRes, recentRes] = await Promise.all([
      database.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_approved = true) as approved,
           COUNT(*) FILTER (WHERE is_approved = false) as pending
         FROM hospital_networks WHERE created_by = $1`,
        [userId]
      ),
      database.query(
        `SELECT COUNT(DISTINCT hnh.hospital_id) as total
         FROM hospital_network_hospitals hnh
         JOIN hospital_networks hn ON hnh.network_id = hn.id
         WHERE hn.created_by = $1`,
        [userId]
      ),
      database.query(
        `SELECT COUNT(DISTINCT hnm.user_id) as total
         FROM hospital_network_members hnm
         JOIN hospital_networks hn ON hnm.network_id = hn.id
         WHERE hn.created_by = $1`,
        [userId]
      ),
      database.query(
        `SELECT id, name, network_type as "networkType", is_approved as "isApproved",
                created_at as "createdAt"
         FROM hospital_networks WHERE created_by = $1
         ORDER BY created_at DESC LIMIT 5`,
        [userId]
      ),
    ]);

    return {
      totalNetworks: parseInt(networksRes.rows[0]?.total || '0'),
      approvedNetworks: parseInt(networksRes.rows[0]?.approved || '0'),
      pendingNetworks: parseInt(networksRes.rows[0]?.pending || '0'),
      totalHospitals: parseInt(hospitalsRes.rows[0]?.total || '0'),
      totalMembers: parseInt(membersRes.rows[0]?.total || '0'),
      recentNetworks: recentRes.rows,
    };
  }

  export async function createBranchHospital(networkId: string, data: {
    name: string;
    hospitalType?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    description?: string;
    specializations?: string[];
    operatingHours?: string;
  }, createdById: string): Promise<any> {
    const netCheck = await database.query(
      `SELECT id, created_by FROM hospital_networks WHERE id = $1`,
      [networkId]
    );
    if (netCheck.rows.length === 0) throw new NotFoundError('Hospital network not found');

    // Verify requester has access to this network (admin bypasses)
    const userCheck = await database.query(`SELECT role FROM users WHERE id = $1`, [createdById]);
    if (userCheck.rows.length === 0) throw new ValidationError('Invalid requester');
    if (userCheck.rows[0].role !== 'admin') {
      const accessCheck = await database.query(
        `SELECT id FROM hospital_networks WHERE id = $1 AND created_by = $2
         UNION
         SELECT network_id as id FROM hospital_network_members WHERE network_id = $1 AND user_id = $2 AND is_active = true
           AND (valid_until IS NULL OR valid_until > NOW())
         LIMIT 1`,
        [networkId, createdById]
      );
      if (accessCheck.rows.length === 0) throw new ForbiddenError('You do not have permission to create branch hospitals in this network');
    }

    // Duplicate name check within the same network
    const dupCheck = await database.query(
      `SELECT id FROM vet_hospitals WHERE branch_network_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [networkId, data.name]
    );
    if (dupCheck.rows.length > 0) throw new ConflictError(`A branch hospital named "${data.name}" already exists in this network`);

    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');

      const hospitalResult = await client.query(
        `INSERT INTO vet_hospitals (name, hospital_type, address, city, state, country, postal_code, phone, email,
          description, specializations, operating_hours, owner_id, is_network_branch, branch_network_id, is_verified, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, true, $14, false, 'approved')
         RETURNING id, name, city, state, hospital_type as "hospitalType"`,
        [
          data.name, data.hospitalType || 'multi_specialty', data.address || null,
          data.city || null, data.state || null, data.country || 'IN',
          data.postalCode || null, data.phone || null, data.email || null,
          data.description || null, data.specializations || [],
          data.operatingHours ? JSON.stringify({ text: data.operatingHours }) : '{}',
          createdById, networkId
        ]
      );

      const hospital = hospitalResult.rows[0];

      await client.query(
        `INSERT INTO hospital_network_hospitals (network_id, hospital_id, joined_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (network_id, hospital_id) DO NOTHING`,
        [networkId, hospital.id]
      );

      await client.query('COMMIT');
      logger.info('Branch hospital created', { networkId, hospitalId: hospital.id, createdById });
      return hospital;
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to create branch hospital', { error: error.message, stack: error.stack });
      if (error.code === '23505') throw new ConflictError('A branch hospital with this name already exists');
      if (error.code === '23503') throw new ValidationError('Invalid reference: check that the network and user exist');
      throw new DatabaseError(`Failed to create branch hospital: ${error.message}`);
    } finally {
      client.release();
    }
  }

