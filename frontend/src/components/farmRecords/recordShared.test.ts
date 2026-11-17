import { describe, it, expect } from 'vitest'
import {
  buildRecordPayload, firstMissingField, findExisting, formatRange, totalsByType, stepFor, isWholeNumberField,
  initialValues, defaultSession, dueTiming, visibleFields, dailyTypesFor, recordableTypesFor, buildEventPayload, GROUP_EVENT_CODES,
  type RecordSubject, type FarmRecord,
} from './recordShared'
import type { FarmProfile } from '../../utils/farmProfile/resolveFarmProfile'

const MILK = [{ key: 'session', type: 'choice', options: ['am', 'pm'], required: true }, { key: 'quantity', type: 'number', required: true }]
const EGGS = [{ key: 'quantity', type: 'number', required: true }, { key: 'broken', type: 'number' }]
const WATER = [{ key: 'temperatureC', type: 'number' }, { key: 'ph', type: 'number' }]
const FEED = [{ key: 'quantity', type: 'number', required: true }, { key: 'feedItem', type: 'picker' }]

const cow: RecordSubject = { kind: 'animal', id: 'a1', name: 'Lakshmi', enterpriseId: 'e1', speciesCode: 'Cattle', animalClass: 'cattle_cow', gender: 'female', managementMode: 'individual', groupType: null }
const flock: RecordSubject = { ...cow, kind: 'group', id: 'g1', name: 'Layers', speciesCode: 'Chicken', animalClass: null, gender: null, managementMode: 'batch', groupType: 'layers' }

describe('buildRecordPayload', () => {
  it('sends the quantity and session as columns and the animal as animalId', () => {
    expect(buildRecordPayload(cow, 'milk', MILK, { session: 'am', quantity: '6.5' }, '2026-11-10')).toEqual({
      enterpriseId: 'e1', recordType: 'milk', recordDate: '2026-11-10', animalId: 'a1', quantity: 6.5, session: 'am',
    })
  })

  it('a group goes as groupId, and what is not the headline number goes in detail', () => {
    expect(buildRecordPayload(flock, 'eggs', EGGS, { quantity: '4200', broken: '30' }, '2026-11-10')).toEqual({
      enterpriseId: 'e1', recordType: 'eggs', recordDate: '2026-11-10', groupId: 'g1', quantity: 4200, detail: { broken: 30 },
    })
  })

  it('leaves out blank optional fields and accepts a decimal comma', () => {
    const p = buildRecordPayload(flock, 'water_quality', WATER, { temperatureC: '', ph: '7,5' }, '2026-11-10')
    expect(p.detail).toEqual({ ph: 7.5 })
    expect(p).not.toHaveProperty('quantity')
  })

  it('never sends a picker field it could not show', () => {
    expect(buildRecordPayload(flock, 'feed', FEED, { quantity: '20', feedItem: 'x' }, '2026-11-10')).not.toHaveProperty('detail')
  })
})

describe('firstMissingField', () => {
  it('names the first required field still empty, in the form\'s own order', () => {
    expect(firstMissingField(MILK, {})).toBe('session')
    expect(firstMissingField(MILK, { session: 'am' })).toBe('quantity')
    expect(firstMissingField(MILK, { session: 'am', quantity: '5' })).toBeNull()
  })
  it('treats a typed non-number as missing, and zero as a real answer', () => {
    expect(firstMissingField(MILK, { session: 'am', quantity: 'abc' })).toBe('quantity')
    expect(firstMissingField(MILK, { session: 'am', quantity: '0' })).toBeNull()
  })
  it('does not demand a field that is not shown', () => {
    expect(firstMissingField([{ key: 'feedItem', type: 'picker', required: true }], {})).toBeNull()
  })
})

describe('steps and whole numbers', () => {
  const qty = { key: 'quantity', type: 'number' }
  it('counts are whole numbers, amounts step sensibly, readings step by a tenth', () => {
    expect(isWholeNumberField(qty, 'eggs')).toBe(true)
    expect(isWholeNumberField(qty, 'head')).toBe(true)
    expect(isWholeNumberField(qty, 'L')).toBe(false)
    expect(isWholeNumberField({ key: 'broken', type: 'number' }, 'eggs')).toBe(true)
    expect(stepFor(qty, 'L')).toBe(0.5)
    expect(stepFor(qty, 'eggs')).toBe(1)
    expect(stepFor({ key: 'ph', type: 'number' }, null)).toBe(0.1)
  })
})

describe('defaults', () => {
  it('milking session follows the time of day', () => {
    expect(defaultSession(new Date(2026, 10, 10, 6))).toBe('am')
    expect(defaultSession(new Date(2026, 10, 10, 17))).toBe('pm')
  })
  it('only records that ask for a session get one', () => {
    expect(initialValues(MILK, 'pm')).toEqual({ session: 'pm' })
    expect(initialValues(EGGS, 'pm')).toEqual({})
  })
  it('pickers are not shown', () => {
    expect(visibleFields(FEED).map(f => f.key)).toEqual(['quantity'])
  })
})

describe('findExisting', () => {
  const rec = (over: Partial<FarmRecord>): FarmRecord => ({ id: 'r', enterpriseId: 'e1', animalId: 'a1', groupId: null, recordType: 'milk', recordDate: '2026-11-10', session: 'am', quantity: 5, unit: 'L', detail: {}, ...over })
  it('matches subject, type, day and session', () => {
    const records = [rec({ id: 'x', session: 'pm' }), rec({ id: 'y' })]
    expect(findExisting(records, cow, 'milk', '2026-11-10', 'am')?.id).toBe('y')
    expect(findExisting(records, cow, 'milk', '2026-11-11', 'am')).toBeUndefined()
    expect(findExisting(records, flock, 'milk', '2026-11-10', 'am')).toBeUndefined()
  })
})

describe('events on a batch group', () => {
  const profile = { recordTypes: [
    { code: 'feed', kind: 'daily', unit: 'kg', subjects: ['animal', 'group'] },
    { code: 'mortality', kind: 'daily', unit: 'head', subjects: ['group'] },
    { code: 'cull', kind: 'event', unit: 'head', subjects: ['group'] },
    { code: 'placement', kind: 'event', unit: 'head', subjects: ['group'] },
    { code: 'heat', kind: 'event', unit: null, subjects: ['animal'] },
    { code: 'weaning', kind: 'event', unit: null, subjects: ['group'] },
  ] } as unknown as FarmProfile

  it('a batch group can record its head-count events as well as daily records', () => {
    expect(recordableTypesFor(profile, 'group').map(r => r.code)).toEqual(['feed', 'mortality', 'cull', 'placement'])
  })

  it('events the screen cannot write yet are left to their own screens', () => {
    expect(recordableTypesFor(profile, 'group').map(r => r.code)).not.toContain('weaning')
  })

  it('a single animal can record its own events (heat) but not the head-count events of a group', () => {
    expect(recordableTypesFor(profile, 'animal').map(r => r.code)).toEqual(['feed', 'heat'])
  })

  it('the animal event body names the animal', () => {
    expect(buildEventPayload(cow, 'dry_off', [], {}, '2026-11-10')).toEqual({ animalId: 'a1', eventType: 'dry_off', eventDate: '2026-11-10' })
  })

  it('births are whole numbers', () => {
    expect(isWholeNumberField({ key: 'liveBirths', type: 'number' }, null)).toBe(true)
  })

  it('a group with no animals is offered starting a batch first', () => {
    expect(recordableTypesFor(profile, 'group', { emptyGroup: true })[0].code).toBe('placement')
  })

  it('the event body names the group, the event and the day', () => {
    const fields = [{ key: 'quantity', type: 'number', required: true }, { key: 'buyer', type: 'text' }]
    expect(buildEventPayload(flock, 'partial_sale', fields, { quantity: '200', buyer: 'Ravi' }, '2026-11-10')).toEqual({
      groupId: 'g1', eventType: 'partial_sale', eventDate: '2026-11-10', quantity: 200, detail: { buyer: 'Ravi' },
    })
  })

  it('the list matches what the server accepts', () => {
    expect([...GROUP_EVENT_CODES].sort()).toEqual(['clear_out', 'cull', 'harvest', 'partial_harvest', 'partial_sale', 'placement', 'stocking'])
  })
})

describe('due list timing', () => {
  it('overdue, today and upcoming read differently', () => {
    expect(dueTiming(-3)).toEqual({ key: 'overdue', count: 3 })
    expect(dueTiming(0)).toEqual({ key: 'today', count: 0 })
    expect(dueTiming(5)).toEqual({ key: 'in', count: 5 })
  })
})

describe('display helpers', () => {
  it('formats a guide range', () => {
    expect(formatRange({ min: 28, max: 32 })).toBe('28 - 32')
    expect(formatRange({ max: 0.5 })).toBe('≤ 0.5')
    expect(formatRange({ min: 4 })).toBe('≥ 4')
    expect(formatRange('text')).toBeNull()
    expect(formatRange(null)).toBeNull()
  })
  it('totals a day per record type', () => {
    const r = (type: string, q: number | null): FarmRecord => ({ id: type + q, enterpriseId: 'e', animalId: 'a', groupId: null, recordType: type, recordDate: 'd', session: 'am', quantity: q, unit: 'L', detail: {} })
    expect(totalsByType([r('milk', 6.5), r('milk', 5), r('eggs', null)])).toEqual([{ recordType: 'milk', total: 11.5, unit: 'L' }])
  })
  it('daily types for a subject exclude events and the other kind of subject', () => {
    const profile = { recordTypes: [
      { code: 'milk', kind: 'daily', unit: 'L', subjects: ['animal', 'group'] },
      { code: 'mortality', kind: 'daily', unit: 'head', subjects: ['group'] },
      { code: 'heat', kind: 'event', unit: null, subjects: ['animal'] },
    ] } as unknown as FarmProfile
    expect(dailyTypesFor(profile, 'animal').map(r => r.code)).toEqual(['milk'])
    expect(dailyTypesFor(profile, 'group').map(r => r.code)).toEqual(['milk', 'mortality'])
  })
})
