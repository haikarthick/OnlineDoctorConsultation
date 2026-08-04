#!/usr/bin/env node
/**
 * VetCare - New Database Bootstrap Script
 * Runs: schema creation → init.sql → migrations → seed demo data
 * Usage: node setup-new-db.js <EXTERNAL_DATABASE_URL>
 *        (Run from the project root folder)
 * Example:
 *   node setup-new-db.js "postgresql://postgresdbapril_user:PASSWORD@dpg-xxx.oregon-postgres.render.com/postgresdbapril"
 *
 * ⚠  Run with: cd backend && node ../setup-new-db.js "..."
 *    (pg module is in backend/node_modules)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error('\n❌  Usage: node setup-new-db.js "<EXTERNAL_DATABASE_URL>"\n');
  process.exit(1);
}

// Schemas to set up - one for DEV, one for PROD
const SCHEMAS = ['vetcare_dev', 'vetcare_prod'];

const MIGRATIONS_DIR = path.join(__dirname, 'backend', 'src', 'utils');
const INIT_SQL      = path.join(__dirname, 'docker', 'init.sql');
const SEED_SQL      = path.join(__dirname, 'docker', 'seed-demo-data.sql');

async function runSQL(client, sql, label) {
  try {
    await client.query(sql);
    console.log(`  ✔ ${label}`);
  } catch (e) {
    // Many init.sql statements are CREATE TABLE IF NOT EXISTS - warnings are safe
    if (e.message.includes('already exists') || e.code === '42P07' || e.code === '42710') {
      console.log(`  ⚠  ${label} - object already exists (safe to ignore)`);
    } else {
      console.error(`  ✗ ${label} FAILED: ${e.message}`);
      throw e;
    }
  }
}

async function setupSchema(pool, schema) {
  const client = await pool.connect();
  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Schema: ${schema}`);
    console.log('─'.repeat(60));

    // 1. Create schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`  ✔ Schema "${schema}" created/verified`);

    // 2. Set search path
    await client.query(`SET search_path TO "${schema}", public`);

    // 3. Run init.sql
    console.log('\n  ── Running init.sql ──');
    const initSQL = fs.readFileSync(INIT_SQL, 'utf8');
    // Split on semicolons but skip empty statements
    const statements = initSQL
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let ok = 0, warn = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        ok++;
      } catch (e) {
        if (e.code === '42P07' || e.code === '42710' || e.code === '42701' || e.message.includes('already exists')) {
          warn++;
        } else {
          console.warn(`  ⚠  Statement warning: ${e.message.substring(0, 100)}`);
          warn++;
        }
      }
    }
    console.log(`  ✔ init.sql - ${ok} statements OK, ${warn} skipped (already exist)`);

    // 4. Check if demo data already exists
    let vetCount = 0;
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM "${schema}".vet_profiles`);
      vetCount = r.rows[0].c;
    } catch (_) { vetCount = 0; }

    if (vetCount === 0) {
      console.log('\n  ── Seeding demo data ──');
      const seedSQL = fs.readFileSync(SEED_SQL, 'utf8');
      // Run entire seed as one block (it uses DO $$ blocks)
      try {
        await client.query(`SET search_path TO "${schema}", public`);
        const seedStatements = seedSQL
          .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        let seedOk = 0, seedWarn = 0;
        for (const stmt of seedStatements) {
          try {
            await client.query(stmt);
            seedOk++;
          } catch (e) {
            seedWarn++;
            // Don't log individual seed warnings - they're usually duplicate key on re-seed
          }
        }
        console.log(`  ✔ Demo data seeded - ${seedOk} statements OK, ${seedWarn} skipped`);
      } catch (e) {
        console.warn(`  ⚠  Seed warning: ${e.message}`);
      }
    } else {
      console.log(`  ✔ Demo data already present (${vetCount} vet profiles) - skipping seed`);
    }

    console.log(`\n  ✅  Schema "${schema}" fully ready`);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('  VetCare - Database Bootstrap');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`  Target DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  console.log(`  Schemas to set up: ${SCHEMAS.join(', ')}\n`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15000,
  });

  // Test connection first
  try {
    const client = await pool.connect();
    const r = await client.query('SELECT NOW() as now, version()');
    console.log(`  ✔ Connected to PostgreSQL`);
    console.log(`    Time: ${r.rows[0].now}`);
    console.log(`    Version: ${r.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    client.release();
  } catch (e) {
    console.error(`\n  ❌  Connection FAILED: ${e.message}`);
    console.error('  Check that the External Database URL is correct and the DB is available.\n');
    process.exit(1);
  }

  // Set up each schema
  for (const schema of SCHEMAS) {
    await setupSchema(pool, schema);
  }

  await pool.end();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('  ✅  Database setup complete!');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log('Next steps - update these env vars in Render dashboard:\n');
  console.log('  For BOTH web services (vetcare-dev and vetcare-app):');
  const internalUrl = DATABASE_URL.replace(/\.(oregon|frankfurt|singapore|ohio)-postgres\.render\.com/, '');
  console.log(`  DATABASE_URL = ${internalUrl.replace(/:([^:@]+)@/, ':***@')}`);
  console.log('  (use the Internal Database URL from Render - no region suffix)');
  console.log('\n  For vetcare-dev:  DB_SCHEMA = vetcare_dev');
  console.log('  For vetcare-app:  DB_SCHEMA = vetcare_prod\n');
}

main().catch(e => {
  console.error('\n❌  Fatal error:', e.message);
  process.exit(1);
});
