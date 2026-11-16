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

## Error messages (same rule, enforced)
Every caught error becomes words through `frontend/src/utils/userMessage.ts` - `userMessage(err, 'screen.key')`:
the server's readable sentence first, else a specific translated one (offline, slow server, session ended, no
permission, not found, conflict, too many requests, server trouble). Never `err.message`, never a status code,
never `[object Object]`. Only `UserFacingError` (sign-in / registration replies) passes its own text through.
`frontend/src/errorMessages.guard.test.ts` fails the build when a screen reads `err.message` or
`response.data.error` by hand (`// guard-ok: reason` marks a justified exception). The crash screen
(`ErrorBoundary`) shows technical text in development only. Texts: `locales/<lang>/modules/errors.json`.
Known remaining gap: server-side messages are English only; making them translatable is a separate piece of work.

## Signing in with a mobile number (2026-11-16)
Phone is the primary identifier, email the second; sign-in accepts either (`identifier`, `email` still works).
`users.phone_e164` (migration 047) holds the normalised number, unique; a trigger fills it for any writer, and
`UserService.phoneForStorage` validates and refuses a number already on another account. Normalisation is
`backend/src/services/sms/phone.ts` (India-first: 10 digits starting 6-9; `+` numbers kept). Test fixtures that
register accounts must use a unique valid mobile (`runtime-verify.js` and `critical-journeys.spec.ts` do).
SMS sending and its admin settings: `backend/src/services/SmsService.ts`, Admin -> SMS Settings (migration 046).
