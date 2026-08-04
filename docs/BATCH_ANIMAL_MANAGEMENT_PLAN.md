# Batch (Flock/Herd) Animal Management — Analysis & Plan

**Status:** proposal, nothing implemented. Written 2026-08-04 after the owner reported that a
poultry group cannot be given a medical record or vaccination, and confirmed the requirement:
**a 5,000-bird flock must not produce 5,000 individual records.**

---

## 1. What the code actually does today

### 1.1 Medical data is individual-only

| Table | Key | Group support |
|---|---|---|
| `medical_records` | `animal_id` | none |
| `vaccination_records` | `animal_id` **NOT NULL** | none |
| `allergy_records` | `animal_id` **NOT NULL** | none |
| `lab_results` | `animal_id` | none |
| `vaccine_schedule`, `animal_vaccine_assignments` | `animal_id` | none |
| `vet_certificates` | `animal_id` | none |

All four Herd Medical forms (`HerdMedicalManagement.tsx`) hold a single `animalId` and reject
submission without one. There is no path to record anything against a group.

### 1.2 A group already exists as a first-class, *countable* thing

`animal_groups` carries `current_count` and `target_count`. **A flock can already exist without
one `animals` row per bird.** The primitive we need is present; nothing consumes it for health.

These tables are already group-aware: `treatment_campaigns`, `health_observations`,
`movement_records`, `bookings`, `feed_consumption_logs`, `financial_records`,
`disease_predictions`, `workforce_tasks`, `compliance_documents.group_ids[]`.

### 1.3 The group-level path that exists is disconnected

`treatment_campaigns` (enterprise + `group_id`, types `vaccination`/`deworming`/`treatment`/
`health_check`, with `target_count`/`completed_count`) is surfaced as **Campaigns** in the
farmer's nav. But `TreatmentCampaignService` (171 lines) never writes to `vaccination_records`
or any per-animal table — it only maintains `completed_count`, and there is no participation
table. So:

- a campaign leaves **no health history anywhere** that another screen can read;
- Herd Medical's counters ignore campaign work entirely;
- you cannot later evidence *what* was treated, only how many.

### 1.4 Two gaps that are worse than the reported one

**Certificates.** `vet_certificates.certificate_type` already includes
`herd_health_certificate`, `movement_permit`, `slaughter_fitness`, `export_health_certificate` —
all inherently batch documents — but the table has only `animal_id` and no group reference. The
feature is half-built: the vocabulary exists, the subject it applies to does not.

**Withdrawal periods.** There is **no withdrawal/withholding tracking anywhere in the codebase**
(grep across schema and services returns only wallet withdrawals). The moment a flock or herd is
treated with an antibiotic, milk and meat withdrawal periods are a food-safety and legal
obligation. Batch treatment makes this unavoidable: one entry now affects thousands of animals
entering the food chain. **This is the single most important gap in the plan and should not be
deferred.**

---

## 2. Which animals belong in this category

The instinct to hardcode "poultry" is wrong. Two independent facts decide it, and they must be
modelled separately.

### 2.1 Species categories present in master data

`master_species.category` ∈ `Common Pets`, `Small Pets`, `Birds`, `Reptiles`, `Aquatic`,
`Livestock / Farm`, `Poultry`.

`has_ear_tag` is **already `false`** for Chicken, Duck, Turkey, Quail and **`true`** for all
`Livestock / Farm` species plus Emu/Ostrich/Peacock. That flag is the closest existing signal for
"not individually identified", but it means *tagging*, not *management*, so it should inform the
default rather than be reused.

### 2.2 Batch-managed by default

| Category | Species | Why |
|---|---|---|
| **Poultry** | Chicken, Duck, Turkey, Quail | Housed and treated per shed/batch; never individually named. The reported case. |
| **Poultry (ratite)** | Emu, Ostrich | Batch-reared but individually tagged — **mixed**, default batch, allow individual |
| **Small ruminants** | Sheep, Goat | Flock-treated (drenching, dipping) even where individually tagged — **mixed** |
| **Pigs** | Pig | Pen/batch farrow-to-finish; sows individual, weaners batch — **mixed** |
| **Aquaculture** | Koi, Goldfish, Arowana | Pond/tank population; individual records meaningless at scale |
| **Small pets at scale** | Rabbit | Commercial rabbitry is batch; a pet rabbit is not |

### 2.3 Individual by default

Dog, Cat, Cattle, Buffalo, Horse, Donkey, Camel, Yak, Deer, Llama, Alpaca, and all exotic
pets — high value per head, individually identified, individually treated.

### 2.4 The decisive design point

**Management mode is a property of the GROUP, not the species.** The same farmer may manage 20
goats individually and 5,000 broilers as a batch; a cattle feedlot may batch-treat 800 steers.
Species only supplies the *default*.

```
master_species.default_management_mode  ('individual' | 'batch')   -- suggests
animal_groups.management_mode           ('individual' | 'batch')   -- decides
```

Note this is exactly the `is_marketplace_eligible` pattern already used on `master_species`
(admin-editable, defaults conservative) — consistent with the master-data rule that such choices
are never hardcoded in the frontend.

---

## 3. The model

### 3.1 Principle

> A health event has **one subject**: either an animal *or* a group. Never both, never a fan-out
> into thousands of rows.

Add a nullable `group_id` beside the existing `animal_id` on each health table, with a CHECK that
exactly one is set. This is additive — every existing row and query keeps working.

```sql
ALTER TABLE medical_records     ADD COLUMN group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE vaccination_records ADD COLUMN group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE lab_results         ADD COLUMN group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;
ALTER TABLE vet_certificates    ADD COLUMN group_id UUID REFERENCES animal_groups(id) ON DELETE SET NULL;

-- exactly one subject
ALTER TABLE medical_records ADD CONSTRAINT medical_records_subject_ck
  CHECK ((animal_id IS NOT NULL) <> (group_id IS NOT NULL));
```

`vaccination_records.animal_id` and `allergy_records.animal_id` are **NOT NULL** today and must be
relaxed to make room for a group subject. That is a migration with real risk — see §6.

### 3.2 Batch-specific facts a group record must carry

An individual record answers "what happened to this animal". A batch record must also answer
"how much of the group, and what does that mean downstream":

```
head_count_treated   INTEGER   -- may be < group.current_count (a pen, not the shed)
coverage             TEXT      -- 'whole_group' | 'partial'
affected_count       INTEGER   -- for a disease event: how many showed signs
mortality_count      INTEGER   -- batch health is measured in losses
withdrawal_until_milk DATE     -- see §3.3
withdrawal_until_meat DATE
```

### 3.3 Withdrawal periods — mandatory, not optional

Batch treatment is precisely when this matters. Minimum viable:

- `master_medications` (or the prescription/treatment row) gains `withdrawal_days_milk`,
  `withdrawal_days_meat`.
- On saving a treatment (individual **or** batch), compute and store
  `withdrawal_until_milk/meat = treatment_date + withdrawal_days`.
- Any screen that lists a group shows an active withdrawal banner with the clear date.
- Movement Log and `slaughter_fitness` / `export_health_certificate` issuance must **block or
  hard-warn** while a withdrawal is active. This is the "no logical gap" requirement: a batch
  treatment that does not reach the movement and certificate paths is a food-safety hole.

### 3.4 Campaigns become the execution layer, not a parallel universe

Keep `treatment_campaigns` as the *plan*; make completing one **emit a group-subject record**
(one row, not N). Add `campaign_id` to the health tables so a record traces back to its campaign.
This closes §1.3 without inventing a second concept.

---

## 4. Persona-by-persona and screen-by-screen

Nothing below changes for individually-managed animals; every item is an addition.

### Farmer / enterprise owner
| Screen | Change |
|---|---|
| **Herds & Groups** | Show management mode on the group; let the farmer set it (default from species). Show active withdrawal state. |
| **Herd Medical** | Subject picker becomes **Animal | Group**. For a batch group, the animal list is hidden entirely and the batch fields (§3.2) appear. Counters count both. |
| **Campaigns** | On completion, write the group record. Show the resulting record inline. |
| **Movement Log** | Block/warn on moving a group under withdrawal. |
| **Compliance Docs** | `group_ids[]` already exists — surface group health records as evidence. |
| **Health Analytics** | Batch metrics are rates, not per-animal events: mortality %, morbidity %, treatment incidence per 1,000 birds. A flock of 5,000 must not appear as "1 record". |

### Veterinarian
| Screen | Change |
|---|---|
| **Consultations / Bookings** | `bookings.group_id` already exists; the consultation outcome must be writable as a group record. |
| **Write prescription / treatment** | Prescribing for a batch needs total dose + withdrawal; must not require an animal. |
| **Vet Certificates** | `herd_health_certificate`, `movement_permit`, `slaughter_fitness`, `export_health_certificate` become group-subject documents, printing head count and withdrawal status. |
| **Medical Records list** | Group records appear alongside individual ones, visually distinct. |

### Pet owner
No change. Batch mode is never offered for `Common Pets`/`Small Pets` defaults, and an individual
animal's history is untouched.

### Hospital staff / corporate admin / network
| Screen | Change |
|---|---|
| **Patient lists, workflow queue, inpatient** | A group can be the patient. Queue entries and workflow cases already carry `hospital_id`; they need the same subject rule. |
| **Network patient views** | Enrolment (`animal_care_contexts`) is per-animal; decide whether a group enrols as a unit. **Open question — see §7.** |

### Admin
| Screen | Change |
|---|---|
| **Master data** | Edit `default_management_mode` per species, and withdrawal days per medication. |
| **Medical Record Management / Compliance** | Filter and report by subject type. |

### Cross-cutting screens that will silently under-report if missed
- **Animal Timeline / Life Timeline** — an individual in a batch group should optionally show
  group events that applied to it ("flock vaccinated 12 Mar"). Otherwise a bird's history is empty.
- **Vaccination Passport** — for a batch group, the passport is the *group's*, not the bird's.
- **AI Copilot / disease predictions** — `disease_predictions.group_id` exists; feed it group records.
- **Marketplace** — a listing for batch stock should surface the group's health record, not blank.
- **Dashboard tiles** — "Medical Records: 2" must not ignore group records.

---

## 5. Phasing

*Revised after the owner's answers in §7 — antibiotics are in scope, so withdrawal is no longer
a separate phase.*

**Phase 1 — foundation + the reported gap + withdrawal.** `group_cycles` and
`group_population_events` (§8); `group_id`/`cycle_id` + subject CHECK on the health tables;
relax `vaccination_records`/`allergy_records` NOT NULL; `management_mode` on species and group;
Herd Medical subject picker with batch fields; withdrawal days on medications, computed dates on
save, and the banner. *Delivers: a poultry group can be treated, and the milk/meat withdrawal
that follows is tracked.*

**Phase 2 — the safety interlocks.** Movement Log and `slaughter_fitness` /
`export_health_certificate` blocked or hard-warned while a withdrawal is active. Phase 1 records
the withdrawal; this phase makes it *bite*. Without it the data exists and nothing enforces it.

**Phase 3 — campaign convergence.** Campaign completion emits one group record; `campaign_id` on
health tables; campaigns span multiple groups (§7.1); Herd Medical shows campaign-sourced records.

**Phase 4 — read surfaces.** Timeline roll-up, group vaccination passport, group certificates,
analytics as rates, dashboard counters, marketplace.

**Phase 5 — vet-side authoring and network.** Group consultations and batch prescriptions;
group enrolment in a network with cycle-bound consent (§7.2); herd certificates.
Network-hospital code is change-protected — needs explicit approval before this phase starts.

---

## 6. Risks

- **Relaxing `vaccination_records.animal_id` / `allergy_records.animal_id` NOT NULL.** Any code
  assuming non-null must be audited first. Mitigation: add the CHECK constraint in the same
  migration so "neither set" remains impossible, and run `npm run verify:runtime`.
- **Silent under-reporting.** Every screen in §4 that filters `WHERE animal_id = ...` will simply
  omit group records rather than error. This is the "logical gap" risk: it fails quietly.
  Mitigation: introduce a shared `subjectFilter()` helper and grep for every raw `animal_id =`
  before shipping each phase.
- **Network isolation.** Group records inherit the same tenant rules as animal records; every new
  route must go through `resolveNetworkAccess`. Network-hospital code is change-protected and
  needs explicit approval per its own rule.
- **Count drift.** `animal_groups.current_count` is authoritative for a batch group but has no
  reconciliation today. A record citing 5,000 head against a group whose count later reads 4,200
  needs the head count **stored on the record**, never derived at read time (§3.2).

---

## 7. Owner decisions (answered 2026-08-04)

**1. Both modes, for every species.** A smallholder with 5 goats manages them individually; an
enterprise farm manages the same species as a batch. Mode is therefore never implied by species.
*Accepted — this is what §2.4 already proposed; species supplies only the default.*

**But one group stays single-mode.** A group is either individual or batch, never both. A farm
that needs both keeps two groups ("Breeding Does" individual, "Meat Flock" batch) — which is how
farmers describe it anyway. Mixing inside one group makes every aggregate ambiguous: does
"flock treated, 190 head" include the 10 tagged does, and do they then get counted twice in
mortality and withdrawal? Two consequences follow:

- **Campaigns must span multiple groups.** `treatment_campaigns.group_id` is single today;
  treating the whole farm in one operation needs `group_ids[]` or a campaign→group join.
- **Animals must move between modes.** A promising ram born in a batch becomes individually
  tracked; a tracked animal may be absorbed into a batch. Needs an explicit promote/demote path
  that adjusts both populations in one transaction, never by hand-editing counts.

**2. A batch group can enrol in a network as one patient.** *Accepted, with a blocker.*
`animal_care_contexts.animal_id` is NOT NULL with `UNIQUE(animal_id, network_id)`, so it needs
the same subject treatment as the health tables. Two harder issues:

- **Consent covers a population that changes.** Consent must bind to the group *and* an effective
  window, and be re-confirmed when the population turns over — otherwise a network keeps access
  to a flock the owner never consented for.
- **BLOCKER — there is no production-cycle identity.** `animal_groups` has no cycle, batch or
  placement concept (verified: no such column). Poultry runs in cycles — place 5,000 day-olds,
  clear at ~42 days, place a new flock in the same shed under the same group name. Reusing the
  group row silently attaches the previous flock's health history to a completely different
  population. That is wrong for traceability, and for a network it makes "this patient" mean two
  different things over time. **A cycle concept must land before network enrolment** (§8).

**3. Antibiotics are in scope.** *Phase 1 and Phase 2 therefore merge.* Batch treatment without
withdrawal tracking is a food-safety regression regardless of how much it improves usability.

**4. Mortality decrements `current_count`.** *Accepted, but a bare decrement is not enough.*
Mortality is one of several events that change a population — placement, hatch, mortality, cull,
sale, transfer in/out. If only mortality writes back, the count still drifts and no one can
explain the difference. See §8.

**5. One consultation, one charge.** *Accepted — and it is also the lowest-risk option.* The fee
lives on `vet_profiles.consultation_fee` per consultation, not per animal, so billing a group
once needs **no change to payments, commission, GST or settlement**. Two refinements:

- **Separate the professional fee from products.** A flock visit is one service, but 5,000 doses
  of vaccine is inherently quantity-based. If the platform ever bills medicines, that line is
  per-head even though the consultation is not.
- **Consider a distinct herd/flock visit fee.** A three-hour flock inspection priced identically
  to a fifteen-minute pet consult will not hold. A separate service type keeps one invoice while
  staying fair.

---

## 8. Two additions forced by those answers

### 8.1 Production cycles (`group_cycles`)

A batch group is a *shed*; the population inside it is a *cycle*. Health records, consent and
network enrolment must attach to the cycle, not the shed.

```
group_cycles(id, group_id, cycle_number, started_at, ended_at,
             placed_count, species, breed, status)
```

Health tables carry `cycle_id` alongside `group_id`. Closing a cycle freezes its history; opening
a new one starts clean in the same physical group. Without this, §7.2 has no correct answer.

### 8.2 One population ledger (`group_population_events`)

Every event that changes headcount goes through one table — never a direct `current_count` edit:

```
group_population_events(id, group_id, cycle_id, event_type, quantity, event_date, reason,
                        recorded_by, source_ref)
   event_type ∈ placement | hatch | mortality | cull | sale | transfer_in | transfer_out | adjustment
```

`current_count` is then maintained atomically from the ledger
(`SET current_count = current_count - $1` in the same transaction, with a non-negative CHECK),
and every change is explainable. This is what makes mortality "work well together" with movement,
sales and transfers rather than being a lone special case.

**Head count on a health record is still stored, never derived** (§3.2) — a record citing 5,000
head must keep saying 5,000 after the flock drops to 4,200.

---

## 9. Remaining open question

**Mode transitions.** When an animal is promoted out of a batch (or absorbed into one), what
happens to the health history on each side? Options: (a) the individual inherits nothing and
starts fresh, with the batch history remaining group-level context; (b) group records are copied
down as individual records at promotion time. (a) is far simpler and keeps the "no fan-out" rule
intact; (b) is what a buyer of that single animal would want to see. Needs a decision before
the promote/demote path in §7.1 is built.
