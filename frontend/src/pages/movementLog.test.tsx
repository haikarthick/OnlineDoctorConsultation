import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MovementLog from './MovementLog'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
let userRole = 'farmer'
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: userRole } }) }))
vi.mock('../context/MasterDataContext', () => ({ useMasterData: () => ({ speciesLabel: (s: string) => s }) }))
vi.mock('../context/SettingsContext', () => ({ useSettings: () => ({ formatDateTime: (d: string) => `DT:${d}` }) }))

const approve = vi.fn()
const api = {
  listEnterprises: vi.fn(), listMovements: vi.fn(), listLocations: vi.fn(), listAnimalGroups: vi.fn(), listEnterpriseMembers: vi.fn(),
  approveMovement: (...a: unknown[]) => approve(...a), createMovement: vi.fn(), get: vi.fn(),
}
vi.mock('../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

beforeEach(() => {
  vi.clearAllMocks(); userRole = 'farmer'
  api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'f1', name: 'Farm', ownerId: 'someone-else' }] } })
  api.listMovements.mockResolvedValue({ data: { items: [
    { id: 'm1', movementType: 'transfer', animalName: 'Lakshmi', fromLocationName: 'A', toLocationName: 'B', status: 'pending', createdAt: '2026-11-16' },
    { id: 'm2', movementType: 'sale', groupName: 'Herd', status: 'approved', createdAt: '2026-11-15' },
  ] } })
  api.listLocations.mockResolvedValue({ data: { items: [] } })
  api.listAnimalGroups.mockResolvedValue({ data: { items: [] } })
  api.listEnterpriseMembers.mockResolvedValue({ data: [{ userId: 'u1', role: 'manager' }] })
  approve.mockResolvedValue({})
})

describe('MovementLog', () => {
  it('shows movements as cards with their status in words', async () => {
    const { container } = render(<MovementLog />)
    await screen.findByText('Lakshmi')
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelectorAll('.movement-card')).toHaveLength(2)
    expect(screen.getByText('movements.pending')).toBeTruthy()
    expect(screen.getByText('movements.approved')).toBeTruthy()
  })

  it('offers Approve / Reject to a manager, only on a pending movement', async () => {
    render(<MovementLog />)
    await screen.findByText('Lakshmi')
    expect(screen.getAllByText(/movements.approve$/)).toHaveLength(1)
    fireEvent.click(screen.getByText(/movements.approve$/))
    await waitFor(() => expect(approve).toHaveBeenCalledWith('m1', 'approve'))
    expect(await screen.findByText('movements.approved', { selector: '.alert' })).toBeTruthy()
  })

  it('does not offer them to a worker (the server would refuse; no point showing a button)', async () => {
    api.listEnterpriseMembers.mockResolvedValue({ data: [{ userId: 'u1', role: 'worker' }] })
    render(<MovementLog />)
    await screen.findByText('Lakshmi')
    expect(screen.queryByText(/movements.approve$/)).toBeNull()
  })

  it('says in words when the movements cannot be loaded', async () => {
    api.listMovements.mockRejectedValue(new Error('Network Error'))
    render(<MovementLog />)
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
