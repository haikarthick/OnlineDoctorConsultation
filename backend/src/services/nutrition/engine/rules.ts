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
 *   - condition lost after giving birth (farm and pets): losing about half a point (5-point scale) in the first
 *     ~100 days of lactation is a warning, a full point or more is the classic sign of negative energy balance
 *     (ketosis / fertility risk) in dairy herd-health guidance. Expressed on the 9-point scale: 1 and 2 points.
 *   - herd feed vs need: feed recorded in Daily records below 80% or above 125% of the feeding table's amount over
 *     the last week (at least 4 days recorded) - a platform default, pending vet validation.
 */
export const RULE_LIMITS = {
  rapidLossPctPerWeek: 2,
  driftPct: 5,
  driftMinDays: 28,
  staleWeightDays: 90,
  treatSharePct: 10,
  transitionDays: 100,
  transitionDropWatch9: 1,
  transitionDropAct9: 2,
  groupFeedLowPct: 80,
  groupFeedHighPct: 125,
  groupFeedMinDays: 4,
} as const;

export type FlagType =
  | 'bcs_high' | 'bcs_low' | 'muscle_loss' | 'rapid_weight_loss' | 'weight_drift'
  | 'no_recent_weight' | 'treats_over_limit' | 'unsafe_food_logged'
  | 'transition_condition_loss' | 'feed_below_need' | 'feed_above_need';

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
  /** Body condition history on the 9-point scale, any order. */
  conditions?: Array<{ bcs9: number; at: string }>;
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

  // Condition lost since giving birth (negative energy balance). Reference: the score nearest the birth (up to 30 days
  // before, or 14 days after); compared with the latest score taken after the birth.
  if (facts.lastBirthDate && input.conditions && input.conditions.length >= 2) {
    const birth = new Date(facts.lastBirthDate).getTime();
    const sinceBirth = (now.getTime() - birth) / DAY;
    if (!Number.isNaN(birth) && sinceBirth >= 0 && sinceBirth <= RULE_LIMITS.transitionDays) {
      const pts = input.conditions
        .filter(c => c.bcs9 > 0 && !Number.isNaN(new Date(c.at).getTime()))
        .map(c => ({ bcs9: c.bcs9, t: new Date(c.at).getTime() }))
        .sort((a, b) => a.t - b.t);
      const around = pts.filter(c => c.t >= birth - 30 * DAY && c.t <= birth + 14 * DAY);
      const ref = around.sort((a, b) => Math.abs(a.t - birth) - Math.abs(b.t - birth))[0];
      const after = pts.filter(c => c.t > birth && (!ref || c.t > ref.t));
      const last = after[after.length - 1];
      if (ref && last) {
        const drop = Math.round((ref.bcs9 - last.bcs9) * 10) / 10;
        if (drop >= RULE_LIMITS.transitionDropWatch9) {
          flags.push({
            type: 'transition_condition_loss', severity: drop >= RULE_LIMITS.transitionDropAct9 ? 'act' : 'watch',
            params: { drop5: Math.round(drop / 2 * 10) / 10, days: Math.round(sinceBirth) },
          });
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

/**
 * A flock / pig batch / pond fed well below or above its feeding table over the last week. Only judged when enough
 * days are recorded - a farmer who records twice a week is not told the animals are starving.
 */
export function evaluateGroupFeed(input: { suggestedKgPerDay: number | null; recorded: Array<{ date: string; kg: number }>; now?: Date }): RiskFlag[] {
  const now = input.now ?? new Date();
  if (!input.suggestedKgPerDay || input.suggestedKgPerDay <= 0) return [];
  const since = now.getTime() - 7 * DAY;
  const byDay = new Map<string, number>();
  for (const r of input.recorded) {
    const t = new Date(r.date).getTime();
    if (Number.isNaN(t) || t < since || t > now.getTime() || !(r.kg >= 0)) continue;
    const key = r.date.slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + r.kg);
  }
  if (byDay.size < RULE_LIMITS.groupFeedMinDays) return [];
  const avg = [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size;
  const ratio = (avg / input.suggestedKgPerDay) * 100;
  if (ratio < RULE_LIMITS.groupFeedLowPct) return [{ type: 'feed_below_need', severity: 'watch', params: { pct: Math.round(ratio), days: byDay.size } }];
  if (ratio > RULE_LIMITS.groupFeedHighPct) return [{ type: 'feed_above_need', severity: 'watch', params: { pct: Math.round(ratio), days: byDay.size } }];
  return [];
}
