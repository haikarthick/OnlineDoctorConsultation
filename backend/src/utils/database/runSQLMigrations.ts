import { Pool } from 'pg';
import logger from '../logger';
import * as fs from 'fs';
import * as path from 'path';

export async function runSQLMigrations(pool: Pool): Promise<void> {
    try {
      const migDir = path.join(__dirname, '..', '..', 'migrations');
      if (!fs.existsSync(migDir)) {
        logger.info('No migrations directory - skipping SQL migration runner');
        return;
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      const { rows } = await pool.query(`SELECT name FROM _migrations ORDER BY id`);
      const applied = new Set(rows.map((r: any) => r.name));

      const pending = fs.readdirSync(migDir)
        .filter(f => f.endsWith('.sql'))
        .sort()
        .filter(f => !applied.has(f));

      if (pending.length === 0) {
        logger.info('SQL migrations: all up to date');
        return;
      }

      logger.info(`SQL migrations: applying ${pending.length} pending file(s)...`);
      const failed: string[] = [];
      for (const file of pending) {
        const sql = fs.readFileSync(path.join(migDir, file), 'utf-8');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
          await client.query('COMMIT');
          logger.info(`  ✓ Migration applied: ${file}`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          logger.error(`  ✗ Migration failed (${file}): ${err.message}`);
          failed.push(file);
        } finally {
          client.release();
        }
      }
      // This runner deliberately never throws - the server has already bound its
      // port by the time it runs (see index.ts's startServer), and that process is
      // designed to stay up and self-heal rather than crash over a DB issue once
      // live. The actual deploy gate is render-start.sh's separate, earlier
      // `node dist/utils/migrate.js` step, which DOES abort the deploy on a
      // genuine migration failure (MIGRATIONS_FAIL_FAST, default true) - by the
      // time this in-process runner executes, `pending` should normally be empty.
      // This aggregate line exists so a failure here (e.g. this runner disagreeing
      // with the CLI runner about pending state) is impossible to miss in logs.
      if (failed.length > 0) {
        logger.error(
          `SQL migrations: ${failed.length}/${pending.length} FAILED - server is running with a partially-migrated schema`,
          { failed }
        );
      } else {
        logger.info(`SQL migrations: ${pending.length} applied successfully`);
      }
    } catch (error: any) {
      logger.warn('SQL migration runner error', { error: error.message });
    }
}
