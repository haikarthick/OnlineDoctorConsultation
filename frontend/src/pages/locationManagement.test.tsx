import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LocationManagement from './LocationManagement'

const t = ((key: string, o?: any) => (o && o.names ? `${key}:${o.names}` : key)) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'farmer' } }) }))
vi.mock('../components/MapView', () => ({ default: () => <div data-testid="map" /> }))

const create = vi.fn()
const del = vi.fn()
const api = {
  listEnterprises: vi.fn(), listLocations: vi.fn(), getLocationTree: vi.fn(), listEnterpriseMembers: vi.fn(),
  createLocation: (...a: unknown[]) => create(...a), updateLocation: vi.fn(), deleteLocation: (...a: unknown[]) => del(...a),
}
vi.mock('../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

const locs = [
  { id: 'l1', name: 'Barn A', locationType: 'barn', capacity: 10, currentOccupancy: 10, gpsLatitude: 12.9, gpsLongitude: 77.5 },
  { id: 'l2', name: 'Pen 1', locationType: 'pen', capacity: 4, currentOccupancy: 1, parentLocationId: 'l1', parentLocationName: 'Barn A' },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'f1', name: 'Farm', ownerId: 'u1' }] } })
  api.listLocations.mockResolvedValue({ data: { items: locs } })
  api.getLocationTree.mockResolvedValue({ data: [{ ...locs[0], children: [{ ...locs[1], children: [] }] }] })
  api.listEnterpriseMembers.mockResolvedValue({ data: [] })
  create.mockResolvedValue({}); del.mockResolvedValue({})
})

describe('LocationManagement', () => {
  it('lists places as cards with a full barn flagged, and asks for all of them (not just the first 50)', async () => {
    const { container } = render(<LocationManagement />)
    await screen.findByText('Barn A')
    expect(api.listLocations).toHaveBeenCalledWith('f1', { limit: 200 })
    expect(container.querySelectorAll('.loc-card')).toHaveLength(2)
    expect(container.querySelector('.loc-bar-fill.is-full')).not.toBeNull()
    expect(container.querySelector('.loc-bar-5')).not.toBeNull() // 1 of 4 = 25% = step 5
  })

  it('tree view indents with a class, not an inline style', async () => {
    const { container } = render(<LocationManagement />)
    await screen.findByText('Barn A')
    fireEvent.click(screen.getByText('locationManagement.viewTree'))
    expect(container.querySelector('.loc-depth-1')).not.toBeNull()
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('creates a place: name and type first, with the type chosen from the list', async () => {
    render(<LocationManagement />)
    await screen.findByText('Barn A')
    fireEvent.click(screen.getByText('locationManagement.newLocation'))
    expect(await screen.findByText('locationManagement.blocked.name')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('locationManagement.form.name'), { target: { value: 'Shed 9' } })
    expect(screen.getByText('locationManagement.blocked.type')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('locationManagement.form.type'), { target: { value: 'pen' } })
    fireEvent.click(screen.getByRole('button', { name: /mobileUi.step.next/ }))
    fireEvent.click(screen.getByRole('button', { name: /mobileUi.step.next/ }))
    fireEvent.click(screen.getByRole('button', { name: 'locationManagement.modal.createBtn' }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0]).toMatchObject({ enterpriseId: 'f1', name: 'Shed 9', locationType: 'pen', capacity: 0 })
  })

  it('asks before deleting, and says what happens to what is inside', async () => {
    render(<LocationManagement />)
    await screen.findByText('Barn A')
    fireEvent.click(screen.getAllByText('common.delete')[0])
    expect(del).not.toHaveBeenCalled()
    expect(await screen.findByText('locationManagement.deleteExplain')).toBeTruthy()
    fireEvent.click(document.querySelector('.loc-sheet-action') as HTMLElement)
    await waitFor(() => expect(del).toHaveBeenCalledWith('l1'))
  })

  it('shows no change buttons to someone who may not change places (a worker)', async () => {
    api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'f1', name: 'Farm', ownerId: 'someone' }] } })
    api.listEnterpriseMembers.mockResolvedValue({ data: [{ userId: 'u1', role: 'worker' }] })
    render(<LocationManagement />)
    await screen.findByText('Barn A')
    expect(screen.queryByText('locationManagement.newLocation')).toBeNull()
    expect(screen.queryByText('common.edit')).toBeNull()
  })
})
