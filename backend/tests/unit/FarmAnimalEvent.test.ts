import database from '../../src/utils/database';
import FarmEventService, { ANIMAL_EVENT_CODES } from '../../src/services/FarmEventService';
import FarmRecordService from '../../src/services/FarmRecordService';
import FarmProfileService from '../../src/services/FarmProfileService';
import BreedingService from '../../src/services/BreedingService';
import AnimalService from '../../src/services/AnimalService';
import AnimalGroupService from '../../src/services/AnimalGroupService';
import MedicalRecordService from '../../src/services/MedicalRecordService';
import { ValidationError, NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/FarmRecordService');
jest.mock('../../src/services/FarmProfileService');
jest.mock('../../src/services/BatchManagementService');
jest.mock('../../src/services/BreedingService');
jest.mock('../../src/services/AnimalService');
jest.mock('../../src/services/AnimalGroupService');
jest.mock('../../src/services/MedicalRecordService');

const query = database.query as jest.Mock;
const loadSubject = FarmRecordService.loadSubject as jest.Mock;
const loadRecordType = FarmRecordService.loadRecordType as jest.Mock;
const shape = FarmRecordService.shape as jest.Mock;
const checkDate = FarmRecordService.checkDate as jest.Mock;
const save = FarmRecordService.save as jest.Mock;
const assertAllowed = FarmProfileService.assertRecordTypeAllowed as jest.Mock;
const create = BreedingService.create as jest.Mock;
const update = BreedingService.update as jest.Mock;
const updateAnimal = AnimalService.updateAnimal as jest.Mock;
const removeAnimal = AnimalGroupService.removeAnimal as jest.Mock;
const addWeight = MedicalRecordService.addWeight as jest.Mock;

const caller = { userId: 'u1', role: 'farmer' };
const cow = { enterpriseId: 'e1', kind: 'animal', id: 'a1', speciesCode: 'Cattle', animalClass: 'cattle_cow', gender: 'female', managementMode: 'individual', groupType: null, cycleId: null };

let animalRow: { status: string; group_id: string | null } = { status: 'active', group_id: null };
let openRecord: { id: string } | null = null;

beforeEach(() => {
  jest.resetAllMocks();
  animalRow = { status: 'active', group_id: null };
  openRecord = null;
  loadSubject.mockResolvedValue(cow);
  checkDate.mockImplementation((d?: string) => d || '2026-11-10');
  assertAllowed.mockResolvedValue({});
  loadRecordType.mockImplementation(async (code: string) => ({ code, kind: 'event', unit: null, fields: [] }));
  shape.mockImplementation((_f: unknown, i: any) => ({ quantity: i.quantity ?? null, session: 'day', detail: { ...(i.detail || {}) } }));
  query.mockImplementation(async (sql: string) => {
    if (/FROM animals WHERE id/.test(sql)) return { rows: [animalRow] };
    if (/FROM breeding_records/.test(sql)) return { rows: openRecord ? [openRecord] : [] };
    return { rows: [] };
  });
  create.mockResolvedValue({ id: 'b1', expectedDueDate: '2027-08-20' });
  update.mockResolvedValue({ id: 'b1', expectedDueDate: '2027-08-20' });
});

const run = (eventType: string, extra: Record<string, unknown> = {}) =>
  FarmEventService.recordEvent({ animalId: 'a1', eventType, eventDate: '2026-11-10', ...extra } as any, caller);

describe('FarmEventService.recordEvent routing', () => {
  it('needs exactly one subject', async () => {
    await expect(FarmEventService.recordEvent({ eventType: 'cull' } as any, caller)).rejects.toThrow(/one animal or one group/);
    await expect(FarmEventService.recordEvent({ eventType: 'cull', animalId: 'a', groupId: 'g' } as any, caller)).rejects.toThrow(/one animal or one group/);
  });
});

describe('individual animal events', () => {
  it('a mating creates a breeding record and says when the birth is due', async () => {
    const r = await run('insemination', { detail: { method: 'artificial_insemination' } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ enterpriseId: 'e1', damId: 'a1', species: 'Cattle', breedingMethod: 'artificial_insemination', breedingDate: '2026-11-10', status: 'bred' }));
    expect(r).toMatchObject({ breedingRecordId: 'b1', expectedDueDate: '2027-08-20' });
  });

  it('a pregnancy check updates the open mating, positive or negative', async () => {
    openRecord = { id: 'b1' };
    await run('pregnancy_check', { detail: { result: 'pregnant' } });
    expect(update).toHaveBeenLastCalledWith('b1', expect.objectContaining({ status: 'confirmed_pregnant', pregnancyConfirmed: true, pregnancyCheckDate: '2026-11-10' }));
    await run('pregnancy_check', { detail: { result: 'not_pregnant' } });
    expect(update).toHaveBeenLastCalledWith('b1', expect.objectContaining({ status: 'not_pregnant', pregnancyConfirmed: false }));
  });

  it('a pregnancy check with no mating on record says to record the mating first', async () => {
    await expect(run('pregnancy_check', { detail: { result: 'pregnant' } })).rejects.toThrow(/Record the mating first/);
    expect(update).not.toHaveBeenCalled();
  });

  it('a birth completes the open record through the breeding service (which counts it once)', async () => {
    openRecord = { id: 'b1' };
    const r = await run('birth', { detail: { liveBirths: 1, stillbirths: 0 } });
    expect(update).toHaveBeenCalledWith('b1', expect.objectContaining({ status: 'delivered', actualBirthDate: '2026-11-10', liveBirths: 1, stillbirths: 0, offspringCount: 1 }));
    expect(create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ liveBirths: 1 });
  });

  it('a birth with no recorded mating still counts: a record is made from the birth entry', async () => {
    await run('birth', { detail: { liveBirths: 2 } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ damId: 'a1', breedingDate: '2026-11-10' }));
    expect(update).toHaveBeenCalledWith('b1', expect.objectContaining({ status: 'delivered', liveBirths: 2, offspringCount: 2 }));
  });

  it('dry-off sets the date on the animal; a weight goes to the weight history', async () => {
    await run('dry_off');
    expect(updateAnimal).toHaveBeenCalledWith('a1', { dryOffDate: '2026-11-10' });
    await run('weight', { detail: { weight: 412.5 } });
    expect(addWeight).toHaveBeenCalledWith('a1', 412.5, 'kg', 'u1', undefined);
    await expect(run('weight', { detail: { weight: 0 } })).rejects.toThrow(/above zero/);
  });

  it('heat is an observation: one record a day, nothing else changes', async () => {
    await run('heat');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ animalId: 'a1', recordType: 'heat', recordDate: '2026-11-10' }), caller, 'event');
    expect(create).not.toHaveBeenCalled();
    expect(updateAnimal).not.toHaveBeenCalled();
  });

  it('a sale or a death marks the animal, notes why, and takes it out of its group', async () => {
    animalRow = { status: 'active', group_id: 'g1' };
    const r = await run('sale', { detail: { amount: 45000, buyer: 'Ravi' } });
    const call = query.mock.calls.find(c => /UPDATE animals SET status/.test(c[0]))!;
    expect(call[1][0]).toBe('sold');
    expect(call[1][1]).toMatch(/amount 45000.*to Ravi/);
    expect(removeAnimal).toHaveBeenCalledWith('g1', 'a1');
    expect(r).toMatchObject({ status: 'sold' });
    await run('death', { detail: { cause: 'bloat' } });
    expect(query.mock.calls.filter(c => /UPDATE animals SET status/.test(c[0])).pop()![1][0]).toBe('deceased');
  });

  it('nothing more can be recorded for an animal that is already sold or dead', async () => {
    for (const status of ['sold', 'deceased']) {
      animalRow = { status, group_id: null };
      await expect(run('heat')).rejects.toThrow(new RegExp(`already marked as ${status}`));
    }
    expect(save).not.toHaveBeenCalled();
  });

  it('asks the farm profile engine whether the event applies, and obeys it (a bull has no heat)', async () => {
    assertAllowed.mockRejectedValue(new ValidationError("'heat' does not apply to this animal"));
    await expect(run('heat')).rejects.toThrow(/does not apply/);
    expect(assertAllowed).toHaveBeenCalledWith(expect.objectContaining({ speciesCode: 'Cattle', animalClass: 'cattle_cow', gender: 'female' }), 'heat', 'animal');
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses an event it does not know, listing what is allowed', async () => {
    await expect(run('shearing')).rejects.toThrow(/cannot be recorded here/);
  });

  it('tenant: write access to the animal\'s farm is checked first', async () => {
    loadSubject.mockRejectedValue(new NotFoundError('Animal not found'));
    await expect(run('heat')).rejects.toBeInstanceOf(NotFoundError);
    expect(loadSubject).toHaveBeenCalledWith({ animalId: 'a1' }, caller, true);
    expect(create).not.toHaveBeenCalled();
  });

  it('the allowed list is what the screen offers', () => {
    expect([...ANIMAL_EVENT_CODES].sort()).toEqual(['birth', 'death', 'dry_off', 'heat', 'insemination', 'pregnancy_check', 'sale', 'weight']);
  });
});
