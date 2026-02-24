import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

// ─── Interfaces ──────────────────────────────────────────────
export interface Enterprise {
  id: string;
  name: string;
  enterpriseType: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  totalArea?: number;
  areaUnit?: string;
  licenseNumber?: string;
  regulatoryId?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  ownerId: string;
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  // joined
  ownerName?: string;
  memberCount?: number;
  animalCount?: number;
}

export interface EnterpriseCreateDTO {
  name: string;
  enterpriseType: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  totalArea?: number;
  areaUnit?: string;
  licenseNumber?: string;
  regulatoryId?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface EnterpriseMember {
  id: string;
  enterpriseId: string;
  userId: string;
  role: string;
  title?: string;
  permissions?: any;
  isActive: boolean;
  joinedAt: Date;
  updatedAt: Date;
  // joined
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export class EnterpriseService {

  // ─── Enterprise CRUD ───────────────────────────────────────
  async createEnterprise(ownerId: string, data: EnterpriseCreateDTO): Promise<Enterprise> {
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO enterprises (id, name, enterprise_type, description, address, city, state, country, postal_code,
           gps_latitude, gps_longitude, total_area, area_unit, license_number, regulatory_id, tax_id,
           phone, email, website, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [id, data.name, data.enterpriseType, data.description, data.address, data.city, data.state,
         data.country || 'US', data.postalCode, data.gpsLatitude, data.gpsLongitude, data.totalArea,
         data.areaUnit || 'acres', data.licenseNumber, data.regulatoryId, data.taxId,
         data.phone, data.email, data.website, ownerId]
      );

      // Auto-add owner as enterprise member with owner role
      await database.query(
        `INSERT INTO enterprise_members (id, enterprise_id, user_id, role) VALUES ($1, $2, $3, 'owner')`,
        [uuidv4(), id, ownerId]
      );

      // Set as user's default enterprise if they don't have one
      await database.query(
        `UPDATE users SET default_enterprise_id = $1 WHERE id = $2 AND default_enterprise_id IS NULL`,
        [id, ownerId]
      );

      logger.info(`Enterprise created: ${data.name} (${data.enterpriseType})`, { enterpriseId: id, ownerId });
      return this.mapRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create enterprise', { error: error.message });
      throw new DatabaseError('Failed to create enterprise');
    }
  }

  async getEnterprise(id: string): Promise<Enterprise> {
    const result = await database.query(
      `SELECT e.*, u.first_name || ' ' || u.last_name as owner_name,
              (SELECT COUNT(*) FROM enterprise_members WHERE enterprise_id = e.id AND is_active = true) as member_count,
              (SELECT COUNT(*) FROM animals WHERE enterprise_id = e.id AND is_active = true) as animal_count
       FROM enterprises e
       JOIN users u ON e.owner_id = u.id
       WHERE e.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Enterprise not found');
    return this.mapRow(result.rows[0]);
  }

  async listEnterprisesForUser(userId: string, limit = 20, offset = 0): Promise<{ items: Enterprise[]; total: number }> {
    const countResult = await database.query(
      `SELECT COUNT(DISTINCT e.id) as total
       FROM enterprises e
       LEFT JOIN enterprise_members em ON e.id = em.enterprise_id
       WHERE (e.owner_id = $1 OR (em.user_id = $1 AND em.is_active = true)) AND e.is_active = true`,
      [userId]
    );

    const result = await database.query(
      `SELECT DISTINCT e.*, u.first_name || ' ' || u.last_name as owner_name,
              (SELECT COUNT(*) FROM enterprise_members WHERE enterprise_id = e.id AND is_active = true) as member_count,
              (SELECT COUNT(*) FROM animals WHERE enterprise_id = e.id AND is_active = true) as animal_count
       FROM enterprises e
       JOIN users u ON e.owner_id = u.id
       LEFT JOIN enterprise_members em ON e.id = em.enterprise_id
       WHERE (e.owner_id = $1 OR (em.user_id = $1 AND em.is_active = true)) AND e.is_active = true
       ORDER BY e.name ASC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      items: result.rows.map((r: any) => this.mapRow(r)),
      total: parseInt(countResult.rows[0]?.total || '0'),
    };
  }

  async listAllEnterprises(limit = 20, offset = 0): Promise<{ items: Enterprise[]; total: number }> {
    const countResult = await database.query(`SELECT COUNT(*) as total FROM enterprises WHERE is_active = true`);
    const result = await database.query(
      `SELECT e.*, u.first_name || ' ' || u.last_name as owner_name,
              (SELECT COUNT(*) FROM enterprise_members WHERE enterprise_id = e.id AND is_active = true) as member_count,
              (SELECT COUNT(*) FROM animals WHERE enterprise_id = e.id AND is_active = true) as animal_count
       FROM enterprises e
       JOIN users u ON e.owner_id = u.id
       WHERE e.is_active = true
       ORDER BY e.name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return {
      items: result.rows.map((r: any) => this.mapRow(r)),
      total: parseInt(countResult.rows[0]?.total || '0'),
    };
  }

  async updateEnterprise(id: string, data: Partial<EnterpriseCreateDTO>): Promise<Enterprise> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', enterpriseType: 'enterprise_type', description: 'description',
      address: 'address', city: 'city', state: 'state', country: 'country',
      postalCode: 'postal_code', gpsLatitude: 'gps_latitude', gpsLongitude: 'gps_longitude',
      totalArea: 'total_area', areaUnit: 'area_unit', licenseNumber: 'license_number',
      regulatoryId: 'regulatory_id', taxId: 'tax_id', phone: 'phone',
      email: 'email', website: 'website',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push((data as any)[key]);
      }
    }

    if (setClauses.length === 0) throw new Error('No fields to update');
    params.push(id);

    await database.query(
      `UPDATE enterprises SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      params
    );

    return this.getEnterprise(id);
  }

  async deleteEnterprise(id: string): Promise<void> {
    await database.query(`UPDATE enterprises SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  // ─── Enterprise Member Management ─────────────────────────
  async addMember(enterpriseId: string, userId: string, role: string, title?: string): Promise<EnterpriseMember> {
    const id = uuidv4();
    await database.query(
      `INSERT INTO enterprise_members (id, enterprise_id, user_id, role, title)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (enterprise_id, user_id) DO UPDATE SET role = $4, title = $5, is_active = true, updated_at = NOW()`,
      [id, enterpriseId, userId, role, title]
    );
    return this.getMember(enterpriseId, userId);
  }

  async removeMember(enterpriseId: string, userId: string): Promise<void> {
    await database.query(
      `UPDATE enterprise_members SET is_active = false, updated_at = NOW() WHERE enterprise_id = $1 AND user_id = $2`,
      [enterpriseId, userId]
    );
  }

  async updateMemberRole(enterpriseId: string, userId: string, role: string, title?: string): Promise<EnterpriseMember> {
    await database.query(
      `UPDATE enterprise_members SET role = $3, title = COALESCE($4, title), updated_at = NOW()
       WHERE enterprise_id = $1 AND user_id = $2`,
      [enterpriseId, userId, role, title]
    );
    return this.getMember(enterpriseId, userId);
  }

  async getMember(enterpriseId: string, userId: string): Promise<EnterpriseMember> {
    const result = await database.query(
      `SELECT em.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email, u.role as user_role
       FROM enterprise_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.enterprise_id = $1 AND em.user_id = $2`,
      [enterpriseId, userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Member not found');
    return this.mapMemberRow(result.rows[0]);
  }

  async listMembers(enterpriseId: string): Promise<EnterpriseMember[]> {
    const result = await database.query(
      `SELECT em.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email, u.role as user_role
       FROM enterprise_members em
       JOIN users u ON em.user_id = u.id
       WHERE em.enterprise_id = $1 AND em.is_active = true
       ORDER BY CASE em.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 WHEN 'supervisor' THEN 3 WHEN 'farm_vet' THEN 4 ELSE 5 END`,
      [enterpriseId]
    );
    return result.rows.map((r: any) => this.mapMemberRow(r));
  }

  /** Check if user has access to enterprise (is owner or active member) */
  async hasAccess(enterpriseId: string, userId: string): Promise<boolean> {
    const result = await database.query(
      `SELECT 1 FROM enterprises WHERE id = $1 AND owner_id = $2
       UNION
       SELECT 1 FROM enterprise_members WHERE enterprise_id = $1 AND user_id = $2 AND is_active = true`,
      [enterpriseId, userId]
    );
    return result.rows.length > 0;
  }

  /** Check if user has specific role in enterprise */
  async hasRole(enterpriseId: string, userId: string, roles: string[]): Promise<boolean> {
    const result = await database.query(
      `SELECT 1 FROM enterprise_members WHERE enterprise_id = $1 AND user_id = $2 AND role = ANY($3) AND is_active = true`,
      [enterpriseId, userId, roles]
    );
    return result.rows.length > 0;
  }

  // ─── Enterprise Animals ─────────────────────────────────────
  async listEnterpriseAnimals(enterpriseId: string, limit = 100, offset = 0, groupId?: string): Promise<{ items: any[]; total: number }> {
    const conditions = ['a.enterprise_id = $1', 'a.is_active = true'];
    const params: any[] = [enterpriseId];
    if (groupId) { params.push(groupId); conditions.push(`a.group_id = $${params.length}`); }
    const where = conditions.join(' AND ');
    const [rows, count] = await Promise.all([
      database.query(
        `SELECT a.id, a.name, a.species, a.breed, a.gender, a.date_of_birth,
                a.weight, a.unique_id as "uniqueId", a.group_id as "groupId",
                ag.name as "groupName", a.owner_id as "ownerId"
         FROM animals a LEFT JOIN animal_groups ag ON ag.id = a.group_id
         WHERE ${where} ORDER BY a.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      database.query(`SELECT COUNT(*) as count FROM animals a WHERE ${where}`, params),
    ]);
    return { items: rows.rows, total: parseInt(count.rows[0]?.count || '0') };
  }

  // ─── Dashboard Stats ──────────────────────────────────────
  async getEnterpriseStats(enterpriseId: string): Promise<any> {
    const [animals, groups, locations, campaigns, members, vaccStats, medRecords] = await Promise.all([
      database.query(`SELECT COUNT(*) as count, species FROM animals WHERE enterprise_id = $1 AND is_active = true GROUP BY species`, [enterpriseId]),
      database.query(`SELECT COUNT(*) as count FROM animal_groups WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]),
      database.query(`SELECT COUNT(*) as count FROM locations WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]),
      database.query(`SELECT COUNT(*) as count, status FROM treatment_campaigns WHERE enterprise_id = $1 GROUP BY status`, [enterpriseId]),
      database.query(`SELECT COUNT(*) as count FROM enterprise_members WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]),
      database.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN vr.next_due_date < CURRENT_DATE THEN 1 END) as overdue,
                COUNT(CASE WHEN vr.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as upcoming
         FROM vaccination_records vr JOIN animals a ON a.id = vr.animal_id
         WHERE a.enterprise_id = $1`,
        [enterpriseId]
      ),
      database.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN mr.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent
         FROM medical_records mr JOIN animals a ON a.id = mr.animal_id
         WHERE a.enterprise_id = $1`,
        [enterpriseId]
      ),
    ]);

    const vRow = vaccStats.rows[0] || {};
    const mRow = medRecords.rows[0] || {};

    return {
      totalAnimals: animals.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0),
      animalsBySpecies: animals.rows.map((r: any) => ({ species: r.species, count: parseInt(r.count) })),
      totalGroups: parseInt(groups.rows[0]?.count || '0'),
      totalLocations: parseInt(locations.rows[0]?.count || '0'),
      campaignsByStatus: campaigns.rows.reduce((acc: any, r: any) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
      totalMembers: parseInt(members.rows[0]?.count || '0'),
      health: {
        totalMedicalRecords: parseInt(mRow.total || '0'),
        recentMedicalRecords: parseInt(mRow.recent || '0'),
        totalVaccinations: parseInt(vRow.total || '0'),
        overdueVaccinations: parseInt(vRow.overdue || '0'),
        upcomingVaccinations: parseInt(vRow.upcoming || '0'),
      },
    };
  }

  // ─── Row Mappers ───────────────────────────────────────────
  private mapRow(row: any): Enterprise {
    return {
      id: row.id,
      name: row.name,
      enterpriseType: row.enterprise_type,
      description: row.description,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      gpsLatitude: row.gps_latitude ? parseFloat(row.gps_latitude) : undefined,
      gpsLongitude: row.gps_longitude ? parseFloat(row.gps_longitude) : undefined,
      totalArea: row.total_area ? parseFloat(row.total_area) : undefined,
      areaUnit: row.area_unit,
      licenseNumber: row.license_number,
      regulatoryId: row.regulatory_id,
      taxId: row.tax_id,
      phone: row.phone,
      email: row.email,
      website: row.website,
      logoUrl: row.logo_url,
      ownerId: row.owner_id,
      isActive: row.is_active,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ownerName: row.owner_name,
      memberCount: row.member_count ? parseInt(row.member_count) : undefined,
      animalCount: row.animal_count ? parseInt(row.animal_count) : undefined,
    };
  }

  private mapMemberRow(row: any): EnterpriseMember {
    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      userId: row.user_id,
      role: row.role,
      title: row.title,
      permissions: row.permissions,
      isActive: row.is_active,
      joinedAt: row.joined_at,
      updatedAt: row.updated_at,
      userName: row.user_name,
      userEmail: row.user_email,
      userRole: row.user_role,
    };
  }
}

export default new EnterpriseService();
