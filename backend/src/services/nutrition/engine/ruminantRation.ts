import { solveLp, type LpConstraint } from './leastCost';

/**
 * Ration for cattle, buffalo, goats, sheep, camels (nutrition model `ruminant_dm`), per animal per day.
 * The approach national ration-balancing programmes take (NDDB RBP, docs/NUTRITION_PLAN.md §2.2): work out the
 * day's need for energy, protein and minerals, then the CHEAPEST mix of the farmer's own feeds that meets it
 * inside the animal's eating capacity and sensible per-feed limits.
 *
 * Need (all per day):
 *   energy (NEL, Mcal) = maintenance x BW^0.75  +  milk litres x NEL per kg milk  (+ late-pregnancy allowance)
 *     NEL per kg milk  = 0.0929 x fat% + 0.0547 x protein% + 0.0395 x lactose%   (NRC 2001 dairy equation)
 *   protein, Ca, P, fibre = % of the day's dry matter, by physiological state
 *   dry matter capacity  = % of body weight (min / max)
 *
 * EVERY coefficient comes from the requirement set passed in (admin data, source + status, vet-validated by the
 * owner's vet) - this file holds the method, not the numbers. Results are a suggestion until a vet reviews them.
 */

export type RuminantState = 'lactating' | 'dry' | 'growing' | 'maintenance';

export interface RuminantRequirements {
  /** Mcal NEL per kg^0.75 body weight per day. */
  nelMaintenancePerKgBw075: number;
  /** Extra NEL in the last two months of pregnancy, as a fraction of maintenance. */
  latePregnancyExtraFraction: number;
  /** Dry matter the animal can eat, % of body weight. */
  dmiMinPctBw: number;
  dmiMaxPctBw: number;
  /** % of dry matter. */
  cpMinPctDm: number;
  caMinPctDm: number;
  pMinPctDm: number;
  ndfMinPctDm: number;
  /** Forage (roughage) share of dry matter, minimum % - rumen health. */
  forageMinPctDm: number;
  /** Default milk composition when the farmer has not recorded it. */
  milkFatPct: number;
  milkProteinPct: number;
  milkLactosePct: number;
}

export interface FeedOption {
  key: string;
  label: string;
  isForage: boolean;
  /** As fed. */
  dmPct: number;
  /** Per kg dry matter. */
  nelMcalPerKgDm: number;
  cpPctDm: number;
  caPctDm: number;
  pPctDm: number;
  ndfPctDm: number | null;
  /** Rupees (or any currency) per kg AS FED. 0 = home-grown / free. */
  pricePerKgAsFed: number;
  /** Farmer's limits, kg AS FED per day. */
  minKgAsFed?: number | null;
  maxKgAsFed?: number | null;
}

export interface RuminantInput {
  bodyWeightKg: number;
  milkLitresPerDay: number;
  milkFatPct?: number | null;
  /** Months to expected calving; <= 2 adds the late-pregnancy allowance. */
  monthsToCalving?: number | null;
  state: RuminantState;
  requirements: RuminantRequirements;
  feeds: FeedOption[];
}

export interface RationLine {
  key: string;
  label: string;
  kgAsFedPerDay: number;
  kgDmPerDay: number;
  costPerDay: number;
}

export interface RuminantNeed {
  nelMcal: number;
  nelMaintenance: number;
  nelMilk: number;
  nelPregnancy: number;
  nelPerKgMilk: number;
  dmiMinKg: number;
  dmiMaxKg: number;
  cpMinPctDm: number;
  caMinPctDm: number;
  pMinPctDm: number;
}

export type RuminantResult =
  | { status: 'ok'; need: RuminantNeed; lines: RationLine[]; totalCostPerDay: number; costPerLitre: number | null; supplied: { dmKg: number; nelMcal: number; cpKg: number; caKg: number; pKg: number; foragePct: number } }
  | { status: 'infeasible'; need: RuminantNeed; reasons: string[] };

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function ruminantNeed(input: Omit<RuminantInput, 'feeds'>): RuminantNeed {
  const r = input.requirements;
  const bw075 = Math.pow(input.bodyWeightKg, 0.75);
  const nelMaintenance = r.nelMaintenancePerKgBw075 * bw075;
  const fat = input.milkFatPct && input.milkFatPct > 0 ? input.milkFatPct : r.milkFatPct;
  const nelPerKgMilk = 0.0929 * fat + 0.0547 * r.milkProteinPct + 0.0395 * r.milkLactosePct;
  const milk = Math.max(0, input.milkLitresPerDay || 0) * 1.03; // litres -> kg
  const nelMilk = milk * nelPerKgMilk;
  const nelPregnancy = input.monthsToCalving !== null && input.monthsToCalving !== undefined && input.monthsToCalving >= 0 && input.monthsToCalving <= 2
    ? nelMaintenance * r.latePregnancyExtraFraction : 0;
  return {
    nelMcal: round(nelMaintenance + nelMilk + nelPregnancy),
    nelMaintenance: round(nelMaintenance), nelMilk: round(nelMilk), nelPregnancy: round(nelPregnancy),
    nelPerKgMilk: round(nelPerKgMilk, 3),
    dmiMinKg: round(input.bodyWeightKg * r.dmiMinPctBw / 100),
    dmiMaxKg: round(input.bodyWeightKg * r.dmiMaxPctBw / 100),
    cpMinPctDm: r.cpMinPctDm, caMinPctDm: r.caMinPctDm, pMinPctDm: r.pMinPctDm,
  };
}

export function balanceRuminantRation(input: RuminantInput): RuminantResult {
  const need = ruminantNeed(input);
  const r = input.requirements;
  const feeds = input.feeds.filter(f => f.dmPct > 0);
  if (feeds.length === 0) return { status: 'infeasible', need, reasons: ['no_feeds'] };

  // Decision variable: kg DRY MATTER of each feed. Cost per kg DM = price per kg as fed / DM fraction.
  const costs = feeds.map(f => f.pricePerKgAsFed / (f.dmPct / 100));
  const row = (fn: (f: FeedOption) => number) => feeds.map(fn);
  const constraints: LpConstraint[] = [
    { name: 'energy', coefficients: row(f => f.nelMcalPerKgDm), kind: '>=', rhs: need.nelMcal },
    { name: 'dmi_min', coefficients: row(() => 1), kind: '>=', rhs: need.dmiMinKg },
    { name: 'dmi_max', coefficients: row(() => 1), kind: '<=', rhs: need.dmiMaxKg },
    // % of DM constraints, linearised: sum(x_j * (c_j - min)) >= 0
    { name: 'protein', coefficients: row(f => f.cpPctDm - r.cpMinPctDm), kind: '>=', rhs: 0 },
    { name: 'calcium', coefficients: row(f => f.caPctDm - r.caMinPctDm), kind: '>=', rhs: 0 },
    { name: 'phosphorus', coefficients: row(f => f.pPctDm - r.pMinPctDm), kind: '>=', rhs: 0 },
    { name: 'forage', coefficients: row(f => (f.isForage ? 100 : 0) - r.forageMinPctDm), kind: '>=', rhs: 0 },
  ];
  if (feeds.every(f => f.ndfPctDm !== null)) {
    constraints.push({ name: 'fibre', coefficients: row(f => (f.ndfPctDm as number) - r.ndfMinPctDm), kind: '>=', rhs: 0 });
  }
  feeds.forEach((f, j) => {
    const unit = feeds.map((_, k) => (k === j ? 1 : 0));
    if (f.maxKgAsFed !== null && f.maxKgAsFed !== undefined) constraints.push({ name: `max_${f.key}`, coefficients: unit, kind: '<=', rhs: f.maxKgAsFed * f.dmPct / 100 });
    if (f.minKgAsFed) constraints.push({ name: `min_${f.key}`, coefficients: unit, kind: '>=', rhs: f.minKgAsFed * f.dmPct / 100 });
  });

  const res = solveLp({ costs, constraints });
  if (res.status !== 'optimal') return { status: 'infeasible', need, reasons: diagnose(input, need) };

  const lines: RationLine[] = feeds.map((f, j) => {
    const dm = res.x[j];
    const asFed = dm / (f.dmPct / 100);
    return { key: f.key, label: f.label, kgDmPerDay: round(dm), kgAsFedPerDay: round(asFed, 1), costPerDay: round(asFed * f.pricePerKgAsFed) };
  }).filter(l => l.kgDmPerDay > 0.005);
  const dmKg = res.x.reduce((s, v) => s + v, 0);
  const sum = (fn: (f: FeedOption) => number) => res.x.reduce((s, v, j) => s + v * fn(feeds[j]), 0);
  const total = round(lines.reduce((s, l) => s + l.costPerDay, 0));
  return {
    status: 'ok', need, lines, totalCostPerDay: total,
    costPerLitre: input.milkLitresPerDay > 0 ? round(total / input.milkLitresPerDay) : null,
    supplied: {
      dmKg: round(dmKg), nelMcal: round(sum(f => f.nelMcalPerKgDm)), cpKg: round(sum(f => f.cpPctDm / 100)),
      caKg: round(sum(f => f.caPctDm / 100), 3), pKg: round(sum(f => f.pPctDm / 100), 3),
      foragePct: dmKg > 0 ? round(sum(f => (f.isForage ? 1 : 0)) / dmKg * 100, 1) : 0,
    },
  };
}

/** Plain reasons a ration cannot be balanced with these feeds - each maps to an action for the farmer. */
function diagnose(input: RuminantInput, need: RuminantNeed): string[] {
  const r = input.requirements;
  const feeds = input.feeds;
  const reasons: string[] = [];
  const bestNel = Math.max(...feeds.map(f => f.nelMcalPerKgDm));
  if (bestNel * need.dmiMaxKg < need.nelMcal) reasons.push('energy_too_low');
  if (!feeds.some(f => f.cpPctDm >= r.cpMinPctDm)) reasons.push('protein_too_low');
  if (!feeds.some(f => f.caPctDm >= r.caMinPctDm) || !feeds.some(f => f.pPctDm >= r.pMinPctDm)) reasons.push('minerals_missing');
  if (!feeds.some(f => f.isForage)) reasons.push('no_forage');
  if (reasons.length === 0) reasons.push('limits_too_tight');
  return reasons;
}
