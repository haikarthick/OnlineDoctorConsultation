import { Pool } from 'pg';
import config from '../../config';
import * as fs from 'fs';
import * as path from 'path';

import { splitSqlStatements } from './helpers';

export async function repairSchema(pool: Pool): Promise<{ success: boolean; created: boolean; statements: number; errors: string[] }> {
    const schemaName = config.database.schema || 'public';
    const errors: string[] = [];
    let statementsRun = 0;
    let created = false;

    const client = await pool.connect();
    try {
      // Always set search_path with public first so CREATE SCHEMA works
      await client.query(`SET search_path TO public`);
      if (schemaName !== 'public') {
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      }
      await client.query(`SET search_path TO "${schemaName}", public`);

      const initSqlPath = path.join(__dirname, '../../../docker/init.sql');
      if (!fs.existsSync(initSqlPath)) {
        errors.push('init.sql not found at: ' + initSqlPath);
        return { success: false, created: false, statements: 0, errors };
      }

      const sql = fs.readFileSync(initSqlPath, 'utf8');
      // Split statements respecting dollar-quoted function bodies
      const stmts = splitSqlStatements(sql);
      for (const stmt of stmts) {
        try {
          await client.query(stmt);
          statementsRun++;
        } catch (e: any) {
          // Ignore "already exists" errors - those are fine for IF NOT EXISTS statements
          if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
            errors.push(`[stmt ${statementsRun + 1}] ${e.message}`);
          }
          statementsRun++;
        }
      }

      // Verify users table was created
      const check = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'users')`,
        [schemaName]
      );
      created = check.rows[0].exists === true;
      return { success: created, created, statements: statementsRun, errors };
    } finally {
      client.release();
    }
}
