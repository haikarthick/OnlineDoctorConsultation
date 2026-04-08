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

# ── Resolve schema name (vetcare_dev / vetcare_prod / public) ──
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
# This replaces the old individual TS migration calls (enterpriseMigration, tier2/3/4Migration)
# The migrate runner tracks applied migrations in _migrations table, never re-runs a file.
echo "━━━ Running database migrations ━━━"
timeout 60 node dist/utils/migrate.js 2>&1 || echo "  (migration runner warning — continuing)"
echo "✓ Migrations complete"

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
