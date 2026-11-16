import database from '../../src/utils/database';
import FarmDueService from '../../src/services/FarmDueService';
import FarmRecordService from '../../src/services/FarmRecordService';
import { NotFoundError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/FarmRecordService');

const query = database.query as jest.Mock;
const access = FarmRecordService.assertFarmAccess as jest.Mock;
const caller = { userId: 'u1', role: 'farmer' };

beforeEach(() => { jest.resetAllMocks(); access.mockResolvedValue(undefined); });

describe('FarmDueService.list', () => {
  it('checks the caller belongs to the farm before reading anything', async () => {
    access.mockRejectedValue(new NotFoundError('Farm not found'));
    await expect(FarmDueService.list('e1', caller)).rejects.toBeInstanceOf(NotFoundError);
    expect(query).not.toHaveBeenCalled();
  });

  it('merges births, vaccinations and withdrawals, overdue first then soonest', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'a1', name: 'Lakshmi', due: '2026-11-20', in_days: '4' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a2', name: 'Bessie', vaccine_name: 'FMD', due: '2026-11-10', in_days: '-6' }] })
      .mockResolvedValueOnce({ rows: [{ animal_id: null, group_id: 'g1', name: 'Dairy herd', what: 'milk', due: '2026-11-17', in_days: '1' }] });
    const items = await FarmDueService.list('e1', caller);
    expect(items.map(i => [i.kind, i.name, i.inDays])).toEqual([
      ['vaccination_due', 'Bessie', -6], ['withdrawal_ending', 'Dairy herd', 1], ['birth_expected', 'Lakshmi', 4],
    ]);
    expect(items[0]).toMatchObject({ detail: 'FMD', animalId: 'a2' });
    expect(items[1]).toMatchObject({ groupId: 'g1', detail: 'milk', animalId: null });
  });

  it('every query is scoped to the farm and only reads dates that were recorded', async () => {
    query.mockResolvedValue({ rows: [] });
    await FarmDueService.list('e1', caller);
    expect(query).toHaveBeenCalledTimes(3);
    for (const [sql, params] of query.mock.calls) {
      expect(params[0]).toBe('e1');
      expect(sql).toMatch(/enterprise_id = \$1|= \$1/);
    }
  });
});
