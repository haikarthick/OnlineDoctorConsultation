import { describe, it, expect } from 'vitest'
import { summaryTotals } from './summaryTotals'

describe('summaryTotals', () => {
  it('adds a record type across days and counts the days it was written', () => {
    const out = summaryTotals([
      { recordType: 'milk', recordDate: '2026-11-01', total: 10.5, entries: 2 },
      { recordType: 'milk', recordDate: '2026-11-02', total: 9, entries: 2 },
      { recordType: 'feed', recordDate: '2026-11-02', total: 20, entries: 1 },
    ], ['feed', 'milk'])
    expect(out.map(x => x.recordType)).toEqual(['feed', 'milk'])
    expect(out[1]).toMatchObject({ total: 19.5, days: 2, entries: 4, hasQuantity: true })
  })

  it('a type with no quantity (a tick) has no total to show', () => {
    const out = summaryTotals([{ recordType: 'water_quality', recordDate: '2026-11-01', total: null, entries: 1 }])
    expect(out[0]).toMatchObject({ total: 0, hasQuantity: false, days: 1 })
  })

  it('puts types the master data does not list after the ones it does, alphabetically', () => {
    const out = summaryTotals([
      { recordType: 'zeta', recordDate: 'a', total: 1, entries: 1 },
      { recordType: 'alpha', recordDate: 'a', total: 1, entries: 1 },
      { recordType: 'milk', recordDate: 'a', total: 1, entries: 1 },
    ], ['milk'])
    expect(out.map(x => x.recordType)).toEqual(['milk', 'alpha', 'zeta'])
  })

  it('is empty for no rows', () => {
    expect(summaryTotals([])).toEqual([])
  })
})
