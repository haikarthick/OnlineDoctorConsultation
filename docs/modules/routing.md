# Routing, access and "unknown address" (root-cause fix, 2026-11-16)

**Rule:** no one lands on an unexplained screen. See "Mandatory: users never see error codes" in `CLAUDE.md`.

## Where decisions are made
`frontend/src/components/routing/RouteGuards.tsx` is the only place that decides whether a person may open a
page (`ProtectedRoute`, `RoleRoute`, `PublicOnlyRoute`, `AccessProblem`, `PageLoader`). App.tsx only imports them.

1. **No decision until the answer is known.** Sign-in is restored synchronously before the first render
   (`AuthContext.readStoredSession`) and `PermissionContext.loading` is *derived* from "permissions answered for
   this user", so there is no moment with a signed-in user, an empty list and `loading=false`. That moment used to
   send pasted links and refreshes to the dashboard.
2. **A failed check is not "no permission".** `PermissionContext` retries 3 times, then sets `loadFailed`;
   `RoleRoute` shows "We couldn't check your access" with Try again. The last known list is kept.
3. **A refusal explains itself** (`AccessProblem kind="noPermission"`), never a redirect.
4. **Deep links survive sign-in.** Guards send signed-out visitors to `/login` with `state.from`; sign-in goes back
   there (`utils/returnPath.ts`, same-app paths only). A session that ends mid-use (`services/api/core.ts`, 401
   with no refresh) is remembered, the sign-in page says so, and the person returns to the same page.
5. **Unknown addresses** render `pages/NotFound.tsx` inside the app shell (route `*`), not a redirect.

## Keeping it fixed
`src/routing.links.test.ts` fails if any `navigate()` / `to=` / `href=` / menu path matches no route in App.tsx
(it found `/vet-hospitals/:id/manage`, which did not exist). `components/routing/routeGuards.test.tsx` covers the
guard rules. Translations: `locales/<lang>/modules/routeErrors.json`.
