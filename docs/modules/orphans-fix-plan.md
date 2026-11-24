# Orphan fix plan - nothing without a screen, nothing without a reader

Owner mandate (2026-11-24): "I don't want anything left orphaned without any UI." This plan fixes the findings in
`docs/modules/orphans-ledger.md` (193 rows: 74 false alarms, 68 real orphans of which 27 high priority, 34 dead or duplicate, 17 owner decisions)
end to end. The ledger stays the register; this file is the order of work, the design of each piece and how it is proven done.
Nothing here starts before the owner picks the order (Part 6). Hospital network rows are flagged only and need a separate approval.

## 1. Rules every workstream follows

1. **One place per fact.** A screen reads the one service that owns the data. A screen that writes uses the one existing writer; it never adds a second.
2. **Designed for a first-time farmer**, phone first, tap not type, one task one screen, offline-safe where a farmer records in a shed.
3. **Plain words, six languages**, never an HTTP code or raw message. Every refusal says what happened, why and what next.
4. **H15**: every route that takes an animal, group or farm id names its gate (`requireAnimal`, `requireRecordAccess`, `FarmAccessService`). A screen never widens access.
5. **Independent agents (H16)**: `requirements-analyst` writes the rows first, `domain-reviewer` and `journey-tester` follow the build, `completeness-auditor` gives the verdict. The builder never marks their own rows Built.
6. **A row is Built only with evidence**: the file and line, a test, and a runtime-verify journey for anything that touches SQL or a route.
7. **Dead code is deleted whole**: route, validation, service function, client method, tests and translations together, and the ledger row says what went.

## 2. Workstream 0 - stop it happening again (first, small)

The reason these were missed: nothing fails when a route or column has no screen.

- Add an orphan guard test (`backend/tests/unit/orphans.guard.test.ts` + a frontend counterpart) that lists every route with no client caller and every client method with no screen caller, and fails on any not in the ledger's allowlist. The allowlist may only shrink (same ratchet rule as the harness).
- It reads the pharmacy pages' literal `client.get('/...')` calls too (the scanner in the audit missed them), so there are no false alarms to maintain.
- Add one line to `docs/HARNESS.md` as rule H17 and to the `pre-ship` and `feature-delivery` skills: a new route, column or table ships with its screen and a reader, or it does not ship.
- Done when: the guard is in CI, fails on a deliberately added orphan route, and passes on the current tree with the allowlist equal to the open ledger rows.

## 3. Workstreams, in the proposed order of risk

Each workstream = requirements rows -> design (sub-views and the 40-item case list) -> build -> review -> runtime journey -> push.

### W1 Notifications inbox (all roles; 4 rows, P1)
Problem: notifications are written (vaccines, nutrition, withdrawal, bookings) but no screen reads them. Two nutrition rows (NUT-173/174) are marked Built on a list that does not exist and are reopened.
- Design: one bell in the shared layout for every role, a list grouped by day, tap = mark read and open the thing it is about, "Mark all read", an empty state, and a plain "could not load" message. One list; admin and every role see the same component.
- Backend: routes exist (`listNotifications`, mark read, mark all read); add a deep-link target to each notification type so a tap opens the right screen (booking, animal, farm records, vaccination).
- Cross-module trace: every `NotificationService.createNotification` caller; preferences panel already exists and keeps its place.
- Journeys: each role sees only its own; read state persists; deep links resolve for every type; offline shows what was cached and says it is old.
- Effort: medium.

### W2 Wallet withdrawals - admin (4 rows, P1, money)
Problem: users can request a wallet withdrawal; no admin can approve, reject or settle it, so money requests sit forever.
- Design: second queue "Wallet withdrawals" on the admin Settlements page beside the doctor queue, same layout and statuses; approve, reject (reason is shown to the requester in plain words) and settle with the bank reference. The requester sees the status on their own wallet screen and gets a notification (W1).
- Cross-module: grooming wallet, consultation earnings, payables register, GST/TDS if any; one status machine.
- Owner decision: none expected; confirm that rejection returns the amount to the wallet.
- Journeys: request -> approve -> settle; request -> reject returns the amount; a non-admin is refused; double-click does not pay twice (idempotent).
- Effort: small to medium.

### W3 Vaccination plan and dose schedule (5 rows + db, P1, health)
Problem: assign-protocol, schedule and mark-dose routes have no screen, so `vaccine_schedule` has no UI writer and the passport and compliance counts rest on nothing.
- Design: on the animal's Vaccinations tab, "Plan" (assign a protocol, see due and overdue doses). "Give dose" from the schedule creates the vaccination record and links the schedule row in the same action - ONE writer for a vaccination, never two.
- Herd animals read the same tab; herd-wide dosing stays in the existing campaign screen.
- Owner decisions: can a vaccination entry be edited or deleted, or only corrected by an addendum or "entered by mistake" mark (ORPH-050/051)?
- Journeys: assign -> schedule rows -> due reminder -> give dose -> passport count rises, once.
- Effort: medium to large.

### W4 Batch cycles and mortality view - poultry, aquaculture, pig batches (5 rows + db, P1)
Problem: routes and tables for batches exist; nothing shows or starts a batch.
- Design: on the group screen of a batch-mode group: the running cycle on top, "Start new batch", "Close batch" with the reconcile figure, and a read-only ledger of population events. Mortality keeps its single entry point in Daily records; this screen only reads it.
- Cross-module: the farm profile engine decides which groups are batch mode (no species names in code); withdrawal, nutrition rations and sale warnings already read group state.
- Journeys: open, record mortality in Daily records, see it in the ledger, close and reconcile; only one active cycle.
- Effort: large.

### W5 Herd prescriptions and the farm treatment view (1 row, P1)
Problem: nobody can see a herd's prescription.
- Design: group screen, "Treatments" section reusing the Medicines and withdrawal card list (farmer and vet see the same). Pharmacy queue gap: a herd prescription has no animal row and never reaches the pharmacy (WDR-050 note) - decide with the pharmacy owner whether herd prescriptions go to the queue (network zone, needs approval).
- Effort: small.

### W6 Refund preview on cancel (1 row, P1)
- Design: one shared "what you get back" block, shown in the consultation cancel dialog and reused by the grooming cancel dialog. Same words, same layout, from `getRefundPreview`.
- Effort: small.

### W7 Marketplace inquiries - seller side (1 row, P1)
- Design: the seller sees inquiries on their listing, answers, and may reveal the masked phone (owner decision of 2026-11-18). Buyer sees the answer. Notifications via W1.
- Owner decisions: do marketplace orders still exist; are paid seller subscriptions and boosts dropped for good (ORPH-111..114)? If dropped, delete the routes (workstream W9).
- Effort: small to medium.

### W8 Tier-4 edit and delete gaps (23 rows, P2/P3)
Problem: create exists, edit and delete do not, for sensors, shifts, report templates, digital twins, simulations, sustainability metrics and goals, wellness scorecards, geofence zones, reminders, workforce tasks.
- Approach: do not build 23 screens blindly. For each, the owner answers "is this feature live?" (one list of 10 yes/no questions, the D rows). Live features get edit and delete in their existing list (shared row-actions component); features nobody uses are removed whole.
- Wellness scorecard: computed only (the nutrition work made it derived) - hand edit routes are deleted (ORPH-152).
- Effort: medium once the list is answered.

### W9 Dead code and duplicates (34 rows)
Delete in small, separately reviewed commits, each with the full removal list and a test that the removed route answers neutrally:
- two staff-invite routes (keep one), two payment-create routes (keep checkout), two user-status routes (keep freeze/suspend), direct farm-team add routes (the invite-only decision), the dead feed-consumption route that returns 410.
- Before each deletion: grep the whole repo and docs; confirm in the ledger row the replacement path.

### W10 Verify-before-acting items (security, do these early, in parallel with W0)
Found while tracing and not yet confirmed: `/animals/search/by-uid` names no `requireAnimal` gate (ORPH-034), `GET /files` may list other people's uploads (ORPH-014), a few Tier-4 routes were not read, `POST /disputes` has no owner caller (ORPH-129). Each gets a read-only check first, then a fix if it is a real hole. A real hole is fixed before any new screen.

### W11 Hospital network (4 rows, network zone - flagged only)
Walk-in invite accept, patient transfer start, pharmacist review visible to the prescribing vet, hospital profile page, attach hospital to network. Each needs your explicit approval before any design; listed here so they are not forgotten.

## 4. Order and dependencies

W10 and W0 first (small, protect everything). Then W1 (other workstreams notify through it), W2, W6, W5, W3, W4, W7, W8 after its answers, W9 continuously. W11 only on approval.
Every workstream is its own commit series; `develop` stays green and deployable after each.

## 5. Owner decisions needed (plain questions, 17 in the ledger)

Asked one at a time when their workstream starts, not all up front:
1. Can people delete photos or documents they uploaded?
2. Should a person see their own booking-action history?
3. When a vet is refused an animal, show "Request access" - and may the app say the animal exists?
4. Do vets look up an animal by its unique ID?
5. Can a vet correct a saved medical record, a vaccination or an allergy entry, or only add an addendum?
6. Do farmers want a last-30-days totals card?
7. Should each hospital network have a public profile page?
8. Can a corporate admin attach a hospital to a network?
9. Do marketplace orders still exist; are paid seller subscriptions and boosts dropped for good?
10. Are simulations disposable; are wellness scorecards computed only?

## 6. What I need from the owner now

The order of workstreams (the default above is by risk), and which to leave out or hold. Nothing is built until the order is confirmed; the withdrawal package in progress finishes first.
