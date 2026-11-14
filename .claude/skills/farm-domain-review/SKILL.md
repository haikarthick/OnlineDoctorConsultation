---
name: farm-domain-review
description: Functional review of any farm-management feature against how a real livestock farmer actually works — species-correct terminology, life-stage groups, the daily/seasonal record-keeping loop, and Indian breed/ID conventions. Use whenever adding or changing anything a farmer records or reads (animals, groups, milk, breeding, health, feed, sales), whenever seeding or editing species/breed/class/group-type master data, and during Phase 1 (requirements) of feature-delivery for any farm feature. Not for pet-owner, hospital, pharmacy or grooming screens.
---

# Farm domain review

A farm feature fails in the field for functional reasons long before it fails for technical ones:
the wrong word for an animal, a field that doesn't apply to this species, a record the farmer has
no reason to open the app for. This skill is the functional gate. Its technical twin is
`mobile-farmer-ux` — a farm screen needs both.

Benchmark, checked 2026-11-14: the farm apps farmers actually keep using (My Cattle Manager,
Prompt Farm365, Herdwatch, Farmtree) all share the same core — a per-animal profile with history,
breeding/calving events, health/treatment records, per-cow milk records, reports, and offline entry
with later sync. Anything outside that core is optional; anything missing from it is a gap.

## 0. Every farm type, not just dairy

Farmer feedback usually arrives about one species. The platform serves all of them, and a design
that only fits a dairy cow is wrong. Before accepting any farm design, walk it through each row
and say what the farmer records and sees:

| Farm type | Managed as | Daily record | Key events | What they watch |
|---|---|---|---|---|
| Dairy (cattle, buffalo) | individual | milk per session | heat, AI, pregnancy check, dry-off, calving | yield, calving interval |
| Goat / sheep | individual or flock | weight; milk only for dairy goats | mating, kidding/lambing, weaning, sale | growth, kids per doe |
| Pig | individual sows, batch fatteners | feed | service, farrowing (litter size), weaning | litter size, growth |
| Poultry broiler | batch + cycle | mortality, feed, sample weight | placement, sale/clear-out | mortality %, feed conversion, days to market |
| Poultry layer | batch + cycle | eggs collected, mortality, feed | placement, cull | lay %, mortality % |
| Mixed smallholder | both | whichever applies | all of the above | simple totals |

Batch-managed stock never gets one row per head (`docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md`). A daily
record, an event, or a "due" reminder must take either an animal or a group as its subject —
build it once for both, not as a cattle feature with poultry bolted on later.

## 1. Does the farmer have a reason to open this today?

Every farm feature must attach to one of the loops below. If it attaches to none, question it.

- **Daily:** milk (morning/evening), feed given, something looks sick, a death or a sale.
- **Event-driven:** heat seen → inseminated → pregnancy check → dry-off → calving (the calf becomes
  a new animal with dam/sire already filled in). Treatment given → withdrawal period.
- **Due soon:** vaccination, deworming, pregnancy check, expected calving, dry-off date.
- **Occasional:** weighing, buying/selling, moving animals between groups.

A record that produces no later reminder, total, or report is paperwork. Say what the farmer gets
back for entering it.

## 2. Species-correct words, never generic ones

- Animal classes come from `master_animal_classes` (cow, heifer, bullock, doe, ewe, gilt…). Never
  show a farmer "female adult".
- Group types are life-stage or purpose per species, not housing types: cattle/buffalo — calf pen,
  heifers, lactating, pregnant, dry, bulls, bullocks, isolation, quarantine; goat — kids, bucks,
  does, fatteners; sheep — lambs, rams, ewes, fatteners; pig — piglets, boars, sows, gilts,
  fatteners. Poultry is batch-managed (see `docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md`).
- Livestock breeds use "Cross Breed" / named crosses (Jersey Cross, HF Cross), not "Mixed Breed".
- Anything master-linked is a picker, never free text (project master-data rule).

## 3. Show a field only where it applies

Gate on the class flags that already exist (`can_produce_milk`, `can_be_pregnant`,
`implied_gender`) and on species — never hardcode species names in a component.

- Milk yield, lactation number, dry-off: milk-producing classes of cattle and buffalo only (goat
  and sheep milk only if the owner asks for it).
- Pregnancy status, calvings/parity, expected due date: classes that can be pregnant.
- Ear tag: species with `has_ear_tag`.
- A bull must never be asked about milk; a calf must never be asked about calvings.

## 4. Indian context

- Breed names follow NBAGR's registered list and spelling (nbagr.res.in). Verify against the page,
  don't recall. Retire a breed by deactivating it — existing animals may carry the name. A rename
  must also update `animals.breed` rows, `init.sql`, a migration, and the fallback list in
  `frontend/src/constants/speciesBreeds.ts`.
- Units: litres for milk, kg for weight, rupees. No lb, no gallons.
- National animal ID is the 12-digit Pashu Aadhaar ear tag (Bharat Pashudhan). Treat it as the
  primary lookup key for tagged livestock.
- Every label exists in all 6 locales; master rows carry per-locale labels.

## 5. The vet must see what the farmer recorded

Production and reproductive data (milk yield, pregnancy status, calvings, weight, withdrawal) is
recorded so a vet can dose and advise correctly. A field that is captured but not shown on the
consultation / prescription screens has not met its purpose. Check both ends.

## 6. Output

List, per item: what a farmer would find wrong or missing, the screen/table it concerns, and the
fix. "Nothing wrong" is a valid result; an unchecked section is not.
