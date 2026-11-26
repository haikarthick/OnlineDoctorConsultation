import { describe, it, expect } from 'vitest'
import { monthCells, isoDay, shiftMonth, dayState } from './monthGrid'

describe('monthGrid', () => {
  it('starts the month on the right weekday and has every day', () => {
    // 1 November 2026 is a Sunday: no blanks, 30 days.
    const nov = monthCells(2026, 11)
    expect(nov[0]).toBe(1)
    expect(nov).toHaveLength(30)
    // 1 December 2026 is a Tuesday: two blanks first.
    const dec = monthCells(2026, 12)
    expect(dec.slice(0, 3)).toEqual([null, null, 1])
    expect(dec).toHaveLength(2 + 31)
  })

  it('builds the date without going through UTC', () => {
    expect(isoDay(2026, 3, 5)).toBe('2026-03-05')
  })

  it('moves across year ends', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 })
  })

  it('a past day is past, an unchecked future day stays tappable, a checked day is open or full', () => {
    expect(dayState('2026-11-01', '2026-11-26', { hasAvailability: true })).toBe('past')
    expect(dayState('2026-11-27', '2026-11-26', undefined)).toBe('unknown')
    expect(dayState('2026-11-27', '2026-11-26', { hasAvailability: true })).toBe('open')
    expect(dayState('2026-11-27', '2026-11-26', { hasAvailability: false })).toBe('full')
    expect(dayState('2026-11-26', '2026-11-26', { hasAvailability: true })).toBe('open')
  })
})
