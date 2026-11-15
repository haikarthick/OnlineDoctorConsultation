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

## Gotchas

- A breed rename must move the text on `animals`, `animal_groups`, `group_cycles` and
  `marketplace_listings` in the same transaction (`MasterDataService.updateBreed` does; migration
  043 has the SQL equivalent). They are plain text, not foreign keys.
- `BreedingService` takes gestation days from `master_species` via the dam's species. The
  breeding screen never sends a species, so before migration 043 no due date was ever calculated.
- Seeded values with weak sourcing are listed in the header of
  `backend/migrations/043_farm_profile_engine.sql`; all are admin-editable.
