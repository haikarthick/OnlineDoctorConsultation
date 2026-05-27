# VetCare Past Bugs — Do Not Repeat

> **READ THIS FILE AT THE START OF EVERY SESSION before writing any code.**
> Every entry is a real bug that caused a real production or user-facing failure.

---

## 🔴 DB Schema / SQL Bugs

### SEED-001 — 5 Wrong Table/Column Names in Seed SQL → Network Demo Data Silently Fails
- **Symptom:** `netadmin@vetcare.com` logs in but dashboard is empty — no branch hospitals, no staff, no audit data. All other network demo users can't log in.
- **Root Cause:** `seed-demo-data.sql` used 5 wrong table/column names that don't exist in `init.sql`:
  1. `hospital_network_hospitals` INSERT had `added_by` column — column doesn't exist
  2. `animal_care_contexts.visibility` used `'network_visible'` — CHECK only allows `'private', 'network_only', 'treating_vet_only'`
  3. `data_access_consents` table — correct name is `patient_data_consent`
  4. `corporate_audit_log` table — correct name is `clinical_data_access_log`
  5. `inter_hospital_referrals` table — correct name is `referrals` (uses `from_vet_id`/`to_vet_id`, not `from_hospital_id`/`to_hospital_id`)
- **Fix:** Corrected all 5 mismatches in seed-demo-data.sql with correct table names and column names verified against init.sql.
- **Rule:** BEFORE writing ANY seed SQL, run `grep -n "CREATE TABLE" docker/init.sql` to get exact table names, then `grep -n "column" docker/init.sql` for every column used. NEVER guess table/column names from memory.

### SEED-002 — SEED_ON_STARTUP=true Does NOT Re-Seed Existing DBs → Network Data Never Appears
- **Symptom:** User set `SEED_ON_STARTUP=true` in Render but network demo data still missing after deploy.
- **Root Cause:** `fixDemoPasswords.ts` checks `vet_profiles >= 3 AND consultations > 0` — if true, it returns early and NEVER runs seed SQL. `SEED_ON_STARTUP` only controls the `render-start.sh` pre-app seeding, which has the same VET_PROFILE_COUNT guard. So once any data exists, new seed sections are permanently skipped.
- **Fix:** Added independent hospital network seed check in fixDemoPasswords.ts: even when full seed data exists, it checks `hospital_network_members WHERE network_id = demo_network_id` — if < 3 members, extracts and runs only the "HOSPITAL NETWORK COMPREHENSIVE DEMO DATA" section from seed SQL.
- **Rule:** When adding NEW seed data sections (for new features), ALWAYS add an independent check that runs regardless of the main seed guard. New feature data must seed even on existing DBs.

### SCHEMA-001 — hospital_staff missing from users.role CHECK → Fresh DB Install Rejects Role
- **Symptom:** `hospital_staff` users created via invite-accept token get PostgreSQL CHECK violation on fresh DB install; existing DBs worked because database.ts safety net ran ALTER TABLE before any inserts.
- **Root Cause:** `docker/init.sql` users.role CHECK constraint listed only `pet_owner, farmer, veterinarian, admin, corporate_admin` — `hospital_staff` was never added.
- **Fix:** Added `hospital_staff` to users.role CHECK in init.sql. Also added `admin_staff` to staff_positions.position CHECK (was in Joi schema but not DB constraint).
- **Rule:** Whenever a new role or enum value is added to Joi validation schemas, ALSO add it to the corresponding CHECK constraint in init.sql AND the database.ts safety-net ALTER TABLE.

### SCHEMA-002 — Duplicate Role Constraint in database.ts → Incomplete Constraint Overwrites Complete One
- **Symptom:** The first `ALTER TABLE users DROP CONSTRAINT ... ADD CONSTRAINT` at line 709 ran with incomplete role list (missing hospital_staff), then the complete one at line 837 ran and overwrote it — but between those two lines, any concurrent registration would hit the incomplete constraint.
- **Root Cause:** Two separate ALTER TABLE constraint updates for the same column existed in database.ts. The first was a leftover from an earlier version and was never cleaned up.
- **Fix:** Removed the first (incomplete) duplicate at lines 709-716. Only the complete constraint at line 837 remains.
- **Rule:** There must be EXACTLY ONE ALTER TABLE constraint update per column in database.ts. Search for duplicate DROP/ADD CONSTRAINT blocks before adding new ones.

## 🔴 Security Bugs

### SEC-001 — Dynamic SQL Column Injection in Plan Update Route
- **Symptom:** `PUT /admin/network-subscription-plans/:id` built UPDATE SQL dynamically from all keys in `req.body` without any filtering — an attacker could inject arbitrary column names.
- **Root Cause:** `Object.keys(req.body).forEach(...)` with no whitelist; any key sent in the body became a column name in the SQL query.
- **Fix:** Added `allowedFields` array whitelist; only fields in the whitelist are allowed through via `Object.fromEntries(Object.entries(req.body).filter(([k]) => allowedFields.includes(k)))`.
- **Rule:** ANY dynamic SQL built from request body keys MUST use an explicit allowedFields whitelist. Never use `Object.keys(req.body)` directly in SQL construction.

### SEC-002 — PUT /hospital-networks/:id/members/:userId Only Checked corporate_admin — Hospital Director Excluded
- **Symptom:** Hospital director could add members (POST) and remove members (DELETE), but could NOT edit member roles (PUT returned 403). Inconsistent permission enforcement across the three member management operations.
- **Root Cause:** PUT route inline handler checked `network_role !== 'corporate_admin'` only. POST and DELETE both used controller's `ensureNetworkAccess(['corporate_admin', 'hospital_director'])`. Also: no whitelist validation on the `networkRole` body field — any string was accepted as a valid network role.
- **Fix:** Changed PUT check to `!['corporate_admin', 'hospital_director'].includes(...)`. Added `allowedRoles` whitelist for networkRole body field.
- **Rule:** POST, PUT, and DELETE on the same resource MUST use identical role authorization. When one is updated, grep for the others and sync.

## 🔴 Permission / Role Bugs

### PERM-001 — hospital_staff Could Not See Hospital Networks Nav Menu or Access Page
- **Symptom:** Users with system role `hospital_staff` (including those who are hospital directors in their network) could not navigate to Hospital Networks page — menu item was hidden and route guard blocked access.
- **Root Cause:** 4-file desync: (1) Navigation.tsx only listed `['admin', 'corporate_admin']` for hospital-networks menu. (2) PermissionService.ts didn't give `hospital_staff` any `hospital_network_*` permission. (3) NAV_PERMISSION_MAP pointed at `hospital_network_manage` (which only corporate_admin and admin had).
- **Fix:** (1) Added `hospital_staff` to nav roles. (2) Added `hospital_network_view` to hospital_staff permissions. (3) Changed NAV_PERMISSION_MAP to use `hospital_network_view` (lower bar).
- **Rule:** When adding a role to any one of the 4 permission files, ALWAYS check all 4. The nav item needs BOTH the role in the `roles` array AND a permission the role actually has in PermissionService.ts.

### PERM-002 — Staff Invite Routes Only Accepted System Roles admin/corporate_admin/veterinarian — Not hospital_staff
- **Symptom:** Hospital director with system role `hospital_staff` (created via invite-accept flow) could not invite new staff, view invites, or revoke invites. Got 403 Forbidden.
- **Root Cause:** `roleMiddleware(['admin', 'corporate_admin', 'veterinarian'])` checks the user's SYSTEM role (`users.role`), not their network role. Hospital directors created via the invite flow have system role `hospital_staff`, which wasn't in the list.
- **Fix:** Added `hospital_staff` to roleMiddleware for invite-staff, staff-invites list, and staff-invites delete. Added secondary inline network-role check (`['corporate_admin', 'hospital_director']`) to verify the caller actually has authority within the specific network.
- **Rule:** Route middleware `roleMiddleware()` checks SYSTEM role. If a network role (hospital_director) can be held by multiple system roles (veterinarian, hospital_staff), ALL system roles must be in the middleware list. Always add secondary network-role verification inline.

### PERM-003 — Dead Permission `hospital_staff_invite: []` in PermissionContext.tsx
- **Symptom:** No functional impact, but confusing dead code — an empty permission mapping that was never used.
- **Fix:** Removed the dead entry.
- **Rule:** Permission entries in PERMISSION_ROUTE_MAP must map to at least one route. Empty arrays are dead code.



### DEPLOY-008 — Unused Native Module (sharp) → Render Build Fails with Status 1
- **Symptom:** `Deploy failed: Exited with status 1` during build phase (not startup). Local `npm install` and `vite build` both pass fine.
- **Root Cause:** `sharp` v0.34.5 was in `frontend/devDependencies` but **never imported anywhere** in the codebase. It is a native C++ module (libvips bindings). On Render's Linux build environment the pre-built binary can fail to install if glibc version mismatches, causing `npm install` to exit 1 and fail the entire build.
- **Fix:** Removed `sharp` from `frontend/package.json` devDependencies. Updated `package-lock.json` (removed 85 sharp-related entries, 568 lines).
- **Rule:** NEVER add native modules (sharp, canvas, bcrypt compiled, etc.) to frontend dependencies. If a native module is truly needed, verify it is actually imported before committing.

### DEPLOY-009 — Vite Bundles 1,585KB Single Chunk → Render Free Tier OOM (Status 2)
- **Symptom:** `Exited with status 2 because of an internal system error` — Render's wording for OOM kill during build. Local build passes perfectly.
- **Root Cause:** Vite's default output is a single `index.js` bundle. At 1,585 KB minified, Rollup holds the entire bundle in RAM during minification. Render free tier has only 512 MB RAM — this OOM-kills the Node.js build process.
- **Fix:** Added `build.rollupOptions.output.manualChunks` in `vite.config.ts` to split vendor libs into separate chunks. Rollup minifies each chunk independently so peak RAM = largest single chunk, not total bundle.
  - `vendor-react`: react, react-dom, react-router-dom
  - `vendor-maps`: leaflet, react-leaflet
  - `vendor-markdown`: react-markdown
  - `vendor-i18n`: i18next + plugins
  - `vendor-socket`: socket.io-client
  - `vendor-query`: @tanstack/react-query
  - Result: index.js **1,585 KB → 1,174 KB**
- **Rule:** ALWAYS configure `manualChunks` in `vite.config.ts` when adding large vendor dependencies. Never let the main `index.js` chunk exceed ~600 KB on a free-tier build environment.


- **Symptom:** `Deploy failed: Exited with status 1` — intermittent, especially on cold Render deploys
- **Root Cause:** `index.ts` awaited `connectWithRetry()` (up to 190 seconds: 5×30s timeout + 10s waits) BEFORE calling `httpServer.listen()`. Render's health check fires within ~60s. If the Render free-tier PostgreSQL DB is sleeping, the port is never bound in time → deploy marked failed.
- **Why intermittent:** On fast days (DB warm) retry #1 succeeds in <5s and port binds in time. On slow days (DB cold) all 5 retries timeout → 190s with no port.
- **Fix:** Bind `httpServer.listen()` FIRST. Connect DB in background AFTER. Never call `process.exit(1)` on DB failure after port is bound.
- **Rule:** HTTP port MUST be the FIRST operation in `startServer()`. DB connect ALWAYS goes after.

```typescript
// CORRECT order in index.ts:
const server = httpServer.listen(config.app.port, ...);  // ← FIRST
// then in background:
await connectWithRetry();  // ← AFTER, failures are logged not fatal
```

---

### DEPLOY-002 — render-start.sh Inline Node Pools No Timeout → Hung Forever
- **Symptom:** Render deploy hangs for many minutes then fails
- **Root Cause:** Inline `node -e "..."` scripts had `connectionTimeoutMillis` but no outer shell `timeout` wrapper. If DB was completely unreachable, node hung until OS killed it.
- **Fix:** Every `node` subprocess in render-start.sh has BOTH:
  1. Outer `timeout N` shell wrapper
  2. `connectionTimeoutMillis` < N so node exits cleanly before shell kills it
- **Current values:** schema=`timeout 90`/25000ms (with 4-attempt retry loop), VET_PROFILE_COUNT=`timeout 20`/15000ms, migrations=`timeout 40`, seed=`timeout 120`

---

### DEPLOY-006 — uuid-ossp Extension Fails on Render → ALL Tables Never Created → Login/Register Always Fails
- **Symptom:** Deployment succeeds, port binds, health check passes, but login AND registration both fail with "Error fetching user by email" — even after DB is fully warm
- **Root Cause:** `docker/init.sql` started with `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`. Render's managed PostgreSQL runs as a restricted user — `CREATE EXTENSION` requires superuser. This line THREW an error, which aborted the entire `init.sql` execution. Zero tables were created.
- **Chain:** `uuid-ossp` extension fail → init.sql aborts → `users` table never exists → `getUserByEmail` throws `DatabaseError` → login fails permanently → same for register
- **Why silent:** The error was caught by catch blocks, and the catch re-threw as a generic `DatabaseError('Error fetching user by email')` — hiding the real PostgreSQL error
- **Fix:** Replace ALL `uuid_generate_v4()` → `gen_random_uuid()` (built-in PostgreSQL 13+, no extension needed). Remove `CREATE EXTENSION uuid-ossp` line entirely.
- **Files changed:** `docker/init.sql` (48), `docker/seed-demo-data.sql` (405), `docker/seed.sql` (20), `backend/src/utils/database.ts` (16), all migration .ts files (total 573 replacements)
- **Rule: NEVER use `uuid_generate_v4()` — always use `gen_random_uuid()`**
- **Rule: NEVER add `CREATE EXTENSION` to init.sql — Render managed PostgreSQL does not allow it**

---

### DEPLOY-007 — ensureSchemaPublic() Ran init.sql Before Creating Schema → Tables Created in Wrong Schema
- **Symptom:** Server logs "Schema created successfully" but tables actually end up in `public` schema not `vetcare_prod`
- **Root Cause:** `ensureSchemaPublic()` checked if `users` table exists in `vetcare_prod`, then ran `init.sql` without first creating the `vetcare_prod` schema. PostgreSQL defaulted to `public`.
- **Fix:** `ensureSchemaPublic()` now does `CREATE SCHEMA IF NOT EXISTS "vetcare_prod"` BEFORE running init.sql
- **Rule:** Always create the schema first, then create tables inside it

---

### AUTH-001 — Registration Shows "Error fetching user by email" Instead of Real Error
- **Symptom:** User tries to register, gets "Error fetching user by email" — confusing because they're not logging in
- **Root Cause:** `AuthController.register()` calls `getUserByEmail(email)` first to check if email is taken. If the DB is broken (table missing), this throws and bubbles up as the raw `DatabaseError` message
- **Fix:** Added self-heal to `register()` same as `login()` — if `getUserByEmail` fails, run `ensureSchemaPublic()` + `fixDemoPasswords()` then retry. Shows "Database is not ready yet. Please retry." on heal failure.
- **Rule:** ANY endpoint that calls `getUserByEmail` must handle DB errors gracefully with self-heal

---


- **Symptom:** Deployment "succeeds" (port binds, health check passes) but ALL logins fail with "Error fetching user by email" — permanently, not just briefly
- **Root Cause:** Chain of failures:
  1. Free-tier DB sleeps and takes 30-90s to wake
  2. render-start.sh Step 0 had only `connectionTimeoutMillis: 15000` → times out → schema/tables never created
  3. `connectWithRetry()` in index.ts only tried 5×10s = 50s max → if DB took >50s, gave up → `fixDemoPasswords()` NEVER called
  4. `fixDemoPasswords()` failure was silently swallowed — no retry
  5. DB wakes eventually, pool auto-reconnects, but `users` table has zero rows → all logins fail
- **Fix applied:**
  1. `render-start.sh` Step 0: Added retry loop (4 attempts × 90s timeout + 25s sleep between = 6min budget) + connectionTimeoutMillis: 25000
  2. `index.ts` `connectWithRetry`: Increased to 10 attempts × 12s = 120s max
  3. `index.ts` `fixDemoPasswords`: Added 30s retry if first attempt fails
- **Manual recovery:** If PROD is stuck: Render → vetcare-app → Environment → FORCE_RESEED=true → Manual Deploy → wait for "✓ Seed complete" in logs → set FORCE_RESEED=false

---

### DEPLOY-003 — config.ts process.exit(1) Fires Before Port Binds
- **Symptom:** Deploy fails instantly with no HTTP server logs at all
- **Root Cause:** `config/index.ts` has synchronous `process.exit(1)` calls at module load time — triggered if `DATABASE_URL` is missing OR `JWT_SECRET` is a default value. These execute during `import config from './config'`, before any `http.createServer()`.
- **Prevention:** Always verify in Render dashboard before deploying:
  - `DATABASE_URL` is set (Render PostgreSQL sets this automatically)
  - `JWT_SECRET` is NOT `change-this-in-production` or `dev-jwt-secret-do-not-use-in-production`
  - `NODE_ENV=production`
  - `DB_SCHEMA` is set (vetcare_dev or vetcare_prod)

---

### DEPLOY-004 — enterpriseMigration.ts Calls process.exit(1) on SQL Error
- **Symptom:** render-start.sh migration step exits with code 1
- **Root Cause:** `enterpriseMigration.ts` line 347 calls `process.exit(1)` on any SQL error (tier2/3/4 correctly `throw` instead)
- **Guard:** The `|| echo "...continuing"` in render-start.sh catches this. **Never remove those guards.**
- **Future fix:** Change `process.exit(1)` → `throw error` in enterpriseMigration.ts to match tier2/3/4 pattern

---

### AUTH-002 — CertificateController Wrong req.user Pattern — 403 for All Roles
- **Symptom:** "Only veterinarians can create certificates" even when logged in as a Veterinarian role user
- **Root Cause:** `CertificateController.ts` used `(req as any).user?.id` and `(req as any).user?.role` throughout all 7 methods. `authMiddleware` sets `req.userId` and `req.userRole` — NOT `req.user`. So `role` was always undefined, failing the role check for everyone.
- **Why other controllers worked:** Tier2Controller, Tier3Controller etc all use `(req as any).userId` and `(req as any).userRole` correctly. Only CertificateController used the wrong pattern.
- **Fix:** Replaced all `(req as any).user?.id` with `(req as any).userId` and `(req as any).user?.role` with `(req as any).userRole` in all 7 methods.
- **Rule:** authMiddleware sets req.userId and req.userRole. NEVER use req.user?.id or req.user?.role.

---

### CSS-005 — module-tabs and module-btn Missing from modules.css — Broken Tabs on 3 Pages
- **Symptom:** Step tabs and buttons appear unstyled (plain boxes) on CertificateWriter, VetCertificates, VaccinationPassport. User reports "CSS is breaking again" — recurring complaint.
- **Root Cause:** `.module-tabs`, `.module-tab`, `.module-btn` were ONLY defined in `ModulePage.css`. But 3 pages import `modules.css` (not `ModulePage.css`), so they never received these styles.
- **Pages affected:** CertificateWriter.tsx, VetCertificates.tsx, VaccinationPassport.tsx
- **Fix:** Added `.module-tabs`, `.module-tab` (.hover + .active), `.module-btn` (.hover + .primary + .small + :disabled) to `modules.css` as canonical global location.
- **Rule:** `modules.css` is the single source of truth for ALL shared design-system classes. If a class is used in ANY page component, it MUST be defined in `modules.css` — NOT only in `ModulePage.css`.

### CSS-006 — ENTIRE Design System Missing from modules.css — ALL Pages Importing Only modules.css Were Broken
- **Symptom:** Certificate module (VetCertificates.tsx etc.) had unstyled headers, cards, tables, inputs, alerts, forms. Error alerts rendered as plain text with no background/border.
- **Root Cause:** `ModulePage.css` is the file where the design system grew organically, but `modules.css` was supposed to be the global file. Pages like VetCertificates only import `modules.css`, never `ModulePage.css`. Result: `module-header`, `module-card`, `module-table`, `module-input`, `module-label`, `module-alert`, `module-alert.error`, `module-alert.success`, `module-form`, `module-form-row`, `module-form-row-3`, `module-form-group`, `module-badge`, `module-stats`, `module-content`, `edit-form-overlay`, `edit-form-panel`, `edit-form-close` — ALL were missing.
- **Root Cause 2:** `module-alert-close` used as explicit className in JSX but NO CSS class existed anywhere. Only `.module-alert button` existed in ModulePage.css.
- **Fix:** Added ALL missing design-system classes to `modules.css` as the canonical global location. Also added `.module-alert-close` class alongside `.module-alert button`.
- **Rule:** `modules.css` is the ONLY place design-system classes should be defined. When adding any new class to the design system, ALWAYS add it to `modules.css` first. Never define it only in `ModulePage.css`.

---

### CSS-001 — Scrollbar Overflow on All Pages
- **Root Cause:** `.module-page { min-height: 100vh }` inside a flex child that already has a 100vh parent
- **Fix:** Always `min-height: calc(100vh - 64px)` + `box-sizing: border-box` on `.module-page`

### CSS-002 — Mobile Nav Hidden
- **Root Cause:** CSS `display: none` overriding React conditional render
- **Fix:** Never put `display: none` on elements that React conditionally renders

### CSS-003 — Nav Bar Items Overflow at 1024–1200px
- **Root Cause:** No intermediate breakpoints between 1200px and 768px; total nav width exceeded container
- **Fix:** Count total width of ALL nav items at 1200px AND 1024px before adding any. Always add intermediate breakpoints, not just 768px.

### CSS-004 — Floating Element Overlapping Fixed Nav
- **Root Cause:** Fixed-position element (z-index: 9998) overlapping fixed nav bar (z-index: 1000)
- **Fix:** Fixed/floating elements must account for ALL fixed/sticky elements on every page they render on

---

## 🔴 Backend / API Bugs

### API-001 — Prescription "Failed to Create"
- **Root Cause:** Joi schema required `instructions` and `duration` but the UI made them optional
- **Fix:** Joi schemas MUST exactly match frontend form field requirements (required vs optional)

### API-002 — Error Display Mismatch
- **Root Cause:** Backend sent `{ errors: [...] }` but frontend expected `error.message`
- **Fix:** Always verify error response format is consistent between BE and FE before shipping

### API-003 — AI Chat Messages Invisible
- **Root Cause:** PostgreSQL returned snake_case column names; frontend TypeScript expected camelCase
- **Fix:** Use `AS "camelCase"` aliases in ALL SELECT queries that return data to the frontend

### API-005 — animals.map / R.map is not a function — API Response Shape Mismatch
- **Symptom:** Clicking "New Reminder" (or any button that triggers a re-render with `animals.map()`) throws `R.map is not a function` / "Something went wrong"
- **Root Cause (1):** `AnimalService.listAnimals()` returns `{ animals: [...], total: N }` but 3 pages accessed `.data?.items` (undefined) then fell back to `.data` (the whole object, not an array). `animals.map()` on an object → crash.
- **Root Cause (2):** `WellnessService.listScorecards` returned raw DB rows where `recommendations` and `risk_flags` are stored as `JSON.stringify()` TEXT strings. Frontend called `sc.recommendations.map()` on a string → crash. Also `sc.riskFlags` was undefined (column name is `risk_flags` in snake_case, not camelCase).
- **Files fixed:** `WellnessPortal.tsx`, `HospitalBooking.tsx`, `FloatingChatWidget.tsx`, `WellnessService.ts`
- **Rule 1:** ALWAYS access `listAnimals` response as `res.data?.animals || res.data?.items || []` — never `.data` as fallback (it's an object, not array)
- **Rule 2:** NEVER store arrays as `JSON.stringify()` TEXT in DB and call `.map()` on the raw return. Either use JSONB type or parse explicitly with a helper before returning from the service.
- **Rule 3:** ALL SQL columns used in the frontend MUST be aliased to camelCase in SELECT. Never rely on snake_case column names reaching the frontend.

---


- **Root Cause:** Query used `a.microchip_number` and `a.avatar_url` — neither column exists in the schema. PostgreSQL threw an error, catch block swallowed it, frontend silently showed "No animals found"
- **Fix:** ALWAYS cross-reference every column name against `docker/init.sql` before writing SQL. Silent try/catch is a major trap — log errors even if you continue.

### API-006 — CertificateService.getById() Used a.avatar_url → "Failed to load certificate for printing"
- **Symptom:** Clicking the 🖨 print/view button on any certificate throws "Failed to load certificate for printing" for ALL users (doctor + patient)
- **Root Cause:** `CertificateService.getById()` SQL query included `a.avatar_url as "animalAvatar"`. The `animals` table has NO `avatar_url` column (only `users` does, at line 30 of init.sql). PostgreSQL threw `column a.avatar_url does not exist`. The controller's catch block returned 500, frontend displayed the i18n error string.
- **Fix:** Removed `a.avatar_url as "animalAvatar"` from the JOIN query and `animalAvatar: r.animalAvatar` from `mapRow()`.
- **Rule:** ALWAYS grep `docker/init.sql` for a column name before using it in any SQL JOIN. Never assume columns from memory — especially from related tables. The animals table uses `name`, `species`, `breed`, `date_of_birth`, `gender` — NOT `avatar_url`.

### API-007 — Unsafe String Method Calls on API Fields → Runtime Crash
- **Symptom:** Clicking into a page (e.g. AlertCenter, FinancialAnalytics) throws `Cannot read properties of undefined (reading 'replace')`. Crashes the entire React component tree for that page.
- **Root Cause:** Code calls `.replace()`, `.split()`, `.toUpperCase()` etc. directly on API response fields (e.g. `r.ruleType.replace(/_/g,' ')`). TypeScript types declare these as `string` but DB rows can have NULL values at runtime — TypeScript never catches this.
- **Pattern seen in:** AlertCenter (ruleType), FinancialAnalytics (category), ComplianceDocs (documentType, status), ManageSchedule (holidayType), StaffSettings (position), InpatientManagement (status, admission_type), HospitalWorkflow (status), SupplyChain (status), DiseasePrediction (severity), Consultations/HospitalBooking/FindDoctor/BookConsultation/MyBookings/PatientQueue (startTime)
- **Fix:** Always guard: `(field || '').replace(...)` and `(field || '00:00').split(':')` — never call string methods directly on any API-sourced field
- **Rule:** ALL `.replace()` / `.split()` / `.toUpperCase()` / `.toLowerCase()` calls on API response fields MUST use `(field || '')` fallback. TypeScript types are compile-time only — DB NULLs bypass them entirely.
- **False positives (already safe):** Cases where the value is (a) already guarded by a ternary `field ? field.method() : default`, (b) wrapped in an `{field && ...}` JSX conditional, (c) initialized from controlled form state with a `''` default, or (d) protected by `|| []` on the containing map call.

### API-008 — Marketplace Publish 400: DB Gender/Species Case Mismatch + Error Message Swallowed
- **Symptom:** "Request failed with status code 400" when publishing an animal in Marketplace (Farmer role). The actual Joi validation error is never shown — user has no idea what to fix.
- **Root Cause (1 — the 400):** `seed-demo-data.sql` inserts some animals with `gender = 'Male'`/`'Female'` (capitalized). The Joi schema for `createMarketplaceListing` validates `gender` against `['male', 'female', 'unknown']` (lowercase). The auto-fill function (`handleAnimalSelect`) copies `animal.gender` directly from the API without normalizing case → Joi rejects the payload with 400.
- **Root Cause (2 — invisible error):** The `validateBody` middleware returns `{ message: "..." }` on 400. The frontend read `e?.response?.data?.error?.message` (wrong path) and fell back to the generic Axios `e.message` = "Request failed with status code 400". The real Joi error was completely hidden from the user.
- **Fix (1):** In `createListing()` payload building, normalize: `payload.gender = payload.gender?.toLowerCase()` and `payload.species = payload.species?.toLowerCase()` before calling the API.
- **Fix (2):** Error catch: `e?.response?.data?.message || e?.response?.data?.error?.message || e.message` — always check BOTH `data.message` and `data.error.message` paths.
- **Rule:** ALWAYS normalize string enum fields (gender, species, status, role etc.) to the correct case at the point they leave the frontend — DB values can have inconsistent casing. NEVER trust that DB-sourced auto-fill values match Joi enum values.
- **Rule:** When debugging a 400 error, ALWAYS log `e?.response?.data` in full — never just `e.message`. Frontend error display must check all possible error paths the backend uses.

### API-009 — getNetworkAuditLogs URL Malformed in api.ts (regex instead of template literal)
- **Symptom:** Would have caused runtime error: "Cannot call .get() with a regex argument" when Audit tab loaded
- **Root Cause:** `api.ts` line 2160 had `this.client.get(/hospital-networks/\/audit-logs, ...)` — a regex literal instead of a template literal string. The URL parameter `networkId` was also missing.
- **Fix:** Changed to `this.client.get(\`/hospital-networks/${networkId}/audit-logs\`, { params: filters })`
- **Rule:** Always verify template literal backticks when writing URL paths with dynamic segments — regex-looking patterns near `/` characters can silently become regex literals if backticks are missing.

---

### I18N-001 — Page Shows Raw Key Paths (herdMedical.pageTitle etc.)
- **Root Cause:** `t('herdMedical.*')` used throughout a page but `"herdMedical": {}` top-level object was never added to any of the 5 locale files. react-i18next fails silently — no console error, no warning.
- **Fix:** When adding any new `t('namespace.key')`, verify `"namespace": {}` exists in ALL 5 locale files BEFORE using any t() calls.
- **Validation:** `node -e "require('./frontend/src/locales/en/translation.json')"`

### I18N-002 — Hindi Locale JSON Broken by Double-Comma
- **Root Cause:** Two separate edits both added a trailing comma on the same JSON key → `,,` = invalid JSON. No explicit validation in pre-push hook.
- **Fix:** After editing ANY locale JSON file, validate ALL 5: `node -e "require('./frontend/src/locales/hi/translation.json')"`

---

## 🔴 Navigation & Deep Link Bugs

### NAV-001 — "Open Full Record" Navigated to Generic Overview Page
- **Root Cause:** Navigation link passed no record ID; target page didn't read URL params; clicking any specific record opened the generic overview
- **Fix:** EVERY navigation to a specific record MUST pass the record's ID via query/route param. Target page MUST auto-select and highlight that record.
- **Pattern:** `/medical-records?animalId=X&recordId=Y&tab=diagnoses`

### NAV-002 — Vet "My Pets" Showed Other People's Animals
- **Root Cause:** `listAnimalsByVeterinarian()` queried booking/consultation tables (professional relationship), not `owner_id = userId` (ownership)
- **Fix:** "My X" for ANY role always means the user's OWN records. Query must align with page intent, not professional role.

---

## 🔴 Settings Enforcement Bugs

### SETTINGS-001 — Time Slots Ignored Admin Time Format Setting
- **Root Cause:** FindDoctor page used a hardcoded local `formatTime12h()` helper instead of `useSettings()`. Also showed past time slots for today's date.
- **Fix:** ALL time/date/currency displays MUST use `useSettings()` formatters (`formatSlotTime`, `formatDate`, `formatCurrency`). NEVER create local format helpers. Filter past slots with 15-min buffer.

---

## 🔴 Permissions Bug

### PERM-001 — Pet Owner Seeing Farm Menus
- **Root Cause:** `pet_owner` role was accidentally given `enterprise_manage` permission during a change that only updated PermissionService but not the other 3 files
- **Fix:** Permission changes require 4-file sync: `PermissionService.ts` + `PermissionContext.tsx` + `Navigation.tsx` + `App.tsx`

---

## 🔴 Feature Completeness Bug

### FEAT-001 — Marketplace Listing Pre-fill Missing After Delivery
- **Root Cause:** Planned feature (pre-fill listing from animal profile) was in the original spec but not implemented; only caught by user after delivery
- **Fix:** Before closing any feature, cross-check ALL planned sub-features in `feature-tracker.md`. Mark ⚠️ Planned items that were skipped with reason.

---

## 🔴 Testing Bug

### TEST-001 — E2E Pre-Push Generator Overwrote Manual Stubs
- **Root Cause:** Generator script rewrote `auto-discovered.spec.ts` on every run, stripping manually added stubs from prior commits
- **Fix:** For frontend-only routes (accept-invite, animal-timeline etc.) manually append stubs to `auto-discovered.spec.ts`. Verify pre-push hook assertion count matches expected total before pushing.

### UI-005 — UserManagement Role Dropdowns Used 'vet' Instead of 'veterinarian'
- **Symptom:** Admin could not change a vet's role or filter vets by role — UI sent `'vet'` but DB stores `'veterinarian'`
- **Root Cause:** `getRoleBadge()`, role filter `<select>`, and role-change modal dropdown all used value `'vet'` instead of `'veterinarian'`. Long-standing copy-paste error from initial implementation.
- **Fix:** Changed all three locations to `'veterinarian'` in `UserManagement.tsx`. Also added `farmer` and `corporate_admin` options that were missing entirely.
- **Rule:** The only valid role strings in the DB are: `pet_owner`, `veterinarian`, `farmer`, `admin`, `corporate_admin`. Never use abbreviated forms like `'vet'`.

### INFRA-001 — PowerShell Here-String Corrupts Template Literals in TypeScript
- **Symptom:** `adminApi.ts` had `/role-change-requests/+id+/cancel` instead of backtick template literal — TypeScript parsed this as regex, threw "Unterminated regular expression literal"
- **Root Cause:** PowerShell `Add-Content` or `Out-File` with here-strings (`@"..."@`) corrupts backtick characters — PowerShell uses backtick as its own escape character, stripping them from content
- **Fix:** Use the `edit` tool (not PowerShell file write) when inserting TypeScript template literals. If PowerShell writes fail, fix in the source file directly with edit tool.
- **Rule:** NEVER use PowerShell `Add-Content`/`Out-File`/`Set-Content` to write TypeScript template literals (`\`...\``). Use the edit tool instead.

### INFRA-002 — JSX `<style>` Tag Disconnected When Inserting JSX Before It
- **Symptom:** Settings.tsx had raw CSS text (`.settings-container { ... }`) in the JSX body — TypeScript threw 50+ parse errors
- **Root Cause:** Prior edit inserted new JSX section but left the `<style>{`` opening on the wrong line — the JSX `<style>` block was split, leaving raw CSS exposed as invalid JSX tokens
- **Fix:** After inserting JSX before a `<style>` tag, always verify the `<style>{`` opening is intact on its own line immediately before the first CSS rule
- **Rule:** When adding JSX before a `<style>` tag in a component, verify the closing `</div>` + `<style>{\`` sequence is correct after the edit

---

## Deployment Checklist (Run Before Every Deploy)

```
[ ] NODE_ENV=production set in Render env vars
[ ] DATABASE_URL set in Render env vars (auto-set by Render PostgreSQL add-on)
[ ] JWT_SECRET is a real secret — NOT any default value
[ ] DB_SCHEMA set: vetcare_dev (develop branch) or vetcare_prod (main branch)
[ ] index.ts: httpServer.listen() is called BEFORE connectWithRetry()
[ ] render-start.sh: all node subprocesses have timeout + connectionTimeoutMillis
[ ] No process.exit(1) in background DB init path after port is already bound
[ ] TypeScript passes: npx tsc --noEmit in both frontend/ and backend/
[ ] All 5 locale JSON files valid: node -e "require('./frontend/src/locales/hi/translation.json')"
[ ] All SQL column names cross-referenced against docker/init.sql
[ ] NO uuid_generate_v4() anywhere — must be gen_random_uuid() (uuid-ossp breaks Render)
[ ] NO CREATE EXTENSION in init.sql — Render managed PG doesn't allow it
[ ] git push origin develop (NOT main — use GitHub Actions to promote to PROD)
```

## Required Render Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Auto-provided by Render PostgreSQL |
| `JWT_SECRET` | ✅ | Long random string, never a default value |
| `NODE_ENV` | ✅ | Must be `production` |
| `DB_SCHEMA` | ✅ | `vetcare_dev` (develop) or `vetcare_prod` (main) |
| `PORT` | Auto | Render sets this automatically |
| `RENDER_EXTERNAL_URL` | Auto | Render sets this automatically |
| `CORS_ORIGIN` | Recommended | Set to your frontend URL |
| `GROQ_API_KEY` | Optional | AI Copilot — Groq provider (free tier) |
| `OPENAI_API_KEY` | Optional | AI Copilot — OpenAI provider (fallback) |
| `FORCE_RESEED` | Optional | Set `true` to force re-seed demo data on next deploy |

## Render Startup Sequence (How It Works)

```
render-build.sh
  → npm install + npm run build  (frontend → Vite → dist/)
  → npm install + npm run build  (backend → tsc → dist/)

render-start.sh
  Step 0: timeout 45  — Create DB schema + run init.sql          [non-fatal if fails]
  Step 1: timeout 40  — Run 4 enterprise/tier migrations          [non-fatal if fails]
  Step 2: timeout 20  — Check VET_PROFILE_COUNT                   [defaults to 0 if fails]
        → timeout 120 — Seed demo data if count=0                 [non-fatal if fails]
  Step 3: exec node dist/index.js                                 [MUST succeed]
    → httpServer.listen(PORT)           ← FIRST: port bound immediately
    → connectWithRetry() in background  ← SECOND: DB connect, 5 attempts × 10s
    → cache, scheduler, demo passwords  ← THIRD: all non-critical services
```

**If steps 0–2 fail:** Logged + continued. Server still starts.
**If step 3 port bind fails:** Deploy fails. Only happens on port conflict or OOM.
**If DB never connects:** Server stays alive, logs errors. Render health check passes.

### UI-010 — PatientConsent v.map crash
- **Logged:** 2026-04-10 11:09
- **Symptom:** Clicking Data Consent menu crashed with v.map is not a function
- **Root Cause:** listAnimals() returns {success:true,data:{animals:[],total:N}}. PatientConsent extracted res?.data={animals:[]} (object not array) and called .map() on it
- **Fix:** Fix: Array.isArray guard chain: res.data.animals -> res.data -> res -> []
- **Rule:** NEVER use res?.data||res||[] pattern when backend wraps arrays in {animals:[],total:N}. Always use Array.isArray() to extract the actual array


### UI-011 — NetworkMemberships SQL column u_by.name
- **Logged:** 2026-04-10 11:09
- **Symptom:** My Hospital Network Memberships page crashed with Cannot read properties of undefined (reading id)
- **Root Cause:** getMyEnrollments SQL used u_by.name but users table has first_name+last_name only. SQL threw error causing 500, and also unsafe array guard setEnrollments(result??[]) kept non-array if result was truthy object
- **Fix:** Fix: u_by.first_name||space||u_by.last_name AS enrolledByName + Array.isArray(result) guard
- **Rule:** ALWAYS cross-reference SQL column names against docker/init.sql. users table has first_name and last_name NOT name


### DEMO-001 — Demo login Database not ready
- **Logged:** 2026-04-10 11:27
- **Symptom:** vetcare-demo login shows persistent red error - Database is not ready yet
- **Root Cause:** Neon free-tier auto-suspends + Render free-tier spins down simultaneously. Single AuthController self-heal attempt failed instantly. Also SEED_ON_STARTUP env var set by setup-demo-env.yml was ignored - render-start.sh only read FORCE_RESEED
- **Fix:** AuthController: 4-attempt retry loop with 3/6/9s delays. Login.tsx: auto-retry UI with 8s countdown. render-start.sh: reads both FORCE_RESEED and SEED_ON_STARTUP
- **Rule:** Always add retry loops for DB on Neon/free-tier cold-start - single attempt is never enough


### DEMO-002 — Demo login - users table missing in Neon DB
- **Logged:** 2026-04-10 13:34
- **Symptom:** Login always failed even after retry fix. Health check showed usersTable missing.
- **Root Cause:** init.sql never ran on Neon: (1) init.sql had forward reference - hospital_patient_invites before hospital_networks, (2) current_role is a PG reserved keyword causing syntax error on role_change_requests CREATE TABLE, (3) render-start.sh Step 0 timed out on Neon cold-start and all 4 retries failed. Tables never created.
- **Fix:** Manually ran init.sql stmt-by-stmt. Fixed init.sql ordering + quoted current_role. Added uptime-monitor.yml (pings every 5min) to prevent Neon+Render spin-down.
- **Rule:** ALWAYS: (1) quote PG reserved words as column names, (2) check forward references in init.sql, (3) add uptime monitor for free-tier services


### UI-012 — Nav scroll resets to top on menu click
- **Logged:** 2026-04-10 14:40
- **Symptom:** Every menu click re-renders Navigation component, causing .nav-menu scroll container to reset to top; active item not visible
- **Root Cause:** Added useRef on .nav-menu + sessionStorage scroll persistence + rAF debounce save + scrollIntoView only when item outside visible area
- **Fix:** Always use ref+sessionStorage to persist scroll in nav containers that re-render on route changes
- **Rule:** Not specified


### UI-013 — NetworkMemberships crash: Cannot read properties of undefined (reading id)
- **Logged:** 2026-04-10 14:41
- **Symptom:** API response shape ambiguous (plain array OR {data:[]} object); filter/map called on possibly-null elements causing runtime crash
- **Root Cause:** Added result?.data fallback extraction, filter(item => item != null), optional chaining e?.enrollmentStatus, index-based key fallbacks
- **Fix:** Always extract arrays defensively: try result.data fallback + filter nulls before any map/filter
- **Rule:** Not specified


### UI-014 — Vitals modal: no labels, accepts negatives, no history view
- **Logged:** 2026-04-10 16:40
- **Symptom:** Vitals inputs had placeholder-only labels (disappear on type); no min=0 attribute; no way to see full vitals history after recording
- **Root Cause:** Added persistent labeled form groups, min=0+frontend validation, vitals history modal with reverse-chronological entries
- **Fix:** ALL form fields must use persistent labels not just placeholders. Vitals/numeric fields always need min=0 + server-side guard
- **Rule:** Not specified


### UI-015 — HospitalWorkflow: No Show button visible for in-exam/in-treatment patients
- **Logged:** 2026-04-10 16:40
- **Symptom:** No Show button shown for all non-discharged queue items — patients in_examination or in_treatment are physically present, cannot be no-show
- **Root Cause:** Fixed: No Show only visible when status === waiting
- **Fix:** Queue status actions must be logically gated: no-show = waiting only, discharge = any active status
- **Rule:** Not specified


### UI-016 — Inpatient status color inconsistency
- **Logged:** 2026-04-11 13:52
- **Symptom:** Stat cards showed amber for admitted and red for in_treatment; patient card borders showed blue for admitted and amber for in_treatment; filter pills were all the same blue regardless of status — 3 different color systems for the same statuses
- **Root Cause:** STATUS_COLORS map had no icon field; stat cards used hardcoded inline color array with different values; filter pills used flat hardcoded #2563eb
- **Fix:** Added icon field to STATUS_COLORS; stat cards now reference STATUS_COLORS[statusKey].color and .icon; filter pills use STATUS_COLORS[s].bg when inactive and .color when active; patient cards kept existing STATUS_COLORS usage but also added borderLeft stripe
- **Rule:** Single STATUS_COLORS map must be the ONLY source of truth for all status-based colors — never define parallel inline color arrays for the same statuses


### DEPLOY-011 — Render free-tier keeps spinning down despite GitHub Actions uptime monitor
- **Logged:** 2026-04-12 11:03
- **Symptom:** Service wakes from inactivity on every user visit — GitHub Actions cron delayed 10-30+ min by GitHub queue pressure, missing Render's 15-min idle window even with two overlapping schedules
- **Root Cause:** GitHub Actions cron is best-effort, not guaranteed — cannot be relied on as sole keep-alive for Render free tier
- **Fix:** Added startSelfPing() in index.ts: server pings own RENDER_EXTERNAL_URL/api/v1/health every 10 min using built-in https module. Render load balancer sees it as real incoming traffic and resets idle timer. First ping after 5 min warmup. Only active in production with RENDER_EXTERNAL_URL set. GitHub Actions monitor kept as secondary fallback.
- **Rule:** NEVER rely solely on GitHub Actions cron to keep Render free-tier warm — self-ping from within the Node.js process is the only reliable approach


### UI-017 — Triage modal had contradictory dual-input: numeric level + priority dropdown
- **Logged:** 2026-04-12 11:13
- **Symptom:** triageLevel (1-5) and priority (emergency/urgent/high/normal/low) were the same concept shown as two independent controls — user could select Level 5 (Minor) + Emergency, a medically contradictory combination
- **Root Cause:** Two separate state fields for the same concept; no coupling between them; no validation preventing contradiction
- **Fix:** Removed priority field from triageForm; added TRIAGE_LEVELS map auto-deriving priority from level; redesigned modal with single color-coded row selector (number + label + description + color in one button); shows auto-derived priority badge as confirmation
- **Rule:** NEVER represent the same concept as two independent UI controls — derive one from the other or merge into a single unified control


### UI-018 — Hospital queue — duplicate check-in, non-clickable tiles, missing check-in time
- **Logged:** 2026-04-12 11:24
- **Symptom:** Same patient (Buddy) appeared twice in queue (#1 and #2) because no duplicate prevention existed. Stat tiles were static divs with no onClick. Queue rows showed no check-in timestamp. Filter numbered from global queue_number even when viewing a single status group.
- **Root Cause:** No UNIQUE constraint or service-level duplicate check in checkInToQueue(); stat tiles had no filter state; checked_in_at was stored in DB but never rendered; queue numbering was always global
- **Fix:** Backend: duplicate check before INSERT throws DUPLICATE_CHECKIN error surfaced as HTTP 409. Frontend: clickable tiles set queueStatusFilter state; per-status position shown as primary number when filtered; checked_in_at displayed on each row; check-in modal has error banner + loading state.
- **Rule:** ALWAYS prevent duplicate active queue entries at the service layer before INSERT. ALWAYS make stat/dashboard tiles clickable to filter the related list below.


### UI-019 — Vitals history always empty — JSONB parsed as JSON string
- **Logged:** 2026-04-12 11:38
- **Symptom:** Vitals recorded successfully but 'Last Vitals' bar never appeared; history modal showed 'No vitals recorded'
- **Root Cause:** PostgreSQL JSONB columns are returned by the pg driver as native JS arrays. Frontend did JSON.parse(array) which threw SyntaxError silently caught by try/catch, always returning []
- **Fix:** Added parseJsonbArray() helper: checks Array.isArray() first, falls back to JSON.parse only for strings. Applied to vitals_log and medications columns.
- **Rule:** NEVER call JSON.parse() directly on JSONB columns — always check Array.isArray() first.


### UI-018 — Referral form asked for raw Vet User ID UUID
- **Logged:** 2026-04-12 15:20
- **Symptom:** Symptom: New Specialist Referral modal had a plain text input labeled 'Vet user ID' — users had no way to discover other vets' UUIDs. Root Cause: toVetId was implemented as a text input with no search/autocomplete. Fix: Created VetSearchPicker component with GET /vets/search API, pre-loads all vets, smart search by name/specialization/clinic/license. Rule: NEVER implement foreign-key fields as raw UUID text inputs — always use a searchable picker component.
- **Root Cause:** Not specified
- **Fix:** Not specified
- **Rule:** Not specified


### API-019 — req.user!.id instead of req.userId in hospital network routes
- **Logged:** 2026-04-12 15:28
- **Symptom:** Symptom: My Hospital Network Memberships page showed 'Cannot read properties of undefined (reading id)'. Root Cause: Routes used (req as any).user!.id but auth middleware sets req.userId directly — req.user is always undefined. Affected routes: enrollAnimal, inviteWalkIn, acceptEnrollment, declineEnrollment, getMyEnrollments. Fix: Changed all 5 occurrences to (req as any).userId in routes/index.ts. Also fixed FileController.ts which used req.user?.userId silently falling back to 'anonymous'. Rule: NEVER use req.user in this codebase. Auth middleware sets req.userId (string) and req.userRole. Always use (req as any).userId.
- **Root Cause:** Not specified
- **Fix:** Not specified
- **Rule:** Not specified


### PERF-001 — Marketplace 30s timeout on cold start
- **Logged:** 2026-04-12 15:55
- **Symptom:** timeout of 30000ms exceeded error on Marketplace page after Render free-tier DB wakes from sleep
- **Root Cause:** 1. Axios timeout was 30s but free-tier Render DB takes 30-90s to wake. 2. listListings() used correlated subqueries (N+1 per row) for bid_count/highest_bid. 3. Missing composite indexes on (status,admin_approved) and (listing_id,status) on bids. 4. Timeout errors silently rejected with no user-friendly message.
- **Fix:** 1. Raised Axios timeout to 60s in api.ts and client.ts. 2. Replaced correlated subqueries with aggregated LEFT JOIN in MarketplaceService.ts. 3. Added 4 perf indexes via seedDefaultSettings in database.ts (idempotent). 4. Added second interceptor to enrich timeout errors with isTimeout=true flag.
- **Rule:** NEVER use correlated subqueries (SELECT ... FROM t WHERE id=l.id) inside main SELECT — always use aggregated LEFT JOIN. Always raise Axios timeout to 60s for free-tier Render.


### REVIEW-001 — total_consultations used instead of total_reviews in vet profile update
- **Logged:** 2026-04-12 16:30
- **Symptom:** ReviewService.createReview() called UPDATE vet_profiles SET total_consultations = COUNT(*) FROM reviews — wrong column name and wrong semantics
- **Root Cause:** Changed to total_reviews = COUNT(*) FROM reviews WHERE status='active'
- **Fix:** NEVER update total_consultations when counting reviews; use total_reviews column which already exists in vet_profiles
- **Rule:** Not specified


### REVIEW-002 — ReviewModeration status mapping wrong — approved vs active
- **Logged:** 2026-04-12 16:30
- **Symptom:** Frontend handleModerate mapped action 'approve' to status 'approved' but DB constraint only allows active/hidden/flagged/removed. AdminService correctly maps approve->active but frontend state update had the wrong value, causing stale UI status badge
- **Root Cause:** Fixed status map: approve->active, hide->hidden, flag->flagged, unflag->active, remove->removed
- **Fix:** NEVER use 'approved' or 'pending' as review status values — DB CHECK constraint only allows active/hidden/flagged/removed
- **Rule:** Not specified


### NETWORK-001 — createNetwork orphaned network on member INSERT failure
- **Logged:** 2026-04-13 10:50
- **Symptom:** If INSERT into hospital_network_members failed after INSERT into hospital_networks succeeded, an orphaned network with no admin existed in DB
- **Root Cause:** Wrapped both INSERTs in a pg transaction with BEGIN/COMMIT/ROLLBACK using database.getPool().connect()
- **Fix:** ALWAYS wrap multi-table INSERT flows in a pg transaction — never rely on sequential awaits
- **Rule:** Not specified


### NETWORK-002 — network_type enum mismatch academic vs cooperative
- **Logged:** 2026-04-13 10:50
- **Symptom:** Frontend had 'academic' in NETWORK_TYPES array but DB CHECK constraint only allows private/government/ngo/cooperative/franchise — 'academic' would fail constraint
- **Root Cause:** Changed { value: 'academic', label: 'Academic' } to { value: 'cooperative', label: 'Cooperative' } in HospitalNetworks.tsx
- **Fix:** ALWAYS cross-reference frontend enum values against DB CHECK constraints in init.sql before adding options
- **Rule:** Not specified


### NETWORK-003 — enrollAnimal had no authorization check
- **Logged:** 2026-04-13 10:50
- **Symptom:** Any authenticated user could enroll any animal into any network with any hospitalId — no check that hospital was in network or user had permission
- **Root Cause:** Added hospital-in-network check and user permission check (hospital_network_members UNION hospital_staff) at start of enrollAnimal()
- **Fix:** ALWAYS add authorization checks in service methods, not just route middleware
- **Rule:** Not specified


### NETWORK-004 — walk-in invite had no accept endpoint or expiry check
- **Logged:** 2026-04-13 10:50
- **Symptom:** inviteWalkInPatient() created tokens but there was no route or service method to accept them — tokens could never be used and expiry was never validated
- **Root Cause:** Added acceptWalkInInvite() service method with expiry/status validation and POST /hospital-networks/walkin-invites/accept route
- **Fix:** When adding an invite flow, ALWAYS add both the invite creation AND the accept endpoint together
- **Rule:** Not specified


### UI-012 — AssignHospitalModal blank dropdown on error
- **Logged:** 2026-04-13 11:00
- **Symptom:** AssignHospitalModal had .catch(()=>{}) — blank dropdown with no feedback on hospital load failure
- **Root Cause:** Added loadingHospitals/hospitalsError states; useEffect now sets error; select disabled during load; error shown inline
- **Fix:** NEVER use empty catch blocks in data-loading useEffect — always surface errors to the user
- **Rule:** Not specified


### HN-001 — Hospital Network — 9 critical backend security/logic gaps
- **Logged:** 2026-04-13 11:03
- **Symptom:** enrollAnimal had no auth check, createNetwork had no transaction, id_prefix had no unique constraint, invite accept didn't check expiry, no deactivation endpoint, audit log showed NULL animal names, hospitals list unpaginated
- **Root Cause:** Wrapped createNetwork in BEGIN/COMMIT transaction, added UNIQUE INDEX on id_prefix, added hospital+user membership checks to enrollAnimal, added expiry check to acceptWalkInInvite, added PATCH deactivate endpoint, COALESCE for null animal names, paginated listNetworkHospitals
- **Fix:** Always: (1) use DB transactions for multi-table inserts, (2) validate token expiry on accept, (3) verify membership before enrollment mutations
- **Rule:** Not specified


### HN-002 — Hospital Network — 7 frontend UX/i18n bugs
- **Logged:** 2026-04-13 11:03
- **Symptom:** AssignHospitalModal silently failed on API error showing blank dropdown. Staff invite had no success feedback. network_type had academic vs DB cooperative mismatch. Hardcoded strings not using t(). Missing i18n keys for deactivate, inviteSent, chooseHospital
- **Root Cause:** Added loadingHospitals+hospitalsError states, success toast for staff invite, fixed academic→cooperative, replaced hardcoded strings with t(), added 8 missing keys to all 5 locale files, added deactivate network UI with confirmation
- **Fix:** Always add loading+error states to every modal that fetches data. Never use .catch(() => {}) silently.
- **Rule:** Not specified


### SEC-001 — Marketplace tables missing from init.sql
- **Logged:** 2026-04-13 15:48
- **Symptom:** Fresh DB install crashes marketplace — 6 tables only in database.ts safety net
- **Root Cause:** Tables only existed as runtime safety nets in database.ts, not in canonical init.sql schema
- **Fix:** Added all 6 tables to docker/init.sql after hospital_staff_invites table
- **Rule:** ALL tables MUST be in init.sql — safety nets in database.ts are backup only


### SEC-002 — Error responses leaked err.message in 500 routes
- **Logged:** 2026-04-13 15:48
- **Symptom:** routes/index.ts returned res.status(500).json({ error: err.message }) exposing internal errors
- **Root Cause:** 500 catch blocks used { error: err.message } and inconsistent format vs { success, message }
- **Fix:** Standardized to { success: false, message } — 500s use generic message + logger.error()
- **Rule:** NEVER expose err.message in 500 responses. Use logger.error() + generic message


### SEC-003 — search-patients endpoint had no role check
- **Logged:** 2026-04-13 15:48
- **Symptom:** GET /hospital-networks/:networkId/search-patients had only authMiddleware — any role could search all patients
- **Root Cause:** No role check on sensitive patient search endpoint
- **Fix:** Added inline role check: only admin/veterinarian/hospital_staff can call this endpoint
- **Rule:** Sensitive data endpoints MUST have explicit role checks, not just authMiddleware


### SEC-004 — errorHandler leaked stack traces in staging
- **Logged:** 2026-04-13 15:48
- **Symptom:** process.env.NODE_ENV !== production leaked details in staging environments (only production blocked)
- **Root Cause:** Condition was !== production so staging/qa environments would expose stack traces
- **Fix:** Changed to === development so only development gets details
- **Rule:** Use === development not !== production for guarding debug details


### FE-AUDIT-001 — Silent catch blocks swallowing frontend errors
- **Logged:** 2026-04-13 15:57
- **Symptom:** Multiple pages had .catch(() => {}) and catch {} blocks that silently swallowed errors, showing no feedback to user
- **Root Cause:** Silent empty catch blocks in loadAnimals, openActionLog, loadRescheduleSlots, loadRoleRequests, loadUsers, handleApproveRequest, handleRejectRequest, handleToggleStatus, handleChangeRole, handleCancelRoleChange, loadInitialData
- **Fix:** All catch blocks now console.error + set error state. ModalActions cancel and QuickBtn have type=button. mountedRef guards added to openActionLog in Consultations
- **Rule:** NEVER write empty catch {} — minimum is console.error. Data-loading catches must set an error state variable displayed to user


### SCAN-001 — Marketplace tables missing from init.sql
- **Logged:** 2026-04-13 15:59
- **Symptom:** Marketplace pages crashed on fresh DB deploy
- **Root Cause:** 6 marketplace tables existed only in database.ts safety net, not in canonical init.sql schema
- **Fix:** Added all 6 tables to docker/init.sql — fresh DB now fully self-contained
- **Rule:** ALL new tables MUST appear in init.sql first, database.ts is safety-net only


### SCAN-002 — consultations.animal_id FK was ON DELETE SET NULL
- **Logged:** 2026-04-13 15:59
- **Symptom:** Deleting an animal silently orphaned its consultation records — audit trail broken
- **Root Cause:** FK constraint defaulted to SET NULL instead of RESTRICT
- **Fix:** Altered via database.ts seedDefaultSettings to ON DELETE RESTRICT
- **Rule:** Medical/audit FKs must always use RESTRICT — never SET NULL on clinical records


### SCAN-003 — Silent .catch(() => {}) swallowing API errors in frontend
- **Logged:** 2026-04-13 15:59
- **Symptom:** Users saw blank/loading forever when API calls failed — no feedback
- **Root Cause:** 6+ catch blocks in Consultations, MedicalRecords, Settings, UserManagement had empty catches
- **Fix:** All fixed: set error state or console.error; buttons now show loading state
- **Rule:** NEVER use empty catch. Always: setError(msg) or console.error. Zero tolerance.


### SCAN-004 — Buttons without type='button' inside forms caused accidental submission
- **Logged:** 2026-04-13 15:59
- **Symptom:** Clicking Cancel or Close in modals sometimes submitted the enclosing form
- **Root Cause:** HTML default for button is type=submit — inside a form this triggers form submission
- **Fix:** Added type='button' to all non-submit buttons in all modal forms
- **Rule:** ALL buttons inside forms must have explicit type='button' unless they ARE the submit


### CA-001 — corporate_admin could self-approve own network
- **Logged:** 2026-04-13 16:36
- **Symptom:** Corporate admin saw Approve button on their own network and could approve it without platform admin review
- **Root Cause:** No role check on approve route; no creator check in approveNetwork()
- **Fix:** Restricted approve route to admin role only; added DB creator check in service; Frontend hides Approve for non-admin
- **Rule:** Network approval MUST be gated to platform admin only. Self-approval is a business logic flaw


### CA-002 — corporate_admin dashboard showed wrong tiles (My Animals etc)
- **Logged:** 2026-04-13 16:36
- **Symptom:** No isCorporateAdmin branch in Dashboard.tsx — role fell through to admin fallback showing irrelevant bookings/animals tiles
- **Root Cause:** Dashboard.tsx only had branches for veterinarian, pet_owner, farmer, admin, hospital_staff
- **Fix:** Added isCorporateAdmin branch with network-specific stats and separate API endpoint
- **Rule:** EVERY role must have an explicit branch in Dashboard.tsx stat cards, quick actions, and subtitle


### CA-003 — corporate_admin assign hospital modal showed public hospitals
- **Logged:** 2026-04-13 16:36
- **Symptom:** Assign Hospital modal let corporate_admin pick any existing public hospital from dropdown — wrong for private closed networks
- **Root Cause:** The modal fetched all vet_hospitals from the system rather than offering to CREATE new ones
- **Fix:** Replaced with CreateBranchHospitalModal (full form). New hospitals are marked is_network_branch=true and hidden from public listing
- **Rule:** Private network hospitals MUST be created within the network, not assigned from public registry


### CA-004 — Admin pending actions count was always 0
- **Logged:** 2026-04-13 16:36
- **Symptom:** Platform admin dashboard showed 0 Pending Actions even when hospital networks were pending approval
- **Root Cause:** AdminService.getDashboardStats() never queried hospital_networks for pending approvals
- **Fix:** Added COUNT of is_approved=false networks to pendingActions in AdminService
- **Rule:** Platform admin pending actions MUST aggregate ALL cross-module pending items


### CA-005 — 500 Internal Server Error on hospital network approve
- **Logged:** 2026-04-13 16:50
- **Symptom:** Clicking Approve on hospital network returned 500 Internal Server Error
- **Root Cause:** hospital_networks table had NO created_by column in init.sql. approveNetwork() queried SELECT created_by → PostgreSQL column-not-found error → 500. createNetwork() INSERT also never saved the creator.
- **Fix:** Added created_by to init.sql + ALTER TABLE safety net in database.ts. Fixed createNetwork() INSERT to include created_by as param 19.
- **Rule:** EVERY new column used in service queries MUST exist in init.sql first. Services that query a column that does not exist cause 500 errors that are invisible until runtime.


### CA-006 — Admin dashboard missing Pending Network Approvals tile
- **Logged:** 2026-04-13 16:50
- **Symptom:** Platform admin dashboard showed 0 Pending Actions even after AdminService returned pendingNetworkApprovals count
- **Root Cause:** AdminDashboard.tsx had no UI tile for pendingNetworkApprovals. AdminDashboardStats type also missing the field — TypeScript did not catch it because the field was just unused.
- **Fix:** Added pendingNetworkApprovals + pendingActions to AdminDashboardStats type. Added stat card with orange highlight + alert banner to AdminDashboard.tsx
- **Rule:** When adding new fields to a service response, ALWAYS also update the type AND the rendering UI — type alone is not enough.


### CA-007 — hospital_network_hospitals table missing - 500 on Create Branch Hospital
- **Logged:** 2026-04-13 17:01
- **Symptom:** POST /hospital-networks/:id/branch-hospitals returned 500
- **Root Cause:** Service used INSERT INTO hospital_network_hospitals but table never existed in init.sql or database.ts safety nets
- **Fix:** Added table to init.sql + CREATE TABLE IF NOT EXISTS safety net in database.ts
- **Rule:** EVERY table used in a service query MUST exist in init.sql AND have a database.ts safety net


### CA-008 — AddMemberModal required raw UUID - unusable by end users
- **Logged:** 2026-04-13 17:01
- **Symptom:** Add Member modal showed a plain text input labeled User ID expecting a UUID GUID string
- **Root Cause:** UI was designed for developer-level input; end users have no way to know a user UUID
- **Fix:** Replaced with name/email search (debounced, dropdown, selected-user badge). Backend /network-user-search endpoint returns matching users
- **Rule:** Member invite flows MUST use name/email search, NEVER raw UUID input


### CA-007 — Create Branch Hospital 500 — hospital_network_hospitals table missing
- **Logged:** 2026-04-13 17:03
- **Symptom:** Clicking Create Branch Hospital returned Internal Server Error immediately
- **Root Cause:** hospital_network_hospitals junction table never added to init.sql or database.ts safety net. Service tried INSERT INTO hospital_network_hospitals → PostgreSQL relation does not exist → 500.
- **Fix:** Added table to init.sql + CREATE TABLE IF NOT EXISTS in database.ts. Same pattern as LESSON-060.
- **Rule:** Every table referenced in service SQL MUST exist in init.sql. Junction tables are easy to miss when added only in service code.


### CA-008 — AddMember modal asked for raw UUID GUID — unusable UX
- **Logged:** 2026-04-13 17:03
- **Symptom:** End users cannot know other users UUIDs. Modal had a plain text input for userId expecting a valid UUID.
- **Root Cause:** Joi validation on backend correctly required a valid UUID, but the frontend just passed whatever the user typed. No user can produce a UUID from memory.
- **Fix:** Replaced with debounced name/email search → results dropdown → selected user badge. Submit disabled until user selected. Added GET /network-user-search endpoint (corporate_admin + admin only).
- **Rule:** NEVER use raw ID inputs in any data entry form. Any foreign-key reference MUST use search-and-select or a dropdown populated from the API.


### CA-009 — CreateBranchHospital submit button hidden below modal scroll area
- **Logged:** 2026-04-13 17:03
- **Symptom:** The Create Branch Hospital modal had a long form. The submit button was below the visible area and users could not find it even after zoom-out.
- **Root Cause:** Modal had no maxHeight and no flex column layout. Form body and footer were all in the same scroll container.
- **Fix:** Added maxHeight: 90vh + flex column to modal. Form body gets flex:1 + overflowY:auto. Footer with action buttons is outside scroll area — always visible.
- **Rule:** ALL modals with forms longer than ~400px MUST use: modal maxHeight:90vh + flex-column, scrollable body, sticky footer with action buttons.


### AUTH-001 — authReq.role undefined — should be authReq.userRole
- **Logged:** 2026-04-14 04:53
- **Symptom:** POST /role-change-requests returned 500 Internal Server Error when submitting a role change request
- **Root Cause:** Auth middleware sets req.userRole not req.role. Using authReq.role returns undefined. INSERT into role_change_requests with current_role NOT NULL → PostgreSQL error → 500.
- **Fix:** Fixed authReq.role → authReq.userRole in 2 places in routes/index.ts
- **Rule:** ALWAYS use authReq.userRole (never authReq.role) — auth middleware only sets userId and userRole. Grep for authReq.role before every push.


### EMAIL-001 — Modal error displayed on parent page
- **Logged:** 2026-04-14 05:44
- **Symptom:** Invite Staff modal error appeared on the background Hospital Networks page, not inside the modal
- **Root Cause:** Modal was inline JSX with no local error state — called parent setError() which rendered in parent component
- **Fix:** Added inviteStaffError state variable; replaced parent setError() calls with setInviteStaffError() inside modal block
- **Rule:** EVERY inline modal that has error handling MUST have its OWN error state variable — never use parent setError() scope inside a modal


### NETWORK-002 — Hospital network member search returned all platform roles
- **Logged:** 2026-04-14 07:07
- **Symptom:** Search returned pet_owner, farmer, admin — confusing and wrong for network staff selection
- **Root Cause:** Added AND role NOT IN ('pet_owner', 'farmer') to /network-user-search SQL
- **Fix:** NEVER return pet_owner/farmer in staff/member search contexts — always filter by eligible roles
- **Rule:** Not specified


### I18N-002 — common.select rendering as raw key in dropdowns
- **Logged:** 2026-04-14 07:26
- **Symptom:** t('common.select') used in HospitalNetworks invite modal but 'select' key was missing from all 5 locale files — only 'selectOption' existed
- **Root Cause:** Added 'select': 'Select' to common section in all 5 locale files via Python script
- **Fix:** When adding t('common.X') calls, always verify X exists in ALL 5 locale files — not just en
- **Rule:** Not specified


### INVITE-001 — Accept hospital invite showing generic 400 error to user
- **Logged:** 2026-04-14 07:26
- **Symptom:** Frontend catch used e.message (axios generic) not e.response.data.message; Joi phone was required but form had no required indicator
- **Root Cause:** Fixed catch to use e?.response?.data?.message; made phone optional in Joi schema
- **Fix:** ALWAYS use e?.response?.data?.message in catch blocks — never e.message alone for API errors
- **Rule:** Not specified


### ERROR-001 — 30 generic throw new Error() in HospitalNetworkService
- **Logged:** 2026-04-14 10:42
- **Symptom:** All hospital network API endpoints returned generic 'Internal Server Error' instead of actual error messages
- **Root Cause:** HospitalNetworkService.ts had 30 instances of throw new Error(msg) instead of proper AppError subclasses. The error handler only returns meaningful messages for AppError subclasses; plain Error always returns 500 Internal Server Error
- **Fix:** Replaced all 30 with ValidationError(400), ForbiddenError(403), ConflictError(409), NotFoundError(404), DatabaseError(500) with descriptive messages
- **Rule:** NEVER use throw new Error() in services. ALWAYS use AppError subclasses (ValidationError, ForbiddenError, ConflictError, NotFoundError, DatabaseError) so the error handler returns the actual message to the client


### SEED-003 — unique_id collision blocking 4 of 5 network demo users
- **Logged:** 2026-04-14 10:43
- **Symptom:** branch.director, staff.nurse, staff.reception, staff.labtech users failed to create. Only netadmin worked. DB showed 21 users instead of 25
- **Root Cause:** fixDemoPasswords assigned USR-VET-004 to branch.director but seed-demo-data.sql already used USR-VET-004 for dr.priya.sharma. UNIQUE constraint violation on unique_id killed entire for-loop (no per-user try/catch)
- **Fix:** Changed network demo unique_ids to USR-NET-002..005. Added per-user try/catch so one failure does not block remaining users. Added unique_id collision clearing before INSERT
- **Rule:** ALWAYS use distinct unique_id prefixes per user category (USR-CRP for corporate, USR-NET for network, USR-VET for vets). ALWAYS wrap each user INSERT in individual try/catch


### FRONTEND-001 — Error extraction using .data?.error instead of .data?.message
- **Logged:** 2026-04-14 10:43
- **Symptom:** Frontend catch blocks showed [object Object] or undefined instead of the actual error message in hospital network modals
- **Root Cause:** The error handler returns { success, message, error: { message, code, statusCode } }. Frontend was using err.response.data.error (which is an OBJECT) instead of err.response.data.message (which is the string)
- **Fix:** Fixed 6 catch blocks in HospitalNetworks.tsx to use .data?.message
- **Rule:** ALWAYS use err?.response?.data?.message for error extraction. The .error field is an object containing {message,code,statusCode} — NOT a string


### EMAIL-001 — SMTP blocked on Render free-tier
- **Logged:** 2026-04-14 15:37
- **Symptom:** User reported no emails received despite correct SMTP config in Render env vars
- **Root Cause:** Render free-tier blocks outbound TCP on ports 587 and 465 — nodemailer connection hangs until OS TCP timeout (127s). No error in application logs because email was fire-and-forget with .catch() swallowing errors
- **Fix:** Added Resend (HTTP-based) as primary email provider. Priority: Resend API → SMTP → log-only fallback. Log-only mode captures full email content in server logs with unique IDs. 10s hard Promise.race timeout prevents TCP hangs.
- **Rule:** NEVER assume SMTP works on cloud platforms. Always use HTTP-based email providers (Resend/SendGrid) as primary for Render. Always test email on deployed env, not just locally.


### WORKFLOW-001 — No walk-in registration for network hospital check-in
- **Logged:** 2026-04-18 13:13
- **Symptom:** Staff tried to check in a new walk-in patient but the modal only showed search — no registration path
- **Root Cause:** Network hospital patients are in closed visibility so search returns no results for new walk-ins
- **Fix:** Added openRegisterMode form in check-in modal using /hospital-networks/:networkId/register-walkin endpoint. branchNetworkId exposed from VetHospitalService.mapHospitalRow
- **Rule:** Network hospital check-in modal must have walk-in registration form when hospital.branchNetworkId is set


### NET-001 — Network staff register button missing (networkId null)
- **Logged:** 2026-04-18 16:37
- **Symptom:** Register button hidden for hospital staff at a network branch hospital
- **Root Cause:** listHospitalsForVet selected h.* which relied on vet_hospitals.branch_network_id being set. In live DBs where seed UPDATE didn't run, branch_network_id is NULL even though hospital_network_members.network_id is correct. networkId = null → button gated away.
- **Fix:** Added COALESCE(h.branch_network_id, hnm.network_id) AS branch_network_id to listHospitalsForVet SELECT. Network ID is now always derived from membership record even if the hospital row's column is unset.
- **Rule:** NEVER rely solely on vet_hospitals.branch_network_id. Always COALESCE with hnm.network_id in listHospitalsForVet.


### DEPLOY-011 — Browser-agent PR TypeScript errors break Render build
- **Logged:** 2026-04-19 10:52
- **Symptom:** Render failed with exit code 2 — tsc errors TS2353 and TS2322 in HospitalNetworkService and VetHospitalService
- **Root Cause:** Browser-agent added ownerId to return object but not to declared return type (TS2353); ownerId was string|null but return type said string (TS2322)
- **Fix:** Fix: add ownerId to return type in HospitalNetworkService.ts; use non-null assertion ownerId! in VetHospitalService.ts
- **Rule:** ALWAYS run tsc locally after merging browser-agent PRs before pushing to develop


### UI-012 — Walk-in registration fails with VARCHAR(500) overflow on photo upload
- **Logged:** 2026-04-19 13:03
- **Symptom:** Error: value too long for type character varying(500) when submitting walk-in form with animal photo
- **Root Cause:** avatar_url defined as VARCHAR(500) in init.sql and database.ts ALTER TABLE — base64 photos are 50k-500k+ chars
- **Fix:** Changed VARCHAR(500) to TEXT in init.sql (both users and animals tables); added ALTER COLUMN TYPE TEXT migration in database.ts to fix existing production columns
- **Rule:** NEVER use VARCHAR with a fixed limit for any column that stores base64 image data or URLs to user-uploaded content — always use TEXT


### PERM-001 — hospital_staff excluded from PermissionService
- **Logged:** 2026-04-19 13:52
- **Symptom:** getFullPermissionMatrix, updatePermission, bulkUpdate, resetToDefaults, getPermissionMetadata all had hardcoded 5-role list excluding hospital_staff
- **Root Cause:** Fixed: added hospital_staff to all 5 hardcoded role lists in PermissionService.ts
- **Fix:** Always include ALL system roles when hardcoding role lists in PermissionService
- **Rule:** Not specified


### PERM-002 — updateNetwork allowed any network member to edit
- **Logged:** 2026-04-19 13:52
- **Symptom:** ensureNetworkAccess called with no requiredRoles on updateNetwork endpoint - any member could edit network settings
- **Root Cause:** Fixed: added corporateadmin to requiredRoles in HospitalNetworkController.ts
- **Fix:** Always pass requiredRoles to ensureNetworkAccess for write operations
- **Rule:** Not specified


### SECURITY-001 — Hospital Network walk-in invite had no membership check
- **Logged:** 2026-04-19 16:59
- **Symptom:** Any authenticated user could call /hospital-networks/:id/invite-walkin without being a member
- **Root Cause:** No membership check on the route
- **Fix:** Added hospital_network_members membership check before calling inviteWalkInPatient
- **Rule:** Always verify caller is a network member before network-scoped mutation routes


### NETWORK-001 — Walk-in invite route had no permission check
- **Logged:** 2026-04-19 17:02
- **Symptom:** Any authenticated user could invite patients to any network
- **Root Cause:** Route had authMiddleware but no network membership check
- **Fix:** Added hospital_network_members query before inviteWalkInPatient call
- **Rule:** Always add ensureNetworkAccess or inline membership check on ALL /hospital-networks/:id/* routes


### NETWORK-002 — enrollAnimal had no ownership check
- **Logged:** 2026-04-19 17:02
- **Symptom:** Any network admin could enroll any animal without owner consent
- **Root Cause:** No check on animal.owner_id vs enrolledBy userId
- **Fix:** Added ownership+consent+role check before enrollment proceeds
- **Rule:** Before enrolling any animal: verify caller owns it OR has admin role + active consent


### NETWORK-003 — Walk-in registration bypassed consent entirely
- **Logged:** 2026-04-19 17:02
- **Symptom:** Walk-in registration set enrollment_status=active regardless of consent
- **Root Cause:** registerWalkInPatientDirect always wrote active status
- **Fix:** Added consentCollected flag: status is pending_consent unless consent explicitly collected
- **Rule:** Walk-in registration MUST collect and record consent; never auto-activate without it


### NETWORK-004 — Inpatient routes had no network membership enforcement
- **Logged:** 2026-04-19 17:02
- **Symptom:** Vet from any network could access inpatient records of hospitals in other networks
- **Root Cause:** Routes used hospitalId without checking network membership
- **Fix:** Added checkInpatientNetworkAccess helper querying vet_hospitals.branch_network_id
- **Rule:** All hospital-scoped routes must check network membership if hospital belongs to a network


### HN-001 — veterinarian missing from Hospital Networks nav
- **Logged:** 2026-04-20 00:12
- **Symptom:** Veterinarian role could not see Hospital Networks in navigation sidebar
- **Root Cause:** Navigation.tsx hospital-networks menuItem had roles: admin, corporate_admin, hospital_staff — missing veterinarian despite vet having hospital_network_manage permission
- **Fix:** Added veterinarian to the roles array in Navigation.tsx
- **Rule:** 4-file sync check: after adding permissions to a role in PermissionService.ts, ALWAYS verify Navigation.tsx roles array also includes that role


### HN-002 — consentCollected missing from walk-in registration form
- **Logged:** 2026-04-20 00:12
- **Symptom:** Walk-in patients always registered as pending_consent even when vet had collected consent in person
- **Root Cause:** walkInForm state lacked consentCollected field; handleRegisterWalkIn did not pass it to API; form UI had no checkbox; registerWalkInPatientDirect type signature omitted it
- **Fix:** Added consentCollected boolean to walkInForm state+reset, API call, and a checkbox UI with amber warning when unchecked; added consentCollected/consentMethod to api.ts type signature
- **Rule:** Walk-in registration P0 fix is end-to-end ONLY if the UI form submits consentCollected — always verify the full data path from form field to API call to service logic


### HN-003 — inviteHospitalStaff called old /invite-staff route with snake_case fields
- **Logged:** 2026-04-20 00:12
- **Symptom:** Staff invites sent via UI used the old /invite-staff route with snake_case fields instead of new P3 /staff-invites route with camelCase; inviteUrl was undefined after success
- **Root Cause:** api.ts inviteHospitalStaff pointed to /invite-staff with snake_case data; UI passed invitee_email etc; new /staff-invites route expects camelCase inviteeEmail etc; success handler read res.data.inviteUrl which new route does not return
- **Fix:** Updated api.ts to POST /staff-invites with typed camelCase params; updated HospitalNetworks.tsx form to pass camelCase fields; fixed inviteUrl fallback to construct URL from returned inviteToken; made inviteeName optional server-side
- **Rule:** When adding a new API route with different field naming conventions, update BOTH the api.ts method AND all UI call sites in the same commit


### NETWORK-005 — Walk-in consent checkbox missing from form
- **Logged:** 2026-04-20 00:16
- **Symptom:** Walk-in registration always sent no consentCollected flag despite P0-CRITICAL3 backend fix — backend defaulted to pending_consent for every walk-in
- **Root Cause:** Added consentCollected checkbox + consentMethod to walkInForm state and API call in HospitalNetworks.tsx
- **Fix:** Backend-only fixes are useless without matching frontend form fields — always verify form submits ALL params the backend requires
- **Rule:** Not specified


### NETWORK-006 — Staff invite route path mismatch
- **Logged:** 2026-04-20 00:16
- **Symptom:** api.ts called old /invite-staff path, new P3-GAP4 route is /staff-invites — all staff invites silently 404'd
- **Root Cause:** Updated api.ts inviteHospitalStaff to POST /staff-invites with camelCase params
- **Fix:** When adding a new backend route that replaces an old one, ALWAYS update the matching api.ts call in the same commit
- **Rule:** Not specified


### NETWORK-007 — Veterinarian missing from hospital-networks nav menu
- **Logged:** 2026-04-20 00:16
- **Symptom:** Navigation.tsx menuItem for hospital-networks had roles array without veterinarian despite PermissionService granting them hospital_network_manage
- **Root Cause:** Added veterinarian to hospital-networks roles array in Navigation.tsx
- **Fix:** 4-file permission sync: PermissionService + PermissionContext + Navigation + App.tsx must ALL be checked together
- **Rule:** Not specified


### P4P6-ROUTE-001 — Route parameter inconsistency in hospital-networks routes
- **Logged:** 2026-04-20 03:03
- **Symptom:** API endpoints returning 404 or routing to wrong handlers
- **Root Cause:** Mixed use of :id and :networkId parameters in Express routes caused generic catch-all route to intercept specific sub-path routes
- **Fix:** Standardized all hospital-networks route parameters to :id in routes/index.ts
- **Rule:** Express routes MUST use consistent parameter names across all related endpoints; place specific routes before generic catch-all routes


### SCHEMA-003 — Dangerous CASCADE DELETE on veterinarian FKs
- **Logged:** 2026-04-22 05:21
- **Symptom:** Deleting a vet user would cascade-delete ALL their consultations, bookings, prescriptions, referrals, and workflow audit trail
- **Root Cause:** consultations/bookings/prescriptions.veterinarian_id had ON DELETE CASCADE — should be RESTRICT. referrals.from/to_vet_id and workflow_transitions.transitioned_by had CASCADE — should be SET NULL to preserve history
- **Fix:** Changed to RESTRICT in init.sql; added DO block migration in database.ts seedDefaultSettings() for existing DBs
- **Rule:** NEVER use ON DELETE CASCADE for FK to users(id) on business data tables. Use RESTRICT for critical records, SET NULL for audit/history tables


### SEC-003 — Double-booking race condition
- **Logged:** 2026-04-22 07:20
- **Symptom:** Two users book same vet slot simultaneously; SELECT+INSERT not atomic
- **Root Cause:** Added unique partial index idx_bookings_vet_slot_unique on (vet_id, date, slot) WHERE status NOT IN (cancelled, missed); INSERT wrapped to catch 23505
- **Fix:** Always use DB-level unique constraints for race-prone operations, not just application-level checks
- **Rule:** Not specified


### BKG-001 — confirmBooking allowed non-pending status transitions
- **Logged:** 2026-04-22 07:20
- **Symptom:** confirmBooking() only checked time, not current status; could re-confirm already-confirmed or cancelled bookings
- **Root Cause:** Added status !== pending check throwing ValidationError before time check in confirmBooking()
- **Fix:** Always validate state machine transitions before processing status changes
- **Rule:** Not specified


### NET-001 — search-patients route used wrong req.params key
- **Logged:** 2026-04-22 07:20
- **Symptom:** Route is /:id/search-patients but code destructured const { networkId } = req.params — always undefined, returns empty results
- **Root Cause:** Fixed to const networkId = req.params.id
- **Fix:** Always use req.params.id for :id params; never destructure with a different key name
- **Rule:** Not specified


### BOOKING-001 — Double-booking race condition
- **Logged:** 2026-04-22 11:24
- **Symptom:** Two pet owners could grab same vet slot simultaneously
- **Root Cause:** Added UNIQUE partial index on vet+date+slot WHERE NOT cancelled; INSERT catches 23505
- **Fix:** Always use DB-level unique constraints for booking slots
- **Rule:** Not specified


### BOOKING-002 — confirmBooking no status check
- **Logged:** 2026-04-22 11:24
- **Symptom:** vet could confirm cancelled booking
- **Root Cause:** Added status !== pending guard
- **Fix:** All status transitions must validate current state
- **Rule:** Not specified


### NETWORK-008 — Network creation no role guard
- **Logged:** 2026-04-22 11:24
- **Symptom:** Any user could create a network
- **Root Cause:** Added roleMiddleware admin/corporate_admin to POST /hospital-networks
- **Fix:** Always add roleMiddleware to sensitive creation endpoints
- **Rule:** Not specified


### DB-011 — Forward FK in init.sql broke fresh DB schema creation
- **Logged:** 2026-05-27 09:23
- **Symptom:** All CREATE TABLE statements for bookings, consultations, video_sessions, prescriptions, medical_records, etc. silently failed on fresh Render DB
- **Root Cause:** hospital_networks table (line 1534) was referenced by tables at lines 120, 131, 376, 408+. Statement-by-statement execution failed; client.query(entireSql) also silently swallowed errors. DB showed usersTable:missing with 0 tables
- **Fix:** Moved hospital_networks def to line 37 (after users). Fixed ensureSchemaPublic to use client.query+SET search_path. Added partial schema detection (checks both users AND bookings). Added public /api/v1/debug/db-state and /api/v1/repair-schema emergency endpoints.
- **Rule:** NEVER place a table that is referenced by many others (especially hospital_networks) AFTER the tables that reference it. Always define referenced tables BEFORE referencing tables in init.sql


### PHARMACY-001 — Pharmacist invite accept assigns wrong role
- **Logged:** 2026-05-27 12:54
- **Symptom:** Invited pharmacist gets hospital_staff role instead of pharmacist role after accepting invite
- **Root Cause:** POST /hospital-staff-invites/accept hardcoded role=hospital_staff regardless of staff_position in invite
- **Fix:** Fixed: derive assignedRole from staff_position map; pharmacist->pharmacist, others->hospital_staff. Applied to both users.role and hospital_network_members.network_role
- **Rule:** NEVER hardcode role in invite-accept handler — always derive from staff_position

