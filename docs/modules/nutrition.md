# Animal nutrition module

**What it is.** Food plans, feeding records, weight and body condition for every animal a person looks
after - pets, farm animals, flocks, ponds - with one shared panel for every role. Plan and research:
`docs/NUTRITION_PLAN.md` (owner decisions in its §12). Phase 1 (foundation for all species + pet
calculator) is built; farm calculators plug into the same tables and screens.

**Switch.** System setting `nutrition.enabled` (default `false`, migration 056). While off, every
`/nutrition/*` route except `GET /nutrition/enabled` answers 404 and every entry point is hidden.
runtime-verify switches it on (PHASE 6e API journey, PHASE 7 sweep).

## Where things are

| Layer | File |
|---|---|
| Schema | `backend/migrations/056_nutrition_foundation.sql`, mirrored at the end of `docker/init.sql` |
| Routes | `backend/src/routes/nutrition.routes.ts` (mounted last in `routes/index.ts`) |
| Validation | `backend/src/middleware/validation/nutrition.ts` |
| Who may see/change | `backend/src/services/nutrition/NutritionAccess.ts` - the ONE gate |
| Business logic | `backend/src/services/nutrition/NutritionService.ts`, admin: `NutritionAdminService.ts` |
| Engine (pure, versioned) | `backend/src/services/nutrition/engine/` - `models`, `facts`, `condition`, `companionEnergy`, `portions`, `rules` |
| Body measurements | `backend/src/services/BodyMeasurementService.ts` - the ONE writer of weight / condition for every module |
| Switch + entitlement seam | `backend/src/services/nutrition/NutritionConfig.ts` (`isEntitled` returns true: free for all) |
| Frontend panel | `frontend/src/components/nutrition/NutritionPanel.tsx` (+ Today / Plan / Body / Safe food tabs) |
| Pages | `frontend/src/pages/nutrition/Nutrition.tsx` (`/nutrition`), `frontend/src/pages/admin/NutritionAdmin.tsx` (`/admin/nutrition`) |
| API client | `frontend/src/services/api/modules/nutrition.ts` |
| Texts | `frontend/src/locales/<lang>/modules/nutrition.json` x 6, `nav.nutrition*` in `common.json` |
| Styles | `nutri-*` classes in `frontend/src/styles/modules.css` (shared layer) |
| Tests | `backend/tests/unit/nutritionEngine.test.ts`, `NutritionAccess.test.ts`, `frontend/src/components/nutrition/nutritionPanel.test.tsx` |

Mounted in: the animal detail (pet owners, farmers, vets - `AnimalDetailModal`), the vet consultation
room (`MedicalHistoryPanel`), and the `/nutrition` page. Compact mode = one-line summary that expands in place.

## Rules that must not be broken

1. **Numbers come only from `engine/`** - deterministic, versioned (`ENGINE_VERSION`, `RULE_VERSION`), stored on
   every plan / flag. No AI computes a nutrient, a portion or a ration.
2. **Single source of truth.** Missing facts are asked in the panel and saved THROUGH the owning module:
   `AnimalService.updateAnimal` for date of birth, sex, neutered, `activity_level`, `housing`;
   `BodyMeasurementService` for weight and condition. Never a nutrition-only copy.
3. **One body history.** `weight_history` holds weight, body condition score (`bcs_scale` 5 or 9), muscle
   condition and `source`. `weight` is nullable (a score can be taken alone); readers that list weights filter
   `weight IS NOT NULL`. `BodyMeasurementService.record` also keeps BOTH `animals.weight` and
   `animals.current_weight` in step (two columns, both read by existing screens). Medical records' weight and
   farm health observations write through it.
4. **Branch on the model, never on a species name.** `master_species.nutrition_model` (class override in
   `master_animal_classes.nutrition_model`). Unknown / admin-added species are `guidance_only`.
5. **Reference data carries source, licence and status.** Everything starts `unvalidated`; the owner's vet flips
   rows to `vet_validated` in the admin screen. Plans stay "Suggested" until a vet reviews them. Load a licensed
   table (FEDIAF/AAFCO/NRC/NASEM/Feedipedia/ICAR) only when the right to use it exists.
6. **Network hospitals untouched.** Hospital-private animals go through the existing `checkAnimalAccess`
   unchanged. Vets get in only with an appointment (`FarmAccessService.consultingVetMayRead`) and every such read
   is logged to `clinical_data_access_log`.
7. **Free for everyone** (owner, 2026-11-22). Usage is recorded in `nutrition_usage_events` (admin -> Usage) so the
   later pricing decision rests on real use; paid plans change `isEntitled` only.

## Farm rations (Phase 2, migration 057)

- `ruminant_dm` (cattle, buffalo, goats, sheep, camels): least-cost ration from the feeds the farmer has.
  Method `engine/ruminantRation.ts` (NEL maintenance x BW^0.75 + NRC 2001 milk-energy equation + late-pregnancy
  allowance; protein / Ca / P / NDF / forage as % of dry matter; intake as % of body weight), solved by
  `engine/leastCost.ts` (own two-phase simplex, no dependency). Service `FarmRationService.ts`, routes
  `POST /nutrition/animals/:id/ration[/preview]`, UI `RationBuilderSheet.tsx` + the ration view in `PlanTab.tsx`.
- Requirement sets (cattle / buffalo / small ruminants x in milk / dry) and 13 common Indian feeds are seeded
  `unvalidated` - typical values for the owner's vet to confirm; a farm's bag label or lab report wins.
- Milk yield typed in the ration is saved on the animal profile (`avg_daily_milk_litres`) via AnimalService.
  Feed actually given is recorded once, in farm Daily records - the ration screen keeps no second copy.
- Feed price is prefilled from the farm's `feed_inventory.cost_per_unit` when the stock row links the library feed
  (`feed_inventory.ingredient_id`).

## Known gaps

- `monogastric_spec` (poultry, pigs), `aqua_biomass` (fish, shrimp) and `equine_dm` calculators are not built yet:
  those species get weight/condition tracking and guidance. Group (herd/flock/pond) rations are per animal for now.
- Risk-rule thresholds for weight-change speed and drift are conservative platform defaults pending vet
  validation (`engine/rules.ts` `RULE_LIMITS`).
- Translations in hi/kn/ml/ta/te were written without a native-speaker review (same open item as the tab labels).
- Pet feeding dates use the browser's local day; server-side "today" totals use the database day.
- Found while building, NOT fixed here (pre-existing): `/weight-history` (and other medical-record routes guarded only by
  `requireAnimalAccess`) let any signed-in user read or add data for a non-hospital animal they do not own.
