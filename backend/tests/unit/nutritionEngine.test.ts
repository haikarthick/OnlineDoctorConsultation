import { companionEnergy, rer, suggestGoal, EnergyInputError } from '../../src/services/nutrition/engine/companionEnergy';
import { estimateIdealWeight, toNinePoint, inferBcsScale, conditionBand } from '../../src/services/nutrition/engine/condition';
import { missingFacts, canCalculate, ageInMonths, type AnimalFacts } from '../../src/services/nutrition/engine/facts';
import { portions } from '../../src/services/nutrition/engine/portions';
import { evaluateRisks, matchesUnsafe } from '../../src/services/nutrition/engine/rules';

const NOW = new Date('2026-11-22T10:00:00Z');

const dogFactors = [
  { factorKey: 'adult_intact', factor: 1.8, status: 'unvalidated', source: 'MSD' },
  { factorKey: 'adult_neutered', factor: 1.6, status: 'unvalidated', source: 'MSD' },
  { factorKey: 'obesity_prone', factor: 1.4, status: 'unvalidated', source: 'MSD' },
  { factorKey: 'growth_under_4m', factor: 3.0, status: 'unvalidated', source: 'MSD' },
  { factorKey: 'growth_4m_to_adult', factor: 2.0, status: 'unvalidated', source: 'MSD' },
  { factorKey: 'weight_loss', factor: 1.0, status: 'vet_validated', source: 'AAHA' },
];

const dog = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({
  speciesCode: 'Dog', model: 'companion_energy', dateOfBirth: '2021-05-01', gender: 'male', isNeutered: true,
  activityLevel: 'moderate', housing: 'indoor', breedingStatus: null, expectedDueDate: null, lastBirthDate: null,
  avgDailyMilkLitres: null, weightKg: 20, weightRecordedAt: '2026-11-20T00:00:00Z', bcs9: 5, bcsRecordedAt: null,
  muscleCondition: 'normal', ...over,
});

describe('nutrition engine - energy (MSD / AAHA factors)', () => {
  it('RER = 70 x kg^0.75', () => {
    expect(Math.round(rer(10))).toBe(394);
    expect(Math.round(rer(1))).toBe(70);
  });

  it('neutered adult dog at ideal condition: 1.6 x RER', () => {
    const r = companionEnergy({ facts: dog(), factors: dogFactors, now: NOW });
    expect(r.goal).toBe('maintain');
    expect(r.factorKey).toBe('adult_neutered');
    expect(r.dailyKcal).toBe(Math.round(1.6 * rer(20)));
    expect(r.reasons).toContain('factor_unvalidated');
    expect(r.requiresVet).toBe(false);
  });

  it('intact adult uses 1.8, low activity uses the obesity-prone factor', () => {
    expect(companionEnergy({ facts: dog({ isNeutered: false }), factors: dogFactors, now: NOW }).factorKey).toBe('adult_intact');
    expect(companionEnergy({ facts: dog({ activityLevel: 'low' }), factors: dogFactors, now: NOW }).factorKey).toBe('obesity_prone');
  });

  it('puppies: under 4 months 3.0, then 2.0 until a year', () => {
    expect(companionEnergy({ facts: dog({ dateOfBirth: '2026-09-01' }), factors: dogFactors, now: NOW }).factorKey).toBe('growth_under_4m');
    expect(companionEnergy({ facts: dog({ dateOfBirth: '2026-03-01' }), factors: dogFactors, now: NOW }).factorKey).toBe('growth_4m_to_adult');
  });

  it('overweight dog: suggested goal is loss, energy uses RER of the estimated ideal weight', () => {
    const r = companionEnergy({ facts: dog({ bcs9: 7, weightKg: 24 }), factors: dogFactors, now: NOW });
    expect(r.suggestedGoal).toBe('lose');
    expect(r.factorKey).toBe('weight_loss');
    expect(r.basisWeightKg).toBe(20); // 24 / 1.2
    expect(r.dailyKcal).toBe(Math.round(1.0 * rer(20)));
  });

  it('weight loss with no condition score and no target asks for one', () => {
    expect(() => companionEnergy({ facts: dog({ bcs9: null }), factors: dogFactors, goal: 'lose', now: NOW }))
      .toThrow(EnergyInputError);
  });

  it('pregnant, nursing, underweight and very active animals are routed to a vet - no invented multiplier', () => {
    for (const facts of [dog({ breedingStatus: 'pregnant' }), dog({ bcs9: 3 }), dog({ activityLevel: 'working' })]) {
      const r = companionEnergy({ facts, factors: dogFactors, now: NOW });
      expect(r.requiresVet).toBe(true);
      expect(['adult_neutered', 'adult_intact', 'obesity_prone']).toContain(r.factorKey);
    }
    expect(suggestGoal(dog({ lastBirthDate: '2026-11-01' }), NOW)).toBe('lactation');
  });

  it('refuses without a weight, and says which factor is missing', () => {
    expect(() => companionEnergy({ facts: dog({ weightKg: null }), factors: dogFactors, now: NOW })).toThrow(/weight/);
    expect(() => companionEnergy({ facts: dog(), factors: [], now: NOW })).toThrow(/adult_neutered/);
  });
});

describe('nutrition engine - body condition', () => {
  it('maps 5-point to 9-point and infers the scale', () => {
    expect(toNinePoint(3, 5)).toBe(5);
    expect(toNinePoint(1, 5)).toBe(1);
    expect(toNinePoint(5, 5)).toBe(9);
    expect(toNinePoint(3.5, 5)).toBe(6);
    expect(inferBcsScale('ruminant_dm', 3)).toBe(5);
    expect(inferBcsScale('ruminant_dm', 7)).toBe(9);
    expect(inferBcsScale('companion_energy', 4)).toBe(9);
  });

  it('ideal weight: about 10% per point away from 5', () => {
    expect(estimateIdealWeight(30, 7)).toBe(25);
    expect(estimateIdealWeight(18, 3)).toBe(22.5);
    expect(estimateIdealWeight(20, null)).toBe(20);
  });

  it('bands follow AAHA screening (outside 4-5 is a risk)', () => {
    expect(conditionBand(4)).toBe('ideal');
    expect(conditionBand(6)).toBe('overweight');
    expect(conditionBand(3)).toBe('thin');
    expect(conditionBand(9)).toBe('obese');
  });
});

describe('nutrition engine - facts', () => {
  it('lists missing facts, required first, and blocks calculation only on required ones', () => {
    const m = missingFacts(dog({ weightKg: null, activityLevel: null, dateOfBirth: null }));
    expect(m.map(x => x.key)).toEqual(['weight', 'dateOfBirth', 'activityLevel']);
    expect(canCalculate(dog({ activityLevel: null }))).toBe(true);
    expect(canCalculate(dog({ weightKg: null }))).toBe(false);
  });

  it('a guidance-only species never blocks', () => {
    expect(canCalculate(dog({ model: 'guidance_only', weightKg: null, dateOfBirth: null }))).toBe(true);
  });

  it('age in whole months, null for a future or missing date', () => {
    expect(ageInMonths('2026-05-22', NOW)).toBe(6);
    expect(ageInMonths('2026-05-23', NOW)).toBe(5);
    expect(ageInMonths('2027-01-01', NOW)).toBeNull();
    expect(ageInMonths(null, NOW)).toBeNull();
  });
});

describe('nutrition engine - portions', () => {
  it('splits energy by share and converts to grams with each label value', () => {
    const r = portions(1000, [
      { key: 'a', label: 'Kibble', kcalPer100g: 350, sharePct: 80 },
      { key: 'b', label: 'Rice', kcalPer100g: 130, sharePct: 20 },
    ], 2);
    expect(r.lines[0].kcalPerDay).toBe(800);
    expect(r.lines[0].gramsPerDay).toBe(230);   // 228.6 rounded to 5 g
    expect(r.lines[1].gramsPerDay).toBe(154);   // 153.8 to the gram
    expect(r.lines[1].gramsPerMeal).toBe(77);
    expect(r.missingEnergy).toEqual([]);
  });

  it('normalises shares and reports foods without an energy value', () => {
    const r = portions(600, [
      { key: 'a', label: 'A', kcalPer100g: null, sharePct: 1 },
      { key: 'b', label: 'B', kcalPer100g: 300, sharePct: 1 },
    ], 3);
    expect(r.lines.map(l => l.sharePct)).toEqual([50, 50]);
    expect(r.missingEnergy).toEqual(['A']);
    expect(r.lines[0].gramsPerDay).toBeNull();
  });
});

describe('nutrition engine - risk rules', () => {
  const at = (d: string) => `${d}T08:00:00Z`;

  it('flags condition outside 4-5, muscle loss and a stale weight', () => {
    const flags = evaluateRisks({ facts: dog({ bcs9: 8, muscleCondition: 'moderate' }), weights: [], goal: null, feeding7d: null, now: NOW });
    expect(flags.map(f => [f.type, f.severity])).toEqual([['bcs_high', 'act'], ['muscle_loss', 'act'], ['no_recent_weight', 'info']]);
  });

  it('rapid loss over 2% a week is an act flag', () => {
    const flags = evaluateRisks({
      facts: dog(), goal: 'lose', feeding7d: null, now: NOW,
      weights: [{ kg: 20, at: at('2026-10-25') }, { kg: 18, at: at('2026-11-15') }],
    });
    expect(flags.find(f => f.type === 'rapid_weight_loss')?.severity).toBe('act');
  });

  it('drift of more than 5% while maintaining is watched; a planned loss is not drift', () => {
    const weights = [{ kg: 20, at: at('2026-08-20') }, { kg: 21.5, at: at('2026-11-20') }];
    expect(evaluateRisks({ facts: dog(), weights, goal: 'maintain', feeding7d: null, now: NOW }).some(f => f.type === 'weight_drift')).toBe(true);
    expect(evaluateRisks({ facts: dog(), weights, goal: 'lose', feeding7d: null, now: NOW }).some(f => f.type === 'weight_drift')).toBe(false);
  });

  it('treats above 10% of the energy eaten are flagged', () => {
    const f = evaluateRisks({ facts: dog(), weights: [{ kg: 20, at: at('2026-11-20') }], goal: null, feeding7d: { mealKcal: 800, treatKcal: 200 }, now: NOW });
    expect(f.find(x => x.type === 'treats_over_limit')?.params.pct).toBe(20);
  });

  it('unsafe-food matching is whole-word', () => {
    expect(matchesUnsafe('Dark Chocolate cake', ['chocolate'])).toBe(true);
    expect(matchesUnsafe('green grapes', ['grape'])).toBe(true);
    expect(matchesUnsafe('one teaspoon of oil', ['tea'])).toBe(false);
    expect(matchesUnsafe('Chicken, boiled, no bones', ['cooked bone', 'cooked bones'])).toBe(false);
    expect(matchesUnsafe('leftover cooked bones', ['cooked bone'])).toBe(true);
  });
});
