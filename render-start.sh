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

# Step 2: Seed demo data if SEED_ON_STARTUP=true (first deploy only)
if [ "$SEED_ON_STARTUP" = "true" ]; then
  echo ""
  echo "━━━ Seeding demo data ━━━"
  node dist/utils/seed-demo-data.js 2>&1 || echo "  ⚠ Seed had warnings — continuing"
  echo "✓ Seed complete"
fi

# Step 3: Start the server (this MUST succeed)
echo ""
echo "━━━ Starting server ━━━"
exec node dist/index.js
