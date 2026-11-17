import type { FarmProfile } from './resolveFarmProfile'

/**
 * Pure facts derived from an animal's stored fields - what the farmer recorded, turned into what
 * a vet needs to know. Kept free of React so it can be tested and reused by any screen.
 */

/** The fields of an animal these helpers read. Every one is optional: a record may lack any of them. */
export interface AnimalFactsInput {
  breedingStatus?: string | null
  expectedDueDate?: string | null
  avgDailyMilkLitres?: number | string | null
  parity?: number | string | null
  lastBirthDate?: string | null
  dryOffDate?: string | null
}

/** A number from a field that may arrive as a string (DECIMAL columns do), or null when it is not one. */
export function asNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Calendar date (YYYY-MM-DD) of an ISO timestamp or date string in the viewer's own time zone. */
function dayOf(value: string, now: Date): number | null {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

/** Whole days from today until `date` (negative = already past), or null when there is no valid date. */
export function daysUntil(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null
  const diff = dayOf(date, now)
  return diff === null ? null : Math.round(diff / 86400000)
}

export type LactationState = 'lactating' | 'dry' | null

/**
 * Whether a milking animal is in milk right now:
 *   dry         - a dry-off date that has arrived
 *   lactating   - a recorded daily yield above zero, and not dried off
 *   null        - the animal cannot be milked, or nothing recorded says either way
 * Driven by the farm profile (never by species), so it is correct for goats, buffalo and mares too.
 */
export function lactationState(animal: AnimalFactsInput, profile: Pick<FarmProfile, 'canProduceMilk'>, now: Date = new Date()): LactationState {
  if (!profile.canProduceMilk) return null
  const dry = daysUntil(animal.dryOffDate, now)
  if (dry !== null && dry <= 0) return 'dry'
  const yieldPerDay = asNumber(animal.avgDailyMilkLitres)
  return yieldPerDay !== null && yieldPerDay > 0 ? 'lactating' : null
}

/** True when a pregnancy has been confirmed - the one status that matters for dosing. */
export function isPregnant(animal: AnimalFactsInput): boolean {
  return animal.breedingStatus === 'pregnant'
}

export interface DoseWarnings {
  pregnant: boolean
  lactating: boolean
}

/**
 * The two facts a vet must check before choosing a medicine: a pregnant animal (some drugs are
 * unsafe) and a lactating one (milk withdrawal applies and the milk may reach people).
 */
export function doseWarnings(animal: AnimalFactsInput, profile: Pick<FarmProfile, 'canProduceMilk' | 'canBePregnant'>, now: Date = new Date()): DoseWarnings {
  return {
    pregnant: profile.canBePregnant && isPregnant(animal),
    lactating: lactationState(animal, profile, now) === 'lactating',
  }
}
