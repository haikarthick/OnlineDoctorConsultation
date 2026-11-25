import AnimalService from '../../src/services/AnimalService';
import BodyMeasurementService from '../../src/services/BodyMeasurementService';
import database from '../../src/utils/database';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/BodyMeasurementService', () => ({ __esModule: true, default: { record: jest.fn().mockResolvedValue({}) } }));
jest.mock('../../src/services/FarmProfileService', () => ({ __esModule: true, default: { assertRecordTypeAllowed: jest.fn(), assertFieldsAllowed: jest.fn().mockResolvedValue(undefined) } }));

const query = database.query as jest.Mock;
const record = (BodyMeasurementService as any).record as jest.Mock;

/** NUT-226: a weight typed on the animal form is a weighing - it goes through the one weight writer, never straight into animals.weight. */
describe('AnimalService weight goes through the one weight writer', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('a new weight on the edit form is recorded as a weighing and NOT written to the animals column directly', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ species: 'Cattle', animalClass: 'cow', gender: 'female', weight: '350', weight_unit: 'kg' }] }) // current
      .mockResolvedValueOnce({ rows: [{ id: 'a1', name: 'Lakshmi' }] }) // UPDATE of the other field
      .mockResolvedValue({ rows: [{ id: 'a1', name: 'Lakshmi', weight: 380 }] }); // getAnimal
    await (AnimalService as any).updateAnimal('a1', { name: 'Lakshmi', weight: 380 });
    const updateSql = String(query.mock.calls.find(c => /UPDATE animals SET/.test(String(c[0])))?.[0] || '');
    expect(updateSql).not.toMatch(/\bweight = \$/);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ animalId: 'a1', weight: 380, unit: 'kg' }));
  });

  it('saving the form again with the same weight stacks no identical history row', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ species: 'Cattle', animalClass: 'cow', gender: 'female', weight: '350', weight_unit: 'kg' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1' }] });
    await (AnimalService as any).updateAnimal('a1', { name: 'Lakshmi', weight: 350 });
    expect(record).not.toHaveBeenCalled();
  });

  it('a weight alone is still recorded (no other field changed)', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ species: 'Dog', animalClass: null, gender: 'male', weight: null, weight_unit: null }] })
      .mockResolvedValue({ rows: [{ id: 'a2', weight: 12 }] });
    await (AnimalService as any).updateAnimal('a2', { weight: 12 });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ animalId: 'a2', weight: 12 }));
  });

  it('a nonsense weight is refused in words', async () => {
    await expect((AnimalService as any).updateAnimal('a1', { weight: -5 })).rejects.toThrow(/above zero/);
  });
});
