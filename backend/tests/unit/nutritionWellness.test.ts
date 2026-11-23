import { activityScoreFrom, nutritionScoreFrom, weightStatusFrom } from '../../src/services/nutrition/engine/wellness';

/** NUT-172/184: scorecard nutrition, activity and weight come from records; nothing on record is "not enough records", never 0 or 75. */
describe('wellness values derived from nutrition records', () => {
  it('weight status follows body condition, and is unknown without one', () => {
    expect(weightStatusFrom(null)).toBe('unknown');
    expect(weightStatusFrom(2)).toBe('underweight');
    expect(weightStatusFrom(5)).toBe('normal');
    expect(weightStatusFrom(7)).toBe('overweight');
    expect(weightStatusFrom(9)).toBe('obese');
  });

  it('activity score comes from the recorded level only', () => {
    expect(activityScoreFrom(null)).toBeNull();
    expect(activityScoreFrom('low')).toBe(40);
    expect(activityScoreFrom('working')).toBe(90);
    expect(activityScoreFrom('anything else')).toBeNull();
  });

  it('nutrition score is null with nothing on record, and drops for each open alert', () => {
    const none = { actFlags: 0, watchFlags: 0, hasPlan: false, needsPlan: true, hasWeight: false, hasBcs: false };
    expect(nutritionScoreFrom(none)).toBeNull();
    expect(nutritionScoreFrom({ ...none, hasWeight: true, hasPlan: true })).toBe(100);
    expect(nutritionScoreFrom({ ...none, hasWeight: true })).toBe(90); // no plan for a calculator animal
    expect(nutritionScoreFrom({ ...none, hasWeight: true, hasPlan: true, actFlags: 1, watchFlags: 2 })).toBe(55);
    expect(nutritionScoreFrom({ ...none, hasWeight: true, hasPlan: true, actFlags: 9 })).toBe(0);
  });
});
