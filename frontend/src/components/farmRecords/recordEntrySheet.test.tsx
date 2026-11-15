import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecordEntrySheet from './RecordEntrySheet'
import type { RecordSubject } from './recordShared'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))

const save = vi.fn()
const saveEvent = vi.fn()
const list = vi.fn()
vi.mock('../../services/api', () => ({
  default: { saveFarmRecord: (...a: unknown[]) => save(...a), saveGroupEvent: (...a: unknown[]) => saveEvent(...a), listFarmRecords: (...a: unknown[]) => list(...a) },
}))

const ENTRIES: Record<string, any> = {
  milk: { code: 'milk', kind: 'daily', label: 'Milk', labelKey: null, icon: 'M', unit: 'L', fields: [{ key: 'session', type: 'choice', options: ['am', 'pm'], required: true }, { key: 'quantity', type: 'number', required: true }] },
  eggs: { code: 'eggs', kind: 'daily', label: 'Eggs', labelKey: null, icon: 'E', unit: 'eggs', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'broken', type: 'number' }] },
  placement: { code: 'placement', kind: 'event', label: 'Place new batch', labelKey: null, icon: 'P', unit: 'head', fields: [{ key: 'quantity', type: 'number', required: true }, { key: 'source', type: 'text' }] },
  water_quality: { code: 'water_quality', kind: 'daily', label: 'Water quality', labelKey: null, icon: 'W', unit: null, fields: [{ key: 'ph', type: 'number' }] },
}

let applicable: Array<{ code: string; kind: 'daily' | 'event'; unit: string | null; subjects: Array<'animal' | 'group'> }> = []
vi.mock('../../hooks/useFarmProfile', () => ({
  useFarmProfile: () => ({ profile: { recordTypes: applicable, waterQualityRanges: { ph: { min: 7.5, max: 8.3 } } }, ready: true }),
}))
vi.mock('../../context/MasterDataContext', () => ({
  useMasterData: () => ({ recordTypeEntry: (c: string) => ENTRIES[c], resolveLabel: (e: any) => e.label }),
}))

const cow: RecordSubject = { kind: 'animal', id: 'a1', name: 'Lakshmi', enterpriseId: 'e1', speciesCode: 'Cattle', animalClass: 'cattle_cow', gender: 'female', managementMode: 'individual', groupType: null }
const pond: RecordSubject = { ...cow, kind: 'group', id: 'g1', name: 'Pond 1', speciesCode: 'Vannamei Shrimp', animalClass: null, gender: null, managementMode: 'batch', groupType: 'pond' }

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue({ data: { items: [] } })
  save.mockResolvedValue({ data: { id: 'r1', replaced: false } })
  applicable = [{ code: 'milk', kind: 'daily', unit: 'L', subjects: ['animal', 'group'] }, { code: 'heat', kind: 'event', unit: null, subjects: ['animal'] }]
})

describe('RecordEntrySheet', () => {
  it('offers only daily records that apply, and asks for what the record type asks for', () => {
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
})
