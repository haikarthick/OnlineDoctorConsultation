import database from '../../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors';
import logger from '../../utils/logger';
import type { HospitalNetwork, HospitalNetworkCreateDTO } from './types';
import { mapNetworkRow } from './rowMappersAndDeactivate';
  export async function createNetwork(data: HospitalNetworkCreateDTO, createdById: string): Promise<HospitalNetwork> {
    // Fix 3: Validate id_prefix uniqueness BEFORE the transaction
    if (data.idPrefix) {
      const prefixCheck = await database.query(
        `SELECT id FROM hospital_networks WHERE UPPER(id_prefix) = UPPER($1) LIMIT 1`,
        [data.idPrefix]
      );
      if (prefixCheck.rows.length > 0) {
        throw new ConflictError('Network ID prefix is already in use by another network. Please choose a different prefix.');
      }
    }

    // Fix 1: Wrap both INSERTs in a transaction so an orphaned network can never exist
    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO hospital_networks
           (name, legal_name, registration_number, tax_id, network_type,
            country, headquarters_address, headquarters_city, headquarters_state,
            contact_email, contact_phone, website, logo_url,
            dpo_name, dpo_email, data_residency_region, metadata, id_prefix, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
          data.name,
          data.legalName ?? null,
          data.registrationNumber ?? null,
          data.taxId ?? null,
          data.networkType ?? 'private',
          data.country ?? null,
          data.headquartersAddress ?? null,
          data.headquartersCity ?? null,
          data.headquartersState ?? null,
          data.contactEmail ?? null,
          data.contactPhone ?? null,
          data.website ?? null,
          data.logoUrl ?? null,
          data.dpoName ?? null,
          data.dpoEmail ?? null,
          data.dataResidencyRegion ?? null,
          data.metadata ?? null,
          data.idPrefix ?? null,
          createdById,
        ]
      );

      const network = result.rows[0];

      // Auto-add creator as corporate_admin
      await client.query(
        `INSERT INTO hospital_network_members (network_id, user_id, network_role, granted_by)
         VALUES ($1, $2, 'corporate_admin', $2)`,
        [network.id, createdById]
      );

      await client.query('COMMIT');
      logger.info(`Hospital network created: ${data.name}`, { networkId: network.id, createdById });
      return mapNetworkRow(network);
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to create hospital network', { error: err.message });
      if (err.message.includes('already in use')) throw err;
      throw new DatabaseError('Failed to create hospital network');
    } finally {
      client.release();
    }
  }

  export async function listNetworks(filters: { isApproved?: boolean; isActive?: boolean; userId?: string; userRole?: string } = {}): Promise<HospitalNetwork[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // I-3: Data scoping - every non-admin role only sees networks they own or are an active member of.
    // (Previously only corporate_admin was scoped, leaking the full network directory to vets/staff.)
    if (filters.userId && filters.userRole && filters.userRole !== 'admin') {
      params.push(filters.userId);
      conditions.push(`(hn.created_by = $${idx} OR EXISTS (
        SELECT 1 FROM hospital_network_members hnm
        WHERE hnm.network_id = hn.id AND hnm.user_id = $${idx} AND hnm.is_active = true
          AND (hnm.valid_until IS NULL OR hnm.valid_until > NOW())
      ))`);
      idx++;
    }
    // admin sees all networks - no additional filter

    if (filters.isApproved !== undefined) {
      conditions.push(`hn.is_approved = $${idx++}`);
      params.push(filters.isApproved);
    }
    if (filters.isActive !== undefined) {
      conditions.push(`hn.is_active = $${idx++}`);
      params.push(filters.isActive);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await database.query(
      `SELECT hn.*,
              u.first_name || ' ' || u.last_name AS "approvedByName",
              (SELECT COUNT(*) FROM hospital_network_members WHERE network_id = hn.id AND is_active = true AND (valid_until IS NULL OR valid_until > NOW())) AS "memberCount",
              (SELECT COUNT(DISTINCT hospital_id) FROM hospital_network_members WHERE network_id = hn.id AND hospital_id IS NOT NULL AND is_active = true AND (valid_until IS NULL OR valid_until > NOW())) AS "hospitalCount"
       FROM hospital_networks hn
       LEFT JOIN users u ON hn.approved_by = u.id
       ${where}
       ORDER BY hn.name ASC`,
      params
    );
    return result.rows.map((r: any) => mapNetworkRow(r));
  }

  export async function getNetworkById(id: string): Promise<HospitalNetwork> {
    const result = await database.query(
      `SELECT hn.*,
              u.first_name || ' ' || u.last_name AS "approvedByName",
              (SELECT COUNT(*) FROM hospital_network_members WHERE network_id = hn.id AND is_active = true AND (valid_until IS NULL OR valid_until > NOW())) AS "memberCount",
              (SELECT COUNT(DISTINCT hospital_id) FROM hospital_network_members WHERE network_id = hn.id AND hospital_id IS NOT NULL AND is_active = true AND (valid_until IS NULL OR valid_until > NOW())) AS "hospitalCount"
       FROM hospital_networks hn
       LEFT JOIN users u ON hn.approved_by = u.id
       WHERE hn.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Hospital network not found');
    return mapNetworkRow(result.rows[0]);
  }

  export async function updateNetwork(id: string, data: Partial<HospitalNetworkCreateDTO>, userId: string, userRole?: string): Promise<HospitalNetwork> {
    // Authorization: platform admin or the corporate_admin of this network
    if (userRole !== 'admin') {
      const authCheck = await database.query(
        `SELECT id FROM hospital_network_members
         WHERE network_id = $1 AND user_id = $2 AND network_role = 'corporate_admin' AND is_active = true
           AND (valid_until IS NULL OR valid_until > NOW())`,
        [id, userId]
      );
      if (authCheck.rows.length === 0) {
        throw new ForbiddenError('Only the network corporate admin or platform admin can edit network settings.');
      }
    }

    const fieldMap: Record<string, string> = {
      name: 'name',
      legalName: 'legal_name',
      registrationNumber: 'registration_number',
      taxId: 'tax_id',
      networkType: 'network_type',
      country: 'country',
      headquartersAddress: 'headquarters_address',
      headquartersCity: 'headquarters_city',
      headquartersState: 'headquarters_state',
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      website: 'website',
      logoUrl: 'logo_url',
      dpoName: 'dpo_name',
      dpoEmail: 'dpo_email',
      dataResidencyRegion: 'data_residency_region',
      metadata: 'metadata',
      idPrefix: 'id_prefix',
    };

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push((data as any)[key]);
      }
    }

    if (setClauses.length === 0) throw new ValidationError('No fields to update');
    params.push(id);

    await database.query(
      `UPDATE hospital_networks SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      params
    );

    return getNetworkById(id);
  }

  export async function approveNetwork(id: string, approverId: string): Promise<void> {
    // Prevent creator from self-approving
    const networkCheck = await database.query(
      `SELECT created_by FROM hospital_networks WHERE id = $1`,
      [id]
    );
    if (networkCheck.rows.length === 0) throw new NotFoundError('Hospital network not found');
    if (networkCheck.rows[0].created_by === approverId) {
      throw new ForbiddenError('Network creators cannot approve their own network. Platform admin approval required.');
    }

    const result = await database.query(
      `UPDATE hospital_networks
       SET is_approved = true, approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, approverId]
    );
    if (result.rowCount === 0) throw new NotFoundError('Hospital network not found');
    logger.info(`Hospital network approved`, { networkId: id, approverId });
  }

