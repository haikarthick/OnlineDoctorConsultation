import database from '../../src/utils/database';
import WithdrawalService from '../../src/services/withdrawal/WithdrawalService';
import { WithdrawalConfirmError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
const query = database.query as jest.Mock;

const today = new Date().toISOString().slice(0, 10);
const plus = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const ctx = { userId: 'u1', action: 'milk_entry' };
const rxRow = (over: Record<string, unknown> = {}) => ({
  source: 'prescription', source_id: 'p1', animal_id: 'a1', group_id: null, medicine: 'Product A', kind: 'medicine',
  started_on: today, treatment_days: 1, last_dose_on: null, milk_days: 5, meat_days: 0, ...over,
});

beforeEach(() => jest.resetAllMocks());

describe('WithdrawalService.guard (warn and confirm, never a silent block)', () => {
  it('lets the action through when nothing holds milk back', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(WithdrawalService.guard({ animalId: 'a1' }, 'milk', undefined, ctx)).resolves.toBeUndefined();
  });

  it('says what is held back, until when and because of what - and asks for confirmation', async () => {
    query.mockResolvedValueOnce({ rows: [rxRow()] }).mockResolvedValueOnce({ rows: [{ name: 'Lakshmi', enterprise_id: 'e1' }] });
    const err = await WithdrawalService.guard({ animalId: 'a1' }, 'milk', undefined, ctx).catch(e => e);
    expect(err).toBeInstanceOf(WithdrawalConfirmError);
    expect(err.errorCode).toBe('WITHDRAWAL_CONFIRM');
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/Lakshmi is under a milk \/ egg withdrawal until/);
    expect(err.message).toContain(plus(5));
    expect(err.message).toContain('Product A');
    // the screen builds the same warning in the person's language from these values
    expect(err.params).toEqual({ what: 'milk', name: 'Lakshmi', group: false, until: plus(5), medicine: 'Product A', action: 'milk_entry' });
  });

  it('goes ahead when the person has confirmed, and keeps who confirmed what', async () => {
    query.mockResolvedValueOnce({ rows: [rxRow()] }).mockResolvedValueOnce({ rows: [{ name: 'Lakshmi', enterprise_id: 'e1' }] }).mockResolvedValueOnce({ rows: [] });
    await expect(WithdrawalService.guard({ animalId: 'a1' }, 'milk', true, ctx)).resolves.toBeUndefined();
    const [sql, args] = query.mock.calls[2];
    expect(sql).toMatch(/INSERT INTO withdrawal_overrides/);
    expect(args).toEqual(['u1', 'e1', 'a1', null, 'milk_entry', 'milk', plus(5), 'Product A']);
  });

  it('confirming when nothing is held back records nothing', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(WithdrawalService.guard({ animalId: 'a1' }, 'milk', true, ctx)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('a failed log never blocks the confirmed action', async () => {
    query.mockResolvedValueOnce({ rows: [rxRow()] }).mockResolvedValueOnce({ rows: [{ name: 'L', enterprise_id: 'e1' }] }).mockRejectedValueOnce(new Error('db down'));
    await expect(WithdrawalService.guard({ animalId: 'a1' }, 'milk', true, ctx)).resolves.toBeUndefined();
  });

  it('milk held back does not stop a meat sale', async () => {
    query.mockResolvedValueOnce({ rows: [rxRow({ meat_days: 0 })] });
    await expect(WithdrawalService.guard({ animalId: 'a1' }, 'meat', undefined, ctx)).resolves.toBeUndefined();
  });
});

describe('WithdrawalService.isFoodProducing (master data, never a species name)', () => {
  it.each([['dairy', true], ['poultry', true], ['aquaculture', true], ['pet', false], ['equine', false]])('segment %s -> %s', async (seg, want) => {
    query.mockResolvedValueOnce({ rows: [{ farm_segment: seg }] });
    expect(await WithdrawalService.isFoodProducing({ animalId: 'a1' })).toBe(want);
  });
  it('an unknown animal is not food-producing', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await WithdrawalService.isFoodProducing({ groupId: 'g1' })).toBe(false);
  });
});

describe('WithdrawalService.addSelfTreatment (the farmer reads the label; nothing is assumed)', () => {
  const good = { animalId: 'a1', medicineName: 'Product A', treatmentDays: 3, withdrawalMilkDays: 4, withdrawalMeatDays: 0 };
  it('refuses a missing label figure, in words', async () => {
    query.mockResolvedValue({ rows: [{}] });
    await expect(WithdrawalService.addSelfTreatment('e1', { ...good, withdrawalMilkDays: undefined as any }, 'u1')).rejects.toThrow(/from the label/);
    await expect(WithdrawalService.addSelfTreatment('e1', { ...good, medicineName: ' ' }, 'u1')).rejects.toThrow(/name of the medicine/);
    await expect(WithdrawalService.addSelfTreatment('e1', { ...good, treatmentDays: 0 }, 'u1')).rejects.toThrow(/How many days/);
  });
  it('refuses an animal that is not on this farm', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(WithdrawalService.addSelfTreatment('e1', good, 'u1')).rejects.toThrow(/not on this farm/);
  });
  it('saves with 0 meaning the label says none', async () => {
    query.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [{ id: 't1' }] });
    expect(await WithdrawalService.addSelfTreatment('e1', good, 'u1')).toEqual({ id: 't1' });
    expect(query.mock.calls[1][1].slice(3, 7)).toEqual(['Product A', 3, 4, 0]);
  });
});

describe('WithdrawalService.correctCourse', () => {
  it('refuses a last dose before the treatment started or in the future', async () => {
    query.mockResolvedValue({ rows: [{ started: today }] });
    await expect(WithdrawalService.correctCourse('p1', plus(-3), 'u1')).rejects.toThrow(/before the treatment started/);
    await expect(WithdrawalService.correctCourse('p1', plus(9), 'u1')).rejects.toThrow(/too far ahead/);
  });
  it('accepts a date in range and puts back "as prescribed" with null', async () => {
    query.mockResolvedValue({ rows: [{ started: plus(-2) }] });
    await WithdrawalService.correctCourse('p1', today, 'u1');
    await WithdrawalService.correctCourse('p1', null, 'u1');
    const updates = query.mock.calls.filter(c => /UPDATE prescriptions/.test(String(c[0])));
    expect(updates.map(c => c[1][1])).toEqual([today, null]);
  });
});
