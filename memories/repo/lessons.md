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

### LESSON-032 — Never Add Unused Native Modules to Frontend Dependencies
- **Context:** `sharp` (libvips C++ bindings) was in `frontend/devDependencies` but never imported in any `.ts`/`.tsx` file. Build failed with status 1 on Render's Linux builder.
- **Lesson:** Native modules (sharp, canvas, node-gyp compiled packages) fail silently on mismatched glibc versions. Always verify a package is actually imported before adding it to `package.json`. Run `grep -r "from 'sharp'" src/` before adding.
- **Apply to:** All frontend and backend dependency additions

### LESSON-033 — Vite Must Use manualChunks to Avoid OOM on 512MB Render Free Tier
- **Context:** Default Vite output was a single `index.js` of 1,585 KB. Rollup holds the entire bundle in RAM during minification. Render free tier = 512 MB → OOM kill → "Exited with status 2 internal system error".
- **Lesson:** Always configure `build.rollupOptions.output.manualChunks` in `vite.config.ts`. Split at minimum: vendor-react, vendor-maps (leaflet is huge), vendor-i18n. Keep `index.js` below ~600 KB. Status 2 on Render build = OOM, not a code error.
- **Apply to:** All future large dependency additions — check bundle impact with `npm run build` and watch for chunks >600 KB


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

### LESSON-029 — Consent-Before-Access: Hard Platform Rule
- **Context:** Hospital network patient enrollment design
- **Lesson:** A hospital can REQUEST patient enrollment. The patient MUST explicitly APPROVE before ANY clinical data is shared. `enrollment_status = 'pending_consent'` gates all data access. Never auto-activate enrollment.
- **Apply to:** All future features involving data sharing, third-party access, inter-institution records

### LESSON-030 — Walk-in Patient Invites: 72-hour Expiry Token Pattern
- **Context:** Hospital patients without platform accounts
- **Lesson:** Walk-in invites use crypto.randomBytes(48).toString('hex') tokens, stored in hospital_patient_invites table, expire in 72 hours, status tracked as pending/accepted/expired/revoked
- **Apply to:** All future invite flows

### LESSON-031 — Dual-ID Patient System
- **Context:** Network patient identification
- **Lesson:** Every patient has TWO IDs: platform VC-ID (VC-DOG-26-000001, global) and network patient ID (APOLLO-DOG-26-000042, per-network). The network ID is auto-generated on enrollment using the network's id_prefix + species + year + 6-digit sequence.
- **Apply to:** All future hospital network features

### LESSON-032 — PostgreSQL Inline CHECK Constraint Migration Pattern
- **Context:** Adding `corporate_admin` to the `users.role` CHECK constraint on an existing production database. PostgreSQL inline `CHECK (role IN (...))` constraints are auto-named `users_role_check`. You cannot ALTER them — you must DROP then ADD.
- **Lesson:** To add a new value to an existing CHECK constraint: (1) `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;` (2) `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('existing', 'values', ..., 'new_value'));` — both in a single transaction in `database.ts seedDefaultSettings()` with `.catch(() => {})` to be non-fatal. Also update `init.sql` for fresh installs.
- **Apply to:** Any future role addition, any future ENUM-like CHECK constraint change

### LESSON-033 — Two api.ts Files: Class-Based (api.ts) vs Modular (api/index.ts)
- **Context:** New API methods added to `frontend/src/services/api/adminApi.ts` but pages use `import apiService from '../services/api'` which resolves to the class-based `api.ts`, NOT the modular `api/index.ts`.
- **Lesson:** The main `ApiService` CLASS is in `frontend/src/services/api.ts`. This is what all pages import. Methods in `api/adminApi.ts` (modular style) are NOT automatically available to pages. When adding new API methods, ALWAYS add them to BOTH: (1) `api.ts` class for existing pages, (2) `api/adminApi.ts` for future modular use.
- **Apply to:** Every new API method going forward

### LESSON-034 — PowerShell Corrupts TypeScript Template Literals
- **Context:** PowerShell `Add-Content`/`Out-File` treated backtick as an escape character, removing them from template literals — TypeScript saw `/role-change-requests/+id+/cancel` (regex syntax) instead of `` `/role-change-requests/${id}/cancel` ``.
- **Lesson:** NEVER use PowerShell file-write commands for TypeScript source with template literals. Use the `edit` tool for all TypeScript source edits. If PowerShell must write TypeScript, use `[System.IO.File]::WriteAllText()` which doesn't interpret backticks.
- **Apply to:** All TypeScript source edits — use edit tool exclusively

### LESSON-035 — hospital_staff Role Cannot Self-Register — Invite-Only Pattern
- **Context:** Implementing non-vet clinical staff (nurses, receptionists, lab techs) for hospital networks
- **Lesson:** `hospital_staff` accounts are ONLY created via invite token flow (`/accept-hospital-invite?token=XXX`). Never allow role=hospital_staff in the standard /auth/register endpoint. The invite token validates email pre-assignment and seat availability before account creation.
- **Apply to:** All future invite-only roles; any role that should be org-scoped not self-registered

### LESSON-036 — Seat Limit Check Must Run at Both Send AND Accept Time
- **Context:** Staff invite flow: invite is created → staff clicks link 72hrs later → accepts
- **Lesson:** Between invite creation and acceptance, other invites may be accepted filling the seats. Always run `checkSeatLimit()` at BOTH points: (1) when invite is sent, and (2) when the acceptance endpoint is called. This prevents race conditions where seat limit is exceeded.
- **Apply to:** Any quota-gated resource creation where there is a time gap between reservation and fulfilment

### LESSON-037 — Never Hardcode Prices Anywhere in Source Code
- **Context:** Pricing visibility system — admin controls when pricing is shown to corporate admins and public
- **Lesson:** All plan prices are stored in DB only (NULL = not set yet). No price strings in any `.tsx`, `.ts`, or `.json` source file. Locale files may use interpolation like `"{{price}}/month"` but never `"₹2,999/month"`. The `usePricing()` hook fetches prices from `/pricing/plans` at runtime. When `isVisible=false`, all placeholders show CTA text.
- **Apply to:** ALL future monetization features, all pricing displays

### LESSON-038 — Suspended Network Affects Staff Logins Only, Not Pet Owners
- **Context:** Network suspension for billing/non-payment scenarios
- **Lesson:** When a hospital network is suspended, ONLY corporate_admin and hospital_staff accounts for that network should be blocked (403). Pet owners, farmers, and veterinarians using the general platform must NEVER be blocked by network suspension status. Check suspension only on network-specific logins.
- **Apply to:** Any future org-level suspension or access control

### LESSON-039 — init.sql AND database.ts Safety Net Must BOTH Be Updated for New Roles/Enums
- **Context:** hospital_staff role was added to database.ts safety net ALTER TABLE but NOT to init.sql CHECK constraint — fresh DB installs rejected the role.
- **Lesson:** When adding a new user role or any DB enum value: (1) update init.sql CHECK constraint for fresh installs, (2) update database.ts ALTER TABLE safety net for existing DBs, (3) update Joi validation schemas. All 3 must be in sync. Missing init.sql means new Render deploys with fresh DB fail silently at first registration attempt.
- **Apply to:** All future role additions, status enum expansions, position type changes

### LESSON-040 — Dynamic SQL from req.body Keys Must Always Use allowedFields Whitelist
- **Context:** PUT /admin/network-subscription-plans/:id built SQL dynamically from Object.keys(req.body) with no filtering.
- **Lesson:** NEVER build UPDATE/INSERT SQL from request body keys directly. Always define an `allowedFields` string array and filter with `Object.entries(body).filter(([k]) => allowedFields.includes(k))`. This prevents arbitrary column injection even when input is authenticated.
- **Apply to:** All dynamic SQL construction from user-controlled input

### LESSON-041 — Check for Duplicate DB Constraint Updates in database.ts Before Adding New Ones
- **Context:** Two ALTER TABLE constraint updates for users.role existed — first (incomplete, missing hospital_staff) at line 709, second (complete) at line 837. First ran but was immediately overwritten.
- **Lesson:** Before adding a new constraint update in database.ts, search the file for existing updates to the same table/column. There must be EXACTLY ONE. Remove stale duplicates or consolidate into one.
- **Apply to:** All future database.ts safety net additions

### LESSON-042 — All Currency/Date Formatting Must Use useSettings() — No Local Helpers Allowed
- **Context:** NetworkSubscriptions.tsx had a standalone `formatPrice()` helper with hardcoded `'en-IN'` locale; FinancialAnalytics.tsx used `toLocaleDateString()` directly — both bypass admin settings.
- **Lesson:** `formatCurrency()`, `formatDate()`, `formatSlotTime()` from `useSettings()` are MANDATORY for every time/date/currency display. Never create local format helpers — they always get out of sync with admin settings. Search for `toLocaleDateString`, `toLocaleTimeString`, `Intl.NumberFormat`, `toLocaleString` before any commit and fix all occurrences.
- **Apply to:** All pages, all future features

### LESSON-043 — Demo Environment Uses demo Branch, Not main
- **Context:** Previously PROD used `main` branch. Renamed to Demo to clarify purpose; `main` is now archive-only.
- **Lesson:** Branch → Environment mapping is: `develop` → Dev (Render Postgres), `demo` → Demo (Neon DB). NEVER use `main` as a deployment target branch — it causes confusion between git history and live environments. The promote workflow merges `develop → demo`.
- **Apply to:** All future branch strategy and CI/CD changes

### LESSON-044 — Use Render REST API (not dashboard) to Set Env Vars Automatically
- **Context:** Setting Demo env vars (DATABASE_URL, JWT_SECRET, CLOUDINARY_URL etc.) manually in Render dashboard is error-prone and not reproducible. 
- **Lesson:** Use `PUT /v1/services/{service_id}/env-vars` Render API endpoint in a GitHub Actions `workflow_dispatch` workflow. All secrets stay in GitHub (one source of truth). Re-runnable any time. Requires `RENDER_API_KEY` and `RENDER_DEMO_SERVICE_ID` GitHub secrets.
- **Apply to:** All future environment setup automation

### LESSON-045 — Neon DB Requires SSL — Already Handled by config/index.ts
- **Context:** Neon PostgreSQL requires SSL (`?sslmode=require` in connection string). Needed to verify backend handles this.
- **Lesson:** `config/index.ts` already sets `ssl: { rejectUnauthorized: false }` whenever `DATABASE_URL` env var is present. Neon's SSL works automatically — no code change needed. The `?sslmode=require` in the Neon URL is sufficient.
- **Apply to:** Any future external PostgreSQL provider (Supabase, Railway, etc.)

### LESSON-046 — API response array extraction pattern
- **Logged:** 2026-04-10 11:09
- **Context:** PatientConsent and NetworkMemberships both crashed because API responses wrap arrays differently per endpoint
- **Lesson:** NEVER use res?.data||res||[] to extract arrays. Backend endpoints return either bare arrays, {data:[...]}, or {data:{animals:[],total:N}}. Always use explicit Array.isArray() check: Array.isArray(res?.data?.animals)?res.data.animals:Array.isArray(res?.data)?res.data:Array.isArray(res)?res:[]
- **Apply to:** All future frontend API response parsing


### LESSON-047 — Neon free-tier cold-start requires retry loops
- **Logged:** 2026-04-10 11:27
- **Context:** Demo login failed persistently due to Neon auto-suspend + Render spin-down racing each other on cold start
- **Lesson:** Any backend operation hitting Neon free-tier must retry at least 3-4 times with escalating delays. Single try/catch self-heal is never enough for cold-start scenarios
- **Apply to:** All AuthController DB operations + any new Neon-backed endpoints


### LESSON-048 — PostgreSQL reserved keywords as column names cause silent init failures
- **Logged:** 2026-04-10 13:34
- **Context:** role_change_requests table had current_role VARCHAR(50) - current_role is a PG system variable/reserved keyword
- **Lesson:** Always quote column names that match PostgreSQL reserved words (current_role, current_user, session_user, etc.) using double-quotes in both CREATE TABLE and all SQL queries referencing them
- **Apply to:** All future table definitions + SQL queries


### LESSON-049 — init.sql forward references break statement-by-statement execution
- **Logged:** 2026-04-10 13:34
- **Context:** hospital_patient_invites (line 1264) referenced hospital_networks (line 1534) - forward dependency. When init.sql runs stmt-by-stmt, table creation fails
- **Lesson:** Always define parent/referenced tables BEFORE child tables that reference them in init.sql. No forward references allowed.
- **Apply to:** All future init.sql additions


### LESSON-048 — Form UX — Disabled submit buttons must explain why
- **Logged:** 2026-04-11 13:55
- **Context:** User could not tell why Admit Patient button was grayed out — no indication that selecting a patient from dropdown was mandatory
- **Lesson:** MANDATORY for ALL forms and modals: (1) Required fields must have red * marker. (2) Optional fields must be labeled (optional). (3) Disabled submit buttons MUST have visible inline helper text explaining the blocking condition — never rely on tooltip only. (4) All catch blocks in form submit handlers MUST surface error to user via visible error banner. (5) Submit button MUST show loading/spinner state during async calls to prevent double-submit. (6) All modals MUST have visible ✕ close button + overlay-click-to-close.
- **Apply to:** ALL new and existing forms/modals/popups


### LESSON-049 — Always use parseJsonbArray helper for JSONB columns
- **Logged:** 2026-04-12 11:38
- **Context:** Reading vitals_log JSONB from PostgreSQL via pg driver
- **Lesson:** pg driver returns JSONB columns as native JS objects/arrays — JSON.parse(jsArray) silently fails. Always check Array.isArray() before parsing.
- **Apply to:** All future code reading JSONB columns from PostgreSQL


### LESSON-050 — Cross-module data visibility is mandatory
- **Logged:** 2026-04-12 14:09
- **Context:** Hospital module data (queue visits, vitals, inpatient) was completely absent from Medical Records page — no API calls existed for hospital data in MedicalRecords.tsx
- **Lesson:** All modules that create patient-related data MUST expose that data via Medical Records. Any new hospital/clinical module must add an API endpoint for animal-scoped history retrieval.
- **Apply to:** All future modules that create patient data


### LESSON-055 — Farmer enterprise alignment
- **Logged:** 2026-04-13 09:30
- **Context:** Farmer/enterprise model was only 60% implemented -- schema existed but enforcement, cross-module linking, and bulk operations were largely missing
- **Lesson:** ALL new clinical tables (inpatient, queue, workflow_cases, referrals) MUST include enterprise_id column. ALL booking/admission flows MUST validate enterprise ownership. ALL animal lists for farmers MUST include enterprise filter.
- **Apply to:** All future enterprise-related features


### LESSON-056 — Farm context visibility in vet-facing modules
- **Logged:** 2026-04-13 10:34
- **Context:** Farmer data (enterprise/group) was only on the farmer side. Vets/hospitals had no visibility into which farm an animal came from.
- **Lesson:** Add LEFT JOIN enterprises + animal_groups to ALL vet-facing queries (getQueue, listInpatients, listWorkflowCases). Always propagate enterprise_name/group_name to frontend display.
- **Apply to:** All vet-facing service queries


### LESSON-057 — Network referrals must be their own table, not reuse internal referrals
- **Logged:** 2026-04-13 13:54
- **Context:** Hospital Network had an internal referrals table for intra-hospital doctor referrals but no cross-hospital referral table. The two concepts are completely different — internal referrals link two vets at one hospital; network referrals link two hospitals across a network with consultation context.
- **Lesson:** Always model cross-hospital and intra-hospital referrals as separate tables. network_referrals needs: network_id, from_hospital_id, to_hospital_id, consultation_id FK for clinical continuity.
- **Apply to:** All future referral features


### LESSON-058 — Code scan baseline — security and quality patterns
- **Logged:** 2026-04-13 15:59
- **Context:** Full application code scan (security, performance, unhandled errors) run April 2026
- **Lesson:** 1) All tables in init.sql (not just database.ts). 2) All errors standardized to {success:false,message}. 3) No empty catch blocks. 4) type=button on all non-submit buttons. 5) Role checks on every sensitive route. 6) FK indexes on all foreign keys. 7) Never expose err.message to client in 500s. 8) isMounted guard on all async setState.
- **Apply to:** All future features

