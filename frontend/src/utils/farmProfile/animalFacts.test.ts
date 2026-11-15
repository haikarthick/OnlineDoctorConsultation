import { describe, it, expect } from 'vitest'
import { asNumber, daysUntil, lactationState, doseWarnings, isPregnant } from './animalFacts'
import { BREEDING_STATUSES, breedingStatusLabelKey, listingPregnancyStatus, isBreedingStatus } from '../../constants/breedingStatus'

const NOW = new Date(2026, 10, 15, 14, 30) // 15 Nov 2026, afternoon
const milking = { canProduceMilk: true, canBePregnant: true }
const bull = { canProduceMilk: false, canBePregnant: false }

describe('asNumber', () => {
  it('reads DECIMAL columns that arrive as strings', () => {
    expect(asNumber('9.50')).toBe(9.5)
    expect(asNumber(9.5)).toBe(9.5)
  })
  it('treats empty and garbage as no value (zero is a value)', () => {
    expect(asNumber('')).toBeNull()
    expect(asNumber(null)).toBeNull()
    expect(asNumber(undefined)).toBeNull()
    expect(asNumber('abc')).toBeNull()
    expect(asNumber(0)).toBe(0)
  })
})

describe('daysUntil', () => {
  it('counts calendar days in the viewer\'s own time zone, regardless of the time of day', () => {
    expect(daysUntil('2026-11-15', NOW)).toBe(0)
    expect(daysUntil('2026-11-18', NOW)).toBe(3)
    expect(daysUntil('2026-11-10', NOW)).toBe(-5)
  })
  it('accepts a timestamp and ignores nothing-dates', () => {
    expect(daysUntil(new Date(2026, 10, 20, 23, 59).toISOString(), NOW)).toBe(5)
    expect(daysUntil(null, NOW)).toBeNull()
    expect(daysUntil('not a date', NOW)).toBeNull()
  })
})

describe('lactationState', () => {
  it('is lactating when a daily yield is recorded and she has not been dried off', () => {
    expect(lactationState({ avgDailyMilkLitres: '8.00' }, milking, NOW)).toBe('lactating')
  })
  it('is dry once the dry-off date has arrived, even with an old yield on file', () => {
    expect(lactationState({ avgDailyMilkLitres: 8, dryOffDate: '2026-11-15' }, milking, NOW)).toBe('dry')
    expect(lactationState({ avgDailyMilkLitres: 8, dryOffDate: '2026-11-01' }, milking, NOW)).toBe('dry')
  })
  it('is still lactating before a future dry-off date', () => {
    expect(lactationState({ avgDailyMilkLitres: 8, dryOffDate: '2026-12-01' }, milking, NOW)).toBe('lactating')
  })
  it('says nothing when nothing is recorded, and never for an animal that cannot be milked', () => {
    expect(lactationState({}, milking, NOW)).toBeNull()
    expect(lactationState({ avgDailyMilkLitres: 0 }, milking, NOW)).toBeNull()
    expect(lactationState({ avgDailyMilkLitres: 8 }, bull, NOW)).toBeNull()
  })
})

describe('doseWarnings', () => {
  it('flags a confirmed pregnancy and an animal in milk', () => {
    expect(doseWarnings({ breedingStatus: 'pregnant', avgDailyMilkLitres: 7 }, milking, NOW)).toEqual({ pregnant: true, lactating: true })
  })
  it('does not flag an animal that has only been served, or one that is dry', () => {
    expect(doseWarnings({ breedingStatus: 'bred', dryOffDate: '2026-10-01', avgDailyMilkLitres: 7 }, milking, NOW)).toEqual({ pregnant: false, lactating: false })
  })
  it('never flags an animal the profile says cannot be pregnant or milked, whatever is stored', () => {
    expect(doseWarnings({ breedingStatus: 'pregnant', avgDailyMilkLitres: 7 }, bull, NOW)).toEqual({ pregnant: false, lactating: false })
  })
  it('isPregnant only trusts the confirmed status', () => {
    expect(isPregnant({ breedingStatus: 'pregnant' })).toBe(true)
    expect(isPregnant({ breedingStatus: 'bred' })).toBe(false)
  })
})

describe('breeding status vocabulary', () => {
  it('has a translation key for every status and none for an unknown one', () => {
    for (const s of BREEDING_STATUSES) expect(breedingStatusLabelKey(s)).toMatch(/^animalClass\./)
    expect(breedingStatusLabelKey('confirmed_pregnant')).toBeNull() // the old breeding-record word: never shown raw
    expect(breedingStatusLabelKey(undefined)).toBeNull()
    expect(isBreedingStatus('bred')).toBe(true)
    expect(isBreedingStatus('open')).toBe(false)
  })

  it('a sell listing only claims pregnancy that is confirmed', () => {
    expect(listingPregnancyStatus('pregnant')).toBe('pregnant')
    expect(listingPregnancyStatus('bred')).toBe('unknown') // was reported to buyers as "pregnant"
    expect(listingPregnancyStatus('not_pregnant')).toBe('not_pregnant')
    expect(listingPregnancyStatus('not_bred')).toBe('not_pregnant')
    expect(listingPregnancyStatus(undefined)).toBe('unknown')
  })
})
