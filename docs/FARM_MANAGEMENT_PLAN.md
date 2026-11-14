# Farm Management Realignment — Analysis & Plan

**Status: PLAN APPROVED IN PRINCIPLE, NOTHING BUILT.** Written 2026-11-14 so a new session can
resume without redoing the analysis. Next action is in §11.

Anything marked **[unverified]** was not checked against a source or the code and must be
checked before it is built on. Everything else was read from the code or fetched from the cited
page on 2026-11-14; line numbers will drift, re-grep before relying on one.

---

## 1. Where this came from

Feedback from a real user (Tamil Nadu), relayed by the owner:

1. The farm module does not match a farmer's everyday needs; it must become a complete farm
   record-keeping tool farmers use daily.
2. It is not easy on a phone. Farmers have no laptop.
3. Specific notes:
   - **Group form:** group types should be Calf pen, Heifers, Lactating cows, Pregnant cows, Dry
     cows, Bulls, Bullocks, Isolation pen / sick animals, Quarantine shed (cattle; buffalo the
     same). Goat: Kids, Buck, Doe, Fatteners. Sheep: Lamb, Ram, Ewe, Fatteners. Pig: Piglet, Boar,
     Sow, Gilt, Fatteners. "Target count" needs explaining.
   - **Register animal:** use NBAGR registered breeds; TN cattle = Bargur, Kangayam, Umblachery,
     Pulikulam; Simmental is not in India; "Mixed breed" → "Cross breed"; add Jersey cross, HF
     cross; add average daily milk yield (litres), birth weight, number of calvings, pregnancy
     status so a vet can prescribe on them; milk yield for cattle and buffalo only; list
     livestock/farm and poultry first, then pets; buffalo add Bargur; goat add Kodi adu; TN sheep
     = Coimbatore, Kilakarsal, Madras Red, Mecheri, Nilgiri, Ramnad White, Tiruchi Black, Vembur,
     Katchaikatty Black, Chevaadu.

## 2. Owner decisions (2026-11-14) — do not re-ask

| # | Decision |
|---|---|
| D1 | **Mobile ease of use is the top priority.** If it is hard for the end user, nothing else matters. Benchmark: Apple-quality and the best farm apps. |
| D2 | Design for **all farm sizes equally**: one adaptive design (few animals → simple list by name; larger herd → tag search, groups, bulk entry). |
| D3 | Farmers **read Tamil but avoid typing**: local-language labels with icons, tap-to-choose, digits only where unavoidable. No voice in the first release. |
| D4 | **Offline save-now-send-later is a later release.** Until then a failed save keeps the form filled and offers Retry. |
| D5 | **Milk: both** per animal and a total per group/farm per session; the farmer chooses. |
| D6 | **Every farm type must be supported**, not just cattle: dairy, goat/sheep, pig, poultry (broiler and layer), **aquaculture — included, whatever it takes**, and mixed. |
| D7 | **Parent drives children.** For every farm type and animal, sub-fields and sections are shown/hidden by the parent selection so the farmer views/adds/updates only what is relevant. See §6. |
| D8 | **Seamless across modules is a mandatory rule** (data, functionality, look and feel, usability, every role). Written into `CLAUDE.md`, the `feature-delivery` skill Phase 1, and memory `feedback-cross-module-seamless`. |
| D9 | Plan first, owner approves the design, then build. |
| D10 | **Aquaculture species come from government/official sources**, not general knowledge. Fish, shrimp and prawn are all in scope. Sourced list in §6.5. |
| D11 | **Milk applies to every animal that produces milk.** No restriction from our side unless there is a functional or technical problem (there is none). Driven by the class flag `can_produce_milk`, never by a species list. |
| D12 | **Every change is made consistently across all modules and roles** (restates D8). The bottom tab bar and the new building blocks therefore roll out to **every role in the same phase**, not farmers first. |
| D13 | **Both the owner and farm workers record data.** |
| D14 | Buffalo group types are the same as cattle, **including bullocks**. |
| D15 | **Income/expense is out of this initiative.** The owner plans a complete farmer finance management module as the next phase. Do not build finance here; only keep the hooks in §9 "Finance hand-off". |

Defaults proposed and **not objected to** (treat as accepted unless the owner says otherwise):
"Cross Breed" replaces "Mixed Breed" for **livestock only** (dogs/cats/rabbits keep "Mixed
Breed"); species order is **by role** (farmer sees livestock/poultry/aquaculture first, pet owner
sees pets first); a typed "average daily milk yield" is kept on the animal and later
auto-calculated from the milk log once that exists.

## 3. Skills and rules created for this work

- `.claude/skills/farm-domain-review` — functional gate; §0 has the farm-type table. **Add an
  aquaculture row when Phase 2 lands.**
- `.claude/skills/mobile-farmer-ux` — phone-first rules and tap-count targets.
- `.claude/skills/feature-delivery` — Phase 1 now has the mandatory cross-module trace; Phase 4
  chains the two skills above.
- `CLAUDE.md` — "Mandatory: seamless across modules".

## 4. Current state (verified in code)

### 4.1 What exists

| Area | Where | Notes |
|---|---|---|
| Animals | `animals` table `docker/init.sql:120`; `AnimalService.ts`; `pages/Animals.tsx`; `components/animals/AnimalFormModal.tsx` | 24 form fields in one panel. `birth_weight` column exists (`init.sql` ~3011) but is **not on the form**. `breeding_status`, `last_breeding_date`, `expected_due_date`, `dam_id`, `sire_id`, `animal_class`, `ear_tag_id`, `current_weight` exist. |
| Species / breeds / classes | `master_species` (`init.sql:3545`), `master_breeds`, `master_animal_classes`; seed from `init.sql:4178`; `MasterDataService.ts`; `context/MasterDataContext.tsx`; fallback `constants/speciesBreeds.ts`; admin UI `pages/admin/MasterDataManagement.tsx` | Classes carry `implied_gender`, `can_be_pregnant`, `can_produce_milk`. Species carry `category`, `has_ear_tag`, `default_management_mode`, per-locale labels. Classes exist only for Cattle, Buffalo, Sheep, Goat, Pig, Dog, Cat. |
| Groups | `animal_groups` (`init.sql:239`); `AnimalGroupService.ts`; `pages/AnimalGroups.tsx` | `group_type` is free VARCHAR; UI list is hardcoded English in `types/enterprise.ts:73-92` (herd, flock, pen, paddock, enclosure, tank, aviary, kennel_group, breeding_group, quarantine, nursery, production, other). Species and breed are **free-text inputs** (`AnimalGroups.tsx:552,556`) — violates the master-data rule. `PURPOSE_OPTIONS` hardcoded English (`AnimalGroups.tsx:10`). |
| Target count | `animal_groups.target_count` | Planned head count. Only use: "12 / 20 target" on the group card (`AnimalGroups.tsx:295`). Rename to "Planned count (optional)" with a hint. |
| Batch / flock | migration `041`, `BatchManagementService.ts`, routes in `enterprise-farm.routes.ts:115-196`, `docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md` | `management_mode` on group; `group_cycles`; `group_population_events` ledger; group-subject health records; withdrawal interlock. Phases 1–3 complete, 4 partial, 5 not started. |
| Breeding | `breeding_records` (`init.sql:2853`); `BreedingService.ts`; `pages/BreedingManager.tsx` | Gestation table `BreedingService.ts:130` has cattle, horse, pig, sheep, goat, dog, cat, rabbit, chicken — **no buffalo**, so buffalo gets no expected due date. |
| Health | `health_observations`, medical/vaccination records, `pages/HerdMedicalManagement.tsx`, `TreatmentCampaigns.tsx` | Group or animal subject. Milk/meat withdrawal stored and enforced on movements and certificates. |
| Feed | `feed_inventory`, `feed_consumption_logs`; `pages/FeedInventory.tsx` | Consumption can be logged per group/animal. |
| Other | `locations`, `movement_records`, `enterprises` (16 `EnterpriseType`s incl. `poultry_farm`, `aquaculture`), `enterprise_members` | |
| PWA | `frontend/public/sw.js`, `manifest.json`, `components/PWAPrompt.tsx` | Installable. Caches GETs only; the background-sync handler is a placeholder (`sw.js:212-222`). |

### 4.2 Gaps

**Daily record keeping**
- No milk recording anywhere (table, API or screen). Milk yield / lactation number exist only on
  `marketplace_listings`.
- No egg recording anywhere.
- No farmer-facing "due today" list.
- No quick event entry (heat, insemination, pregnancy check, dry-off, calving/kidding/farrowing,
  weaning, sale, death).
- **Batch ledger has no UI.** Zero `.tsx` call sites for `openGroupCycle`, `closeGroupCycle`,
  `listGroupCycles`, `getActiveGroupCycle`, `recordPopulationEvent`, `listPopulationEvents`,
  `reconcileGroup`, `promoteAnimalFromBatch` (client methods sit in
  `frontend/src/services/api/modules/auth.ts:5-40`, an odd home — move to `enterprise.ts`). A
  poultry farmer cannot place a flock, record daily mortality, or close a cycle. Mortality and
  cull rates are displayed (`AnimalGroups.tsx:498-499`) with no way to enter the inputs.

**Master data**
- Breeds missing vs NBAGR (see §5.1). Simmental present. "Mixed Breed"/"Mixed" used for livestock.
- No classes or group types for poultry, horse, camel, duck etc.
- No farmed aquatic species at all (only Ornamental Fish, Koi, Arowana, Goldfish as pets).
- Species sort order puts pets 10–310, livestock 320–410, poultry 420–480.

**Mobile**
- Hamburger sidebar with ~35 farmer menu items in 5 sections (`Navigation.tsx:99-208`); no bottom
  tab bar.
- HTML tables in Animals, Breeding, Feed, Movement pages.
- 142 `type="number"` inputs in the frontend, **zero** `inputMode` — phones open the full keyboard.
- Forms are single wide panels (`.edit-form-panel`, `modules.css:2002`).

**Cross-module (the vet cannot see what the farmer records)**
- Consultation room animal card (`components/consultationRoom/MedicalHistoryPanel.tsx:43-48`)
  shows name, species, breed, age, weight, ID, farm › group. **Not** class or breeding status,
  both already on the animal.
- Prescription queries (`PrescriptionService.ts:154-156, 228-230, 270-272, 390-391`) select
  species, breed, DOB, gender, class — nothing about pregnancy, lactation or production.
- Remaining `docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md` Phase 4/5 items are the same class of gap for
  flocks (timeline, group passport, group certificates, analytics as rates, group consultations
  and batch prescriptions).

## 5. Research results

### 5.1 NBAGR registered breeds (fetched from nbagr.res.in, 2026-11-14)

| Species | TN home-tract breeds on NBAGR | Already seeded | Action |
|---|---|---|---|
| Cattle | Bargur, Kangayam, Umblachery, Pulikulam | Kangayam, Umblachery | Add Bargur, Pulikulam, Jersey Cross, HF Cross. Deactivate Simmental (on no NBAGR page). "Mixed Breed" → "Cross Breed". |
| Buffalo | Toda, Bargur | Toda (Nilgiri) | Add Bargur. "Mixed" → "Cross Breed". |
| Goat | Kanni Adu, Kodi Adu, Salem Black | Kanniadu, Salem Black | Add Kodi Adu. Rename "Kanniadu" → "Kanni Adu" (NBAGR spelling). "Mixed Breed" → "Cross Breed". |
| Sheep | Coimbatore, Kilakarsal, Madras Red, Mecheri, Nilgiri, Ramnad White, Tiruchi Black, Vembur, Katchaikatty Black, Chevaadu | Coimbatore, Madras Red, Mecheri, Nilgiri, Ramnad White, Vembur | Add Kilakarsal, Tiruchi Black, Katchaikatty Black, Chevaadu. "Mixed Breed" → "Cross Breed". |
| Pig | not fetched | — | "Mixed Breed" → "Cross Breed". |

Alambadi is **not** on the NBAGR cattle page. Sources: nbagr.res.in/cattle-breed, /buffalo-breed,
/sheep-breed, /goat-breed.

Rename/retire rules (from memory `animal-class-and-marketplace-media-audit-fix-2026-07-23`,
breed-rename drift): `animals.breed` is a free VARCHAR, so a rename must `UPDATE animals` (and
`animal_groups.breed`, `group_cycles.breed`, marketplace listings — grep every `breed` column)
in the same migration; retire by `is_active = false`, never delete; change `init.sql`, a new
migration (next number is **043**), and `frontend/src/constants/speciesBreeds.ts` together.

### 5.2 Market apps (vendor pages and store listings — speed claims are marketing)

My Cattle Manager (Bivatec), Prompt Farm365 (India), Herdwatch (Ireland/UK), Farmtree (India);
Stellapps mooON and Herdman are widely used in India but their feature lists were not confirmed.

- Core shared by all three read in full: per-animal profile with history; breeding/pregnancy/
  calving events; health and treatment records; **milk per cow**; **offline entry with later
  sync**; reports; a web view alongside the phone.
- Speed is the selling point: Herdwatch advertises records "in seconds", calf registration in
  under a minute from the shed, batch entry.
- Language is a gap we can win: My Cattle Manager is English only; Farm365 has English, Hindi,
  Gujarati. We have en, hi, kn, ml, ta, te.
- Review complaints worth avoiding: no notes/calendar, inflexible reports, feeling dairy-only.
- India: tagged livestock carry a 12-digit Pashu Aadhaar ear tag (Bharat Pashudhan / NDLM). Make
  it the primary lookup key for tagged animals. **[unverified]** whether any public API exists
  for farmers' apps; assume none.
- Low-literacy research (Microsoft Research India; VideoKheti): icons alone or voice alone are
  not enough; pair icon + local-language label; minimal hierarchy; avoid long scrolling.
- Touch targets: Apple 44 pt, Material 48 dp → use 48 px.

URLs: apps.apple.com/us/app/my-cattle-manager-farm-app/id6450873776 ·
promptdairytech.com/?p=5200 · herdwatch.com/en-ie/solutions/dairy/ ·
agriculture.vikaspedia.in (Bharat Pashudhan) ·
microsoft.com/en-us/research/wp-content/uploads/2016/10/medhi-design-june18.pdf

## 6. The core design: one profile, parent drives children (D7)

This is the foundation every later phase stands on. Build it once; no screen decides visibility
on its own.

### 6.1 The hierarchy

```
Farm (enterprise)            what kinds of stock it holds
  └─ Species                 Cattle, Goat, Chicken, Rohu, Vannamei shrimp …
       └─ Management mode    individual | batch   (property of the GROUP; species only suggests)
            └─ Group type    Lactating cows / Layers / Grow-out pond …   (per species)
                 └─ Animal class   cow, heifer, doe, sow …   (individual mode only)
                      └─ fields, sections, daily records, events, reminders, reports
```

Each level narrows what the level below offers. Selecting a parent filters the child pickers and
hides everything that does not apply. Changing a parent clears children that are no longer valid
(with a clear message, never silently).

### 6.2 Capability flags, not species names

No component or service may contain `if (species === 'Cattle')`. Visibility comes from data, so an
admin-added species works without a deploy.

**`master_species` — add:**

| Column | Meaning |
|---|---|
| `farm_segment` | `dairy` \| `small_ruminant` \| `pig` \| `poultry` \| `aquaculture` \| `equine` \| `other_livestock` \| `pet`. Drives Today-screen layout, role ordering, group-type lists. Replaces reliance on the free-text `category`. |
| `produces_milk`, `produces_eggs`, `produces_wool` | Which daily production records apply. |
| `is_aquatic` | Switches units and sections (pond area, stocking density, water quality; no ear tag, no gender). |
| `gestation_days` / `incubation_days` | Replaces the hardcoded map in `BreedingService.ts:130`; fixes buffalo. |
| `birth_event_term` | `calving` \| `kidding` \| `lambing` \| `farrowing` \| `foaling` \| `hatching` \| `spawning` — the word shown to the farmer. |
| `litter_expected` | true for pig, goat, sheep, dog… → offspring-count field shown. |
| existing: `has_ear_tag`, `default_management_mode`, `category`, `sort_order` | keep |

**`master_animal_classes` — keep** `implied_gender`, `can_be_pregnant`, `can_produce_milk`;
**add** `can_lay_eggs`, `is_juvenile` (hides reproductive and production fields). Seed classes for
the species that have none (poultry, duck, horse, camel…).

**New `master_group_types`** (per species, admin-editable, per-locale labels — same shape as
`master_animal_classes`): `species_id`, `value`, `label_key`, `label` + `label_hi/kn/ml/ta/te`,
`management_mode` it implies, `suggested_class` (e.g. "Lactating cows" suggests class cow),
`is_health_hold` (isolation / quarantine), `sort_order`, `is_active`. `animal_groups.group_type`
keeps storing the value; existing generic values stay valid as a legacy set so no group breaks.

**New `master_record_types`** + **`master_record_type_rules`** — which daily records and events
exist and when they apply:

- record type: `code` (milk, eggs, feed, mortality, sample_weight, water_quality, heat,
  insemination, pregnancy_check, dry_off, birth, weaning, stocking, harvest, sale, death,
  treatment…), `kind` (`daily` \| `event`), `subject` (`animal` \| `group` \| `either`), icon,
  labels, the field set it captures.
- rule: record type × (`farm_segment` or species) × management mode × required class flag
  (e.g. milk requires `can_produce_milk`; dry_off requires a lactating animal).

### 6.3 One resolver, used everywhere

- **Backend:** `FarmProfileService.resolve({ speciesCode, animalClass?, managementMode, groupType? })`
  → `{ fields: {...visible/required}, sections: [...], recordTypes: [...], eventTypes: [...],
  terms: {...}, units: {...} }`. Every write endpoint validates against it (a bull's milk record
  is rejected with a clear message, not silently stored). Exposed at one endpoint so the phone
  caches it with the rest of master data.
- **Frontend:** `useFarmProfile(species, class, mode, groupType)` hook in the shared layer, fed
  by `MasterDataContext`. Every form, detail view, card, filter, report and the vet-side animal
  summary reads visibility from it. No per-page copies.
- **View = add = update.** The same resolver decides what the detail screen shows, so the farmer
  never sees an empty "Milk yield: —" row on a bull.
- Existing data in a now-hidden field is never deleted by hiding; it just isn't shown or asked.

### 6.4 Farm-type matrix (what the resolver must produce)

| Segment | Mode | Identity | Animal/group fields | Daily records | Events | Farmer watches |
|---|---|---|---|---|---|---|
| **Dairy** (cattle, buffalo) | individual | name, ear tag (Pashu Aadhaar), class | breed, DOB, birth weight, weight; females: pregnancy status, calvings, lactation no., avg daily milk, last calving, dry-off date | milk AM/PM (per animal or group total), feed | heat, insemination (natural/AI), pregnancy check, dry-off, calving → creates calf with dam/sire, treatment, sale, death | yield per cow and total, calving interval, due dates |
| **Goat / sheep** | individual or flock | name/tag, class | breed, DOB, weight; females: pregnancy, kiddings/lambings, avg daily milk (D11 — doe and ewe already have `can_produce_milk = true` in the seed); sheep: wool | milk AM/PM (same record as dairy, optional to use), weight (periodic), feed | mating, kidding/lambing (litter size), weaning, shearing (sheep), sale, death | growth, kids per doe, mortality |
| **Pig** | sows/boars individual; fatteners batch | tag, class | breed, DOB, weight; sows: parity, pregnancy | feed; batch: mortality, sample weight | service, farrowing (born alive / stillborn), weaning (count), sale, death | litter size, growth, feed conversion |
| **Poultry broiler** | batch + cycle | shed/flock name, cycle no. | breed/strain, placed count, placement date, source hatchery, age in days (computed) | mortality, culls, feed, water (optional), sample weight | placement, vaccination (campaign), partial sale, clear-out (closes cycle) | mortality %, feed conversion, average weight, days to market |
| **Poultry layer** | batch + cycle | shed/flock name, cycle no. | breed/strain, placed count, age in weeks | eggs collected (good / broken), mortality, feed | placement, vaccination, cull, clear-out | lay %, eggs per bird, mortality % |
| **Aquaculture** (fish, shrimp, prawn) | batch + cycle ("crop") | pond/tank name, crop no. | species, pond area + unit, water type (fresh/brackish), stocking count, stocking date, seed source, days of culture (computed) | feed given, mortality, water quality (temp, pH, dissolved oxygen, salinity, ammonia — optional each), sample weight | stocking, sampling, water exchange, treatment, partial harvest, harvest (kg, closes crop) | survival %, average body weight, biomass, feed conversion, days of culture |
| **Equine / other livestock** (horse, donkey, camel, yak…) | individual | name, tag/microchip, class | breed, DOB, weight; breeding fields by class flags; milk fields for milk-producing female classes (camel, yak, donkey, mare — classes to be seeded with `can_produce_milk = true`, D11) | milk where the class produces it; otherwise none by default | breeding, foaling, treatment, sale, death | health history |
| **Mixed** | per group | — | union, but each group/animal shows only its own row above | per group | per group | per-segment tiles |

Never shown: milk for a non-milk class; pregnancy/parity for males and juveniles; ear tag for
poultry and aquatic; gender/class/name for batch subjects; water quality outside aquaculture; eggs
outside laying classes/groups; neutered / insurance / microchip sections for farm stock unless the
farmer opens "More details".

Aquaculture reuses the batch engine (`group_cycles` = crop, `group_population_events` =
stocking/mortality/harvest) rather than a new one; water quality is the one genuinely new record
type. The existing `locations` table already has `pond` and `tank` types. Withdrawal periods
apply before harvest. Species and parameters: §6.5.

### 6.5 Aquaculture master data — from official sources (D10)

Fetched 2026-11-14. **Sources that worked:** TNAU Agritech Portal (Tamil Nadu Agricultural
University, `agritech.tnau.ac.in/fishery/`) and ICAR-CIBA (`ciba.res.in`, Finfish Culture
Division page). **Sources that refused the automated fetch** (try again by hand or from another
network before finalising the seed): NFDB handbook "Package of Practices for Breeding and Culture
of Commercially Important Freshwater Fish Species" (Oct 2018, `nfdb.gov.in` — DNS failure);
`fisheries.tn.gov.in/InlandFisheries` (404); Coastal Aquaculture Authority `caa.gov.in/faq.html`
(TLS error); `dof.gov.in` (403); `cifa.nic.in` (TLS error). Two ICAR-CMFRI "Aquaculture Worker
Training Manual" PDFs downloaded but could not be read in this environment (no PDF text tool) —
`eprints.cmfri.org.in/16412/` and `/16413/`; these are the best single official list of
*cultured* species and should be read before seeding.

**Scientific names are as printed by the source. Common names in the table are the standard
English/Indian trade names added by me — [unverified] against the source, which printed
scientific names only. Per-locale labels (especially Tamil) need a native check.**

| Seed as species | Scientific name (source) | Water | Group | Source |
|---|---|---|---|---|
| Catla | *Catla catla* | fresh | Indian major carp | TNAU |
| Rohu | *Labeo rohita* | fresh | Indian major carp | TNAU |
| Mrigal | *Cirrhinus mrigala* | fresh | Indian major carp | TNAU |
| Bata | *Labeo bata* | fresh | Indian major carp (as grouped by source) | TNAU |
| Calbasu | *Labeo calbasu* | fresh | Indian major carp (as grouped by source) | TNAU |
| Silver Carp | *Hypophthalmichthys molitrix* | fresh | exotic carp | TNAU |
| Grass Carp | *Ctenopharyngodon idella* | fresh | exotic carp | TNAU |
| Common Carp (mirror / scale varieties as breeds) | *Cyprinus carpio* var. *specularis* / *communis* | fresh | exotic carp | TNAU |
| Tilapia | *Tilapia mossambicus* (as printed) | fresh | tilapia | TNAU |
| Magur | *Clarias batrachus* | fresh | air-breathing catfish | TNAU |
| Singhi | *Heteropneustes fossilis* | fresh | air-breathing catfish | TNAU |
| Murrel (Striped / Giant / Spotted as breeds) | *Channa striatus*, *C. marulius*, *C. punctatus* | fresh | murrel | TNAU |
| Climbing Perch (Koi) | *Anabas testudineus* | fresh | air-breathing | TNAU |
| Pangasius | *Pangasius pangasius* | fresh | catfish | TNAU (carp-culture page) |
| Giant Gourami | *Osphronemus goramy* | fresh | other | TNAU (carp-culture page) |
| Freshwater Prawn (Scampi) | *M. rosenbergii* | fresh | prawn | TNAU; CAA technical paper (search result) |
| Asian Seabass | *Lates calcarifer* | brackish | finfish | ICAR-CIBA |
| Milkfish | *Chanos chanos* | brackish | finfish | ICAR-CIBA |
| Grey Mullet | *Mugil cephalus* | brackish | finfish | ICAR-CIBA |
| Pearlspot | *Etroplus suratensis* | brackish (also named on TNAU carp page) | finfish | ICAR-CIBA; TNAU |
| Long Whiskers Catfish | *Mystus gulio* | brackish | catfish | ICAR-CIBA |
| Red Snapper | *Lutjanus argentimaculatus* | brackish / marine | finfish | ICAR-CIBA |
| Pacific White Shrimp (Vannamei) | *L. vannamei* | brackish | shrimp | ICAR-CIBA (named); CAA paper + 2025 CAA empanelment order (search results, pages not opened) |
| Black Tiger Shrimp | *P. monodon* | brackish | shrimp | CAA paper + 2025 CAA order (search results, pages not opened) |
| Crab | not printed | brackish | crab | ICAR-CIBA (generic; "crab box culture") — **species name needed from CIBA manuals before seeding** |
| Other | — | — | — | always present, like every species picker |

Not seeded without a source: GIFT tilapia and Amur carp (named only in a news article about
Coimbatore), mud crab species, seaweed/clams/mussels/oysters (CIBA names them generically).
The TNAU page also lists ~30 minor/hill-stream species from a habitat survey; they are wild
species, not culture species, and are deliberately left out.

**Rule from the Coastal Aquaculture Authority (search result, page not opened — confirm):** a farm
approved for *L. vannamei* may not farm another crustacean at the same time. If confirmed, the
group form warns (does not block) when a second crustacean crop is opened on the same farm.

**Culture stages / group types (as named by the sources):** nursery pond, rearing pond, stocking
(grow-out) pond — TNAU describes carp culture as a three-tier system: spawn → fry in nursery ponds
(2–3 weeks), fry → fingerling in rearing ponds (~3 months), fingerling → table size in stocking
ponds; plus brood stock pond, breeding tank, cement tank (TNAU murrel page); cage, hapa,
recirculatory system (ICAR-CIBA). Quarantine tank kept from our own health-hold pattern.

**Water-quality readings and guide ranges** — the only official table found is TNAU's for
freshwater prawn nursery and grow-out (cites FAO 2002 and ICAR-CIFA): temperature 28–31 °C; pH
7.0–8.5; dissolved oxygen 3–7 ppm; salinity < 10 ppt; transparency 25–40 cm; alkalinity 25–60
ppm; total hardness 30–150 ppm; ammonia < 0.3 ppm; nitrite < 2.0 ppm; nitrate < 10 ppm; hydrogen
sulfide nil. **No official range table was found for carp ponds, shrimp or brackish finfish.**
Design consequence: the reading fields are common to all aquatic species (temperature, pH,
dissolved oxygen, salinity, transparency, ammonia — each optional), and guide ranges are stored
per species in master data so they can be filled as sources are confirmed; a species with no
range simply shows no "out of range" hint. Never hardcode a range.

**Units (from sources):** stocking per hectare and per m²; pond/tank dimensions in metres; fish
size in cm and g. Add acre and cent for pond area (local usage — **[unverified]**, confirm with
the Tamil Nadu user). Typical periods printed: murrel grow-out 8 months to 800–900 g.

## 7. Cross-module trace (D8) — every consumer of the changes

For each phase, each of these must be updated or explicitly confirmed unaffected. This is the
list the new session re-verifies with grep before building (`animal_class`, `breeding_status`,
`group_type`, `breed`, `JOIN animals`, `animal_id = $`).

| Consumer | Role | Change needed |
|---|---|---|
| Animals list/detail/form, bulk CSV import + template | farmer, pet owner, vet, admin | Resolver-driven fields; new columns in import template; pet owners see no farm fields. |
| Animal Groups | farmer, admin | Master group types; species/breed pickers; cycle + ledger UI. |
| **Shared "animal summary" component** (new) | all | One component for an animal **or** a group: class, age, weight, pregnancy/lactation status, avg milk, parity, active withdrawal, group, farm. Used by every row below. |
| Consultation room (`MedicalHistoryPanel`), booking (`BookConsultation`), consultations list | vet, farmer, pet owner | Use the shared summary. Group consultations are batch-plan Phase 5. |
| Prescription writer / prescriptions / print view | vet, pharmacist | Summary incl. pregnancy, lactation, weight; withdrawal already there. Dose-relevant warnings for pregnant/lactating. |
| Certificates (`CertificateWriter`, `VetCertificates`) | vet | Summary; group certificates (batch-plan Phase 4). |
| Medical records, Herd Medical, Vaccination Passport, Animal Timeline | farmer, vet, hospital staff | Summary header; daily records and events appear on the timeline; group passport (batch-plan Phase 4). |
| Hospital network patient views / inpatient / staff workflow | hospital staff, network roles | Read-only summary. **Change-protected zone** — show the specific change and get owner approval first (`feedback-network-hospital-change-approval`). |
| Pharmacy dispensing | pharmacist | Summary on the prescription only; no new access. |
| Marketplace sell flow (`SellStep1AnimalDetails`) | farmer | Pre-fill listing milk yield / lactation / pregnancy from the animal instead of retyping; breed renames must reach listings. |
| Dashboard (`FarmerEnterpriseOverviewPanel`, stats tiles) | farmer, admin, corporate admin | Today view on phone; tiles count groups/batches correctly. |
| Health / Financial analytics, Report Builder | farmer, admin | Production totals; batch metrics as rates. |
| Breeding Manager, Feed Inventory, Movement Log, Treatment Campaigns, Locations | farmer | Card layouts; events unify with Breeding records (one source of truth — a calving recorded as a quick event **is** the breeding record's outcome, not a second row). |
| Master Data admin | admin | CRUD for group types, record types, new species flags, with all 6 locale labels. |
| Permissions | all | New farm actions follow the 4-file permission sync rule (memory `roles-and-permissions`); enterprise member roles (owner/manager/supervisor/worker/farm_vet/viewer) decide who can record vs view. |
| i18n | all | New module file per locale (e.g. `farmRecords.json`), never grow an existing one; `public/locales` is generated. |
| Grooming, payments, wallet | — | Confirm unaffected (they read animal name/species/breed only — re-grep after breed renames). |

## 8. Phone experience (D1–D3)

Rules live in the `mobile-farmer-ux` skill. Design summary:

- **Bottom tab bar (every role, phone widths — D12):** one shared component, five items per
  role, the last always "More" (opens the existing sidebar, which stays as-is on desktop).
  Farmer: Today · Animals · **＋ Add** · Health · More. Each other role (pet owner, vet, admin,
  corporate admin, hospital staff, pharmacist, groomer) gets its own four most-used destinations
  — chosen in Phase 0 from each role's existing `Navigation.tsx` items and signed off with the
  mock-ups. All roles ship in the same phase; no role is left on the old phone navigation.
- **Today:** adapts to what the farm holds (from `farm_segment` of its groups). Sections only
  when relevant: record now (milk / eggs / mortality / feed / water quality), due (vaccinations,
  pregnancy checks, expected births, dry-offs, harvest windows), alerts (active withdrawal, sick
  animals, low feed stock). Empty farm → a three-step "set up your farm" guide.
- **＋ Add:** a sheet of large icon + label tiles, only the record and event types the farm's
  stock supports.
- **Shared building blocks** (in `components/` + `styles/modules.css`, design-system compliant,
  no inline styles, scoped per `docs/DESIGN_SYSTEM.md`): `BottomTabBar`, `BottomSheet`,
  `StepForm`, `ChipSelect`, `SearchPicker` (recents first; evolve the existing
  `SearchSelect`/`AnimalSearchPicker`), `NumberStepper` (digit keypad, +/−, quick values),
  `DateQuick` (Today / Yesterday / pick), `AnimalCard`, `GroupCard`, `SubjectSummary` (§7),
  `SaveState` (saving / saved-next? / failed-retry with form kept).
- **Tap targets (acceptance criteria):** milk for one cow ≤ 4 taps; any event ≤ 5 taps; register
  an animal ≤ 6 required fields on step one; whole-group entry is a single scrolling list with one
  number per animal and one Save.
- **Adaptive to size (D2):** ≤ ~15 animals → list by name with photo; more → search by tag
  number first, group filter chips, bulk "record whole group".
- Every label in all 6 locales, icon + label always, 16 px minimum text, high contrast.

## 9. Phases

Each phase runs the full `feature-delivery` pipeline (requirements incl. cross-module trace →
design → build → reviews: `code-review`, `tenant-isolation-review`, `ui-review`,
`ui-resilience-review`, `farm-domain-review`, `mobile-farmer-ux` → `pre-ship`), ships to
`develop`, and is verified with `npm run verify:runtime` for anything touching DB/routes. DB
changes go in **both** `docker/init.sql` (one atomic transaction) and a numbered migration; never
hardcode `public.`. New daily-records capability ships dark behind a flag (`farm.records.enabled`,
pattern from `grooming.enabled`) with its own `routes/farm-records.routes.ts`.

### Phase 0 — Design sign-off (no code)
Phone mock-ups (HTML artifact) of: tab bar, Today for a dairy farm / a layer farm / a fish pond,
Add sheet, milk entry (single + whole group), register animal step 1, register group. Owner
approves before Phase 1. Confirm the open questions in §10.

### Phase 1 — Farm profile engine + master data
- Migration 043 + `init.sql`: new `master_species` columns and backfill for every existing
  species; `master_animal_classes` additions and missing classes; `master_group_types` seeded per
  §6.4 and the user's lists; `master_record_types` + rules; `gestation_days` (buffalo ≈ 310
  **[unverified — confirm]**).
- Breed corrections per §5.1 with the rename-propagation rules.
- Aquaculture species and breeds/strains (after verifying the list), `farm_segment = aquaculture`,
  batch by default, `is_aquatic`.
- Role-aware species ordering in the picker.
- `FarmProfileService` + endpoint; `useFarmProfile` hook; `BreedingService` reads gestation from
  master data.
- Master Data admin screens for the new tables.
- No visible farmer change yet except corrected breeds and ordering.

### Phase 2 — Phone foundation (all roles, D12)
Shared building blocks (§8); bottom tab bar for **every role**; `inputMode` on all 142 numeric
inputs across the app; retry-with-form-kept save behaviour as the shared default. Existing pages
keep working unchanged. Review must open at least one screen per role at phone width.

### Who records (D13) — applies to Phases 3 and 4
Owner and workers both record. Verified gap to close: `ensureGroupAccess()`
(`enterprise-farm.routes.ts:89-113`) grants access to **any** active enterprise member and does
not look at the member's role, so a `viewer` can open a cycle or post a population event today.
`EnterpriseService.ts:277` already has a role-checked membership query to reuse.
- Write rule: owner, manager, supervisor, worker, farm_vet may record daily records and events;
  viewer is read-only. Structural changes (create/delete group, close cycle, delete records)
  stay with owner/manager/supervisor. Enforce in the backend, mirror in the UI (hide, don't
  disable-and-confuse). Run `tenant-isolation-review` on every new route.
- Every record stores who recorded it and shows it ("Morning milk — recorded by Kumar, 6:40").
- Two people recording the same thing: the unique key (subject + type + date + session) means
  the second person sees the existing entry and edits it rather than creating a duplicate; edits
  keep an audit trail.
- Today is per farm, shared by everyone on it, so a worker sees what the owner already recorded.
- **[unverified]** how a worker with a non-farmer system role (e.g. `pet_owner`) reaches the farm
  screens — `Navigation.tsx` shows Farm Management to `farmer`/`admin` only. Check the invite
  flow (`/enterprises/:id/invite-member`) and fix so every active member sees their farm.

### Finance hand-off (D15) — do not build finance here
A full farmer finance module is the owner's next initiative. This initiative only makes sure the
facts finance will need are captured once and cleanly: sale and purchase events carry an optional
amount, quantity, unit and buyer/seller text; feed consumption keeps its existing cost; milk and
egg records keep quantity so revenue can be derived later; every record has farm, group/animal,
date and recorder. No ledgers, no profit screens, no invoices in this initiative.

### Phase 3 — Groups and animals rebuilt on the engine
- Group create/edit as a step form: farm → species (picker) → mode (suggested, changeable) →
  group type (filtered) → breed (picker, optional) → planned count (optional, explained).
- Register/edit animal as a step form driven by the resolver; production fields per §6.4;
  detail view driven by the same resolver; CSV template updated.
- New animal columns: `avg_daily_milk_litres`, `parity` (number of births), `pregnancy_status`
  (or reuse `breeding_status` — **decide during design, prefer reuse to avoid two sources of
  truth**), `lactation_number`, `last_birth_date`, `dry_off_date`; surface existing `birth_weight`.
- `SubjectSummary` wired into every consumer in §7.
- Card lists for Animals and Groups.

### Phase 4 — Daily records and events (behind `farm.records.enabled`)
- One `farm_daily_records` design: subject = animal XOR group (+ cycle), record type, date,
  session (AM/PM where relevant), quantity + unit, typed detail columns or JSONB for
  water-quality readings, recorded_by; unique per subject/type/date/session so a double tap
  cannot duplicate; edits audited. Milk supports per-animal and group-total (D5).
- Events: quick entry that writes through the existing sources of truth — `breeding_records`
  for heat/insemination/pregnancy check/birth, `group_population_events` for placement/
  stocking/mortality/cull/sale/harvest, `movement_records` for sales off-farm (withdrawal
  interlock already applies), medical records for treatments. A birth event creates the
  offspring animal(s) (individual mode) or a ledger entry (batch).
- **Batch UI that is missing today:** open cycle / place flock / stock pond, daily mortality,
  partial sale or harvest, close cycle, reconcile. Move the client methods out of `auth.ts`.
- Due list engine: expected births, pregnancy-check due, dry-off due, vaccination due (from
  vaccine protocols), withdrawal ending, harvest window; shown on Today and sent through the
  existing notification system.
- Auto-suggest group moves on status change (calved → Lactating; dried off → Dry; confirmed
  pregnant → Pregnant), one tap to accept, never automatic.
- Production summaries: per animal, per group, per farm; batch metrics as rates.
- Vet side: recent production and events visible in `SubjectSummary` and the timeline.

### Phase 5 — Remaining farm screens to cards + batch-plan leftovers
Breeding, Feed, Movement, Campaigns, Locations to card/step patterns; finish
`docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md` Phase 4 (timeline roll-up, group passport, group
certificates, analytics as rates, dashboard/marketplace audit) and Phase 5 (group consultations,
batch prescriptions — network parts need owner sign-off on the specific isolation changes).

### Phase 6 — Offline (D4)
IndexedDB outbox for farm daily records and events, visible "waiting to send" state, idempotency
keys server-side, conflict rule (last write wins per subject/type/date/session, shown to the
user), replace the `sw.js` placeholder.

### Later / optional
Simple income and expense per farm (market apps all have it), Pashu Aadhaar scan by camera,
voice entry, WhatsApp reminders.

## 10. Open questions for the owner (ask at the start of the next session)

The six questions first listed here were answered on 2026-11-14 and are recorded as D10–D15 in
§2. What remains is verification work, not owner decisions:

1. Read the official sources that refused the automated fetch (§6.5) and confirm or extend the
   aquaculture species list, the crab species, shrimp names, and carp/shrimp water-quality ranges.
2. Confirm buffalo gestation days and pig breeds on NBAGR.
3. Confirm how a farm worker with a non-farmer system role reaches the farm screens (§9 "Who
   records").
4. Tamil labels for new group types, classes and aquatic species need a native-speaker check —
   ask the owner who can review them.
5. Phase 0 will ask the owner to sign off each role's four tab-bar destinations.

## 11. Resume here

1. Read this file, `docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md` §10, `docs/DESIGN_SYSTEM.md`, and the
   three skills in §3.
2. Do not re-ask the owner anything in §2 (D1–D15 are settled).
3. Work through the §10 verification list and the **[unverified]** items.
4. Do Phase 0: build the phone mock-ups and get sign-off.
5. Then Phase 1 via the `feature-delivery` skill. First commit is migration 043 + `init.sql` for
   the farm profile engine and breed corrections.

Nothing in the application has been changed for this initiative yet. Commits so far are skills,
rules and this document only (`ff362b2`, `b24535e`, and the commit that adds this file).
