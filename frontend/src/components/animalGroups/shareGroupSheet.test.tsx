import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareGroupSheet } from './ShareGroupSheet'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('../../context/SettingsContext', () => ({ useSettings: () => ({ formatDate: (d: string) => `D:${String(d).slice(0, 10)}` }) }))

const create = vi.fn(); const stop = vi.fn(); const list = vi.fn()
const api = { listGroupNetworkShares: (...a: unknown[]) => list(...a), createGroupShareCode: (...a: unknown[]) => create(...a), stopGroupNetworkShare: (...a: unknown[]) => stop(...a), cancelGroupShareCode: vi.fn() }
vi.mock('../../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue({ data: { sharings: [{ id: 'c1', networkName: 'DemoVetGroup', status: 'active', sharedSince: '2026-11-10', medicalRecords: true, vaccinationRecords: true, prescriptions: true }], openCodes: [] } })
  create.mockResolvedValue({ data: { code: 'ABCD-2345', expiresAt: '2026-11-30', cycleNumber: 1 } })
  stop.mockResolvedValue({})
})

describe('ShareGroupSheet', () => {
  it('creates a code with only what the owner ticked, and shows it once', async () => {
    render(<ShareGroupSheet group={{ id: 'g1', name: 'Flock A' }} onClose={() => {}} />)
    await screen.findByText('DemoVetGroup')
    fireEvent.click(screen.getByLabelText('groupSharing.scope.prescriptions'))
    fireEvent.click(screen.getByText('groupSharing.createCode'))
    await waitFor(() => expect(create).toHaveBeenCalledWith('g1', { medicalRecords: true, vaccinationRecords: true, prescriptions: false }))
    expect(await screen.findByText('ABCD-2345')).toBeTruthy()
    expect(screen.getByText('groupSharing.codeNote')).toBeTruthy()
  })

  it('lists who it is shared with and lets the owner stop it', async () => {
    render(<ShareGroupSheet group={{ id: 'g1', name: 'Flock A' }} onClose={() => {}} />)
    await screen.findByText('DemoVetGroup')
    expect(screen.getByText('groupSharing.endsWithCycle')).toBeTruthy()
    fireEvent.click(screen.getByText('groupSharing.stop'))
    await waitFor(() => expect(stop).toHaveBeenCalledWith('g1', 'c1'))
  })

  it('cannot create a code that shares nothing', async () => {
    render(<ShareGroupSheet group={{ id: 'g1', name: 'Flock A' }} onClose={() => {}} />)
    await screen.findByText('DemoVetGroup')
    for (const k of ['medicalRecords', 'vaccinationRecords', 'prescriptions']) fireEvent.click(screen.getByLabelText('groupSharing.scope.' + k))
    expect((screen.getByText('groupSharing.createCode') as HTMLButtonElement).disabled).toBe(true)
  })
})
