import type { PlanGoal } from './models';
import type { AnimalFacts } from './facts';

/**
 * Risk flags - rules first (docs/NUTRITION_PLAN.md §5.3 item 5). A flag is "something to look at", never a
 * diagnosis; every flag is stored with RULE_VERSION so it can be explained later.
 *
 * Thresholds and where they come from:
 *   - body condition outside 4-5 on the 9-point scale: AAHA nutritional screening (cited in the plan).
 *   - treats above 10% of the day's energy: the widely used WSAVA/AAHA treat guidance.
 *   - weight-change limits (2% per week loss, 5% drift while maintaining, 90 days without a weight):
 *     conservative platform defaults, pending the owner's vet validation - change them here only.
 */
export const RULE_LIMITS = {
  rapidLossPctPerWeek: 2,
  driftPct: 5,
  driftMinDays: 28,
  staleWeightDays: 90,
  treatSharePct: 10,
} as const;

export type FlagType =
  | 'bcs_high' | 'bcs_low' | 'muscle_loss' | 'rapid_weight_loss' | 'weight_drift'
  | 'no_recent_weight' | 'treats_over_limit' | 'unsafe_food_logged';

export type FlagSeverity = 'info' | 'watch' | 'act';

export interface RiskFlag {
  type: FlagType;
  severity: FlagSeverity;
  params: Record<string, number | string>;
}

export interface WeightPoint { kg: number; at: string }

export interface RiskInput {
  facts: AnimalFacts;
  /** Newest first or any order - sorted here. */
  weights: WeightPoint[];
  goal: PlanGoal | null;
  feeding7d: { mealKcal: number; treatKcal: number } | null;
  now?: Date;
}

const DAY = 86400000;
const pct = (n: number) => Math.round(n * 10) / 10;

export function evaluateRisks(input: RiskInput): RiskFlag[] {
  const now = input.now ?? new Date();
  const flags: RiskFlag[] = [];
  const { facts } = input;

  if (facts.bcs9 !== null) {
    if (facts.bcs9 > 5) flags.push({ type: 'bcs_high', severity: facts.bcs9 >= 8 ? 'act' : 'watch', params: { bcs9: facts.bcs9 } });
    if (facts.bcs9 < 4) flags.push({ type: 'bcs_low', severity: facts.bcs9 <= 2 ? 'act' : 'watch', params: { bcs9: facts.bcs9 } });
  }
  if (facts.muscleCondition && facts.muscleCondition !== 'normal') {
    flags.push({ type: 'muscle_loss', severity: facts.muscleCondition === 'mild' ? 'watch' : 'act', params: { level: facts.muscleCondition } });
  }

  const series = input.weights
    .filter(w => w.kg > 0 && !Number.isNaN(new Date(w.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const latest = series[series.length - 1];

  if (!latest || now.getTime() - new Date(latest.at).getTime() > RULE_LIMITS.staleWeightDays * DAY) {
    flags.push({ type: 'no_recent_weight', severity: 'info', params: { days: RULE_LIMITS.staleWeightDays } });
  }

  if (latest) {
    // Rapid loss: compare with the earliest weight in the last 6 weeks that is at least a week older.
    const windowStart = new Date(latest.at).getTime() - 42 * DAY;
    const base = series.find(w => {
      const t = new Date(w.at).getTime();
      return t >= windowStart && new Date(latest.at).getTime() - t >= 7 * DAY;
    });
    if (base) {
      const weeks = (new Date(latest.at).getTime() - new Date(base.at).getTime()) / (7 * DAY);
      const lossPctPerWeek = ((base.kg - latest.kg) / base.kg) * 100 / weeks;
      if (lossPctPerWeek > RULE_LIMITS.rapidLossPctPerWeek) {
        flags.push({ type: 'rapid_weight_loss', severity: 'act', params: { pctPerWeek: pct(lossPctPerWeek), weeks: pct(weeks) } });
      }
    }
    // Drift while the goal is to hold weight steady.
    if (!input.goal || input.goal === 'maintain') {
      const older = series.filter(w => new Date(latest.at).getTime() - new Date(w.at).getTime() >= RULE_LIMITS.driftMinDays * DAY
        && new Date(latest.at).getTime() - new Date(w.at).getTime() <= 120 * DAY);
      const ref = older[older.length - 1];
      if (ref) {
        const change = ((latest.kg - ref.kg) / ref.kg) * 100;
        if (Math.abs(change) > RULE_LIMITS.driftPct && !flags.some(f => f.type === 'rapid_weight_loss')) {
          flags.push({ type: 'weight_drift', severity: 'watch', params: { pct: pct(change) } });
        }
      }
    }
  }

  if (input.feeding7d) {
    const total = input.feeding7d.mealKcal + input.feeding7d.treatKcal;
    if (total > 0) {
      const share = (input.feeding7d.treatKcal / total) * 100;
      if (share > RULE_LIMITS.treatSharePct) flags.push({ type: 'treats_over_limit', severity: 'watch', params: { pct: pct(share) } });
    }
  }
  return flags;
}

/**
 * Whole-word matching for the unsafe-food check: "Dark chocolate cake" matches "chocolate", "grapes" matches
 * "grape", but "teaspoon" does not match "tea". A multi-word term ("cooked bone") must appear as a phrase.
 */
export function matchesUnsafe(text: string, terms: string[]): boolean {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const phrase = ` ${words.join(' ')} `;
  return terms.some(term => {
    const n = term.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
    if (n.length < 2) return false;
    if (n.includes(' ')) return phrase.includes(` ${n} `) || phrase.includes(` ${n}s `);
    return words.some(w => w === n || w === `${n}s` || w === `${n}es`);
  });
}
