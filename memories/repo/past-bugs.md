# VetCare Past Bugs — Do Not Repeat

> **READ THIS FILE AT THE START OF EVERY SESSION before writing any code.**
> Every entry is a real bug that caused a real production or user-facing failure.

---

## 🔴 DB Schema / SQL Bugs

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

## 🔴 Deployment / Render Bugs

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

