import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import BreedingManager from './BreedingManager'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }))
vi.mock('../hooks/useAutoRefresh', () => ({ useAutoRefresh: () => undefined }))

const create = vi.fn()
const api = {
  listEnterprises: vi.fn(), listBreedingRecords: vi.fn(), getBreedingStats: vi.fn(), getUpcomingDueDates: vi.fn(),
  listEnterpriseAnimals: vi.fn(), createBreedingRecord: (...a: unknown[]) => create(...a), updateBreedingRecord: vi.fn(),
}
vi.mock('../services/api', () => ({ default: new Proxy({}, { get: (_t, k: string) => (api as any)[k] }) }))

const animals = [
  { id: 'cow1', name: 'Lakshmi', gender: 'female', species: 'Cattle', status: 'active', earTagId: 'T1' },
  { id: 'cow2', name: 'Sold Cow', gender: 'female', species: 'Cattle', status: 'sold' },
  { id: 'bull1', name: 'Nandi', gender: 'male', species: 'Cattle', status: 'active' },
  { id: 'ram1', name: 'Ram', gender: 'male', species: 'Sheep', status: 'active' },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.listEnterprises.mockResolvedValue({ data: { items: [{ id: 'f1', name: 'Farm' }] } })
  api.listBreedingRecords.mockResolvedValue({ data: { items: [{ id: 'b1', damId: 'cow1', damName: 'Lakshmi', sireName: 'Nandi', breedingDate: '2026-11-01', status: 'bred', breedingMethod: 'natural' }] } })
  api.getBreedingStats.mockResolvedValue({ data: null })
  api.getUpcomingDueDates.mockResolvedValue({ data: [] })
  api.listEnterpriseAnimals.mockResolvedValue({ data: { items: animals } })
  create.mockResolvedValue({})
})

describe('BreedingManager', () => {
  it('shows records as cards, not a table', async () => {
    const { container } = render(<BreedingManager />)
    await screen.findByText('Lakshmi')
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelectorAll('.breeding-card')).toHaveLength(1)
  })

  it('chooses the mother and father from the farm\'s own animals (live, right sex, same species) - no typed ID', async () => {
    render(<BreedingManager />)
    await screen.findByText('Lakshmi')
    fireEvent.click(screen.getByText('breedingManager.newRecord'))
    const dam = await screen.findByLabelText('breedingManager.modal.dam') as HTMLSelectElement
    expect(within(dam).getAllByRole('option').map(o => o.textContent)).toEqual(['breedingManager.modal.damPlaceholder', 'Lakshmi (T1)'])
    // Not allowed to go on without a mother, and told why
    expect(screen.getByText('breedingManager.blocked.dam')).toBeTruthy()
    fireEvent.change(dam, { target: { value: 'cow1' } })
    const sire = screen.getByLabelText('breedingManager.modal.sire') as HTMLSelectElement
    expect(within(sire).getAllByRole('option').map(o => o.textContent)).toEqual(['breedingManager.modal.sirePlaceholder', 'Nandi'])
  })

  it('walks the steps and saves the chosen animals', async () => {
    render(<BreedingManager />)
    await screen.findByText('Lakshmi')
    fireEvent.click(screen.getByText('breedingManager.newRecord'))
    fireEvent.change(await screen.findByLabelText('breedingManager.modal.dam'), { target: { value: 'cow1' } })
    fireEvent.click(screen.getByRole('button', { name: /mobileUi.step.next/ }))
    fireEvent.click(screen.getByRole('button', { name: /mobileUi.step.next/ }))
    fireEvent.click(screen.getByRole('button', { name: 'breedingManager.modal.createBtn' }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0]).toBe('f1')
    expect(create.mock.calls[0][1]).toMatchObject({ damId: 'cow1', status: 'bred', breedingMethod: 'natural' })
    expect(await screen.findByText('breedingManager.toasts.created')).toBeTruthy()
  })
})
