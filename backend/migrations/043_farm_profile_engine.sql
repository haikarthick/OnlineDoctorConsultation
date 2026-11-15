-- Migration 043: farm profile engine + master-data corrections (farm realignment, Phase 1)
--
-- See docs/FARM_MANAGEMENT_PLAN.md (sections 5, 6 and 9). Farmer feedback from Tamil Nadu said
-- the farm module did not fit a farmer's day: wrong breeds, no life-stage group types, and
-- fields that do not apply to the animal in front of them. This migration lays the data
-- foundation for "parent drives children" (owner decision D7): every field, section, daily
-- record and event is switched on or off by DATA (species flags, class flags, group types and
-- record-type rules), never by a species name written in code. An admin-added species therefore
-- works without a deploy.
--
-- Additive and idempotent: it is mirrored verbatim into docker/init.sql (section 61), which is
-- applied first on a fresh install, and then this file runs on top - so every statement must be
-- safe to run twice. Nothing existing is dropped; a retired breed is deactivated, never deleted.
--
-- What lands here:
--   1. master_species capability flags (farm_segment, produces_*, is_aquatic, gestation/incubation
--      days, birth-event word, litter flag, aquatic reference data)
--   2. master_animal_classes: can_lay_eggs, is_juvenile + classes for species that had none
--   3. master_group_types (new): life-stage / purpose group types per species or per farm segment
--   4. master_record_types + master_record_type_rules (new): which daily records and events
--      exist and when they apply
--   5. Breed corrections against the NBAGR registered-breed lists
--   6. Aquaculture species (fish, shrimp, prawn, crab) from official sources
--
-- SOURCES (owner rule: master data from official sources, not general knowledge)
--   Breeds        - ICAR-NBAGR registered breeds, nbagr.res.in/cattle-breed, /buffalo-breed,
--                   /goat-breed, /sheep-breed, /pig (read 2026-11-14 and 2026-11-15)
--   Aquaculture   - TNAU Agritech Portal (agritech.tnau.ac.in/fishery), ICAR-CIBA (ciba.res.in),
--                   MPEDA (mpeda.gov.in/?page_id=638 candidate species, 734 mud crab, 764 GIFT
--                   tilapia, 728 shrimp water-quality table) - read 2026-11-14 and 2026-11-15
--   Gestation     - cattle/horse/pig/sheep/goat/dog/cat/rabbit and chicken incubation are the
--                   values the application already used (BreedingService.estimateGestation),
--                   moved here unchanged. Camel 390 days: FAO document T0690E ch.7. Buffalo 315
--                   days (range 305-330) and donkey 365 days come from secondary summaries
--                   (Vikaspedia breeding-management table; MSD Veterinary Manual) because the
--                   primary pages could not be opened - both are admin-editable in Master Data.
--                   Species with no sourced value are left NULL on purpose (no due date is
--                   suggested rather than a guessed one).
--   Local-language labels in this file were written by the development team and still need a
--   native-speaker review (plan section 10 item 4). Every one is editable in Master Data.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SPECIES CAPABILITY FLAGS
-- ─────────────────────────────────────────────────────────────────────────────

-- farm_segment defaults to 'pet' so a newly admin-added species never silently grows farm
-- sections - the same conservative-default reasoning as is_marketplace_eligible.
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS farm_segment VARCHAR(30) NOT NULL DEFAULT 'pet';
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS produces_milk BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS produces_eggs BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS produces_wool BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS is_aquatic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS litter_expected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS gestation_days INTEGER;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS incubation_days INTEGER;
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS birth_event_term VARCHAR(20) NOT NULL DEFAULT 'birth';
-- Aquatic reference data. water_quality_ranges holds per-species guide ranges so they can be
-- filled in as official sources are confirmed; a species with no range simply shows no
-- "outside the guide range" hint. Ranges are never written in code.
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS scientific_name VARCHAR(150);
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS water_type VARCHAR(20);
ALTER TABLE master_species ADD COLUMN IF NOT EXISTS water_quality_ranges JSONB;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_farm_segment_ck
    CHECK (farm_segment IN ('dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_birth_term_ck
    CHECK (birth_event_term IN ('birth', 'calving', 'kidding', 'lambing', 'farrowing', 'foaling', 'hatching', 'spawning'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_water_type_ck
    CHECK (water_type IS NULL OR water_type IN ('fresh', 'brackish', 'marine'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_species ADD CONSTRAINT master_species_repro_days_ck
    CHECK ((gestation_days IS NULL OR gestation_days > 0) AND (incubation_days IS NULL OR incubation_days > 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill for the species that already exist. Guarded by "still at the column default" so an
-- admin's later edit is never overwritten when this file runs a second time.
UPDATE master_species SET farm_segment = 'dairy'           WHERE code IN ('Cattle', 'Buffalo') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'small_ruminant'  WHERE code IN ('Sheep', 'Goat') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'pig'             WHERE code = 'Pig' AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'poultry'         WHERE code IN ('Chicken', 'Duck', 'Turkey', 'Quail', 'Emu', 'Ostrich', 'Peacock') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'equine'          WHERE code IN ('Horse', 'Donkey') AND farm_segment = 'pet';
UPDATE master_species SET farm_segment = 'other_livestock' WHERE code IN ('Camel', 'Yak', 'Deer', 'Llama', 'Alpaca') AND farm_segment = 'pet';

-- Owner decision D11: milk applies to every animal that produces milk. The species flag says
-- "milk records can exist for this species"; the animal class decides which animals.
UPDATE master_species SET produces_milk = true WHERE code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Yak', 'Horse', 'Donkey') AND produces_milk = false;
UPDATE master_species SET produces_eggs = true WHERE code IN ('Chicken', 'Duck', 'Turkey', 'Quail', 'Emu') AND produces_eggs = false;
UPDATE master_species SET produces_wool = true WHERE code = 'Sheep' AND produces_wool = false;
UPDATE master_species SET litter_expected = true WHERE code IN ('Pig', 'Goat', 'Sheep', 'Dog', 'Cat', 'Rabbit') AND litter_expected = false;

UPDATE master_species SET gestation_days = v.days
  FROM (VALUES ('Cattle', 283), ('Buffalo', 315), ('Horse', 340), ('Donkey', 365), ('Pig', 114), ('Sheep', 148),
               ('Goat', 150), ('Camel', 390), ('Dog', 63), ('Cat', 65), ('Rabbit', 31)) AS v(code, days)
 WHERE master_species.code = v.code AND master_species.gestation_days IS NULL;

UPDATE master_species SET incubation_days = 21 WHERE code = 'Chicken' AND incubation_days IS NULL;

UPDATE master_species SET birth_event_term = v.term
  FROM (VALUES ('Cattle', 'calving'), ('Buffalo', 'calving'), ('Yak', 'calving'), ('Camel', 'calving'),
               ('Goat', 'kidding'), ('Sheep', 'lambing'), ('Pig', 'farrowing'),
               ('Horse', 'foaling'), ('Donkey', 'foaling'),
               ('Chicken', 'hatching'), ('Duck', 'hatching'), ('Turkey', 'hatching'), ('Quail', 'hatching'),
               ('Emu', 'hatching'), ('Ostrich', 'hatching'), ('Peacock', 'hatching')) AS v(code, term)
 WHERE master_species.code = v.code AND master_species.birth_event_term = 'birth';

CREATE INDEX IF NOT EXISTS idx_master_species_farm_segment ON master_species(farm_segment);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ANIMAL CLASSES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE master_animal_classes ADD COLUMN IF NOT EXISTS can_lay_eggs BOOLEAN NOT NULL DEFAULT false;
-- A juvenile is never asked about pregnancy, births or production, whatever its gender.
ALTER TABLE master_animal_classes ADD COLUMN IF NOT EXISTS is_juvenile BOOLEAN NOT NULL DEFAULT false;

UPDATE master_animal_classes SET is_juvenile = true
 WHERE is_juvenile = false
   AND value IN ('cattle_calf', 'cattle_bull_calf', 'cattle_heifer_calf',
                 'buffalo_calf', 'buffalo_bull_calf', 'buffalo_heifer_calf',
                 'sheep_lamb', 'sheep_ram_lamb', 'sheep_ewe_lamb',
                 'goat_kid', 'goat_buckling', 'dog_pup', 'cat_kitten');

-- Classes for the species that had none. Labels live on the row (label + per-locale columns)
-- rather than in the i18n files, so an admin can correct a word without a deploy.
INSERT INTO master_animal_classes
  (species_id, value, label, implied_gender, can_be_pregnant, can_produce_milk, can_lay_eggs, is_juvenile, sort_order,
   label_hi, label_kn, label_ml, label_ta, label_te)
SELECT s.id, v.value, v.label, v.gender, v.preg, v.milk, v.eggs, v.juv, v.sort_order, v.hi, v.kn, v.ml, v.ta, v.te
FROM (VALUES
  ('Pig',     'pig_piglet',      'Piglet',            'unknown', false, false, false, true,  50, 'सूअर का बच्चा', 'ಹಂದಿ ಮರಿ', 'പന്നിക്കുട്ടി', 'பன்றிக் குட்டி', 'పంది పిల్ల'),
  ('Horse',   'horse_stallion',  'Stallion',          'male',    false, false, false, false, 10, 'घोड़ा (नर)', 'ಗಂಡು ಕುದುರೆ', 'ആൺ കുതിര', 'ஆண் குதிரை', 'మగ గుర్రం'),
  ('Horse',   'horse_mare',      'Mare',              'female',  true,  true,  false, false, 20, 'घोड़ी', 'ಹೆಣ್ಣು ಕುದುರೆ', 'പെൺ കുതിര', 'பெண் குதிரை', 'ఆడ గుర్రం'),
  ('Horse',   'horse_gelding',   'Gelding',           'male',    false, false, false, false, 30, 'बधिया घोड़ा', 'ಬೀಜ ಒಡೆದ ಕುದುರೆ', 'വരിയുടച്ച കുതിര', 'காயடித்த குதிரை', 'విత్తులు కొట్టిన గుర్రం'),
  ('Horse',   'horse_colt',      'Colt',              'male',    false, false, false, true,  40, 'बछेड़ा', 'ಗಂಡು ಕುದುರೆ ಮರಿ', 'ആൺ കുതിരക്കുട്ടി', 'ஆண் குதிரைக் குட்டி', 'మగ గుర్రపు పిల్ల'),
  ('Horse',   'horse_filly',     'Filly',             'female',  false, false, false, true,  50, 'बछेड़ी', 'ಹೆಣ್ಣು ಕುದುರೆ ಮರಿ', 'പെൺ കുതിരക്കുട്ടി', 'பெண் குதிரைக் குட்டி', 'ఆడ గుర్రపు పిల్ల'),
  ('Horse',   'horse_foal',      'Foal',              'unknown', false, false, false, true,  60, 'घोड़े का बच्चा', 'ಕುದುರೆ ಮರಿ', 'കുതിരക്കുട്ടി', 'குதிரைக் குட்டி', 'గుర్రపు పిల్ల'),
  ('Donkey',  'donkey_jack',     'Jack',              'male',    false, false, false, false, 10, 'गधा (नर)', 'ಗಂಡು ಕತ್ತೆ', 'ആൺ കഴുത', 'ஆண் கழுதை', 'మగ గాడిద'),
  ('Donkey',  'donkey_jenny',    'Jenny',             'female',  true,  true,  false, false, 20, 'गधी', 'ಹೆಣ್ಣು ಕತ್ತೆ', 'പെൺ കഴുത', 'பெண் கழுதை', 'ఆడ గాడిద'),
  ('Donkey',  'donkey_foal',     'Donkey Foal',       'unknown', false, false, false, true,  30, 'गधे का बच्चा', 'ಕತ್ತೆ ಮರಿ', 'കഴുതക്കുട്ടി', 'கழுதைக் குட்டி', 'గాడిద పిల్ల'),
  ('Camel',   'camel_bull',      'Bull Camel',        'male',    false, false, false, false, 10, 'ऊँट (नर)', 'ಗಂಡು ಒಂಟೆ', 'ആൺ ഒട്ടകം', 'ஆண் ஒட்டகம்', 'మగ ఒంటె'),
  ('Camel',   'camel_cow',       'Cow Camel',         'female',  true,  true,  false, false, 20, 'ऊँटनी', 'ಹೆಣ್ಣು ಒಂಟೆ', 'പെൺ ഒട്ടകം', 'பெண் ஒட்டகம்', 'ఆడ ఒంటె'),
  ('Camel',   'camel_calf',      'Camel Calf',        'unknown', false, false, false, true,  30, 'ऊँट का बच्चा', 'ಒಂಟೆ ಮರಿ', 'ഒട്ടകക്കുട്ടി', 'ஒட்டகக் குட்டி', 'ఒంటె పిల్ల'),
  ('Yak',     'yak_bull',        'Yak Bull',          'male',    false, false, false, false, 10, 'याक (नर)', 'ಗಂಡು ಯಾಕ್', 'ആൺ യാക്ക്', 'ஆண் யாக்', 'మగ యాక్'),
  ('Yak',     'yak_cow',         'Yak Cow',           'female',  true,  true,  false, false, 20, 'मादा याक', 'ಹೆಣ್ಣು ಯಾಕ್', 'പെൺ യാക്ക്', 'பெண் யாக்', 'ఆడ యాక్'),
  ('Yak',     'yak_calf',        'Yak Calf',          'unknown', false, false, false, true,  30, 'याक का बछड़ा', 'ಯಾಕ್ ಕರು', 'യാക്ക് കിടാവ്', 'யாக் கன்று', 'యాక్ దూడ'),
  ('Chicken', 'chicken_cock',    'Cock',              'male',    false, false, false, false, 10, 'मुर्गा', 'ಹುಂಜ', 'പൂവൻകോഴി', 'சேவல்', 'కోడిపుంజు'),
  ('Chicken', 'chicken_hen',     'Hen',               'female',  false, false, true,  false, 20, 'मुर्गी', 'ಹೇಂಟೆ ಕೋಳಿ', 'പിടക്കോഴി', 'பெட்டைக் கோழி', 'కోడిపెట్ట'),
  ('Chicken', 'chicken_pullet',  'Pullet',            'female',  false, false, false, true,  30, 'युवा मुर्गी', 'ಎಳೆಯ ಹೇಂಟೆ', 'ഇളം പിടക്കോഴി', 'இளம் பெட்டைக் கோழி', 'పడుచు కోడిపెట్ట'),
  ('Chicken', 'chicken_cockerel','Cockerel',          'male',    false, false, false, true,  40, 'युवा मुर्गा', 'ಎಳೆಯ ಹುಂಜ', 'ഇളം പൂവൻകോഴി', 'இளம் சேவல்', 'పడుచు కోడిపుంజు'),
  ('Chicken', 'chicken_chick',   'Chick',             'unknown', false, false, false, true,  50, 'चूज़ा', 'ಕೋಳಿ ಮರಿ', 'കോഴിക്കുഞ്ഞ്', 'கோழிக்குஞ்சு', 'కోడిపిల్ల'),
  ('Duck',    'duck_drake',      'Drake',             'male',    false, false, false, false, 10, 'नर बत्तख', 'ಗಂಡು ಬಾತುಕೋಳಿ', 'ആൺ താറാവ്', 'ஆண் வாத்து', 'మగ బాతు'),
  ('Duck',    'duck_hen',        'Duck (female)',     'female',  false, false, true,  false, 20, 'मादा बत्तख', 'ಹೆಣ್ಣು ಬಾತುಕೋಳಿ', 'പെൺ താറാവ്', 'பெண் வாத்து', 'ఆడ బాతు'),
  ('Duck',    'duck_duckling',   'Duckling',          'unknown', false, false, false, true,  30, 'बत्तख का बच्चा', 'ಬಾತುಕೋಳಿ ಮರಿ', 'താറാവിൻകുഞ്ഞ്', 'வாத்துக் குஞ்சு', 'బాతు పిల్ల'),
  ('Turkey',  'turkey_tom',      'Tom',               'male',    false, false, false, false, 10, 'नर टर्की', 'ಗಂಡು ಟರ್ಕಿ ಕೋಳಿ', 'ആൺ ടർക്കി', 'ஆண் வான்கோழி', 'మగ టర్కీ కోడి'),
  ('Turkey',  'turkey_hen',      'Turkey Hen',        'female',  false, false, true,  false, 20, 'मादा टर्की', 'ಹೆಣ್ಣು ಟರ್ಕಿ ಕೋಳಿ', 'പെൺ ടർക്കി', 'பெண் வான்கோழி', 'ఆడ టర్కీ కోడి'),
  ('Turkey',  'turkey_poult',    'Poult',             'unknown', false, false, false, true,  30, 'टर्की का चूज़ा', 'ಟರ್ಕಿ ಕೋಳಿ ಮರಿ', 'ടർക്കിക്കുഞ്ഞ്', 'வான்கோழிக் குஞ்சு', 'టర్కీ కోడి పిల్ల'),
  ('Quail',   'quail_cock',      'Male Quail',        'male',    false, false, false, false, 10, 'नर बटेर', 'ಗಂಡು ಲಾವಕ್ಕಿ', 'ആൺ കാട', 'ஆண் காடை', 'మగ కౌజు పిట్ట'),
  ('Quail',   'quail_hen',       'Female Quail',      'female',  false, false, true,  false, 20, 'मादा बटेर', 'ಹೆಣ್ಣು ಲಾವಕ್ಕಿ', 'പെൺ കാട', 'பெண் காடை', 'ఆడ కౌజు పిట్ట'),
  ('Quail',   'quail_chick',     'Quail Chick',       'unknown', false, false, false, true,  30, 'बटेर का चूज़ा', 'ಲಾವಕ್ಕಿ ಮರಿ', 'കാടക്കുഞ്ഞ്', 'காடைக் குஞ்சு', 'కౌజు పిట్ట పిల్ల')
) AS v(species_code, value, label, gender, preg, milk, eggs, juv, sort_order, hi, kn, ml, ta, te)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. GROUP TYPES
-- ─────────────────────────────────────────────────────────────────────────────
-- A group type is a life stage or a purpose ("Lactating cows", "Layers", "Nursery pond"), not a
-- kind of housing. It belongs EITHER to one species (cattle and goat words differ) OR to a whole
-- farm segment (every pond-raised species shares the same culture stages) - never both.
-- animal_groups.group_type keeps storing the value as plain text, and the old generic values
-- (herd, flock, pen, ...) stay valid, so no existing group breaks.

CREATE TABLE IF NOT EXISTS master_group_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID REFERENCES master_species(id) ON DELETE CASCADE,
  farm_segment VARCHAR(30),
  value VARCHAR(50) NOT NULL,
  label_key VARCHAR(150),
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  -- Mode this group type implies (NULL = no opinion, the species default applies).
  management_mode VARCHAR(20),
  -- Animal class the group usually holds, used to pre-select the class when adding an animal.
  suggested_class VARCHAR(50),
  -- Isolation / quarantine: animals here are being held for health reasons.
  is_health_hold BOOLEAN NOT NULL DEFAULT false,
  -- Whether a group-level milk / egg total can be recorded for this group.
  yields_milk BOOLEAN NOT NULL DEFAULT false,
  yields_eggs BOOLEAN NOT NULL DEFAULT false,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT master_group_types_scope_ck CHECK ((species_id IS NOT NULL) <> (farm_segment IS NOT NULL)),
  CONSTRAINT master_group_types_segment_ck CHECK (farm_segment IS NULL OR farm_segment IN
    ('dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet')),
  CONSTRAINT master_group_types_mode_ck CHECK (management_mode IS NULL OR management_mode IN ('individual', 'batch'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_group_types_species_value
  ON master_group_types(species_id, value) WHERE species_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_group_types_segment_value
  ON master_group_types(farm_segment, value) WHERE farm_segment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_group_types_active ON master_group_types(is_active);

-- Per-species group types (the farmer's own lists; buffalo is the same as cattle incl. bullocks, D14).
INSERT INTO master_group_types
  (species_id, value, label, icon, management_mode, suggested_class, is_health_hold, yields_milk, yields_eggs, sort_order,
   label_hi, label_kn, label_ml, label_ta, label_te)
SELECT s.id, v.value, v.label, v.icon, v.mode, v.suggested_class, v.hold, v.milk, false, v.sort_order, v.hi, v.kn, v.ml, v.ta, v.te
FROM (VALUES
  ('Cattle',  'calf_pen',   'Calf pen',                     '🍼', 'individual', 'cattle_calf',     false, false, 10, 'बछड़ा बाड़ा', 'ಕರುಗಳ ದೊಡ್ಡಿ', 'കിടാക്കളുടെ കൂട്', 'கன்று கொட்டகை', 'దూడల పాక'),
  ('Cattle',  'heifers',    'Heifers',                      '🐄', 'individual', 'cattle_heifer',   false, false, 20, 'बछिया (कलोर)', 'ಕಡಸುಗಳು', 'കിടാരികൾ', 'கிடேரிகள்', 'పెయ్యలు'),
  ('Cattle',  'lactating',  'Lactating cows',               '🥛', 'individual', 'cattle_cow',      false, true,  30, 'दूध देने वाली गायें', 'ಹಾಲು ಕೊಡುವ ಹಸುಗಳು', 'കറവപ്പശുക്കൾ', 'கறவை மாடுகள்', 'పాలిచ్చే ఆవులు'),
  ('Cattle',  'pregnant',   'Pregnant cows',                '🤰', 'individual', 'cattle_cow',      false, false, 40, 'गाभिन गायें', 'ಗಬ್ಬದ ಹಸುಗಳು', 'ചെനയുള്ള പശുക്കൾ', 'சினை மாடுகள்', 'చూడి ఆవులు'),
  ('Cattle',  'dry',        'Dry cows',                     '⏸️', 'individual', 'cattle_cow',      false, false, 50, 'सूखी गायें', 'ಬತ್ತಿದ ಹಸುಗಳು', 'കറവ വറ്റിയ പശുക്കൾ', 'பால் வற்றிய மாடுகள்', 'వట్టిపోయిన ఆవులు'),
  ('Cattle',  'bulls',      'Bulls',                        '🐂', 'individual', 'cattle_bull',     false, false, 60, 'साँड', 'ಹೋರಿಗಳು', 'വിത്തുകാളകൾ', 'பொலி காளைகள்', 'ఆంబోతులు'),
  ('Cattle',  'bullocks',   'Bullocks',                     '🐂', 'individual', 'cattle_bullock',  false, false, 70, 'बैल', 'ಎತ್ತುಗಳು', 'ഉഴവുകാളകൾ', 'எருதுகள்', 'ఎద్దులు'),
  ('Cattle',  'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Cattle',  'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Buffalo', 'calf_pen',   'Calf pen',                     '🍼', 'individual', 'buffalo_calf',    false, false, 10, 'कटड़ा बाड़ा', 'ಕರುಗಳ ದೊಡ್ಡಿ', 'കിടാക്കളുടെ കൂട്', 'கன்று கொட்டகை', 'దూడల పాక'),
  ('Buffalo', 'heifers',    'Heifers',                      '🐃', 'individual', 'buffalo_heifer',  false, false, 20, 'झोटी (पड़िया)', 'ಎಮ್ಮೆ ಕಡಸುಗಳು', 'എരുമക്കിടാരികൾ', 'எருமைக் கிடேரிகள்', 'పడ్డలు'),
  ('Buffalo', 'lactating',  'Lactating buffaloes',          '🥛', 'individual', 'buffalo_cow',     false, true,  30, 'दूध देने वाली भैंसें', 'ಹಾಲು ಕೊಡುವ ಎಮ್ಮೆಗಳು', 'കറവ എരുമകൾ', 'கறவை எருமைகள்', 'పాలిచ్చే గేదెలు'),
  ('Buffalo', 'pregnant',   'Pregnant buffaloes',           '🤰', 'individual', 'buffalo_cow',     false, false, 40, 'गाभिन भैंसें', 'ಗಬ್ಬದ ಎಮ್ಮೆಗಳು', 'ചെനയുള്ള എരുമകൾ', 'சினை எருமைகள்', 'చూడి గేదెలు'),
  ('Buffalo', 'dry',        'Dry buffaloes',                '⏸️', 'individual', 'buffalo_cow',     false, false, 50, 'सूखी भैंसें', 'ಬತ್ತಿದ ಎಮ್ಮೆಗಳು', 'കറവ വറ്റിയ എരുമകൾ', 'பால் வற்றிய எருமைகள்', 'వట్టిపోయిన గేదెలు'),
  ('Buffalo', 'bulls',      'Buffalo bulls',                '🐃', 'individual', 'buffalo_bull',    false, false, 60, 'भैंसा साँड', 'ಕೋಣಗಳು', 'വിത്തുപോത്തുകൾ', 'பொலி எருமைக் கடாக்கள்', 'దున్నపోతులు'),
  ('Buffalo', 'bullocks',   'Buffalo bullocks',             '🐃', 'individual', 'buffalo_bullock', false, false, 70, 'जोतने वाले भैंसे', 'ಉಳುವ ಕೋಣಗಳು', 'ഉഴവുപോത്തുകൾ', 'உழவு எருமைக் கடாக்கள்', 'పని దున్నలు'),
  ('Buffalo', 'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Buffalo', 'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Goat',    'kids',       'Kids',                         '🍼', NULL,         'goat_kid',        false, false, 10, 'मेमने', 'ಮೇಕೆ ಮರಿಗಳು', 'ആട്ടിൻകുട്ടികൾ', 'ஆட்டுக் குட்டிகள்', 'మేక పిల్లలు'),
  ('Goat',    'bucks',      'Bucks',                        '🐐', NULL,         'goat_buck',       false, false, 20, 'बकरे', 'ಹೋತಗಳು', 'മുട്ടനാടുകൾ', 'கிடாக்கள்', 'మేకపోతులు'),
  ('Goat',    'does',       'Does',                         '🐐', NULL,         'goat_doe',        false, true,  30, 'बकरियाँ', 'ಹೆಣ್ಣು ಮೇಕೆಗಳು', 'പെണ്ണാടുകൾ', 'பெட்டை ஆடுகள்', 'ఆడ మేకలు'),
  ('Goat',    'fatteners',  'Fatteners',                    '⚖️', NULL,         NULL,              false, false, 40, 'मांस के लिए पाले जा रहे', 'ಕೊಬ್ಬಿಸುವ ಮೇಕೆಗಳು', 'ഇറച്ചിക്കായി വളർത്തുന്നവ', 'இறைச்சிக்காக வளர்க்கும் ஆடுகள்', 'మాంసం కోసం పెంచే మేకలు'),
  ('Goat',    'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Goat',    'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Sheep',   'lambs',      'Lambs',                        '🍼', NULL,         'sheep_lamb',      false, false, 10, 'मेमने', 'ಕುರಿ ಮರಿಗಳು', 'ചെമ്മരിയാട്ടിൻകുട്ടികൾ', 'செம்மறிக் குட்டிகள்', 'గొర్రె పిల్లలు'),
  ('Sheep',   'rams',       'Rams',                         '🐏', NULL,         'sheep_ram',       false, false, 20, 'मेढ़े', 'ಟಗರುಗಳು', 'മുട്ടൻ ചെമ്മരിയാടുകൾ', 'செம்மறிக் கிடாக்கள்', 'పొట్టేళ్లు'),
  ('Sheep',   'ewes',       'Ewes',                         '🐑', NULL,         'sheep_ewe',       false, true,  30, 'भेड़ें', 'ಹೆಣ್ಣು ಕುರಿಗಳು', 'പെൺ ചെമ്മരിയാടുകൾ', 'பெட்டைச் செம்மறி ஆடுகள்', 'ఆడ గొర్రెలు'),
  ('Sheep',   'fatteners',  'Fatteners',                    '⚖️', NULL,         NULL,              false, false, 40, 'मांस के लिए पाले जा रहे', 'ಕೊಬ್ಬಿಸುವ ಕುರಿಗಳು', 'ഇറച്ചിക്കായി വളർത്തുന്നവ', 'இறைச்சிக்காக வளர்க்கும் செம்மறி ஆடுகள்', 'మాంసం కోసం పెంచే గొర్రెలు'),
  ('Sheep',   'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Sheep',   'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('Pig',     'piglets',    'Piglets',                      '🍼', NULL,         'pig_piglet',      false, false, 10, 'सूअर के बच्चे', 'ಹಂದಿ ಮರಿಗಳು', 'പന്നിക്കുട്ടികൾ', 'பன்றிக் குட்டிகள்', 'పంది పిల్లలు'),
  ('Pig',     'boars',      'Boars',                        '🐗', 'individual', 'pig_boar',        false, false, 20, 'नर सूअर', 'ಗಂಡು ಹಂದಿಗಳು', 'ആൺപന്നികൾ', 'ஆண் பன்றிகள்', 'మగ పందులు'),
  ('Pig',     'sows',       'Sows',                         '🐖', 'individual', 'pig_sow',         false, false, 30, 'मादा सूअर', 'ತಾಯಿ ಹಂದಿಗಳು', 'തള്ളപ്പന്നികൾ', 'தாய்ப் பன்றிகள்', 'తల్లి పందులు'),
  ('Pig',     'gilts',      'Gilts',                        '🐖', 'individual', 'pig_gilt',        false, false, 40, 'युवा मादा सूअर', 'ಎಳೆಯ ಹೆಣ್ಣು ಹಂದಿಗಳು', 'ഇളം പെൺപന്നികൾ', 'இளம் பெண் பன்றிகள்', 'పడుచు ఆడ పందులు'),
  ('Pig',     'fatteners',  'Fatteners',                    '⚖️', 'batch',      NULL,              false, false, 50, 'मांस के लिए पाले जा रहे', 'ಕೊಬ್ಬಿಸುವ ಹಂದಿಗಳು', 'ഇറച്ചിക്കായി വളർത്തുന്നവ', 'இறைச்சிக்காக வளர்க்கும் பன்றிகள்', 'మాంసం కోసం పెంచే పందులు'),
  ('Pig',     'isolation',  'Isolation pen (sick animals)', '🩺', NULL,         NULL,              true,  false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('Pig',     'quarantine', 'Quarantine shed',              '🚧', NULL,         NULL,              true,  false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్')
) AS v(species_code, value, label, icon, mode, suggested_class, hold, milk, sort_order, hi, kn, ml, ta, te)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, value) WHERE species_id IS NOT NULL DO NOTHING;

-- Per-segment group types (shared by every species of the segment).
-- Aquaculture stages are named as the sources name them: TNAU's three-tier carp system
-- (nursery -> rearing -> stocking/grow-out pond), brood stock pond, breeding and cement tanks
-- (TNAU murrel page); cage, hapa, recirculatory system (ICAR-CIBA).
INSERT INTO master_group_types
  (farm_segment, value, label, icon, management_mode, is_health_hold, yields_milk, yields_eggs, sort_order,
   label_hi, label_kn, label_ml, label_ta, label_te)
VALUES
  ('poultry', 'broilers',        'Broilers',                 '🍗', 'batch', false, false, false, 10, 'ब्रॉयलर (मांस की मुर्गी)', 'ಬ್ರಾಯ್ಲರ್ (ಮಾಂಸದ ಕೋಳಿ)', 'ബ്രോയിലർ (ഇറച്ചിക്കോഴി)', 'கறிக்கோழி (பிராய்லர்)', 'బ్రాయిలర్ (మాంసం కోళ్లు)'),
  ('poultry', 'layers',          'Layers',                   '🥚', 'batch', false, false, true,  20, 'लेयर (अंडे देने वाली)', 'ಲೇಯರ್ (ಮೊಟ್ಟೆ ಕೋಳಿ)', 'ലെയർ (മുട്ടക്കോഴി)', 'முட்டைக்கோழி (லேயர்)', 'లేయర్ (గుడ్ల కోళ్లు)'),
  ('poultry', 'breeders',        'Breeders',                 '🐓', 'batch', false, false, true,  30, 'ब्रीडर (प्रजनन झुंड)', 'ಬ್ರೀಡರ್ (ತಳಿ ಕೋಳಿ)', 'ബ്രീഡർ (പ്രജനന കൂട്ടം)', 'இனப்பெருக்கக் கோழிகள்', 'బ్రీడర్ (సంతానోత్పత్తి కోళ్లు)'),
  ('poultry', 'chicks_brooding', 'Chicks (brooding)',        '🐥', 'batch', false, false, false, 40, 'चूज़े (ब्रूडिंग)', 'ಮರಿಗಳು (ಬ್ರೂಡಿಂಗ್)', 'കുഞ്ഞുങ്ങൾ (ബ്രൂഡിംഗ്)', 'குஞ்சுகள் (அடைகாப்பு)', 'పిల్లలు (బ్రూడింగ్)'),
  ('poultry', 'growers',         'Growers',                  '🐔', 'batch', false, false, false, 50, 'ग्रोअर (बढ़ते पक्षी)', 'ಗ್ರೋವರ್ (ಬೆಳೆಯುವ ಕೋಳಿ)', 'ഗ്രോവർ (വളരുന്നവ)', 'வளரும் கோழிகள்', 'గ్రోవర్ (పెరుగుతున్న కోళ్లు)'),
  ('poultry', 'backyard_flock',  'Backyard flock',           '🏡', NULL,    false, false, true,  60, 'घर-आँगन का झुंड', 'ಹಿತ್ತಲ ಕೋಳಿಗಳು', 'വീട്ടുവളപ്പിലെ കോഴികൾ', 'புறக்கடைக் கோழிகள்', 'పెరటి కోళ్లు'),
  ('poultry', 'isolation',       'Isolation pen (sick birds)', '🩺', NULL,  true,  false, false, 80, 'बीमार पक्षी बाड़ा', 'ರೋಗಿ ಪಕ್ಷಿಗಳ ಪ್ರತ್ಯೇಕ ಗೂಡು', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற பறவைகள் தனிக் கூண்டு', 'జబ్బు పక్షుల ప్రత్యేక గూడు'),
  ('poultry', 'quarantine',      'Quarantine shed',          '🚧', NULL,    true,  false, false, 90, 'क्वारंटीन शेड (नए पक्षी)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('aquaculture', 'nursery_pond',         'Nursery pond',              '🌱', 'batch', false, false, false, 10, 'नर्सरी तालाब', 'ನರ್ಸರಿ ಕೊಳ', 'നഴ്സറി കുളം', 'நாற்றங்கால் குளம்', 'నర్సరీ చెరువు'),
  ('aquaculture', 'rearing_pond',         'Rearing pond',              '🐟', 'batch', false, false, false, 20, 'पालन तालाब', 'ಪಾಲನಾ ಕೊಳ', 'വളർത്തു കുളം', 'வளர்ப்புக் குளம்', 'పెంపకం చెరువు'),
  ('aquaculture', 'grow_out_pond',        'Grow-out (stocking) pond',  '🌊', 'batch', false, false, false, 30, 'संचयन (ग्रो-आउट) तालाब', 'ಬೆಳವಣಿಗೆ (ಗ್ರೋ-ಔಟ್) ಕೊಳ', 'ഗ്രോ-ഔട്ട് കുളം', 'இருப்புக் குளம் (வளர்ச்சிக் குளம்)', 'గ్రో-అవుట్ చెరువు'),
  ('aquaculture', 'broodstock_pond',      'Brood stock pond',          '🐠', 'batch', false, false, false, 40, 'प्रजनक मछली तालाब', 'ತಾಯಿ ಮೀನು ಕೊಳ', 'തള്ളമത്സ്യ കുളം', 'தாய் மீன் குளம்', 'తల్లి చేపల చెరువు'),
  ('aquaculture', 'breeding_tank',        'Breeding tank',             '🫧', 'batch', false, false, false, 50, 'प्रजनन टैंक', 'ಸಂತಾನೋತ್ಪತ್ತಿ ತೊಟ್ಟಿ', 'പ്രജനന ടാങ്ക്', 'இனப்பெருக்கத் தொட்டி', 'సంతానోత్పత్తి ట్యాంక్'),
  ('aquaculture', 'cement_tank',          'Cement tank',               '🧱', 'batch', false, false, false, 60, 'सीमेंट टैंक', 'ಸಿಮೆಂಟ್ ತೊಟ್ಟಿ', 'സിമന്റ് ടാങ്ക്', 'சிமெண்ட் தொட்டி', 'సిమెంట్ ట్యాంక్'),
  ('aquaculture', 'cage',                 'Cage',                      '🔲', 'batch', false, false, false, 70, 'पिंजरा (केज)', 'ಪಂಜರ (ಕೇಜ್)', 'കൂട് (കേജ്)', 'கூண்டு', 'పంజరం (కేజ్)'),
  ('aquaculture', 'hapa',                 'Hapa',                      '🕸️', 'batch', false, false, false, 80, 'हापा', 'ಹಾಪಾ', 'ഹാപ്പ', 'ஹாப்பா', 'హాపా'),
  ('aquaculture', 'recirculatory_system', 'Recirculatory system (RAS)', '🔄', 'batch', false, false, false, 90, 'पुनर्चक्रण प्रणाली (RAS)', 'ಮರುಪರಿಚಲನೆ ವ್ಯವಸ್ಥೆ (RAS)', 'പുനഃചംക്രമണ സംവിധാനം (RAS)', 'மறுசுழற்சி நீர் அமைப்பு (RAS)', 'పునఃప్రసరణ వ్యవస్థ (RAS)'),
  ('aquaculture', 'quarantine_tank',      'Quarantine tank',           '🚧', 'batch', true,  false, false, 100, 'क्वारंटीन टैंक', 'ಕ್ವಾರಂಟೈನ್ ತೊಟ್ಟಿ', 'ക്വാറന്റൈൻ ടാങ്ക്', 'தனிமைப்படுத்தும் தொட்டி', 'క్వారంటైన్ ట్యాంక్'),
  ('equine', 'breeding_males',   'Breeding males',            '🐴', 'individual', false, false, false, 10, 'प्रजनन नर', 'ತಳಿ ಗಂಡುಗಳು', 'പ്രജനന ആൺമൃഗങ്ങൾ', 'இனப்பெருக்க ஆண்கள்', 'సంతానోత్పత్తి మగవి'),
  ('equine', 'breeding_females', 'Breeding females',          '🐴', 'individual', false, true,  false, 20, 'प्रजनन मादा', 'ತಳಿ ಹೆಣ್ಣುಗಳು', 'പ്രജനന പെൺമൃഗങ്ങൾ', 'இனப்பெருக்கப் பெண்கள்', 'సంతానోత్పత్తి ఆడవి'),
  ('equine', 'young_stock',      'Young stock',               '🍼', 'individual', false, false, false, 30, 'छोटे पशु', 'ಎಳೆಯ ಪ್ರಾಣಿಗಳು', 'ഇളം മൃഗങ്ങൾ', 'இளம் கால்நடைகள்', 'పిల్ల పశువులు'),
  ('equine', 'working_animals',  'Working animals',           '🛒', 'individual', false, false, false, 40, 'काम करने वाले पशु', 'ದುಡಿಯುವ ಪ್ರಾಣಿಗಳು', 'പണിമൃഗങ്ങൾ', 'வேலை கால்நடைகள்', 'పని పశువులు'),
  ('equine', 'isolation',        'Isolation pen (sick animals)', '🩺', NULL,      true,  false, false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('equine', 'quarantine',       'Quarantine shed',           '🚧', NULL,         true,  false, false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్'),
  ('other_livestock', 'breeding_males',   'Breeding males',   '🐪', 'individual', false, false, false, 10, 'प्रजनन नर', 'ತಳಿ ಗಂಡುಗಳು', 'പ്രജനന ആൺമൃഗങ്ങൾ', 'இனப்பெருக்க ஆண்கள்', 'సంతానోత్పత్తి మగవి'),
  ('other_livestock', 'breeding_females', 'Breeding females', '🐪', 'individual', false, true,  false, 20, 'प्रजनन मादा', 'ತಳಿ ಹೆಣ್ಣುಗಳು', 'പ്രജനന പെൺമൃഗങ്ങൾ', 'இனப்பெருக்கப் பெண்கள்', 'సంతానోత్పత్తి ఆడవి'),
  ('other_livestock', 'young_stock',      'Young stock',      '🍼', 'individual', false, false, false, 30, 'छोटे पशु', 'ಎಳೆಯ ಪ್ರಾಣಿಗಳು', 'ഇളം മൃഗങ്ങൾ', 'இளம் கால்நடைகள்', 'పిల్ల పశువులు'),
  ('other_livestock', 'working_animals',  'Working animals',  '🛒', 'individual', false, false, false, 40, 'काम करने वाले पशु', 'ದುಡಿಯುವ ಪ್ರಾಣಿಗಳು', 'പണിമൃഗങ്ങൾ', 'வேலை கால்நடைகள்', 'పని పశువులు'),
  ('other_livestock', 'isolation',        'Isolation pen (sick animals)', '🩺', NULL, true, false, false, 80, 'बीमार पशु बाड़ा', 'ರೋಗಿ ಪ್ರಾಣಿಗಳ ಪ್ರತ್ಯೇಕ ದೊಡ್ಡಿ', 'രോഗമുള്ളവയ്ക്കുള്ള പ്രത്യേക കൂട്', 'நோயுற்ற கால்நடை தனிக் கொட்டகை', 'జబ్బు పశువుల ప్రత్యేక పాక'),
  ('other_livestock', 'quarantine',       'Quarantine shed',  '🚧', NULL,         true,  false, false, 90, 'क्वारंटीन शेड (नए पशु)', 'ಕ್ವಾರಂಟೈನ್ ಶೆಡ್', 'ക്വാറന്റൈൻ ഷെഡ്', 'தனிமைப்படுத்தும் கொட்டகை', 'క్వారంటైన్ షెడ్')
ON CONFLICT (farm_segment, value) WHERE farm_segment IS NOT NULL DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RECORD TYPES AND THEIR RULES
-- ─────────────────────────────────────────────────────────────────────────────
-- A record type is something the farmer writes down: a DAILY record (milk, eggs, feed, deaths,
-- water quality) or an EVENT (heat, mating, birth, stocking, harvest, sale ...). The rules say
-- when it applies. A record type applies when ANY of its rules matches; a rule matches when
-- every condition it states holds (NULL = "any"). The 'pet' segment gets no farm record types
-- unless a rule names it. The application code that captures a record keys off `code`, so codes
-- are protected - labels, icons, order and rules are what an admin tunes.

CREATE TABLE IF NOT EXISTS master_record_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  kind VARCHAR(10) NOT NULL,
  subject VARCHAR(10) NOT NULL DEFAULT 'either',
  label_key VARCHAR(150),
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  unit VARCHAR(20),
  -- The fields the entry form captures, e.g. [{"key":"quantity","type":"number","required":true}].
  fields JSONB NOT NULL DEFAULT '[]',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_protected BOOLEAN NOT NULL DEFAULT true,
  label_hi VARCHAR(150),
  label_kn VARCHAR(150),
  label_ml VARCHAR(150),
  label_ta VARCHAR(150),
  label_te VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT master_record_types_kind_ck CHECK (kind IN ('daily', 'event')),
  CONSTRAINT master_record_types_subject_ck CHECK (subject IN ('animal', 'group', 'either'))
);

CREATE TABLE IF NOT EXISTS master_record_type_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type_id UUID NOT NULL REFERENCES master_record_types(id) ON DELETE CASCADE,
  -- Stable name for the rule so the seed below is idempotent and a rule can be found again.
  rule_key VARCHAR(60) NOT NULL,
  farm_segment VARCHAR(30),
  management_mode VARCHAR(20),
  -- Species capability the record needs (produces_milk / produces_eggs / produces_wool).
  requires_species_flag VARCHAR(30),
  -- NULL = any; true = aquatic species only; false = non-aquatic only.
  aquatic BOOLEAN,
  -- Class capability the ANIMAL needs when the subject is one animal.
  requires_class_flag VARCHAR(30),
  -- Group-type capability the GROUP needs when the subject is a whole group.
  requires_group_flag VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (record_type_id, rule_key),
  CONSTRAINT master_record_rules_segment_ck CHECK (farm_segment IS NULL OR farm_segment IN
    ('dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet')),
  CONSTRAINT master_record_rules_mode_ck CHECK (management_mode IS NULL OR management_mode IN ('individual', 'batch')),
  CONSTRAINT master_record_rules_species_flag_ck CHECK (requires_species_flag IS NULL OR requires_species_flag IN
    ('produces_milk', 'produces_eggs', 'produces_wool')),
  CONSTRAINT master_record_rules_class_flag_ck CHECK (requires_class_flag IS NULL OR requires_class_flag IN
    ('can_produce_milk', 'can_be_pregnant', 'can_lay_eggs')),
  CONSTRAINT master_record_rules_group_flag_ck CHECK (requires_group_flag IS NULL OR requires_group_flag IN
    ('yields_milk', 'yields_eggs'))
);

CREATE INDEX IF NOT EXISTS idx_master_record_type_rules_type ON master_record_type_rules(record_type_id);
CREATE INDEX IF NOT EXISTS idx_master_record_types_active ON master_record_types(is_active);

INSERT INTO master_record_types
  (code, kind, subject, label, icon, unit, fields, sort_order, label_hi, label_kn, label_ml, label_ta, label_te)
VALUES
  ('milk',            'daily', 'either', 'Milk',                    '🥛', 'L',  '[{"key":"session","type":"choice","options":["am","pm"],"required":true},{"key":"quantity","type":"number","required":true}]', 10, 'दूध', 'ಹಾಲು', 'പാൽ', 'பால்', 'పాలు'),
  ('eggs',            'daily', 'either', 'Eggs',                    '🥚', 'eggs', '[{"key":"quantity","type":"number","required":true},{"key":"broken","type":"number"}]', 20, 'अंडे', 'ಮೊಟ್ಟೆ', 'മുട്ട', 'முட்டை', 'గుడ్లు'),
  ('feed',            'daily', 'either', 'Feed',                    '🌾', 'kg', '[{"key":"quantity","type":"number","required":true},{"key":"feedItem","type":"picker"}]', 30, 'चारा / दाना', 'ಮೇವು', 'തീറ്റ', 'தீவனம்', 'మేత'),
  ('mortality',       'daily', 'group',  'Deaths',                  '📉', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"cause","type":"text"}]', 40, 'मृत्यु', 'ಸಾವು', 'ചത്തവ', 'இறப்பு', 'మరణాలు'),
  ('sample_weight',   'daily', 'group',  'Sample weight',           '⚖️', 'g',  '[{"key":"sampleCount","type":"number"},{"key":"averageWeight","type":"number","required":true}]', 50, 'नमूना वज़न', 'ಮಾದರಿ ತೂಕ', 'സാമ്പിൾ തൂക്കം', 'மாதிரி எடை', 'నమూనా బరువు'),
  ('water_quality',   'daily', 'group',  'Water quality',           '💧', NULL, '[{"key":"temperatureC","type":"number"},{"key":"ph","type":"number"},{"key":"dissolvedOxygenPpm","type":"number"},{"key":"salinityPpt","type":"number"},{"key":"transparencyCm","type":"number"},{"key":"ammoniaPpm","type":"number"}]', 60, 'पानी की गुणवत्ता', 'ನೀರಿನ ಗುಣಮಟ್ಟ', 'ജലഗുണനിലവാരം', 'நீரின் தரம்', 'నీటి నాణ్యత'),
  ('weight',          'event', 'animal', 'Weight',                  '⚖️', 'kg', '[{"key":"weight","type":"number","required":true}]', 100, 'वज़न', 'ತೂಕ', 'തൂക്കം', 'எடை', 'బరువు'),
  ('heat',            'event', 'animal', 'Heat seen',               '🔥', NULL, '[]', 110, 'गर्मी (हीट) में', 'ಬೆದೆ', 'മദി', 'சினைப் பருவம்', 'ఎద'),
  ('insemination',    'event', 'animal', 'Mating / AI',             '🧬', NULL, '[{"key":"method","type":"choice","options":["natural","artificial_insemination"],"required":true},{"key":"sire","type":"picker"}]', 120, 'गर्भाधान (प्राकृतिक / कृत्रिम)', 'ಗರ್ಭಧಾರಣೆ (ಸಹಜ / ಕೃತಕ)', 'ബീജാധാനം (സ്വാഭാവികം / കൃത്രിമം)', 'இனச்சேர்க்கை / செயற்கை கருவூட்டல்', 'సంపర్కం / కృత్రిమ గర్భధారణ'),
  ('pregnancy_check', 'event', 'animal', 'Pregnancy check',         '🩺', NULL, '[{"key":"result","type":"choice","options":["pregnant","not_pregnant"],"required":true}]', 130, 'गर्भ जाँच', 'ಗರ್ಭ ಪರೀಕ್ಷೆ', 'ഗർഭ പരിശോധന', 'சினைப் பரிசோதனை', 'చూడి పరీక్ష'),
  ('dry_off',         'event', 'animal', 'Dry-off',                 '⏸️', NULL, '[]', 140, 'दूध सुखाना', 'ಹಾಲು ಬತ್ತಿಸುವುದು', 'കറവ വറ്റിക്കൽ', 'பால் வற்ற வைத்தல்', 'పాలు ఆపడం'),
  ('birth',           'event', 'animal', 'Birth',                   '🍼', NULL, '[{"key":"liveBirths","type":"number","required":true},{"key":"stillbirths","type":"number"}]', 150, 'जन्म (ब्याना)', 'ಜನನ (ಈಯುವಿಕೆ)', 'പ്രസവം', 'ஈனுதல் (பிறப்பு)', 'ఈనడం (జననం)'),
  ('weaning',         'event', 'either', 'Weaning',                 '🌱', NULL, '[{"key":"count","type":"number"}]', 160, 'दूध छुड़ाना', 'ಹಾಲು ಬಿಡಿಸುವುದು', 'പാൽകുടി മാറ്റൽ', 'பால் மறக்கடித்தல்', 'పాలు మాన్పించడం'),
  ('shearing',        'event', 'either', 'Shearing',                '✂️', 'kg', '[{"key":"quantity","type":"number"}]', 170, 'ऊन कतरना', 'ಉಣ್ಣೆ ಕತ್ತರಿಸುವುದು', 'രോമം വെട്ടൽ', 'உரோமம் கத்தரித்தல்', 'ఉన్ని కత్తిరింపు'),
  ('placement',       'event', 'group',  'Place new batch',         '📥', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"source","type":"text"}]', 200, 'नया बैच डालना', 'ಹೊಸ ಬ್ಯಾಚ್ ಬಿಡುವುದು', 'പുതിയ ബാച്ച് ഇറക്കൽ', 'புதிய தொகுதி விடுதல்', 'కొత్త బ్యాచ్ వేయడం'),
  ('stocking',        'event', 'group',  'Stocking',                '📥', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"seedSource","type":"text"}]', 210, 'बीज संचयन', 'ಮರಿ ಬಿತ್ತನೆ', 'കുഞ്ഞുങ്ങളെ നിക്ഷേപിക്കൽ', 'குஞ்சு இருப்பு செய்தல்', 'పిల్లల స్టాకింగ్'),
  ('cull',            'event', 'group',  'Cull',                    '➖', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"reason","type":"text"}]', 220, 'छँटनी', 'ಆಯ್ದು ತೆಗೆಯುವುದು', 'ഒഴിവാക്കൽ', 'கழித்தல்', 'ఏరివేత'),
  ('partial_sale',    'event', 'group',  'Partial sale',            '🛒', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 230, 'आंशिक बिक्री', 'ಭಾಗಶಃ ಮಾರಾಟ', 'ഭാഗിക വിൽപ്പന', 'பகுதி விற்பனை', 'పాక్షిక అమ్మకం'),
  ('clear_out',       'event', 'group',  'Clear-out (close cycle)', '🏁', 'head', '[{"key":"quantity","type":"number","required":true},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 240, 'पूरा बैच निकालना', 'ಬ್ಯಾಚ್ ಖಾಲಿ ಮಾಡುವುದು', 'ബാച്ച് ഒഴിപ്പിക്കൽ', 'தொகுதி முழு விற்பனை (சுழற்சி முடிவு)', 'బ్యాచ్ ఖాళీ చేయడం'),
  ('water_exchange',  'event', 'group',  'Water exchange',          '🔄', '%',  '[{"key":"percent","type":"number"}]', 250, 'पानी बदलना', 'ನೀರು ಬದಲಾವಣೆ', 'വെള്ളം മാറ്റൽ', 'நீர் மாற்றம்', 'నీటి మార్పిడి'),
  ('partial_harvest', 'event', 'group',  'Partial harvest',         '🎣', 'kg', '[{"key":"quantity","type":"number","required":true},{"key":"count","type":"number"},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 260, 'आंशिक निकासी', 'ಭಾಗಶಃ ಕೊಯ್ಲು', 'ഭാഗിക വിളവെടുപ്പ്', 'பகுதி அறுவடை', 'పాక్షిక పట్టుబడి'),
  ('harvest',         'event', 'group',  'Harvest (close crop)',    '🎣', 'kg', '[{"key":"quantity","type":"number","required":true},{"key":"count","type":"number"},{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 270, 'निकासी (फसल समाप्त)', 'ಕೊಯ್ಲು', 'വിളവെടുപ്പ്', 'அறுவடை', 'పట్టుబడి'),
  ('treatment',       'event', 'either', 'Treatment',               '💊', NULL, '[]', 300, 'इलाज', 'ಚಿಕಿತ್ಸೆ', 'ചികിത്സ', 'சிகிச்சை', 'చికిత్స'),
  ('vaccination',     'event', 'either', 'Vaccination',             '💉', NULL, '[]', 310, 'टीकाकरण', 'ಲಸಿಕೆ', 'വാക്സിനേഷൻ', 'தடுப்பூசி', 'టీకా'),
  ('purchase',        'event', 'either', 'Purchase',                '🧾', NULL, '[{"key":"quantity","type":"number"},{"key":"amount","type":"number"},{"key":"seller","type":"text"}]', 320, 'खरीद', 'ಖರೀದಿ', 'വാങ്ങൽ', 'கொள்முதல்', 'కొనుగోలు'),
  ('sale',            'event', 'animal', 'Sale',                    '💰', NULL, '[{"key":"amount","type":"number"},{"key":"buyer","type":"text"}]', 330, 'बिक्री', 'ಮಾರಾಟ', 'വിൽപ്പന', 'விற்பனை', 'అమ్మకం'),
  ('death',           'event', 'animal', 'Death',                   '⚠️', NULL, '[{"key":"cause","type":"text"}]', 340, 'मृत्यु', 'ಸಾವು', 'മരണം', 'இறப்பு', 'మరణం')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_record_type_rules
  (record_type_id, rule_key, farm_segment, management_mode, requires_species_flag, aquatic, requires_class_flag, requires_group_flag)
SELECT rt.id, v.rule_key, v.segment, v.mode, v.species_flag, v.aquatic, v.class_flag, v.group_flag
FROM (VALUES
  -- Milk and eggs: any species that produces them; the animal's class or the group type decides.
  ('milk',            'milk_producers',     NULL::text,     NULL::text,   'produces_milk'::text, NULL::boolean, 'can_produce_milk'::text, 'yields_milk'::text),
  ('eggs',            'egg_producers',      NULL,           NULL,         'produces_eggs',       NULL,          'can_lay_eggs',           'yields_eggs'),
  ('feed',            'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('mortality',       'batch_stock',        NULL,           'batch',      NULL,                  NULL,          NULL,                     NULL),
  ('sample_weight',   'batch_stock',        NULL,           'batch',      NULL,                  NULL,          NULL,                     NULL),
  ('water_quality',   'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('weight',          'individual_stock',   NULL,           'individual', NULL,                  false,         NULL,                     NULL),
  ('heat',            'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('insemination',    'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('pregnancy_check', 'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('birth',           'breeding_females',   NULL,           'individual', NULL,                  false,         'can_be_pregnant',        NULL),
  ('dry_off',         'milking_females',    NULL,           'individual', 'produces_milk',       false,         'can_produce_milk',       NULL),
  ('weaning',         'dairy',              'dairy',        NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'small_ruminant',     'small_ruminant', NULL,       NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'pig',                'pig',          NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'equine',             'equine',       NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('weaning',         'other_livestock',    'other_livestock', NULL,      NULL,                  NULL,          NULL,                     NULL),
  ('shearing',        'wool_producers',     NULL,           NULL,         'produces_wool',       NULL,          NULL,                     NULL),
  ('placement',       'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('cull',            'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('partial_sale',    'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('clear_out',       'land_batch',         NULL,           'batch',      NULL,                  false,         NULL,                     NULL),
  ('stocking',        'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('water_exchange',  'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('partial_harvest', 'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('harvest',         'aquatic',            NULL,           NULL,         NULL,                  true,          NULL,                     NULL),
  ('treatment',       'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('vaccination',     'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('purchase',        'all_farm_stock',     NULL,           NULL,         NULL,                  NULL,          NULL,                     NULL),
  ('sale',            'individual_stock',   NULL,           'individual', NULL,                  false,         NULL,                     NULL),
  ('death',           'individual_stock',   NULL,           'individual', NULL,                  false,         NULL,                     NULL)
) AS v(code, rule_key, segment, mode, species_flag, aquatic, class_flag, group_flag)
JOIN master_record_types rt ON rt.code = v.code
ON CONFLICT (record_type_id, rule_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BREED CORRECTIONS (NBAGR)
-- ─────────────────────────────────────────────────────────────────────────────
-- animals.breed, animal_groups.breed, group_cycles.breed and marketplace_listings.breed are
-- plain text, not foreign keys. A rename that only touched master_breeds would leave every
-- existing row holding the old word, silently orphaned from the picker - so a rename moves the
-- text on every referencing table in the same transaction.

CREATE OR REPLACE FUNCTION pg_temp.farm043_rename_breed(p_species TEXT, p_old TEXT, p_new TEXT) RETURNS void AS $fn$
DECLARE
  v_species_id UUID;
BEGIN
  SELECT id INTO v_species_id FROM master_species WHERE code = p_species;
  IF v_species_id IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM master_breeds WHERE species_id = v_species_id AND name = p_new) THEN
    -- The new name is already there (fresh install, or this file ran before): drop the old row.
    DELETE FROM master_breeds WHERE species_id = v_species_id AND name = p_old;
  ELSE
    UPDATE master_breeds SET name = p_new, updated_at = NOW() WHERE species_id = v_species_id AND name = p_old;
  END IF;

  UPDATE animals              SET breed = p_new WHERE species = p_species AND breed = p_old;
  UPDATE animal_groups        SET breed = p_new WHERE species = p_species AND breed = p_old;
  UPDATE group_cycles         SET breed = p_new WHERE species = p_species AND breed = p_old;
  UPDATE marketplace_listings SET breed = p_new WHERE species = p_species AND breed = p_old;
END;
$fn$ LANGUAGE plpgsql;

-- "Cross Breed" replaces "Mixed Breed" / "Mixed" for livestock only (pets keep "Mixed Breed").
SELECT pg_temp.farm043_rename_breed('Cattle',  'Mixed Breed', 'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Buffalo', 'Mixed',       'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Goat',    'Mixed Breed', 'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Sheep',   'Mixed Breed', 'Cross Breed');
SELECT pg_temp.farm043_rename_breed('Pig',     'Mixed Breed', 'Cross Breed');
-- NBAGR spellings.
SELECT pg_temp.farm043_rename_breed('Goat',    'Kanniadu',    'Kanni Adu');
SELECT pg_temp.farm043_rename_breed('Pig',     'Ghungroo',    'Ghoongroo');

DROP FUNCTION pg_temp.farm043_rename_breed(TEXT, TEXT, TEXT);

-- Simmental is on no NBAGR page and the farmer confirmed it is not kept in India. Retired, not
-- deleted: an existing animal may still carry the name.
UPDATE master_breeds SET is_active = false, updated_at = NOW()
 WHERE name = 'Simmental' AND is_active = true
   AND species_id = (SELECT id FROM master_species WHERE code = 'Cattle');

INSERT INTO master_breeds (species_id, name, sort_order, is_active)
SELECT s.id, v.name, v.sort_order, true
FROM (VALUES
  -- Cattle: the two Tamil Nadu breeds that were missing, and the named crosses farmers keep.
  ('Cattle',  'Bargur',             92),
  ('Cattle',  'Pulikulam',          102),
  ('Cattle',  'HF Cross',           162),
  ('Cattle',  'Jersey Cross',       172),
  ('Cattle',  'Cross Breed',        200),
  ('Buffalo', 'Bargur',             92),
  ('Buffalo', 'Cross Breed',        100),
  ('Goat',    'Kanni Adu',          100),
  ('Goat',    'Kodi Adu',           102),
  ('Goat',    'Cross Breed',        160),
  ('Sheep',   'Kilakarsal',         62),
  ('Sheep',   'Tiruchi Black',      82),
  ('Sheep',   'Katchaikatty Black', 92),
  ('Sheep',   'Chevaadu',           94),
  ('Sheep',   'Cross Breed',        160),
  -- Pig: the full NBAGR registered list (nbagr.res.in/pig, 16 breeds).
  ('Pig',     'Ghoongroo',          20),
  ('Pig',     'Agonda Goan',        31),
  ('Pig',     'Tenyi Vo',           32),
  ('Pig',     'Nicobari',           33),
  ('Pig',     'Doom',               34),
  ('Pig',     'Zovawk',             35),
  ('Pig',     'Ghurrah',            36),
  ('Pig',     'Mali',               37),
  ('Pig',     'Purnea',             38),
  ('Pig',     'Banda',              39),
  ('Pig',     'Manipuri Black',     40),
  ('Pig',     'Wak Chambil',        41),
  ('Pig',     'Andamani',           42),
  ('Pig',     'Karkambi',           43),
  ('Pig',     'Nagal',              44),
  ('Pig',     'Cross Breed',        90)
) AS v(species_code, name, sort_order)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, name) DO NOTHING;

-- Local-language words for the cross-breed entries (a renamed row would otherwise keep whatever
-- "Mixed Breed" translation it had). Only fills a blank, never overwrites an admin's wording.
UPDATE master_breeds b SET
    label_hi = COALESCE(NULLIF(b.label_hi, ''), v.hi), label_kn = COALESCE(NULLIF(b.label_kn, ''), v.kn),
    label_ml = COALESCE(NULLIF(b.label_ml, ''), v.ml), label_ta = COALESCE(NULLIF(b.label_ta, ''), v.ta),
    label_te = COALESCE(NULLIF(b.label_te, ''), v.te)
  FROM (VALUES
    ('Cross Breed',  'संकर नस्ल',  'ಮಿಶ್ರ ತಳಿ',        'സങ്കരയിനം',      'கலப்பினம்',          'సంకర జాతి'),
    ('Jersey Cross', 'जर्सी संकर', 'ಜರ್ಸಿ ಮಿಶ್ರ ತಳಿ',   'ജേഴ്സി സങ്കരം',   'ஜெர்சி கலப்பினம்',    'జెర్సీ సంకరం'),
    ('HF Cross',     'एचएफ संकर',  'ಎಚ್‌ಎಫ್ ಮಿಶ್ರ ತಳಿ', 'എച്ച്.എഫ് സങ്കരം', 'எச்.எஃப். கலப்பினம்', 'హెచ్‌ఎఫ్ సంకరం')
  ) AS v(name, hi, kn, ml, ta, te)
 WHERE b.name = v.name
   AND b.species_id IN (SELECT id FROM master_species WHERE code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Pig'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AQUACULTURE SPECIES
-- ─────────────────────────────────────────────────────────────────────────────
-- Fish, shrimp, prawn and crab that are actually cultured (owner decisions D6 and D10). Batch by
-- default: a pond is a group and the crop inside it is a cycle. No ear tag, no gender, no class.
-- Scientific names are as printed by the source. Not marketplace-eligible by default.

INSERT INTO master_species
  (code, label, icon, category, has_ear_tag, sort_order, is_active, default_management_mode,
   farm_segment, is_aquatic, birth_event_term, scientific_name, water_type,
   label_hi, label_kn, label_ml, label_ta, label_te)
VALUES
  ('Catla',                 'Catla',                        '🐟', 'Aquaculture', false, 600, true, 'batch', 'aquaculture', true, 'spawning', 'Catla catla',                  'fresh',    'कतला', 'ಕಾಟ್ಲಾ', 'കട്ല', 'கட்லா', 'బొచ్చె (కట్ల)'),
  ('Rohu',                  'Rohu',                         '🐟', 'Aquaculture', false, 610, true, 'batch', 'aquaculture', true, 'spawning', 'Labeo rohita',                 'fresh',    'रोहू', 'ರೋಹು', 'രോഹു', 'ரோகு', 'రోహు'),
  ('Mrigal',                'Mrigal',                       '🐟', 'Aquaculture', false, 620, true, 'batch', 'aquaculture', true, 'spawning', 'Cirrhinus mrigala',            'fresh',    'मृगल', 'ಮೃಗಾಲ್', 'മൃഗാൽ', 'மிரிகால்', 'మ్రిగాల'),
  ('Bata',                  'Bata',                         '🐟', 'Aquaculture', false, 630, true, 'batch', 'aquaculture', true, 'spawning', 'Labeo bata',                   'fresh',    'बाटा', 'ಬಾಟಾ', 'ബാറ്റ', 'பாட்டா', 'బాటా'),
  ('Calbasu',               'Calbasu',                      '🐟', 'Aquaculture', false, 640, true, 'batch', 'aquaculture', true, 'spawning', 'Labeo calbasu',                'fresh',    'कालबासु', 'ಕಲ್ಬಾಸು', 'കൽബാസു', 'கல்பாசு', 'కల్బాసు'),
  ('Silver Carp',           'Silver Carp',                  '🐟', 'Aquaculture', false, 650, true, 'batch', 'aquaculture', true, 'spawning', 'Hypophthalmichthys molitrix',  'fresh',    'सिल्वर कार्प', 'ಸಿಲ್ವರ್ ಕಾರ್ಪ್', 'സിൽവർ കാർപ്പ്', 'வெள்ளிக் கெண்டை', 'సిల్వర్ కార్ప్'),
  ('Grass Carp',            'Grass Carp',                   '🐟', 'Aquaculture', false, 660, true, 'batch', 'aquaculture', true, 'spawning', 'Ctenopharyngodon idella',      'fresh',    'ग्रास कार्प', 'ಗ್ರಾಸ್ ಕಾರ್ಪ್', 'ഗ്രാസ് കാർപ്പ്', 'புல் கெண்டை', 'గ్రాస్ కార్ప్'),
  ('Common Carp',           'Common Carp',                  '🐟', 'Aquaculture', false, 670, true, 'batch', 'aquaculture', true, 'spawning', 'Cyprinus carpio',              'fresh',    'कॉमन कार्प', 'ಕಾಮನ್ ಕಾರ್ಪ್', 'കോമൺ കാർപ്പ്', 'சாதா கெண்டை', 'కామన్ కార్ప్'),
  ('Tilapia',               'Tilapia',                      '🐟', 'Aquaculture', false, 680, true, 'batch', 'aquaculture', true, 'spawning', 'Oreochromis spp.',             'fresh',    'तिलापिया', 'ತಿಲಾಪಿಯಾ', 'തിലാപ്പിയ', 'திலேப்பியா', 'తిలాపియా'),
  ('Magur',                 'Magur',                        '🐟', 'Aquaculture', false, 690, true, 'batch', 'aquaculture', true, 'spawning', 'Clarias batrachus',            'fresh',    'मांगुर', 'ಮಾಗುರ್', 'മാഗൂർ', 'மாகூர்', 'మాగుర్'),
  ('Singhi',                'Singhi',                       '🐟', 'Aquaculture', false, 700, true, 'batch', 'aquaculture', true, 'spawning', 'Heteropneustes fossilis',      'fresh',    'सिंघी', 'ಸಿಂಘಿ', 'സിംഘി', 'சிங்கி', 'సింఘి'),
  ('Murrel',                'Murrel',                       '🐟', 'Aquaculture', false, 710, true, 'batch', 'aquaculture', true, 'spawning', 'Channa spp.',                  'fresh',    'मरल (सौल)', 'ಮುರ್ರೆಲ್', 'വരാൽ', 'விரால்', 'కొర్రమీను'),
  ('Climbing Perch',        'Climbing Perch (Koi)',         '🐟', 'Aquaculture', false, 720, true, 'batch', 'aquaculture', true, 'spawning', 'Anabas testudineus',           'fresh',    'कवई', 'ಕ್ಲೈಂಬಿಂಗ್ ಪರ್ಚ್', 'ക്ലൈംബിംഗ് പെർച്ച്', 'பனையேறி கெண்டை', 'క్లైంబింగ్ పెర్చ్'),
  ('Pangasius',             'Pangasius',                    '🐟', 'Aquaculture', false, 730, true, 'batch', 'aquaculture', true, 'spawning', 'Pangasius pangasius',          'fresh',    'पंगास', 'ಪಂಗಾಸಿಯಸ್', 'പംഗാസിയസ്', 'பங்காசியஸ்', 'పంగాసియస్'),
  ('Giant Gourami',         'Giant Gourami',                '🐟', 'Aquaculture', false, 740, true, 'batch', 'aquaculture', true, 'spawning', 'Osphronemus goramy',           'fresh',    'जायंट गौरामी', 'ಜೈಂಟ್ ಗೌರಾಮಿ', 'ജയന്റ് ഗൗരാമി', 'ஜெயண்ட் கௌராமி', 'జెయింట్ గౌరామి'),
  ('Freshwater Prawn',      'Freshwater Prawn (Scampi)',    '🦐', 'Aquaculture', false, 750, true, 'batch', 'aquaculture', true, 'spawning', 'Macrobrachium rosenbergii',    'fresh',    'मीठे पानी का झींगा (स्कैम्पी)', 'ಸಿಹಿನೀರು ಸೀಗಡಿ (ಸ್ಕ್ಯಾಂಪಿ)', 'ആറ്റുകൊഞ്ച്', 'நன்னீர் இறால் (ஸ்கேம்பி)', 'మంచినీటి రొయ్య (స్కాంపి)'),
  ('Asian Seabass',         'Asian Seabass',                '🐟', 'Aquaculture', false, 760, true, 'batch', 'aquaculture', true, 'spawning', 'Lates calcarifer',             'brackish', 'एशियन सीबास (भेटकी)', 'ಏಷ್ಯನ್ ಸೀಬಾಸ್', 'കാളാഞ്ചി', 'கொடுவா', 'పండుగప్ప'),
  ('Milkfish',              'Milkfish',                     '🐟', 'Aquaculture', false, 770, true, 'batch', 'aquaculture', true, 'spawning', 'Chanos chanos',                'brackish', 'मिल्कफिश', 'ಮಿಲ್ಕ್‌ಫಿಶ್', 'പൂമീൻ', 'பால் மீன்', 'మిల్క్‌ఫిష్'),
  ('Grey Mullet',           'Grey Mullet',                  '🐟', 'Aquaculture', false, 780, true, 'batch', 'aquaculture', true, 'spawning', 'Mugil cephalus',               'brackish', 'ग्रे मुलेट', 'ಗ್ರೇ ಮಲೆಟ್', 'തിരുത', 'மடவை', 'గ్రే ముల్లెట్'),
  ('Pearlspot',             'Pearlspot',                    '🐟', 'Aquaculture', false, 790, true, 'batch', 'aquaculture', true, 'spawning', 'Etroplus suratensis',          'brackish', 'पर्लस्पॉट', 'ಪರ್ಲ್‌ಸ್ಪಾಟ್', 'കരിമീൻ', 'கரிமீன் (பேர்ல்ஸ்பாட்)', 'పెర్ల్‌స్పాట్'),
  ('Long Whiskers Catfish', 'Long Whiskers Catfish',        '🐟', 'Aquaculture', false, 800, true, 'batch', 'aquaculture', true, 'spawning', 'Mystus gulio',                 'brackish', 'लॉन्ग व्हिस्कर्स कैटफ़िश', 'ಲಾಂಗ್ ವಿಸ್ಕರ್ಸ್ ಕ್ಯಾಟ್‌ಫಿಶ್', 'ലോങ് വിസ്കേഴ്സ് ക്യാറ്റ്ഫിഷ്', 'நீள மீசைக் கெளுத்தி', 'లాంగ్ విస్కర్స్ క్యాట్‌ఫిష్'),
  ('Red Snapper',           'Red Snapper',                  '🐟', 'Aquaculture', false, 810, true, 'batch', 'aquaculture', true, 'spawning', 'Lutjanus argentimaculatus',    'brackish', 'रेड स्नैपर', 'ರೆಡ್ ಸ್ನ್ಯಾಪರ್', 'ചെമ്പല്ലി', 'ரெட் ஸ்னாப்பர்', 'రెడ్ స్నాపర్'),
  ('Vannamei Shrimp',       'Pacific White Shrimp (Vannamei)', '🦐', 'Aquaculture', false, 820, true, 'batch', 'aquaculture', true, 'spawning', 'Penaeus (Litopenaeus) vannamei', 'brackish', 'वन्नामेई झींगा', 'ವನ್ನಾಮೇ ಸೀಗಡಿ', 'വനാമി ചെമ്മീൻ', 'வனாமி இறால்', 'వెనామీ రొయ్య'),
  ('Black Tiger Shrimp',    'Black Tiger Shrimp',           '🦐', 'Aquaculture', false, 830, true, 'batch', 'aquaculture', true, 'spawning', 'Penaeus monodon',              'brackish', 'टाइगर झींगा', 'ಟೈಗರ್ ಸೀಗಡಿ', 'ടൈഗർ ചെമ്മീൻ', 'புலி இறால்', 'టైగర్ రొయ్య'),
  ('Indian White Shrimp',   'Indian White Shrimp',          '🦐', 'Aquaculture', false, 840, true, 'batch', 'aquaculture', true, 'spawning', 'Penaeus indicus',              'brackish', 'भारतीय सफ़ेद झींगा', 'ಭಾರತೀಯ ಬಿಳಿ ಸೀಗಡಿ', 'നാരൻ ചെമ്മീൻ', 'வெள்ளை இறால்', 'తెల్ల రొయ్య'),
  ('Mud Crab',              'Mud Crab',                     '🦀', 'Aquaculture', false, 850, true, 'batch', 'aquaculture', true, 'spawning', 'Scylla serrata',               'brackish', 'कीचड़ केकड़ा', 'ಕೆಸರು ಏಡಿ', 'ചെളിഞണ്ട്', 'சேற்று நண்டு', 'మండ పీత')
ON CONFLICT (code) DO NOTHING;

-- Every species picker ends in "Other"; varieties the sources name are offered as breeds.
INSERT INTO master_breeds (species_id, name, sort_order, is_active)
SELECT s.id, 'Other', 900, true FROM master_species s WHERE s.farm_segment = 'aquaculture'
ON CONFLICT (species_id, name) DO NOTHING;

INSERT INTO master_breeds (species_id, name, sort_order, is_active)
SELECT s.id, v.name, v.sort_order, true
FROM (VALUES
  ('Common Carp', 'Mirror Carp',          10),
  ('Common Carp', 'Scale Carp',           20),
  ('Murrel',      'Striped Murrel',       10),
  ('Murrel',      'Giant Murrel',         20),
  ('Murrel',      'Spotted Murrel',       30),
  ('Tilapia',     'Mozambique Tilapia',   10),
  ('Tilapia',     'Nile Tilapia (GIFT)',  20)
) AS v(species_code, name, sort_order)
JOIN master_species s ON s.code = v.species_code
ON CONFLICT (species_id, name) DO NOTHING;

-- Guide ranges, only where an official table was found. Shrimp: MPEDA better-management-practice
-- table (covers L. vannamei and P. monodon). Freshwater prawn: TNAU nursery/grow-out table
-- (cites FAO 2002 and ICAR-CIFA). No official table was found for carp, brackish finfish or crab,
-- so those species carry no range and the app shows no "outside the guide range" hint for them.
UPDATE master_species SET water_quality_ranges =
  '{"temperatureC":{"min":28,"max":32},"ph":{"min":7.5,"max":8.3},"dissolvedOxygenPpm":{"min":4,"max":6},"salinityPpt":{"min":10,"max":25},"transparencyCm":{"min":30,"max":40},"ammoniaPpm":{"max":0.5},"source":"MPEDA shrimp BMP water quality parameters (mpeda.gov.in/?page_id=728)"}'::jsonb
 WHERE code IN ('Vannamei Shrimp', 'Black Tiger Shrimp') AND water_quality_ranges IS NULL;

UPDATE master_species SET water_quality_ranges =
  '{"temperatureC":{"min":28,"max":31},"ph":{"min":7.0,"max":8.5},"dissolvedOxygenPpm":{"min":3,"max":7},"salinityPpt":{"max":10},"transparencyCm":{"min":25,"max":40},"ammoniaPpm":{"max":0.3},"source":"TNAU Agritech Portal, freshwater prawn culture (cites FAO 2002, ICAR-CIFA)"}'::jsonb
 WHERE code = 'Freshwater Prawn' AND water_quality_ranges IS NULL;
