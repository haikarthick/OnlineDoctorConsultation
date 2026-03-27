# VetCare Platform — Copilot Instructions

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

## Database Migration Pattern

- `init.sql` uses `CREATE TABLE IF NOT EXISTS` — **skips if table exists**
- New columns added to `init.sql` won't apply to existing production tables
- **Fix**: `database.ts` → `seedDefaultSettings()` runs `ALTER TABLE ADD COLUMN IF NOT EXISTS` for all new columns on every startup
- When adding new columns: ALSO add `ALTER TABLE ADD COLUMN IF NOT EXISTS` in `database.ts`
- `render-start.sh` swallows migration errors — never rely solely on migrations

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
