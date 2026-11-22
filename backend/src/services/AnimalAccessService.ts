import database from '../utils/database';
import FarmAccessService, { roleCan } from './FarmAccessService';

/**
 * THE rule for "may this person see or change this animal's data?" - for every module (owner rule 2026-11-22:
 * no one may reach another person's data; one rule, enforced everywhere). Before this, `requireAnimalAccess`
 * only protected hospital-PRIVATE animals and let every signed-in user through for all others, and several
 * routes had no check at all.
 *
 * A person may reach an animal when they are:
 *   - an admin;
 *   - its owner;
 *   - on its farm's team (FarmAccessService) - read for any farm role, change for roles that record clinically;
 *   - a vet with a reason: a booking or consultation for the animal or its group (not cancelled/missed), or the
 *     farm vet of its farm;
 *   - a member of a hospital network the animal is actively enrolled in (what network staff already list);
 *   - granted an active patient-data consent (to them, their hospital or their network) - read only unless the
 *     consent allows notes or prescribing.
 * Hospital-PRIVATE animals keep their own, stricter rule (middleware/hospitalDataIsolation.checkAnimalAccess),
 * evaluated first and unchanged.
 */

export type AccessMode = 'read' | 'write';
export type AccessVia = 'admin' | 'owner' | 'farm' | 'vet' | 'network' | 'consent';

export interface AnimalAccessResult {
  found: boolean;
  allowed: boolean;
  via?: AccessVia;
}

export const ANIMAL_NO_ACCESS_MESSAGE =
  "You can't open this animal's records. They are shared only with the owner, their farm team, a vet who has an appointment for the animal, and a hospital the owner has shared them with. Check you opened the right animal, or ask the owner to share it with you.";
export const ANIMAL_READ_ONLY_MESSAGE =
  "You can see this animal's records but not change them. Ask the owner or the farm manager if something needs to change.";

const hasRole = (role: string | undefined, roles: string[] | undefined, want: string) => role === want || (roles || []).includes(want);

class AnimalAccessService {

  async check(user: { userId: string; role?: string; roles?: string[] }, animalId: string, mode: AccessMode = 'read'): Promise<AnimalAccessResult> {
    if (!animalId || !/^[0-9a-f-]{36}$/i.test(animalId)) return { found: false, allowed: false };
    const r = await database.query(`SELECT id, owner_id, enterprise_id, group_id FROM animals WHERE id = $1`, [animalId]);
    const a = r.rows[0];
    if (!a) return { found: false, allowed: false };
    if (hasRole(user.role, user.roles, 'admin')) return { found: true, allowed: true, via: 'admin' };
    if (a.owner_id === user.userId) return { found: true, allowed: true, via: 'owner' };

    if (a.enterprise_id) {
      const farmRole = await FarmAccessService.roleOf(a.enterprise_id, user.userId);
      if (farmRole && (mode === 'read' || roleCan(farmRole, 'clinical'))) return { found: true, allowed: true, via: 'farm' };
      if (farmRole && mode === 'write') return { found: true, allowed: false, via: 'farm' };
    }

    if (hasRole(user.role, user.roles, 'veterinarian')) {
      const v = await database.query(
        `SELECT 1 WHERE
           EXISTS (SELECT 1 FROM bookings b WHERE b.veterinarian_id = $1
                    AND (b.animal_id = $2 OR ($3::uuid IS NOT NULL AND b.group_id = $3::uuid))
                    AND b.status NOT IN ('cancelled', 'missed'))
           OR EXISTS (SELECT 1 FROM consultations c WHERE c.veterinarian_id = $1
                    AND (c.animal_id = $2 OR ($3::uuid IS NOT NULL AND c.group_id = $3::uuid))
                    AND c.status <> 'cancelled')`,
        [user.userId, animalId, a.group_id]
      );
      if (v.rows.length) return { found: true, allowed: true, via: 'vet' };
    }

    const n = await database.query(
      `SELECT 1 FROM animal_care_contexts acc
         JOIN hospital_network_members m ON m.network_id = acc.network_id
        WHERE acc.animal_id = $1 AND acc.is_active = true AND acc.enrollment_status = 'active'
          AND m.user_id = $2 AND m.is_active = true AND (m.valid_until IS NULL OR m.valid_until > NOW())
        LIMIT 1`,
      [animalId, user.userId]
    );
    if (n.rows.length) return { found: true, allowed: true, via: 'network' };

    const c = await database.query(
      `SELECT pdc.allow_create_notes, pdc.allow_prescribe
         FROM patient_data_consent pdc
        WHERE pdc.animal_id = $1 AND pdc.is_active = true AND pdc.allow_view = true
          AND (pdc.valid_until IS NULL OR pdc.valid_until > NOW()) AND pdc.valid_from <= NOW()
          AND (pdc.granted_to_user_id = $2
               OR pdc.granted_to_hospital_id IN (SELECT hospital_id FROM hospital_network_members
                                                  WHERE user_id = $2 AND is_active = true AND hospital_id IS NOT NULL
                                                    AND (valid_until IS NULL OR valid_until > NOW()))
               OR pdc.granted_to_network_id IN (SELECT network_id FROM hospital_network_members
                                                 WHERE user_id = $2 AND is_active = true
                                                   AND (valid_until IS NULL OR valid_until > NOW())))
        LIMIT 1`,
      [animalId, user.userId]
    );
    if (c.rows.length) {
      const canWrite = !!(c.rows[0].allow_create_notes || c.rows[0].allow_prescribe);
      return { found: true, allowed: mode === 'read' || canWrite, via: 'consent' };
    }
    return { found: true, allowed: false };
  }

  /** May this person see / change a farm group (batch herd, flock, pond)? Farm team, booked vet, admin. */
  async checkGroup(user: { userId: string; role?: string; roles?: string[] }, groupId: string, mode: AccessMode = 'read'): Promise<AnimalAccessResult> {
    if (!groupId || !/^[0-9a-f-]{36}$/i.test(groupId)) return { found: false, allowed: false };
    const r = await database.query(`SELECT enterprise_id FROM animal_groups WHERE id = $1`, [groupId]);
    if (!r.rows[0]) return { found: false, allowed: false };
    if (hasRole(user.role, user.roles, 'admin')) return { found: true, allowed: true, via: 'admin' };
    const farmRole = r.rows[0].enterprise_id ? await FarmAccessService.roleOf(r.rows[0].enterprise_id, user.userId) : null;
    if (farmRole) return { found: true, allowed: mode === 'read' || roleCan(farmRole, 'clinical'), via: 'farm' };
    if (hasRole(user.role, user.roles, 'veterinarian') && await FarmAccessService.consultingVetMayRead(user.userId, { groupId })) {
      return { found: true, allowed: true, via: 'vet' };
    }
    return { found: true, allowed: false };
  }
}

export default new AnimalAccessService();
