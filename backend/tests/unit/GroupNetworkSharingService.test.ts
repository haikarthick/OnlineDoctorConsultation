import GroupNetworkSharingService, { formatCode, BAD_CODE_MESSAGE } from '../../src/services/GroupNetworkSharingService';
import database from '../../src/utils/database';

jest.mock('../../src/utils/database');
jest.mock('../../src/services/NotificationService', () => ({ __esModule: true, default: { createNotification: jest.fn() } }));
jest.mock('../../src/middleware/hospitalDataIsolation', () => ({ logClinicalAccess: jest.fn().mockResolvedValue(undefined) }));

describe('GroupNetworkSharingService', () => {
  beforeEach(() => jest.resetAllMocks());

  it('formats a code as XXXX-XXXX', () => { expect(formatCode('ABCD2345')).toBe('ABCD-2345'); });

  it('creates a code for the current cycle and stores only its hash', async () => {
    (database.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 'g1', name: 'Flock', enterprise_id: 'e1', owner_id: 'u1' }] }) // group
      .mockResolvedValueOnce({ rows: [{ id: 'cy1', cycle_number: 2 }] })                                    // active cycle
      .mockResolvedValueOnce({ rows: [{ id: 'code1' }] });                                                  // insert
    const r = await GroupNetworkSharingService.createCode('g1', 'u1', { prescriptions: false });
    expect(r.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(r.cycleId).toBe('cy1');
    const insert = (database.query as jest.Mock).mock.calls[2];
    expect(insert[1]).not.toContain(r.code);
    expect(insert[1]).not.toContain(r.code.replace('-', ''));
    expect(insert[1][0]).toBe('g1');
    expect(insert[1][6]).toBe(false); // prescriptions left out
  });

  it('refuses an empty code in words', async () => {
    await expect(GroupNetworkSharingService.redeem('n1', 'u1', '  ', null)).rejects.toThrow(/Enter the code/);
  });

  it('reads nothing for a group that is not shared with the network, and says what to do', async () => {
    (database.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(GroupNetworkSharingService.recordsForNetwork('n1', 'g1', 'u1', 'hospital_staff', null)).rejects.toThrow(/not shared with your network/);
  });

  it('ends every live sharing and open code bound to a closed cycle', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await GroupNetworkSharingService.endForCycle('cy1', client);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(String(client.query.mock.calls[0][0])).toMatch(/cycle_closed/);
    expect(BAD_CODE_MESSAGE).toMatch(/Ask the farm owner/);
  });
});
