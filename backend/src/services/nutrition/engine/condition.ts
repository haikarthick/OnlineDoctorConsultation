import type { NutritionModel } from './models';

/**
 * Body condition score helpers. Two scales are in use: 1-9 (dogs, cats - WSAVA/AAHA) and 1-5 (cattle and
 * most farm species). Everything is compared on the 9-point scale internally; the stored row keeps the
 * scale it was taken on.
 */

/** 5-point -> 9-point: 1->1, 2->3, 3->5, 4->7, 5->9 (half points map linearly). */
export function toNinePoint(score: number, scale: 5 | 9): number {
  if (scale === 9) return score;
  return Math.round((2 * score - 1) * 10) / 10;
}

/**
 * The scale a score was most likely taken on when the screen did not say (the farm health observation
 * form accepts 1-9 with no scale). Companion animals are scored 1-9; anything above 5 can only be 1-9.
 */
export function inferBcsScale(model: NutritionModel | null, score: number): 5 | 9 {
  if (score > 5) return 9;
  return model === 'companion_energy' ? 9 : 5;
}

/**
 * Estimated ideal weight from current weight and a 9-point score: each point away from 5 is taken as about
 * 10% of ideal weight. A widely used clinical rule of thumb (WSAVA / AAHA body condition charts); stored as a
 * starting point the vet can override, never as a diagnosis.
 */
export const BCS_PERCENT_PER_POINT = 10;

export function estimateIdealWeight(weightKg: number, bcs9: number | null): number {
  if (bcs9 === null || !Number.isFinite(bcs9) || bcs9 === 5) return weightKg;
  const ratio = 1 + (BCS_PERCENT_PER_POINT / 100) * (bcs9 - 5);
  if (ratio <= 0.3) return weightKg; // nonsense input - do not divide toward infinity
  return Math.round((weightKg / ratio) * 100) / 100;
}

export type ConditionBand = 'very_thin' | 'thin' | 'ideal' | 'overweight' | 'obese';

/** AAHA screening: a 9-point score outside 4-5 is a nutritional risk factor. */
export function conditionBand(bcs9: number): ConditionBand {
  if (bcs9 <= 2) return 'very_thin';
  if (bcs9 < 4) return 'thin';
  if (bcs9 <= 5) return 'ideal';
  if (bcs9 < 8) return 'overweight';
  return 'obese';
}
