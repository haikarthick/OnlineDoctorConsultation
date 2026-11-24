import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecordEntrySheet from './RecordEntrySheet'
import type { RecordSubject } from './recordShared'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))

const save = vi.fn()
const saveEvent = vi.fn()
const list = vi.fn()
const listFeeds = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    saveFarmRecord: (...a: unknown[]) => save(...a), saveGroupEvent: (...a: unknown[]) => saveEvent(...a), listFarmRecords: (...a: unknown[]) => list(...a),
    listFeeds: (...a: unknown[]) => listFeeds(...a),
    // the withdrawal banner and the medicated-feed hint: nothing held back, no course running
    animalWithdrawal: () => Promise.resolve({ data: null }), getGroupWithdrawal: () => Promise.resolve({ data: null }), feedCourses: () => Promise.resolve({ data: [] }),
  },
}))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'farmer' } }) }))
vi.mock('../../context/SettingsContext', () => ({ useSettings: () => ({ formatCurrency: (n: number) => `Rs${n}` }) }))
vi.mock('../../hooks/useNutritionEnabled', () => ({ useNutritionEnabled: () => ({ enabled: false, loading: false }) }))

const ENTRIES: Record<string, any> = {
  milk: { code: 'milk', kind: 'daily', label: 'Milk', labelKey: null, icon: 'M', unit: 'L', fields: [{ key: 'session', type: 'choice', options: ['am', 'pm'], required: true }, { key: 'quantity', type: 'number', required: true }] },
  eggs: { code: 'eggs', kind: 'daily', label: 'Eggs', labelKey: null, icon: 'E', unit: 'eggs', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'broken', type: 'number' }] },
  placement: { code: 'placement', kind: 'event', label: 'Place new batch', labelKey: null, icon: 'P', unit: 'head', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'source', type: 'text' }] },
  water_quality: { code: 'water_quality', kind: 'daily', label: 'Water quality', labelKey: null, icon: 'W', unit: null, fields: [{ key: 'ph', type: 'number' }] },
  feed: { code: 'feed', kind: 'daily', label: 'Feed', labelKey: null, icon: 'F', unit: 'kg', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'feedId', type: 'stock' }] },
}
const MASTER_TYPES = Object.values(ENTRIES).map((e: any) => ({ code: e.code, kind: e.kind, unit: e.unit }))

let applicable: Array<{ code: string; kind: 'daily' | 'event'; unit: string | null; subjects: Array<'animal' | 'group'> }> = []
vi.mock('../../hooks/useFarmOutbox', () => ({ useFarmOutbox: () => ({ items: [], waiting: 0, refused: 0, flush: vi.fn(), add: vi.fn(), discard: vi.fn(), retry: vi.fn() }) }))
vi.mock('../../hooks/useFarmProfile', () => ({
  useFarmProfile: () => ({ profile: { recordTypes: applicable, waterQualityRanges: { ph: { min: 7.5, max: 8.3 } } }, ready: true }),
}))
vi.mock('../../context/MasterDataContext', () => ({
  useMasterData: () => ({ recordTypeEntry: (c: string) => ENTRIES[c], resolveLabel: (e: any) => e.label, farmMaster: { recordTypes: MASTER_TYPES } }),
}))

const cow: RecordSubject = { kind: 'animal', id: 'a1', name: 'Lakshmi', enterpriseId: 'e1', speciesCode: 'Cattle', animalClass: 'cattle_cow', gender: 'female', managementMode: 'individual', groupType: null }
const pond: RecordSubject = { ...cow, kind: 'group', id: 'g1', name: 'Pond 1', speciesCode: 'Vannamei Shrimp', animalClass: null, gender: null, managementMode: 'batch', groupType: 'pond' }

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue({ data: { items: [] } })
  listFeeds.mockResolvedValue({ data: { items: [
    { id: 'f1', feedName: 'Cattle feed', unit: 'bag', currentStock: 4, stockKg: 200, costPerKg: 25, ingredientId: null },
  ] } })
  try { localStorage.clear() } catch { /* jsdom */ }
  save.mockResolvedValue({ data: { id: 'r1', replaced: false } })
  applicable = [{ code: 'milk', kind: 'daily', unit: 'L', subjects: ['animal', 'group'] }, { code: 'weaning', kind: 'event', unit: null, subjects: ['animal'] }]
})

describe('RecordEntrySheet', () => {
  it('offers only records and events the screen can write, that apply, and asks for what the record type asks for', () => {
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('farmRecords.sheetTitle')).toBeInTheDocument()
    expect(screen.getByText('farmRecords.fields.session')).toBeInTheDocument() // milk asks which milking
    expect(screen.getByText('Milk')).toBeInTheDocument() // the amount field is labelled with the record type
    expect(screen.queryByText('farmRecords.whatToRecord')).toBeNull() // one type: nothing to choose
  })

  it('cannot save until the required amount is filled, and says which field', () => {
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('farmRecords.save')).toBeDisabled()
    expect(screen.getByText('farmRecords.needsField')).toBeInTheDocument()
  })

  it('saves the entry with the right body and reports back', async () => {
    const onSaved = vi.fn()
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/Milk/), { target: { value: '6.5' } })
    fireEvent.click(screen.getByText('farmRecords.save'))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toMatchObject({ enterpriseId: 'e1', animalId: 'a1', recordType: 'milk', recordDate: '2026-11-10', quantity: 6.5 })
    expect(['am', 'pm']).toContain(save.mock.calls[0][0].session)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ recordType: 'milk', replaced: false })))
  })

  it('a second entry for the same slot says it will update the first', () => {
    const now = new Date()
    const session = now.getHours() < 12 ? 'am' : 'pm'
    const existing = [{ id: 'r0', enterpriseId: 'e1', animalId: 'a1', groupId: null, recordType: 'milk', recordDate: '2026-11-10', session, quantity: 5, unit: 'L', detail: {} }] as any
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={existing} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('farmRecords.alreadyRecorded')).toBeInTheDocument()
    expect(screen.getByText('farmRecords.update')).toBeInTheDocument()
  })

  it('a failed save keeps what was typed, shows the server message and offers Retry', async () => {
    save.mockRejectedValueOnce({ response: { data: { message: 'That date is in the future.' } } })
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Milk/), { target: { value: '4' } })
    fireEvent.click(screen.getByText('farmRecords.save'))
    expect(await screen.findByText(/That date is in the future/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Milk/)).toHaveValue('4')
    expect(screen.getByText('mobileUi.save.retry')).toBeInTheDocument()
  })

  it('with several types, the farmer chooses, and the form changes to that type\'s fields', () => {
    applicable = [{ code: 'eggs', kind: 'daily', unit: 'eggs', subjects: ['group'] }, { code: 'water_quality', kind: 'daily', unit: null, subjects: ['group'] }]
    render(<RecordEntrySheet subject={pond} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('farmRecords.whatToRecord')).toBeInTheDocument()
    expect(screen.getByText('farmRecords.fields.broken')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Water quality'))
    expect(screen.queryByText('farmRecords.fields.broken')).toBeNull()
    expect(screen.getByText('farmRecords.fields.ph')).toBeInTheDocument()
    expect(screen.getByText('farmRecords.usualRange')).toBeInTheDocument() // the guide range comes from master data
  })

  it('opens on the record type the farmer tapped', () => {
    applicable = [{ code: 'eggs', kind: 'daily', unit: 'eggs', subjects: ['group'] }, { code: 'water_quality', kind: 'daily', unit: null, subjects: ['group'] }]
    render(<RecordEntrySheet subject={pond} date="2026-11-10" initialType="water_quality" records={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('farmRecords.fields.ph')).toBeInTheDocument()
  })

  it('a head-count event goes to the events endpoint, not the daily one, and opens first on an empty group', async () => {
    applicable = [{ code: 'eggs', kind: 'daily', unit: 'eggs', subjects: ['group'] }, { code: 'placement', kind: 'event', unit: 'head', subjects: ['group'] }]
    saveEvent.mockResolvedValue({ data: { currentCount: 500, cycleOpened: true } })
    const onSaved = vi.fn()
    render(<RecordEntrySheet subject={{ ...pond, headCount: 0 }} date="2026-11-10" records={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/Place new batch/), { target: { value: '500' } })
    fireEvent.click(screen.getByText('farmRecords.save'))
    await waitFor(() => expect(saveEvent).toHaveBeenCalledTimes(1))
    expect(save).not.toHaveBeenCalled()
    expect(saveEvent.mock.calls[0][0]).toMatchObject({ groupId: 'g1', eventType: 'placement', eventDate: '2026-11-10', quantity: 500 })
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ currentCount: 500, cycleOpened: true })))
  })

  it('says so when nothing can be recorded for the subject', () => {
    applicable = []
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('farmRecords.nothingToRecord')).toBeInTheDocument()
  })

  it('feed: the farmer picks the stock item, and the entry carries it (stock is taken out by the server)', async () => {
    applicable = [{ code: 'feed', kind: 'daily', unit: 'kg', subjects: ['animal', 'group'] }]
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.click(await screen.findByText('Cattle feed (4 bag)'))
    fireEvent.change(screen.getByLabelText('Feed'), { target: { value: '12' } })
    expect(screen.getByText(/farmRecords.feedCost/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('farmRecords.save'))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ enterpriseId: 'e1', recordType: 'feed', recordDate: '2026-11-10', animalId: 'a1', quantity: 12, feedId: 'f1' }))
  })

  it('feed: more than is in stock is said before saving', async () => {
    applicable = [{ code: 'feed', kind: 'daily', unit: 'kg', subjects: ['animal', 'group'] }]
    render(<RecordEntrySheet subject={cow} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.click(await screen.findByText('Cattle feed (4 bag)'))
    fireEvent.change(screen.getByLabelText('Feed'), { target: { value: '250' } })
    expect(screen.getByText('farmRecords.moreThanStock')).toBeInTheDocument()
  })

  it('feed for "all my animals" names no animal and no group; home-grown names no feed', async () => {
    const farm: RecordSubject = { kind: 'farm', id: 'e1', name: 'x', enterpriseId: 'e1', speciesCode: null, animalClass: null, gender: null, managementMode: null, groupType: null }
    render(<RecordEntrySheet subject={farm} date="2026-11-10" records={[]} onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Cattle feed (4 bag)')
    expect(screen.queryByText('farmRecords.whatToRecord')).toBeNull()
    fireEvent.change(screen.getByLabelText('Feed'), { target: { value: '30' } })
    fireEvent.click(screen.getByText('farmRecords.save'))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ enterpriseId: 'e1', recordType: 'feed', recordDate: '2026-11-10', quantity: 30 }))
  })
})
