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
