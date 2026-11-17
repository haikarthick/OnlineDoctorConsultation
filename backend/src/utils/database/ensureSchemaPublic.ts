import { Pool } from 'pg';
import logger from '../logger';
import config from '../../config';
import * as fs from 'fs';
import * as path from 'path';

export async function ensureSchemaPublic(pool: Pool): Promise<void> {
    // ── Retirement switch ──
    // This whole mechanism is scheduled for removal: it is untracked, unversioned, runs on
    // every boot AFTER the migration runner, and has twice silently overwritten schema that a
    // migration established (see docs/VERIFICATION.md). It cannot simply be deleted, because
    // long-lived databases may still depend on objects only it creates.
    //
    // DISABLE_LEGACY_SELFHEAL=true turns it off. The runtime gate runs with it OFF by default
    // and green WITH it on, which is the evidence that docker/init.sql + backend/migrations
    // are self-sufficient for a FRESH database. Flip it on a real environment only after
    // confirming that environment's schema matches a freshly-built one.
    if (String(process.env.DISABLE_LEGACY_SELFHEAL).toLowerCase() === 'true') {
      logger.warn('Legacy schema self-heal SKIPPED (DISABLE_LEGACY_SELFHEAL=true) - ' +
        'schema is whatever init.sql + backend/migrations produced.');
      return;
    }

    const schemaName = config.database.schema || 'public';
    const client = await pool.connect();
    try {
      // 1. Ensure the schema itself exists (use public search_path for this DDL)
      if (schemaName !== 'public') {
        await client.query(`SET search_path TO public`);
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      }
      // 2. Set search_path so subsequent DDL lands in the correct schema
      await client.query(`SET search_path TO "${schemaName}", public`);

      // 3. Check if core tables exist (users + bookings = healthy schema)
      const check = await client.query(
        `SELECT
          EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users') AS has_users,
          EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'bookings') AS has_bookings`,
        [schemaName]
      );
      const { has_users, has_bookings } = check.rows[0];
      if (!has_users || !has_bookings) {
        logger.info(`Partial or missing schema (users=${has_users}, bookings=${has_bookings}) - running init.sql...`);
        const initSqlPath = path.join(__dirname, '../../../docker/init.sql');
        if (fs.existsSync(initSqlPath)) {
          const sql = fs.readFileSync(initSqlPath, 'utf8');
          // Use client.query (simple query protocol) - supports multi-statement SQL
          await client.query(sql);
          logger.info('Schema created/repaired successfully from init.sql');
        } else {
          logger.warn('init.sql not found at ' + initSqlPath + ' - skipping schema creation');
        }
      } else {
        logger.info('Database schema healthy (users + bookings found)');
      }
    } catch (error: any) {
      logger.error('Error ensuring schema', { error: error.message, schema: schemaName });
      throw error;
    } finally {
      client.release();
    }
}
