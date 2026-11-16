import database from '../utils/database';
import { ForbiddenError, ValidationError } from '../utils/errors';

/**
 * Who may do what on a farm - the ONE place this is decided.
 *
 * A person's PLATFORM role (farmer, pet owner, vet...) says what they are on the platform. Their FARM
 * role says what they may do on one particular farm. This service only knows the farm role; every
 * farm screen and endpoint asks it, so a farm viewer is read-only everywhere, not just in one module.
 *
 *   action        owner  manager  supervisor  worker  farm_vet  viewer
 *   read            x       x         x          x        x        x
 *   record          x       x         x          x         (daily records, events, head count)
 *   clinical        x       x         x          x        x     (health / analytics screens; not a viewer)
 *   manage_farm     x       x
 *   manage_team     x       x       (add / remove supervisors, workers, viewers, farm vets)
 *   change_roles    x       (owner only: makes managers, changes anyone's role)
 *
 * Platform admins may do everything. The owner of the farm (enterprises.owner_id) is always 'owner'.
 * See docs/modules/farm-profile.md "Who may do what".
 */
export type FarmRole = 'owner' | 'manager' | 'supervisor' | 'worker' | 'farm_vet' | 'viewer';
export type FarmAction = 'read' | 'record' | 'clinical' | 'manage_farm' | 'manage_team' | 'change_roles';

const ALL_ROLES: FarmRole[] = ['owner', 'manager', 'supervisor', 'worker', 'farm_vet', 'viewer'];

const ALLOWED: Record<FarmAction, FarmRole[]> = {
  read: ['owner', 'manager', 'supervisor', 'worker', 'farm_vet', 'viewer'],
  record: ['owner', 'manager', 'supervisor', 'worker'],
  // Anything that changes data on a screen shared with the farm vet (health, analytics, treatments):
  // everyone except a viewer, who only looks.
  clinical: ['owner', 'manager', 'supervisor', 'worker', 'farm_vet'],
  manage_farm: ['owner', 'manager'],
  manage_team: ['owner', 'manager'],
  change_roles: ['owner'],
};

/** Roles a manager may add or remove (never another manager, never the owner). */
const MANAGER_MAY_HANDLE: FarmRole[] = ['supervisor', 'worker', 'viewer', 'farm_vet'];

export const NO_ACCESS_MESSAGE =
  "You don't have access to this farm. Only the farm owner can add people. Please ask them to invite you.";

const ROLE_WORDS: Record<FarmRole, string> = {
  owner: 'owner', manager: 'manager', supervisor: 'supervisor', worker: 'worker', farm_vet: 'farm vet', viewer: 'viewer',
};

export function isFarmRole(v: unknown): v is FarmRole {
  return typeof v === 'string' && (ALL_ROLES as string[]).includes(v);
}

/** Pure: may this farm role do this? (A null role - no claim on the farm - may do nothing.) */
export function roleCan(role: FarmRole | null, action: FarmAction): boolean {
  return !!role && ALLOWED[action].includes(role);
}

/** What a refusal says, in words the person can act on (what, why, next step). */
function refusalFor(role: FarmRole, action: FarmAction): string {
  const who = ROLE_WORDS[role];
  switch (action) {
    case 'record':
    case 'clinical':
      return `Your role on this farm (${who}) lets you see it but not add or change anything. Ask the farm owner or a manager if you need to.`;
    case 'manage_farm':
      return `Your role on this farm (${who}) does not include changing the farm's settings. Ask the farm owner or a manager.`;
    case 'manage_team':
      return `Your role on this farm (${who}) does not include adding or removing people. Ask the farm owner or a manager.`;
    case 'change_roles':
      return 'Only the farm owner can change a person\'s role or make someone a manager.';
    default:
      return NO_ACCESS_MESSAGE;
  }
}

export interface Actor { userId: string; role?: string }

/** How long after an appointment is completed the booked vet may still read that animal's farm records. */
export const VET_ACCESS_DAYS = 30;

export const VET_NOT_BOOKED_MESSAGE =
  'Farm records are shared only with the vet who is booked for an appointment about this animal or group (and for 30 days after it ends). Ask the farm owner to book you for it.'; // keep the 30 in step with VET_ACCESS_DAYS

class FarmAccessService {

  /** The person's role on this farm, or null when they have no claim on it. */
  async roleOf(enterpriseId: string, userId: string): Promise<FarmRole | null> {
    const r = await database.query(
      `SELECT CASE WHEN e.owner_id = $2 THEN 'owner'
                   ELSE (SELECT em.role FROM enterprise_members em
                          WHERE em.enterprise_id = e.id AND em.user_id = $2 AND em.is_active = true LIMIT 1) END AS role
         FROM enterprises e WHERE e.id = $1`,
      [enterpriseId, userId]
    );
    const role = r.rows[0]?.role;
    return isFarmRole(role) ? role : null;
  }

  /**
   * Throws a readable ForbiddenError unless the actor may do `action` on the farm. Platform admins
   * always may. Returns the actor's farm role (null for an admin who is not a member).
   */
  async assert(enterpriseId: string, actor: Actor, action: FarmAction): Promise<FarmRole | null> {
    if (actor.role === 'admin') return null;
    const role = await this.roleOf(enterpriseId, actor.userId);
    if (!role) throw new ForbiddenError(NO_ACCESS_MESSAGE);
    if (!roleCan(role, action)) throw new ForbiddenError(refusalFor(role, action));
    return role;
  }

  /** Same, answering true/false (for code that decides between two behaviours). */
  async can(enterpriseId: string, actor: Actor, action: FarmAction): Promise<boolean> {
    if (actor.role === 'admin') return true;
    return roleCan(await this.roleOf(enterpriseId, actor.userId), action);
  }

  /**
   * A consulting vet - NOT a farm member - may READ the farm records of one animal or one group while they
   * hold an appointment for it: a confirmed (or rescheduled) booking or a live consultation, and for
   * 30 days after it was completed. Only that animal / group; never the farm, its team or its finances.
   * Pending (not yet confirmed), cancelled, missed and no-show appointments give no access.
   */
  async consultingVetMayRead(vetUserId: string, subject: { animalId?: string | null; groupId?: string | null }): Promise<boolean> {
    if (!subject.animalId && !subject.groupId) return false;
    const r = await database.query(
      `SELECT 1 WHERE
         EXISTS (SELECT 1 FROM bookings b
                  WHERE b.veterinarian_id = $1
                    AND (($2::uuid IS NOT NULL AND b.animal_id = $2::uuid) OR ($3::uuid IS NOT NULL AND b.group_id = $3::uuid))
                    AND (b.status IN ('confirmed', 'rescheduled')
                         OR (b.status = 'completed' AND b.updated_at >= NOW() - ($4::int * INTERVAL '1 day'))))
         OR EXISTS (SELECT 1 FROM consultations c
                     WHERE c.veterinarian_id = $1
                       AND (($2::uuid IS NOT NULL AND c.animal_id = $2::uuid) OR ($3::uuid IS NOT NULL AND c.group_id = $3::uuid))
                       AND (c.status IN ('confirmed', 'scheduled', 'in_progress')
                            OR (c.status = 'completed' AND c.completed_at >= NOW() - ($4::int * INTERVAL '1 day'))))`,
      [vetUserId, subject.animalId || null, subject.groupId || null, VET_ACCESS_DAYS]
    );
    return r.rows.length > 0;
  }

  /** The action a plain HTTP method needs: looking is 'read'; anything else changes something (not for a viewer). */
  actionForMethod(method: string | undefined): FarmAction {
    return !method || method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'read' : 'clinical';
  }

  /**
   * Team rules. `actorRole` is null for a platform admin (treated as owner). `targetRole` is the
   * member being added / changed / removed; `newRole` is the role being given (add / change).
   *   - the owner (and an admin) may do anything except touch the owner's own seat
   *   - a manager may add or remove supervisors, workers, viewers and farm vets - nobody else
   *   - only the owner may make a manager or change an existing person's role
   */
  assertTeamChange(
    actorRole: FarmRole | null,
    change: { kind: 'add' | 'remove' | 'change_role'; targetRole?: FarmRole | null; newRole?: string | null },
  ): void {
    const actor: FarmRole = actorRole ?? 'owner';
    if (change.newRole !== undefined && change.newRole !== null && !isFarmRole(change.newRole)) {
      throw new ValidationError('That is not a role on this farm. Choose owner, manager, supervisor, worker, farm vet or viewer.');
    }
    if (change.newRole === 'owner') {
      throw new ForbiddenError('A farm has one owner. To hand the farm to someone else, transfer ownership instead.');
    }
    if (change.targetRole === 'owner') {
      throw new ForbiddenError("The farm owner's place on the team cannot be changed or removed here.");
    }
    if (actor === 'owner') return;
    if (!roleCan(actor, 'manage_team')) throw new ForbiddenError(refusalFor(actor, 'manage_team'));
    if (change.kind === 'change_role') throw new ForbiddenError(refusalFor(actor, 'change_roles'));
    // A manager adds or removes only the people below them.
    const concerned = change.kind === 'add' ? (change.newRole as FarmRole | null | undefined) : change.targetRole;
    if (!concerned || !MANAGER_MAY_HANDLE.includes(concerned)) {
      throw new ForbiddenError('Managers can add and remove supervisors, workers, viewers and farm vets. Only the farm owner can add or remove a manager.');
    }
  }
}

export default new FarmAccessService();
