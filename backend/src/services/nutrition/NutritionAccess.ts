import database from '../../utils/database';
import { ForbiddenError, NotFoundError, CodedError } from '../../utils/errors';
import FarmAccessService, { roleCan } from '../FarmAccessService';
import { checkAnimalAccess, logClinicalAccess } from '../../middleware/hospitalDataIsolation';

/**
 * Who may see and change an animal's nutrition. ONE place decides, for every nutrition endpoint:
 *
 *   admin                    read, write, review
 *   the animal's owner       read, write  (review too when the owner is also a vet)
 *   a member of its farm     read; write for owner/manager/supervisor/worker/farm vet (FarmAccessService
 *                            'clinical'); review for the farm vet
 *   a vet with an appointment for the animal (and 30 days after) - FarmAccessService.consultingVetMayRead -
 *                            read, write, review; every such read is written to the access log
 *   anyone else              refused, with words that say why and what to do
 *
 * A hospital-private animal additionally passes the existing isolation check unchanged (network-hospital rules
 * are not modified here - owner instruction 2026-11-22).
 */

export interface Caller { userId: string; role?: string; roles?: string[] }

export interface AnimalRef {
  id: string;
  name: string;
  ownerId: string;
  enterpriseId: string | null;
  species: string;
  animalClass: string | null;
}

export interface AnimalAccess {
  animal: AnimalRef;
  canWrite: boolean;
  canReview: boolean;
  via: 'admin' | 'owner' | 'farm' | 'vet';
}

export const NO_NUTRITION_ACCESS_MESSAGE =
  "This animal's food and body condition are shared only with its owner, their farm team, and a vet who has an appointment for it (and for 30 days after). Ask the owner to book you, or to add you to their farm team.";
export const READ_ONLY_MESSAGE =
  "You can see this animal's food plan but not change it. Ask the owner or the farm manager if something needs to change.";
export const REVIEW_ONLY_VET_MESSAGE =
  'Only a vet can review a food plan. The plan stays a suggestion until a vet looks at it.';

const hasRole = (c: Caller, role: string): boolean => c.role === role || (c.roles || []).includes(role);

class NutritionAccess {

  async loadAnimal(animalId: string, caller: Caller): Promise<AnimalRef> {
    const r = await database.query(
      `SELECT id, name, owner_id, enterprise_id, species, animal_class FROM animals WHERE id = $1 AND is_active = true`,
      [animalId]
    );
    const a = r.rows[0];
    // Not found looks exactly like not yours for everyone but an admin, so an id cannot be probed for existence.
    if (!a && !hasRole(caller, 'admin')) throw new CodedError(403, 'NUT_NO_ACCESS', NO_NUTRITION_ACCESS_MESSAGE);
    if (!a) throw new CodedError(404, 'NUT_NOT_FOUND', 'We could not find that. It may have been removed, or you may not have access to it. Refresh the screen and try again.');
    return { id: a.id, name: a.name, ownerId: a.owner_id, enterpriseId: a.enterprise_id || null, species: a.species, animalClass: a.animal_class || null };
  }

  /** Resolves the caller's access, or throws a readable refusal. `need` is what this request does. */
  async forAnimal(animalId: string, caller: Caller, need: 'read' | 'write' | 'review' = 'read'): Promise<AnimalAccess> {
    const animal = await this.loadAnimal(animalId, caller);
    const isVet = hasRole(caller, 'veterinarian');
    let access: AnimalAccess | null = null;

    if (hasRole(caller, 'admin')) {
      access = { animal, canWrite: true, canReview: true, via: 'admin' };
    } else {
      // Hospital-private animals: the existing rule decides, unchanged.
      const isolation = await checkAnimalAccess(caller.userId, caller.role || '', animalId);
      if (!isolation.allowed) throw isolation.reason ? new ForbiddenError(isolation.reason) : new CodedError(403, 'NUT_NO_ACCESS', NO_NUTRITION_ACCESS_MESSAGE);

      if (animal.ownerId === caller.userId) {
        access = { animal, canWrite: true, canReview: isVet, via: 'owner' };
      } else if (animal.enterpriseId) {
        const farmRole = await FarmAccessService.roleOf(animal.enterpriseId, caller.userId);
        if (farmRole) {
          access = { animal, canWrite: roleCan(farmRole, 'clinical'), canReview: farmRole === 'farm_vet' && isVet, via: 'farm' };
        }
      }
      if (!access && isVet && await FarmAccessService.consultingVetMayRead(caller.userId, { animalId })) {
        access = { animal, canWrite: true, canReview: true, via: 'vet' };
        logClinicalAccess({
          accessedBy: caller.userId, accessorRole: 'veterinarian', animalId,
          accessType: need === 'read' ? 'view' : 'api_call', recordType: 'nutrition', accessGranted: true,
        }).catch(() => { /* an audit failure must not block the vet */ });
      }
    }

    if (!access) throw new CodedError(403, 'NUT_NO_ACCESS', NO_NUTRITION_ACCESS_MESSAGE);
    if (need === 'write' && !access.canWrite) throw new CodedError(403, 'NUT_READ_ONLY', READ_ONLY_MESSAGE);
    if (need === 'review' && !access.canReview) throw new CodedError(403, 'NUT_REVIEW_ONLY_VET', REVIEW_ONLY_VET_MESSAGE);
    return access;
  }
}

export default new NutritionAccess();
