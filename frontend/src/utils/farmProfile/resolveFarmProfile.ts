/**
 * Farm profile resolver - "parent drives children" (docs/FARM_MANAGEMENT_PLAN.md section 6).
 *
 * ONE pure function decides, from master data alone, which fields, sections, daily records and
 * events apply to an animal or a group. Every form, detail view, card, report and write endpoint
 * asks this function; none of them decides on its own. So a bull is never asked about milk, a
 * flock is never asked for an ear tag, and a pond shows water quality - without one
 * `if (species === 'Cattle')` anywhere. An admin-added species works without a deploy because
 * everything here reads flags, never names.
 *
 * THIS FILE EXISTS TWICE, BYTE FOR BYTE:
 *   backend/src/services/farmProfile/resolveFarmProfile.ts
 *   frontend/src/utils/farmProfile/resolveFarmProfile.ts
 * The backend validates writes with it; the frontend shows and hides with it. If the two copies
 * differed, the screen would offer something the server then refuses. The frontend test
 * `resolveFarmProfile.parity.test.ts` fails when they drift - edit one, copy it over the other.
 * It must therefore stay dependency-free: no imports, no Node or browser APIs.
 */

export type FarmSegment =
  | 'dairy' | 'small_ruminant' | 'pig' | 'poultry' | 'aquaculture' | 'equine' | 'other_livestock' | 'pet';

export type ManagementMode = 'individual' | 'batch';

/** required = must be filled; optional = shown; more = behind "More details"; hidden = not shown or asked. */
export type FieldState = 'required' | 'optional' | 'more' | 'hidden';

export type RecordSubject = 'animal' | 'group';

export interface FarmRange { min?: number; max?: number }

export interface FarmSpecies {
  code: string;
  farmSegment: FarmSegment;
  hasEarTag: boolean;
  defaultManagementMode: ManagementMode;
  producesMilk: boolean;
  producesEggs: boolean;
  producesWool: boolean;
  isAquatic: boolean;
  litterExpected: boolean;
  gestationDays: number | null;
  incubationDays: number | null;
  birthEventTerm: string;
  waterType: string | null;
  waterQualityRanges: Record<string, FarmRange | string> | null;
}

export interface FarmAnimalClass {
  speciesCode: string;
  value: string;
  impliedGender: 'male' | 'female' | 'unknown';
  canBePregnant: boolean;
  canProduceMilk: boolean;
  canLayEggs: boolean;
  isJuvenile: boolean;
}

export interface FarmGroupType {
  /** Set when the type belongs to one species; otherwise farmSegment is set. Never both. */
  speciesCode: string | null;
  farmSegment: string | null;
  value: string;
  managementMode: ManagementMode | null;
  suggestedClass: string | null;
  isHealthHold: boolean;
  yieldsMilk: boolean;
  yieldsEggs: boolean;
  sortOrder: number;
}

export interface FarmRecordRule {
  farmSegment: string | null;
  managementMode: string | null;
  requiresSpeciesFlag: string | null;
  aquatic: boolean | null;
  requiresClassFlag: string | null;
  requiresGroupFlag: string | null;
}

export interface FarmRecordType {
  code: string;
  kind: 'daily' | 'event';
  subject: 'animal' | 'group' | 'either';
  unit: string | null;
  sortOrder: number;
  rules: FarmRecordRule[];
}

/** Everything the resolver reads. Only ACTIVE rows belong in here. */
export interface FarmMaster {
  species: FarmSpecies[];
  classes: FarmAnimalClass[];
  groupTypes: FarmGroupType[];
  recordTypes: FarmRecordType[];
}

export interface FarmProfileInput {
  speciesCode?: string | null;
  animalClass?: string | null;
  gender?: string | null;
  managementMode?: string | null;
  groupType?: string | null;
}

export interface ResolvedRecordType {
  code: string;
  kind: 'daily' | 'event';
  unit: string | null;
  /** Who it can be recorded against in this context. Never empty. */
  subjects: RecordSubject[];
}

export type FarmFieldKey =
  // one animal
  | 'name' | 'earTag' | 'animalClass' | 'gender' | 'breed' | 'dateOfBirth' | 'weight' | 'birthWeight'
  | 'color' | 'microchip' | 'neutered' | 'insurance'
  | 'pregnancyStatus' | 'lastBreedingDate' | 'expectedDueDate' | 'parity' | 'lastBirthDate'
  | 'lactationNumber' | 'avgDailyMilk' | 'dryOffDate'
  // a group / a batch cycle
  | 'groupType' | 'plannedCount' | 'placedCount' | 'placementDate' | 'stockSource'
  | 'pondArea' | 'waterType' | 'stockingDensity';

export type FarmSection = 'identity' | 'breeding' | 'milk' | 'eggs' | 'wool' | 'batch' | 'water' | 'more';

export interface FarmProfile {
  /** False when the species is not in master data - the profile is then the plain pet one. */
  speciesKnown: boolean;
  segment: FarmSegment;
  managementMode: ManagementMode;
  isAquatic: boolean;
  canBePregnant: boolean;
  canProduceMilk: boolean;
  canLayEggs: boolean;
  isJuvenile: boolean;
  fields: Record<FarmFieldKey, FieldState>;
  sections: FarmSection[];
  recordTypes: ResolvedRecordType[];
  /** Group-type values offered for this species (its own list, else its segment's list). */
  groupTypes: string[];
  terms: {
    /** The farmer's word for a birth: calving, kidding, lambing, farrowing, foaling, hatching, spawning, birth. */
    birthEvent: string;
    /** What a batch cycle is called: 'crop' for a pond, 'cycle' for a shed, null when not batch-managed. */
    cycle: 'cycle' | 'crop' | null;
    /** The record type that opens a cycle and the one that closes it; null when not batch-managed. */
    placement: 'placement' | 'stocking' | null;
    closeOut: 'clear_out' | 'harvest' | null;
    /** How age is best shown: a batch by days (weeks for laying groups), an animal by its date of birth. */
    ageUnit: 'days' | 'weeks' | 'date_of_birth';
    /** True when a birth normally produces several young, so the count is asked. */
    offspringCounted: boolean;
  };
  units: { milk: string; weight: string; feed: string; area: string[] };
  reproduction: { gestationDays: number | null; incubationDays: number | null };
  waterQualityRanges: Record<string, FarmRange | string> | null;
}

const ALL_FIELDS: FarmFieldKey[] = [
  'name', 'earTag', 'animalClass', 'gender', 'breed', 'dateOfBirth', 'weight', 'birthWeight',
  'color', 'microchip', 'neutered', 'insurance',
  'pregnancyStatus', 'lastBreedingDate', 'expectedDueDate', 'parity', 'lastBirthDate',
  'lactationNumber', 'avgDailyMilk', 'dryOffDate',
  'groupType', 'plannedCount', 'placedCount', 'placementDate', 'stockSource',
  'pondArea', 'waterType', 'stockingDensity',
];

const SEGMENTS: string[] = ['dairy', 'small_ruminant', 'pig', 'poultry', 'aquaculture', 'equine', 'other_livestock', 'pet'];

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Species row for a code, tolerant of case ("cattle" finds "Cattle"). */
export function findFarmSpecies(master: FarmMaster, speciesCode: string | null | undefined): FarmSpecies | undefined {
  if (!speciesCode) return undefined;
  return master.species.find(s => s.code === speciesCode) || master.species.find(s => sameText(s.code, speciesCode));
}

/**
 * Group types offered for a species: its own list when it has one (cattle and goat use different
 * words), otherwise the list shared by its farm segment (every pond species shares the culture
 * stages). Sorted for display.
 */
export function groupTypesForSpecies(master: FarmMaster, speciesCode: string | null | undefined): FarmGroupType[] {
  const species = findFarmSpecies(master, speciesCode);
  if (!species) return [];
  const own = master.groupTypes.filter(g => g.speciesCode !== null && g.speciesCode === species.code);
  const list = own.length > 0 ? own : master.groupTypes.filter(g => g.speciesCode === null && g.farmSegment === species.farmSegment);
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
}

function speciesHasFlag(species: FarmSpecies, flag: string): boolean {
  if (flag === 'produces_milk') return species.producesMilk;
  if (flag === 'produces_eggs') return species.producesEggs;
  if (flag === 'produces_wool') return species.producesWool;
  return false;
}

export function resolveFarmProfile(master: FarmMaster, input: FarmProfileInput): FarmProfile {
  const species = findFarmSpecies(master, input.speciesCode);
  const segment: FarmSegment = species && SEGMENTS.indexOf(species.farmSegment) >= 0 ? species.farmSegment : 'pet';
  const isFarm = segment !== 'pet';
  const isAquatic = !!species && species.isAquatic;

  const groupTypes = groupTypesForSpecies(master, species ? species.code : null);
  const groupType = input.groupType ? groupTypes.find(g => g.value === input.groupType) : undefined;

  // Mode: what the caller says, else what the group type implies, else the species default.
  let managementMode: ManagementMode = 'individual';
  if (input.managementMode === 'batch' || input.managementMode === 'individual') managementMode = input.managementMode;
  else if (groupType && groupType.managementMode) managementMode = groupType.managementMode;
  else if (species && species.defaultManagementMode === 'batch') managementMode = 'batch';
  const isBatch = managementMode === 'batch';

  const classes = species ? master.classes.filter(c => c.speciesCode === species.code) : [];
  const animalClass = !isBatch && input.animalClass ? classes.find(c => c.value === input.animalClass) : undefined;
  const gender = animalClass && animalClass.impliedGender !== 'unknown'
    ? animalClass.impliedGender
    : (input.gender ? input.gender.trim().toLowerCase() : 'unknown');
  // With no class to say so, only an animal that is EXPLICITLY female is assumed able to breed or
  // be milked. Treating "unknown" as possibly female made every pet of unspecified gender show
  // breeding fields, and asked for births on animals nobody had said were female.
  const isFemale = gender === 'female';
  const bearsLiveYoung = !!species && species.birthEventTerm !== 'hatching' && species.birthEventTerm !== 'spawning';

  // Capabilities of the ANIMAL in front of the farmer. With a class chosen the class decides;
  // without one, fall back to what the species and gender allow so nothing useful is hidden
  // just because the class was left blank. A batch has no single animal, so all are false.
  const isJuvenile = !!animalClass && animalClass.isJuvenile;
  let canBePregnant = false;
  let canProduceMilk = false;
  let canLayEggs = false;
  if (!isBatch && species) {
    if (animalClass) {
      canBePregnant = animalClass.canBePregnant && !isJuvenile;
      canProduceMilk = animalClass.canProduceMilk && !isJuvenile;
      canLayEggs = animalClass.canLayEggs && !isJuvenile;
    } else {
      canBePregnant = isFemale && bearsLiveYoung && !isAquatic;
      canProduceMilk = isFemale && species.producesMilk;
      canLayEggs = isFemale && species.producesEggs;
    }
  }

  // ── Fields ────────────────────────────────────────────────────────────────
  const fields = {} as Record<FarmFieldKey, FieldState>;
  for (const key of ALL_FIELDS) fields[key] = 'hidden';

  fields.breed = 'optional';
  fields.name = 'required';

  if (!isBatch) {
    fields.earTag = species && species.hasEarTag && !isAquatic ? 'optional' : 'hidden';
    fields.animalClass = classes.length > 0 ? 'optional' : 'hidden';
    // A class that implies the gender (cow, bull) makes the gender question redundant.
    fields.gender = animalClass && animalClass.impliedGender !== 'unknown' ? 'hidden' : 'optional';
    fields.dateOfBirth = 'optional';
    fields.weight = 'optional';
    fields.birthWeight = isFarm ? 'optional' : 'more';
    // Pet-care details are a tap away for farm stock, never in the farmer's way.
    fields.color = isFarm ? 'more' : 'optional';
    fields.microchip = isFarm ? 'more' : 'optional';
    fields.neutered = isFarm ? 'more' : 'optional';
    fields.insurance = isFarm ? 'more' : 'optional';

    const breeding: FieldState = canBePregnant ? 'optional' : 'hidden';
    fields.pregnancyStatus = breeding;
    fields.lastBreedingDate = breeding;
    fields.expectedDueDate = breeding;
    fields.parity = breeding;
    fields.lastBirthDate = breeding;

    const milking: FieldState = canProduceMilk ? 'optional' : 'hidden';
    fields.lactationNumber = milking;
    fields.avgDailyMilk = milking;
    fields.dryOffDate = milking;
  }

  if (isFarm) {
    fields.groupType = groupTypes.length > 0 ? 'optional' : 'hidden';
    fields.plannedCount = 'optional';
  }
  if (isBatch) {
    fields.placedCount = 'required';
    fields.placementDate = 'required';
    fields.stockSource = 'optional';
  }
  if (isAquatic) {
    fields.pondArea = 'optional';
    fields.waterType = 'optional';
    fields.stockingDensity = 'optional';
  }

  // ── Record types ──────────────────────────────────────────────────────────
  const groupFlag = (flag: string): boolean => {
    if (groupType) return flag === 'yields_milk' ? groupType.yieldsMilk : flag === 'yields_eggs' ? groupType.yieldsEggs : false;
    // An old or free-text group type carries no flags: fall back to what the species can do.
    if (!species) return false;
    return flag === 'yields_milk' ? species.producesMilk : flag === 'yields_eggs' ? species.producesEggs : false;
  };
  const classFlag = (flag: string): boolean => {
    if (flag === 'can_produce_milk') return canProduceMilk;
    if (flag === 'can_be_pregnant') return canBePregnant;
    if (flag === 'can_lay_eggs') return canLayEggs;
    return false;
  };
  const ruleMatches = (rule: FarmRecordRule, subject: RecordSubject): boolean => {
    if (!species) return false;
    // A rule with no segment means "any FARM stock" - pets are in only when a rule names them.
    if (rule.farmSegment === null ? !isFarm : rule.farmSegment !== segment) return false;
    if (rule.managementMode !== null && rule.managementMode !== managementMode) return false;
    if (rule.aquatic !== null && rule.aquatic !== isAquatic) return false;
    if (rule.requiresSpeciesFlag !== null && !speciesHasFlag(species, rule.requiresSpeciesFlag)) return false;
    if (subject === 'animal') {
      if (isBatch) return false; // a batch has no individual animals to record against
      if (rule.requiresClassFlag !== null && !classFlag(rule.requiresClassFlag)) return false;
    } else if (rule.requiresGroupFlag !== null && !groupFlag(rule.requiresGroupFlag)) {
      return false;
    }
    return true;
  };

  const recordTypes: ResolvedRecordType[] = [];
  for (const rt of [...master.recordTypes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const subjects: RecordSubject[] = [];
    for (const subject of ['animal', 'group'] as RecordSubject[]) {
      if (rt.subject !== 'either' && rt.subject !== subject) continue;
      if (rt.rules.some(rule => ruleMatches(rule, subject))) subjects.push(subject);
    }
    if (subjects.length > 0) recordTypes.push({ code: rt.code, kind: rt.kind, unit: rt.unit, subjects });
  }
  const offers = (code: string): boolean => recordTypes.some(r => r.code === code);

  // ── Sections ──────────────────────────────────────────────────────────────
  const sections: FarmSection[] = ['identity'];
  if (canBePregnant) sections.push('breeding');
  if (canProduceMilk || offers('milk')) sections.push('milk');
  if (canLayEggs || offers('eggs')) sections.push('eggs');
  if (offers('shearing')) sections.push('wool');
  if (isBatch) sections.push('batch');
  if (isAquatic) sections.push('water');
  sections.push('more');

  const layingGroup = isBatch && !!groupType && groupType.yieldsEggs;

  return {
    speciesKnown: !!species,
    segment,
    managementMode,
    isAquatic,
    canBePregnant,
    canProduceMilk,
    canLayEggs,
    isJuvenile,
    fields,
    sections,
    recordTypes,
    groupTypes: groupTypes.map(g => g.value),
    terms: {
      birthEvent: species ? species.birthEventTerm : 'birth',
      cycle: isBatch ? (isAquatic ? 'crop' : 'cycle') : null,
      placement: isBatch ? (isAquatic ? 'stocking' : 'placement') : null,
      closeOut: isBatch ? (isAquatic ? 'harvest' : 'clear_out') : null,
      ageUnit: isBatch ? (layingGroup ? 'weeks' : 'days') : 'date_of_birth',
      offspringCounted: !!species && species.litterExpected,
    },
    units: {
      milk: 'L',
      weight: isAquatic ? 'g' : 'kg',
      feed: 'kg',
      area: isAquatic ? ['hectare', 'acre', 'cent', 'sq_m'] : [],
    },
    reproduction: {
      gestationDays: species ? species.gestationDays : null,
      incubationDays: species ? species.incubationDays : null,
    },
    waterQualityRanges: species ? species.waterQualityRanges : null,
  };
}

/** Whether a record type may be recorded against this subject in this profile. */
export function isRecordTypeAllowed(profile: FarmProfile, code: string, subject: RecordSubject): boolean {
  const rt = profile.recordTypes.find(r => r.code === code);
  return !!rt && rt.subjects.indexOf(subject) >= 0;
}
