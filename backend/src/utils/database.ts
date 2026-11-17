import { Pool, types } from 'pg';
import config from '../config';
import logger from './logger';
import PermissionService from '../services/PermissionService';
import NetworkRolePermissionService from '../services/NetworkRolePermissionService';
import RefreshTokenService from '../services/RefreshTokenService';
import VetHospitalService from '../services/VetHospitalService';
import { describeParams } from './database/helpers';
import { runSQLMigrations } from './database/runSQLMigrations';
import { ensureSchemaPublic } from './database/ensureSchemaPublic';
import { repairSchema as repairSchemaImpl } from './database/repairSchema';
import { phase1GeneralSafetyNets } from './database/seed/phase1GeneralSafetyNets';
import { phase2AnimalsAndMore } from './database/seed/phase2AnimalsAndMore';
import { phase3NetworkSubscriptions } from './database/seed/phase3NetworkSubscriptions';
import { phase4Pharmacy } from './database/seed/phase4Pharmacy';
import { phase5PharmacyBillingAndPasswordReset } from './database/seed/phase5PharmacyBillingAndPasswordReset';
import { syncBookingStatuses as syncBookingStatusesImpl } from './database/syncBookingStatuses';

// ── Fix node-postgres: NUMERIC/DECIMAL columns return as strings by default ──
// OID 1700 = NUMERIC/DECIMAL → parse to float
types.setTypeParser(1700, (val: string) => parseFloat(val));
// OID 700 = FLOAT4, 701 = FLOAT8 (already returns as number but be safe)
types.setTypeParser(700, (val: string) => parseFloat(val));
types.setTypeParser(701, (val: string) => parseFloat(val));

/**
 * The legacy self-heal (connect() below) runs a sequence of idempotent DDL "safety net"
 * operations on every boot - split 2026-11-13 into database/{helpers,constants,
 * runSQLMigrations,ensureSchemaPublic,repairSchema,ensurePaymentModuleSchema,
 * syncBookingStatuses}.ts and database/seed/phase{1-5}*.ts, since this file used to be a single
 * ~2,100-line class with one ~1,390-line method. Every extracted function takes the pool as an
 * explicit parameter instead of using `this` - zero logic change, verified by recombining the
 * extracted seed-phase ranges and diffing byte-for-byte against the original before this file
 * was rewritten, then the full RUN_RUNTIME_VERIFY=1 gate (real Postgres, real server boot).
 *
 * The anti-drift constants (SYSTEM_ROLES, INVOICE_TYPES, PAYMENT_SOURCES, PAYMENT_STATUSES,
 * BOOKING_STATUSES, BOOKING_TYPES - see database/constants.ts) are the single most
 * incident-linked part of this file (groomer registration bug, grooming GST invoice bug) -
 * moved with their original comments intact, not summarized.
 *
 * connect() below calls the extracted pieces in the EXACT original order - that order is not
 * arbitrary (e.g. enterprise tables before vet_certificates' FK to them; CHECK constraints
 * rebuilt only after every table referencing them exists).
 */
class PostgresDatabase {
  private pool: Pool;

  constructor() {
    // Use DATABASE_URL (Render.com) when available, else individual params
    const schemaOpt = config.database.schema && config.database.schema !== 'public'
      ? `-c search_path=${config.database.schema},public`
      : undefined;
    const poolConfig = config.database.connectionString
      ? {
          connectionString: config.database.connectionString,
          ssl: config.database.ssl || undefined,
          max: config.database.pool.max,
          min: config.database.pool.min,
          idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
          connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
          maxUses: config.database.pool.maxUses,
          ...(schemaOpt ? { options: schemaOpt } : {}),
        }
      : {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.database,
          max: config.database.pool.max,
          min: config.database.pool.min,
          idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
          connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
          maxUses: config.database.pool.maxUses,
          ...(schemaOpt ? { options: schemaOpt } : {}),
        };
    this.pool = new Pool(poolConfig);

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
      try { await ensureSchemaPublic(this.pool); } catch (e: any) { logger.warn('ensureSchema failed', { error: e.message }); }

      // Apply any pending backend/migrations/*.sql files using the server's own pool
      // (correct search_path, connection timeout, proper error handling)
      await runSQLMigrations(this.pool);

      // Ensure default system settings exist
      try {
        await phase1GeneralSafetyNets(this.pool);
        await phase2AnimalsAndMore(this.pool);
        await phase3NetworkSubscriptions(this.pool);
        await phase4Pharmacy(this.pool);
        await phase5PharmacyBillingAndPasswordReset(this.pool);
      } catch (e: any) { logger.warn('seedDefaultSettings failed', { error: e.message }); }

      // Sync stale booking statuses with completed consultations
      await syncBookingStatusesImpl(this.pool);

      // Ensure RBAC permission table and seed defaults
      try { await PermissionService.ensureTable(); } catch (e: any) { logger.warn('PermissionService.ensureTable failed', { error: e.message }); }
      try { await PermissionService.seedDefaults(); } catch (e: any) { logger.warn('PermissionService.seedDefaults failed', { error: e.message }); }

      // Ensure network role permissions table (network-scoped, no global seed needed)
      try { await NetworkRolePermissionService.ensureTable(); } catch (e: any) { logger.warn('NetworkRolePermissionService.ensureTable failed', { error: e.message }); }

      // Ensure refresh tokens table
      try { await RefreshTokenService.ensureTable(); } catch (e: any) { logger.warn('RefreshTokenService.ensureTable failed', { error: e.message }); }

      // Ensure vet hospital tables
      try { await VetHospitalService.ensureTables(); } catch (e: any) { logger.warn('VetHospitalService.ensureTables failed', { error: e.message }); }
    } catch (error: any) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
      throw error;
    }
  }

  async repairSchema(): Promise<{ success: boolean; created: boolean; statements: number; errors: string[] }> {
    return repairSchemaImpl(this.pool);
  }

  // Public - AuthController calls this directly as a self-heal retry when a request fails
  // because a table is missing, not just from connect() above.
  async ensureSchemaPublic(): Promise<void> {
    return ensureSchemaPublic(this.pool);
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
        logger.warn('Slow query detected', { query: text.substring(0, 100), duration, paramCount: params?.length ?? 0 });
      }
      return result;
    } catch (error: any) {
      logger.error('Database query error', { query: text.substring(0, 200), error: error.message, paramTypes: describeParams(params) });
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
