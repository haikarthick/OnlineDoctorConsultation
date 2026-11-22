import { groupDailyFeed, fcr, type FeedingCurveRow } from '../../src/services/nutrition/engine/groupFeeding';

const row = (o: Partial<FeedingCurveRow>): FeedingCurveRow => ({
  basis: 'per_head', ageFromDays: null, ageToDays: null, weightFromG: null, weightToG: null,
  gramsPerHeadDay: null, ratePctBiomass: null, feedsPerDay: null, feedType: null, ...o,
});

describe('group feeding (flocks, pig batches, ponds)', () => {
  const broiler = [
    row({ ageFromDays: 0, ageToDays: 10, gramsPerHeadDay: 25, feedType: 'starter', feedsPerDay: 4 }),
    row({ ageFromDays: 11, ageToDays: 24, gramsPerHeadDay: 90, feedType: 'grower' }),
    row({ ageFromDays: 25, ageToDays: 45, gramsPerHeadDay: 170, feedType: 'finisher' }),
  ];

  it('per head: 5,000 birds at 30 days eat 850 kg of finisher', () => {
    const r = groupDailyFeed({ headCount: 5000, ageDays: 30, curve: broiler, pricePerKg: 40 });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') { expect(r.kgPerDay).toBe(850); expect(r.feedType).toBe('finisher'); expect(r.costPerDay).toBe(34000); }
  });

  it('older than the table: uses the last band rather than nothing', () => {
    const r = groupDailyFeed({ headCount: 100, ageDays: 60, curve: broiler });
    expect(r.status === 'ok' && r.gramsPerHead).toBe(170);
  });

  it('says what is missing instead of guessing', () => {
    expect(groupDailyFeed({ headCount: 0, ageDays: 5, curve: broiler })).toEqual({ status: 'needs', missing: ['head_count'] });
    expect(groupDailyFeed({ headCount: 10, ageDays: null, curve: broiler })).toEqual({ status: 'needs', missing: ['age'] });
  });

  const shrimp = [
    row({ basis: 'percent_biomass', weightFromG: 0, weightToG: 5, ratePctBiomass: 6, feedsPerDay: 4 }),
    row({ basis: 'percent_biomass', weightFromG: 5, weightToG: 15, ratePctBiomass: 3.5, feedsPerDay: 4 }),
    row({ basis: 'percent_biomass', weightFromG: 15, weightToG: 40, ratePctBiomass: 2.2, feedsPerDay: 4 }),
  ];
  const temp = [{ fromC: 0, toC: 24, factor: 0.7 }, { fromC: 24, toC: 32, factor: 1 }, { fromC: 32, toC: 50, factor: 0.8 }];

  it('pond: 100,000 shrimp at 10 g = 1,000 kg biomass; 3.5% = 35 kg; cold water cuts it', () => {
    const r = groupDailyFeed({ headCount: 100000, avgWeightG: 10, waterTempC: 28, curve: shrimp, temperature: temp });
    expect(r.status === 'ok' && [r.biomassKg, r.kgPerDay]).toEqual([1000, 35]);
    const cold = groupDailyFeed({ headCount: 100000, avgWeightG: 10, waterTempC: 20, curve: shrimp, temperature: temp });
    expect(cold.status === 'ok' && cold.kgPerDay).toBe(24.5);
  });

  it('pond without a sampled average weight asks for one', () => {
    expect(groupDailyFeed({ headCount: 1000, avgWeightG: null, curve: shrimp })).toEqual({ status: 'needs', missing: ['average_weight'] });
  });

  it('FCR = feed / product, null when unknown', () => {
    expect(fcr(1700, 1000)).toBe(1.7);
    expect(fcr(0, 10)).toBeNull();
    expect(fcr(10, null)).toBeNull();
  });
});
