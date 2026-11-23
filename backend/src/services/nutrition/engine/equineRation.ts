import { solveLp, type LpConstraint } from './leastCost';

/**
 * Ration for horses, ponies, donkeys and mules (nutrition model `equine_dm`), per animal per day.
 *
 * Horses are hind-gut fermenters, not ruminants: the ration is FORAGE FIRST (hay / green grass make up most of
 * the day's dry matter, at least a set % of body weight) and grain / concentrate is capped, because too much
 * starch at once causes colic and laminitis. Within those rails the method is the same least-cost balance the
 * ruminant ration uses (engine/leastCost.ts):
 *
 *   energy (DE, Mcal/day)   = maintenance x body weight x work factor (by the animal's activity level)
 *   protein (g CP/day)      >= g CP per Mcal DE x the day's DE
 *   calcium, phosphorus     = g per kg body weight per day x work factor
 *   dry matter              = between a min and max % of body weight
 *   forage dry matter       >= % of body weight          (gut health)
 *   concentrate             <= % of the day's dry matter (colic / laminitis)
 *
 * The shape of the method follows NRC (2007) Nutrient Requirements of Horses (maintenance DE proportional to body
 * weight, work as a multiple of maintenance). EVERY coefficient comes from the requirement set passed in (admin
 * data with source and status for the owner's vet) - this file holds the method, not the numbers.
 */

export type EquineWork = 'low' | 'moderate' | 'high' | 'working';

export interface EquineRequirements {
  /** Mcal DE per kg body weight per day at maintenance. */
  deMaintenancePerKgBw: number;
  /** Multiple of maintenance by activity level. */
  workFactor: Record<EquineWork, number>;
  /** Minimum grams of crude protein per Mcal DE. */
  cpGPerMcalDe: number;
  /** g per kg body weight per day at maintenance (scaled by the work factor). */
  caGPerKgBw: number;
  pGPerKgBw: number;
  /** Dry matter the animal can eat, % of body weight. */
  dmiMinPctBw: number;
  dmiMaxPctBw: number;
  /** Forage dry matter at least this % of body weight. */
  forageMinPctBw: number;
  /** Concentrate at most this % of the day's dry matter. */
  concentrateMaxPctDm: number;
}

export interface EquineFeedOption {
  key: string;
  label: string;
  isForage: boolean;
  /** As fed. */
  dmPct: number;
  /** Per kg dry matter. */
  deMcalPerKgDm: number;
  cpPctDm: number;
  caPctDm: number;
  pPctDm: number;
  /** Per kg AS FED. 0 = home-grown / free. */
  pricePerKgAsFed: number;
  minKgAsFed?: number | null;
  maxKgAsFed?: number | null;
}

export interface EquineInput {
  bodyWeightKg: number;
  work: EquineWork;
  requirements: EquineRequirements;
  feeds: EquineFeedOption[];
}

export interface EquineNeed {
  deMcal: number;
  deMaintenance: number;
  workFactor: number;
  cpMinG: number;
  caMinG: number;
  pMinG: number;
  dmiMinKg: number;
  dmiMaxKg: number;
  forageMinKg: number;
  concentrateMaxPctDm: number;
}

export interface EquineLine { key: string; label: string; kgAsFedPerDay: number; kgDmPerDay: number; costPerDay: number }

export type EquineResult =
  | { status: 'ok'; need: EquineNeed; lines: EquineLine[]; totalCostPerDay: number; costPerLitre: null;
      supplied: { dmKg: number; deMcal: number; cpG: number; caG: number; pG: number; forageKg: number; concentratePct: number } }
  | { status: 'infeasible'; need: EquineNeed; reasons: string[] };

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function equineNeed(input: Omit<EquineInput, 'feeds'>): EquineNeed {
  const r = input.requirements;
  const bw = input.bodyWeightKg;
  const factor = r.workFactor[input.work] ?? r.workFactor.low ?? 1;
  const deMaintenance = r.deMaintenancePerKgBw * bw;
  const de = deMaintenance * factor;
  return {
    deMcal: round(de), deMaintenance: round(deMaintenance), workFactor: factor,
    cpMinG: round(r.cpGPerMcalDe * de, 0),
    caMinG: round(r.caGPerKgBw * bw * factor, 1),
    pMinG: round(r.pGPerKgBw * bw * factor, 1),
    dmiMinKg: round(bw * r.dmiMinPctBw / 100),
    dmiMaxKg: round(bw * r.dmiMaxPctBw / 100),
    forageMinKg: round(bw * r.forageMinPctBw / 100),
    concentrateMaxPctDm: r.concentrateMaxPctDm,
  };
}

export function balanceEquineRation(input: EquineInput): EquineResult {
  const need = equineNeed(input);
  const feeds = input.feeds.filter(f => f.dmPct > 0);
  if (feeds.length === 0) return { status: 'infeasible', need, reasons: ['no_feeds'] };

  // Decision variable: kg DRY MATTER of each feed.
  const costs = feeds.map(f => f.pricePerKgAsFed / (f.dmPct / 100));
  const row = (fn: (f: EquineFeedOption) => number) => feeds.map(fn);
  const cap = need.concentrateMaxPctDm;
  const constraints: LpConstraint[] = [
    { name: 'energy', coefficients: row(f => f.deMcalPerKgDm), kind: '>=', rhs: need.deMcal },
    { name: 'dmi_min', coefficients: row(() => 1), kind: '>=', rhs: need.dmiMinKg },
    { name: 'dmi_max', coefficients: row(() => 1), kind: '<=', rhs: need.dmiMaxKg },
    // grams per day: kg DM x %/100 x 1000
    { name: 'protein', coefficients: row(f => f.cpPctDm * 10), kind: '>=', rhs: need.cpMinG },
    { name: 'calcium', coefficients: row(f => f.caPctDm * 10), kind: '>=', rhs: need.caMinG },
    { name: 'phosphorus', coefficients: row(f => f.pPctDm * 10), kind: '>=', rhs: need.pMinG },
    { name: 'forage', coefficients: row(f => (f.isForage ? 1 : 0)), kind: '>=', rhs: need.forageMinKg },
    // concentrate share of DM <= cap, linearised: sum(x_j * ((isConc ? 100 : 0) - cap)) <= 0
    { name: 'concentrate', coefficients: row(f => (f.isForage ? 0 : 100) - cap), kind: '<=', rhs: 0 },
  ];
  feeds.forEach((f, j) => {
    const unit = feeds.map((_, k) => (k === j ? 1 : 0));
    if (f.maxKgAsFed !== null && f.maxKgAsFed !== undefined) constraints.push({ name: `max_${f.key}`, coefficients: unit, kind: '<=', rhs: f.maxKgAsFed * f.dmPct / 100 });
    if (f.minKgAsFed) constraints.push({ name: `min_${f.key}`, coefficients: unit, kind: '>=', rhs: f.minKgAsFed * f.dmPct / 100 });
  });

  const res = solveLp({ costs, constraints });
  if (res.status !== 'optimal') return { status: 'infeasible', need, reasons: diagnose(feeds, need) };

  const lines: EquineLine[] = feeds.map((f, j) => {
    const dm = res.x[j];
    const asFed = dm / (f.dmPct / 100);
    return { key: f.key, label: f.label, kgDmPerDay: round(dm), kgAsFedPerDay: round(asFed, 1), costPerDay: round(asFed * f.pricePerKgAsFed) };
  }).filter(l => l.kgDmPerDay > 0.005);
  const dmKg = res.x.reduce((s, v) => s + v, 0);
  const sum = (fn: (f: EquineFeedOption) => number) => res.x.reduce((s, v, j) => s + v * fn(feeds[j]), 0);
  const forageKg = sum(f => (f.isForage ? 1 : 0));
  return {
    status: 'ok', need, lines, totalCostPerDay: round(lines.reduce((s, l) => s + l.costPerDay, 0)), costPerLitre: null,
    supplied: {
      dmKg: round(dmKg), deMcal: round(sum(f => f.deMcalPerKgDm)), cpG: round(sum(f => f.cpPctDm * 10), 0),
      caG: round(sum(f => f.caPctDm * 10), 1), pG: round(sum(f => f.pPctDm * 10), 1), forageKg: round(forageKg),
      concentratePct: dmKg > 0 ? round((dmKg - forageKg) / dmKg * 100, 1) : 0,
    },
  };
}

/** Plain reasons a ration cannot be balanced with these feeds - each maps to an action for the owner. */
function diagnose(feeds: EquineFeedOption[], need: EquineNeed): string[] {
  const reasons: string[] = [];
  if (!feeds.some(f => f.isForage)) reasons.push('no_forage');
  const best = Math.max(...feeds.map(f => f.deMcalPerKgDm));
  if (best * need.dmiMaxKg < need.deMcal) reasons.push('energy_too_low');
  // Forage alone at the most the horse can eat, plus the allowed concentrate, still short of energy.
  const bestForage = Math.max(0, ...feeds.filter(f => f.isForage).map(f => f.deMcalPerKgDm));
  const bestConc = Math.max(0, ...feeds.filter(f => !f.isForage).map(f => f.deMcalPerKgDm));
  const cap = need.concentrateMaxPctDm / 100;
  if (!reasons.includes('energy_too_low') && need.dmiMaxKg * ((1 - cap) * bestForage + cap * bestConc) < need.deMcal) reasons.push('grain_capped');
  if (!feeds.some(f => f.cpPctDm * 10 * need.dmiMaxKg >= need.cpMinG)) reasons.push('protein_too_low');
  if (!feeds.some(f => f.caPctDm > 0.5) && !feeds.some(f => f.pPctDm > 0.5)) reasons.push('minerals_missing');
  if (reasons.length === 0) reasons.push('limits_too_tight');
  return reasons;
}
