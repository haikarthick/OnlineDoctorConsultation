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

# Step 0: Create base schema from init.sql (idempotent — uses IF NOT EXISTS)
echo "━━━ Setting up database schema ━━━"
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sqlPath = path.join(process.cwd(), '..', 'docker', 'init.sql');
  if (!fs.existsSync(sqlPath)) { console.log('  init.sql not found — skipping'); await pool.end(); return; }
  try {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('  ✓ Base schema ready');
  } catch (e) {
    console.error('  ⚠ Schema setup warning:', e.message);
  } finally {
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
  try {
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

# Step 3: Start the server (this MUST succeed)
echo ""
echo "━━━ Starting server ━━━"
exec node dist/index.js
