# VetCare — Lessons Learned (Architectural & Platform)

> **READ THIS before starting any new feature, SQL query, deployment, or Render config change.**
> Every lesson here was learned the hard way. Apply them proactively.

---

## 🔵 PostgreSQL / Database Lessons

### LESSON-001 — Never Use uuid_generate_v4() — Use gen_random_uuid()
- **Context:** init.sql used `CREATE EXTENSION uuid-ossp` + `uuid_generate_v4()`. Render's managed PostgreSQL runs as a restricted user — `CREATE EXTENSION` requires superuser. This aborted ALL table creation silently.
- **Lesson:** Always use `gen_random_uuid()` (built-in PostgreSQL 13+). Never use `uuid_generate_v4()`. Never add `CREATE EXTENSION` to any SQL file.
- **Apply to:** ALL SQL files, ALL TypeScript migration files, ALL service SQL strings

### LESSON-002 — Always CREATE SCHEMA Before Creating Tables In It
- **Context:** `ensureSchemaPublic()` checked if `users` table existed in `vetcare_prod`, then ran init.sql — but never created the `vetcare_prod` schema first. Tables ended up in `public` or the whole thing errored.
- **Lesson:** Any code that runs SQL in a non-public schema MUST run `CREATE SCHEMA IF NOT EXISTS "schema_name"` first.
- **Apply to:** ensureSchemaPublic(), render-start.sh Step 0, any migration that targets a custom schema

### LESSON-003 — Cross-Reference ALL SQL Column Names Against docker/init.sql
- **Context:** Multiple bugs where service SQL used column names that didn't exist (`microchip_number`, `avatar_url` on wrong table). PostgreSQL errored, catch block swallowed it, frontend showed "No data found" silently.
- **Lesson:** Before writing ANY SQL query, grep the column name in `docker/init.sql` to confirm it exists on that table. Use `AS "camelCase"` aliases for all returned columns.
- **Apply to:** Every SQL query in every service file

### LESSON-004 — Silent Catch Blocks Are a Trap
- **Context:** Many bugs were invisible because catch blocks either swallowed errors entirely or re-threw a generic message, hiding the actual PostgreSQL error code/message.
- **Lesson:** Every catch block MUST log the actual error (`error.code`, `error.message`) before doing anything else. Never create a catch block that only re-throws a generic string.
- **Apply to:** All service files, all controller files

---

## 🔵 Render Deployment Lessons

### LESSON-005 — Bind HTTP Port FIRST, DB Connect SECOND — Always
- **Context:** Server called `connectWithRetry()` before `httpServer.listen()`. Free-tier Render DB takes 30-90s to wake. Render health check fires at ~60s. Port never bound → "Exited with status 1".
- **Lesson:** `httpServer.listen()` MUST be the FIRST operation. DB connect always goes in background after. NEVER put `process.exit(1)` in the DB connect failure path after port is already bound.
- **Apply to:** `backend/src/index.ts` — never change this startup order

### LESSON-006 — Every node Subprocess in render-start.sh Needs BOTH Timeout Guards
- **Context:** Inline `node -e` scripts with no outer `timeout N` shell wrapper hung indefinitely when DB was unreachable.
- **Lesson:** Every `node` call in render-start.sh needs: (1) `timeout N` shell wrapper AND (2) `connectionTimeoutMillis` set to less than N. Always add `|| echo "...continuing"` fallback.
- **Apply to:** render-start.sh — every `node -e` and `node dist/...` call

### LESSON-007 — Free-Tier Render PostgreSQL Can Sleep 30-90 Seconds
- **Context:** Multiple timeouts and race conditions caused by assuming DB is always ready within 5-10s.
- **Lesson:** Always design for 90s DB wake time. Use retry loops (4 attempts × 90s) in shell scripts. Use connectWithRetry (10 attempts × 12s) in server code. Never fail-fast on first DB timeout.
- **Apply to:** render-start.sh, index.ts, any one-shot DB connection code

### LESSON-008 — FORCE_RESEED Must Be Set BEFORE Deploy Starts
- **Context:** User set `FORCE_RESEED=true` in Render env AFTER deploy completed. render-start.sh had already run and skipped seeding.
- **Lesson:** Any env var read by render-start.sh must be set BEFORE triggering the deploy. For `FORCE_RESEED`: set it → trigger manual deploy → watch logs → then set back to false.
- **Apply to:** Render env var changes that affect startup scripts

### LESSON-009 — Render PROD Requires These Env Vars or Server Dies Instantly
| Variable | Why critical |
|----------|-------------|
| `DATABASE_URL` | Absence → `process.exit(1)` in config.ts at module load time |
| `JWT_SECRET` | Default value → `process.exit(1)` in config.ts at module load time |
| `NODE_ENV=production` | Missing → SSL disabled, CORS wrong, default JWT used |
| `DB_SCHEMA=vetcare_prod` | Missing → queries hit `public` schema, not prod data |

---

## 🔵 Authentication Lessons

### LESSON-010 — Any Endpoint Calling getUserByEmail Must Handle DB Errors Gracefully
- **Context:** `register()` called `getUserByEmail()` to check if email is taken. DB error (missing table) bubbled up as "Error fetching user by email" — confusing on register page.
- **Lesson:** Any endpoint that calls `getUserByEmail` must wrap it in try/catch with self-heal: run `ensureSchemaPublic()` + `fixDemoPasswords()`, then retry once. Show "Database not ready, please retry" on second failure.
- **Apply to:** AuthController.login(), AuthController.register(), any future endpoint that queries users table early

### LESSON-011 — fixDemoPasswords Must Retry if First Attempt Fails
- **Context:** fixDemoPasswords() was called once right after connectWithRetry(). If DB was still slow, it failed silently. Demo users never existed. ALL logins failed permanently.
- **Lesson:** fixDemoPasswords() must retry (at least once, after 30s delay) if first attempt fails. Never fire-and-forget a critical seeding function.
- **Apply to:** `backend/src/index.ts` — the fixDemoPasswords() call in the startup sequence

---

## 🔵 i18n Lessons

### LESSON-012 — Missing i18n Namespace Is Completely Silent
- **Context:** A new page used `t('herdMedical.pageTitle')` but `"herdMedical": {}` was never added to any locale file. react-i18next shows raw key paths with zero warnings.
- **Lesson:** When adding any new `t('namespace.key')`, the `"namespace": {}` object MUST exist in ALL 5 locale files (en, hi, ta, te, kn) BEFORE the component is used.
- **Validation:** `node -e "require('./frontend/src/locales/en/translation.json')"` must not throw for all 5 files.
- **Apply to:** Every new page or feature that introduces new translation namespace

### LESSON-013 — Editing Multiple Locale Files Can Break JSON Syntax
- **Context:** Two edits each added a trailing comma to the same JSON key → `,,` = invalid JSON. Pre-push hook didn't validate JSON syntax explicitly.
- **Lesson:** After editing ANY locale JSON file, validate ALL 5 immediately with `node -e "require('./...')"`.
- **Apply to:** Every locale file edit

---

## 🔵 CSS / UI Lessons

### LESSON-014 — Use calc(100vh - 64px) Not 100vh on .module-page
- **Context:** `min-height: 100vh` on `.module-page` inside a flex child that already has a 100vh parent causes double scroll.
- **Lesson:** Always `min-height: calc(100vh - 64px)` + `box-sizing: border-box` on `.module-page`.

### LESSON-015 — Never Add display:none to React Conditionally Rendered Elements
- **Context:** CSS `display: none` overrode React's conditional rendering, causing elements to be permanently hidden even when React tried to show them.
- **Lesson:** If React controls whether an element renders (`{condition && <Component/>}`), never add `display: none` in CSS for that element. Use React state only.

### LESSON-016 — Verify CSS Class Exists Before Using in className
- **Context:** Components used `.module-tabs`, `.chip-bar` etc. that were never defined in any CSS file. Styles silently did nothing.
- **Lesson:** Before using any className string, grep for it in CSS files first. If it doesn't exist, create it.

---

## 🔵 Permission System Lessons

### LESSON-017 — Permission Changes Require 4-File Sync (Never Just One)
- **Context:** A permission was changed in `PermissionService.ts` but not in the other 3 files. Pet owners started seeing farm menus.
- **Lesson:** Any permission/role/nav change MUST update ALL 4 files atomically:
  1. `backend/src/services/PermissionService.ts`
  2. `frontend/src/context/PermissionContext.tsx`
  3. `frontend/src/components/Navigation.tsx`
  4. `frontend/src/App.tsx`
- **Apply to:** Every feature addition that involves navigation or role access

---

## 🔵 Navigation Lessons

### LESSON-018 — Deep Links Must Pass Record ID — Never Navigate to Generic Overview
- **Context:** "Open Full Record" links navigated to a generic overview page, losing the specific record context.
- **Lesson:** Every navigation to a specific record MUST pass the ID via query/route param. Target page MUST auto-select/highlight that record.
- **Pattern:** `/medical-records?animalId=X&recordId=Y&tab=diagnoses`

### LESSON-019 — "My X" Always Means the User's OWN Records
- **Context:** "My Pets" for a vet showed all animals they'd treated (professional relationship), not the animals they own.
- **Lesson:** "My [anything]" for any role means `owner_id = currentUserId`. Never use professional relationship tables for ownership queries.

---

## 🔵 Settings Lessons

### LESSON-020 — All Time/Date/Currency Must Use useSettings() Formatters
- **Context:** FindDoctor page used a hardcoded `formatTime12h()` helper, ignoring admin's time format setting.
- **Lesson:** NEVER create local format helpers for time, date, or currency. Always import and use `formatSlotTime`, `formatDate`, `formatCurrency` from `useSettings()`.
- **Apply to:** Every page that displays time slots, dates, prices, or durations

---

## 🔵 Database Script Architecture Lessons

### LESSON-021 — TypeScript Migration Files Are the Wrong Layer for Schema Changes
- **Context:** enterpriseMigration.ts, tier2/3/4Migration.ts are TypeScript scripts that create tables. They have no transactional tracking, can't be rolled back, can't be audited by a DBA, and are called via raw `node dist/...` with no guarantee of ordering.
- **Lesson:** ALL schema changes MUST be pure `.sql` files in `backend/migrations/` tracked by `migrate.ts`. TypeScript migration scripts were a stopgap — convert them to numbered SQL migrations.
- **Apply to:** Every new table, column, or constraint change

### LESSON-022 — Three Sources of Schema Truth Is One Too Many
- **Context:** New tables were added in three places: `docker/init.sql`, `tierXMigration.ts`, and `database.ts seedDefaultSettings()`. Fresh deploys required running all three in the right order. Conflicts caused silent errors.
- **Lesson:** Single source of truth = `docker/init.sql` for baseline + `backend/migrations/NNN_name.sql` for incremental changes. `database.ts` safety ALTERs are belt-and-suspenders only — NOT the canonical definition.
- **Apply to:** Every new feature that requires DB changes

### LESSON-023 — Separate Mandatory Platform Data from Demo Data
- **Context:** `seed-demo-data.sql` was one monolithic file mixing mandatory platform configuration (role permissions, admin user, service categories) with optional demo records (demo patients, appointments). Production environments should never have demo records but MUST have platform config.
- **Lesson:** Two layers: `seeds/01_platform_required.sql` (always run, every environment) and `seeds/03_demo_data.sql` (dev/demo only, never prod).
- **Apply to:** Any new seed data — always classify as mandatory or optional before adding

### LESSON-024 — enterprise_members Table Was Missing from init.sql (Deployment Risk)
- **Context:** `EnterpriseService.ts` runs SQL against `enterprise_members` table. The table was NEVER defined in `docker/init.sql`. Worked locally because enterpriseMigration.ts ran first. On a fresh Render deploy without the TS migration completing, any enterprise query would fail silently.
- **Lesson:** After adding a TypeScript migration file, ALWAYS also add the table DDL to `docker/init.sql`. The canonical schema must be self-contained — never depend on TS migrations for table existence.
- **Apply to:** Every new table ever added to the codebase

---

## 🔵 Hospital Network Architecture Decisions (Locked — 2026-04-08)

### LESSON-025 — Farm Enterprises and Hospital Networks Are Completely Separate
- **Context:** The existing `enterprises` table is farm-domain only (farms, zoos, breeding facilities, sanctuaries). Hospital networks are clinical-domain. Merging them would create compliance/audit problems and confuse data models.
- **Lesson:** NEVER reuse `enterprises` for hospital networks. Use `hospital_networks` as a completely separate table hierarchy. Farm domain stays in `enterprises`, clinical domain in `hospital_networks`.
- **Apply to:** All hospital network feature development

### LESSON-026 — Hospital Patient Data Is Private by Default (Opt-In Only)
- **Context:** In standard vet platform, doctors see all patient data across all patients. For hospital networks, this is a major compliance/legal risk — corporate patient records must not leak outside the network.
- **Lesson:** `animal_care_contexts.visibility` defaults to `'private'`. Isolation enforced at SQL query level (not application logic). `include_hospital_records` boolean on consent record defaults to `false` even for "full history" consent.
- **Apply to:** Every query that joins animals with medical records — always check hospital scope

### LESSON-027 — Corporate Admin Has Direct Access But Every Action Is Immutably Logged
- **Context:** Corporate admin needs direct access to all data in their own network (no approval workflow needed). But this creates audit compliance risk if access is not tracked.
- **Lesson:** `corporate_admin` gets direct read access to own network data. But EVERY access to clinical records by corporate_admin (or anyone above patient's treating vet) is written to `clinical_data_access_log` — append-only, never deletable.
- **Apply to:** Any query in HospitalNetworkService, any corporate_admin route

### LESSON-028 — Dual Patient IDs: Platform VC-ID + Corporate Patient ID
- **Context:** A patient in hospital network has two identities: platform-wide `VC-DOG-26-00001` and hospital-specific `APOLLO-P-00423`. Both must be searchable, displayable, and cross-referenceable.
- **Lesson:** Use `animal_care_contexts` linking table: `animal_id` (FK to animals) + `hospital_network_id` + `platform_unique_id` (VC- format) + `corporate_patient_id` (network-defined format). Both IDs must be displayed in clinical contexts.
- **Apply to:** Any clinical UI showing patient identity in hospital context
