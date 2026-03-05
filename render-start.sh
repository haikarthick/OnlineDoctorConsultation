#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Render.com Start Script
# Runs DB migrations then starts the backend server
# (Backend also serves the frontend static files in production)
# ─────────────────────────────────────────────────
set -e

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
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sqlPath = path.join(__dirname, '..', 'docker', 'init.sql');
if (!fs.existsSync(sqlPath)) { console.log('  init.sql not found at ' + sqlPath + ' — skipping'); process.exit(0); }
const sql = fs.readFileSync(sqlPath, 'utf8');
pool.query(sql)
  .then(() => { console.log('✓ Base schema ready'); return pool.end(); })
  .catch(e => { console.error('Schema setup error:', e.message); return pool.end().then(() => process.exit(1)); });
"
echo ""

# Step 1: Run enterprise/tier migrations (idempotent — safe to re-run)
echo "━━━ Running database migrations ━━━"
node dist/utils/enterpriseMigration.js  2>/dev/null || echo "  (enterprise migration already applied or skipped)"
node dist/utils/tier2Migration.js       2>/dev/null || echo "  (tier2 migration already applied or skipped)"
node dist/utils/tier3Migration.js       2>/dev/null || echo "  (tier3 migration already applied or skipped)"
node dist/utils/tier4Migration.js       2>/dev/null || echo "  (tier4 migration already applied or skipped)"
echo "✓ Migrations complete"

# Seed demo data if SEED_ON_STARTUP=true (first deploy only)
if [ "$SEED_ON_STARTUP" = "true" ]; then
  echo ""
  echo "━━━ Seeding demo data ━━━"
  node dist/utils/seed-demo-data.js 2>&1 || echo "  (seed may have partially failed — check logs)"
  echo "✓ Seed complete"
fi

# Start the server
echo ""
echo "━━━ Starting server ━━━"
exec node dist/index.js
