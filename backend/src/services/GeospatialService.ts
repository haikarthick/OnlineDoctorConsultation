/**
 * Geospatial Analytics & Geofencing Service
 * Interactive geofence zones, movement heatmaps, proximity alerts,
 * and location-based event tracking with clustering.
 */
import pool from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

class GeospatialService {

  // ── Geofence Zones ──
  async listZones(enterpriseId: string, filters: any = {}) {
    const { status, zoneType, limit = 100, offset = 0 } = filters;
    let query = `SELECT gz.*, u.first_name || ' ' || u.last_name as creator_name,
                 (SELECT COUNT(*) FROM geospatial_events WHERE zone_id = gz.id) as event_count
                 FROM geofence_zones gz LEFT JOIN users u ON gz.created_by = u.id
                 WHERE gz.enterprise_id = $1`;
    const params: any[] = [enterpriseId]; let idx = 2;
    if (status) { query += ` AND gz.status = $${idx++}`; params.push(status); }
    if (zoneType) { query += ` AND gz.zone_type = $${idx++}`; params.push(zoneType); }
    query += ` ORDER BY gz.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async createZone(data: any) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO geofence_zones (id, enterprise_id, name, zone_type, center_lat, center_lng, radius_meters, polygon_coords, color, alert_on_entry, alert_on_exit, is_restricted, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, data.enterpriseId, data.name, data.zoneType || 'boundary',
       data.centerLat || null, data.centerLng || null, data.radiusMeters || null,
       JSON.stringify(data.polygonCoords || []), data.color || '#3b82f6',
       data.alertOnEntry || false, data.alertOnExit || true, data.isRestricted || false,
       data.createdBy || null]
    );
    return (await pool.query('SELECT * FROM geofence_zones WHERE id = $1', [id])).rows[0];
  }

  async updateZone(id: string, data: any) {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    for (const field of ['name', 'zone_type', 'center_lat', 'center_lng', 'radius_meters', 'color', 'alert_on_entry', 'alert_on_exit', 'is_restricted', 'status']) {
      const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (data[camel] !== undefined) { sets.push(`${field} = $${idx++}`); vals.push(data[camel]); }
      else if (data[field] !== undefined) { sets.push(`${field} = $${idx++}`); vals.push(data[field]); }
    }
    if (data.polygonCoords) { sets.push(`polygon_coords = $${idx++}`); vals.push(JSON.stringify(data.polygonCoords)); }
    sets.push('updated_at = NOW()'); vals.push(id);
    await pool.query(`UPDATE geofence_zones SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    return (await pool.query('SELECT * FROM geofence_zones WHERE id = $1', [id])).rows[0];
  }

  async deleteZone(id: string) {
    await pool.query('DELETE FROM geofence_zones WHERE id = $1', [id]);
  }

  // ── Geospatial Events ──
  async listEvents(enterpriseId: string, filters: any = {}) {
    const { zoneId, animalId, eventType, since, limit = 200, offset = 0 } = filters;
    let query = `SELECT ge.*, gz.name as zone_name, a.name as animal_name
                 FROM geospatial_events ge
                 LEFT JOIN geofence_zones gz ON ge.zone_id = gz.id
                 LEFT JOIN animals a ON ge.animal_id = a.id
                 WHERE ge.enterprise_id = $1`;
    const params: any[] = [enterpriseId]; let idx = 2;
    if (zoneId) { query += ` AND ge.zone_id = $${idx++}`; params.push(zoneId); }
    if (animalId) { query += ` AND ge.animal_id = $${idx++}`; params.push(animalId); }
    if (eventType) { query += ` AND ge.event_type = $${idx++}`; params.push(eventType); }
    if (since) { query += ` AND ge.created_at >= $${idx++}`; params.push(since); }
    query += ` ORDER BY ge.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async createEvent(data: any) {
    const id = uuidv4();

    // Auto-detect zone breach
    let zoneId = data.zoneId || null;
    let eventType = data.eventType || 'location_update';

    if (!zoneId && data.latitude && data.longitude) {
      // Check if location falls within any geofence zone (simple radius check)
      const zones = await pool.query(
        `SELECT * FROM geofence_zones WHERE enterprise_id = $1 AND status = 'active' AND center_lat IS NOT NULL AND center_lng IS NOT NULL AND radius_meters IS NOT NULL`,
        [data.enterpriseId]
      );
      for (const zone of zones.rows) {
        const dist = this.haversineDistance(+data.latitude, +data.longitude, +zone.center_lat, +zone.center_lng);
        if (dist <= +zone.radius_meters) {
          zoneId = zone.id;
          break;
        } else if (dist <= +zone.radius_meters * 1.1) {
          // Near zone boundary
          zoneId = zone.id;
          eventType = 'proximity_alert';
        }
      }
    }

    await pool.query(
      `INSERT INTO geospatial_events (id, enterprise_id, zone_id, animal_id, sensor_id, event_type, latitude, longitude, altitude, accuracy_meters, speed_kmh, heading, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, data.enterpriseId, zoneId, data.animalId || null, data.sensorId || null,
       eventType, data.latitude, data.longitude, data.altitude || null,
       data.accuracyMeters || null, data.speedKmh || null, data.heading || null,
       JSON.stringify(data.metadata || {})]
    );
    return (await pool.query('SELECT ge.*, gz.name as zone_name, a.name as animal_name FROM geospatial_events ge LEFT JOIN geofence_zones gz ON ge.zone_id = gz.id LEFT JOIN animals a ON ge.animal_id = a.id WHERE ge.id = $1', [id])).rows[0];
  }

  // ── Heatmap Data ──
  async getHeatmapData(enterpriseId: string, filters: any = {}) {
    const { hours = 24 } = filters;
    const result = await pool.query(
      `SELECT latitude, longitude, COUNT(*) as event_count, MAX(created_at) as latest
       FROM geospatial_events WHERE enterprise_id = $1 AND created_at >= NOW() - $2::INTERVAL
       GROUP BY ROUND(latitude::numeric, 3), ROUND(longitude::numeric, 3), latitude, longitude
       ORDER BY event_count DESC LIMIT 500`,
      [enterpriseId, `${hours} hours`]
    );
    return { points: result.rows, period: `${hours}h`, totalPoints: result.rows.length };
  }

  // ── Movement Trail ──
  async getMovementTrail(animalId: string, filters: any = {}) {
    const { hours = 24 } = filters;
    const result = await pool.query(
      `SELECT latitude, longitude, speed_kmh, heading, created_at, event_type, gz.name as zone_name
       FROM geospatial_events ge LEFT JOIN geofence_zones gz ON ge.zone_id = gz.id
       WHERE ge.animal_id = $1 AND ge.created_at >= NOW() - $2::INTERVAL
       ORDER BY ge.created_at ASC`,
      [animalId, `${hours} hours`]
    );
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < result.rows.length; i++) {
      totalDistance += this.haversineDistance(
        +result.rows[i - 1].latitude, +result.rows[i - 1].longitude,
        +result.rows[i].latitude, +result.rows[i].longitude
      );
    }
    return { trail: result.rows, totalDistanceMeters: Math.round(totalDistance), points: result.rows.length };
  }

  // ── Dashboard ──
  async getDashboard(enterpriseId: string) {
    const [zoneSummary, recentEvents, eventTypes, animalLocations] = await Promise.all([
      pool.query(`SELECT gz.id, gz.name, gz.zone_type, gz.status, gz.is_restricted, gz.color,
                  (SELECT COUNT(*) FROM geospatial_events WHERE zone_id = gz.id AND created_at >= NOW() - INTERVAL '24 hours') as events_24h
                  FROM geofence_zones gz WHERE gz.enterprise_id = $1 ORDER BY events_24h DESC`, [enterpriseId]),
      pool.query(`SELECT ge.*, gz.name as zone_name, a.name as animal_name
                  FROM geospatial_events ge LEFT JOIN geofence_zones gz ON ge.zone_id = gz.id LEFT JOIN animals a ON ge.animal_id = a.id
                  WHERE ge.enterprise_id = $1 ORDER BY ge.created_at DESC LIMIT 10`, [enterpriseId]),
      pool.query(`SELECT event_type, COUNT(*) as count FROM geospatial_events WHERE enterprise_id = $1 AND created_at >= NOW() - INTERVAL '24 hours' GROUP BY event_type ORDER BY count DESC`, [enterpriseId]),
      pool.query(`SELECT DISTINCT ON (ge.animal_id) ge.animal_id, a.name as animal_name, a.species,
                  ge.latitude, ge.longitude, ge.speed_kmh, ge.created_at
                  FROM geospatial_events ge JOIN animals a ON ge.animal_id = a.id
                  WHERE ge.enterprise_id = $1 AND ge.animal_id IS NOT NULL
                  ORDER BY ge.animal_id, ge.created_at DESC`, [enterpriseId]),
    ]);

    return {
      summary: {
        totalZones: zoneSummary.rows.length,
        activeZones: zoneSummary.rows.filter((z: any) => z.status === 'active').length,
        restrictedZones: zoneSummary.rows.filter((z: any) => z.is_restricted).length,
        events24h: eventTypes.rows.reduce((s: number, r: any) => s + +r.count, 0),
        trackedAnimals: animalLocations.rows.length,
      },
      zones: zoneSummary.rows,
      recentEvents: recentEvents.rows,
      eventTypes: eventTypes.rows,
      animalLocations: animalLocations.rows,
    };
  }

  // ── Haversine Distance (meters) ──
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export default new GeospatialService();
