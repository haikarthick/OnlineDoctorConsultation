import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NutritionPanel from './NutritionPanel'
import { bcsScaleFor, conditionBand, evenShares, progressPct } from './nutritionShared'

const t = ((key: string, opts?: Record<string, unknown>) => (opts && 'name' in opts ? `${key}:${opts.name}` : key)) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'pet_owner' } }) }))
let enabled = true
vi.mock('../../hooks/useNutritionEnabled', () => ({ useNutritionEnabled: () => ({ enabled, loading: false }) }))
vi.mock('../../context/MasterDataContext', () => ({ useMasterData: () => ({ resolveLabel: (x: any) => x.label }) }))

const overview = vi.fn()
const saveFacts = vi.fn()
const addMeasurement = vi.fn()
const listFeeding = vi.fn()
const logFeeding = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    nutritionOverview: (...a: unknown[]) => overview(...a),
    saveNutritionFacts: (...a: unknown[]) => saveFacts(...a),
    addBodyMeasurement: (...a: unknown[]) => addMeasurement(...a),
    listFeeding: (...a: unknown[]) => listFeeding(...a),
    logFeeding: (...a: unknown[]) => logFeeding(...a),
    listNutritionFoods: vi.fn().mockResolvedValue({ data: { items: [] } }),
    setNutritionFlagStatus: vi.fn(),
  },
}))

const base = {
  animal: { id: 'a1', name: 'Bruno', species: 'Dog', enterpriseId: null },
  model: 'companion_energy',
  calculatorAvailable: true,
  facts: { speciesCode: 'Dog', model: 'companion_energy', dateOfBirth: '2021-01-01', gender: 'male', isNeutered: true, activityLevel: null, housing: null, breedingStatus: null, weightKg: 20, weightRecordedAt: null, bcs9: 7, bcsRecordedAt: null, muscleCondition: null },
  missingFacts: [] as any[],
  canCalculate: true,
  measurements: [],
  plan: {
    id: 'p1', status: 'active', validation: 'suggested', goal: 'lose', targetWeightKg: 17, dailyEnergyKcal: 700, vetOverrideKcal: null, effectiveKcal: 700,
    mealsPerDay: 2, energy: { reasons: [] }, reviewNote: null, createdByName: 'Asha', createdAt: '2026-11-20', reviewedByName: '', reviewedAt: null,
    items: [{ id: 'i1', ingredientId: 'f1', label: 'Kibble', sharePct: 100, gramsPerDay: 200, gramsPerMeal: 100, kcalPerDay: 700, kcalPer100g: 350 }],
  },
  feeding: { today: { mealKcal: 0, treatKcal: 0, entries: 0 }, last7: { mealKcal: 0, treatKcal: 0, days: 0 } },
  flags: [{ id: 'fl1', type: 'bcs_high', severity: 'watch', params: { bcs9: 7 } }],
  unsafeFoods: [],
  permissions: { canWrite: true, canReview: false, via: 'owner' },
}

beforeEach(() => {
  vi.clearAllMocks()
  enabled = true
  overview.mockResolvedValue({ data: base })
  listFeeding.mockResolvedValue({ data: { items: [] } })
  logFeeding.mockResolvedValue({ data: { label: 'Kibble', warnings: [] } })
})

describe('NutritionPanel', () => {
  it('renders nothing while the module is switched off (an addition to other screens, never an error)', () => {
    enabled = false
    const { container } = render(<NutritionPanel animalId="a1" />)
    expect(container).toBeEmptyDOMElement()
    expect(overview).not.toHaveBeenCalled()
  })

  it('shows the plan target, the open alert and a one-tap "fed as planned" that records the planned portion', async () => {
    render(<NutritionPanel animalId="a1" />)
    expect(await screen.findByText('nutrition.titleFor:Bruno')).toBeInTheDocument()
    expect(screen.getByText('nutrition.flags.bcs_high.title')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/nutrition.today.fedPortion/))
    await waitFor(() => expect(logFeeding).toHaveBeenCalledWith('a1', expect.objectContaining({ planItemId: 'i1', kind: 'meal', amountG: 100 })))
  })

  it('compact mode starts as a summary and expands in place', async () => {
    render(<NutritionPanel animalId="a1" compact />)
    fireEvent.click(await screen.findByText('nutrition.show'))
    expect(screen.getByText('nutrition.titleFor:Bruno')).toBeInTheDocument()
  })

  it('asks for a missing required fact and saves it through the owning module', async () => {
    overview.mockResolvedValue({ data: { ...base, plan: null, canCalculate: false, missingFacts: [{ key: 'isNeutered', owner: 'animal_profile', required: true }] } })
    saveFacts.mockResolvedValue({ data: base })
    render(<NutritionPanel animalId="a1" />)
    expect(await screen.findByText('nutrition.facts.titleRequired')).toBeInTheDocument()
    const save = screen.getByText('nutrition.facts.save')
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByText('nutrition.options.no'))
    fireEvent.click(save)
    await waitFor(() => expect(saveFacts).toHaveBeenCalledWith('a1', { isNeutered: false }))
    expect(addMeasurement).not.toHaveBeenCalled()
  })

  it('a refused compact panel stays silent; a refused full panel explains itself', async () => {
    overview.mockRejectedValue({ response: { status: 403, data: { message: 'Only the owner can see this.' } } })
    const { container, unmount } = render(<NutritionPanel animalId="a1" compact />)
    await waitFor(() => expect(overview).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    unmount()
    render(<NutritionPanel animalId="a1" />)
    expect(await screen.findByText('Only the owner can see this.')).toBeInTheDocument()
  })
})

describe('nutritionShared helpers', () => {
  it('bands and scales match the server engine', () => {
    expect(conditionBand(5)).toBe('ideal')
    expect(conditionBand(3)).toBe('thin')
    expect(conditionBand(8)).toBe('obese')
    expect(conditionBand(null)).toBeNull()
    expect(bcsScaleFor('companion_energy')).toBe(9)
    expect(bcsScaleFor('ruminant_dm')).toBe(5)
  })

  it('even shares always add up to 100 and progress is capped', () => {
    expect(evenShares(3)).toEqual([33, 33, 34])
    expect(evenShares(3).reduce((a, b) => a + b, 0)).toBe(100)
    expect(progressPct(900, 700)).toBe(100)
    expect(progressPct(350, 700)).toBe(50)
    expect(progressPct(10, null)).toBe(0)
  })
})
