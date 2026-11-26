import { describe, it, expect } from 'vitest'
import { pickField, dateInput, timeInput, fieldText, definedOnly, mayChangeFarmRecords } from './recordForm'

describe('recordForm helpers', () => {
  it('reads camelCase or snake_case from a server row', () => {
    expect(pickField({ shiftDate: 'a' }, 'shiftDate')).toBe('a')
    expect(pickField({ shift_date: 'b' }, 'shiftDate')).toBe('b')
    expect(pickField(null, 'shiftDate')).toBeUndefined()
  })
  it('turns server dates and times into input values', () => {
    expect(dateInput('2026-11-26T00:00:00.000Z')).toBe('2026-11-26')
    expect(dateInput('')).toBe('')
    expect(dateInput('garbage')).toBe('')
    expect(timeInput('08:30:00')).toBe('08:30')
    expect(timeInput(null)).toBe('')
  })
  it('stringifies values and drops undefined keys', () => {
    expect(fieldText(0)).toBe('0')
    expect(fieldText(null)).toBe('')
    expect(definedOnly({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
  })
  it('hides edit and delete only from a viewer', () => {
    expect(mayChangeFarmRecords('viewer')).toBe(false)
    expect(mayChangeFarmRecords('worker')).toBe(true)
    expect(mayChangeFarmRecords(null)).toBe(true) // role unknown: the server decides and explains
  })
})
