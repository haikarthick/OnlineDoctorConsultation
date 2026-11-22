/**
 * Schema contract: the running database must contain every column/table the migration files
 * promise, or the deploy is not healthy.
 *
 * Why this exists (2026-11-19): migration 053 added marketplace_listings.state. The code that
 * writes it shipped and started, but the database never got the column - the deploy script
 * tolerates "could not reach DB / timed out" migration runs, and the in-process runner looked in
 * the wrong folder - so every farmer who finished the Sell form got a raw SQL error, while
 * /health still said "healthy". tsc, tests and the local runtime check could not see it because
 * they all run against a freshly built database.
 *
 * Now, on every boot after migrations: read the migration files, list the columns/tables they
 * create, compare with information_schema, re-apply any missing idempotent statement, and expose
 * what is still missing through /health (which CI's post-deploy check fails on).
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../logger';

export interface ContractColumn { table: string; column: string; statement: string; file: string }
export interface ContractResult {
  checkedAt: string;
  columnsChecked: number;
  tablesChecked: number;
  missingColumns: string[];
  missingTables: string[];
  healed: string[];
}

/** backend/migrations from both ts-node (src/utils/database) and compiled (dist/utils/database). */
export function findMigrationsDir(): string | null {
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'migrations'),
    path.join(__dirname, '..', '..', 'migrations'),
    path.join(process.cwd(), 'migrations'),
    path.join(process.cwd(), 'backend', 'migrations'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

const ADD_COLUMN_RE = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"?(\w+)"?[^;]*;/gi;
const CREATE_TABLE_RE = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?"?(\w+)"?/gi;
const DROP_COLUMN_RE = /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi;

export function parseContract(files: { name: string; sql: string }[]): { columns: ContractColumn[]; tables: string[] } {
  const columns = new Map<string, ContractColumn>();
  const tables = new Set<string>();
  const dropped = new Set<string>();
  for (const f of files) {
    const sql = f.sql.replace(/--[^\n]*/g, '');
    let m: RegExpExecArray | null;
    ADD_COLUMN_RE.lastIndex = 0; CREATE_TABLE_RE.lastIndex = 0; DROP_COLUMN_RE.lastIndex = 0;
    while ((m = ADD_COLUMN_RE.exec(sql))) {
      columns.set(`${m[1]}.${m[2]}`.toLowerCase(), { table: m[1].toLowerCase(), column: m[2].toLowerCase(), statement: m[0], file: f.name });
    }
    while ((m = CREATE_TABLE_RE.exec(sql))) tables.add(m[1].toLowerCase());
    while ((m = DROP_COLUMN_RE.exec(sql))) dropped.add(m[1].toLowerCase());
  }
  // A later migration may drop a column an earlier one added - never "heal" those back.
  const live = [...columns.values()].filter(c => !dropped.has(c.column));
  return { columns: live, tables: [...tables] };
}

let lastResult: ContractResult | null = null;
export function getSchemaContractResult(): ContractResult | null { return lastResult; }

export async function checkSchemaContract(pool: Pool, opts: { heal?: boolean } = {}): Promise<ContractResult> {
  const result: ContractResult = {
    checkedAt: new Date().toISOString(), columnsChecked: 0, tablesChecked: 0,
    missingColumns: [], missingTables: [], healed: [],
  };
  const dir = findMigrationsDir();
  if (!dir) {
    logger.warn('Schema contract: migrations folder not found - cannot verify the database against it');
    result.missingTables.push('(migrations folder not found)');
    lastResult = result;
    return result;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    .map(name => ({ name, sql: fs.readFileSync(path.join(dir, name), 'utf-8') }));
  const { columns, tables } = parseContract(files);
  result.columnsChecked = columns.length;
  result.tablesChecked = tables.length;

  const client = await pool.connect();
  try {
    const cols = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()`);
    const have = new Set(cols.rows.map((r: any) => `${r.table_name}.${r.column_name}`.toLowerCase()));
    const haveTables = new Set(cols.rows.map((r: any) => String(r.table_name).toLowerCase()));

    // A table that a migration creates but which is missing: only report (re-creating a whole
    // table out of order could hide a worse problem) - the boot self-heal/init.sql owns that.
    result.missingTables = tables.filter(t => !haveTables.has(t));
    const missing = columns.filter(c => haveTables.has(c.table) && !have.has(`${c.table}.${c.column}`));

    if (opts.heal !== false) {
      for (const c of missing) {
        try {
          await client.query(c.statement);
          result.healed.push(`${c.table}.${c.column}`);
          logger.warn(`Schema contract: re-applied missing column ${c.table}.${c.column} (from ${c.file})`);
        } catch (e: any) {
          logger.error(`Schema contract: could not add ${c.table}.${c.column}: ${e.message}`);
        }
      }
      if (missing.length) {
        const again = await client.query(
          `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()`);
        const have2 = new Set(again.rows.map((r: any) => `${r.table_name}.${r.column_name}`.toLowerCase()));
        result.missingColumns = missing.filter(c => !have2.has(`${c.table}.${c.column}`)).map(c => `${c.table}.${c.column}`);
      }
    } else {
      result.missingColumns = missing.map(c => `${c.table}.${c.column}`);
    }
  } finally {
    client.release();
  }
  if (result.missingColumns.length || result.missingTables.length) {
    logger.error('Schema contract BROKEN - database is missing what the migrations promise', {
      missingColumns: result.missingColumns, missingTables: result.missingTables,
    });
  } else {
    logger.info(`Schema contract OK (${result.columnsChecked} columns, ${result.tablesChecked} tables)${result.healed.length ? `; healed ${result.healed.length}` : ''}`);
  }
  lastResult = result;
  return result;
}
