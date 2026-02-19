import { v4 as uuidv4 } from 'uuid';
import database from '../utils/database';
import { DatabaseError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

// ─── Interfaces ──────────────────────────────────────────────
export interface Location {
  id: string;
  enterpriseId: string;
  name: string;
  locationType: string;
  parentLocationId?: string;
  capacity: number;
  currentOccupancy: number;
  area?: number;
  areaUnit?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  description?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  // joined
  enterpriseName?: string;
  parentLocationName?: string;
}

export interface LocationCreateDTO {
  enterpriseId: string;
  name: string;
  locationType: string;
  parentLocationId?: string;
  capacity?: number;
  area?: number;
  areaUnit?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  description?: string;
}

export class LocationService {

  async createLocation(data: LocationCreateDTO): Promise<Location> {
    try {
      const id = uuidv4();
      const result = await database.query(
        `INSERT INTO locations (id, enterprise_id, name, location_type, parent_location_id, capacity, area, area_unit, gps_latitude, gps_longitude, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [id, data.enterpriseId, data.name, data.locationType, data.parentLocationId,
         data.capacity || 0, data.area, data.areaUnit || 'sqft', data.gpsLatitude, data.gpsLongitude, data.description]
      );
      logger.info(`Location created: ${data.name}`, { locationId: id });
      return this.mapRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Failed to create location', { error: error.message });
      throw new DatabaseError('Failed to create location');
    }
  }

  async getLocation(id: string): Promise<Location> {
    const result = await database.query(
      `SELECT l.*, e.name as enterprise_name, pl.name as parent_location_name,
              (SELECT COUNT(*) FROM animals WHERE current_location_id = l.id AND is_active = true) as actual_occupancy
       FROM locations l
       JOIN enterprises e ON l.enterprise_id = e.id
       LEFT JOIN locations pl ON l.parent_location_id = pl.id
       WHERE l.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Location not found');
    const row = result.rows[0];
    const mapped = this.mapRow(row);
    mapped.currentOccupancy = parseInt(row.actual_occupancy || '0');
    return mapped;
  }

  async listByEnterprise(enterpriseId: string, limit = 50, offset = 0): Promise<{ items: Location[]; total: number }> {
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM locations WHERE enterprise_id = $1 AND is_active = true`, [enterpriseId]
    );
    const result = await database.query(
      `SELECT l.*, e.name as enterprise_name, pl.name as parent_location_name,
              (SELECT COUNT(*) FROM animals WHERE current_location_id = l.id AND is_active = true) as actual_occupancy
       FROM locations l
       JOIN enterprises e ON l.enterprise_id = e.id
       LEFT JOIN locations pl ON l.parent_location_id = pl.id
       WHERE l.enterprise_id = $1 AND l.is_active = true
       ORDER BY l.name ASC
       LIMIT $2 OFFSET $3`,
      [enterpriseId, limit, offset]
    );
    return {
      items: result.rows.map((r: any) => {
        const mapped = this.mapRow(r);
        mapped.currentOccupancy = parseInt(r.actual_occupancy || '0');
        return mapped;
      }),
      total: parseInt(countResult.rows[0]?.total || '0'),
    };
  }

  async updateLocation(id: string, data: Partial<LocationCreateDTO>): Promise<Location> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', locationType: 'location_type', parentLocationId: 'parent_location_id',
      capacity: 'capacity', area: 'area', areaUnit: 'area_unit',
      gpsLatitude: 'gps_latitude', gpsLongitude: 'gps_longitude', description: 'description',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push((data as any)[key]);
      }
    }
    if (setClauses.length === 0) throw new Error('No fields to update');
    params.push(id);

    await database.query(`UPDATE locations SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    return this.getLocation(id);
  }

  async deleteLocation(id: string): Promise<void> {
    await database.query(`UPDATE animals SET current_location_id = NULL WHERE current_location_id = $1`, [id]);
    await database.query(`UPDATE locations SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  }

  /** Get location tree (hierarchy) for an enterprise */
  async getLocationTree(enterpriseId: string): Promise<any[]> {
    const result = await database.query(
      `SELECT l.*, (SELECT COUNT(*) FROM animals WHERE current_location_id = l.id AND is_active = true) as actual_occupancy
       FROM locations l WHERE l.enterprise_id = $1 AND l.is_active = true ORDER BY l.name`,
      [enterpriseId]
    );
    const locations = result.rows.map((r: any) => ({
      ...this.mapRow(r),
      currentOccupancy: parseInt(r.actual_occupancy || '0'),
      children: [] as any[],
    }));

    // Build tree
    const map = new Map<string, any>(locations.map((l: any) => [l.id, l]));
    const tree: any[] = [];
    for (const loc of locations) {
      if (loc.parentLocationId && map.has(loc.parentLocationId)) {
        (map.get(loc.parentLocationId) as any).children.push(loc);
      } else {
        tree.push(loc);
      }
    }
    return tree;
  }

  private mapRow(row: any): Location {
    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      name: row.name,
      locationType: row.location_type,
      parentLocationId: row.parent_location_id,
      capacity: parseInt(row.capacity || '0'),
      currentOccupancy: parseInt(row.current_occupancy || '0'),
      area: row.area ? parseFloat(row.area) : undefined,
      areaUnit: row.area_unit,
      gpsLatitude: row.gps_latitude ? parseFloat(row.gps_latitude) : undefined,
      gpsLongitude: row.gps_longitude ? parseFloat(row.gps_longitude) : undefined,
      description: row.description,
      isActive: row.is_active,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      enterpriseName: row.enterprise_name,
      parentLocationName: row.parent_location_name,
    };
  }
}

export default new LocationService();
