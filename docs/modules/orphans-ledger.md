# Orphans ledger - nothing left without a screen

Owner mandate 2026-11-24: "I don't want anything left orphaned without any UI." Triage of the heuristic scan
(`scratchpad/orphans.cjs`: 89 backend routes with no client URL string, 102 client methods no page names). Written by the
requirements-analyst; no application code was changed. Rules of the H16 guard
(`frontend/src/guards/requirementsLedger.guard.test.ts`): rows never disappear, they change status.

How to read a row (the guard fixes the six columns, so the triage fields live inside them):
- Requirement cell starts with `[kind | class | priority]`. kind = route, client-method or db. Priority P1 = money,
  safety, health, compliance, or a role loses a core capability; P2 = convenience; P3 = admin nicety; `-` = none.
- Class A = false positive (reached another way; the evidence says how). Class B = real orphan, needs a screen (the row names
  role, screen and module). Class C = dead code, delete with what is listed. Class D = owner decision (question in the row).
- Status mapping: A = N/A (nothing to build). B, C, D = Planned until built, deleted, or decided. When the owner decides a D
  row, change it to Deferred ("owner", date) or Planned with the decision. Deleting a C row means changing its status to N/A
  with "deleted <date>" in the evidence; the row stays.
- Every B row obeys the repo rules: one place per fact (no second screen or second writer), phone-first, no error codes,
  six languages, and the route keeps its H15 gate (`requireAnimal` or `requireRecordAccess`). Network-hospital rows are
  flagged only: that code is change-protected (`feedback-network-hospital-change-approval`), nothing here designs it.

How the scan was checked: every item was looked up across `frontend/src` (pages, components, context, hooks, services), then
`backend/src`, `backend/scripts`, `backend/tests`, `docs`. The scanner misses (a) pages that call `apiService.get('/literal')`
or `client.get(...)` themselves (all of pharmacy, farm, vaccination passport), (b) paths built from a variable (nutrition
admin), (c) calls made with plain axios/fetch outside the client (auth refresh, public marketplace), (d) server-to-server
and token-only routes. Its other limit: a client method counted as "used" because a route path string appears in `App.tsx`
or `PermissionContext.tsx` (page routes, not API calls) - these were re-checked and are listed as orphans below.

Trace of the findings that matter most (full evidence in rows):
- Notifications are written by `backend/src/services/NotificationService.ts` and `backend/src/services/VaccineScheduleService.ts`
  and by the nutrition notifier, but no screen anywhere reads them (`frontend/src/services/api/modules/medicalRecords.ts:285-297`
  has no caller; Settings only has preferences). NUT-173 and NUT-174 are marked Built on "ordinary notifications list" - the list
  has no screen. Completeness-auditor should re-open those two rows.
- Wallet withdrawals: users can request (`frontend/src/pages/Wallet.tsx`, `grooming.ts:163-176`) but admin approve/reject/settle has
  no screen (`payments-and-reviews.routes.ts:573-587`). `Settlements.tsx` only handles the doctor `withdrawal_requests` queue.
- Vaccine protocol assignment and the dose schedule have no screen, so the table the passport reads has no UI writer.
- Batch cycles and population events (poultry, aquaculture) have no screen although the plan (`docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md`
  section 8) built the tables and routes.
- Two ways to do one thing (rule 1): staff invite (`/invite-staff` and `/staff-invites`), payment create (`/payments` and
  `/payments/checkout/:bookingId`), user status (`/admin/users/:id/status` and freeze/suspend), farm team add (direct add and invite).

## Auth, account, platform, files

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-001 | [route / A / -] POST /auth/refresh | all | auth | N/A | Reached by a direct axios call in the response interceptor, `frontend/src/services/api/core.ts:62`; not through the client URL list. |
| ORPH-002 | [route / A / -] POST /auth/logout | all | auth | N/A | Called with fetch in `frontend/src/context/AuthContext.tsx:149`. |
| ORPH-003 | [route / B / P2] POST /auth/logout-all, no screen to sign out of every device | all roles | auth, settings | Planned | `backend/src/routes/core-clinical.routes.ts:40`, `AuthController.ts:299`; no caller. Owner screen: Settings, Security section, one button "Sign out on all my devices" with a plain confirm. |
| ORPH-004 | [client-method / B / P2] revokeUserSessions, admin cannot sign a person out everywhere | admin | admin users, security | Planned | Client `frontend/src/services/api/modules/admin.ts:201`, route `admin-and-permissions.routes.ts:240`. Screen: admin Users row action next to freeze/suspend (`admin.ts:54-64`). Reason is required and audited. |
| ORPH-005 | [client-method / C / -] adminToggleUserStatus, a second way to switch an account on or off | admin | admin users | Planned | Superseded by freeze, unfreeze, suspend (`admin.ts:54-64`). Delete client `admin.ts:20`, route `admin-and-permissions.routes.ts:57`, `toggleUserStatusSchema`. First confirm unfreeze restores `is_active`; if not, fix unfreeze, then delete. |
| ORPH-006 | [route / C / P3] GET /admin/users/search | admin | admin users | Planned | `admin-and-permissions.routes.ts:30`; no caller in `frontend/src`, `backend/scripts`, `backend/tests`. Delete route. |
| ORPH-007 | [client-method / C / -] getFeatureFlags (GET /features) | all | settings | Planned | Flags reach the client through `/settings/public` (`frontend/src/context/SettingsContext.tsx:80`, `App.tsx:197`). Delete `marketplace.routes.ts:214` and client `admin.ts` method. |
| ORPH-008 | [client-method / C / -] healthCheck | none | platform | Planned | Client method unused. The route `/health` itself is A: used by the self-ping and platform health check (`backend/src/index.ts:37`, `app.ts:195`). Delete only the client method. |
| ORPH-009 | [client-method / C / -] fetchCsrfToken | none | auth | Planned | Method in `frontend/src/services/api/modules/auth.ts` has no URL and no caller; the CSRF cookie is read directly (`AuthContext.tsx:44`). Delete method. Unverified: whether a csrf route still exists server-side. |
| ORPH-010 | [client-method / C / P3] getProfile (GET /auth/profile) | all | auth | Planned | Unused (`auth.ts:77`); `updateProfile` (PUT same path, `auth.ts:82`) is used. Unverified how the session user is loaded; if the login response carries the user, delete GET route and client. |
| ORPH-011 | [route / A / -] POST /repair-schema | admin token | platform | N/A | Emergency-token endpoint, `marketplace.routes.ts:288` behind `emergencyGate` (CLAUDE.md, audit 2026-08-03). Never has a screen by design. |
| ORPH-012 | [route / A / -] GET /debug/db-state | admin token | platform | N/A | Same gate, `marketplace.routes.ts:255`. |
| ORPH-013 | [route / A / -] POST /webhooks/razorpay | gateway | payments | N/A | Server-to-server webhook, `payments-and-reviews.routes.ts:51`. |
| ORPH-014 | [route / C / P3] GET /files (list uploaded files) | none | files | Planned | `marketplace.routes.ts:312`, `FileController.list`; no screen wants a file list. Delete. Also check H15: a list of everyone's uploads must never be reachable (unverified what the controller filters by). |
| ORPH-015 | [route / D / P2] DELETE /files/* (remove an uploaded file) | all | files | Planned | OWNER DECISION. `marketplace.routes.ts:313`. Question: may a person delete a photo or document they uploaded (and what happens to it on a medical record or listing that uses it)? |
| ORPH-016 | [route / C / -] POST /files/upload-multiple | all | files | Planned | `marketplace.routes.ts:311`, `swagger.ts:462`. Screens use single upload, upload-image, upload-video (`auth.ts:90-106`). Delete route and the swagger entry. |

## Master data, farm profile, farm team

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-017 | [route / A / -] GET /master-data/species | all | master data | N/A | `frontend/src/context/MasterDataContext.tsx:172`. |
| ORPH-018 | [route / A / -] GET /master-data/breeds | all | master data | N/A | `MasterDataContext.tsx:173`. |
| ORPH-019 | [route / A / -] GET /master-data/animal-classes | all | master data | N/A | `MasterDataContext.tsx:174`. |
| ORPH-020 | [route / A / -] GET /master-data/marketplace/categories | all | marketplace | N/A | `MasterDataContext.tsx:175`. |
| ORPH-021 | [route / A / -] GET /master-data/marketplace/conditions | all | marketplace | N/A | `MasterDataContext.tsx:176`. |
| ORPH-022 | [route / A / -] GET /master-data/group-types | farmer | farm profile | N/A | `MasterDataContext.tsx:182`. |
| ORPH-023 | [route / A / -] GET /master-data/record-types | farmer | farm profile | N/A | `MasterDataContext.tsx:183`. |
| ORPH-024 | [route / C / P3] GET /farm-profile/resolve | none | farm profile | Planned | `backend/src/routes/farm-profile.routes.ts:33`; the app resolves in the browser from the byte-identical copy (`docs/modules/farm-profile.md:20`, `frontend/src/hooks/useFarmProfile.ts`). Delete the HTTP route and doc line 42; keep the service (write routes use it). |
| ORPH-025 | [route / A / -] GET /farm-invitations/by-token/:token | farm team invitee | farm team | N/A | Public preview: `previewFarmInvitation`, `frontend/src/services/api/modules/farmInvitations.ts:24`, called at `frontend/src/pages/JoinFarm.tsx:43`. |
| ORPH-026 | [route / C / P3] GET /vaccine-protocols/:id | all | vaccination | Planned | `catalog-and-roles.routes.ts:132`; list and admin routes are used (`hospital.ts:16-36`). Delete. |

## Consultations, prescriptions, payments, reviews

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-027 | [route / B / P3] GET /video-sessions/active, admin sees only a count | admin | video, admin dashboard | Planned | `core-clinical.routes.ts:314`; the dashboard shows `activeVideoSessions` as a number only (`AdminDashboard.tsx:202`). Screen: tap the live-sessions tile to open the list (one place). |
| ORPH-028 | [client-method / C / P3] joinVideoSession (POST /video-sessions/join/:roomId) | vet, owner | video | Planned | `core-clinical.routes.ts:319`; the consultation room does not call it (`frontend/src/pages/doctor/ConsultationRoom.tsx`). Unverified how join authorises; if sockets do it, delete route and client. |
| ORPH-029 | [route / B / P1] GET /prescriptions/group/:groupId, a herd or flock prescription cannot be seen | farmer, farm team, vet | prescriptions, farm groups, withdrawal | Planned | `core-clinical.routes.ts:381` (gated by `ensureGroupAccess`), no caller. Screen: group detail, Treatments section (same list for farmer and vet), showing the withdrawal dates already computed from the same prescription (WDR rows). One list, no new table. |
| ORPH-030 | [route / A / -] GET /vet/earnings | vet | earnings | N/A | `frontend/src/pages/doctor/VetEarnings.tsx:141` via `apiService.get`. |
| ORPH-031 | [client-method / C / P3] getBooking (GET /bookings/:id) | owner, vet | bookings | Planned | `core-clinical.routes.ts:242`; list screens carry the booking. Delete both unless a deep link to a booking is wanted. |
| ORPH-032 | [client-method / D / P3] getMyActionLogs (GET /action-logs/my) | all | bookings, privacy | Planned | OWNER DECISION. `core-clinical.routes.ts:256`. Question: should a person see a history of their own booking actions (cancelled, rescheduled by whom)? If yes it goes on My consultations. |
| ORPH-033 | [client-method / D / P2] checkAnimalAccess (GET /animals/:id/access-check) | vet | animal access | Planned | OWNER DECISION. `core-clinical.routes.ts:407`; the code comment says the screen should call it to show "Request access". Question: when a vet is refused an animal, should the app offer a "Request access" button, and may it say that the animal exists? Wording reveals someone's data. |
| ORPH-034 | [client-method / D / P2] searchAnimalByUniqueId (GET /animals/search/by-uid) | vet, staff | animals | Planned | OWNER DECISION. `core-clinical.routes.ts:404`, no caller; the route names no `requireAnimal` on its line (unverified what the controller returns; H15 check needed before any screen). Question: do vets look up an animal by its unique ID? |
| ORPH-035 | [client-method / C / P3] createVetProfile (POST /vet-profiles) | vet | auth | Planned | `core-clinical.routes.ts:423`; vet profile is provisioned at role change and registration (memory `role-change-vet-provisioning-fix-2026-07-25`). Delete after confirming no other writer path needs it. |
| ORPH-036 | [client-method / C / P3] getVetSchedules (GET /schedules/vet/:vetId) | owner | scheduling | Planned | `frontend/src/services/api/modules/schedule.ts:15`; booking screens use availability instead. Unverified route; delete if no consumer. |
| ORPH-037 | [client-method / C / P2] createPayment (POST /payments), second way to start a payment | owner | payments | Planned | `payments-and-reviews.routes.ts:523`, client `payments.ts:6`; the real flow is `/payments/checkout/:bookingId` (`:22`) and `/payments/verify` (`:30`). Delete route, `createPaymentSchema`, client. |
| ORPH-038 | [client-method / C / P3] getPaymentByBooking (GET /payments/booking/:id) | owner | payments | Planned | `payments-and-reviews.routes.ts:525`; History screens use the list and the invoice by payment. Delete unless the cancel dialog needs it (see ORPH-040). |
| ORPH-039 | [route / C / P3] GET /payments/:id and GET /invoices/:id | owner, admin | payments | Planned | `payments-and-reviews.routes.ts:57`; the client uses `/invoices/payment/:paymentId` (`payments.ts:54`) and the list. Delete both unless a receipt deep link is wanted. |
| ORPH-040 | [client-method / B / P1] getRefundPreview (GET /payments/refund-preview/:bookingId) | owner, farmer | payments, consultations | Planned | `payments-and-reviews.routes.ts:63`. The cancel dialog (`frontend/src/pages/Consultations.tsx:72`) never tells the user what they get back. Grooming has its own preview (`MyGroomingOrders.tsx:160`). Build ONE shared refund-preview block used by both; consultation money rule stays separate from grooming logic (owner rule 2026-07-28). |
| ORPH-041 | [client-method / C / P3] getLegalDocuments (GET /legal/documents) | all | legal | Planned | `payments-and-reviews.routes.ts:462`; the public page reads one document by type (`frontend/src/pages/PolicyPage.tsx`). Delete the list route/client or use it for a footer index. |
| ORPH-042 | [route / B / P3] GET /admin/legal-documents/user/:userId | admin | legal, admin users | Planned | `payments-and-reviews.routes.ts:518`; admin sees acceptance stats only (`payments.ts:191`). Screen: admin user detail, "Accepted documents" list. |
| ORPH-043 | [client-method / B / P2] addVetResponse (PUT /reviews/:id/vet-response) | vet | reviews | Planned | `payments-and-reviews.routes.ts:600`, `payments.ts:229`. Screen: `frontend/src/pages/doctor/MyReviews.tsx`, a reply box per review. |
| ORPH-044 | [client-method / B / P3] markReviewHelpful (POST /reviews/:id/helpful) | owner | reviews | Planned | `payments-and-reviews.routes.ts:601`. Screen: vet profile review list, one tap. If the owner does not want helpful votes: delete (see question 9). |
| ORPH-045 | [client-method / B / P2] reportReview (POST /reviews/:id/report) | vet, owner | reviews, moderation | Planned | `payments-and-reviews.routes.ts:602`. Screen: review card menu "Report"; feeds the existing admin queue `frontend/src/pages/admin/ReviewModeration.tsx` (no second queue). |

## Medical records, vaccination, notifications

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-046 | [client-method / B / P1] listNotifications, a person cannot read their notifications | all roles | notifications | Planned | `medical-records.routes.ts:54`, client `medicalRecords.ts:285`; no component calls it (only `NotificationPreferencesPanel.tsx` exists). Written by `NotificationService.ts`, `VaccineScheduleService.ts`, nutrition notifier (NUT-173, NUT-174). Screen: bell in the shared header with unread count, opening one Notifications list (phone: bottom sheet / page). One list for every role. |
| ORPH-047 | [client-method / B / P1] markNotificationRead | all roles | notifications | Planned | `medical-records.routes.ts:55`; tapping a row marks it read and opens the thing it is about. Part of ORPH-046. |
| ORPH-048 | [client-method / B / P1] markAllNotificationsRead | all roles | notifications | Planned | `medical-records.routes.ts:56`; "Mark all read" in the same list. |
| ORPH-049 | [client-method / D / P1] updateMedicalRecord (PUT /medical-records/:id) | vet | medical records | Planned | OWNER DECISION. `medical-records.routes.ts:23` (gated). `frontend/src/pages/Animals.tsx:246` is only a comment. Question: can a vet correct a saved medical record (with an audit trail and "corrected on" label) or is a record final and fixed only by a new addendum? |
| ORPH-050 | [client-method / D / P2] updateVaccination | vet, owner | vaccination | Planned | OWNER DECISION. `medical-records.routes.ts:29`. Same question for vaccination entries (wrong date or batch). |
| ORPH-051 | [client-method / D / P2] deleteVaccination | vet, owner | vaccination | Planned | OWNER DECISION. `medical-records.routes.ts:30`. May a vaccination entry be deleted, or only marked "entered by mistake"? |
| ORPH-052 | [client-method / D / P2] updateAllergy | vet, owner | allergies | Planned | OWNER DECISION. `medical-records.routes.ts:41`. Same correction question for allergy entries (safety-relevant). |
| ORPH-053 | [client-method / B / P1] getAnimalVaccineAssignments | vet, owner, farmer | vaccination | Planned | `catalog-and-roles.routes.ts:279` (`requireAnimal`). Screen: Animal detail, Vaccinations tab ("schedule they follow"); herd animals read the same. |
| ORPH-054 | [client-method / B / P1] assignVaccineProtocol | vet, farmer, owner | vaccination | Planned | `catalog-and-roles.routes.ts:284` also generates the schedule rows. Without a screen `vaccine_schedule` has no UI writer, so passport/compliance numbers and due reminders (`VaccineScheduleService.ts`) have nothing to count. Screen: Animal detail, Vaccinations, "Follow a vaccine plan" picker (master data, never free text). |
| ORPH-055 | [client-method / B / P2] waiveVaccineProtocol | vet, owner | vaccination | Planned | `catalog-and-roles.routes.ts:301`; "Skip this plan" with a reason, same tab. |
| ORPH-056 | [client-method / B / P1] getAnimalVaccineSchedule | vet, owner, farmer | vaccination | Planned | `catalog-and-roles.routes.ts:308`; the list of due and overdue doses on the same tab. |
| ORPH-057 | [client-method / B / P1] markVaccineDoseAdministered | vet, farmer | vaccination | Planned | `catalog-and-roles.routes.ts:313` (`requireRecordAccess`). It needs an existing `vaccinationRecordId`; to keep ONE writer, recording a vaccination from this tab must create the `vaccination_records` row and link the schedule row in one action. No separate "mark done" entry. |
| ORPH-058 | [client-method / A / -] getVaccinationPassport | owner, vet | vaccination | N/A | `frontend/src/pages/VaccinationPassport.tsx:86` (`client.get` literal). |
| ORPH-059 | [client-method / A / -] getVaccinationComplianceSummary | owner, farmer | vaccination | N/A | `VaccinationPassport.tsx:110`. |
| ORPH-060 | [client-method / A / -] logVaccineCertificateDownload | owner | vaccination | N/A | `VaccinationPassport.tsx:248`. |
| ORPH-061 | [client-method / A / -] getAnimalCertificateLogs | owner | vaccination | N/A | `VaccinationPassport.tsx:124`. |
| ORPH-062 | [client-method / A / -] getCertificatesByAnimal | owner, vet | certificates | N/A | `frontend/src/pages/MedicalRecords.tsx:214` via `apiService.get`. |
| ORPH-063 | [route / C / P2] GET /compliance/report | farmer, admin | compliance | Planned | `network-financial-summary.routes.ts:224`; no caller. Duplicates the vaccination compliance summary (`VaccinationPassport.tsx:110`) and enterprise compliance (`enterprise.ts:291-316`); it also reads only `animals.owner_id`, so farm animals are missed. Delete; do not add a third compliance screen. |

## Farm, groups, enterprise, feed

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-064 | [route / C / P1-cleanup] POST /enterprises/:id/feed/consumption | farmer | feed, nutrition | Planned | Answers 410 only (`backend/src/controllers/Tier2Controller.ts:223`); feed given is entered only in Daily records (NUT-043, NUT-213). Delete route `network-permissions-and-workflow.routes.ts:151`, controller method, `FEED_GIVEN_MOVED_MESSAGE` once no old client exists. |
| ORPH-065 | [client-method / B / P1] listGroupCycles | farmer, vet | batch cycles | Planned | `enterprise-farm.routes.ts:97`, client `auth.ts`; no screen. Plan: `docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md` section 8.1. Screen: group detail for batch-mode groups (poultry, aquaculture, pig batches), "Cycles" list. |
| ORPH-066 | [client-method / B / P1] getActiveGroupCycle | farmer, vet | batch cycles | Planned | `enterprise-farm.routes.ts:102`; header of the same group screen shows the running cycle. |
| ORPH-067 | [client-method / B / P1] openGroupCycle | farmer | batch cycles | Planned | `enterprise-farm.routes.ts:107`; "Start new batch" action, only one active cycle allowed. |
| ORPH-068 | [client-method / B / P1] closeGroupCycle | farmer | batch cycles | Planned | `enterprise-farm.routes.ts:118`; "Close batch" (sold or finished) with the reconcile figure. |
| ORPH-069 | [client-method / B / P1] listPopulationEvents | farmer, vet | batch cycles | Planned | `enterprise-farm.routes.ts:132`; one ledger list. Mortality already enters through Daily records (`FarmRecordService.ts` writes `group_population_events`): this screen READS the ledger and must not become a second entry for the same fact. |
| ORPH-070 | [client-method / B / P2] recordPopulationEvent | farmer | batch cycles | Planned | `enterprise-farm.routes.ts:138`. Only event types that Daily records cannot enter (placement, hatch, transfer, adjustment); mortality and cull stay in Daily records (rule 1). Decide the split when building. |
| ORPH-071 | [client-method / B / P2] reconcileGroup | farmer | batch cycles | Planned | `enterprise-farm.routes.ts:148`; "Counts match / off by N" line on the group screen. |
| ORPH-072 | [client-method / B / P2] promoteAnimalFromBatch | farmer | batch to animal | Planned | `enterprise-farm.routes.ts:166`; "Keep this bird/fish as an individual animal" from the group member list. |
| ORPH-073 | [client-method / C / P3] getEnterprise (GET /enterprises/:id) | farmer | enterprise | Planned | `enterprise-farm.routes.ts:24`; the loose hit in `GeospatialAnalytics.tsx:328` is `/enterprises/:id/animals`, not this. Delete unless a farm detail deep link is wanted. |
| ORPH-074 | [client-method / C / P1-cleanup] addEnterpriseMember (POST /enterprises/:id/members) | farmer | farm team | Planned | `enterprise-farm.routes.ts:34`. Farm team is invite-only (memory `farm-team-access-decisions-2026-11-16`); a direct add bypasses it. Delete route and client. |
| ORPH-075 | [client-method / C / P2] inviteEnterpriseMember (POST /enterprises/:id/invite-member) | farmer | farm team | Planned | `enterprise-farm.routes.ts:40`; the real invite is the farm-invitations module (`farmInvitations.ts`, `JoinFarm.tsx:43`). Two invite paths for one fact; delete this one. Confirm `enterprise_members` and the invite table share one acceptance path first. |
| ORPH-076 | [client-method / C / P3] getAnimalGroup | farmer | groups | Planned | `enterprise-farm.routes.ts:57`; lists carry the data. |
| ORPH-077 | [client-method / C / P3] getLocation | farmer | locations | Planned | `enterprise-farm.routes.ts:184`. |
| ORPH-078 | [client-method / C / P3] getMovement | farmer | movements | Planned | `enterprise-farm.routes.ts:192`. |
| ORPH-079 | [client-method / C / P3] getCampaign | farmer | campaigns | Planned | `enterprise-farm.routes.ts:200`. |
| ORPH-080 | [client-method / D / P2] farmRecordsSummary (GET /farm-records/summary) | farmer | daily records | Planned | OWNER DECISION. `farm-records.routes.ts:42`, client `farmRecords.ts:20`. Question: do farmers want a "last 30 days totals and trend" card (milk, eggs, feed) on their farm screen? |
| ORPH-081 | [client-method / B / P2] deleteFarmRecord (DELETE /farm-records/:id) | farmer, farm team | daily records | Planned | `farm-records.routes.ts:80`. A wrongly entered daily record (feed, milk, mortality) cannot be removed or fixed; screen: Daily records, row menu "Remove this entry" with confirm; stock and FCR recompute from the same table (no side archive). |

## Grooming and wallet

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-082 | [client-method / B / P2] updateGroomingService | groomer | grooming | Planned | `grooming.routes.ts:102`; provider edits price/duration of own service in `frontend/src/pages/grooming/GroomingProvider.tsx`. |
| ORPH-083 | [client-method / C / P3] getGroomingOrder | owner, groomer | grooming | Planned | `grooming.routes.ts:243`; order lists carry the detail. Delete unless a deep link is wanted. |
| ORPH-084 | [client-method / B / P1] adminListWalletWithdrawals | admin | wallet, money | Planned | `payments-and-reviews.routes.ts:573`; users can request (`grooming.ts:163`) but nobody can process. Screen: admin Settlements, second queue "Wallet withdrawals" next to the doctor queue (`Settlements.tsx:34`), same layout. |
| ORPH-085 | [client-method / B / P1] adminApproveWalletWithdrawal | admin | wallet, money | Planned | `payments-and-reviews.routes.ts:577`; row action in the queue above. |
| ORPH-086 | [client-method / B / P1] adminRejectWalletWithdrawal | admin | wallet, money | Planned | `payments-and-reviews.routes.ts:582`; reject needs a reason shown to the requester. |
| ORPH-087 | [client-method / B / P1] adminSettleWalletWithdrawal | admin | wallet, money | Planned | `payments-and-reviews.routes.ts:587`; settle with bank reference (UTR), as for doctors. |
| ORPH-088 | [client-method / B / P3] getGroomingMonthAvailability | owner | grooming booking | Planned | `grooming.routes.ts:176`; month view dots in the booking date picker (the day view exists). |
| ORPH-089 | [client-method / B / P2] deleteGroomingSchedule | groomer | grooming | Planned | `grooming.routes.ts:197`; remove a working-hours row in the provider schedule screen. |

## Hospital network (change-protected: flag only, no design)

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-090 | [route / D / P3] GET /hospital-networks/:id/public | public | hospital network | Planned | OWNER DECISION, network zone. `hospital-network.routes.ts:89`, no caller. Question: should each hospital network have a public profile page an owner can open before booking? |
| ORPH-091 | [route / A / -] GET /hospital-networks/:id/departments | hospital staff | hospital network | N/A | `frontend/src/pages/hospitalnetwork/HospitalNetworks.tsx:630` (`apiService.get`). |
| ORPH-092 | [route / A / -] GET /network-user-search | admin | staff settings | N/A | `frontend/src/pages/admin/StaffSettings.tsx:201`. |
| ORPH-093 | [route / C / P3] GET /hospital-networks/:id/patients | hospital staff | hospital network | Planned | FLAG, network zone. `hospital-network.routes.ts:353`; the screens use `searchNetworkPatients` (`hospital.ts:225`). Propose deleting after owner approval; do not edit without it. |
| ORPH-094 | [route / A / -] GET /animals/:animalId/care-contexts | vet | prescriptions | N/A | `frontend/src/pages/doctor/PrescriptionWriter.tsx:139`. |
| ORPH-095 | [route / A / -] GET /consent/search-doctors | owner | consent | N/A | `frontend/src/components/patientConsent/GrantConsentModal.tsx:125`. |
| ORPH-096 | [route / A / -] GET /consent/search-hospitals | owner | consent | N/A | `GrantConsentModal.tsx:132`. |
| ORPH-097 | [route / A / -] GET /consent/search-networks | owner | consent | N/A | `GrantConsentModal.tsx:139`. |
| ORPH-098 | [route / B / P1] POST /hospital-networks/walkin-invites/accept, a walk-in invitee cannot accept | pet owner | hospital network, enrolment | Planned | FLAG, network zone. `hospital-network.routes.ts:721`, `enrollment.ts:273`; the invite is created (`enrollment.ts:253`, client `hospital.ts:234`) and its token returned to the inviter, but no page takes the token, so `hospital_patient_invites` rows stay `pending` forever. Needs owner approval before any screen (accept page by link, like `/accept-staff-invite`). |
| ORPH-099 | [route / C / P2] POST /hospital-networks/:id/invite-staff, second staff-invite writer | hospital staff, corporate admin | staff invites | Planned | FLAG, network zone. `hospital-staff-invites.routes.ts:17` and `/staff-invites` (`:178`) both insert into `hospital_staff_invites`; the screens use only `/staff-invites` (`networkSubscriptions.ts:63`). Rule 1 defect. Propose: delete `/invite-staff` after approval, confirm the seat-limit check exists on the kept route. |
| ORPH-100 | [client-method / C / P3] getHospitalNetwork (GET /hospital-networks/:id) | hospital staff | hospital network | Planned | FLAG. `hospital-network.routes.ts:24`; the hit in `PermissionContext.tsx:96` is a page-route list, not a call. |
| ORPH-101 | [client-method / D / P3] assignHospitalToNetwork | corporate admin | hospital network | Planned | OWNER DECISION, network zone. `hospital-network.routes.ts:114`, client `hospital.ts`. Question: can a corporate admin attach an existing hospital to a network from the app, or is that done by platform admin only? |
| ORPH-102 | [client-method / A / -] getNetworkPharmacyReports | corporate admin | pharmacy | N/A | `frontend/src/pages/pharmacy/PharmacyDashboard.tsx:107`. |
| ORPH-103 | [client-method / B / P1] createPatientTransfer | hospital staff, vet | patient transfer | Planned | FLAG, network zone. `network-financial-summary.routes.ts:80`, client `networkSubscriptions.ts:103`; list and complete exist (`:100`, `:106`) so a transfer can be completed but never started from the app. Needs approval. |
| ORPH-104 | [client-method / C / P3] getNetworkSubscriptionPlans | corporate admin | subscriptions | Planned | FLAG. `network-subscriptions.routes.ts:15`; admin create/update are used. Delete or use on the "my plan" screen (ORPH-106). |
| ORPH-105 | [client-method / B / P3] deleteNetworkPlan | admin | subscriptions | Planned | `network-subscriptions.routes.ts:49` (admin only); admin plan screen has create/update but no remove. Block while a network is on the plan. |
| ORPH-106 | [client-method / B / P2] getMyNetworkSubscription | corporate admin | subscriptions | Planned | `pricing-visibility.routes.ts:62`; the corporate admin cannot see their own plan, seats used or renewal. Screen: network Settings, "My plan". |

## Marketplace

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-107 | [route / A / -] GET /public/marketplace/listings | public | marketplace | N/A | Plain axios in `frontend/src/services/api/modules/marketplace.ts:7`. |
| ORPH-108 | [route / A / -] GET /public/marketplace/listings/:id | public | marketplace | N/A | `marketplace.ts:12`. |
| ORPH-109 | [route / A / -] GET /public/marketplace/stats | public | marketplace | N/A | `marketplace.ts:17`. |
| ORPH-110 | [client-method / B / P1] respondToInquiry (PATCH /marketplace/inquiries/:id/respond) | seller | marketplace | Planned | `marketplace.routes.ts:94`, client `marketplace.ts:289`. Buyers can send an inquiry (`createInquiry`, `:279`) but the seller has no way to answer or reveal the masked phone (owner decision 2026-11-18). Screen: seller's inquiries list, "Share my number" and "Decline". |
| ORPH-111 | [client-method / D / P2] updateOrderStatus (PATCH /marketplace/orders/:id/status) | buyer, seller | marketplace | Planned | OWNER DECISION. `marketplace.routes.ts:47`. The marketplace is free classifieds with no payments (memory `marketplace-gap-analysis-plan-2026-07-19`); question: do marketplace "orders" still exist, or only inquiries? If they exist the seller needs a status screen. |
| ORPH-112 | [client-method / D / P2] getUserSubscription, createUserSubscription, cancelUserSubscription | seller | marketplace money | Planned | OWNER DECISION. `marketplace.routes.ts:88-90`. Question: are paid seller subscriptions dropped for good (listings 100% free), so these three routes and any table can be deleted? |
| ORPH-113 | [client-method / D / P2] boostListing (POST /marketplace/listings/:id/boost) | seller | marketplace money | Planned | OWNER DECISION. `marketplace.routes.ts:91`. Question: are paid "boost" listings dropped for good? |
| ORPH-114 | [client-method / D / P2] getUserMonetizationStatus | seller | marketplace money | Planned | OWNER DECISION. `marketplace.routes.ts:95`. Goes with the two rows above. |

## Nutrition admin (all reached through one dynamic client)

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-115 | [route / A / -] GET /nutrition/admin/species | admin | nutrition | N/A | `nutritionAdminList('species')`, `frontend/src/services/api/modules/nutrition.ts:139-152`, page `frontend/src/pages/admin/NutritionAdmin.tsx`. |
| ORPH-116 | [route / A / -] PUT /nutrition/admin/species/:code | admin | nutrition | N/A | `nutritionAdminSetSpeciesModel`, `nutrition.ts:151`. |
| ORPH-117 | [route / A / -] GET /nutrition/admin/energy-factors | admin | nutrition | N/A | `NutritionAdmin.tsx:139`. |
| ORPH-118 | [route / A / -] POST /nutrition/admin/energy-factors | admin | nutrition | N/A | `nutritionAdminSave`, `nutrition.ts:155`; `NutritionAdmin.tsx:160`. |
| ORPH-119 | [route / A / -] PUT /nutrition/admin/energy-factors/:id | admin | nutrition | N/A | same call with an id, `nutrition.ts:157`. |
| ORPH-120 | [route / A / -] PUT /nutrition/admin/foods/:id | admin | nutrition | N/A | `nutritionAdminSave('foods', id, ...)`, `nutrition.ts:155-157`. |
| ORPH-121 | [route / A / -] GET /nutrition/admin/unsafe-foods | admin | nutrition | N/A | `NutritionAdmin.tsx:289`. |
| ORPH-122 | [route / A / -] POST /nutrition/admin/unsafe-foods | admin | nutrition | N/A | `NutritionAdmin.tsx:310`. |
| ORPH-123 | [route / A / -] PUT /nutrition/admin/unsafe-foods/:id | admin | nutrition | N/A | same call with an id, `nutrition.ts:157`. |
| ORPH-124 | [route / A / -] GET /nutrition/admin/requirement-sets | admin | nutrition | N/A | `nutrition.ts:139`. |
| ORPH-125 | [route / A / -] POST /nutrition/admin/requirement-sets | admin | nutrition | N/A | `nutritionAdminSave`, `nutrition.ts:155`. |

## Admin pages calling through `apiService.get/post` literals

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-126 | [route / A / -] GET /admin/revenue-trends | admin | admin dashboard | N/A | `frontend/src/pages/admin/AdminDashboard.tsx:69`. |
| ORPH-127 | [route / A / -] POST /animals/bulk-import | owner, farmer | animals | N/A | `frontend/src/pages/Animals.tsx:167`. |
| ORPH-128 | [route / A / -] GET /disputes | admin | disputes | N/A | `frontend/src/pages/admin/DisputeManagement.tsx:60`. |
| ORPH-129 | [route / A / -] POST /disputes | owner | disputes | N/A | Called from the same screen family; unverified which screen posts: the only matching caller found is `DisputeManagement.tsx:76` (admin resolve). Re-check that an owner has a "raise a dispute" button; if not this becomes B P1 (money). |
| ORPH-130 | [route / A / -] PUT /disputes/:id/resolve | admin | disputes | N/A | `DisputeManagement.tsx:76`. |

## Tier-4 analytics (edit and delete missing where create exists)

Each module below has a page that creates the record (`GenomicLineage.tsx`, `IoTSensors.tsx`, `SupplyChain.tsx`,
`Workforce.tsx`, `ReportBuilder.tsx`, `DigitalTwin.tsx`, `Sustainability.tsx`, `WellnessPortal.tsx`,
`GeospatialAnalytics.tsx`, `HospitalWorkflow.tsx`) but a wrong entry can never be fixed or removed. Class B means: add Edit
and Remove on the existing row of the same screen (no new screens).

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-131 | [client-method / B / P2] updateGeneticProfile | vet, farmer | genomics | Planned | `network-permissions-and-workflow.routes.ts:196`; edit on `GenomicLineage.tsx`. |
| ORPH-132 | [client-method / B / P3] getLineageTree | vet, farmer | genomics | Planned | `network-permissions-and-workflow.routes.ts:197` (`requireAnimal`); family tree view on the same page. |
| ORPH-133 | [client-method / B / P3] updateSensor | farmer | IoT | Planned | `network-permissions-and-workflow.routes.ts:206`; edit on `IoTSensors.tsx`. |
| ORPH-134 | [client-method / B / P3] deleteSensor | farmer | IoT | Planned | `:207`; remove a retired sensor. |
| ORPH-135 | [client-method / B / P3] updateBatch (supply chain) | farmer | supply chain | Planned | `:215`; edit on `SupplyChain.tsx`. Not the same as animal batch cycles (ORPH-065). |
| ORPH-136 | [client-method / B / P2] getBatchTraceability | farmer, buyer | supply chain | Planned | `:219`; traceability view on `SupplyChain.tsx` (compliance value for milk and meat). |
| ORPH-137 | [client-method / B / P3] deleteWorkforceTask | farmer, manager | workforce | Planned | `:228`; `Workforce.tsx`. |
| ORPH-138 | [client-method / B / P3] updateShift | farmer, manager | workforce | Planned | `:231`. |
| ORPH-139 | [client-method / B / P3] deleteShift | farmer, manager | workforce | Planned | `:234`. |
| ORPH-140 | [client-method / B / P3] updateReportTemplate | admin, farmer | reports | Planned | `:400`; `ReportBuilder.tsx`. |
| ORPH-141 | [client-method / B / P3] deleteReportTemplate | admin, farmer | reports | Planned | `:401`. |
| ORPH-142 | [client-method / B / P2] updateWorkflowCase | hospital staff | hospital workflow | Planned | FLAG, network zone. `:297`; case edit in `HospitalWorkflow.tsx`. Unverified whether status changes go through a different route. |
| ORPH-143 | [client-method / B / P2] updateInpatientDetails | hospital staff | inpatient | Planned | FLAG, network zone. `:390`; `InpatientManagement.tsx` has status change (`updateInpatientStatus`, `automation.ts:107`) but not details. |
| ORPH-144 | [client-method / C / P3] getChatSession | vet, owner | AI copilot | Planned | `:412`; list, create, delete are used; the chat page holds messages itself. Delete unless history reopen is wanted. |
| ORPH-145 | [client-method / B / P3] updateDigitalTwin | farmer | digital twin | Planned | `:424`; `DigitalTwin.tsx`. |
| ORPH-146 | [client-method / B / P3] deleteDigitalTwin | farmer | digital twin | Planned | `:425`. |
| ORPH-147 | [client-method / D / P3] deleteSimulation | farmer | simulations | Planned | OWNER DECISION. `:429`; `runSimulation` and `listSimulations` exist; question: keep simulation history with a Remove button, or are simulations throw-away (then delete the stored rows and this route)? |
| ORPH-148 | [client-method / B / P3] updateSustainabilityMetric | farmer | sustainability | Planned | `marketplace.routes.ts:104`; `Sustainability.tsx`. |
| ORPH-149 | [client-method / B / P3] deleteSustainabilityMetric | farmer | sustainability | Planned | `marketplace.routes.ts:105`. |
| ORPH-150 | [client-method / B / P3] updateSustainabilityGoal | farmer | sustainability | Planned | `marketplace.routes.ts:108`. |
| ORPH-151 | [client-method / B / P3] deleteSustainabilityGoal | farmer | sustainability | Planned | `marketplace.routes.ts:109`. |
| ORPH-152 | [client-method / D / P2] updateWellnessScorecard | owner, vet | wellness | Planned | OWNER DECISION. `marketplace.routes.ts:116` (`requireAnimal`). NUT-172 made the nutrition score derived. Question: are scorecards hand-edited records, or computed only (then no edit, and delete the route)? |
| ORPH-153 | [client-method / B / P3] deleteWellnessScorecard | owner, vet | wellness | Planned | `marketplace.routes.ts:117` (`requireAnimal`); remove an old scorecard in `WellnessPortal.tsx`. |
| ORPH-154 | [client-method / B / P2] deleteReminder | owner | wellness | Planned | `marketplace.routes.ts:122`; owner cannot remove a reminder they created in `WellnessPortal.tsx`. |
| ORPH-155 | [client-method / B / P3] updateGeofenceZone | farmer | geospatial | Planned | `marketplace.routes.ts:128`; `GeospatialAnalytics.tsx`. |
| ORPH-156 | [client-method / B / P3] deleteGeofenceZone | farmer | geospatial | Planned | `marketplace.routes.ts:129`. |

## Pharmacy (32 routes; the pages call a local `client` with literal paths, so the scanner missed them)

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-157 | [route / A / -] GET /pharmacy/my-pharmacies | pharmacist | pharmacy | N/A | `frontend/src/pages/pharmacy/PharmacyDashboard.tsx:59`. |
| ORPH-158 | [route / C / P3] GET /networks/:networkId/pharmacies | corporate admin | pharmacy | Planned | `pharmacy.routes.ts`; only the POST is called (`PharmacyCreateModal.tsx:30`), lists come from my-pharmacies. Delete after network-zone approval. |
| ORPH-159 | [route / A / -] POST /networks/:networkId/pharmacies | corporate admin | pharmacy | N/A | `PharmacyCreateModal.tsx:30`. |
| ORPH-160 | [route / A / -] GET /pharmacies/:pharmacyId | pharmacist | pharmacy | N/A | `PharmacySettings.tsx:43`, `DispensingModal.tsx:91`. |
| ORPH-161 | [route / A / -] PATCH /pharmacies/:pharmacyId | pharmacist | pharmacy | N/A | `PharmacySettings.tsx:67`. |
| ORPH-162 | [route / A / -] GET /networks/:networkId/suppliers | pharmacist | pharmacy | N/A | `MedicationCatalog.tsx:64`, `PharmacyInventory.tsx:76`. |
| ORPH-163 | [route / A / -] POST /networks/:networkId/suppliers | pharmacist | pharmacy | N/A | `PharmacySuppliers.tsx:77`. |
| ORPH-164 | [route / A / -] PATCH /networks/:networkId/suppliers/:supplierId | pharmacist | pharmacy | N/A | `PharmacySuppliers.tsx:75`. |
| ORPH-165 | [route / A / -] GET /networks/:networkId/medications | pharmacist | pharmacy | N/A | `MedicationCatalog.tsx:63`. |
| ORPH-166 | [route / A / -] POST /networks/:networkId/medications | pharmacist | pharmacy | N/A | `MedicationCatalog.tsx:139`. |
| ORPH-167 | [route / A / -] PATCH /networks/:networkId/medications/:medId | pharmacist | pharmacy | N/A | `MedicationCatalog.tsx:137,153`. |
| ORPH-168 | [route / A / -] GET /pharmacies/:pharmacyId/inventory | pharmacist | pharmacy | N/A | `PharmacyInventory.tsx:74`, `DispensingModal.tsx:96`. |
| ORPH-169 | [route / A / -] POST /pharmacies/:pharmacyId/inventory | pharmacist | pharmacy | N/A | `PharmacyInventory.tsx:154`. |
| ORPH-170 | [route / A / -] GET /pharmacies/:pharmacyId/expiry-alerts | pharmacist | pharmacy | N/A | `PharmacyAlerts.tsx:65`. |
| ORPH-171 | [route / A / -] GET /pharmacies/:pharmacyId/low-stock-alerts | pharmacist | pharmacy | N/A | `PharmacyAlerts.tsx:66`, `frontend/src/utils/pharmacyStock.ts:10`. |
| ORPH-172 | [route / A / -] POST /pharmacies/:pharmacyId/stock-adjustments | pharmacist | pharmacy | N/A | `StockAdjustmentModal.tsx:44`. |
| ORPH-173 | [route / B / P2] GET /pharmacies/:pharmacyId/stock-adjustments, nobody can read the adjustment history | pharmacist, corporate admin | pharmacy, audit | Planned | `pharmacy.routes.ts`; only POST has a caller (`StockAdjustmentModal.tsx:44`). Screen: Inventory item detail, "Adjustment history" (who, why, how many) - the audit trail for write-offs. Network zone flag. |
| ORPH-174 | [route / A / -] GET /pharmacies/:pharmacyId/reorders | pharmacist | pharmacy | N/A | `ReordersManagement.tsx:55`. |
| ORPH-175 | [route / A / -] POST /pharmacies/:pharmacyId/reorders | pharmacist | pharmacy | N/A | `ReorderRequestModal.tsx:56`. |
| ORPH-176 | [route / A / -] PATCH /pharmacies/:pharmacyId/reorders/:reorderId | pharmacist | pharmacy | N/A | `ReordersManagement.tsx:76`. |
| ORPH-177 | [route / A / -] GET /pharmacies/:pharmacyId/pending-prescriptions | pharmacist | pharmacy | N/A | `DispensingWorkflow.tsx:35`, `PharmacyDashboard.tsx:82`. |
| ORPH-178 | [route / A / -] POST /prescriptions/:prescriptionId/review | pharmacist | pharmacy | N/A | `PrescriptionReviewModal.tsx:73`. |
| ORPH-179 | [route / B / P1] GET /prescriptions/:prescriptionId/reviews, prescriber cannot see the pharmacist's review | vet, pharmacist | pharmacy, prescriptions | Planned | `pharmacy.routes.ts:539`; no caller (a pharmacist can write a review/hold on a prescription, `PrescriptionReviewModal.tsx:73`, but the vet who wrote it never sees it; patient-safety loop). Screen: prescription detail for the vet (and the pharmacist's modal history): "Pharmacy review" with status and note, plus a notification via ORPH-046. Network zone flag. |
| ORPH-180 | [route / A / -] GET /pharmacies/:pharmacyId/ready-for-dispensing | pharmacist | pharmacy | N/A | `DispensingWorkflow.tsx:36`. |
| ORPH-181 | [route / A / -] POST /dispensing | pharmacist | pharmacy | N/A | `DispensingModal.tsx:180`. |
| ORPH-182 | [route / A / -] PATCH /dispensing/:dispensingId | pharmacist | pharmacy | N/A | `DispensingHistory.tsx:83`. |
| ORPH-183 | [route / A / -] GET /pharmacies/:pharmacyId/dispensing-history | pharmacist | pharmacy | N/A | `DispensingHistory.tsx:64`. |
| ORPH-184 | [route / A / -] GET /pharmacies/:pharmacyId/analytics | pharmacist | pharmacy | N/A | `PharmacyDashboard.tsx:96`. |
| ORPH-185 | [route / A / -] GET /networks/:networkId/med-requests | pharmacist | pharmacy | N/A | `MedicationTransfers.tsx:67`. |
| ORPH-186 | [route / A / -] POST /networks/:networkId/med-requests | pharmacist | pharmacy | N/A | `MedicationTransfers.tsx:149`. |
| ORPH-187 | [route / A / -] PATCH /networks/:networkId/med-requests/:requestId | pharmacist | pharmacy | N/A | `MedicationTransfers.tsx:94`. |
| ORPH-188 | [route / A / -] GET /pharmacies/:pharmacyId/dashboard | pharmacist | pharmacy | N/A | `PharmacyDashboard.tsx:81`. |

## Database (found cheaply while tracing; not a full audit)

| ID | Requirement | Who | Modules | Status | Evidence / decision |
|---|---|---|---|---|---|
| ORPH-189 | [db / B / P1] `notifications` rows are written but no screen reads them | all roles | notifications | Planned | Writers `backend/src/services/NotificationService.ts`, `backend/src/services/VaccineScheduleService.ts`, nutrition notifier; reader route has no caller (ORPH-046). Closing ORPH-046 closes this. |
| ORPH-190 | [db / B / P1] `hospital_patient_invites` rows are written, accepted nowhere | pet owner | hospital network | Planned | Writer `enrollment.ts:253`; accept route `hospital-network.routes.ts:721` has no screen (ORPH-098). Network zone flag. |
| ORPH-191 | [db / B / P1] vaccine assignment and `vaccine_schedule` rows have no UI writer | vet, owner, farmer | vaccination | Planned | Writers only via `catalog-and-roles.routes.ts:284` (ORPH-054); readers: passport and compliance (`VaccineScheduleService.ts:97,248,354,387`). Unverified whether another job also seeds schedule rows. |
| ORPH-192 | [db / B / P1] wallet withdrawal rows are requested but nobody can process them | owner, groomer, admin | wallet | Planned | Writer: user request (`grooming.ts:163`); processors have no screen (ORPH-084 to ORPH-087). Table name unverified here. |
| ORPH-193 | [db / B / P1] `group_cycles` rows have no UI writer or reader | farmer | batch cycles | Planned | Routes `enterprise-farm.routes.ts:97-118` (ORPH-065 to ORPH-068); `group_population_events` is written by `FarmRecordService.ts` (mortality) and read by `BatchManagementService.ts` only. |
