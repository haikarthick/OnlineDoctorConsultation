import database from '../../src/utils/database';
import { requireFarmRecord, requireOwnChatSession, FARM_RECORD_NO_ACCESS_MESSAGE, CHAT_NO_ACCESS_MESSAGE } from '../../src/middleware/recordAccess';

jest.mock('../../src/utils/database');
const query = database.query as jest.Mock;

const ID = '11111111-1111-1111-1111-111111111111';
const FARM = '22222222-2222-2222-2222-222222222222';

function run(mw: any, req: any) {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  const next = jest.fn();
  return mw({ params: { id: ID }, method: 'PUT', userId: 'u1', userRole: 'farmer', userRoles: ['farmer'], ...req }, res, next).then(() => ({ res, next }));
}

/** database.query answers in call order: 1 = the record's farm, then FarmAccessService.roleOf (once per can/assert). */
function answers(...rows: any[][]) { rows.forEach(r => query.mockResolvedValueOnce({ rows: r })); }

describe('requireFarmRecord (a record addressed by its own id: the record\'s farm decides)', () => {
  beforeEach(() => query.mockReset());

  it('refuses a stranger with the same plain sentence as a record that does not exist', async () => {
    answers([{ enterprise_id: FARM }], [{ role: null }]);
    const stranger = await run(requireFarmRecord('iot_sensors'), {});
    query.mockReset(); answers([]);
    const missing = await run(requireFarmRecord('iot_sensors'), {});
    expect(stranger.res.statusCode).toBe(403);
    expect(stranger.res.body.message).toBe(FARM_RECORD_NO_ACCESS_MESSAGE);
    expect(missing.res.body.message).toBe(FARM_RECORD_NO_ACCESS_MESSAGE);
    expect(stranger.next).not.toHaveBeenCalled();
  });

  it('lets a worker on the farm change the record', async () => {
    answers([{ enterprise_id: FARM }], [{ role: 'worker' }], [{ role: 'worker' }]);
    const { next } = await run(requireFarmRecord('shift_schedules'), {});
    expect(next).toHaveBeenCalled();
  });

  it('lets a viewer look but tells them in plain words that they cannot change it', async () => {
    answers([{ enterprise_id: FARM }], [{ role: 'viewer' }], [{ role: 'viewer' }]);
    const write = await run(requireFarmRecord('geofence_zones'), { method: 'DELETE' });
    expect(write.res.statusCode).toBe(403);
    expect(write.res.body.message).toMatch(/lets you see it but not add or change/);
    query.mockReset(); answers([{ enterprise_id: FARM }], [{ role: 'viewer' }], [{ role: 'viewer' }]);
    const read = await run(requireFarmRecord('product_batches', 'id'), { method: 'GET' });
    expect(read.next).toHaveBeenCalled();
  });

  it('a malformed id is refused without touching the database', async () => {
    const { res } = await run(requireFarmRecord('iot_sensors'), { params: { id: "1'; DROP TABLE x;--" } });
    expect(res.statusCode).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('a built-in row with no farm (system report template) can be changed by an admin only', async () => {
    answers([{ enterprise_id: null }]);
    const farmer = await run(requireFarmRecord('report_templates'), {});
    expect(farmer.res.statusCode).toBe(403);
    query.mockReset(); answers([{ enterprise_id: null }]);
    const admin = await run(requireFarmRecord('report_templates'), { userRole: 'admin', userRoles: ['admin'] });
    expect(admin.next).toHaveBeenCalled();
  });

  it('refuses a table that is not on the list when the route is built', () => {
    expect(() => requireFarmRecord('users' as any)).toThrow();
  });
});

describe('requireOwnChatSession (a chat is private to the person who had it)', () => {
  beforeEach(() => query.mockReset());
  it('opens your own chat', async () => {
    answers([{ user_id: 'u1' }]);
    expect((await run(requireOwnChatSession(), {})).next).toHaveBeenCalled();
  });
  it('refuses someone else\'s chat and a missing one with the same sentence', async () => {
    answers([{ user_id: 'someone-else' }]);
    const other = await run(requireOwnChatSession(), {});
    query.mockReset(); answers([]);
    const missing = await run(requireOwnChatSession(), {});
    expect(other.res.body.message).toBe(CHAT_NO_ACCESS_MESSAGE);
    expect(missing.res.body.message).toBe(CHAT_NO_ACCESS_MESSAGE);
  });
  it('an admin is not let into a private chat', async () => {
    answers([{ user_id: 'someone-else' }]);
    const r = await run(requireOwnChatSession(), { userRole: 'admin', userRoles: ['admin'] });
    expect(r.next).not.toHaveBeenCalled();
  });
});
