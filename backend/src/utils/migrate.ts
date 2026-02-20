/**
 * Database Migration Runner
 *
 * A simple, file-based migration tool that:
 *  1. Creates a `_migrations` tracking table if it doesn't exist.
 *  2. Scans `backend/migrations/` for numbered SQL files (NNN_name.sql).
 *  3. Runs any un-applied migrations in order inside a transaction.
 *  4. Records each migration so it is never run twice.
 *
 * Usage:
 *   npx ts-node src/utils/migrate.ts              # run pending migrations
 *   npx ts-node src/utils/migrate.ts --status      # show migration status
 *   npx ts-node src/utils/migrate.ts --create NAME # scaffold a new migration
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// ── Config ────────────────────────────────────────────────────

const MIGRATION_DIR = path.resolve(__dirname, '..', '..', 'migrations');
const TRACKING_TABLE = '_migrations';

function getPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    database: process.env.DB_NAME || 'veterinary_consultation',
  });
}

// ── Helpers ───────────────────────────────────────────────────

async function ensureTrackingTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT name FROM ${TRACKING_TABLE} ORDER BY id`);
  return new Set(rows.map((r: any) => r.name));
}

function getMigrationFiles(): { name: string; path: string }[] {
  if (!fs.existsSync(MIGRATION_DIR)) {
    fs.mkdirSync(MIGRATION_DIR, { recursive: true });
  }
  return fs
    .readdirSync(MIGRATION_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({ name: f, path: path.join(MIGRATION_DIR, f) }));
}

// ── Commands ──────────────────────────────────────────────────

async function runMigrations() {
  const pool = getPool();
  try {
    await ensureTrackingTable(pool);
    const applied = await getAppliedMigrations(pool);
    const files = getMigrationFiles();
    const pending = files.filter(f => !applied.has(f.name));

    if (pending.length === 0) {
      console.log('✓ All migrations are up to date.');
      return;
    }

    console.log(`Running ${pending.length} pending migration(s)...\n`);

    for (const migration of pending) {
      const sql = fs.readFileSync(migration.path, 'utf-8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`,
          [migration.name]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${migration.name} — ROLLED BACK`);
        console.error(`    Error: ${(err as Error).message}`);
        process.exit(1);
      } finally {
        client.release();
      }
    }

    console.log(`\n✓ ${pending.length} migration(s) applied successfully.`);
  } finally {
    await pool.end();
  }
}

async function showStatus() {
  const pool = getPool();
  try {
    await ensureTrackingTable(pool);
    const applied = await getAppliedMigrations(pool);
    const files = getMigrationFiles();

    console.log('Migration Status:\n');
    if (files.length === 0) {
      console.log('  No migration files found.');
      return;
    }

    for (const file of files) {
      const status = applied.has(file.name) ? '✓ applied' : '○ pending';
      console.log(`  ${status}  ${file.name}`);
    }

    const pendingCount = files.filter(f => !applied.has(f.name)).length;
    console.log(`\n  ${files.length} total, ${files.length - pendingCount} applied, ${pendingCount} pending`);
  } finally {
    await pool.end();
  }
}

function createMigration(name: string) {
  if (!fs.existsSync(MIGRATION_DIR)) {
    fs.mkdirSync(MIGRATION_DIR, { recursive: true });
  }

  const files = getMigrationFiles();
  const nextNum = files.length > 0
    ? parseInt(files[files.length - 1].name.split('_')[0], 10) + 1
    : 1;

  const paddedNum = String(nextNum).padStart(3, '0');
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const fileName = `${paddedNum}_${safeName}.sql`;
  const filePath = path.join(MIGRATION_DIR, fileName);

  fs.writeFileSync(filePath, `-- Migration: ${fileName}\n-- Created: ${new Date().toISOString()}\n\n-- Write your SQL here\n`);
  console.log(`✓ Created migration: migrations/${fileName}`);
}

// ── CLI ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    await showStatus();
  } else if (args.includes('--create')) {
    const nameIdx = args.indexOf('--create') + 1;
    const name = args[nameIdx] || 'unnamed';
    createMigration(name);
  } else {
    await runMigrations();
  }
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
