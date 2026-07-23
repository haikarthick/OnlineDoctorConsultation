#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Render.com Start Script
# Runs DB migrations then starts the backend server
# (Backend also serves the frontend static files in production)
# ─────────────────────────────────────────────────
# Don't use set -e globally — only the final server start must succeed
echo "══════════════════════════════════════════"
echo "  VetCare Platform — Starting"
echo "══════════════════════════════════════════"

cd backend

# ── Resolve schema name (vetcare_dev / vetcare_demo / public) ──
DB_SCHEMA="${DB_SCHEMA:-public}"
echo "  Schema: $DB_SCHEMA"

# Step 0: Create schema (if non-public) + base tables from init.sql
# Free-tier Render PostgreSQL can take 30-90s to wake from sleep.
# We retry up to 4 times with 25s between attempts (total budget: ~4 min).
echo "━━━ Setting up database schema ━━━"
SCHEMA_READY=false
for ATTEMPT in 1 2 3 4; do
  echo "  Schema setup attempt $ATTEMPT/4..."
  if timeout 90 node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 25000, min: 0, max: 2 });
  const client = await pool.connect();
  try {
    const schema = process.env.DB_SCHEMA || 'public';
    if (schema !== 'public') {
      await client.query('CREATE SCHEMA IF NOT EXISTS ' + schema);
      console.log('  ✓ Schema ' + schema + ' created/verified');
    }
    await client.query('SET search_path TO ' + schema + ', public');

    const sqlPath = path.join(process.cwd(), '..', 'docker', 'init.sql');
    if (!fs.existsSync(sqlPath)) { console.log('  init.sql not found — skipping'); return; }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('  ✓ Base schema ready (' + schema + ')');
  } catch (e) {
    console.error('  ⚠ Schema setup warning:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { process.exit(1); });
" ; then
    SCHEMA_READY=true
    echo "  ✓ Schema setup succeeded on attempt $ATTEMPT"
    break
  fi
  if [ "$ATTEMPT" -lt 4 ]; then
    echo "  Schema setup attempt $ATTEMPT failed — waiting 25s before retry..."
    sleep 25
  fi
done

if [ "$SCHEMA_READY" = "false" ]; then
  echo "  WARNING: All schema setup attempts failed — server will attempt ensureSchema() on startup"
fi
echo ""

# Step 1: Run database migrations using the migrate runner (idempotent — safe to re-run)
# The migrate runner tracks applied migrations in _migrations table, never re-runs a file.
# This step runs BEFORE the server binds its port, so aborting here actually fails the
# Render deploy (rather than shipping traffic to a partially-migrated schema) — unlike
# the server's own startup, which deliberately never crashes over DB issues once it's
# already listening (see index.ts).
#
# Exit codes from migrate.js:
#   0   — success (or nothing pending)
#   1   — a migration's SQL genuinely failed — this is the only case that aborts the deploy
#   2   — couldn't even reach the DB to check migration state (cold start) — transient, tolerated
#   124 — the `timeout` wrapper below killed it — also transient, tolerated
echo "━━━ Running database migrations ━━━"
timeout 60 node dist/utils/migrate.js 2>&1
MIGRATE_EXIT=$?
if [ "$MIGRATE_EXIT" = "0" ]; then
  echo "✓ Migrations complete"
elif [ "$MIGRATE_EXIT" = "124" ] || [ "$MIGRATE_EXIT" = "2" ]; then
  echo "  ⚠ Could not reach the database to run migrations (likely a slow free-tier DB wake-up) — continuing"
else
  echo "  ✗ FATAL: Database migration(s) failed — aborting deploy"
  echo "  Set MIGRATIONS_FAIL_FAST=false in the Render environment to temporarily bypass this"
  echo "  and investigate with a running server, then unset it once fixed."
  exit 1
fi

# Step 1b: Load mandatory platform seed data (admin user, settings, permissions)
# This is idempotent (ON CONFLICT DO NOTHING) — safe to re-run on every deploy.
echo "━━━ Loading platform required data ━━━"
timeout 45 node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, min: 0, max: 2 });
  const client = await pool.connect();
  try {
    const schema = process.env.DB_SCHEMA || 'public';
    await client.query('SET search_path TO ' + schema + ', public');
    const sqlPath = path.join(process.cwd(), '..', 'docker', 'seeds', '01_platform_required.sql');
    if (!fs.existsSync(sqlPath)) { console.log('  01_platform_required.sql not found — skipping'); return; }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('  ✓ Platform required data loaded (' + schema + ')');
  } catch (e) {
    console.log('  ⚠ Platform required seed warning:', e.message.substring(0, 120));
  } finally {
    client.release();
    await pool.end();
  }
}
main();
" 2>&1 || echo "  (platform seed warning — continuing)"
echo ""

# Step 2: Seed demo data if core data is missing (vet_profiles table empty)
# Users are created by fixDemoPasswords at server start, but the rest
# of the demo data (animals, vet profiles, consultations, etc.) only
# comes from the seed SQL file.
VET_PROFILE_COUNT=$(timeout 20 node -e "
const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000, min: 0, max: 2 });
  const schema = process.env.DB_SCHEMA || 'public';
  try {
    await pool.query('SET search_path TO ' + schema + ', public');
    const r = await pool.query('SELECT COUNT(*)::int AS c FROM vet_profiles');
    console.log(r.rows[0].c);
  } catch (e) { console.log('0'); }
  finally { await pool.end(); }
}
main();
" 2>/dev/null || echo "0")

echo "  Database has $VET_PROFILE_COUNT vet profile(s)"

FORCE_RESEED_LOWER=$(echo "$FORCE_RESEED" | tr '[:upper:]' '[:lower:]')
SEED_ON_STARTUP_LOWER=$(echo "$SEED_ON_STARTUP" | tr '[:upper:]' '[:lower:]')
# FORCE_RESEED=true → always re-seed (destructive, for manual resets)
# SEED_ON_STARTUP=true → seed only if DB is empty (safe for every startup)
if [ "$FORCE_RESEED_LOWER" = "true" ] || [ "$FORCE_RESEED" = "1" ]; then
  echo ""
  echo "━━━ FORCE_RESEED=true — Re-seeding demo data ━━━"
  timeout 120 node dist/utils/seed-demo-data.js 2>&1 || echo "  ⚠ Seed had warnings or timed out — continuing"
  echo "✓ Seed complete"
elif [ "$VET_PROFILE_COUNT" = "0" ]; then
  echo ""
  echo "━━━ No demo data detected — Seeding demo data ━━━"
  timeout 120 node dist/utils/seed-demo-data.js 2>&1 || echo "  ⚠ Seed had warnings or timed out — continuing"
  echo "✓ Seed complete"
else
  echo "  ✓ Database already has demo data — skipping seed"
fi

# Step 3: Start the server (this MUST succeed)
echo ""
echo "━━━ Starting server ━━━"
exec node dist/index.js
