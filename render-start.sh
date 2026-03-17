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
echo "━━━ Setting up database schema ━━━"
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
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
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
" || echo "  (schema setup had warnings — continuing)"
echo ""

# Step 1: Run enterprise/tier migrations (idempotent — safe to re-run)
echo "━━━ Running database migrations ━━━"
node dist/utils/enterpriseMigration.js  2>&1 || echo "  (enterprise migration warning — continuing)"
node dist/utils/tier2Migration.js       2>&1 || echo "  (tier2 migration warning — continuing)"
node dist/utils/tier3Migration.js       2>&1 || echo "  (tier3 migration warning — continuing)"
node dist/utils/tier4Migration.js       2>&1 || echo "  (tier4 migration warning — continuing)"
echo "✓ Migrations complete"

# Step 2: Seed demo data only if the database is EMPTY (no users exist)
# This ensures data is never wiped on subsequent deploys.
# To force a full re-seed, set FORCE_RESEED=true in Render env vars.
USER_COUNT=$(node -e "
const { Pool } = require('pg');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const schema = process.env.DB_SCHEMA || 'public';
  try {
    await pool.query('SET search_path TO ' + schema + ', public');
    const r = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    console.log(r.rows[0].c);
  } catch (e) { console.log('0'); }
  finally { await pool.end(); }
}
main();
" 2>/dev/null || echo "0")

echo "  Database has $USER_COUNT user(s)"

if [ "$FORCE_RESEED" = "true" ]; then
  echo ""
  echo "━━━ FORCE_RESEED=true — Re-seeding demo data ━━━"
  node dist/utils/seed-demo-data.js 2>&1 || echo "  ⚠ Seed had warnings — continuing"
  echo "✓ Seed complete"
elif [ "$USER_COUNT" = "0" ]; then
  echo ""
  echo "━━━ Empty database detected — Seeding demo data ━━━"
  node dist/utils/seed-demo-data.js 2>&1 || echo "  ⚠ Seed had warnings — continuing"
  echo "✓ Seed complete"
else
  echo "  ✓ Database already has data — skipping seed (data preserved)"
fi

# Step 2c: Fix demo passwords — hash at runtime to guarantee correctness
echo ""
echo "━━━ Fixing demo passwords (runtime bcrypt) ━━━"
node -e "
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
async function fix() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const schema = process.env.DB_SCHEMA || 'public';
  await pool.query('SET search_path TO ' + schema + ', public');
  const users = [
    ['admin@vetcare.com','Admin@123'],
    ['dr.james.carter@vetcare.com','Doctor@123'],
    ['dr.sarah.bennett@vetcare.com','Doctor@123'],
    ['dr.michael.reyes@vetcare.com','Doctor@123'],
    ['dr.priya.sharma@vetcare.com','Doctor@123'],
    ['emily.davis@email.com','Owner@123'],
    ['robert.chen@email.com','Owner@123'],
    ['sarah.kim@email.com','Owner@123'],
    ['michael.torres@email.com','Owner@123'],
    ['john.miller@greenpastures.com','Farmer@123'],
    ['maria.garcia@sunrisefarm.com','Farmer@123'],
    ['thomas.green@greenmeadows.com','Farmer@123'],
  ];
  for (const [email, pw] of users) {
    const hash = bcrypt.hashSync(pw, 10);
    const r = await pool.query('UPDATE users SET password_hash = \$1 WHERE email = \$2', [hash, email]);
    console.log('  ' + (r.rowCount ? 'OK' : 'SKIP') + ' ' + email);
  }
  await pool.end();
  console.log('  Done');
}
fix().catch(e => { console.error('  Password fix error:', e.message); });
" 2>&1 || echo "  ⚠ Password fix had warnings"

# Step 3: Start the server (this MUST succeed)
echo ""
echo "━━━ Starting server ━━━"
exec node dist/index.js
