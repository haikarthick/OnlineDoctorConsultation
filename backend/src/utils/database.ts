import { Pool } from 'pg';
import config from '../config';
import logger from './logger';
import * as fs from 'fs';
import * as path from 'path';
import PermissionService from '../services/PermissionService';
import RefreshTokenService from '../services/RefreshTokenService';

class PostgresDatabase {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      max: config.database.pool.max,
      min: config.database.pool.min,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected idle client error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      logger.info(`PostgreSQL connected successfully at ${config.database.host}:${config.database.port}/${config.database.database}`, {
        serverTime: result.rows[0].now,
      });

      // Run schema if tables don't exist
      await this.ensureSchema();

      // Ensure default system settings exist
      await this.seedDefaultSettings();

      // Sync stale booking statuses with completed consultations
      await this.syncBookingStatuses();

      // Ensure RBAC permission table and seed defaults
      await PermissionService.ensureTable();
      await PermissionService.seedDefaults();

      // Ensure refresh tokens table
      await RefreshTokenService.ensureTable();
    } catch (error: any) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
      throw error;
    }
  }

  private async ensureSchema(): Promise<void> {
    try {
      // Check if the users table exists
      const check = await this.pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')`
      );
      if (!check.rows[0].exists) {
        logger.info('Tables not found — running init.sql schema...');
        const initSqlPath = path.join(__dirname, '../../../docker/init.sql');
        if (fs.existsSync(initSqlPath)) {
          const sql = fs.readFileSync(initSqlPath, 'utf8');
          await this.pool.query(sql);
          logger.info('Schema created successfully from init.sql');
        } else {
          logger.warn('init.sql not found at ' + initSqlPath + ' — skipping schema creation');
        }
      } else {
        logger.info('Database schema already exists');
      }
    } catch (error: any) {
      logger.error('Error ensuring schema', { error: error.message });
      throw error;
    }
  }

  private async seedDefaultSettings(): Promise<void> {
    const defaults = [
      { key: 'display.timeFormat', value: '12h', category: 'display', description: 'Time display format: 12h (AM/PM) or 24h' },
      { key: 'display.dateFormat', value: 'MMM d, yyyy', category: 'display', description: 'Date display format' },
      { key: 'consultation.joinWindowMinutes', value: '5', category: 'consultation', description: 'Minutes before scheduled time when Join/Start button becomes available' },
    ];
    for (const d of defaults) {
      await this.pool.query(
        `INSERT INTO system_settings (id, key, value, category, description)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [d.key, d.value, d.category, d.description]
      );
    }
    logger.info('Default system settings seeded');
  }

  private async syncBookingStatuses(): Promise<void> {
    try {
      const result = await this.pool.query(
        `UPDATE bookings SET status = 'completed', updated_at = NOW()
         WHERE consultation_id IN (SELECT id FROM consultations WHERE status = 'completed')
         AND status != 'completed'`
      );
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Synced ${result.rowCount} booking(s) to completed status`);
      }
    } catch (error: any) {
      logger.warn('Failed to sync booking statuses', { error: error.message });
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('PostgreSQL pool disconnected');
    } catch (error: any) {
      logger.error('Error disconnecting from PostgreSQL', { error: error.message });
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn('Slow query detected', { query: text.substring(0, 100), duration, params });
      }
      return result;
    } catch (error: any) {
      logger.error('Database query error', { query: text.substring(0, 200), error: error.message, params });
      throw error;
    }
  }

  async transaction(callback: (client: any) => Promise<any>): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}

// Always use real PostgreSQL
const database = new PostgresDatabase();
export default database;
