# Farm profile engine

"Parent drives children": which fields, sections, daily records and events apply to an animal or
a group is decided by **master data**, never by a species name in code. Design and owner
decisions: `docs/FARM_MANAGEMENT_PLAN.md` §6. Shipped as Phase 1 of that plan (migration 043).

## The rule

No component or service may contain `if (species === 'Cattle')` (or any species name). Ask the
resolver. An admin-added species then works without a deploy.

- Frontend: `useFarmProfile({ speciesCode, animalClass, gender, managementMode, groupType })`
  from `frontend/src/hooks/useFarmProfile.ts` → `{ profile, ready }`. Species pickers use
  `useSpeciesCategories()` from the same file (farmer sees farm stock first, others pets first).
- Backend: `FarmProfileService.resolve(...)`; write endpoints for daily records/events call
  `FarmProfileService.assertRecordTypeAllowed(input, code, 'animal' | 'group')`.

## One resolver, two copies

`resolveFarmProfile.ts` exists byte-for-byte in `backend/src/services/farmProfile/` and
`frontend/src/utils/farmProfile/`. The backend validates writes with it, the frontend shows and
hides with it. `frontend/src/utils/farmProfile/resolveFarmProfile.parity.test.ts` fails if they
differ: edit one, copy it over the other. Behaviour tests (one per farm type) live in
`backend/tests/unit/FarmProfileResolver.test.ts`. The file must stay dependency-free.

## Data

| Table | What it holds |
|---|---|
| `master_species` (+ columns) | `farm_segment`, `produces_milk/eggs/wool`, `is_aquatic`, `litter_expected`, `gestation_days`, `incubation_days`, `birth_event_term`, `scientific_name`, `water_type`, `water_quality_ranges` |
| `master_animal_classes` (+ columns) | `can_lay_eggs`, `is_juvenile` (beside `implied_gender`, `can_be_pregnant`, `can_produce_milk`) |
| `master_group_types` | Life-stage / purpose group types. Scoped to ONE species **or** ONE farm segment (CHECK). A species with its own list uses it, otherwise its segment's list. `animal_groups.group_type` stores `value` as text; old generic values stay valid. |
| `master_record_types` | Daily records and events (`milk`, `eggs`, `heat`, `stocking`, ...). `code` is used by application logic, so the admin screen edits wording/icon/unit/order/on-off only. |
| `master_record_type_rules` | When a record type applies. It applies if ANY rule matches; a rule matches when every stated condition holds (NULL = any). A rule with no segment means "any farm stock" - pets are in only if a rule names them. |

Labels for the new rows live on the row (`label` + `label_hi/kn/ml/ta/te`), not in the i18n
files; render them with `resolveLabel` from `useMasterData()`.

## Routes (`backend/src/routes/farm-profile.routes.ts`)

- `GET /master-data/group-types`, `GET /master-data/record-types` - public, active only.
- `GET /farm-profile/resolve?species=&animalClass=&gender=&managementMode=&groupType=`
- `/admin/master-data/group-types` - admin CRUD (+ archive/restore).
- `/admin/master-data/record-types` - admin list, update, archive/restore. No create/delete.

Platform reference data: no tenant id is taken, so there is no tenant scoping here.

## Animals (Phase 3, migration 044)

- **Production fields** on `animals`: `avg_daily_milk_litres`, `parity` (number of births),
  `last_birth_date`, `dry_off_date`; `birth_weight` now read and written. There is **no**
  `lactation_number` column: for a milking animal it equals `parity`, and a stored copy would drift.
- **One breeding-status vocabulary** on `animals.breeding_status`:
  `not_bred | bred | pregnant | not_pregnant` (DB CHECK). Breeding-record statuses map onto it in
  `backend/src/utils/breedingStatus.ts` (`confirmed_pregnant` -> `pregnant`; `delivered`, `aborted`,
  `reabsorbed` -> `not_bred`). Frontend twin: `frontend/src/constants/breedingStatus.ts`. Anything
  that writes the column must go through the mapping; seed SQL must use these four words or NULL
  (the runtime gate fails otherwise - a seed row with `'active'` skipped 28 demo sections).
- **A birth is counted once**: `BreedingService.update` reads the record's previous status, and only
  the transition into `delivered` adds to `parity` (editing a delivered record's note does not).
- **Write path**: `AnimalService.createAnimal/updateAnimal` is the only writer, including bulk import
  (`POST /animals/bulk-import` now goes through it). It refuses a farm-only field the profile hides
  for that species/class (`FARM_FIELD_RULES`) with a message naming the field and the animal.
- **Form**: `components/animals/AnimalFormModal.tsx` is a `StepForm` (steps are an array: basics,
  details, milk and breeding, farm and group). `buildAnimalPayload()` (in `animalsShared.tsx`) sends
  only fields the profile shows; on edit an emptied visible field clears (null), a hidden field is
  left untouched.
- **One summary for every vet-facing screen**: `components/shared/SubjectSummary.tsx` (consultation
  room, prescription writer, prescribe panel). It shows pregnancy / milk / births and, with
  `emphasis`, a "check before choosing a medicine" note. Pure logic is in
  `utils/farmProfile/animalFacts.ts` (`lactationState`, `doseWarnings`).
- **Resolver rule**: with no class chosen, only an explicitly `female` animal is assumed able to be
  pregnant or milked (otherwise every pet of unspecified gender showed breeding fields).
- Tenant checks added in this phase: animal create/update checks the caller may use the farm and
  group (`AnimalController.assertPlacementAllowed`); breeding create/update check the farm and that
  dam and sire belong to it. `PUT /animals/:id` is now validated (it was not).

## Groups (Phase 3b)

- **Group types come from master data** (`master_group_types`, per species), not `types/enterprise.ts`.
  Use `useMasterData().groupTypesForSpecies`, and print with `groupTypeLabel(species, value, t)` /
  `groupTypeIcon` (falls back to the legacy `GROUP_TYPE_LABELS` for old stored values). Never print the
  raw stored value.
- **Record-keeping style** (`management_mode`: individual or batch) is decided when the group is
  created: the master group type's mode first, then the species default (`AnimalGroupService.createGroup`).
  The form suggests it, the farmer may override it, and it is **locked on edit** (the form only sends
  `managementMode` when creating).
- **Form**: `components/animalGroups/GroupFormModal.tsx` (`StepForm`: what / details) with
  `buildGroupPayload` in `groupShared.ts`. Species uses the shared `components/mobile/SpeciesPicker.tsx`
  (also used by the animal form). Planned count steps by 100 for a batch.
- **Cards**: `pages/AnimalGroups.tsx`; the group colour is passed to CSS via `useCssVar` (no inline style).
- Test fixture for master data in component tests: `frontend/src/test/farmMasterFixture.ts`.

## Daily records (Phase 4a, migration 045, flag `farm.records.enabled`)

- **One table**, `farm_daily_records`: subject = animal XOR group, one row per subject / record type /
  date / session (unique index), always on a farm. Saving the same slot again corrects it (200,
  `replaced: true`) and keeps the old values in `farm_daily_record_edits`; deletes are audited too.
- **Master data decides everything**: whether a record applies is `FarmProfileService.assertRecordTypeAllowed`;
  what it asks for is the record type's `fields` (`quantity` -> column, `session` -> column, the rest ->
  `detail`). `FarmRecordService` has no species names in it - a new record type needs no code.
- **Deaths are not stored here**: `mortality` is written through `BatchManagementService.recordPopulationEvent`
  (the ledger owns head count). Other events (breeding, sale, harvest...) are Phase 4b and write through
  their existing sources of truth.
- **Batch-group events** (Phase 4b-1): `POST /farm-records/events` -> `FarmEventService.recordGroupEvent`. Place flock /
  stock pond (opens the cycle, or adds to the open one), cull, partial sale, partial harvest, clear-out and final
  harvest (sell, then close the cycle). It only ever writes through `BatchManagementService` (the ledger owns head
  count) and `GROUP_EVENT_ACTIONS` is the one table saying what each event does - mirrored by `GROUP_EVENT_CODES` in
  `recordShared.ts`. Applicability is still the profile engine's. Harvest needs the **number of animals taken** (the
  head count); weight, amount and buyer go into the ledger reason text. 
- **Events on one animal** (Phase 4b-2): same endpoint with `animalId`. Mating -> `BreedingService.create` (expected
  birth date from master gestation days); pregnancy check -> the open breeding record; birth -> completes it
  (`BreedingService.update` counts the birth once; with no mating on record a record is made from the birth entry);
  dry-off -> the animal's date; weight -> weight history; heat -> one observation row a day; sale / death -> animal
  status, a note, and out of its group. A sold or dead animal accepts nothing more. Not done yet: creating the calf
  as an animal on birth, weaning, shearing, water exchange, the due list.
- **Due list** (Phase 4b-3): `GET /farm-records/due` (`FarmDueService`) - expected births (the date stored when the
  mating was recorded), each animal's latest vaccination whose next-due date is within 14 days or past, and withdrawals
  ending within 7 days. Only recorded dates - nothing is guessed from a species (no 'check pregnancy at day 45': that
  needs a sourced value in master data first). Shown at the top of the Daily records screen; a birth row opens the birth entry.
  Not done: sending due items through the notification system, a pregnancy-check or dry-off reminder.
- **Who may do what**: any owner / active member / admin reads; `farm_vet` and `viewer` cannot write (403
  with the reason); a worker deletes only what they entered, owner/manager any. A farm the caller has no
  claim on is a 404. The demo seed makes Maria Garcia a worker and Dr. Carter a farm vet on Tom's farm -
  use Emily (pet owner) as the outsider in tests.
- **Dark launch**: every route except `GET /farm-records/enabled` answers 404 while the flag is off.
  The flag is cached 60 s (`services/farmRecords/FarmRecordsConfig.ts`).
- **Screen** (Phase 4a): `pages/FarmRecords.tsx` at `/farm-records` (first tile of the farmer's "+" sheet; menu item hidden
  until the flag is on - `useFarmRecordsEnabled`, which never caches a failed probe). Herds/flocks first, then
  single animals with the most to record. One entry sheet for everything: `components/farmRecords/RecordEntrySheet.tsx`
  renders the record type's own `fields` (from `recordTypeEntry(code).fields`); pure logic in `recordShared.ts`.
  Picker-type fields (feed item) are not shown yet - they need the feed inventory as a source list.
- Dates are read as text (`record_date::text`): a DATE parsed into a JS Date shifts a day in timezones
  ahead of UTC (India).

## Gotchas

- A breed rename must move the text on `animals`, `animal_groups`, `group_cycles` and
  `marketplace_listings` in the same transaction (`MasterDataService.updateBreed` does; migration
  043 has the SQL equivalent). They are plain text, not foreign keys.
- `BreedingService` takes gestation days from `master_species` via the dam's species. The
  breeding screen never sends a species, so before migration 043 no due date was ever calculated.
- Seeded values with weak sourcing are listed in the header of
  `backend/migrations/043_farm_profile_engine.sql`; all are admin-editable.

## Farm roles (one rule everywhere, 2026-11-16)
`backend/src/services/FarmAccessService.ts` is the only place that decides what a farm role may do (the screen's
copy for button visibility is `frontend/src/utils/farmRoles.ts`).

| action | owner | manager | supervisor | worker | farm vet | viewer |
|---|---|---|---|---|---|---|
| read | x | x | x | x | x | x |
| record (daily records, events, head count, putting animals on the farm) | x | x | x | x | | |
| clinical (health / analytics screens that change data) | x | x | x | x | x | |
| manage farm | x | x | | | | |
| manage team (add / remove supervisors, workers, viewers, farm vets) | x | x | | | | |
| change roles, make / remove a manager | x | | | | | |

A platform admin may do everything. The owner's own place cannot be removed or changed; a farm has one owner.
Applied in: `EnterpriseController` (per-action role lists kept, now through `roleOf`), Tier 2/3/4 controllers (read =
GET, anything else = clinical), `ensureGroupAccess` (batch routes), `AnimalController` placement, medical-record
group writes (a viewer is refused), `requireEnterpriseAccess` middleware, the daily-records module, and the member
endpoints (`assertTeamChange`: a manager cannot promote, cannot touch managers or the owner). A person with no
role is told: "You don't have access to this farm. Only the farm owner can add people. Please ask them to
invite you." (403, never "not found"). Verified by `backend/tests/unit/FarmAccessService.test.ts` and a real-server
run (28 checks). Still to build: invitations for people without an account, SMS, and a farm workspace for people whose
platform role is not farmer (see the plan in the conversation / `docs/FARM_MANAGEMENT_PLAN.md`).

## Farm team: invitations, SMS, workspace (2026-11-16)
**Owner-driven only.** Nobody requests access; there is no farm directory. The owner (and managers, for the roles
below a manager) invite by mobile number and/or email with a role (`FarmInvitationService`, migration 048,
`routes/farm-invitations.routes.ts`).
- Lifecycle: `pending -> accepted | declined | expired | revoked`, valid 7 days; resend gives a new link (only the
  token's SHA-256 is stored) after a 60 s cooldown; one pending invitation per farm and number / email.
- The link (`/join-farm?token=...`, public) shows the farm, role and inviter only. Signed in: Accept / Decline.
  Has an account, signed out: sign in, then straight back. No account: create one from the link (platform role
  `farmer`, number marked verified, a placeholder `...@phone.waytovet.invalid` email when invited by number only -
  never mailed, never shown). Accept / decline also work from the banner at the top of every screen (by the person's
  own number / email, no link needed).
- **Farm workspace for any platform role**: `EnterpriseService.addMember` (the choke point) adds the additive
  `farmer` role (`user_roles`) to a member whose platform role is not farmer, so a pet owner or vet who joins a farm
  gets the farm screens; what they may do on a farm is their farm role (`FarmAccessService`).
- Delivery: SMS (`SmsService`, Admin -> SMS Settings, migration 046: MSG91 / Twilio / log provider, DLT template ids,
  write-only secrets, test send, send log), email (`farm_invite` template), in-app notification for an existing
  account. SMS off or failing never blocks: the invitation is created and the link is shown to share by hand.
- The older `POST /enterprises/:id/invite-member` now creates an invitation (no instant add).
- Screens: `components/enterprise/{InviteMemberModal,InviteResultNotice,FarmInvitationsPanel,PendingFarmInvitations}.tsx`,
  `pages/JoinFarm.tsx`, `pages/admin/SmsSettings.tsx`. Verified: 41 server checks, 19 browser checks.

## Vet access to farm records (2026-11-16, owner rule)
Only the vet booked for an appointment about an animal or group may read that animal's / group's farm records.
`FarmAccessService.consultingVetMayRead`: a **confirmed or rescheduled** booking, or a consultation that is
confirmed / scheduled / in progress, and **30 days** after it was completed (`VET_ACCESS_DAYS`; for a booking the clock
is its `updated_at`, so a later edit of a completed booking extends access). Pending, cancelled, missed and no-show give
none. Read-only and only for that one animal / group: never the farm, its summary, due list, team or finances, and no
writes. Each read by such a vet is written to `clinical_data_access_log` (animals; groups go to the server log). A vet
refused is told how access works ("ask the farm owner to book you for it"). On screen: `RecentFarmRecords` (last 7 days
per record type) under the animal summary in the consultation room and the prescribe panel; it shows nothing when there
is nothing to show. Verified by a 19-check real-server run.

**Found, not changed (needs the owner):** `GET /animals/:id` still lets ANY veterinarian open ANY non-network animal's
profile (`AnimalController.getAnimal`), which conflicts with the rule above for the animal profile itself; tightening it
could affect certificates and hospital flows. Also `logClinicalAccess` writes access types such as `get_medical_records`
that the table's CHECK (`view, search, export, print, api_call, audit`) rejects, so those audit rows silently fail
(hospital-network code - change-protected).
