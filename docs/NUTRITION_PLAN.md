# Animal Nutrition Module - research and end-to-end plan

Status: **PLAN v2 - nothing built yet.** v1 written 2026-11-22; v2 the same day folds in the owner's
answers (§12). Phase 1 (requirements) and Phase 2 (design) of the `feature-delivery` skill. Build starts
when the four questions still open in §12.2 are answered.

**Owner's framing (binding):** this is not an isolated module. It must work with every existing role,
admin, every device, the design system, CSS and UX conventions; be designed once so nothing is reworked
later; perform and scale; and keep **one source of truth** - a fact the nutrition screens need but that
belongs to another module is asked here and **saved in that module**, so every module benefits.

Evidence labels used below (CLAUDE.md fact-basis rule):
- **[S]** seen in a web search result during this research (link in §13).
- **[K]** background knowledge of the field, **not re-verified** in this session - verify before it becomes a requirement.
- **[C]** verified in this codebase (file:line given).

Research limits, stated honestly: the search tool returned thin or no results for several named
products (Hill's, Royal Canin, Petco, Nom Nom, Ollie, Tractive, Petivity), for ICAR 2013 nutrient
requirements, Indian feed composition tables, openFDA / FoodData Central / Open Pet Food Facts, and for
LLM-vs-nutritionist accuracy studies. Those are marked **[K]** or listed as open research items in §11.
Vendor claims below are company-reported and are not independent evidence.

---

## 1. What we are building, in one paragraph

One **nutrition engine** that, for any animal - a Labrador, a cat, a Murrah buffalo, a layer flock, a
shrimp pond - answers four questions: *what does it need* (requirements), *what is it getting*
(intake vs requirement), *what should change* (a balanced, affordable plan), and *what is likely to go
wrong next* (risk prediction). Three audiences read the same data: the **pet owner / farmer** (daily
feeding, plan, cost), the **veterinarian** (assessment, diet prescription, follow-up), and the
**admin / corporate admin / hospital** (master data, quality, analytics). It extends - does not
replace - the feed inventory, weight, body-condition and daily-record data we already hold (§4).

Core design rules (non-negotiable):
1. **Numbers come from deterministic, cited, versioned code - never from an LLM.** An LLM may explain,
   translate, and extract from photos/labels/voice; it may not invent a nutrient value, dose or ration.
   Reason: no formal study of LLM diet accuracy was found [S], but unverified home-prepared recipes fail
   badly - 95% of 200 recipes lacked at least one essential nutrient (UC Davis / JAVMA) and only 6% of
   owner-reported diets were potentially complete (Dog Aging Project) [S].
2. **One resolver decides what applies** (species / class / physiological state / group type), exactly as
   `docs/modules/farm-profile.md` does for fields. Never branch on a species name in code.
3. **Every recommendation carries its source, version and confidence**, and a vet can override it.
4. **Advice, not diagnosis.** Predictions are "risk flags to review", routed to a vet; wording per the
   no-error-codes rule (what happened / why / next step, in the user's language).

---

## 2. Landscape - what exists in the world (research findings)

### 2.1 Pet nutrition
| Area | What exists | Evidence | Gap we can fill |
|---|---|---|---|
| Consumer AI diet assistants | PawCo (dog only, plan from weight/age/activity/conditions, Mar 2026); FAMMO (dog+cat, NL); PerkyPet (own-site listicles - low trust) | [S] | Mostly dog/cat only, English/Dutch; none seen for farm species or integrated with a vet consult |
| Vet clinical nutrition tooling | PetFoodis.AI: vets build/share home-made diets with owners | [S] | Vet-only; no owner daily loop |
| Telehealth nutrition | Vetster nutrition consults + pharmacy for therapeutic diets; Hill's TeleTails free tele-consult; university nutrition services (Tufts, CSU, Texas A&M), months-long waits at some | [S] | Capacity is the bottleneck - our engine can pre-assess so a vet spends minutes, not an hour |
| Hardware | AI/modular smart feeders with health monitoring (consumer buying guides) | [S] weak | Feeder data as an optional input, not a dependency |
| Home-made diet formulation | Software checks recipes against AAFCO/FEDIAF; BalanceIT-style tools | [S] (UC Davis used computer analysis) / BalanceIT [K] | Guarded recipe builder: complete-and-balanced check before a plan can be saved |

Standards that define "adequate" for dogs/cats: **WSAVA Global Nutrition Guidelines** (nutrition as the
"5th vital assessment": history, weight, BCS, MCS, exam; extended evaluation on risk factors; BCS 9-point
with <4 or >5 flagged) [S]; **NRC 2006** (the leading requirement source), **FEDIAF**, **AAFCO** nutrient
profiles [S]. Energy: RER = 70 x kg^0.75 (linear 30xkg+70 only for 2-45 kg); MER = RER x life-stage factor
(adult intact dog 1.8, neutered 1.6, obesity-prone 1.4, puppy <4 mo 3.0 / after 2.0; adult cat intact 1.4,
neutered 1.2, obesity-prone 1.0, kitten 2.5; weight-loss factor dog 1.0, cat 0.8 per AAHA 2021); FEDIAF
gives MER per kg^0.75 by age (dogs 1-2y 130, 3-7y 110, >7y 95) and notes NRC-style estimates can
overshoot 10-60% - so these are **starting points corrected by observed weight trend**, not truths [S].
The WSAVA charts are copyright - use needs their permission procedure [S].

### 2.2 Farm nutrition
| Area | What exists | Evidence | Gap we can fill |
|---|---|---|---|
| Professional ration software | NASEM Dairy 2021 as the de-facto standard; AMTS (replacing AMTS.Pro/FBM with AMTS Nutrition), NDS Professional (CNCPS-based; CNCPS 6.56 late 2024), CPM-Dairy (older); Promix covers CNCPS 5.0 / NRC 2001 / NASEM 2021 / NRC 2016 beef / INRA 2018 | [S] (vendor blogs) | Priced and built for consultants and large herds; English; not phone-first; not linked to vet/health data |
| India national programme | NDDB **Ration Balancing Programme**: 33,374 villages, 21.57 lakh farmers, 18 states; milk 7.08 -> 7.35 kg/animal/day, feed cost/kg milk -11.8%, +Rs 25.5/animal/day net income, enteric methane/kg milk -13.7%. Now inside **Bharat Pashudhan**; a farmer-direct **1962 app** exists. World Bank/INAPH figure is smaller (feed cost Rs 143 -> 136/day, ~5%); an academic INAPH study found +13% (cows) / +5.5% (buffalo) milk | [S] | Proves the value (and that the effect is real but modest and varies). Opportunity: integrate with it instead of competing; add health + market link |
| Open research tool | FeedMaster least-cost app (PMC) | [S] listed | Algorithm reference |
| Least-cost method | Linear programming is the standard; CNCPS-based LP optimiser published (Tedeschi et al.); 25 ingredients x 34 nutrients Excel-Solver teaching model | [S] | Reusable, patent-free technique |
| Feed data | Feedipedia (INRAE/CIRAD/AFZ/FAO) - free for private study/research/non-commercial; **commercial use needs AFZ permission** | [S] | Licence blocker for a commercial SaaS - see §12.1 row 4 |
| Aquaculture | AIoT pond: ~30% lower FCR vs control (ICRIER pilot); AquaExchange acoustic feeder ~10% feed efficiency; Aquaconnect FarmMOJO ~10% feed-cost reduction; Skretting auto-feeder + acoustic; feed ~60% of culture cost; shrimp target FCR ~1.2 | [S] (vendor/pilot) | Pond-level feed table + FCR tracker works with zero hardware |
| Poultry | ML FCR prediction from short-term data (R2 0.81, livestock-general); small/medium Indian farms are priced out; most tools do only one of feeding/environment/analytics | [S] | Integrated, cheap, layer/broiler FCR + egg-per-feed view |
| Safety | Aflatoxin: poor storage of grain/silage, no binder -> OR 4.7 for contaminated milk in Punjab; FSSAI notes feed/fodder is unregulated for AFM1; FSSAI-approved rapid kits exist | [S] | Feed-batch risk module; storage checklist; binder reminder |
| Regulation (India) | IS 2052:2023 compounded cattle feed; FSSAI directs commercial feed for meat/milk animals to meet BIS standards; pet food: BIS IS 11968:2019 (voluntary), FSSAI safety | [S] (secondary for pet) | Label-check against IS 2052 minimums |
| Climate | 3-NOP and Asparagopsis >20% enteric CH4 cut; weak under grazing (28.5% cut lasted ~3 h in a pulse-fed grazing trial); Indian carbon-credit project announced (Dec 2025, paywalled) | [S] | Methane/kg-milk as a reported metric first; credits only later and only if verifiable |

### 2.3 Prediction research (what is real, what is hype)
- Sensor + ML for **mastitis** (milk yield, rumination, conductivity; 447 vs 2,146 cows; MLP and random forest best), 9-algorithm production-data comparison (JDS 2025) [S].
- **Ketosis / acidosis** from rumination, activity, water intake (smaXtec boluses), multi-disease 4-class models (Nov 2025) [S].
- **Caveat that shapes our design:** most studies are single-region/single-farm, sensitivity or specificity is often low, and I did not verify full-text performance numbers [S]. So: ship rule-based thresholds first, ML only after we have our own labelled outcomes, always as "risk flag".
- **BCS by computer vision:** dairy cows via depth/2D cameras (3D point cloud gave no consistent gain over depth images; preprint) [S]. No validated **smartphone** BCS app and no dog BCS study found [S] - treat photo-BCS as **assistive, requiring a vet/owner confirmation**, and validate ourselves.

### 2.4 Open algorithms / data / code we can use (licence checks are Phase 0)
| Item | Use | Licence status |
|---|---|---|
| RER/MER, FEDIAF/AAFCO profiles, WSAVA BCS/MCS | Pet engine | Equations are public; **WSAVA charts and NRC/AAFCO tables have copyright/paid terms** - get permission or re-derive from open sources [S]/[K] |
| NASEM 2021 / ICAR / NDDB RBP requirement tables | Farm engine | NASEM is a paid publication [K]; ICAR 2013 and NDDB material not found by search - open item |
| Simplex/LP solvers (HiGHS, GLPK.js, javascript-lp-solver) | Least-cost ration | Permissive/open [K] - verify exact licences at selection |
| USDA FoodData Central | Human-food ingredient composition for home-made pet diets | Public domain [K] - verify |
| Open Food Facts / Open Pet Food Facts | Label/barcode lookup | ODbL (share-alike) [K] - legal review before ingesting |
| FDA pet-food recall dataset (since 2006) | Recall alerts | Public [S] (check openFDA API access) |
| Feedipedia / INRA-CIRAD-AFZ tables | Feed composition | **Non-commercial only without AFZ permission** [S] |

---

## 3. Personas and the end-to-end loop

| Persona | Daily loop | Decision they need | Success measure |
|---|---|---|---|
| Pet owner | Log meal/treat in 2 taps; weigh monthly; photo BCS | "Is my pet getting the right amount of the right food?" | Weight in ideal band; fewer diet-related visits |
| Farmer (dairy/beef/small ruminant/poultry/pig/aqua) | Record feed given per group (already in daily records) | "Cheapest ration that still hits milk/growth targets today" | Feed cost per kg milk/egg/gain down; FCR down |
| Veterinarian | Open animal -> nutrition summary -> adjust/prescribe -> follow-up | "Is this animal nutritionally at risk, and what do I prescribe?" | Minutes per nutrition consult; plan adherence |
| Admin / corporate_admin | Master data, quality, analytics, flags | "Is the engine correct and used?" | Plan coverage, override rate, data completeness |
| hospital_staff / pharmacist | Therapeutic diets & supplements dispensing | Stock + prescription match | Fewer wrong-diet dispenses |

**The closed loop:** Profile -> Requirement -> Intake capture -> Gap analysis -> Plan (ration/meal plan) ->
Vet review -> Execute & log -> Outcome measure (weight, BCS, milk, FCR, labs) -> Risk prediction ->
Alert/Consult -> Plan revision. Every arrow is a data hand-off between modules (§4).

---

## 4. Cross-module trace (mandatory Phase 1 output)

Existing assets [C unless noted]:
- `docker/init.sql:2897` `feed_inventory` and `:2920` `feed_consumption_logs` - **enterprise-scoped only**
  (`enterprise_id NOT NULL`), so a pet owner has no feed data model today. `nutritional_info JSONB` exists but is free-form.
- `FeedInventoryService.ts` (stock, consumption, low-stock, 30-day cost); `AlertService.ts:181` low-feed alert.
- `weight_history` (`MedicalRecordService.ts:603`, `AiCopilotService.ts:220`); `health_observations.body_condition_score INT` (`init.sql:2860`).
- `farm_daily_records` (migration 045, `FarmRecordService.ts:10`): milk, eggs, **feed**, sample weight, water quality - one row per animal or group per day.
- `docker/init.sql:1352` an existing service-category value `'nutrition'` (hospital services) [C].
- `SustainabilityService.ts` mentions feed [C]; `AiCopilotService.ts` exists [C].
- No nutrition feature flag in `config/featureFlags.ts` and no `nutrition` / `ration` / `feeding` route [C: searches found none].

| Module / persona | Reads | Writes | What changes |
|---|---|---|---|
| Animals / profile (all roles) | species, breed, class, DOB, sex, neuter, reproductive state | - | Add "nutrition profile" derived via the farm-profile resolver; **no new species branching** |
| Medical records / weight (vet, owner, farmer) | weight, BCS | weight, BCS from nutrition screens | Single source of truth stays `weight_history` + BCS; nutrition screens **write through the existing service**, never a parallel table |
| Consultations / video (vet) | animal context | nutrition assessment note, diet plan | New "nutrition" consult type reuses the booking/payment state machine |
| Prescriptions (vet, pharmacist) | - | therapeutic diet / supplement as a prescription line | Extend prescription items; pharmacist sees it |
| Pharmacy (pharmacist) | stock | - | Therapeutic diets/supplements as catalogue items; low-stock + expiry already exist |
| Farm daily records (farmer, farm team) | feed entries | feed entries | Feed entry gains `feed_id` + amount; **ration adherence computed from it** - no second entry screen |
| Feed inventory (farmer) | stock, cost | consumption | Becomes the ingredient library for rations; unit-cost drives least-cost solving |
| Enterprise / groups / batches | group size, stage | group ration | Parent-drives-children: ration set at group, applies to members |
| Marketplace | - | - | No change now (owner: no selling while the module is free). Live-animal listings stay free |
| Payments / wallet | - | - | No change now; a nutrition consult is an ordinary consultation. Entitlement seam ready for later plans |
| Alerts / notifications | - | feed low, weight drift, risk flags | New alert types via `AlertService` |
| Analytics / dashboards | all | - | Feed cost, FCR, cost per litre/egg, weight-band distribution |
| Sustainability | feed, milk | - | Methane/kg milk (derived, estimate-labelled) |
| AI copilot | weight, records | - | Copilot may *call* the engine; may not compute nutrition itself |
| Hospital network / corporate admin | **Do not touch** | - | Network-hospital permission code is change-protected (`feedback-network-hospital-change-approval`). Hospital vets access nutrition for an animal through the **existing** access gates only. If a change there is needed -> stop, get approval |
| Admin | master data | requirements, feed library, flags | Master-data pickers (never free text); per-locale labels via `resolveLabel` |
| i18n | - | 6 locales | New `nutrition.json` per locale; Tamil/Kannada/Hindi long-name cases |

Tenant isolation: every route taking `enterpriseId` / `groupId` / `animalId` runs the
`tenant-isolation-review` checklist; vet access to a farm uses `FarmAccessService` (booked consultation + 30 days,
per memory). Refusal wording reuses `FarmAccessService`'s existing readable messages (§12.1 row 7).

---

## 4a. Single source of truth - capture once, save where it belongs

The engine declares, per nutrition model (§5.3a), the **facts it needs**. A resolver checks each fact
against the module that owns it. Anything missing is asked inline on the nutrition screen ("We need
2 things to work out Bruno's food: is he neutered, and how active is he?") and the answer is saved
**through the owning module's existing service** - never into a nutrition-only copy. The next screen
in any module (vet consult, animal profile, farm daily records) then shows the same value.

| Fact | Owner module / where it lives today [C] | Needed by | Status |
|---|---|---|---|
| Species, breed, class | `animals.species/breed/animal_class` (`init.sql:120-153`), master_species/breeds/animal_classes | all | exists |
| Date of birth, sex, neutered | `animals.date_of_birth/gender/is_neutered` | pet, all | exists |
| Weight (history) | `weight_history` (`init.sql:524`) via `MedicalRecordService.ts:603` | all | exists. **Debt to settle in Phase 1:** `animals` has both `weight` (:128) and `current_weight` (:145) - decide which is the cached "current" and make every write update it |
| Body condition score (history) | only `health_observations.body_condition_score` (`init.sql:2860`, farm observation form) | all | **gap for pets** - see §12.2 Q3 |
| Muscle condition score | none | pet, vet | new, same home as BCS |
| Pregnancy / due date | `animals.breeding_status/expected_due_date` (:142-144), `breeding_records` | all | exists |
| Lactation: daily yield, parity, dry-off | `animals.avg_daily_milk_litres/parity/dry_off_date` (`init.sql:5585-5588`), `farm_daily_records` milk; derived by `utils/farmProfile/animalFacts.ts` | ruminants | exists |
| Allergies | `allergy_records` (`init.sql:538`) | pet, vet | exists |
| Lab results (kidney, glucose...) | `lab_results` (`init.sql:575`) | vet, condition overrides | exists |
| Current medicines | prescriptions | safety rails | exists |
| Activity level, housing (indoor/outdoor/grazing) | none | pet, ruminant | **new column on `animals`** (owned by the animal profile, shown there too) |
| Target / ideal weight | none | pet, growth | new, owned by the nutrition plan (it is a goal, not a fact) |
| Current food / feeds | `feed_inventory` (farm only, `init.sql:2897`); nothing for pets | all | farm exists; pet "current diet" = a nutrition plan row of status `observed` |
| Feed given per day | `farm_daily_records` (`init.sql:5640`, record_type feed) + `feed_consumption_logs` | farm | exists - **two writers today; Phase 2 must make one call the other**, not add a third |
| Flock/pond count, cycle, stage | `animal_groups.current_count`, `group_cycles` | poultry, aqua, pigs | exists |
| Water temperature / quality | `farm_daily_records` water quality | aqua | exists |
| Feed price | `feed_inventory.cost_per_unit` | least-cost | exists (farm); pets use package price on the plan item |
| Region (local feed prices, climate) | farm/user address fields | farm | verify exact columns in Phase 1 |

Rules that make this hold:
1. The "missing facts" list is **computed by one shared resolver** (backend, with the same logic exposed to the
   frontend the way `resolveFarmProfile.ts` + its parity test already work) - never hand-coded per screen.
2. A nutrition screen never stores a copy of an owned fact. It reads live and writes through.
3. New owned facts (activity level, housing, MCS) are added to the **owning module's** form too, so a pet owner
   editing the animal profile sees the same field. That is the cross-module seamless rule.
4. Every write keeps the owning module's audit trail (e.g. `farm_daily_record_edits`).

---

## 5. Architecture

### 5.1 Layers (follows `add-module`)
```
backend/src/routes/nutrition.routes.ts            one router, mounted in routes/index.ts (flag: nutrition.enabled)
backend/src/controllers/Nutrition*Controller.ts   HTTP only
backend/src/services/nutrition/
    RequirementEngine.ts     species/class/state -> nutrient requirement set (versioned, cited)
    EnergyService.ts         RER/MER, growth, lactation, FCR targets
    DietEvaluator.ts         plan/intake vs requirement -> gaps, excesses, Ca:P, toxic items
    RationOptimizer.ts       least-cost LP (HiGHS) with hard safety constraints
    AssessmentService.ts     BCS/MCS/FAMACHA-style scoring, weight trajectory
    RiskService.ts           rules first, ML scorers behind an interface
    IngredientLibrary.ts     feed/food composition w/ provenance + licence
    SafetyService.ts         toxic foods, drug-nutrient, recalls, aflatoxin batch risk
    NutritionAdvisor.ts      LLM explain/translate/extract ONLY - calls the services above
backend/src/utils/database/...                    follows existing skeleton
docker/init.sql + backend/migrations/04x_nutrition.sql   BOTH (init.sql is one transaction; never hardcode public.)
frontend/src/pages/nutrition/                     shared screens + role views
frontend/src/services/api.ts AND services/api/modules/nutrition.ts   update BOTH
frontend/src/locales/<lang>/modules/nutrition.json x 6
docs/modules/nutrition.md                         deep-dive (link from CLAUDE.md, keep it short)
```

### 5.1a Every species from day one, without rework - "nutrition models"
The owner wants everything (pets, dairy, beef, buffalo, goat, sheep, pig, poultry, aquaculture). Species differ
in *how* a diet is expressed, but there are only a handful of patterns. Each species/class maps (in master data,
admin-editable) to one **nutrition model**; code exists per model, never per species:

| Model | Expressed as | Species (examples) | Build order |
|---|---|---|---|
| `companion_energy` | kcal/day from RER/MER + nutrient profile per 1000 kcal | dog, cat (rabbit, birds, others: guidance-only until data exists) | Phase 1 |
| `ruminant_dm` | dry-matter intake, ME, CP (later MP), NDF, Ca, P per day | cattle, buffalo, goat, sheep, camel | Phase 2 |
| `monogastric_spec` | % of diet spec by stage + feed per bird/head per day | poultry (broiler/layer/backyard), pig | Phase 2 |
| `aqua_biomass` | % body weight/day by biomass, size and water temperature | fish, shrimp | Phase 2 |
| `equine_dm` | forage-first DM + concentrate limits | horse, donkey | Phase 2 (later) |
| `guidance_only` | safe-food list + weight/condition tracking, no ration | any species without vetted requirement data | Phase 1 |

The mapping is a new column on `master_species` / `master_animal_classes` (`nutrition_model`), defaulting to
`guidance_only`, so an admin-added species is safe on day one. Phase 1 ships the **schema, resolver and
admin screens for all models**, plus the `companion_energy` and `guidance_only` calculators. Phase 2 adds the
farm calculators **into the same tables and screens** - no migration rework, no screen rework.

### 5.2 Data model (new tables; additive, all with `enterprise_id`/owner scoping)
- `nutrition_requirement_sets` (species, class/state, source, version, licence, effective_from) +
  `nutrition_requirements` (set_id, nutrient, min, max, unit, basis `DM|ME|kg^0.75|day`).
- `nutrition_ingredients` (master; kind `feed|food|supplement|commercial_diet`, composition JSONB with
  per-nutrient value + provenance, licence, India region, price index) - **links to and supersedes the free-form
  `feed_inventory.nutritional_info`** by FK (migration copies, never drops).
- `nutrition_plans` (animal_id or group_id, version, status `draft|vet_review|active|superseded`,
  created_by, reviewed_by, engine_version, source_requirement_set, explanation) + `nutrition_plan_items`
  (ingredient, amount, unit, frequency, cost).
- `nutrition_assessments` (animal_id, BCS, MCS, weight ref, appetite, stool/coat flags, photo ref, assessed_by, method `owner|vet|model`).
- `nutrition_risk_flags` (subject, type, score, features JSONB, model_version, status `open|reviewed|dismissed`, reviewed_by) - the audit trail for every prediction.
- `nutrition_outcomes` (labels for future ML: milk yield, FCR, weight change, diagnosis link) - **collected from day one** because prediction quality depends on it.
- Reuse, don't duplicate: `weight_history`, `health_observations.body_condition_score`, `farm_daily_records`, `feed_inventory`, `feed_consumption_logs`.
- Feature flags: `nutrition.enabled` (master), `nutrition.ai_assist.enabled` (LLM explain), `nutrition.photo_bcs.enabled`, `nutrition.risk_ml.enabled`. Switch the master flag on in `runtime-verify.js` PHASE 7 or the sweep never sees the screens.

### 5.3 Algorithms - what runs where
1. **Energy (pet):** RER/MER as in §2.1, life-stage table in master data (not code). Plan then **self-corrects**: target weekly weight change by goal; if observed trend deviates, adjust kcal in bounded steps (and flag a vet if loss is too fast or weight is not responding). Weekly-loss target values: not found in search [S] -> must come from WSAVA/AAHA text in Phase 0.
2. **Adequacy check (pet):** compare plan nutrients to FEDIAF/AAFCO/NRC set; hard-block "complete and balanced" label unless all minimums pass; show exactly which nutrient fails.
3. **Least-cost ration (farm):** LP - minimise cost subject to DM intake, ME, CP (later MP/rumen N balance), NDF/ADF, Ca, P, Ca:P, forage:concentrate, ingredient min/max, local availability. Stage 1 replicates the NDDB RBP-style balance (DM, ME, CP, Ca, P) because it is proven at national scale [S]; Stage 2 adds NASEM-2021-style protein/AA and CNCPS fractions where licence/time allow.
4. **Aquaculture / poultry:** feed table by biomass, temperature, stage -> daily ration; FCR = feed / gain tracked per pond/flock/batch; breeder-guide targets as master data [K].
5. **Risk (rules -> ML):** Pet: obesity trajectory (weight trend vs BCS), underfeeding of growing animals, diet-related allergy pattern, treat-calorie excess (>10% of kcal as a conventional guideline [K]). Farm: negative energy balance risk around calving (yield drop + intake drop + BCS), mastitis/ketosis flags from yield/rumination/conductivity **only where such data exist**, aflatoxin risk from storage/season/binder use. ML scorers plug in behind `RiskService` once `nutrition_outcomes` has enough labels, with calibration + subgroup checks; ship "off" by default.
6. **Vision (assistive):** photo -> BCS suggestion with confidence; low confidence or disagreement -> ask for vet confirmation. Never auto-writes to the medical record without a human tap.
7. **LLM layer:** (a) explain a plan in the user's language at reading level, (b) extract ingredients/quantities from a label photo or voice note into a **draft that the user confirms**, (c) vet-side summary. Tool-calling into services; output validated against the evaluator before display.

### 5.4 Safety rails (hard rules)
- Toxic-food/ingredient list per species (chocolate, xylitol, grapes, onion/garlic for dogs/cats; urea limits and ionophore/monensin toxicity for horses and some species; copper for sheep) - master data [K], vet-reviewed before launch.
- Condition overrides: renal, diabetes, pancreatitis, urinary stones, pregnancy/lactation, kitten/puppy growth -> plan generation **requires vet review** before `active`.
- Drug-nutrient and withdrawal interactions: feed medicated with antibiotics -> withdrawal period feeds the existing medical/prescription data.
- Recalls: ingest FDA pet-food recalls [S]; India sources - open item.
- Every plan stores `engine_version` + requirement-set version so an audit can reproduce it.
- Errors to users: plain words in their language, per the owner rule; the server sends a readable `message`, the client never shows `err.message`.

### 5.5 Performance and scalability (designed in, not added later)
- **Calculations are pure functions** (no DB access inside the engine) - unit-testable, cacheable, and the same
  code can run on the server and, for instant feedback, in the browser.
- **Requirement sets and the ingredient library are read-mostly** -> cached in Redis keyed by version; a version
  bump invalidates. Nothing recomputed per request.
- **Least-cost solving** runs server-side with a hard time limit and a bounded problem size (ingredients x
  constraints); a herd/flock re-optimisation is **one group-level solve**, not one per animal.
- **Nightly/background jobs** (existing scheduler pattern) compute daily nutrition summaries and risk flags into
  a summary table, so dashboards read one row per animal/group/day instead of scanning raw records. Index plan
  mirrors `farm_daily_records` (`enterprise_id, date DESC`; `animal_id, date DESC`).
- **List screens paginate server-side** (5,000-animal herds, thousands of ingredients), search is indexed.
- **Frontend:** the nutrition pages are a lazy-loaded route chunk; translations are their own module file
  per locale; charts reuse the existing chart components; no new UI library.
- **Offline-first for farmers:** feed logging goes through the existing outbox (`frontend/src/utils/farmOutbox.ts`).
- **API is versioned in its payloads** (`engine_version`, `requirement_set_version` on every plan) so the engine
  can improve without breaking stored plans or clients.

### 5.6 One experience across roles and devices
- **One shared "Nutrition" panel component per animal/group**, mounted in each role's existing animal screen
  (pet owner animal page, farm animal/group page, vet consultation sidebar, hospital patient view through
  existing gates, admin). Role decides *what actions show*, never a separate copy of the screen.
- Permissions via the existing system (4-file permission sync rule) and `FarmAccessService` for farm data -
  its readable refusals are reused as-is (see §12.1 row 7).
- Phone tab-bar entry and cards on phone; same component in wider layout on desktop (`docs/modules/mobile-ui.md`).
- Styling only through `modules.css` design tokens and shared components; page CSS scoped
  `:where(.nutrition-root)`; no inline styles (ESLint error); dark mode via existing tokens.
- Every message from the module goes through the same plain-language error/empty-state components.
- **Entitlement seam:** every endpoint passes a `nutrition` entitlement check that today always says "free for
  all". When paid plans arrive (owner: after real usage), only that one check changes - no rework.
- **Usage measurement from day one** (plans created, logs per week, vet reviews, returning users) so the later
  pricing decision is based on real usage, as the owner wants.

---

## 6. UX design contract (harness H10) - before any UI code

Principle: **one shared nutrition surface per animal, role-specific entry points**, built from
`components/mobile/*` and `components/shared/*`; any new pattern goes in the shared layer.

| Screen | Sub-views (default first) | Largest realistic data | Phone (390px) | Native controls |
|---|---|---|---|---|
| Animal -> Nutrition tab | Today, Plan, Weight & BCS, History | 5,000 animals in a herd: group/filter/search by design | Bottom tab bar entry, cards not tables | date + file (photo) inputs -> H7 test |
| Daily feed log (farm) | Group (default), Animal | 40 groups x 6 feeds | Tap-not-type: last used feed + amount stepper, offline outbox (`farmOutbox.ts`) | quantity stepper; works offline |
| Ration builder | Needs, Ingredients, Result, Cost | 60 ingredients, 60-char Tamil names | One-column steps; result shows cost/day + milk-or-gain target first | none |
| Vet nutrition review | Queue (default), Plan diff, Prescribe | 200 plans pending: filter by risk/species/age | Swipe-free; approve/adjust/decline buttons | - |
| Pet owner home card | Today's kcal ring, weight trend, next action | Multi-pet household (up to ~10) | One card per pet, collapsed list | - |
| Admin master data | Requirements, Ingredients, Toxins, Flags | thousands of ingredients: server-side search | desktop-first, still usable | - |

Edge cases to design for explicitly (the "40-item case"): no weight recorded; weight in lb or quintal; two
owners disagreeing; pregnant + sick; mixed-breed unknown adult weight; flock of 5,000; pond biomass guess;
ingredient price missing; offline for 3 days; Kannada/Tamil/Hindi long names; plan active but animal sold/died;
vet override that contradicts a hard limit (needs reason, audited).

Phone-first farmer rules (`mobile-farmer-ux`), Apple-HIG polish (`ui-review`), motion + messy data
(`ui-resilience-review`), species-correct terms and NBAGR breeds (`farm-domain-review`) all apply at review.

---

## 7. Phased roadmap (each phase shippable behind `nutrition.enabled`)

Owner decisions applied: pets first, but the foundation is built for every species; everything is free;
vet validation comes after implementation, so every requirement set carries a status
`unvalidated -> vet_validated`, and until a set is validated plans are labelled **"suggested - not yet
vet-validated"**. Validation later flips data, not code.

**Phase 0 - Data gathering and licence register (runs alongside Phase 1, no code blocked by it).**
Collect every open source (§2.4) into the ingredient/requirement library with provenance; licence register per
source; draft permission requests (WSAVA, AFZ/Feedipedia, NASEM) for the owner to send; close §11 items.

**Phase 1 - Foundation for all species + pet core.**
One migration + `init.sql`: all nutrition tables, `nutrition_model` on master species/classes, new owned facts
(activity level, housing, condition scores), entitlement seam, flags. Missing-facts resolver + write-through.
Admin screens for requirement sets, ingredients, toxins, model mapping, life-stage factors. `companion_energy`
and `guidance_only` calculators; BCS/MCS; weight trend; pet "Today" card; shared Nutrition panel mounted in pet
owner, vet consultation and admin views; weight-drift alerts; i18n x 6; flag on in runtime-verify PHASE 7.
Exit: a pet owner gets a calorie target, a feeding amount and a weight trend; the vet sees the same on the consult.

**Phase 2 - Farm calculators into the same panel.**
`ruminant_dm`, `monogastric_spec`, `aqua_biomass` (then `equine_dm`). Feed library from `feed_inventory`;
unify the two feed writers (daily records / consumption logs); group ration (parent drives children);
least-cost LP; cost per litre/egg/kg gain; FCR per batch/pond; offline logging.
Exit: a farmer of any species sees a ration, its daily cost and the cost per unit of output.

**Phase 3 - Vet workflow.**
`vet_review` plan lifecycle; therapeutic diet/supplement as prescription lines (pharmacist sees them);
condition overrides; home-made diet builder with complete-and-balanced gate; plan PDF/share.
Nutrition consult uses the existing consultation booking **free of a nutrition surcharge** (owner: free for now).

**Phase 4 - Prediction (6-10 weeks, ongoing).**
Rule-based risk flags live; `nutrition_outcomes` labelling; mastitis/ketosis/negative-energy-balance scorers evaluated offline on our own data before enabling; photo-BCS assistive pilot; aflatoxin batch risk; pre-registered evaluation (sensitivity/specificity, calibration, subgroup) - go/no-go per model.

**Phase 5 - Revenue and ecosystem (ongoing).**
Feed price discovery; commercial options only after the owner's usage-based decision (§8); Bharat Pashudhan/INAPH interop (if API access exists - unverified); cooperative/FPO dashboards; insurance/lender data-sharing with consent; methane/kg-milk reporting, credits only if a verifiable protocol exists.

**Phase 6 - Futuristic layer (research bets, gated by Phase 4 results).**
Vernacular voice logging ("gave 2 kg khal to the black cow") -> confirm-and-save; per-animal digital twin (growth/lactation model calibrated on the animal's own data); IoT feeder/rumination/collar/bolus connectors; federated learning across farms without sharing raw data; ration re-optimisation on live feed prices; label/barcode scanning; seasonal/fodder-calendar planning; outbreak-aware feed advisories.

---

## 8. Revenue and value model (to validate, not promise)

Evidence the value is real but modest and variable [S]: NDDB RBP +0.27 kg milk/animal/day, feed cost/kg milk -11.8%,
+Rs 25.5 net/animal/day; INAPH/World Bank ~5% feed-cost fall; aqua pilots 10-30% FCR/feed-efficiency gains (vendor/pilot).
Planning stance: **target 5-12% feed cost reduction and measure it per farm** against the farm's own baseline; never advertise a
number before our own data supports it.

**Owner decision (2026-11-22): the whole module is free for everyone at launch.** Commercial plans come later,
decided from real usage. So: no paywall, no nutrition surcharge, no feed/supplement selling now. The entitlement
seam and usage measurement (§5.6) are built in so that later decision needs no rework.
Candidates to evaluate *then*: premium farm analytics, paid specialist nutrition consults, fulfilment of
therapeutic diets through the pharmacy module, consented aggregate insights for co-ops/feed companies.

---

## 9. Quality, validation and governance

- **Engine correctness:** golden-case unit tests per requirement set (published worked examples from the standards), property tests for the LP (solution always satisfies constraints), diff tests when a requirement-set version changes.
- **Clinical validation:** advisor sign-off per species before enabling; shadow mode (engine suggests, vet decides) and record agreement rate.
- **Model validation:** hold-out by farm (not by row) to avoid leakage; calibration; subgroup performance (breed, region, season); drift monitoring; kill switch via flag.
- **Harness:** whole-app sweep with `nutrition.enabled` on; `verify:runtime` for every migration/route; `deploy-parity-and-write-paths` for each Save button (H13); no allow-list edits to go green (H11).
- **Privacy:** animal and owner data private; no third-party AI call with owner identity; LLM prompts contain only de-identified animal facts; consented aggregation for B2B.
- **Regulatory:** decision-support framing; confirm whether any Indian rule treats veterinary software or diet claims as regulated [open]; "complete and balanced" claims only when the gate passes.

KPIs: plan adoption, vet override rate, % pets in BCS 4-5, weight-goal attainment, feed cost per kg milk/egg/gain, FCR, ration adherence,
risk-flag precision (reviewed-true/flags), time per vet nutrition consult, consult conversion, 30-day retention.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Licence on requirement/feed data blocks commercial use | Phase 0 register; use open/permissioned sources; engine is data-driven so tables can be swapped |
| Wrong advice harms an animal | Deterministic engine, hard limits, vet-review gates, audit trail, advisor sign-off, shadow mode |
| LLM hallucination | LLM never computes; outputs validated by evaluator; flag-gated |
| ML overpromises | Rules first, own-data validation, "risk flag" wording, kill switch |
| Smallholder data entry too heavy | Reuse daily-record entry, defaults, voice, offline outbox |
| Feed price data stale/missing | User-entered + admin regional index; show "price as of" |
| Cross-tenant leak | `tenant-isolation-review`; `FarmAccessService`; no network-hospital code edits without approval |
| Scope sprawl | Phase gates; every phase ships behind a flag and is independently valuable |

---

## 11. Open research items (not closed in this session)
1. ICAR 2013 nutrient requirements and Indian feed composition tables - availability and licence.
2. India pet-food and feed-quality law specifics (Feed Act/Control Order, FSSAI scope for pet food) - verify with primary sources.
3. Hill's, Royal Canin, Petco, Nom Nom, Ollie, Tractive, Petivity: what each actually offers in nutrition (search returned nothing).
4. openFDA recall API access; USDA FoodData Central and Open Pet Food Facts licences (stated from background knowledge only).
5. Weekly weight-loss target rates and treat-calorie guidance - from WSAVA/AAHA primary text.
6. Bharat Pashudhan / INAPH / 1962 app: any public API for interop.
7. Independent (non-vendor) evidence for aquaculture acoustic feeders and for LLM diet accuracy.
8. Full-text verification of the mastitis/ketosis ML papers' performance figures.

## 12. Owner decisions

### 12.1 Decided 2026-11-22
| # | Question | Owner answer | How the plan applies it |
|---|---|---|---|
| 1 | Order | Pets first, must also serve farms | Phase 1 builds the all-species foundation + pet calculators; farm calculators plug into it (§5.1a) |
| 2 | Species | Everything | Nutrition models per pattern, mapped in master data; unknown species safe as `guidance_only` |
| 3 | Clinical sign-off | Vet validates after implementation | Requirement-set status `unvalidated/vet_validated`; plans labelled "suggested - not yet vet-validated" until then |
| 4 | Data | Get all available data and resources | Gather every source with provenance + licence register. **Caveat:** sources whose terms forbid commercial use (Feedipedia/AFZ, WSAVA charts, NRC/NASEM tables) are loaded only after permission - the engine is data-driven, so they slot in later without code change |
| 5-6 | Money / commerce | Free for everyone now; commercial plans after real usage | No paywall, no selling; entitlement seam + usage measurement built in |
| 7 | Access wording | (Answered with the single-source-of-truth requirement - §4a) | Wording needs no new decision: farm data already refuses with readable messages via `FarmAccessService` (`NO_ACCESS_MESSAGE`, `backend/src/services/FarmAccessService.ts:41`; vet `VET_NOT_BOOKED_MESSAGE`, :80). Nutrition reuses exactly those |
| 8 | Network hospitals | No changes for now | Zero edits to network-hospital code; hospital users see nutrition only where existing gates already show the animal |

### 12.2 Decided 2026-11-22 (second round) - all four answered "yes"
1. External AI service for explanations / label photos / voice notes: **allowed** (animal facts only, never owner
   identity; calculations never use AI).
2. Data-permission letters: **the owner handles them**; not drafted here.
3. One home for body condition: **approved** - `weight_history` is the single body-measurement history (built, migration 056).
4. Rabbits, birds, fish, reptiles: **guidance-only** until a vet validates data (built: `nutrition_model = guidance_only`).

### Build status
- **Phase 1 built** (see `docs/modules/nutrition.md`): schema for all species, engine, access gate, pet calculator,
  body history, plan / review / feeding / alerts, shared panel in every role's animal screen, admin data screens,
  usage tracking, six languages.
- Next: Phase 2 farm calculators into the same tables and panel.

### 12.3 Original wording of the four questions (kept for the record)
1. **External AI (re-asked in plain words):** some futuristic features - explaining a plan in Tamil in simple
   words, reading a feed-bag label from a photo, turning a farmer's voice note into a record - need an AI service
   run by an outside company. We would send only animal facts (species, age, weight, food), never the owner's name,
   phone or address. Allowed, not allowed, or build it switched off until you decide? Calculations never use AI either way.
2. **Who sends the data-permission requests:** I can draft the letters to WSAVA, AFZ (Feedipedia) and NASEM, but
   they must come from you/the company. Draft them?
3. **One home for body condition score:** today it exists only on farm health observations. Proposal: make
   `weight_history` the single "body measurements" history (add BCS and MCS columns) and have health observations
   write through to it, so pets and farm animals use one place. This changes an existing table and form, so it needs your OK.
4. **Pets beyond dogs and cats** (rabbits, birds, fish, reptiles): vetted requirement data is thin. Proposal: they
   get `guidance_only` (safe-food list, weight and condition tracking, vet referral) until a vet validates data. Agree?

## 13. Sources (all seen in search results this session)
- PawCo AI dog nutrition assistant (Mar 2026): https://www.petfoodindustry.com/news-newsletters/pet-food-news/news/15820504/pawco-launches-ai-nutrition-assistant-for-dog-owners
- FAMMO: https://fammo.ai/en/ ; PetFoodis.AI: https://petfoodis.ai/en
- WSAVA Global Nutrition Guidelines: https://wsava.org/global-guidelines/global-nutrition-guidelines/ ; AAHA nutrition/weight guidelines box: https://www.AAHA.org/globalassets/02-guidelines/2021-nutrition-and-weight-management/resourcepdfs/nutritiongl_box1.pdf
- MSD Vet Manual maintenance energy table: https://www.msdvetmanual.com/multimedia/table/daily-maintenance-energy-requirements-for-dogs-and-cats
- UC Davis homemade dog food recipes: https://www.ucdavis.edu/news/homemade-dog-food-recipes-can-be-risky-business-study-finds ; Texas A&M / Dog Aging Project: https://vetmed.tamu.edu/news/press-releases/homemade-dog-diets/ ; Guelph ChatGPT test: https://ovcpetnutrition.uoguelph.ca/2024/09/03/from-code-to-cuisine-what-happens-when-ai-designs-home-made-dog-food-recipes
- Vetster nutrition consults: https://vetster.com/en/blog/nutrition-consultations-on-vetster ; Hill's TeleTails: https://www.dvm360.com/view/fidu-and-hill-s-pet-nutrition-partner-to-offer-free-veterinary-nutrition-teleconsultation-service
- Dairy ration software overview: https://www.bestmix.com/en/blog/cattle-feed-formulation-software-complete-guide-livestock-software-selection ; NDS news / CNCPS: https://agmodelsystems.com/ ; Promix/INRA 2018: https://alimentationsoftware.com/en/
- NDDB Ration Balancing Programme: https://www.nddb.coop/services/animalnutrition/programmes/ration-balancing-programme ; World Bank India National Dairy Support Project: https://documents1.worldbank.org/curated/en/963861597014201705/pdf/India-National-Dairy-Support-Project.pdf ; FeedMaster app: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9597918/
- Least-cost formulation (Excel Solver teaching paper): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11000179/
- Feedipedia copyright terms: https://www.feedipedia.org/content/copyright
- Mastitis ML (Animals 2024): https://www.mdpi.com/2076-2615/14/3/427 ; ketosis/acidosis ML: https://pmc.ncbi.nlm.nih.gov/articles/PMC12471471/ ; JDS 2025 mastitis 9-algorithm: https://www.journalofdairyscience.org/article/S0022-0302(25)01026-4/fulltext
- Dairy BCS from 3D/depth (preprint): https://arxiv.org/html/2601.22522v2 ; edge tail-feature BCS: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12474389/
- Aquaculture: ICRIER brief https://icrier.org/pdf/pb81_From-Ponds-to-Platform.pdf ; AquaExchange https://www.electronicsforu.com/electronics-startups/aquaexchange-brings-monitoring-and-automation-to-shrimp-farming ; Aquaconnect https://inc42.com/startups/aquaconnect-shrimp-farmers-app
- Poultry FCR ML: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12189232/
- BIS animal feed standards (IS 2052): https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/get_is_list_by_category_id/29
- Aflatoxin India: https://pmc.ncbi.nlm.nih.gov/articles/PMC6828985 ; NDDB booklet: https://nddb.coop/sites/default/files/pdfs/Booklet_on_Aflatoxin.pdf
- Methane additives: https://carbon-pulse.com/465136/ ; Teagasc: https://teagasc.ie/wp-content/uploads/2025/05/Methane-Reducing-Feed-Additives-Hazel-Costigan.pdf
- FDA pet food recalls dataset: https://catalog.data.gov/dataset/fda-pet-food-recalls
