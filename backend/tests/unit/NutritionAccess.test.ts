import database from '../../src/utils/database';
import FarmAccessService from '../../src/services/FarmAccessService';
import { checkAnimalAccess } from '../../src/middleware/hospitalDataIsolation';
import NutritionAccess, { NO_NUTRITION_ACCESS_MESSAGE, READ_ONLY_MESSAGE, REVIEW_ONLY_VET_MESSAGE } from '../../src/services/nutrition/NutritionAccess';

jest.mock('../../src/utils/database');
jest.mock('../../src/middleware/hospitalDataIsolation', () => ({
  checkAnimalAccess: jest.fn(),
  logClinicalAccess: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/FarmAccessService', () => {
  const actual = jest.requireActual('../../src/services/FarmAccessService');
  return { __esModule: true, ...actual, default: { roleOf: jest.fn(), consultingVetMayRead: jest.fn() } };
});

const petRow = { id: 'a1', name: 'Bruno', owner_id: 'owner', enterprise_id: null, species: 'Dog', animal_class: null };
const farmRow = { ...petRow, id: 'a2', name: 'Lakshmi', species: 'Cattle', enterprise_id: 'farm1' };

const animal = (row: any) => (database.query as jest.Mock).mockResolvedValueOnce({ rows: [row] });

describe('NutritionAccess - one gate for every nutrition endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkAnimalAccess as jest.Mock).mockResolvedValue({ allowed: true, isPrivate: false, accessType: 'public' });
    (FarmAccessService.roleOf as jest.Mock).mockResolvedValue(null);
    (FarmAccessService.consultingVetMayRead as jest.Mock).mockResolvedValue(false);
  });

  it('the owner may read and write, but not review unless they are a vet', async () => {
    animal(petRow);
    const a = await NutritionAccess.forAnimal('a1', { userId: 'owner', role: 'pet_owner' }, 'write');
    expect(a).toMatchObject({ via: 'owner', canWrite: true, canReview: false });
    animal(petRow);
    await expect(NutritionAccess.forAnimal('a1', { userId: 'owner', role: 'pet_owner' }, 'review')).rejects.toThrow(REVIEW_ONLY_VET_MESSAGE);
  });

  it('a stranger is refused with words that say why and what to do (no ids, no codes)', async () => {
    animal(petRow);
    const err = await NutritionAccess.forAnimal('a1', { userId: 'someone', role: 'pet_owner' }).catch(e => e);
    expect(err).toMatchObject({ statusCode: 403, errorCode: expect.stringMatching(/^NUT_/) });
    expect(err.message).toBe(NO_NUTRITION_ACCESS_MESSAGE);
  });

  it('another pet owner cannot reach a farm animal just by knowing its id', async () => {
    animal(farmRow);
    await expect(NutritionAccess.forAnimal('a2', { userId: 'someone', role: 'farmer' })).rejects.toMatchObject({ statusCode: 403, errorCode: expect.stringMatching(/^(NUT|ANIMAL)_/) });
  });

  it('a farm worker writes, a farm viewer only reads', async () => {
    animal(farmRow);
    (FarmAccessService.roleOf as jest.Mock).mockResolvedValueOnce('worker');
    expect(await NutritionAccess.forAnimal('a2', { userId: 'w', role: 'farmer' }, 'write')).toMatchObject({ via: 'farm', canWrite: true });

    animal(farmRow);
    (FarmAccessService.roleOf as jest.Mock).mockResolvedValueOnce('viewer');
    await expect(NutritionAccess.forAnimal('a2', { userId: 'v', role: 'farmer' }, 'write')).rejects.toThrow(READ_ONLY_MESSAGE);
  });

  it('a vet gets in only with an appointment for this animal', async () => {
    animal(petRow);
    await expect(NutritionAccess.forAnimal('a1', { userId: 'vet', role: 'veterinarian' })).rejects.toMatchObject({ statusCode: 403, errorCode: expect.stringMatching(/^(NUT|ANIMAL)_/) });

    animal(petRow);
    (FarmAccessService.consultingVetMayRead as jest.Mock).mockResolvedValueOnce(true);
    expect(await NutritionAccess.forAnimal('a1', { userId: 'vet', role: 'veterinarian' }, 'review')).toMatchObject({ via: 'vet', canReview: true });
    expect(FarmAccessService.consultingVetMayRead).toHaveBeenCalledWith('vet', { animalId: 'a1' });
  });

  it('a hospital-private animal keeps its existing isolation rule', async () => {
    animal(petRow);
    (checkAnimalAccess as jest.Mock).mockResolvedValueOnce({ allowed: false, isPrivate: true, reason: 'Access requires explicit patient consent.' });
    await expect(NutritionAccess.forAnimal('a1', { userId: 'vet', role: 'veterinarian' })).rejects.toThrow(/consent/);
  });

  it('admin passes; a missing or inactive animal is "not found"', async () => {
    animal(petRow);
    expect(await NutritionAccess.forAnimal('a1', { userId: 'adm', role: 'admin' }, 'review')).toMatchObject({ via: 'admin' });
    (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(NutritionAccess.forAnimal('zz', { userId: 'adm', role: 'admin' })).rejects.toMatchObject({ statusCode: 404, errorCode: 'NUT_NOT_FOUND' });
  });

  it('a user holding the vet role as a second role is treated as a vet', async () => {
    animal(petRow);
    (FarmAccessService.consultingVetMayRead as jest.Mock).mockResolvedValueOnce(true);
    expect(await NutritionAccess.forAnimal('a1', { userId: 'u', role: 'farmer', roles: ['farmer', 'veterinarian'] })).toMatchObject({ via: 'vet' });
  });
});
