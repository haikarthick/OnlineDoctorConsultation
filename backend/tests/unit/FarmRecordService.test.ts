import database from '../../src/utils/database';
import FarmRecordService from '../../src/services/FarmRecordService';
import FarmProfileService from '../../src/services/FarmProfileService';
import BatchManagementService from '../../src/services/BatchManagementService';
import { ValidationError, NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/FarmProfileService');
jest.mock('../../src/services/BatchManagementService');

const query = database.query as jest.Mock;
const transaction = database.transaction as jest.Mock;
const assertAllowed = FarmProfileService.assertRecordTypeAllowed as jest.Mock;
const recordPopulationEvent = BatchManagementService.recordPopulationEvent as jest.Mock;

const caller = { userId: 'u1', role: 'farmer' };
const MILK = { code: 'milk', kind: 'daily', unit: 'L', fields: [{ key: 'session', type: 'choice', options: ['am', 'pm'], required: true }, { key: 'quantity', type: 'number', required: true }] };
const EGGS = { code: 'eggs', kind: 'daily', unit: 'eggs', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'broken', type: 'number' }] };
const MORTALITY = { code: 'mortality', kind: 'daily', unit: 'head', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'cause', type: 'text' }] };
const HEAT = { code: 'heat', kind: 'event', unit: null, fields: [] };

const cow = { id: 'a1', enterprise_id: 'e1', species: 'Cattle', animal_class: 'lactating', gender: 'female', group_id: null, management_mode: null, group_type: null };
const flock = { id: 'g1', enterprise_id: 'e1', species: 'Chicken', management_mode: 'batch', group_type: 'layers', cycle_id: 'c1' };

/** Answers the service's queries by the SQL text. */
function stubDb(opts: { animal?: any; group?: any; type?: any; access?: boolean }) {
  query.mockImplementation(async (sql: string) => {
    if (/FROM animals a/.test(sql)) return { rows: opts.animal ? [opts.animal] : [] };
    if (/FROM animal_groups g/.test(sql)) return { rows: opts.group ? [opts.group] : [] };
    if (/FROM enterprises e WHERE/.test(sql)) return { rows: opts.access === false ? [] : [{ x: 1 }] };
    if (/FROM master_record_types/.test(sql)) return { rows: opts.type ? [opts.type] : [] };
    return { rows: [] };
  });
}

function stubTx(existing: any[] = []) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  transaction.mockImplementation(async (cb: any) => cb({
    query: async (sql: string, params: any[]) => {
      calls.push({ sql, params });
      if (/SELECT \* FROM farm_daily_records/.test(sql)) return { rows: existing };
      if (/INSERT INTO farm_daily_records/.test(sql)) {
        return { rows: [{ id: 'r1', enterprise_id: 'e1', animal_id: params[1], group_id: params[2], cycle_id: params[3], record_type: params[4], record_date: params[5], session: params[6], quantity: params[7], unit: params[8], detail: JSON.parse(params[9]), notes: params[10], recorded_by: 'u1' }] };
      }
      return { rows: [] };
    },
  }));
  return calls;
}

beforeEach(() => { jest.resetAllMocks(); assertAllowed.mockResolvedValue({}); });

describe('FarmRecordService.save', () => {
  it('saves a milk record for one cow, keyed by session, with the unit from master data', async () => {
    stubDb({ animal: cow, type: MILK }); const tx = stubTx();
    const r = await FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 6.5, recordDate: '2026-11-10' }, caller);
    expect(r).toMatchObject({ recordType: 'milk', session: 'am', quantity: 6.5, unit: 'L', recordDate: '2026-11-10', replaced: false });
    expect(assertAllowed).toHaveBeenCalledWith(expect.objectContaining({ speciesCode: 'Cattle', animalClass: 'lactating', gender: 'female' }), 'milk', 'animal');
    expect(tx.some(t => /INSERT INTO farm_daily_record_edits/.test(t.sql))).toBe(false);
  });

  it('a second save of the same slot corrects it and keeps the old values in the audit table', async () => {
    stubDb({ animal: cow, type: MILK }); const tx = stubTx([{ id: 'r1', quantity: '5' }]);
    const r = await FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 7 }, caller);
    expect(r.replaced).toBe(true);
    const audit = tx.find(t => /INSERT INTO farm_daily_record_edits/.test(t.sql))!;
    expect(JSON.parse(audit.params[2])).toMatchObject({ id: 'r1', quantity: '5' });
  });

  it('puts what is not the headline number in detail, and the day session on types that ask for none', async () => {
    stubDb({ group: flock, type: EGGS }); stubTx();
    const r = await FarmRecordService.save({ groupId: 'g1', recordType: 'eggs', quantity: 4200, detail: { broken: 30 } }, caller);
    expect(r).toMatchObject({ session: 'day', quantity: 4200, detail: { broken: 30 }, cycleId: 'c1' });
  });

  it('asks for what the record type requires, in words', async () => {
    stubDb({ animal: cow, type: MILK });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', quantity: 5 }, caller)).rejects.toThrow(/Session is needed/);
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am' }, caller)).rejects.toThrow(/Quantity is needed/);
  });

  it('rejects negative, non-numeric and absurd numbers and a bad choice', async () => {
    stubDb({ animal: cow, type: MILK });
    for (const q of [-1, 'abc', 1e12]) {
      await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: q as any }, caller)).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'noon' as any, quantity: 1 }, caller)).rejects.toThrow(/must be one of/);
  });

  it('refuses a record that does not apply to the subject (the engine decides, not this service)', async () => {
    stubDb({ animal: cow, type: MILK });
    assertAllowed.mockRejectedValue(new ValidationError("'milk' does not apply to this animal"));
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1 }, caller)).rejects.toThrow(/does not apply/);
  });

  it('refuses an event, an unknown type, both subjects and neither', async () => {
    stubDb({ animal: cow, type: HEAT });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'heat' }, caller)).rejects.toThrow(/is an event/);
    stubDb({ animal: cow, type: undefined });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'nope' }, caller)).rejects.toThrow(/not a record type/);
    await expect(FarmRecordService.save({ animalId: 'a1', groupId: 'g1', recordType: 'milk' }, caller)).rejects.toThrow(/one animal or one group/);
    await expect(FarmRecordService.save({ recordType: 'milk' }, caller)).rejects.toThrow(/one animal or one group/);
  });

  it('refuses a future date, one over a year back and a malformed one', async () => {
    stubDb({ animal: cow, type: MILK });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1, recordDate: '2999-01-01' }, caller)).rejects.toThrow(/future/);
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1, recordDate: '2001-01-01' }, caller)).rejects.toThrow(/year back/);
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1, recordDate: '2026-13-45' }, caller)).rejects.toThrow(/not valid/);
  });

  it('tenant: a farm the caller has no claim on looks like it does not exist, and nothing is written', async () => {
    stubDb({ animal: cow, type: MILK, access: false });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1 }, caller)).rejects.toBeInstanceOf(NotFoundError);
    stubDb({ group: flock, type: MILK, access: false });
    await expect(FarmRecordService.save({ groupId: 'g1', recordType: 'milk', session: 'am', quantity: 1 }, caller)).rejects.toBeInstanceOf(NotFoundError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("tenant: a farm id that does not match the animal's farm is refused", async () => {
    stubDb({ animal: cow, type: MILK });
    await expect(FarmRecordService.save({ enterpriseId: 'other', animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1 }, caller)).rejects.toThrow(/not on the selected farm/);
  });

  it('an animal that is on no farm is told to join one', async () => {
    stubDb({ animal: { ...cow, enterprise_id: null }, type: MILK });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'milk', session: 'am', quantity: 1 }, caller)).rejects.toThrow(/not on a farm yet/);
  });

  it('deaths go through the population ledger, never the daily table', async () => {
    stubDb({ group: flock, type: MORTALITY });
    recordPopulationEvent.mockResolvedValue({ groupId: 'g1', cycleId: 'c1', eventType: 'mortality', quantity: -12 });
    const r = await FarmRecordService.save({ groupId: 'g1', recordType: 'mortality', quantity: 12, detail: { cause: 'heat' }, recordDate: '2026-11-10' }, caller);
    expect(recordPopulationEvent).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1', cycleId: 'c1', eventType: 'mortality', quantity: 12, eventDate: '2026-11-10', reason: 'heat', userId: 'u1' }));
    expect(r).toMatchObject({ ledger: true });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('deaths need a group and a number above zero', async () => {
    stubDb({ animal: cow, type: MORTALITY });
    await expect(FarmRecordService.save({ animalId: 'a1', recordType: 'mortality', quantity: 1 }, caller)).rejects.toThrow(/against a group/);
    stubDb({ group: flock, type: MORTALITY });
    await expect(FarmRecordService.save({ groupId: 'g1', recordType: 'mortality', quantity: 0 }, caller)).rejects.toThrow(/above zero/);
  });
});

describe('FarmRecordService.list / summary / remove', () => {
  it('list needs a farm, animal or group', async () => {
    await expect(FarmRecordService.list({}, caller)).rejects.toThrow(/Say which/);
  });

  it('list and summary check farm access first', async () => {
    stubDb({ access: false });
    await expect(FarmRecordService.list({ enterpriseId: 'e1' }, caller)).rejects.toBeInstanceOf(NotFoundError);
    await expect(FarmRecordService.summary('e1', 7, caller)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('admin skips the membership check', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(FarmRecordService.list({ enterpriseId: 'e1' }, { userId: 'adm', role: 'admin' })).resolves.toEqual([]);
  });

  it('a worker cannot delete a record somebody else entered; the farm owner can', async () => {
    const answer = (isManager: boolean) => async (sql: string) => {
      if (/SELECT \* FROM farm_daily_records WHERE id/.test(sql)) return { rows: [{ id: 'r1', enterprise_id: 'e1', recorded_by: 'someone-else' }] };
      if (/UNION SELECT/.test(sql)) return { rows: isManager ? [{ x: 1 }] : [] };
      if (/FROM enterprises e WHERE/.test(sql)) return { rows: [{ x: 1 }] };
      return { rows: [] };
    };
    query.mockImplementation(answer(false));
    await expect(FarmRecordService.remove('r1', caller)).rejects.toThrow(/person who entered/);
    query.mockImplementation(answer(true));
    stubTx();
    await expect(FarmRecordService.remove('r1', caller)).resolves.toBeUndefined();
  });
});
