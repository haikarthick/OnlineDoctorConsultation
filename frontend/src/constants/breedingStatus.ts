/**
 * The ONE breeding-status vocabulary for an animal - the same four words the backend stores
 * (backend/src/utils/breedingStatus.ts, enforced by a database CHECK since migration 044).
 *
 * Before 044 the animal screens, the breeding screen and the marketplace each used different
 * words for the same column. Anything that shows or edits a breeding status uses this file.
 */
export const BREEDING_STATUSES = ['not_bred', 'bred', 'pregnant', 'not_pregnant'] as const
export type BreedingStatus = typeof BREEDING_STATUSES[number]

const LABEL_KEYS: Record<BreedingStatus, string> = {
  not_bred: 'animalClass.notBred',
  bred: 'animalClass.bred',
  pregnant: 'animalClass.pregnant',
  not_pregnant: 'animalClass.notPregnant',
}

export function isBreedingStatus(value: unknown): value is BreedingStatus {
  return typeof value === 'string' && (BREEDING_STATUSES as readonly string[]).includes(value)
}

/** The translation key for a status, or null for an empty or unknown value (never a raw key on screen). */
export function breedingStatusLabelKey(status: string | null | undefined): string | null {
  return isBreedingStatus(status) ? LABEL_KEYS[status] : null
}

/**
 * What a sell listing may claim about pregnancy. Only a CONFIRMED pregnancy counts: an animal that
 * has merely been served ("bred") is not yet known to be pregnant, and a listing must not tell a
 * buyer she is.
 */
export function listingPregnancyStatus(status: string | null | undefined): 'pregnant' | 'not_pregnant' | 'unknown' {
  if (status === 'pregnant') return 'pregnant'
  if (status === 'not_pregnant' || status === 'not_bred') return 'not_pregnant'
  return 'unknown'
}
