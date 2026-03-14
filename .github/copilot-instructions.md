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
- **Branch model**: `develop` → `test` → `demo` → `main` (production)
- **All development** happens on `develop` branch (or feature branches merged into `develop`)
- **Never push directly to `main`** — code must be promoted through environments
- Render.com hosts 4 separate services, one per environment branch
- GitHub Actions CI/CD runs tests on every push to any env branch
- Use GitHub Actions "Promote" workflow to merge between environments
- `.env` is gitignored — production env vars in Render dashboard
- `render-build.sh` builds frontend then backend
- `render-start.sh` runs schema → migrations → seed → server
