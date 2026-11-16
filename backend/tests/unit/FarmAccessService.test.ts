import database from '../../src/utils/database';
import FarmAccessService, { roleCan, isFarmRole, NO_ACCESS_MESSAGE, FarmRole, FarmAction } from '../../src/services/FarmAccessService';
import { ForbiddenError, ValidationError } from '../../src/utils/errors';

jest.mock('../../src/utils/database');
const query = database.query as jest.Mock;

const ROLES: FarmRole[] = ['owner', 'manager', 'supervisor', 'worker', 'farm_vet', 'viewer'];

describe('the farm role matrix (the owner-approved rule)', () => {
  const expected: Record<FarmAction, FarmRole[]> = {
    read: ROLES,
    record: ['owner', 'manager', 'supervisor', 'worker'],
    clinical: ['owner', 'manager', 'supervisor', 'worker', 'farm_vet'],
    manage_farm: ['owner', 'manager'],
    manage_team: ['owner', 'manager'],
    change_roles: ['owner'],
  };
  for (const [action, roles] of Object.entries(expected)) {
    it(`${action}: ${roles.join(', ')}`, () => {
      for (const r of ROLES) expect(roleCan(r, action as FarmAction)).toBe(roles.includes(r));
    });
  }
  it('a person with no role on the farm can do nothing', () => {
    for (const a of Object.keys(expected)) expect(roleCan(null, a as FarmAction)).toBe(false);
  });
  it('knows which strings are farm roles', () => {
    expect(isFarmRole('worker')).toBe(true);
    expect(isFarmRole('pet_owner')).toBe(false);
    expect(isFarmRole(undefined)).toBe(false);
  });
});

describe('FarmAccessService.assert', () => {
  const as = (role: string | null) => query.mockResolvedValue({ rows: [{ role }] });
  beforeEach(() => jest.resetAllMocks());

  it('a platform admin may do anything and no lookup is made', async () => {
    await expect(FarmAccessService.assert('e1', { userId: 'a', role: 'admin' }, 'change_roles')).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('a stranger is told, in words, that only the owner adds people', async () => {
    as(null);
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, 'read')).rejects.toThrow(NO_ACCESS_MESSAGE);
    expect(NO_ACCESS_MESSAGE).toMatch(/ask them to invite you/);
    expect(NO_ACCESS_MESSAGE).not.toMatch(/\b\d{3}\b|not found/i);
  });

  it('a viewer and a farm vet may look but are refused a change, with their role named', async () => {
    for (const role of ['viewer', 'farm_vet']) {
      as(role);
      await expect(FarmAccessService.assert('e1', { userId: 'u' }, 'read')).resolves.toBe(role);
      await expect(FarmAccessService.assert('e1', { userId: 'u' }, 'record')).rejects.toThrow(new RegExp(`\\(${role.replace('_', ' ')}\\)`));
    }
  });

  it('a viewer is refused anything that changes data; a farm vet is not refused clinical work', async () => {
    as('viewer');
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, FarmAccessService.actionForMethod('POST'))).rejects.toBeInstanceOf(ForbiddenError);
    as('farm_vet');
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, FarmAccessService.actionForMethod('POST'))).resolves.toBe('farm_vet');
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, FarmAccessService.actionForMethod('GET'))).resolves.toBe('farm_vet');
  });

  it('a worker records but may not manage the team or the farm', async () => {
    as('worker');
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, 'record')).resolves.toBe('worker');
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, 'manage_team')).rejects.toThrow(/adding or removing people/);
    await expect(FarmAccessService.assert('e1', { userId: 'u' }, 'manage_farm')).rejects.toThrow(/settings/);
  });

  it('can() answers true / false without throwing', async () => {
    as('manager');
    await expect(FarmAccessService.can('e1', { userId: 'u' }, 'manage_team')).resolves.toBe(true);
    await expect(FarmAccessService.can('e1', { userId: 'u' }, 'change_roles')).resolves.toBe(false);
  });
});

describe('FarmAccessService.assertTeamChange (who may add, change and remove people)', () => {
  const t = (actor: FarmRole | null, change: Parameters<typeof FarmAccessService.assertTeamChange>[1]) => () => FarmAccessService.assertTeamChange(actor, change);

  it('the owner (and an admin) may add anyone but another owner', () => {
    for (const role of ['manager', 'supervisor', 'worker', 'farm_vet', 'viewer']) {
      expect(t('owner', { kind: 'add', newRole: role })).not.toThrow();
      expect(t(null, { kind: 'add', newRole: role })).not.toThrow();
    }
    expect(t('owner', { kind: 'add', newRole: 'owner' })).toThrow(/one owner/);
  });

  it('a manager adds and removes supervisors, workers, viewers and farm vets', () => {
    for (const role of ['supervisor', 'worker', 'viewer', 'farm_vet'] as FarmRole[]) {
      expect(t('manager', { kind: 'add', newRole: role })).not.toThrow();
      expect(t('manager', { kind: 'remove', targetRole: role })).not.toThrow();
    }
  });

  it('a manager cannot make a manager, or remove one, or touch the owner', () => {
    expect(t('manager', { kind: 'add', newRole: 'manager' })).toThrow(/Only the farm owner can add or remove a manager/);
    expect(t('manager', { kind: 'remove', targetRole: 'manager' })).toThrow(ForbiddenError);
    expect(t('manager', { kind: 'remove', targetRole: 'owner' })).toThrow(/owner's place/);
    expect(t('owner', { kind: 'remove', targetRole: 'owner' })).toThrow(/owner's place/);
  });

  it('only the owner changes an existing person\'s role (no promotion by a manager)', () => {
    expect(t('owner', { kind: 'change_role', targetRole: 'worker', newRole: 'manager' })).not.toThrow();
    expect(t('manager', { kind: 'change_role', targetRole: 'worker', newRole: 'manager' })).toThrow(/Only the farm owner can change/);
  });

  it('anyone below a manager cannot manage the team at all', () => {
    for (const actor of ['supervisor', 'worker', 'farm_vet', 'viewer'] as FarmRole[]) {
      expect(t(actor, { kind: 'add', newRole: 'worker' })).toThrow(/adding or removing people/);
    }
  });

  it('a role that does not exist is a plain validation message', () => {
    expect(t('owner', { kind: 'add', newRole: 'boss' })).toThrow(ValidationError);
  });
});
