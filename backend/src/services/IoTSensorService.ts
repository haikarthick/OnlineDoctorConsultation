import database from '../utils/database';
import logger from '../utils/logger';

class IoTSensorService {

  // ─── Sensors ──────────────────────────────────────────────

  async listSensors(enterpriseId: string, filters: any = {}): Promise<any> {
    const conds = ['s.enterprise_id = $1'];
    const params: any[] = [enterpriseId];
    let idx = 2;

    if (filters.sensorType) { conds.push(`s.sensor_type = $${idx++}`); params.push(filters.sensorType); }
    if (filters.status) { conds.push(`s.status = $${idx++}`); params.push(filters.status); }
    if (filters.locationId) { conds.push(`s.location_id = $${idx++}`); params.push(filters.locationId); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 100, 1), 200));
    const result = await database.query(
      `SELECT s.*, l.name as location_name, a.name as animal_name
       FROM iot_sensors s
       LEFT JOIN locations l ON l.id = s.location_id
       LEFT JOIN animals a ON a.id = s.animal_id
       WHERE ${conds.join(' AND ')}
       ORDER BY s.created_at DESC
       LIMIT $${idx++}`,
      params
    );
    return { items: result.rows, total: result.rowCount };
  }

  async createSensor(data: any): Promise<any> {
    const result = await database.query(
      `INSERT INTO iot_sensors (enterprise_id, location_id, animal_id, sensor_type, sensor_name,
        serial_number, manufacturer, unit, min_threshold, max_threshold,
        reading_interval_seconds, status, battery_level, firmware_version, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [data.enterpriseId, data.locationId || null, data.animalId || null,
       data.sensorType, data.sensorName, data.serialNumber || null,
       data.manufacturer || null, data.unit || null,
       data.minThreshold ?? null, data.maxThreshold ?? null,
       data.readingIntervalSeconds || 300, data.status || 'active',
       data.batteryLevel ?? null, data.firmwareVersion || null,
       JSON.stringify(data.metadata || {})]
    );
    return result.rows[0];
  }

  async updateSensor(id: string, data: any): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      sensorName: 'sensor_name', sensorType: 'sensor_type', status: 'status',
      locationId: 'location_id', animalId: 'animal_id', minThreshold: 'min_threshold',
      maxThreshold: 'max_threshold', readingIntervalSeconds: 'reading_interval_seconds',
      batteryLevel: 'battery_level', firmwareVersion: 'firmware_version'
    };
    for (const [k, col] of Object.entries(fields)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(data[k]); }
    }
    if (!sets.length) return {};
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await database.query(
      `UPDATE iot_sensors SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0];
  }

  async deleteSensor(id: string): Promise<void> {
    await database.query(`DELETE FROM iot_sensors WHERE id = $1`, [id]);
  }

  // ─── Readings ─────────────────────────────────────────────

  async recordReading(data: any): Promise<any> {
    // Get sensor thresholds
    const sensor = await database.query(`SELECT * FROM iot_sensors WHERE id = $1`, [data.sensorId]);
    const s = sensor.rows[0];
    let isAnomaly = false;
    let anomalyType: string | null = null;

    if (s) {
      if (s.min_threshold != null && +data.value < +s.min_threshold) {
        isAnomaly = true; anomalyType = 'below_min';
      }
      if (s.max_threshold != null && +data.value > +s.max_threshold) {
        isAnomaly = true; anomalyType = 'above_max';
      }
      // Update last_reading_at on sensor
      await database.query(
        `UPDATE iot_sensors SET last_reading_at = NOW(), updated_at = NOW() WHERE id = $1`, [data.sensorId]
      );
    }

    const result = await database.query(
      `INSERT INTO sensor_readings (sensor_id, enterprise_id, value, unit, is_anomaly, anomaly_type, metadata, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, NOW())) RETURNING *`,
      [data.sensorId, data.enterpriseId, data.value, data.unit || s?.unit || null,
       isAnomaly, anomalyType, JSON.stringify(data.metadata || {}), data.recordedAt || null]
    );
    return result.rows[0];
  }

  async listReadings(sensorId: string, filters: any = {}): Promise<any> {
    const conds = ['sr.sensor_id = $1'];
    const params: any[] = [sensorId];
    let idx = 2;

    if (filters.from) { conds.push(`sr.recorded_at >= $${idx++}`); params.push(filters.from); }
    if (filters.to) { conds.push(`sr.recorded_at <= $${idx++}`); params.push(filters.to); }
    if (filters.anomalyOnly) { conds.push(`sr.is_anomaly = true`); }

    params.push(Math.min(Math.max(parseInt(filters.limit) || 200, 1), 500));
    const result = await database.query(
      `SELECT sr.* FROM sensor_readings sr WHERE ${conds.join(' AND ')}
       ORDER BY sr.recorded_at DESC LIMIT $${idx++}`, params
    );
    return { items: result.rows, total: result.rowCount };
  }

  /** Real-time telemetry dashboard */
  async getSensorDashboard(enterpriseId: string): Promise<any> {
    // Sensor status summary
    const statusSummary = await database.query(
      `SELECT status, COUNT(*) as count FROM iot_sensors WHERE enterprise_id = $1 GROUP BY status`, [enterpriseId]
    );

    // Sensors by type
    const byType = await database.query(
      `SELECT sensor_type, COUNT(*) as count FROM iot_sensors WHERE enterprise_id = $1 GROUP BY sensor_type ORDER BY count DESC`, [enterpriseId]
    );

    // Recent anomalies
    const anomalies = await database.query(
      `SELECT sr.*, s.sensor_name, s.sensor_type, s.unit as sensor_unit
       FROM sensor_readings sr JOIN iot_sensors s ON s.id = sr.sensor_id
       WHERE sr.enterprise_id = $1 AND sr.is_anomaly = true
       ORDER BY sr.recorded_at DESC LIMIT 20`, [enterpriseId]
    );

    // Low battery sensors
    const lowBattery = await database.query(
      `SELECT id, sensor_name, sensor_type, battery_level FROM iot_sensors
       WHERE enterprise_id = $1 AND battery_level IS NOT NULL AND battery_level < 20
       ORDER BY battery_level ASC`, [enterpriseId]
    );

    // Average readings by sensor type (last 24 hrs)
    const avgReadings = await database.query(
      `SELECT s.sensor_type, AVG(sr.value) as avg_val, MIN(sr.value) as min_val, MAX(sr.value) as max_val, COUNT(*) as readings
       FROM sensor_readings sr JOIN iot_sensors s ON s.id = sr.sensor_id
       WHERE sr.enterprise_id = $1 AND sr.recorded_at > NOW() - INTERVAL '24 hours'
       GROUP BY s.sensor_type`, [enterpriseId]
    );

    return {
      statusSummary: statusSummary.rows,
      byType: byType.rows,
      recentAnomalies: anomalies.rows,
      lowBatterySensors: lowBattery.rows,
      avgReadings24h: avgReadings.rows,
      summary: {
        totalSensors: statusSummary.rows.reduce((s: number, r: any) => s + +r.count, 0),
        activeSensors: statusSummary.rows.find((r: any) => r.status === 'active')?.count || 0,
        anomaliesLast24h: anomalies.rows.length
      }
    };
  }
}

export default new IoTSensorService();
