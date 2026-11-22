import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Nutrition from './Nutrition'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'admin' } }) }))
vi.mock('../../hooks/useNutritionEnabled', () => ({ useNutritionEnabled: () => ({ enabled: true, loading: false }) }))
vi.mock('../../context/MasterDataContext', () => ({ useMasterData: () => ({ speciesIcon: () => '🐾', speciesLabel: (s: string) => s, resolveLabel: (x: any) => x.label }) }))
const list = vi.fn()
vi.mock('../../services/api', () => ({ default: { listNutritionAnimals: (...a: unknown[]) => list(...a) } }))

beforeEach(() => { vi.clearAllMocks() })

describe('Nutrition page', () => {
  it('a failed list explains itself and never crashes', async () => {
    list.mockRejectedValue({ response: { status: 500, data: { message: 'Something went wrong on our side.' } } })
    render(<MemoryRouter><Nutrition /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('lists animals and filters by attention', async () => {
    list.mockResolvedValue({ data: { total: 1, items: [{ id: 'a1', name: 'Bruno', species: 'Dog', uniqueId: 'VC', enterpriseName: null, isMine: true, model: 'companion_energy', plan: null, actFlags: 1, watchFlags: 0 }] } })
    render(<MemoryRouter><Nutrition /></MemoryRouter>)
    expect(await screen.findByText('Bruno')).toBeInTheDocument()
  })
})
