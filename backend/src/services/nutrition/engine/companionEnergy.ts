import type { PlanGoal } from './models';
import type { AnimalFacts } from './facts';
import { ageInMonths } from './facts';
import { estimateIdealWeight } from './condition';

/**
 * Daily energy for dogs and cats (nutrition model `companion_energy`).
 *
 *   RER = 70 x (kg)^0.75                       - valid at any body weight (MSD Veterinary Manual)
 *   daily kcal = factor x RER(basis weight)     - factor by life stage from nutrition_energy_factors
 *
 * Weight loss uses RER of the IDEAL weight (AAHA 2021). Every factor is a STARTING POINT: published
 * estimates can overshoot real needs by 10-60% (FEDIAF citing NRC 2006), so the plan is corrected from the
 * animal's own weight trend (rules.ts), and a vet can override the number.
 *
 * Nothing here invents a multiplier the reference data does not hold: pregnancy, nursing, underweight and
 * very active animals get the maintenance figure as a starting point and are routed to a vet.
 */

export interface EnergyFactorRow {
  factorKey: string;
  factor: number;
  status: string;
  source: string;
}

export interface CompanionEnergyInput {
  facts: AnimalFacts;
  factors: EnergyFactorRow[];
  goal?: PlanGoal | null;
  /** A target weight typed by the owner or vet; wins over the estimate from body condition. */
  targetWeightKg?: number | null;
  now?: Date;
}

export type EnergyReason =
  | 'growing' | 'pregnant' | 'nursing' | 'underweight' | 'overweight' | 'very_active' | 'low_activity'
  | 'neutered' | 'intact' | 'no_condition_score' | 'factor_unvalidated';

export interface CompanionEnergyResult {
  goal: PlanGoal;
  suggestedGoal: PlanGoal;
  weightKg: number;
  basisWeightKg: number;
  idealWeightKg: number | null;
  rerKcal: number;
  factorKey: string;
  factor: number;
  factorSource: string;
  dailyKcal: number;
  requiresVet: boolean;
  reasons: EnergyReason[];
}

export class EnergyInputError extends Error {
  constructor(public code: 'no_weight' | 'no_factor' | 'needs_target_weight', message: string) {
    super(message);
  }
}

export const rer = (kg: number): number => 70 * Math.pow(kg, 0.75);

const NURSING_WEEKS = 8;

export function suggestGoal(facts: AnimalFacts, now: Date = new Date()): PlanGoal {
  const age = ageInMonths(facts.dateOfBirth, now);
  if (age !== null && age < 12) return 'growth';
  if (facts.breedingStatus === 'pregnant') return 'gestation';
  if (facts.lastBirthDate) {
    const weeks = (now.getTime() - new Date(facts.lastBirthDate).getTime()) / (7 * 86400000);
    if (weeks >= 0 && weeks <= NURSING_WEEKS) return 'lactation';
  }
  if (facts.bcs9 !== null && facts.bcs9 >= 7) return 'lose';
  if (facts.bcs9 !== null && facts.bcs9 <= 3) return 'gain';
  return 'maintain';
}

export function companionEnergy(input: CompanionEnergyInput): CompanionEnergyResult {
  const { facts } = input;
  const now = input.now ?? new Date();
  if (facts.weightKg === null || !(facts.weightKg > 0)) {
    throw new EnergyInputError('no_weight', 'A current weight is needed to work out daily food.');
  }
  const byKey = new Map(input.factors.map(f => [f.factorKey, f]));
  const reasons: EnergyReason[] = [];
  let requiresVet = false;

  const suggestedGoal = suggestGoal(facts, now);
  const goal: PlanGoal = input.goal ?? suggestedGoal;
  const age = ageInMonths(facts.dateOfBirth, now);
  const idealFromCondition = facts.bcs9 !== null ? estimateIdealWeight(facts.weightKg, facts.bcs9) : null;
  const target = input.targetWeightKg && input.targetWeightKg > 0 ? input.targetWeightKg : null;

  let factorKey: string;
  let basis = facts.weightKg;

  const maintenanceKey = (): string => {
    if (facts.activityLevel === 'low') { reasons.push('low_activity'); return 'obesity_prone'; }
    if (facts.isNeutered) { reasons.push('neutered'); return 'adult_neutered'; }
    reasons.push('intact');
    return 'adult_intact';
  };

  if (goal === 'growth' || (age !== null && age < 12)) {
    reasons.push('growing');
    factorKey = age !== null && age < 4 ? 'growth_under_4m' : 'growth_4m_to_adult';
  } else if (goal === 'lose') {
    const ideal = target ?? idealFromCondition;
    if (ideal === null) {
      throw new EnergyInputError('needs_target_weight', 'To plan weight loss, add a body condition score or a target weight.');
    }
    reasons.push('overweight');
    if (facts.bcs9 === null) reasons.push('no_condition_score');
    basis = Math.min(ideal, facts.weightKg);
    factorKey = 'weight_loss';
  } else if (goal === 'gain') {
    reasons.push('underweight');
    requiresVet = true;
    basis = Math.max(target ?? idealFromCondition ?? facts.weightKg, facts.weightKg);
    factorKey = maintenanceKey();
  } else if (goal === 'gestation' || goal === 'lactation') {
    reasons.push(goal === 'gestation' ? 'pregnant' : 'nursing');
    requiresVet = true;
    factorKey = maintenanceKey();
  } else {
    factorKey = maintenanceKey();
  }

  if (facts.activityLevel === 'high' || facts.activityLevel === 'working') {
    reasons.push('very_active');
    requiresVet = true;
  }

  const factorRow = byKey.get(factorKey);
  if (!factorRow) {
    throw new EnergyInputError('no_factor', `No energy factor '${factorKey}' is set up for ${facts.speciesCode}.`);
  }
  if (factorRow.status !== 'vet_validated') reasons.push('factor_unvalidated');

  const rerKcal = rer(basis);
  const dailyKcal = Math.round(factorRow.factor * rerKcal);
  return {
    goal,
    suggestedGoal,
    weightKg: facts.weightKg,
    basisWeightKg: Math.round(basis * 100) / 100,
    idealWeightKg: target ?? idealFromCondition,
    rerKcal: Math.round(rerKcal),
    factorKey,
    factor: factorRow.factor,
    factorSource: factorRow.source,
    dailyKcal,
    requiresVet,
    reasons: [...new Set(reasons)],
  };
}
