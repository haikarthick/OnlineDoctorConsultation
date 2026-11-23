import { evaluateRisks, evaluateGroupFeed } from '../../src/services/nutrition/engine/rules';
import { numbersIn, onlyKnownNumbers, toLatinDigits } from '../../src/services/nutrition/engine/explainGuard';
import type { AnimalFacts } from '../../src/services/nutrition/engine/facts';

const NOW = new Date('2026-11-22T10:00:00Z');
const at = (d: string) => `${d}T08:00:00Z`;

const cow = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({
  speciesCode: 'Cattle', model: 'ruminant_dm', dateOfBirth: '2021-05-01', gender: 'female', isNeutered: null,
  activityLevel: null, housing: 'stall_fed', breedingStatus: 'lactating', expectedDueDate: null, lastBirthDate: '2026-10-01',
  avgDailyMilkLitres: 12, weightKg: 400, weightRecordedAt: at('2026-11-20'), bcs9: 5, bcsRecordedAt: null,
  muscleCondition: 'normal', ...over,
});

const run = (facts: AnimalFacts, conditions: Array<{ bcs9: number; at: string }>) =>
  evaluateRisks({ facts, weights: [{ kg: 400, at: at('2026-11-20') }], goal: null, feeding7d: null, conditions, now: NOW });

describe('Phase 4 rules - condition lost after giving birth', () => {
  it('a full point (5-point scale) lost since calving is an act-now alert', () => {
    // 7/9 at calving (3.5 of 5) -> 5/9 now (2.5 of 5): one full point lost in 52 days.
    const flags = run(cow(), [{ bcs9: 7, at: at('2026-09-25') }, { bcs9: 5, at: at('2026-11-15') }]);
    const f = flags.find(x => x.type === 'transition_condition_loss');
    expect(f?.severity).toBe('act');
    expect(f?.params).toEqual({ drop5: 1, days: 52 });
  });

  it('half a point is a watch, less is nothing', () => {
    expect(run(cow(), [{ bcs9: 6, at: at('2026-10-02') }, { bcs9: 5, at: at('2026-11-15') }]).find(x => x.type === 'transition_condition_loss')?.severity).toBe('watch');
    expect(run(cow(), [{ bcs9: 6, at: at('2026-10-02') }, { bcs9: 5.5, at: at('2026-11-15') }]).some(x => x.type === 'transition_condition_loss')).toBe(false);
  });

  it('says nothing without a score near the birth, or long after the birth', () => {
    expect(run(cow(), [{ bcs9: 7, at: at('2026-06-01') }, { bcs9: 4, at: at('2026-11-15') }]).some(x => x.type === 'transition_condition_loss')).toBe(false);
    expect(run(cow({ lastBirthDate: '2026-05-01' }), [{ bcs9: 7, at: at('2026-05-01') }, { bcs9: 4, at: at('2026-11-15') }]).some(x => x.type === 'transition_condition_loss')).toBe(false);
    expect(run(cow({ lastBirthDate: null }), [{ bcs9: 7, at: at('2026-10-01') }, { bcs9: 4, at: at('2026-11-15') }]).some(x => x.type === 'transition_condition_loss')).toBe(false);
  });
});

describe('Phase 4 rules - herd fed against its table', () => {
  const days = (kg: number, n: number) => Array.from({ length: n }, (_, i) => ({ date: `2026-11-${String(21 - i).padStart(2, '0')}`, kg }));

  it('below 80% over a recorded week is a watch', () => {
    expect(evaluateGroupFeed({ suggestedKgPerDay: 100, recorded: days(70, 5), now: NOW })).toEqual([{ type: 'feed_below_need', severity: 'watch', params: { pct: 70, days: 5 } }]);
  });

  it('above 125% is a watch; within the band is fine', () => {
    expect(evaluateGroupFeed({ suggestedKgPerDay: 100, recorded: days(130, 5), now: NOW })[0]?.type).toBe('feed_above_need');
    expect(evaluateGroupFeed({ suggestedKgPerDay: 100, recorded: days(95, 7), now: NOW })).toEqual([]);
  });

  it('too few days recorded: no judgement (recording twice a week is not starving the flock)', () => {
    expect(evaluateGroupFeed({ suggestedKgPerDay: 100, recorded: days(10, 3), now: NOW })).toEqual([]);
  });

  it('two feed entries on one day add up (2 x 40 kg = 80%, right at the limit, is not flagged; 2 x 35 kg is)', () => {
    expect(evaluateGroupFeed({ suggestedKgPerDay: 100, recorded: [...days(40, 5), ...days(40, 5)], now: NOW })).toEqual([]);
    expect(evaluateGroupFeed({ suggestedKgPerDay: 100, recorded: [...days(35, 5), ...days(35, 5)], now: NOW })[0]?.params).toEqual({ pct: 70, days: 5 });
  });
});

describe('AI explanation guard - numbers only from the plan', () => {
  it('reads digits in every script our languages use', () => {
    expect(toLatinDigits('रोज़ ६६२ kcal')).toBe('रोज़ 662 kcal');
    expect(numbersIn('ದಿನಕ್ಕೆ ೧೨.೫ kg, 1,250 g')).toEqual([12.5, 1250]);
    expect(numbersIn('நாளொன்றுக்கு ௩௦ g')).toEqual([30]);
  });

  it('accepts a text that repeats the plan\'s numbers (and their roundings)', () => {
    const allowed = numbersIn(JSON.stringify({ kcal: 662.4, meals: 2, foods: [{ g: 140, perMeal: 70 }] }));
    expect(onlyKnownNumbers('About 662 kcal a day: 140 g of rice, 70 g a meal, in 2 meals.', allowed).ok).toBe(true);
  });

  it('rejects a text with an amount the plan does not contain', () => {
    const allowed = numbersIn(JSON.stringify({ kcal: 662, meals: 2, foods: [{ g: 140 }] }));
    const r = onlyKnownNumbers('Give 200 g of rice and 662 kcal.', allowed);
    expect(r.ok).toBe(false);
    expect(r.unknown).toEqual([200]);
    expect(onlyKnownNumbers('रोज़ ३०० g दें', allowed).ok).toBe(false);
  });
});
