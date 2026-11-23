import type { FarmProfile, ResolvedRecordType } from '../../utils/farmProfile/resolveFarmProfile'
import type { RecordFieldDef } from '../../context/MasterDataContext'

/**
 * Pure logic for entering a daily record (milk, eggs, feed, sample weight, water quality...).
 *
 * Nothing here names a species or a record type: which records apply comes from the farm profile
 * and what each one asks for comes from the record type's own `fields` in master data, so a new
 * record type or a changed rule needs no change in this file.
 */

/** 'farm' = all the farm's animals - only for record types that use stock (feed): a small farm feeds from one bag. */
export type RecordSubjectKind = 'animal' | 'group' | 'farm'

/** Who a record is about, with everything the farm profile needs to say what applies. */
export interface RecordSubject {
  kind: RecordSubjectKind
  id: string
  name: string
  enterpriseId: string
  speciesCode: string | null
  animalClass: string | null
  gender: string | null
  managementMode: string | null
  groupType: string | null
  /** For a group: how many animals it holds now (a group with none is offered starting a batch first). */
  headCount?: number | null
}

export type FieldValues = Record<string, string>

/** A saved record as the API returns it. */
export interface FarmRecord {
  id: string
  enterpriseId: string
  animalId: string | null
  groupId: string | null
  recordType: string
  recordDate: string
  session: 'am' | 'pm' | 'day'
  quantity: number | null
  unit: string | null
  detail: Record<string, unknown>
  /** Feed: the stock item used (null = home-grown), its cost, and whether it was for all the farm's animals. */
  feedId?: string | null
  cost?: number | null
  wholeFarm?: boolean
}

/** Units that only ever make sense as whole numbers (counts of animals / eggs). */
const WHOLE_NUMBER_UNITS = ['head', 'eggs']
/** Step of the +/- buttons for a measured amount, by unit. Anything else steps by 1. */
const STEP_BY_UNIT: Record<string, number> = { L: 0.5, kg: 0.5, g: 10 }

/**
 * Events on a batch group that change its head count - they go through the population ledger on the
 * server (backend FarmEventService.GROUP_EVENT_ACTIONS - keep the two lists in step). Other events
 * (breeding, treatment...) have their own screens.
 */
export const GROUP_EVENT_CODES = ['placement', 'stocking', 'cull', 'partial_sale', 'clear_out', 'partial_harvest', 'harvest']
/** Events on ONE animal (backend FarmEventService.ANIMAL_EVENT_CODES - keep the two lists in step). */
export const ANIMAL_EVENT_CODES = ['heat', 'insemination', 'pregnancy_check', 'birth', 'dry_off', 'weight', 'sale', 'death']
/** The events that start a batch - offered first on a group that has no animals yet. */
export const BATCH_START_CODES = ['placement', 'stocking']

/** Daily (not event) record types that apply to this kind of subject in this profile. */
export function dailyTypesFor(profile: FarmProfile, kind: Exclude<RecordSubjectKind, 'farm'>): ResolvedRecordType[] {
  return profile.recordTypes.filter(r => r.kind === 'daily' && r.subjects.includes(kind))
}

/** The fields the form shows: pickers need a source list we do not have yet, so they are left out. */
/**
 * Everything the entry sheet can record for this subject: the daily records, plus - for a batch
 * group - the head-count events. A group with no animals yet is offered starting a batch first.
 */
export function recordableTypesFor(profile: FarmProfile, kind: Exclude<RecordSubjectKind, 'farm'>, opts: { emptyGroup?: boolean } = {}): ResolvedRecordType[] {
  const daily = dailyTypesFor(profile, kind)
  const codes = kind === 'group' ? GROUP_EVENT_CODES : ANIMAL_EVENT_CODES
  const events = profile.recordTypes.filter(r => r.kind === 'event' && r.subjects.includes(kind) && codes.includes(r.code))
  const all = [...daily, ...events]
  if (kind !== 'group' || !opts.emptyGroup) return all
  const start = all.filter(r => BATCH_START_CODES.includes(r.code))
  return [...start, ...all.filter(r => !BATCH_START_CODES.includes(r.code))]
}

export function visibleFields(fields: RecordFieldDef[]): RecordFieldDef[] {
  return fields.filter(f => f.type !== 'picker')
}

/** A record type that names a stock item (feed): it takes from stock, and may be for all the farm's animals. */
export const usesStock = (fields: RecordFieldDef[]): boolean => fields.some(f => f.type === 'stock')

/**
 * What can be recorded for "All my animals": the daily record types that use stock (feed). From master data - no
 * record type is named here.
 */
export function farmWideTypes(
  recordTypes: Array<{ code: string; kind: string; unit: string | null }>,
  fieldsOf: (code: string) => RecordFieldDef[],
): ResolvedRecordType[] {
  return recordTypes
    .filter(r => r.kind === 'daily' && usesStock(fieldsOf(r.code)))
    .map(r => ({ code: r.code, kind: 'daily' as const, unit: r.unit, subjects: [] }))
}

export function isWholeNumberField(field: RecordFieldDef, unit: string | null): boolean {
  if (field.key === 'quantity') return !!unit && WHOLE_NUMBER_UNITS.includes(unit)
  return /[cC]ount$|Days$/.test(field.key) || ['broken', 'liveBirths', 'stillbirths'].includes(field.key)
}

export function stepFor(field: RecordFieldDef, unit: string | null): number {
  if (isWholeNumberField(field, unit)) return 1
  if (field.key === 'quantity') return (unit && STEP_BY_UNIT[unit]) || 1
  if (field.key === 'amount') return 100
  return 0.1
}

/** Morning milking before noon, evening after - the farmer's one fewer tap. */
export function defaultSession(now: Date = new Date()): 'am' | 'pm' {
  return now.getHours() < 12 ? 'am' : 'pm'
}

export function initialValues(fields: RecordFieldDef[], session: 'am' | 'pm' = defaultSession()): FieldValues {
  const values: FieldValues = {}
  for (const f of fields) if (f.key === 'session') values.session = session
  return values
}

function numberOf(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** The first required field still empty (or not a number), or null when the entry is complete. */
export function firstMissingField(fields: RecordFieldDef[], values: FieldValues): string | null {
  for (const f of visibleFields(fields)) {
    const raw = values[f.key]
    const blank = raw === undefined || raw.trim() === ''
    if (f.required && blank) return f.key
    if (!blank && f.type === 'number' && numberOf(raw) === null) return f.key
  }
  return null
}

/** The body for POST /farm-records. Only fields the record type asks for are sent. */
export function buildRecordPayload(
  subject: RecordSubject, recordType: string, fields: RecordFieldDef[], values: FieldValues, date: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    enterpriseId: subject.enterpriseId,
    recordType,
    recordDate: date,
  }
  // "All my animals" names neither an animal nor a group.
  if (subject.kind !== 'farm') payload[subject.kind === 'animal' ? 'animalId' : 'groupId'] = subject.id
  const detail: Record<string, unknown> = {}
  for (const f of visibleFields(fields)) {
    const raw = values[f.key]
    if (raw === undefined || raw.trim() === '') continue
    if (f.type === 'stock') { payload.feedId = raw.trim(); continue }
    const v: unknown = f.type === 'number' ? numberOf(raw) : raw.trim()
    if (v === null) continue
    if (f.key === 'quantity') payload.quantity = v
    else if (f.key === 'session') payload.session = v
    else detail[f.key] = v
  }
  if (Object.keys(detail).length) payload.detail = detail
  return payload
}

/** The body for POST /farm-records/events (an event on a batch group or on one animal). */
export function buildEventPayload(
  subject: RecordSubject, eventType: string, fields: RecordFieldDef[], values: FieldValues, date: string,
): Record<string, unknown> {
  const { recordType, recordDate, enterpriseId: _e, animalId: _a, groupId: _g, ...rest } = buildRecordPayload(subject, eventType, fields, values, date) as Record<string, unknown>
  return { [subject.kind === 'animal' ? 'animalId' : 'groupId']: subject.id, eventType: recordType, eventDate: recordDate, ...rest }
}

/** The record already saved for this subject, type, day and session - saving again corrects it. */
export function findExisting(
  records: FarmRecord[], subject: Pick<RecordSubject, 'kind' | 'id'>, recordType: string, date: string, session: string | undefined,
  feedId?: string | null,
): FarmRecord | undefined {
  return records.find(r =>
    r.recordType === recordType && r.recordDate === date && isRecordOf(r, subject) &&
    (!session || r.session === session || r.session === 'day') &&
    // a feed entry is one per feed: green fodder and concentrate the same day are two entries
    (feedId === undefined || (r.feedId || null) === (feedId || null)))
}

/** Whether a saved record belongs to this animal, this group, or "all my animals". */
export function isRecordOf(r: FarmRecord, subject: Pick<RecordSubject, 'kind' | 'id'>): boolean {
  if (subject.kind === 'farm') return !r.animalId && !r.groupId
  return subject.kind === 'animal' ? r.animalId === subject.id : r.groupId === subject.id
}

/** "28 - 32", "up to 0.5", "at least 4": the usual range for a water reading, from master data. */
export function formatRange(range: unknown): string | null {
  if (!range || typeof range !== 'object') return null
  const { min, max } = range as { min?: number; max?: number }
  if (typeof min === 'number' && typeof max === 'number') return `${min} - ${max}`
  if (typeof max === 'number') return `≤ ${max}`
  if (typeof min === 'number') return `≥ ${min}`
  return null
}

/** Per record type, the total of a day's quantities - what the top bar of the screen shows. */
export function totalsByType(records: FarmRecord[]): Array<{ recordType: string; total: number; unit: string | null }> {
  const map = new Map<string, { total: number; unit: string | null }>()
  for (const r of records) {
    if (r.quantity === null) continue
    const cur = map.get(r.recordType) || { total: 0, unit: r.unit }
    cur.total += r.quantity
    map.set(r.recordType, cur)
  }
  return [...map.entries()].map(([recordType, v]) => ({ recordType, ...v }))
}

/** One thing coming up on the farm (GET /farm-records/due). */
export interface DueItem {
  kind: 'birth_expected' | 'vaccination_due' | 'withdrawal_ending'
  date: string
  inDays: number
  animalId: string | null
  groupId: string | null
  name: string
  detail: string | null
}

/** The translation key and count for "overdue by 3 days" / "today" / "in 5 days". */
export function dueTiming(inDays: number): { key: 'overdue' | 'today' | 'in'; count: number } {
  if (inDays < 0) return { key: 'overdue', count: -inDays }
  if (inDays === 0) return { key: 'today', count: 0 }
  return { key: 'in', count: inDays }
}

/** A number for display without trailing noise: 6.5, 12, 4200. */
export function formatQuantity(n: number): string {
  return String(Math.round(n * 100) / 100)
}
