import database from '../../src/utils/database';
import FarmEventService, { GROUP_EVENT_ACTIONS } from '../../src/services/FarmEventService';
import FarmRecordService from '../../src/services/FarmRecordService';
import FarmProfileService from '../../src/services/FarmProfileService';
import BatchManagementService from '../../src/services/BatchManagementService';
import { ValidationError, NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/FarmRecordService');
jest.mock('../../src/services/FarmProfileService');
jest.mock('../../src/services/BatchManagementService');
jest.mock('../../src/services/withdrawal/WithdrawalService', () => ({ __esModule: true, default: { guard: jest.fn().mockResolvedValue(undefined) } }));

const query = database.query as jest.Mock;
const loadSubject = FarmRecordService.loadSubject as jest.Mock;
const loadRecordType = FarmRecordService.loadRecordType as jest.Mock;
const shape = FarmRecordService.shape as jest.Mock;
const checkDate = FarmRecordService.checkDate as jest.Mock;
const assertAllowed = FarmProfileService.assertRecordTypeAllowed as jest.Mock;
const openCycle = BatchManagementService.openCycle as jest.Mock;
const closeCycle = BatchManagementService.closeCycle as jest.Mock;
const recordPopulationEvent = BatchManagementService.recordPopulationEvent as jest.Mock;

const caller = { userId: 'u1', role: 'farmer' };
const flock = (over: Record<string, unknown> = {}) => ({
  enterpriseId: 'e1', kind: 'group', id: 'g1', speciesCode: 'Chicken', animalClass: null, gender: null, managementMode: 'batch', groupType: 'broilers', cycleId: 'c1', ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  loadSubject.mockResolvedValue(flock());
  checkDate.mockImplementation((d?: string) => d || '2026-11-10');
  assertAllowed.mockResolvedValue({});
  loadRecordType.mockImplementation(async (code: string) => ({ code, kind: 'event', unit: code.includes('harvest') ? 'kg' : 'head', fields: [] }));
  shape.mockImplementation((_f: unknown, i: any) => ({ quantity: i.quantity === undefined || i.quantity === null ? null : Number(i.quantity), session: 'day', detail: { ...(i.detail || {}) } }));
  recordPopulationEvent.mockResolvedValue({});
  openCycle.mockResolvedValue({ id: 'c9' });
  closeCycle.mockResolvedValue({});
  query.mockResolvedValue({ rows: [{ current_count: '480' }] });
});

describe('FarmEventService.recordGroupEvent', () => {
  it('placing a flock with no open cycle opens one, placing the birds through the ledger', async () => {
    loadSubject.mockResolvedValue(flock({ cycleId: null }));
    const r = await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'placement', quantity: 500, eventDate: '2026-11-01' }, caller);
    expect(openCycle).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1', placedCount: 500, startedAt: '2026-11-01', species: 'Chicken', userId: 'u1' }));
    expect(recordPopulationEvent).not.toHaveBeenCalled();
    expect(r).toMatchObject({ cycleOpened: true, cycleId: 'c9', count: 500 });
  });

  it('placing more birds into an open cycle adds to the ledger instead of opening a second cycle', async () => {
    await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'placement', quantity: 100 }, caller);
    expect(openCycle).not.toHaveBeenCalled();
    expect(recordPopulationEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'placement', quantity: 100, cycleId: 'c1', sourceRef: 'event:placement' }));
  });

  it('a pond stocking is a placement too', async () => {
    loadSubject.mockResolvedValue(flock({ cycleId: null, speciesCode: 'Vannamei Shrimp', groupType: 'pond' }));
    await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'stocking', quantity: 100000, detail: { seedSource: 'Hatchery A' } }, caller);
    expect(openCycle).toHaveBeenCalledWith(expect.objectContaining({ placedCount: 100000, notes: expect.stringContaining('from Hatchery A') }));
  });

  it('cull and partial sale remove birds through the ledger, with the buyer and amount in the reason', async () => {
    await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'cull', quantity: 8, detail: { reason: 'leg weakness' } }, caller);
    expect(recordPopulationEvent).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'cull', quantity: 8, reason: expect.stringContaining('leg weakness') }));
    await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'partial_sale', quantity: 200, detail: { amount: 30000, buyer: 'Ravi' } }, caller);
    expect(recordPopulationEvent).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'sale', quantity: 200, reason: expect.stringMatching(/amount 30000.*to Ravi/) }));
    expect(closeCycle).not.toHaveBeenCalled();
  });

  it('a clear-out sells the birds, then closes the batch', async () => {
    const r = await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'clear_out', quantity: 450 }, caller);
    expect(recordPopulationEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'sale', quantity: 450 }));
    expect(closeCycle).toHaveBeenCalledWith('c1', 'u1', expect.any(String));
    expect(recordPopulationEvent.mock.invocationCallOrder[0]).toBeLessThan(closeCycle.mock.invocationCallOrder[0]);
    expect(r).toMatchObject({ cycleClosed: true });
  });

  it('a clear-out with nothing left to count just closes the batch', async () => {
    await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'clear_out', quantity: 0 }, caller);
    expect(recordPopulationEvent).not.toHaveBeenCalled();
    expect(closeCycle).toHaveBeenCalled();
  });

  it('closing a group that has no open batch is refused in words', async () => {
    loadSubject.mockResolvedValue(flock({ cycleId: null }));
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'clear_out', quantity: 10 }, caller)).rejects.toThrow(/no open batch/);
  });

  it('a harvest changes the head count by the number of animals taken, not by the weight', async () => {
    await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'partial_harvest', quantity: 250, detail: { count: 9000, buyer: 'Mill' } }, caller);
    expect(recordPopulationEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'sale', quantity: 9000, reason: expect.stringContaining('250 kg') }));
  });

  it('a partial harvest without a count is refused with the reason, and nothing is written', async () => {
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'partial_harvest', quantity: 250 }, caller)).rejects.toThrow(/How many animals were taken out/);
    expect(recordPopulationEvent).not.toHaveBeenCalled();
  });

  it('refuses zero animals for an event that needs some', async () => {
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'cull', quantity: 0 }, caller)).rejects.toThrow(/above zero/);
  });

  it('refuses an event type that has no ledger meaning, listing what is allowed', async () => {
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'heat', quantity: 1 }, caller)).rejects.toThrow(/cannot be recorded here/);
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'heat' }, caller)).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a group that is kept animal by animal', async () => {
    loadSubject.mockResolvedValue(flock({ managementMode: 'individual' }));
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'cull', quantity: 1 }, caller)).rejects.toThrow(/animal by animal/);
  });

  it('asks the farm profile engine whether the event applies, and obeys it', async () => {
    assertAllowed.mockRejectedValue(new ValidationError("'cull' does not apply to this group"));
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'cull', quantity: 1 }, caller)).rejects.toThrow(/does not apply/);
    expect(assertAllowed).toHaveBeenCalledWith(expect.objectContaining({ speciesCode: 'Chicken', managementMode: 'batch', groupType: 'broilers' }), 'cull', 'group');
    expect(recordPopulationEvent).not.toHaveBeenCalled();
  });

  it('tenant: a group the caller has no claim on is refused before anything is written', async () => {
    loadSubject.mockRejectedValue(new NotFoundError('Group not found'));
    await expect(FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'cull', quantity: 1 }, caller)).rejects.toBeInstanceOf(NotFoundError);
    expect(loadSubject).toHaveBeenCalledWith({ groupId: 'g1' }, caller, true); // write access, so a read-only farm vet is refused too
    expect(recordPopulationEvent).not.toHaveBeenCalled();
    expect(openCycle).not.toHaveBeenCalled();
  });

  it('reports the head count that is left', async () => {
    const r = await FarmEventService.recordGroupEvent({ groupId: 'g1', eventType: 'cull', quantity: 8 }, caller);
    expect(r).toMatchObject({ currentCount: 480, ledgerType: 'cull', cycleClosed: false, cycleOpened: false });
  });
});

describe('GROUP_EVENT_ACTIONS', () => {
  it('only ever removes animals through event types the ledger treats as removals', () => {
    const removes = ['cull', 'sale'];
    for (const [code, a] of Object.entries(GROUP_EVENT_ACTIONS)) {
      if (a.opensCycle) expect(a.ledger).toBe('placement');
      else expect(removes).toContain(a.ledger);
      if (a.closesCycle) expect(a.opensCycle).toBeUndefined();
      expect(code).toMatch(/^[a-z_]+$/);
    }
  });
});
