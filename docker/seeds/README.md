# VetCare — Database Seed Files

## Overview

Seed files are layered. Run them in order depending on your environment:

```
docker/init.sql                     ← Schema: all tables (run FIRST, always)
backend/migrations/*.sql            ← Incremental schema changes (run SECOND, always)
docker/seeds/01_platform_required.sql ← Mandatory platform data (run THIRD, always)
docker/seed-demo-data.sql           ← Demo data (OPTIONAL — dev/demo only)
```

---

## Files

### `01_platform_required.sql` — **Run on every environment (including production)**
- Platform admin user (`admin@vetcare.com`) — change password after first login
- Default `system_settings` rows (time format, date format, currency, booking rules, join window)
- Default `role_permissions` matrix (all 4 roles × all permissions)
- Without this: settings panel fails, permission checks fail, booking rules are undefined

### `../seed-demo-data.sql` — **OPTIONAL — development and demo environments ONLY**
- 4 demo users (admin, vet, pet_owner, farmer) with known passwords
- Demo hospitals, animals, consultations, bookings, prescriptions, marketplace listings
- Demo farm enterprise with livestock
- **NEVER run in production** — demo passwords are known and data is artificial

---

## New Environment Setup

### Production
```bash
psql $DATABASE_URL -c "SET search_path TO vetcare_prod, public;"
psql $DATABASE_URL -f docker/init.sql
node backend/dist/utils/migrate.js
psql $DATABASE_URL -f docker/seeds/01_platform_required.sql
# STOP HERE — do NOT run demo data in production
```

### Development / Demo
```bash
psql $DATABASE_URL -f docker/init.sql
node backend/dist/utils/migrate.js
psql $DATABASE_URL -f docker/seeds/01_platform_required.sql
psql $DATABASE_URL -f docker/seed-demo-data.sql
```

### Local Docker Compose
```bash
docker compose up -d postgres
docker compose run --rm migrate
# init.sql + seeds run automatically via docker-entrypoint-initdb.d
```

---

## Adding New Seed Data

| Data type | File |
|-----------|------|
| Platform config, permissions, system defaults | `01_platform_required.sql` |
| Demo patients, demo appointments, demo farms | `../seed-demo-data.sql` |
| Demo hospital networks (Phase 1 feature) | `../seed-demo-data.sql` |

**Rule:** If the platform cannot start correctly without the data → it belongs in `01_platform_required.sql`.  
**Rule:** If you'd never put it in production → it belongs in `seed-demo-data.sql`.

---

## Render.com Deployment

`render-start.sh` automatically handles seeding:
1. `docker/init.sql` → applied via inline node script (Step 0)
2. `backend/migrations/*.sql` → applied via `migrate.js` (Step 1)
3. Demo data → applied via `seed-demo-data.js` ONLY if `VET_PROFILE_COUNT = 0` (Step 2)

`01_platform_required.sql` data is embedded in `seed-demo-data.sql` via `ON CONFLICT DO NOTHING`.  
For a clean production-only deploy, run `01_platform_required.sql` separately and set `FORCE_RESEED=false`.
