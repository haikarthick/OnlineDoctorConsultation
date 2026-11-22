import type { NutritionModel, MuscleCondition, ActivityLevel, Housing } from './models';

/**
 * The facts the engine reads about one animal. Every one of them is OWNED by another module (animal profile,
 * body-measurement history, breeding records) - the nutrition module reads them live and, when one is missing,
 * asks for it and saves it back THROUGH that module (docs/NUTRITION_PLAN.md §4a). Nothing here is a copy.
 */
export interface AnimalFacts {
  speciesCode: string;
  model: NutritionModel;
  dateOfBirth: string | null;
  gender: string | null;
  isNeutered: boolean | null;
  activityLevel: ActivityLevel | null;
  housing: Housing | null;
  breedingStatus: string | null;
  expectedDueDate: string | null;
  lastBirthDate: string | null;
  avgDailyMilkLitres: number | null;
  weightKg: number | null;
  weightRecordedAt: string | null;
  bcs9: number | null;
  bcsRecordedAt: string | null;
  muscleCondition: MuscleCondition | null;
}

/** Where a missing fact is saved: the animal profile, or the body-measurement history. */
export type FactOwner = 'animal_profile' | 'body_measurement';

export interface MissingFact {
  key: 'weight' | 'dateOfBirth' | 'gender' | 'isNeutered' | 'activityLevel' | 'housing' | 'bodyCondition';
  owner: FactOwner;
  /** Required: no plan can be worked out without it. Otherwise it only makes the plan better. */
  required: boolean;
}

/** Facts each model needs. Data, not branches: a new model adds a row here. */
const NEEDS: Record<NutritionModel, MissingFact[]> = {
  companion_energy: [
    { key: 'weight', owner: 'body_measurement', required: true },
    { key: 'dateOfBirth', owner: 'animal_profile', required: true },
    { key: 'bodyCondition', owner: 'body_measurement', required: false },
    { key: 'activityLevel', owner: 'animal_profile', required: false },
    { key: 'housing', owner: 'animal_profile', required: false },
  ],
  ruminant_dm: [
    { key: 'weight', owner: 'body_measurement', required: true },
    { key: 'dateOfBirth', owner: 'animal_profile', required: false },
    { key: 'gender', owner: 'animal_profile', required: false },
    { key: 'bodyCondition', owner: 'body_measurement', required: false },
    { key: 'housing', owner: 'animal_profile', required: false },
  ],
  monogastric_spec: [
    { key: 'weight', owner: 'body_measurement', required: false },
    { key: 'dateOfBirth', owner: 'animal_profile', required: false },
  ],
  aqua_biomass: [],
  equine_dm: [
    { key: 'weight', owner: 'body_measurement', required: true },
    { key: 'dateOfBirth', owner: 'animal_profile', required: false },
    { key: 'bodyCondition', owner: 'body_measurement', required: false },
    { key: 'activityLevel', owner: 'animal_profile', required: false },
  ],
  guidance_only: [
    { key: 'weight', owner: 'body_measurement', required: false },
    { key: 'bodyCondition', owner: 'body_measurement', required: false },
  ],
};

const present = (facts: AnimalFacts, key: MissingFact['key']): boolean => {
  switch (key) {
    case 'weight': return facts.weightKg !== null && facts.weightKg > 0;
    case 'dateOfBirth': return !!facts.dateOfBirth;
    case 'gender': return !!facts.gender && facts.gender !== 'unknown';
    case 'isNeutered': return facts.isNeutered !== null;
    case 'activityLevel': return !!facts.activityLevel;
    case 'housing': return !!facts.housing;
    case 'bodyCondition': return facts.bcs9 !== null;
    default: return true;
  }
};

/** What is missing for this animal, required facts first. */
export function missingFacts(facts: AnimalFacts): MissingFact[] {
  return NEEDS[facts.model]
    .filter(n => !present(facts, n.key))
    .sort((a, b) => Number(b.required) - Number(a.required));
}

export function canCalculate(facts: AnimalFacts): boolean {
  return missingFacts(facts).every(m => !m.required);
}

/** Whole months between a date of birth and `now` (null when the date is missing or in the future). */
export function ageInMonths(dateOfBirth: string | null, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > now) return null;
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}
