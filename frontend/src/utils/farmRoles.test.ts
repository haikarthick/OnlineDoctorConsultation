import { describe, it, expect } from 'vitest'
import { myFarmRole, rolesIMayAssign, canInvite, canChangeRoles, canRemoveMember } from './farmRoles'

describe('farm team rules on screen (mirror of the server rule)', () => {
  const members = [{ userId: 'm1', role: 'manager' }, { userId: 'w1', role: 'worker' }]
  it('works out my role: owner, member, admin, or none', () => {
    expect(myFarmRole({ ownerId: 'o' }, members, 'o', false)).toBe('owner')
    expect(myFarmRole({ ownerId: 'o' }, members, 'm1', false)).toBe('manager')
    expect(myFarmRole({ ownerId: 'o' }, members, 'x', false)).toBeNull()
    expect(myFarmRole({ ownerId: 'o' }, members, 'x', true)).toBe('owner')
    expect(myFarmRole(null, members, 'o', false)).toBeNull()
  })
  it('the owner may assign every role but owner; a manager only the roles below a manager', () => {
    expect(rolesIMayAssign('owner')).toEqual(['manager', 'supervisor', 'worker', 'farm_vet', 'viewer'])
    expect(rolesIMayAssign('manager')).toEqual(['supervisor', 'worker', 'farm_vet', 'viewer'])
    for (const r of ['supervisor', 'worker', 'farm_vet', 'viewer', null] as const) expect(rolesIMayAssign(r)).toEqual([])
  })
  it('only owners and managers are offered Invite; only the owner changes roles', () => {
    expect(canInvite('owner')).toBe(true)
    expect(canInvite('manager')).toBe(true)
    expect(canInvite('worker')).toBe(false)
    expect(canChangeRoles('owner')).toBe(true)
    expect(canChangeRoles('manager')).toBe(false)
  })
  it('nobody is offered removing the owner; a manager is not offered removing a manager', () => {
    expect(canRemoveMember('owner', 'owner')).toBe(false)
    expect(canRemoveMember('owner', 'manager')).toBe(true)
    expect(canRemoveMember('manager', 'manager')).toBe(false)
    expect(canRemoveMember('manager', 'worker')).toBe(true)
    expect(canRemoveMember('worker', 'viewer')).toBe(false)
  })
})
