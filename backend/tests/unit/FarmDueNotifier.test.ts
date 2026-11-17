import database from '../../src/utils/database';
import FarmDueNotifier, { summarise } from '../../src/services/FarmDueNotifier';
import FarmDueService from '../../src/services/FarmDueService';
import NotificationService from '../../src/services/NotificationService';
import { isFarmRecordsEnabled } from '../../src/services/farmRecords/FarmRecordsConfig';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/FarmDueService');
jest.mock('../../src/services/NotificationService');
jest.mock('../../src/services/farmRecords/FarmRecordsConfig');

const query = database.query as jest.Mock;
const listForFarm = FarmDueService.listForFarm as jest.Mock;
const create = NotificationService.createNotification as jest.Mock;
const enabled = isFarmRecordsEnabled as jest.Mock;

const item = (over: Record<string, unknown>) => ({ kind: 'birth_expected', date: '2026-11-18', inDays: 2, animalId: 'a', groupId: null, name: 'Lakshmi', detail: null, ...over });

beforeEach(() => { jest.resetAllMocks(); enabled.mockResolvedValue(true); });

describe('summarise', () => {
  it('says what is coming, when, in plain words', () => {
    const s = summarise([item({}), item({ kind: 'vaccination_due', inDays: -2, name: 'Bessie', detail: 'FMD' }), item({ kind: 'withdrawal_ending', inDays: 0, name: 'Herd', detail: 'milk' })] as any);
    expect(s.title).toBe('3 things coming up on your farm');
    expect(s.message).toContain('Lakshmi: birth expected (in 2 days)');
    expect(s.message).toContain('Bessie: FMD due (2 days overdue)');
    expect(s.message).toContain('Herd: milk withdrawal ends (today)');
  });
  it('one item has a singular title; a long list is cut with a count', () => {
    expect(summarise([item({})] as any).title).toBe('Coming up on your farm');
    expect(summarise(Array.from({ length: 10 }, () => item({})) as any).message).toContain('and 2 more');
  });
});

describe('FarmDueNotifier', () => {
  it('does nothing while the module is switched off', async () => {
    enabled.mockResolvedValue(false);
    expect(await FarmDueNotifier.run()).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('tells the owner and managers once, and only about urgent items', async () => {
    listForFarm.mockResolvedValue([item({ inDays: 2 }), item({ name: 'Far', inDays: 10 })]);
    query.mockImplementation(async (sql: string) => {
      if (/SELECT id, name FROM enterprises/.test(sql)) return { rows: [{ id: 'e1', name: 'Green Pastures' }] };
      if (/enterprise_members em/.test(sql)) return { rows: [{ user_id: 'owner' }, { user_id: 'mgr' }] };
      return { rows: [] }; // nothing sent yet today
    });
    expect(await FarmDueNotifier.run()).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    const [, , title, message, channel, meta] = create.mock.calls[0];
    expect(title).toContain('Green Pastures');
    expect(message).toContain('Lakshmi');
    expect(message).not.toContain('Far');
    expect(channel).toBe('in_app');
    expect(meta.dedupeKey).toMatch(/^farm-due:e1:\d{4}-\d{2}-\d{2}$/);
  });

  it('never sends twice in a day to the same person', async () => {
    listForFarm.mockResolvedValue([item({})]);
    query.mockImplementation(async (sql: string) => {
      if (/SELECT id, name FROM enterprises/.test(sql)) return { rows: [{ id: 'e1', name: 'F' }] };
      if (/enterprise_members em/.test(sql)) return { rows: [{ user_id: 'owner' }] };
      if (/FROM notifications/.test(sql)) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    });
    expect(await FarmDueNotifier.run()).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('a farm with nothing urgent sends nothing, and one failing farm does not stop the others', async () => {
    listForFarm.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    query.mockImplementation(async (sql: string) => (/SELECT id, name FROM enterprises/.test(sql) ? { rows: [{ id: 'e1', name: 'A' }, { id: 'e2', name: 'B' }] } : { rows: [] }));
    expect(await FarmDueNotifier.run()).toBe(0);
    expect(listForFarm).toHaveBeenCalledTimes(2);
  });
});
