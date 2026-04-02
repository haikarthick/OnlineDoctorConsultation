# VetCare Platform — Copilot Instructions

## START OF EVERY SESSION (READ BEFORE DOING ANYTHING)

Before implementing ANY feature or fix, the agent MUST:
1. Read `/memories/repo/feature-tracker.md` — check for pending planned features and previously completed work
2. Read `/memories/repo/past-bugs.md` — refresh all known bugs to avoid repetition
3. Read any session memory files that exist in `/memories/session/` — check for in-progress plans
4. Re-read this file — all rules below are MANDATORY for every change

**This project has 5 locale files, a pre-push hook with 4 checks, and a 4-file permission sync. ALL must pass before every commit.**

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

| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Scrollbar overflow | `.module-page { min-height: 100vh }` inside flex child | Use `calc(100vh - 64px)`, `box-sizing: border-box` |
| Mobile nav hidden | CSS `display: none` overriding React conditional render | Never put `display: none` on React-rendered elements |
| Pet owner seeing farm menus | `pet_owner` had `enterprise_manage` permission | Permission changes need 4-file sync |
| Prescription "Failed to create" | Joi required `instructions`/`duration` but UI made them optional | Joi schemas must match frontend forms |
| Error display mismatch | Backend `{ errors: [...] }` vs frontend expecting `error.message` | Always check error format between BE/FE |
| AI chat messages invisible | PostgreSQL snake_case vs frontend camelCase | Use `AS "camelCase"` aliases in SELECT queries |
| Missing CSS classes | Components used `.module-tabs` etc. that were never defined | Always verify CSS class exists when using className |
| i18n namespace missing (HerdMedical) | `t('herdMedical.*')` used throughout but `"herdMedical": {}` top-level object never added to any locale file. react-i18next silently renders raw key paths (e.g. `herdMedical.pageTitle`) — NO runtime error, NO console warning | When a new page uses a new `t('namespace.*')` prefix, the `"namespace": { }` top-level object MUST exist in all 5 locale files BEFORE using any t() calls from it |
| Missing auto-populate listing | Marketplace listing pre-fill from animal profile was in original plan but not implemented; caught by user after delivery | Before closing any feature, cross-check ALL planned sub-features in feature-tracker.md |
| Inpatient search silent SQL error | Service used `a.microchip_number` and `a.avatar_url` — neither exists. PostgreSQL threw error, catch block swallowed it, frontend showed "No animals found" silently | Always cross-reference SQL column names against `docker/init.sql`. Silent try/catch masking SQL errors is a major trap |
| "Open Full Record" → generic page | Navigation passed no record ID; target page didn't parse URL params; clicking a specific record opened the generic overview | EVERY navigation to a specific record MUST pass the record's ID via query/route param. Target page MUST auto-select and highlight the record |
| Vet "My Pets" shows other people's animals | `listAnimalsByVeterinarian()` used booking/consultation tables (patients), not `owner_id = userId` | "My X" for ANY role always means the user's OWN records. Query must align with page purpose, not professional role |
| Time slots ignoring admin time format | FindDoctor used hardcoded `formatTime12h()` helper ignoring admin `display.timeFormat`. Past slots for today also shown | ALL time/date/currency displays MUST use `useSettings()` formatters (`formatSlotTime`, `formatDate`, `formatCurrency`). NEVER create local format helpers. Filter past slots for today's date with 15-min buffer |
| Nav bar items overflow at intermediate widths | Home nav total width exceeded container at 1024–1200px; no intermediate breakpoints | Count total width of ALL nav items at 1200px, 1024px before adding buttons. Always add intermediate breakpoints, not just 768px mobile |
| E2E pre-push generator overwrites manual stubs | Generator script REWROTE `auto-discovered.spec.ts` on every run, stripping manually added stubs from prior commits | For frontend-only routes (accept-invite, animal-timeline etc.) manually append stubs to `auto-discovered.spec.ts`. Verify pre-push hook assertion count matches expected total |
| Hindi locale JSON broken by double-comma | Two separate edits each added trailing comma on same key → `,,` invalid JSON. No explicit JSON validation in pre-push hook | After editing ANY locale JSON: validate with `node -e "require('./frontend/src/locales/hi/translation.json')"` before pushing |
| Floating element overlapping fixed nav | Fixed-position floating element (`z-index: 9998`) overlapped fixed nav bar (`z-index: 1000`) | Fixed/floating elements must account for ALL fixed/sticky elements on every page they render on |

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

## Deployment & CI/CD
- **Branch model**: `develop` (DEV) → `main` (PROD)
- **All development** happens on `develop` branch (or feature branches merged into `develop`)
- **Never push directly to `main`** — use the GitHub Actions "Promote DEV to PROD" workflow
- **Database**: 1 free PostgreSQL on Render, schema-separated (`DB_SCHEMA` env var)
  - DEV uses schema `vetcare_dev`, PROD uses schema `vetcare_prod`
- Render.com hosts 2 web services: `vetcare-dev` (develop) + `vetcare-app` (main)
- GitHub Actions CI/CD runs tests on every push to develop or main
- `.env` is gitignored — production env vars in Render dashboard
- `render-build.sh` builds frontend then backend
- `render-start.sh` creates schema → runs init.sql → migrations → seed → server
