/**
 * Who may manage a farm's team - the screen's copy of the rule enforced by the server
 * (backend services/FarmAccessService.ts). The server is the authority; this only decides which
 * buttons to show, so a person is not offered something that would be refused.
 *
 *   owner (and platform admin): add anyone except another owner, change roles, remove anyone but the owner
 *   manager: add / remove supervisors, workers, viewers and farm vets; cannot change roles
 *   everyone else: looks only
 */
export type FarmRole = 'owner' | 'manager' | 'supervisor' | 'worker' | 'farm_vet' | 'viewer'

export const ASSIGNABLE_BY_OWNER: FarmRole[] = ['manager', 'supervisor', 'worker', 'farm_vet', 'viewer']
export const ASSIGNABLE_BY_MANAGER: FarmRole[] = ['supervisor', 'worker', 'farm_vet', 'viewer']

export function myFarmRole(
  enterprise: { ownerId?: string } | null | undefined,
  members: Array<{ userId: string; role: string }>,
  userId: string | undefined,
  isAdmin: boolean,
): FarmRole | null {
  if (isAdmin) return 'owner'
  if (!enterprise || !userId) return null
  if (enterprise.ownerId === userId) return 'owner'
  const m = members.find(x => x.userId === userId)
  return (m?.role as FarmRole) || null
}

export function rolesIMayAssign(actor: FarmRole | null): FarmRole[] {
  if (actor === 'owner') return ASSIGNABLE_BY_OWNER
  if (actor === 'manager') return ASSIGNABLE_BY_MANAGER
  return []
}

export const canInvite = (actor: FarmRole | null): boolean => rolesIMayAssign(actor).length > 0
export const canChangeRoles = (actor: FarmRole | null): boolean => actor === 'owner'
export function canRemoveMember(actor: FarmRole | null, target: string): boolean {
  if (target === 'owner') return false
  return rolesIMayAssign(actor).includes(target as FarmRole)
}
