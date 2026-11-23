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

## Group feeding (Phase 2, migration 059)

- Flocks, pig batches and ponds: `engine/groupFeeding.ts` (per head per day by age, or % of biomass by average weight
  x water-temperature factor) + FCR (feed / weight gained, or feed / kg eggs). Data: `nutrition_feeding_curves` and
  `nutrition_temperature_factors`, matched by species and optionally group type. Service `GroupFeedingService.ts`
  reads head count (cycle / group), age (cycle start), sample weight, water temperature, feed and eggs LIVE from
  Daily records - nothing entered twice. Route `GET /nutrition/groups/:groupId/feeding`; gate
  `AnimalAccessService.checkGroup`. UI `GroupFeedingCard.tsx` in the group health sheet and the vet's group
  consultation.
- Admin -> Nutrition data: "Feeding tables" tab, and "Approve all pending" (owner decision: approve now, vet later).

## Horses, donkeys and herd rations (Phase 2, migration 060)

- `equine_dm` (horses, ponies, mules; donkeys have their own set): `engine/equineRation.ts` - DE = maintenance x body
  weight x work factor (the animal's `activity_level`), protein per Mcal DE, Ca / P per kg body weight, FORAGE FIRST
  (forage DM >= % of body weight) and a cap on concentrate % of DM (colic / laminitis). Same least-cost solver.
  Feeds need `de_mcal_kg_dm` in their composition; only feeds listed for `equine_dm` are offered (compound cattle
  feed is not - it may carry urea / ionophores, which are on the horse unsafe list).
- Herd rations: `FarmRationService.groupSubject` - one solve for the herd's AVERAGE animal (members' recorded weights and
  milk, or an average weight typed on the sheet), shown per animal and x head count. Plan row has `group_id`. Routes
  `GET /nutrition/groups/:groupId/ration`, `POST .../ration[/preview]`; gate `AnimalAccessService.checkGroup`.
  The group feed card (`GroupFeedingCard`) hands over to `HerdRationCard` when the group's species is
  `ruminant_dm` / `equine_dm` (`status: 'herd_ration'`), so farmer and vet see it in the same places as flocks.
- One sheet for all of it: `RationBuilderSheet` takes a `RationTarget` (animal or group); `RationPlanCard` shows a saved
  ration for both.

## Vet workflow (Phase 3, migration 061)

- Review works for every plan (pet, animal ration, herd ration); a kcal override only for pet plans.
- "Prescribe as diet": `POST /nutrition/plans/:planId/prescribe` - the plan becomes an ORDINARY prescription through
  `PrescriptionService.createPrescription` (its own who-may-prescribe rule applies; linked to the vet's latest
  consultation for that animal / herd). Owner, vet, print and network pharmacy see it with other prescriptions;
  `nutrition_plans.prescription_id` stops a second prescription. The plan counts as vet-reviewed.
- Allergy override: active `allergy_records` (medical records own them) are matched against every food; a plan with
  such a food is refused in words, and any active allergy marks the plan "a vet should check this".
- Review queue: `/nutrition` filter "Not checked by a vet" (`filter=to_review`).
- Share: plain-text plan via the phone share sheet (WhatsApp / SMS), else copied (`PlanVetActions`).

## Alerts and outcome labels (Phase 4, migration 062)

- New rules (`RULE_VERSION` 1.1.0): `transition_condition_loss` (body condition lost since giving birth, the negative
  energy balance sign), `feed_below_need` / `feed_above_need` for flocks / batches / ponds (recorded feed vs the
  feeding table over a week, >= 4 days recorded; raised by `GroupFeedingService`, only from recorded inputs).
- Every alert closure is a label in `nutrition_outcomes`: "Seen" = confirmed, "Not right" = false alarm, rules closing
  it = resolved. Admin -> Usage -> Alert quality shows each rule's hit rate. These labels are what any later
  prediction model must be trained and judged on; no model is built until enough exist.

## Explain in simple words (AI, migration 062)

- `POST /nutrition/plans/:planId/explain` -> `NutritionExplainService`. Sends ANIMAL FACTS ONLY (species, age, weight,
  condition, goal, the plan's lines and numbers) - never owner, place, animal name or the vet's free-text note.
  Provider: `AiCopilotService.completeOnce` (Groq / OpenAI keys, same model fallback).
- Output guard `engine/explainGuard.ts`: every number in the text (any of the six scripts' digits) must be one of the
  plan's numbers, else the text is discarded. The screen then shows its own translated summary - never an error.
- Switch `nutrition.ai_assist.enabled` (default on; does nothing without a key). runtime-verify turns it OFF.

## Known gaps

- Herd rations use the average animal; a herd with very different animals (fresh and late-lactation cows) is better
  split into groups.
- Voice / label-photo entry (AI draft that the user confirms) and trained prediction models are not built; the
  outcome labels they need are being collected.
- Horse / donkey starting values (migration 060) and the new alert thresholds await the owner's vet.
- Risk-rule thresholds for weight-change speed and drift are conservative platform defaults pending vet
  validation (`engine/rules.ts` `RULE_LIMITS`).
- Translations in hi/kn/ml/ta/te were written without a native-speaker review (same open item as the tab labels).
- Pet feeding dates use the browser's local day; server-side "today" totals use the database day.
- Found while building, NOT fixed here (pre-existing): `/weight-history` (and other medical-record routes guarded only by
  `requireAnimalAccess`) let any signed-in user read or add data for a non-hospital animal they do not own.
