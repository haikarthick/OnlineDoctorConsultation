import database from '../../src/utils/database';
import breedingService from '../../src/services/BreedingService';
import animalService from '../../src/services/AnimalService';
import FarmProfileService from '../../src/services/FarmProfileService';
import { animalStatusForRecordStatus, ANIMAL_BREEDING_STATUSES } from '../../src/utils/breedingStatus';
import { ValidationError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/FarmProfileService');

const query = database.query as jest.Mock;

describe('breeding status vocabulary', () => {
  it('maps every breeding-record status onto the animal vocabulary', () => {
    expect(animalStatusForRecordStatus('bred')).toBe('bred');
    expect(animalStatusForRecordStatus('confirmed_pregnant')).toBe('pregnant');
    expect(animalStatusForRecordStatus('not_pregnant')).toBe('not_pregnant');
    for (const ended of ['delivered', 'aborted', 'reabsorbed']) expect(animalStatusForRecordStatus(ended)).toBe('not_bred');
  });

  it('accepts the legacy spellings that were already in the data', () => {
    expect(animalStatusForRecordStatus('confirmed')).toBe('pregnant');
    expect(animalStatusForRecordStatus('open')).toBe('not_bred');
  });

  it('never invents a status for something it does not know', () => {
    expect(animalStatusForRecordStatus('mystery')).toBeNull();
    expect(animalStatusForRecordStatus(undefined)).toBeNull();
  });

  it('only ever produces a value the database constraint allows', () => {
    for (const s of ['bred', 'confirmed_pregnant', 'confirmed', 'not_pregnant', 'delivered', 'aborted', 'reabsorbed', 'open']) {
      expect(ANIMAL_BREEDING_STATUSES).toContain(animalStatusForRecordStatus(s) as never);
    }
  });
});

describe('BreedingService: a birth is counted once', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  const wire = (previous: string | null, updated: any) => {
    query
      .mockResolvedValueOnce({ rows: previous === null ? [] : [{ status: previous }] }) // status before
      .mockResolvedValueOnce({ rows: [updated] })                                        // the UPDATE
      .mockResolvedValue({ rows: [] });                                                  // dam updates
  };
  const damUpdates = () => query.mock.calls.filter(c => String(c[0]).includes('UPDATE animals'));

  it('writes the mapped status to the dam, not the record\'s own word', async () => {
    wire('bred', { id: 'b1', dam_id: 'd1', status: 'confirmed_pregnant' });
    await breedingService.update('b1', { status: 'confirmed_pregnant' });
    const [statusUpdate] = damUpdates();
    expect(statusUpdate[1]).toEqual(['pregnant', 'd1']);
  });

  it('increments births when the record BECOMES delivered', async () => {
    wire('confirmed_pregnant', { id: 'b1', dam_id: 'd1', status: 'delivered', actual_birth_date: '2026-11-01' });
    await breedingService.update('b1', { status: 'delivered', actualBirthDate: '2026-11-01' });
    const birth = damUpdates().find(c => String(c[0]).includes('parity'));
    expect(birth).toBeDefined();
    expect(birth![1]).toEqual(['2026-11-01', 'd1', true]); // newlyDelivered = true
  });

  it('does NOT add a second birth when an already-delivered record is edited', async () => {
    wire('delivered', { id: 'b1', dam_id: 'd1', status: 'delivered', actual_birth_date: '2026-11-01' });
    await breedingService.update('b1', { notes: 'calf looks well' });
    const birth = damUpdates().find(c => String(c[0]).includes('parity'));
    expect(birth![1][2]).toBe(false); // newlyDelivered = false: parity unchanged
  });

  it('records no birth for a pregnancy that ended any other way', async () => {
    wire('confirmed_pregnant', { id: 'b1', dam_id: 'd1', status: 'aborted' });
    await breedingService.update('b1', { status: 'aborted' });
    expect(damUpdates().some(c => String(c[0]).includes('parity'))).toBe(false);
    expect(damUpdates()[0][1]).toEqual(['not_bred', 'd1']);
  });
});

describe('AnimalService: a farm field must apply to the animal', () => {
  const profile = (hidden: string[]) => ({
    speciesKnown: true,
    fields: new Proxy({}, { get: (_t, key: string) => (hidden.includes(key) ? 'hidden' : 'optional') }),
  });

  beforeEach(() => { jest.clearAllMocks(); });

  it('refuses milk yield for a bull, naming the field and the animal', async () => {
    (FarmProfileService.resolve as jest.Mock).mockResolvedValue(profile(['avgDailyMilk', 'parity', 'pregnancyStatus']));
    await expect(animalService.createAnimal('u1', { name: 'Raja', species: 'Cattle', animalClass: 'cattle_bull', avgDailyMilkLitres: 8 } as any))
      .rejects.toThrow(/average daily milk cannot be set for this animal \(Cattle, cattle_bull\)/);
    expect(query).not.toHaveBeenCalled(); // nothing was written
  });

  it('is a ValidationError (a 400), not a generic database error', async () => {
    (FarmProfileService.resolve as jest.Mock).mockResolvedValue(profile(['avgDailyMilk']));
    await expect(animalService.createAnimal('u1', { name: 'Raja', species: 'Cattle', avgDailyMilkLitres: 8 } as any)).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows it for a cow and stores it', async () => {
    (FarmProfileService.resolve as jest.Mock).mockResolvedValue(profile([]));
    query.mockResolvedValue({ rows: [{ id: 'a1', last_seq: 1 }] });
    await animalService.createAnimal('u1', { name: 'Lakshmi', species: 'Cattle', animalClass: 'cattle_cow', avgDailyMilkLitres: 8.5, parity: 2 } as any);
    const insert = query.mock.calls.find(c => String(c[0]).includes('INSERT INTO animals'))!;
    expect(insert[1]).toContain(8.5);
    expect(insert[1]).toContain(2);
  });

  it('does not consult the farm profile when no farm field is set (pets are unaffected)', async () => {
    query.mockResolvedValue({ rows: [{ id: 'a1', last_seq: 1 }] });
    await animalService.createAnimal('u1', { name: 'Rex', species: 'Dog', breed: 'Beagle' } as any);
    expect(FarmProfileService.resolve).not.toHaveBeenCalled();
  });

  it('validates a partial update against the animal as it is now', async () => {
    (FarmProfileService.resolve as jest.Mock).mockResolvedValue(profile(['dryOffDate']));
    query.mockResolvedValueOnce({ rows: [{ species: 'Cattle', animalClass: 'cattle_calf', gender: 'female' }] });
    await expect(animalService.updateAnimal('a1', { dryOffDate: '2026-11-01' })).rejects.toBeInstanceOf(ValidationError);
    expect((FarmProfileService.resolve as jest.Mock).mock.calls[0][0]).toMatchObject({ speciesCode: 'Cattle', animalClass: 'cattle_calf' });
  });

  it('stores a cleared field as NULL and ignores keys that are not columns', async () => {
    (FarmProfileService.resolve as jest.Mock).mockResolvedValue(profile([]));
    query
      .mockResolvedValueOnce({ rows: [{ species: 'Cattle', animalClass: 'cattle_cow', gender: 'female' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1' }] });
    await animalService.updateAnimal('a1', { groupId: '', 'name; DROP TABLE animals': 'x' } as any);
    const update = query.mock.calls.find(c => String(c[0]).startsWith('\n        UPDATE animals'))!;
    expect(String(update[0])).not.toContain('DROP TABLE');
    expect(update[1]).toEqual(['a1', null]); // groupId '' became NULL
  });
});
