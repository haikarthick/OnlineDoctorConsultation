# VetCare Past Bugs — Do Not Repeat

> **READ THIS FILE AT THE START OF EVERY SESSION before writing any code.**
> Every entry is a real bug that caused a real production or user-facing failure.

---

## 🔴 Deployment / Render Bugs

### DEPLOY-001 — HTTP Port Bound After DB Connect → Render Health Check Fails
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

### DEPLOY-005 — Free-Tier DB Cold Start → fixDemoPasswords Never Runs → Login Always Fails
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

## 🔴 CSS & Layout Bugs

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

### API-004 — Inpatient Search Silent SQL Error
- **Root Cause:** Query used `a.microchip_number` and `a.avatar_url` — neither column exists in the schema. PostgreSQL threw an error, catch block swallowed it, frontend silently showed "No animals found"
- **Fix:** ALWAYS cross-reference every column name against `docker/init.sql` before writing SQL. Silent try/catch is a major trap — log errors even if you continue.

---

## 🔴 i18n Bugs

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
