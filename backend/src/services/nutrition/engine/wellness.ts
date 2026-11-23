import { conditionBand } from './condition';

/**
 * Wellness scorecard values that come from nutrition facts instead of being typed (NUT-172, NUT-184): one fact, one
 * place. Pure arithmetic over what the nutrition module already holds; a value with no records behind it is null
 * ("not enough records yet"), never a made-up number.
 */
export type WeightStatus = 'underweight' | 'normal' | 'overweight' | 'obese' | 'unknown';

/** Body condition (1-9) -> the words the scorecard uses. */
export function weightStatusFrom(bcs9: number | null): WeightStatus {
  if (bcs9 === null || !Number.isFinite(bcs9)) return 'unknown';
  const band = conditionBand(bcs9);
  if (band === 'very_thin' || band === 'thin') return 'underweight';
  if (band === 'ideal') return 'normal';
  return band === 'overweight' ? 'overweight' : 'obese';
}

/** What the animal's recorded activity level is worth on a 0-100 scale. */
export function activityScoreFrom(level: string | null): number | null {
  switch (level) {
    case 'low': return 40;
    case 'moderate': return 70;
    case 'high': return 90;
    case 'working': return 90;
    default: return null;
  }
}

/**
 * 100, less 25 for each alert that needs action and 10 for each that needs watching; a calculator animal with no plan
 * loses 10 more. Null when there is nothing on record to judge (no weight, no body condition, no plan, no alerts).
 */
export function nutritionScoreFrom(input: { actFlags: number; watchFlags: number; hasPlan: boolean; needsPlan: boolean; hasWeight: boolean; hasBcs: boolean }): number | null {
  if (!input.hasWeight && !input.hasBcs && !input.hasPlan && input.actFlags + input.watchFlags === 0) return null;
  const score = 100 - 25 * input.actFlags - 10 * input.watchFlags - (input.needsPlan && !input.hasPlan ? 10 : 0);
  return Math.max(0, Math.min(100, score));
}
