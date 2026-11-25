import database from '../../src/utils/database';
import NotificationService from '../../src/services/NotificationService';
import NutritionNotifier from '../../src/services/nutrition/NutritionNotifier';
import NutritionService from '../../src/services/nutrition/NutritionService';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/NotificationService', () => ({ __esModule: true, default: { createNotification: jest.fn().mockResolvedValue({}) } }));

const query = database.query as jest.Mock;

/** NUT-135 (a sold or dead animal), NUT-173/174 (who is told). */
describe('nutrition lifecycle', () => {
  beforeEach(() => { jest.resetAllMocks(); (NotificationService.createNotification as jest.Mock).mockResolvedValue({}); });

  it('a sold animal has its plans archived and its alerts closed, and raises none', async () => {
    query.mockImplementation(async (sql: string) => (/FROM animals WHERE id/.test(sql) ? { rows: [{ status: 'sold', is_active: true }] } : { rows: [] }));
    const flags = await NutritionService.evaluateFlags('a1');
    expect(flags).toEqual([]);
    const sqls = query.mock.calls.map(c => String(c[0]));
    expect(sqls.some(s => /UPDATE nutrition_plans SET status = 'archived'/.test(s))).toBe(true);
    expect(sqls.some(s => /UPDATE nutrition_risk_flags SET status = 'resolved'/.test(s))).toBe(true);
  });

  it('an alert that only informs sends nothing', async () => {
    await NutritionNotifier.flagRaised({ animalId: 'a1' }, { id: 'f1', type: 'bcs_high', severity: 'info' });
    expect(NotificationService.createNotification).not.toHaveBeenCalled();
  });

  it('a new act alert tells the owner, the farm team and the connected vet once each', async () => {
    query.mockImplementation(async (sql: string) => {
      if (/FROM animals WHERE id/.test(sql)) return { rows: [{ name: 'Lakshmi', owner_id: 'owner', enterprise_id: 'e1' }] };
      if (/FROM enterprises WHERE id/.test(sql)) return { rows: [{ id: 'owner' }, { id: 'manager' }] };
      if (/FROM consultations/.test(sql)) return { rows: [{ id: 'vet' }] };
      return { rows: [] }; // nobody has been told yet
    });
    await NutritionNotifier.flagRaised({ animalId: 'a1' }, { id: 'f1', type: 'rapid_weight_loss', severity: 'act' });
    const told = (NotificationService.createNotification as jest.Mock).mock.calls.map(c => c[0]).sort();
    expect(told).toEqual(['manager', 'owner', 'vet']);
  });

  it('a person already told about the same alert is not told again', async () => {
    query.mockImplementation(async (sql: string) => {
      if (/FROM animals WHERE id/.test(sql)) return { rows: [{ name: 'Lakshmi', owner_id: 'owner', enterprise_id: null }] };
      if (/FROM notifications/.test(sql)) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    });
    await NutritionNotifier.flagRaised({ animalId: 'a1' }, { id: 'f1', type: 'bcs_low', severity: 'watch' });
    expect(NotificationService.createNotification).not.toHaveBeenCalled();
  });

  it('a plan waiting for a vet asks the connected vet to check it and tells the owner it is waiting', async () => {
    query.mockImplementation(async (sql: string) => {
      if (/FROM animals WHERE id/.test(sql)) return { rows: [{ name: 'Rex', owner_id: 'owner', enterprise_id: null }] };
      if (/FROM consultations/.test(sql)) return { rows: [{ id: 'vet1' }] };
      return { rows: [] };
    });
    await NutritionNotifier.planWaitingForVet({ animalId: 'a1' }, 'p1');
    expect((NotificationService.createNotification as jest.Mock).mock.calls.map(c => c[0])).toEqual(['owner', 'vet1']);
  });
});
