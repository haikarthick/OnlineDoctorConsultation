import { addDays, daysBetween, itemFor, needsWithdrawalChoice, summarise, wholeDays, withdrawalAnswered, type CourseLine } from '../../src/services/withdrawal/withdrawalMath';

/** WDR: the platform only does the date sums; the label's days are typed by the vet or the farmer. */
const line = (over: Partial<CourseLine> = {}): CourseLine => ({
  source: 'prescription', sourceId: 'p1', medicine: 'Product A', kind: 'medicine', startedOn: '2026-11-01',
  treatmentDays: 3, lastDoseOn: null, milkDays: 4, meatDays: 28, ...over,
});

describe('withdrawal arithmetic', () => {
  it('the start day is day 1: a 3-day course started on the 1st has its last dose on the 3rd', () => {
    const i = itemFor(line());
    expect(i.lastDose).toBe('2026-11-03');
    expect(i.milkUntil).toBe('2026-11-07');
    expect(i.meatUntil).toBe('2026-12-01');
  });

  it('a label that gives no days holds nothing back', () => {
    const i = itemFor(line({ milkDays: 0, meatDays: 0 }));
    expect(i.milkUntil).toBeNull();
    expect(i.meatUntil).toBeNull();
  });

  it('the farmer\'s "stopped early" correction moves the end', () => {
    const i = itemFor(line({ lastDoseOn: '2026-11-02' }));
    expect(i.lastDose).toBe('2026-11-02');
    expect(i.milkUntil).toBe('2026-11-06');
  });

  it('months and years roll over correctly', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(daysBetween('2026-11-24', '2026-12-01')).toBe(7);
  });

  it('a course that has ended is left out; the latest end wins across overlapping courses', () => {
    const a = itemFor(line({ sourceId: 'a', startedOn: '2026-10-01', milkDays: 2, meatDays: 5 })); // ended long ago
    const b = itemFor(line({ sourceId: 'b', startedOn: '2026-11-20', treatmentDays: 1, milkDays: 5, meatDays: 0 }));
    const c = itemFor(line({ sourceId: 'c', startedOn: '2026-11-22', treatmentDays: 2, milkDays: 10, meatDays: 14 }));
    const s = summarise([a, b, c], '2026-11-24');
    expect(s.items.map(i => i.sourceId)).toEqual(['c', 'b']);
    expect(s.milkUntil).toBe('2026-12-03');
    expect(s.meatUntil).toBe('2026-12-07');
    expect(s.active).toBe(true);
    expect(summarise([a], '2026-11-24')).toMatchObject({ active: false, milkUntil: null, meatUntil: null, items: [] });
  });

  it('only whole numbers of days count; anything else is none', () => {
    expect(wholeDays('7')).toBe(7);
    expect(wholeDays(7.4)).toBe(7);
    expect(wholeDays('7 days')).toBe(0);
    expect(wholeDays(-3)).toBe(0);
    expect(wholeDays(null)).toBe(0);
    expect(wholeDays(9999)).toBe(365);
  });

  it('a vet must answer for a medicine or medicated feed, not for a diet or supplement', () => {
    expect(needsWithdrawalChoice({})).toBe(true);
    expect(needsWithdrawalChoice({ kind: 'medicated_feed' })).toBe(true);
    expect(needsWithdrawalChoice({ kind: 'diet' })).toBe(false);
    expect(needsWithdrawalChoice({ kind: 'supplement' })).toBe(false);
  });

  it('the answer is complete with both numbers (0 allowed) or an explicit none, and not with one blank', () => {
    expect(withdrawalAnswered({ withdrawalNone: true })).toBe(true);
    expect(withdrawalAnswered({ withdrawalMilkDays: 0, withdrawalMeatDays: 0 })).toBe(true);
    expect(withdrawalAnswered({ withdrawalMilkDays: 4 })).toBe(false);
    expect(withdrawalAnswered({})).toBe(false);
    expect(withdrawalAnswered({ withdrawalMilkDays: '', withdrawalMeatDays: 3 })).toBe(false);
  });
});
