import { balanceEquineRation, equineNeed, type EquineFeedOption, type EquineRequirements } from '../../src/services/nutrition/engine/equineRation';

// Starting values from migration 060 (horse set).
const horse: EquineRequirements = {
  deMaintenancePerKgBw: 0.0333,
  workFactor: { low: 1, moderate: 1.2, high: 1.4, working: 1.6 },
  cpGPerMcalDe: 38, caGPerKgBw: 0.04, pGPerKgBw: 0.028,
  dmiMinPctBw: 1.5, dmiMaxPctBw: 2.5, forageMinPctBw: 1.0, concentrateMaxPctDm: 50,
};

const feed = (o: Partial<EquineFeedOption> & { key: string }): EquineFeedOption => ({
  label: o.key, isForage: false, dmPct: 90, deMcalPerKgDm: 2, cpPctDm: 10, caPctDm: 0.3, pPctDm: 0.3, pricePerKgAsFed: 10, ...o,
});

const hay = feed({ key: 'hay', isForage: true, dmPct: 88, deMcalPerKgDm: 2.0, cpPctDm: 8, caPctDm: 0.45, pPctDm: 0.22, pricePerKgAsFed: 8 });
const lucerne = feed({ key: 'lucerne', isForage: true, dmPct: 90, deMcalPerKgDm: 2.3, cpPctDm: 18, caPctDm: 1.4, pPctDm: 0.25, pricePerKgAsFed: 18 });
const oats = feed({ key: 'oats', dmPct: 89, deMcalPerKgDm: 3.2, cpPctDm: 12.5, caPctDm: 0.09, pPctDm: 0.38, pricePerKgAsFed: 30 });
const bran = feed({ key: 'bran', dmPct: 89, deMcalPerKgDm: 3.0, cpPctDm: 16, caPctDm: 0.13, pPctDm: 1.1, pricePerKgAsFed: 22 });
const mineral = feed({ key: 'mineral', dmPct: 98, deMcalPerKgDm: 0, cpPctDm: 0, caPctDm: 20, pPctDm: 10, pricePerKgAsFed: 80 });

describe('equine ration (horses, donkeys)', () => {
  it('need: 450 kg horse in light work needs 18 Mcal DE and ~684 g protein', () => {
    const n = equineNeed({ bodyWeightKg: 450, work: 'moderate', requirements: horse });
    expect(n.deMcal).toBeCloseTo(17.98, 1);
    expect(n.cpMinG).toBe(683);
    expect(n.dmiMaxKg).toBe(11.25);
    expect(n.forageMinKg).toBe(4.5);
  });

  it('more work means more energy, in proportion to the factor', () => {
    const low = equineNeed({ bodyWeightKg: 400, work: 'low', requirements: horse }).deMcal;
    const heavy = equineNeed({ bodyWeightKg: 400, work: 'working', requirements: horse }).deMcal;
    expect(heavy / low).toBeCloseTo(1.6, 2);
  });

  it('balances a forage-first ration that meets every need within the grain cap', () => {
    const r = balanceEquineRation({ bodyWeightKg: 450, work: 'high', requirements: horse, feeds: [hay, lucerne, oats, bran, mineral] });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.supplied.deMcal).toBeGreaterThanOrEqual(r.need.deMcal - 0.01);
    expect(r.supplied.cpG).toBeGreaterThanOrEqual(r.need.cpMinG - 1);
    expect(r.supplied.caG).toBeGreaterThanOrEqual(r.need.caMinG - 0.1);
    expect(r.supplied.forageKg).toBeGreaterThanOrEqual(r.need.forageMinKg - 0.01);
    expect(r.supplied.concentratePct).toBeLessThanOrEqual(50.01);
    expect(r.supplied.dmKg).toBeLessThanOrEqual(r.need.dmiMaxKg + 0.01);
    expect(r.totalCostPerDay).toBeGreaterThan(0);
    expect(r.costPerLitre).toBeNull();
  });

  it('grain alone is refused: no forage', () => {
    const r = balanceEquineRation({ bodyWeightKg: 450, work: 'low', requirements: horse, feeds: [oats, bran] });
    expect(r.status).toBe('infeasible');
    if (r.status === 'infeasible') expect(r.reasons).toContain('no_forage');
  });

  it('a hard-working horse on poor hay with grain capped says the grain limit is why', () => {
    const poorHay = feed({ key: 'poor', isForage: true, dmPct: 90, deMcalPerKgDm: 1.6, cpPctDm: 6, caPctDm: 0.3, pPctDm: 0.2 });
    const r = balanceEquineRation({ bodyWeightKg: 500, work: 'working', requirements: { ...horse, concentrateMaxPctDm: 20 }, feeds: [poorHay, oats, mineral] });
    expect(r.status).toBe('infeasible');
    if (r.status === 'infeasible') expect(r.reasons.some(x => x === 'grain_capped' || x === 'energy_too_low')).toBe(true);
  });

  it('a donkey (75% energy, lower intake) is cheaper to feed than a horse of the same weight', () => {
    const donkey: EquineRequirements = { ...horse, deMaintenancePerKgBw: 0.025, dmiMinPctBw: 1.3, dmiMaxPctBw: 1.8, concentrateMaxPctDm: 25 };
    const feeds = [hay, bran, mineral];
    const h = balanceEquineRation({ bodyWeightKg: 200, work: 'moderate', requirements: horse, feeds });
    const d = balanceEquineRation({ bodyWeightKg: 200, work: 'moderate', requirements: donkey, feeds });
    expect(h.status).toBe('ok');
    expect(d.status).toBe('ok');
    if (h.status === 'ok' && d.status === 'ok') expect(d.totalCostPerDay).toBeLessThan(h.totalCostPerDay);
  });
});
