import type { AnimalGroup } from '../../types'
import type { FarmProfile } from '../../utils/farmProfile/resolveFarmProfile'

/** The group create/edit form as the screen holds it - every field a string so it can be typed into. */
export interface GroupFormData {
  name: string
  groupType: string
  species: string
  breed: string
  purpose: string
  targetCount: string
  description: string
  colorCode: string
  /** '' = not chosen: the group type, then the species, decides (see resolveFarmProfile). */
  managementMode: '' | 'individual' | 'batch'
}

export const DEFAULT_GROUP_COLOR = '#4F46E5'

/** Purposes a farmer can give a group. The stored value is the key; labels are translated (farmProfile.purposes). */
/** A group's purpose in the person's language; an unknown or custom purpose is shown as typed. */
export function purposeLabel(t: (k: string, o?: any) => string, purpose: string): string {
  return t(`farmProfile.purposes.${purpose}`, { defaultValue: purpose })
}

export const GROUP_PURPOSES = [
  'dairy', 'meat', 'breeding', 'layer', 'broiler', 'companion', 'exhibition',
  'conservation', 'racing', 'working', 'research', 'rehabilitation', 'sale', 'other',
] as const

export const emptyGroupForm: GroupFormData = {
  name: '', groupType: '', species: '', breed: '', purpose: '', targetCount: '',
  description: '', colorCode: DEFAULT_GROUP_COLOR, managementMode: '',
}

export function groupToFormData(g: AnimalGroup): GroupFormData {
  return {
    name: g.name, groupType: g.groupType || '', species: g.species || '', breed: g.breed || '',
    purpose: g.purpose || '', targetCount: g.targetCount ? String(g.targetCount) : '',
    description: g.description || '', colorCode: g.colorCode || DEFAULT_GROUP_COLOR,
    managementMode: (g.managementMode as GroupFormData['managementMode']) || '',
  }
}

/**
 * The request body for creating or editing a group.
 *
 * Record-keeping style (individual / batch) is sent only when CREATING, taken from the resolved
 * profile so what the form showed is what is stored. An existing group's style is never changed
 * from this form: switching a flock to individual records, or back, is a data migration with its
 * own rules (docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md section 9), not a field edit.
 */
export function buildGroupPayload(
  form: GroupFormData,
  profile: Pick<FarmProfile, 'managementMode'>,
  opts: { editing: boolean; enterpriseId: string }
): Record<string, unknown> {
  const planned = parseInt(form.targetCount, 10)
  const payload: Record<string, unknown> = {
    enterpriseId: opts.enterpriseId,
    name: form.name.trim(),
    groupType: form.groupType,
    species: form.species,
    breed: form.breed,
    purpose: form.purpose,
    targetCount: Number.isFinite(planned) && planned > 0 ? planned : 0,
    description: form.description,
    colorCode: form.colorCode,
  }
  if (!opts.editing) payload.managementMode = profile.managementMode
  return payload
}
