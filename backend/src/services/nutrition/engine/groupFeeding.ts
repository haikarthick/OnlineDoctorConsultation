/**
 * Daily feed for a GROUP - a poultry flock, a pig batch (nutrition model `monogastric_spec`) or a fish / shrimp
 * pond (`aqua_biomass`) - and how well the feed turned into product (FCR). docs/NUTRITION_PLAN.md §5.3 item 4.
 *
 * Every number comes from a feeding-curve row in master data (admin-editable, source + status) - this file holds
 * only the method:
 *   per_head (poultry, pigs):    feed/day = head count x grams per head per day for the age band
 *   percent_biomass (aquaculture): biomass = count x average body weight (g); feed/day = biomass x rate% for that
 *                                weight band, scaled by the water-temperature factor (fish eat less when cold/hot)
 *   FCR = feed given / weight gained (or feed / kg eggs for layers) over the same days, from Daily records.
 */

export interface FeedingCurveRow {
  /** Expected survival (%) of the animals that reach this size band (ponds: the farmer cannot count the dead). */
  survivalPct?: number | null;
  basis: 'per_head' | 'percent_biomass';
  ageFromDays: number | null;
  ageToDays: number | null;
  weightFromG: number | null;
  weightToG: number | null;
  gramsPerHeadDay: number | null;
  ratePctBiomass: number | null;
  feedsPerDay: number | null;
  feedType: string | null;
}

export interface TemperatureFactor { fromC: number; toC: number; factor: number }

export interface GroupFeedInput {
  headCount: number;
  ageDays?: number | null;
  avgWeightG?: number | null;
  waterTempC?: number | null;
  /** True when headCount is a count of live animals (not stocked), so no survival is applied. */
  headCountIsLive?: boolean;
  curve: FeedingCurveRow[];
  temperature?: TemperatureFactor[];
  pricePerKg?: number | null;
}

export type GroupFeedResult =
  | { status: 'ok'; basis: 'per_head' | 'percent_biomass'; survivalPct?: number | null; kgPerDay: number; gramsPerHead: number | null; biomassKg: number | null;
      ratePct: number | null; tempFactor: number; feedsPerDay: number | null; feedType: string | null; costPerDay: number | null }
  | { status: 'needs'; missing: Array<'head_count' | 'age' | 'average_weight' | 'curve'> };

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function groupDailyFeed(input: GroupFeedInput): GroupFeedResult {
  if (!(input.headCount > 0)) return { status: 'needs', missing: ['head_count'] };
  if (!input.curve.length) return { status: 'needs', missing: ['curve'] };
  const basis = input.curve[0].basis;

  if (basis === 'per_head') {
    if (input.ageDays === null || input.ageDays === undefined || input.ageDays < 0) return { status: 'needs', missing: ['age'] };
    const age = input.ageDays;
    const row = input.curve.find(r => (r.ageFromDays ?? 0) <= age && age <= (r.ageToDays ?? Infinity))
      ?? [...input.curve].sort((a, b) => (b.ageToDays ?? 0) - (a.ageToDays ?? 0))[0];
    const g = row.gramsPerHeadDay ?? 0;
    const kg = (g * input.headCount) / 1000;
    return {
      status: 'ok', basis, kgPerDay: round(kg, 1), gramsPerHead: g, biomassKg: null, ratePct: null, tempFactor: 1,
      feedsPerDay: row.feedsPerDay, feedType: row.feedType,
      costPerDay: input.pricePerKg !== null && input.pricePerKg !== undefined ? round(kg * input.pricePerKg) : null,
    };
  }

  if (!(input.avgWeightG && input.avgWeightG > 0)) return { status: 'needs', missing: ['average_weight'] };
  const w = input.avgWeightG;
  const row = input.curve.find(r => (r.weightFromG ?? 0) <= w && w < (r.weightToG ?? Infinity))
    ?? [...input.curve].sort((a, b) => (b.weightToG ?? 0) - (a.weightToG ?? 0))[0];
  // Ponds: the count is what was STOCKED; feed what is still alive. The curve gives the survival to expect at this size,
  // unless the farmer recorded a real count (headCountIsLive).
  const live = input.headCountIsLive || row.survivalPct === null || row.survivalPct === undefined ? 1 : row.survivalPct / 100;
  const biomassKg = (input.headCount * live * w) / 1000;
  let tempFactor = 1;
  if (input.waterTempC !== null && input.waterTempC !== undefined && input.temperature?.length) {
    const t = input.temperature.find(x => x.fromC <= input.waterTempC! && input.waterTempC! < x.toC);
    if (t) tempFactor = t.factor;
  }
  const rate = (row.ratePctBiomass ?? 0) * tempFactor;
  const kg = biomassKg * rate / 100;
  return {
    status: 'ok', basis, kgPerDay: round(kg, 1), gramsPerHead: null, biomassKg: round(biomassKg, 1), ratePct: round(rate, 2),
    survivalPct: live < 1 ? round(live * 100, 0) : null,
    tempFactor, feedsPerDay: row.feedsPerDay, feedType: row.feedType,
    costPerDay: input.pricePerKg !== null && input.pricePerKg !== undefined ? round(kg * input.pricePerKg) : null,
  };
}

/**
 * Feed conversion ratio over a period: kg feed per kg of product. Product is the weight gained by the group
 * (meat birds, pigs, fish) or the egg mass laid (layers). Null when either side is missing or zero.
 */
export function fcr(feedKg: number | null, productKg: number | null): number | null {
  if (!feedKg || !productKg || feedKg <= 0 || productKg <= 0) return null;
  return round(feedKg / productKg, 2);
}
