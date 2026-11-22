import { balanceRuminantRation, ruminantNeed, type FeedOption, type RuminantRequirements } from '../../src/services/nutrition/engine/ruminantRation';

const req: RuminantRequirements = {
  nelMaintenancePerKgBw075: 0.08, latePregnancyExtraFraction: 0.25,
  dmiMinPctBw: 2.0, dmiMaxPctBw: 3.5,
  cpMinPctDm: 14, caMinPctDm: 0.6, pMinPctDm: 0.38, ndfMinPctDm: 28, forageMinPctDm: 40,
  milkFatPct: 4.0, milkProteinPct: 3.2, milkLactosePct: 4.8,
};

const feeds: FeedOption[] = [
  { key: 'maize', label: 'Green maize', isForage: true, dmPct: 20, nelMcalPerKgDm: 1.3, cpPctDm: 8, caPctDm: 0.35, pPctDm: 0.2, ndfPctDm: 55, pricePerKgAsFed: 2 },
  { key: 'straw', label: 'Wheat straw', isForage: true, dmPct: 90, nelMcalPerKgDm: 0.9, cpPctDm: 3.5, caPctDm: 0.2, pPctDm: 0.08, ndfPctDm: 75, pricePerKgAsFed: 6 },
  { key: 'feed', label: 'Cattle feed', isForage: false, dmPct: 90, nelMcalPerKgDm: 1.65, cpPctDm: 22, caPctDm: 0.8, pPctDm: 0.6, ndfPctDm: 25, pricePerKgAsFed: 25 },
  { key: 'gnc', label: 'Groundnut cake', isForage: false, dmPct: 92, nelMcalPerKgDm: 1.75, cpPctDm: 45, caPctDm: 0.2, pPctDm: 0.6, ndfPctDm: 15, pricePerKgAsFed: 45 },
  { key: 'mineral', label: 'Mineral mixture', isForage: false, dmPct: 98, nelMcalPerKgDm: 0, cpPctDm: 0, caPctDm: 22, pPctDm: 11, ndfPctDm: 0, pricePerKgAsFed: 80 },
];

describe('ruminant ration (least cost)', () => {
  it('works out the day\'s need with the NRC 2001 milk energy equation', () => {
    const need = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 10, state: 'lactating', requirements: req });
    expect(need.nelMaintenance).toBeCloseTo(7.16, 1);
    expect(need.nelPerKgMilk).toBeCloseTo(0.736, 2);
    expect(need.nelMcal).toBeCloseTo(7.16 + 10.3 * 0.736, 0);
    expect(need.dmiMaxKg).toBe(14);
  });

  it('late pregnancy adds the allowance; far from calving it does not', () => {
    const near = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 0, monthsToCalving: 1, state: 'dry', requirements: req });
    const far = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 0, monthsToCalving: 5, state: 'dry', requirements: req });
    expect(near.nelPregnancy).toBeGreaterThan(0);
    expect(far.nelPregnancy).toBe(0);
  });

  it('a 400 kg cow giving 10 L: meets every need inside her eating capacity, at the lowest cost', () => {
    const r = balanceRuminantRation({ bodyWeightKg: 400, milkLitresPerDay: 10, state: 'lactating', requirements: req, feeds });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.supplied.nelMcal).toBeGreaterThanOrEqual(r.need.nelMcal - 0.01);
    expect(r.supplied.dmKg).toBeLessThanOrEqual(r.need.dmiMaxKg + 0.01);
    expect(r.supplied.dmKg).toBeGreaterThanOrEqual(r.need.dmiMinKg - 0.01);
    expect(r.supplied.cpKg / r.supplied.dmKg * 100).toBeGreaterThanOrEqual(14 - 0.05);
    expect(r.supplied.caKg / r.supplied.dmKg * 100).toBeGreaterThanOrEqual(0.6 - 0.01);
    expect(r.supplied.foragePct).toBeGreaterThanOrEqual(40 - 0.1);
    expect(r.costPerLitre).toBeCloseTo(r.totalCostPerDay / 10, 2);
    // Cheaper than feeding the same energy from cattle feed alone.
    expect(r.totalCostPerDay).toBeLessThan((r.need.nelMcal / 1.65 / 0.9) * 25);
  });

  it('respects the farmer\'s own limit on a feed', () => {
    const limited = feeds.map(f => (f.key === 'maize' ? { ...f, maxKgAsFed: 10 } : f))
    const r = balanceRuminantRation({ bodyWeightKg: 400, milkLitresPerDay: 10, state: 'lactating', requirements: req, feeds: limited });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.lines.find(l => l.key === 'maize')?.kgAsFedPerDay ?? 0).toBeLessThanOrEqual(10.05);
  });

  it('says why a ration cannot be balanced (only straw: energy and protein too low)', () => {
    const r = balanceRuminantRation({ bodyWeightKg: 400, milkLitresPerDay: 15, state: 'lactating', requirements: req, feeds: [feeds[1]] });
    expect(r.status).toBe('infeasible');
    if (r.status === 'infeasible') expect(r.reasons).toEqual(expect.arrayContaining(['energy_too_low', 'protein_too_low']));
  });
});
