import { balanceRuminantRation, ruminantNeed, type FeedOption, type RuminantRequirements } from '../../src/services/nutrition/engine/ruminantRation';
import { balanceEquineRation, equineNeed, type EquineFeedOption, type EquineRequirements } from '../../src/services/nutrition/engine/equineRation';
import { companionEnergy, growthEndMonths, suggestGoal } from '../../src/services/nutrition/engine/companionEnergy';
import { groupDailyFeed, type FeedingCurveRow } from '../../src/services/nutrition/engine/groupFeeding';
import { evaluateRisks, matchesUnsafe } from '../../src/services/nutrition/engine/rules';
import { missingFacts, type AnimalFacts } from '../../src/services/nutrition/engine/facts';

/** The domain review's SAFETY rows (docs/modules/nutrition-ledger.md), each pinned so it cannot regress. */

const cattleGrowing: RuminantRequirements = {
  nelMaintenancePerKgBw075: 0.08, latePregnancyExtraFraction: 0.25, dmiMinPctBw: 2.2, dmiMaxPctBw: 2.8,
  cpMinPctDm: 15, caMinPctDm: 0.55, pMinPctDm: 0.35, ndfMinPctDm: 30, forageMinPctDm: 50,
  milkFatPct: 4, milkProteinPct: 3.2, milkLactosePct: 4.8, targetAdgKg: 0.6, nelPerKgGain: 3.0, mineralAllowanceG: 50, firstLactationFraction: 0.2,
};
const feed = (o: Partial<FeedOption> & { key: string }): FeedOption => ({
  label: o.key, isForage: false, dmPct: 90, nelMcalPerKgDm: 1.6, cpPctDm: 18, caPctDm: 0.5, pPctDm: 0.5, ndfPctDm: 30, pricePerKgAsFed: 20, ...o,
});
const maize = feed({ key: 'maize', isForage: true, dmPct: 20, nelMcalPerKgDm: 1.3, cpPctDm: 8, caPctDm: 0.35, pPctDm: 0.2, ndfPctDm: 55, pricePerKgAsFed: 2 });
const berseem = feed({ key: 'berseem', isForage: true, dmPct: 18, nelMcalPerKgDm: 1.35, cpPctDm: 18, caPctDm: 1.5, pPctDm: 0.3, ndfPctDm: 42, pricePerKgAsFed: 3 });
const cake = feed({ key: 'cake', cpPctDm: 40, nelMcalPerKgDm: 1.75, pricePerKgAsFed: 40 });
const mineral = feed({ key: 'mineral', isMineral: true, dmPct: 98, nelMcalPerKgDm: 0, cpPctDm: 0, caPctDm: 20, pPctDm: 10, ndfPctDm: 0, pricePerKgAsFed: 80 });

describe('growing young stock (NUT-057)', () => {
  it('a 100 kg growing calf needs maintenance AND growth energy - not the dry-cow maintenance only', () => {
    const adult = ruminantNeed({ bodyWeightKg: 100, milkLitresPerDay: 0, state: 'dry', requirements: cattleGrowing });
    const calf = ruminantNeed({ bodyWeightKg: 100, milkLitresPerDay: 0, state: 'growing', requirements: cattleGrowing });
    expect(adult.nelGrowth).toBe(0);
    expect(calf.nelGrowth).toBeCloseTo(1.8, 1); // 0.6 kg/day x 3.0 Mcal
    expect(calf.nelMcal).toBeGreaterThan(adult.nelMcal + 1.7);
  });

  it('first lactation adds a share of maintenance; an older cow giving the same milk does not', () => {
    const first = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 10, state: 'lactating', firstLactation: true, requirements: cattleGrowing });
    const older = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 10, state: 'lactating', firstLactation: false, requirements: cattleGrowing });
    expect(first.nelFirstLactation).toBeGreaterThan(0);
    expect(older.nelFirstLactation).toBe(0);
  });

  it('a herd: late-pregnancy energy applies to the SHARE of cows near calving, not all or none', () => {
    const r = { ...cattleGrowing };
    const none = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 0, state: 'dry', pregnancyShare: 0, requirements: r }).nelPregnancy;
    const half = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 0, state: 'dry', pregnancyShare: 0.5, requirements: r }).nelPregnancy;
    const all = ruminantNeed({ bodyWeightKg: 400, milkLitresPerDay: 0, state: 'dry', pregnancyShare: 1, requirements: r }).nelPregnancy;
    expect(none).toBe(0);
    expect(half).toBeCloseTo(all / 2, 1);
  });
});

describe('small ruminants use NEL, not ME (NUT-190)', () => {
  it('a 30 kg goat at the corrected 0.063 needs about 0.81 Mcal NEL to stay as she is; the old 0.10 gave 1.28', () => {
    const goat = (nel: number) => ruminantNeed({ bodyWeightKg: 30, milkLitresPerDay: 0, state: 'dry', requirements: { ...cattleGrowing, nelMaintenancePerKgBw075: nel } }).nelMcal;
    expect(goat(0.063)).toBeCloseTo(0.81, 1);
    expect(goat(0.10) / goat(0.063)).toBeGreaterThan(1.5);
  });
});

describe('mineral mixture and amounts under 1 kg (NUT-198)', () => {
  it('the mineral mixture is fed at the set\'s fixed daily allowance (50 g), and reads as grams, never 0 kg', () => {
    const r = balanceRuminantRation({
      bodyWeightKg: 400, milkLitresPerDay: 10, state: 'lactating', requirements: cattleGrowing, feeds: [maize, berseem, cake, mineral],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const m = r.lines.find(l => l.key === 'mineral');
    expect(m?.kgAsFedPerDay).toBeCloseTo(0.05, 3);
    expect(m!.kgAsFedPerDay).toBeGreaterThan(0);
  });
});

describe('horses: mares and grain in small feeds (NUT-204)', () => {
  const horse: EquineRequirements = {
    deMaintenancePerKgBw: 0.0333, workFactor: { low: 1, moderate: 1.2, high: 1.4, working: 1.6 }, cpGPerMcalDe: 38, caGPerKgBw: 0.04, pGPerKgBw: 0.028,
    dmiMinPctBw: 1.5, dmiMaxPctBw: 2.5, forageMinPctBw: 1.0, concentrateMaxPctDm: 50, lactatingFactor: 1.8, latePregnancyFraction: 0.25,
  };
  it('a mare in milk needs more than a horse at rest, and one in late pregnancy a little more', () => {
    const rest = equineNeed({ bodyWeightKg: 450, work: 'low', requirements: horse }).deMcal;
    expect(equineNeed({ bodyWeightKg: 450, work: 'low', reproState: 'lactating', requirements: horse }).deMcal).toBeCloseTo(rest * 1.8, 1);
    expect(equineNeed({ bodyWeightKg: 450, work: 'low', reproState: 'pregnant', requirements: horse }).deMcal).toBeCloseTo(rest * 1.25, 1);
  });
  it('a big grain ration is split into more feeds (no more than 0.5% of body weight at once)', () => {
    const hay: EquineFeedOption = { key: 'hay', label: 'hay', isForage: true, dmPct: 88, deMcalPerKgDm: 1.9, cpPctDm: 8, caPctDm: 0.45, pPctDm: 0.22, pricePerKgAsFed: 8 };
    const oats: EquineFeedOption = { key: 'oats', label: 'oats', isForage: false, dmPct: 89, deMcalPerKgDm: 3.2, cpPctDm: 12.5, caPctDm: 0.09, pPctDm: 0.38, pricePerKgAsFed: 30 };
    const min: EquineFeedOption = { key: 'min', label: 'min', isForage: false, dmPct: 98, deMcalPerKgDm: 0, cpPctDm: 0, caPctDm: 20, pPctDm: 10, pricePerKgAsFed: 80 };
    const r = balanceEquineRation({ bodyWeightKg: 450, work: 'working', requirements: horse, feeds: [hay, oats, min] });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.supplied.concentrateKgAsFed).toBeGreaterThan(2.25); // more than one safe feed
      expect(r.supplied.feedsPerDay).toBeGreaterThanOrEqual(2);
      expect(r.supplied.concentrateKgAsFed / r.supplied.feedsPerDay).toBeLessThanOrEqual(0.005 * 450 + 0.001);
    }
  });
});

const dog = (o: Partial<AnimalFacts> = {}): AnimalFacts => ({
  speciesCode: 'Dog', model: 'companion_energy', dateOfBirth: '2021-05-01', gender: 'female', isNeutered: true, activityLevel: 'moderate', housing: 'indoor',
  breedingStatus: null, expectedDueDate: null, lastBirthDate: null, avgDailyMilkLitres: null, weightKg: 20, weightRecordedAt: '2026-11-20T00:00:00Z',
  bcs9: 5, bcsRecordedAt: null, muscleCondition: 'normal', ...o,
});
const factors = [
  { factorKey: 'adult_intact', factor: 1.8, status: 'owner_approved', source: 'MSD' }, { factorKey: 'adult_neutered', factor: 1.6, status: 'owner_approved', source: 'MSD' },
  { factorKey: 'growth_4m_to_adult', factor: 2.0, status: 'owner_approved', source: 'MSD' }, { factorKey: 'growth_under_4m', factor: 3.0, status: 'owner_approved', source: 'MSD' },
  { factorKey: 'lactation', factor: 4.0, status: 'owner_approved', source: 'MSD' }, { factorKey: 'gestation', factor: 2.0, status: 'owner_approved', source: 'MSD' },
];
const NOW = new Date('2026-11-22T10:00:00Z');

describe('pets (NUT-195)', () => {
  it('"neutered" is asked, not assumed (a blank counted as intact: +12.5% food)', () => {
    expect(missingFacts(dog({ isNeutered: null })).some(m => m.key === 'isNeutered' && m.required)).toBe(true);
    expect(missingFacts(dog({ isNeutered: true })).some(m => m.key === 'isNeutered')).toBe(false);
  });
  it('a nursing bitch gets lactation energy (4x), not maintenance (1.6x)', () => {
    const r = companionEnergy({ facts: dog({ lastBirthDate: '2026-10-20' }), factors, now: NOW });
    expect(r.goal).toBe('lactation');
    expect(r.factorKey).toBe('lactation');
    expect(r.dailyKcal).toBeGreaterThan(Math.round(1.6 * 662) * 2);
    expect(r.requiresVet).toBe(true);
  });
  it('a 40 kg dog is still growing at 14 months; a 10 kg dog is grown at 12', () => {
    expect(growthEndMonths(dog({ weightKg: 40 }))).toBe(18);
    expect(growthEndMonths(dog({ weightKg: 50 }))).toBe(24);
    expect(growthEndMonths(dog({ weightKg: 10 }))).toBe(12);
    expect(suggestGoal(dog({ weightKg: 40, dateOfBirth: '2025-09-20' }), NOW)).toBe('growth');
  });
});

describe('body condition alerts use the species\' own range (NUT-196, NUT-208)', () => {
  const cow = (bcs9: number): AnimalFacts => dog({ speciesCode: 'Cattle', model: 'ruminant_dm', bcs9 });
  const types = (f: AnimalFacts) => evaluateRisks({ facts: f, weights: [], goal: null, feeding7d: null, hasPlan: false, now: NOW }).map(x => x.type);
  it('a cow at 3.5 of 5 (about 6/9) is ideal; a dog at 6/9 is overweight', () => {
    expect(types(cow(6))).not.toContain('bcs_high');
    expect(types(dog({ bcs9: 6 }))).toContain('bcs_high');
  });
  it('a cow is thin at 3 of 9 and fat at 8 of 9', () => {
    expect(types(cow(3))).toContain('bcs_low');
    expect(types(cow(8))).toContain('bcs_high');
  });
  it('no "no recent weight" nagging on a farm animal with no plan, and no drift alert for an animal with no plan', () => {
    expect(types(cow(5))).not.toContain('no_recent_weight');
    const drift = evaluateRisks({
      facts: cow(5), weights: [{ kg: 400, at: '2026-08-01T00:00:00Z' }, { kg: 440, at: '2026-11-20T00:00:00Z' }], goal: null, feeding7d: null, hasPlan: false, now: NOW,
    }).map(x => x.type);
    expect(drift).not.toContain('weight_drift');
  });
});

describe('unsafe feed words in every script (NUT-202)', () => {
  it('catches chocolate and onion typed in Hindi, Tamil and Kannada, whole-word only', () => {
    expect(matchesUnsafe('चॉकलेट बिस्कुट', ['चॉकलेट'])).toBe(true);
    expect(matchesUnsafe('வெங்காயம் சாதம்', ['வெங்காயம்'])).toBe(true);
    expect(matchesUnsafe('ಈರುಳ್ಳಿ ಸಾರು', ['ಈರುಳ್ಳಿ'])).toBe(true);
    expect(matchesUnsafe('teaspoon of rice', ['tea'])).toBe(false);
  });
  it('a sheep owner\'s cattle feed is caught by the copper rule', () => {
    expect(matchesUnsafe('Compound cattle feed (BIS type II)', ['cattle', 'copper sulphate'])).toBe(true);
    expect(matchesUnsafe('Mineral mixture (sheep and goats, low copper)', ['cattle', 'copper sulphate'])).toBe(false);
    expect(matchesUnsafe('Wheat bran (chokar)', ['cattle', 'copper sulphate'])).toBe(false);
  });
});

describe('ponds feed what is alive (NUT-192) and age counts from birth (NUT-193)', () => {
  const shrimp: FeedingCurveRow[] = [{
    basis: 'percent_biomass', ageFromDays: null, ageToDays: null, weightFromG: 5, weightToG: 15, gramsPerHeadDay: null, ratePctBiomass: 3.5, feedsPerDay: 4, feedType: 'grower', survivalPct: 80,
  }];
  it('100,000 stocked shrimp at 10 g and 80% survival = 800 kg alive: 28 kg a day, not 35', () => {
    const r = groupDailyFeed({ headCount: 100000, avgWeightG: 10, curve: shrimp });
    expect(r.status === 'ok' && r.kgPerDay).toBe(28);
    expect(r.status === 'ok' && r.survivalPct).toBe(80);
  });
  it('when the farmer records deaths the count is live: no survival is taken off a second time', () => {
    const r = groupDailyFeed({ headCount: 80000, headCountIsLive: true, avgWeightG: 10, curve: shrimp });
    expect(r.status === 'ok' && r.kgPerDay).toBe(28);
    expect(r.status === 'ok' && r.survivalPct).toBeNull();
  });
  it('pullets placed at 18 weeks (126 days old) are fed the 18-week amount, not the day-old chick amount', () => {
    const layers: FeedingCurveRow[] = [
      { basis: 'per_head', ageFromDays: 0, ageToDays: 7, weightFromG: null, weightToG: null, gramsPerHeadDay: 12, ratePctBiomass: null, feedsPerDay: 4, feedType: 'starter' },
      { basis: 'per_head', ageFromDays: 120, ageToDays: 500, weightFromG: null, weightToG: null, gramsPerHeadDay: 115, ratePctBiomass: null, feedsPerDay: 1, feedType: 'layer' },
    ];
    const day0 = groupDailyFeed({ headCount: 1000, ageDays: 3, curve: layers });
    const onArrival = groupDailyFeed({ headCount: 1000, ageDays: 3 + 126, curve: layers });
    expect(day0.status === 'ok' && day0.gramsPerHead).toBe(12);
    expect(onArrival.status === 'ok' && onArrival.gramsPerHead).toBe(115);
  });
});
