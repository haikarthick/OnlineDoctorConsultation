import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SharedGroupsPanel } from './SharedGroupsPanel'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('../../context/SettingsContext', () => ({ useSettings: () => ({ formatDate: (d: string) => `D:${String(d).slice(0, 10)}` }) }))

const enroll = vi.fn(); const list = vi.fn(); const records = vi.fn()
const api = { enrollGroupByCode: (...a: unknown[]) => enroll(...a), listNetworkSharedGroups: (...a: unknown[]) => list(...a), getSharedGroupRecords: (...a: unknown[]) => records(...a) }
vi.mock('../../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue({ data: [{ id: 'x1', groupId: 'g1', groupName: 'Flock A', farmName: 'Green Pastures', headCount: 120, sharedSince: '2026-11-10' }] })
  enroll.mockResolvedValue({}); records.mockResolvedValue({ data: { medicalRecords: [{ id: 'm1', title: 'Coccidiosis treatment', createdAt: '2026-11-12', headCountTreated: 120 }], vaccinations: [], prescriptions: [] } })
})

describe('SharedGroupsPanel', () => {
  it('adds a group with the code the farm gave, and refreshes the list', async () => {
    render(<SharedGroupsPanel networkId="n1" />)
    await screen.findByText(/Flock A/)
    fireEvent.change(screen.getByLabelText('groupSharing.network.codeLabel'), { target: { value: ' ABCD-2345 ' } })
    fireEvent.click(screen.getByText('groupSharing.network.add'))
    await waitFor(() => expect(enroll).toHaveBeenCalledWith('n1', { code: 'ABCD-2345' }))
    expect(await screen.findByText('groupSharing.network.added')).toBeTruthy()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('opens a shared group read-only and says only the shared cycle is shown', async () => {
    render(<SharedGroupsPanel networkId="n1" />)
    await screen.findByText(/Flock A/)
    fireEvent.click(screen.getByText('groupSharing.network.view'))
    expect(await screen.findByText('Coccidiosis treatment')).toBeTruthy()
    expect(screen.getByText('groupSharing.network.cycleOnly')).toBeTruthy()
    expect(records).toHaveBeenCalledWith('n1', 'g1')
  })

  it('says in words when the code is refused', async () => {
    enroll.mockRejectedValue({ response: { status: 400, data: { message: 'That code is not valid, has expired, or has already been used. Ask the farm owner to create a new one.' } } })
    render(<SharedGroupsPanel networkId="n1" />)
    await screen.findByText(/Flock A/)
    fireEvent.change(screen.getByLabelText('groupSharing.network.codeLabel'), { target: { value: 'ZZZZ-ZZZZ' } })
    fireEvent.click(screen.getByText('groupSharing.network.add'))
    expect(await screen.findByText(/not valid, has expired/)).toBeTruthy()
  })
})
