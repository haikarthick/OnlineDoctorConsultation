import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlanVetActions from './PlanVetActions'
import FlagList from './FlagList'
import type { NutritionPlan } from './nutritionShared'

const t = ((key: string) => key) as any
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'hi', exists: () => false } }) }))

const explain = vi.fn()
const prescribe = vi.fn()
const setFlag = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    explainNutritionPlan: (...a: unknown[]) => explain(...a),
    prescribeNutritionPlan: (...a: unknown[]) => prescribe(...a),
    reviewNutritionPlan: vi.fn(),
    setNutritionFlagStatus: (...a: unknown[]) => setFlag(...a),
  },
}))

const plan: NutritionPlan = {
  id: 'p1', status: 'active', validation: 'suggested', goal: 'maintain', targetWeightKg: null, dailyEnergyKcal: 700, vetOverrideKcal: null,
  effectiveKcal: 700, mealsPerDay: 2, energy: null, reviewNote: null, createdByName: 'A', createdAt: '2026-11-20', reviewedByName: '', reviewedAt: null,
  requiresVet: true, allergies: ['Chicken'], prescriptionId: null,
  items: [{ id: 'i1', ingredientId: null, label: 'Kibble', sharePct: 100, gramsPerDay: 200, gramsPerMeal: 100, kcalPerDay: 700, kcalPer100g: 350 }],
}

beforeEach(() => { vi.clearAllMocks() })

describe('plan actions (Phase 3 + AI explain)', () => {
  it('an owner sees share and explain, but not review or prescribe; allergies and "ask a vet" are shown', () => {
    render(<PlanVetActions plan={plan} name="Bruno" canReview={false} onChanged={vi.fn()} />)
    expect(screen.getByText('nutrition.share.button')).toBeTruthy()
    expect(screen.getByText('nutrition.explain.button')).toBeTruthy()
    expect(screen.queryByText('nutrition.vet.prescribe')).toBeNull()
    expect(screen.queryByText('nutrition.plan.review')).toBeNull()
    expect(screen.getByText('nutrition.plan.requiresVet')).toBeTruthy()
    expect(screen.getByText('nutrition.vet.allergies')).toBeTruthy()
  })

  it('a vet sees review and prescribe; a prescribed plan offers no second prescription', () => {
    const { rerender } = render(<PlanVetActions plan={plan} name="Bruno" canReview onChanged={vi.fn()} />)
    expect(screen.getByText('nutrition.vet.prescribe')).toBeTruthy()
    expect(screen.getByText('nutrition.plan.review')).toBeTruthy()
    rerender(<PlanVetActions plan={{ ...plan, prescriptionId: 'rx1', validation: 'vet_reviewed' }} name="Bruno" canReview onChanged={vi.fn()} />)
    expect(screen.queryByText('nutrition.vet.prescribe')).toBeNull()
    expect(screen.getByText('nutrition.vet.prescribed')).toBeTruthy()
  })

  it('explain shows the AI text when the server checked it, in the reader\'s language', async () => {
    explain.mockResolvedValue({ data: { source: 'ai', text: 'रोज़ 700 kcal' } })
    render(<PlanVetActions plan={plan} name="Bruno" canReview={false} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByText('nutrition.explain.button'))
    await waitFor(() => expect(screen.getByText('रोज़ 700 kcal')).toBeTruthy())
    expect(explain).toHaveBeenCalledWith('p1', 'hi')
    expect(screen.getByText('nutrition.explain.aiNote')).toBeTruthy()
  })

  it('explain falls back to the built-in summary when AI is off, busy or rejected - never an error', async () => {
    explain.mockResolvedValueOnce({ data: { source: 'unavailable', text: null } })
    render(<PlanVetActions plan={plan} name="Bruno" canReview={false} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByText('nutrition.explain.button'))
    await waitFor(() => expect(screen.getByText('nutrition.explain.builtInNote')).toBeTruthy())
    expect(screen.getByText(/nutrition\.explain\.fallbackPet/)).toBeTruthy()
  })

  it('explain falls back when the request itself fails', async () => {
    explain.mockRejectedValueOnce(new Error('network'))
    render(<PlanVetActions plan={plan} name="Bruno" canReview={false} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByText('nutrition.explain.button'))
    await waitFor(() => expect(screen.getByText('nutrition.explain.builtInNote')).toBeTruthy())
  })
})

describe('alerts: Seen / Not right are kept as answers', () => {
  it('"Not right" sends dismissed', async () => {
    setFlag.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<FlagList flags={[{ id: 'f1', type: 'feed_below_need', severity: 'watch', params: { pct: 70, days: 5 } }]} canAct onChanged={onChanged} />)
    fireEvent.click(screen.getByText('nutrition.flags.notRight'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(setFlag).toHaveBeenCalledWith('f1', 'dismissed')
  })

  it('renders nothing when there are no alerts', () => {
    const { container } = render(<FlagList flags={[]} canAct onChanged={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
