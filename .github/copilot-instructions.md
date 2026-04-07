# VetCare Platform — Copilot Instructions

## START OF EVERY SESSION (READ BEFORE DOING ANYTHING)

Before implementing ANY feature or fix, the agent MUST:
1. Read `/memories/repo/feature-tracker.md` — check for pending planned features and previously completed work
2. Read `/memories/repo/past-bugs.md` — refresh all known bugs to avoid repetition
3. Read any session memory files that exist in `/memories/session/` — check for in-progress plans
4. Re-read this file — all rules below are MANDATORY for every change

**This project has 5 locale files, a pre-push hook with 4 checks, and a 4-file permission sync. ALL must pass before every commit.**

---

## MEMORY UPDATE RULE (MANDATORY — AFTER EVERY CHANGE)

**After completing ANY task, fix, feature, or investigation, the agent MUST update memory files before the session ends.**

### When to update `memories/repo/past-bugs.md`:
- After fixing ANY bug (deployment, auth, SQL, UI, i18n, permissions, navigation)
- After discovering a root cause (even if not yet fixed)
- After any "it was working before but now broken" investigation
- Template entry:
  ```
  ### CATEGORY-NNN — Short title of bug
  - **Symptom:** What the user saw / what error appeared
  - **Root Cause:** Exact technical reason it failed
  - **Fix:** What was changed and in which files
  - **Rule:** One-line rule to NEVER repeat this mistake
  ```

### When to update `memories/repo/feature-tracker.md`:
- After adding any new page, feature, endpoint, or UI component
- After completing a planned feature (mark as ✅ Done)
- After deciding NOT to implement something (mark with reason)

### When to update `memories/repo/lessons.md` (create if missing):
- After any architectural decision (e.g. "use gen_random_uuid not uuid_generate_v4")
- After any "lesson learned" that applies to the whole codebase
- After discovering a platform limitation (e.g. Render managed PG cannot CREATE EXTENSION)
- Template entry:
  ```
  ### LESSON-NNN — Short title
  - **Context:** What were we doing / what problem triggered this
  - **Lesson:** The rule or principle learned
  - **Apply to:** All future SQL / All future Render deploys / etc.
  ```

### Memory update is part of the task — NOT optional
- Do NOT consider a task complete until memory files are updated
- Commit memory file changes together with code changes (same commit is fine)
- If a session ends before memory is updated, add a note at the top of `memories/session/pending-memory.md`

### Before starting EVERY user instruction:
1. Read `memories/repo/past-bugs.md` — check if this issue has been seen before
2. Read `memories/repo/lessons.md` — apply known lessons to the approach
3. If a known bug matches → apply the known fix immediately, skip investigation
4. If a new bug → investigate, fix, THEN add to past-bugs.md

---

## Architecture (DO NOT VIOLATE)

### Backend
- Express + TypeScript, raw `pg.Pool` parameterized SQL — **NO ORM, NO Knex**
- ALL routes in `backend/src/routes/index.ts` — **never split into separate files**
- Pattern: Controller (thin) → Service (logic) → raw SQL with `$1, $2` placeholders
- API prefix: `/api/v1`

### Frontend
- React + Vite + TypeScript
- Provider nesting (App.tsx): `BrowserRouter → SettingsProvider → AuthProvider → PermissionProvider → SocketProvider` — **never change order**
- Route guards: `ProtectedRoute` (auth), `RoleRoute` (auth + permission), `PublicOnlyRoute`
- All protected pages are lazy-loaded
- `FloatingChatWidget` renders globally for all authenticated users

### CSS
- Use `min-height: calc(100vh - 64px)` on `.module-page` — **NOT** `100vh` (causes scrollbar)
- Component-specific `.css` files, NOT CSS Modules
- Global classes in `frontend/src/styles/modules.css`
- Never add `display: none` in CSS for React-conditionally-rendered elements

## i18n — Multi-Language Support (MANDATORY FOR ALL FEATURES)

Every UI string **MUST** use `t()` from `react-i18next`. **Never hardcode English text** in JSX.

- Use `import { useTranslation } from 'react-i18next'` and `const { t } = useTranslation()` in every page component
- Sub-components outside the main component that need translated strings must accept a `t` prop
- **All 5 locale files** must be updated together when adding new strings:
  - `frontend/src/locales/en/translation.json`
  - `frontend/src/locales/hi/translation.json`
  - `frontend/src/locales/ta/translation.json`
  - `frontend/src/locales/te/translation.json`
  - `frontend/src/locales/kn/translation.json`
- Translation key convention: `{module}.{section}.{key}` (e.g. `marketplace.sell.title`)

## Responsive CSS (MANDATORY FOR ALL FEATURES)

Every page/component CSS **MUST** include 4-tier responsive breakpoints:

| Breakpoint | Purpose |
|------------|---------|
| `1200px` | Grid auto-fit adjustments, sidebar width reduction |
| `768px` | Single-column layouts, stacked forms, table `overflow-x: auto`, sticky panels unstick |
| `640px` | Hide step labels (icons only), 2-col stats grids, chip bar horizontal scroll |
| `480px` | Single-column everything, reduced font/image sizes |

- Reference patterns: `Dashboard.css`, `Marketplace.css`
- Tables: always add `overflow-x: auto` wrapper at `768px`

## Permission System (4-FILE SYNC REQUIRED)

When adding/removing pages, menus, or changing role access, you MUST update ALL 4 files together:

1. `backend/src/services/PermissionService.ts` — `DEFAULT_ROLE_PERMISSIONS`
2. `frontend/src/context/PermissionContext.tsx` — `PERMISSION_ROUTE_MAP`, `ROUTE_PERMISSION_MAP`, `NAV_PERMISSION_MAP`
3. `frontend/src/components/Navigation.tsx` — `menuItems` array (`roles` + `section`)
4. `frontend/src/App.tsx` — `<RoleRoute path="...">` with matching path key

### Role Boundaries
- **pet_owner**: Consultations, Animals, Medical Records, AI Copilot, Marketplace, Wellness, Vet Hospitals, Settings. **NO** farm/enterprise, analytics, innovation modules.
- **farmer**: Everything pet_owner has PLUS farm/enterprise, analytics, innovation, breeding, feed, compliance, financial.
- **veterinarian**: Consultations, schedule, prescriptions, medical records, reviews, herd medical, health analytics, AI Copilot, hospitals.
- **admin**: Everything. Always bypasses frontend permission checks.

### Nav Menu Dual Filter
Items filtered by BOTH `roles.includes(user.role)` AND `hasPermission(NAV_PERMISSION_MAP[item.id])`.

## Before Committing
1. Run `npx tsc --noEmit` in both `frontend/` and `backend/`
2. Verify Joi validation schemas match frontend form requirements
3. Check error response format consistency (backend → frontend)
4. Test that `.env` secrets are not committed (gitignored)
5. Always `git push origin develop` after committing — raw `git commit` does NOT push

## Feature Coverage Rule (MANDATORY)

**ANY feature added MUST be accessible to ALL relevant user roles.**
- Never add a page/menu to only one role without considering all 4 roles
- Timeline, medical records, analytics etc. must work across pet_owner, farmer, veterinarian, admin
- When adding a nav item: always review ALL 4 roles and add to every role that should see it

## Feature Verification Rule (MANDATORY)

**For ANY feature implementation, ALL of the following MUST be verified and fixed by default:**
- All hyperlinks and navigation buttons work correctly (use react-router `useNavigate`, NOT `window.location.hash`)
- All dropdown values, lists, and select options are populated and functional
- Search functionality shows suggestions/autocomplete where appropriate
- All navigation paths are correct and lead to existing routes
- All event handlers (onClick, onChange, onSubmit etc.) are wired up properly
- Error scenarios are handled with user-visible feedback
- All user roles can access the feature as intended
- UI/UX consistency: follows design system, no ghost CSS classes, no broken layouts

## UI/UX Consistency Rule (MANDATORY)

**ALL UI components MUST follow the established design system.** Never invent ad-hoc CSS classes or use inline styles for standard patterns.

### Design System Classes (from `modules.css` + `ModulePage.css`)
| Pattern | CSS Classes | Notes |
|---------|-------------|-------|
| Form fields | `module-input`, `module-label`, `module-form-group` | Styled inputs with focus ring |
| Form layout | `module-form`, `module-form-row`, `module-form-row-3` | Grid-based 2/3-col rows, collapses on mobile |
| Cards | `module-card`, `card`, `card-body`, `card-header` | White bg, border, rounded corners, shadow |
| Badges | `module-badge`, `badge`, `badge-pending/success/error` | Pill badges with status colors |
| Buttons | `module-btn`, `module-btn primary/small`, `btn`, `btn-primary` | Gradient primary buttons |
| Tables | `module-table` inside `data-table-container` | With `overflow-x: auto` for mobile |
| Tabs | `module-tabs`, `module-tab` | Pill-style navigation tabs |
| Stats | `module-stats`, `stat-card` | Auto-fit grid with icon + value + label |
| Alerts | `module-alert error/success` | Dismissible top-of-page alerts |
| Page | `module-page`, `module-header` | Max-width 1400px, gradient header |

### Rules
- **NEVER use ghost CSS classes** — always verify the class exists in CSS before using it in `className`
- **NEVER use inline styles** (`style={{ }}`) for layout (flex, grid, gap), colors, font-weight, or spacing — use CSS classes instead
- **Exception**: Inline styles are OK for truly dynamic values (e.g., `width: ${percentage}%`)
- **Always wrap tables** in `<div className="data-table-container">` for mobile overflow
- **Form rows**: Use `module-form-row` (2-col) or `module-form-row-3` (3-col) — never `<div style={{ display: 'flex', gap: 16 }}>`
- **Reference pages**: `Settings.tsx`, `Animals.tsx`, `Dashboard.tsx` for correct patterns

## Past Bugs — LEARN FROM THESE (do not repeat)

### UI / CSS Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Scrollbar overflow | `.module-page { min-height: 100vh }` inside flex child | Use `calc(100vh - 64px)`, `box-sizing: border-box` |
| Mobile nav hidden | CSS `display: none` overriding React conditional render | Never put `display: none` on React-rendered elements |
| Missing CSS classes | Components used `.module-tabs` etc. that were never defined | Always verify CSS class exists when using className |
| Nav bar items overflow at intermediate widths | Home nav total width exceeded container at 1024–1200px; no intermediate breakpoints | Count total width of ALL nav items at 1200px, 1024px before adding buttons. Always add intermediate breakpoints, not just 768px mobile |
| Floating element overlapping fixed nav | Fixed-position floating element (`z-index: 9998`) overlapped fixed nav bar (`z-index: 1000`) | Fixed/floating elements must account for ALL fixed/sticky elements on every page they render on |

### Permissions Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Pet owner seeing farm menus | `pet_owner` had `enterprise_manage` permission | Permission changes need 4-file sync: PermissionService + PermissionContext + Navigation + App.tsx |

### Backend / API Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Prescription "Failed to create" | Joi required `instructions`/`duration` but UI made them optional | Joi schemas must match frontend forms exactly |
| Error display mismatch | Backend `{ errors: [...] }` vs frontend expecting `error.message` | Always check error format between BE/FE |
| AI chat messages invisible | PostgreSQL snake_case vs frontend camelCase | Use `AS "camelCase"` aliases in SELECT queries |
| Inpatient search silent SQL error | Service used `a.microchip_number` and `a.avatar_url` — neither exists. PostgreSQL threw error, catch block swallowed it, frontend showed "No animals found" silently | Always cross-reference SQL column names against `docker/init.sql`. Silent try/catch masking SQL errors is a major trap |

### i18n Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| i18n namespace missing (HerdMedical) | `t('herdMedical.*')` used throughout but `"herdMedical": {}` top-level object never added to any locale file. react-i18next silently renders raw key paths — NO runtime error, NO console warning | When a new page uses a new `t('namespace.*')` prefix, the `"namespace": { }` top-level object MUST exist in all 5 locale files BEFORE using any t() calls from it |
| Hindi locale JSON broken by double-comma | Two separate edits each added trailing comma on same key → `,,` invalid JSON. No explicit JSON validation in pre-push hook | After editing ANY locale JSON: validate with `node -e "require('./frontend/src/locales/hi/translation.json')"` before pushing |

### Navigation & Deep Link Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| "Open Full Record" → generic page | Navigation passed no record ID; target page didn't parse URL params; clicking a specific record opened the generic overview | EVERY navigation to a specific record MUST pass the record's ID via query/route param. Target page MUST auto-select and highlight the record |
| Vet "My Pets" shows other people's animals | `listAnimalsByVeterinarian()` used booking/consultation tables (patients), not `owner_id = userId` | "My X" for ANY role always means the user's OWN records. Query must align with page purpose, not professional role |

### Settings Enforcement Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Time slots ignoring admin time format | FindDoctor used hardcoded `formatTime12h()` helper ignoring admin `display.timeFormat`. Past slots for today also shown | ALL time/date/currency displays MUST use `useSettings()` formatters (`formatSlotTime`, `formatDate`, `formatCurrency`). NEVER create local format helpers. Filter past slots for today's date with 15-min buffer |

### Feature Completeness Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Missing auto-populate listing | Marketplace listing pre-fill from animal profile was in original plan but not implemented; caught by user after delivery | Before closing any feature, cross-check ALL planned sub-features in feature-tracker.md |

### Testing Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| E2E pre-push generator overwrites manual stubs | Generator script REWROTE `auto-discovered.spec.ts` on every run, stripping manually added stubs from prior commits | For frontend-only routes (accept-invite, animal-timeline etc.) manually append stubs to `auto-discovered.spec.ts`. Verify pre-push hook assertion count matches expected total |

### Deployment / Render Bugs
| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Deploy "Exited with status 1" — intermittent | `index.ts` awaited `connectWithRetry()` (up to 190s: 5×30s timeout + 40s waits) BEFORE calling `httpServer.listen()`. Render's health check fires in ~60s. Free-tier PostgreSQL can take 30–90s to wake — port never bound in time → deploy fails | **Bind `httpServer.listen()` FIRST. Connect DB in background AFTER. NEVER call `process.exit(1)` on DB connect failure after port is already bound.** |
| render-start.sh inline node hung forever | Inline `node -e "..."` scripts had `connectionTimeoutMillis` but NO outer shell `timeout` wrapper — if DB unreachable, node hung for minutes | Every `node` subprocess in render-start.sh MUST have BOTH: (1) outer `timeout N` shell wrapper AND (2) `connectionTimeoutMillis` < N |
| Deploy fails instantly — no HTTP logs | `config/index.ts` has synchronous `process.exit(1)` at module load time if `DATABASE_URL` missing or `JWT_SECRET` is a default value — fires before `http.createServer()` is ever called | Always verify Render env vars before deploying: `DATABASE_URL`, `JWT_SECRET` (non-default), `NODE_ENV=production`, `DB_SCHEMA` |
| enterpriseMigration exits with code 1 | `enterpriseMigration.ts` calls `process.exit(1)` on SQL error (unlike tier2/3/4 which throw) | The `\|\| echo "...continuing"` guards in render-start.sh catch this. NEVER remove those guards. Future fix: change to `throw error` to match tier2/3/4 |

## Admin Settings Rule (MANDATORY — GLOBAL ENFORCEMENT)

**ALL admin settings MUST be respected across ALL pages — no exceptions.**
- **Time format**: Use `formatSlotTime()` from `useSettings()` for all HH:MM time slot displays. NEVER use hardcoded `formatTime12h()` helpers.
- **Currency**: Use `formatCurrency()` from `useSettings()` for all monetary values
- **Date format**: Use `formatDate()` from `useSettings()` for all date displays
- **Join window**: Use `isJoinable()` from `useSettings()` for Join button visibility
- When adding ANY new page showing times, dates, or currencies: ALWAYS import and use `useSettings()`

## Deep Navigation Rule (MANDATORY)

**ALL navigation links that reference a specific record MUST navigate to that exact record — NEVER to a generic overview page.**
- When navigating from any context (timeline, dashboard, notifications, search): pass the record ID via query/route param
- Target page MUST auto-select the correct item, tab, and scroll to/highlight the record
- Pattern: `/medical-records?animalId=X&recordId=Y&tab=diagnoses`
- This applies to: medical records, consultations, prescriptions, bookings, lab results, vaccinations, allergies, and ALL future entities

## Functional Integrity Rule (MANDATORY — ZERO TOLERANCE)

**Never break existing logic while adding new features.**
- Before modifying ANY existing logic, understand what it currently does and WHY
- If ANY existing logic needs to change to implement something new:
  1. **STOP** — do NOT proceed
  2. **ASK the user**: explain what the previous logic was + what the proposed change is
  3. Only proceed AFTER receiving explicit approval
- **Additive changes** (new endpoints, new pages, new fields) are OK without approval
- **Modifications to existing behavior** ALWAYS require approval

## Usability Standards Rule (MANDATORY — ALL SCREENS)

**ALL screens, modals, forms, and UI interactions MUST follow best usability standards:**
- Edit/Create forms MUST open as centered modals with dark overlay backdrop — user must never wonder if a form opened
- Every modal MUST have a visible close button (✕) in the top-right corner PLUS overlay-click-to-close
- Error messages must be visible without scrolling (auto-scroll + highlight specific field)
- All interactive elements must have clear hover/focus states
- On mobile: modals full-width, forms stack vertically

## Plan Adherence Rule (MANDATORY)

**NEVER deviate from the originally discussed plan without explicit documentation.**
- Read `/memories/repo/feature-tracker.md` at the START of every task — check for pending planned items
- If a feature was previously planned, it MUST be included
- When skipping a planned item, add documented reason in commit message
- UPDATE feature-tracker.md BEFORE committing — mark completed items, verify no planned items left as "⚠️ Planned"

## i18n Namespace Rule (MANDATORY — ZERO TOLERANCE)

**Before committing any new page component with `t('namespace.key')` calls:**
1. Extract the namespace prefix (part before the first `.`)
2. Verify `"namespace": { ... }` top-level object EXISTS in ALL 5 locale files
3. Run: `node -e "require('./frontend/src/locales/en/translation.json')"` — must not throw
4. Run: `node -e "require('./frontend/src/locales/hi/translation.json')"` — must not throw
- Missing an entire namespace causes the ENTIRE page to show raw key paths silently — no error, no warning
- Missing individual keys show the key path for just that string — also silent

## SQL Column Name Rule (MANDATORY)

**Before writing ANY SQL query**, cross-reference column names against `docker/init.sql`:
- NEVER assume column names from memory
- Mismatched column names cause PostgreSQL errors that get silently swallowed by catch blocks, showing "No data found" to user
- Run `grep -n "column_name" docker/init.sql` to verify before using in a query
- All SELECT queries must use `AS "camelCase"` aliases to match frontend TypeScript types

## Database Migration Pattern

- `init.sql` uses `CREATE TABLE IF NOT EXISTS` — **skips if table exists**
- New columns added to `init.sql` won't apply to existing production tables
- **Fix**: `database.ts` → `seedDefaultSettings()` runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for all new columns on every startup
- When adding new columns: ALSO add `ALTER TABLE ADD COLUMN IF NOT EXISTS` in `database.ts`
- `render-start.sh` swallows migration errors — never rely solely on migrations

## Database Schema Rule (MANDATORY)

- **ALL tables MUST be defined in `docker/init.sql`** — NEVER create tables only at runtime
- Runtime `CREATE TABLE IF NOT EXISTS` in services is allowed as a **safety net only**, but the canonical schema MUST exist in `init.sql`
- **ALL seed/demo data for new features MUST be in `docker/seed-demo-data.sql`**
- When adding new tables: add to `init.sql` + appropriate tier migration file + `database.ts seedDefaultSettings()` safety net
- The repo must be fully self-contained — running `init.sql` + tier migrations must produce a complete schema without needing the app server to boot

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@vetcare.com | Admin@123 |
| Veterinarian | sarah.johnson@example.com | Demo@123 |
| Pet Owner | emily.davis@example.com | Demo@123 |
| Farmer | tom.wilson@example.com | Demo@123 |

`fixDemoPasswords.ts` runs on every server start — auto-corrects emails + passwords by UUID.

## AI Copilot

- `AiCopilotService.ts`: Groq (GROQ_API_KEY, free) → OpenAI (OPENAI_API_KEY) → local fallback
- Uses OpenAI SDK with Groq baseURL for Groq provider
- Models: `llama-3.3-70b-versatile` (Groq), `gpt-4o` (OpenAI)

## Render Deployment Rules (MANDATORY — ZERO TOLERANCE)

**These rules exist because free-tier Render PostgreSQL can take 30–90s to wake up after sleeping.**

### Rule 1 — Bind HTTP Port FIRST, Always
```typescript
// index.ts — CORRECT (port first, DB second):
const httpServer = http.createServer(app);
initSocketIO(httpServer);
const server = httpServer.listen(config.app.port, ...);  // ← FIRST

// DB connect in background AFTER port is bound:
try {
  await connectWithRetry();
  // cache, scheduler, fixDemoPasswords...
} catch (error: any) {
  logger.error('Services init failed', { error: error.message });
  // NEVER process.exit(1) here — server stays alive
}
```
- Render's health check fires within ~60s of deploy start
- If port is not bound in time → deploy marked failed with "Exited with status 1"
- DB failures after port is bound are logged but NEVER fatal

### Rule 2 — Every node Subprocess in render-start.sh Needs a Timeout
Every `node -e "..."` or `node dist/...` call MUST have:
1. Outer `timeout N` shell wrapper
2. `connectionTimeoutMillis` set to less than N (node fails cleanly before shell kills it)
3. `|| echo "...continuing"` fallback so failures don't stop the script

### Rule 3 — Render Environment Variables (verify before every deploy)
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Auto-set by Render PostgreSQL add-on |
| `JWT_SECRET` | ✅ | Must NOT be any default value — or deploy exits immediately at module load |
| `NODE_ENV` | ✅ | Must be `production` |
| `DB_SCHEMA` | ✅ | `vetcare_dev` (develop branch) / `vetcare_prod` (main branch) |
| `PORT` | Auto | Render sets this |
| `RENDER_EXTERNAL_URL` | Auto | Render sets this |

### Rule 4 — Render Startup Sequence (never change this order)
```
render-build.sh  →  npm install + build (frontend Vite, backend tsc)

render-start.sh
  Step 0: timeout 45  — schema + init.sql            [non-fatal: || echo continuing]
  Step 1: timeout 40  — 4 migration scripts           [non-fatal: || echo continuing]
  Step 2: timeout 20  — VET_PROFILE_COUNT check       [defaults to 0 on failure]
        → timeout 120 — seed demo data if empty       [non-fatal: || echo continuing]
  Step 3: exec node dist/index.js                     [MUST succeed — no fallback]
    → httpServer.listen(PORT)     ← FIRST always
    → connectWithRetry()          ← background, 5 attempts × 10s
    → cache / scheduler / demo    ← background, non-fatal
```

### Rule 5 — Never Direct-Push to main
- All development on `develop` branch
- PROD deploys via GitHub Actions "Promote DEV to PROD" workflow only
- `git push origin develop` — always, after every commit


