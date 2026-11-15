/**
 * The ONE breeding-status vocabulary for an animal, and how a breeding RECORD's status maps onto
 * it. Before migration 044 three modules wrote different words into animals.breeding_status;
 * every writer must now go through animalStatusForRecordStatus().
 *
 *   animal.breeding_status : not_bred | bred | pregnant | not_pregnant
 *   breeding record status : bred | confirmed_pregnant | not_pregnant | delivered | aborted | reabsorbed
 *
 * The frontend has the same vocabulary in frontend/src/constants/breedingStatus.ts.
 */
export const ANIMAL_BREEDING_STATUSES = ['not_bred', 'bred', 'pregnant', 'not_pregnant'] as const;
export type AnimalBreedingStatus = typeof ANIMAL_BREEDING_STATUSES[number];

const FROM_RECORD: Record<string, AnimalBreedingStatus> = {
  bred: 'bred',
  confirmed_pregnant: 'pregnant',
  confirmed: 'pregnant',        // legacy spelling
  not_pregnant: 'not_pregnant',
  // The pregnancy ended: the animal is open again, ready to be served.
  delivered: 'not_bred',
  aborted: 'not_bred',
  reabsorbed: 'not_bred',
  open: 'not_bred',             // legacy spelling
};

/** The animal-level status a breeding record's status implies, or null when it implies none. */
export function animalStatusForRecordStatus(recordStatus: string | null | undefined): AnimalBreedingStatus | null {
  if (!recordStatus) return null;
  return FROM_RECORD[recordStatus] ?? null;
}

/** True when the pregnancy ended with a live or dead birth (the one case that counts as a calving). */
export function isBirthStatus(recordStatus: string | null | undefined): boolean {
  return recordStatus === 'delivered';
}
