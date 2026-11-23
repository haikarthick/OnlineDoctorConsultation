/**
 * Types and pure helpers for the nutrition screens (docs/NUTRITION_PLAN.md). Every number shown comes from the
 * server's engine; these helpers only format and classify, so the same rule never lives in two places.
 */
export type NutritionModel = 'companion_energy' | 'ruminant_dm' | 'monogastric_spec' | 'aqua_biomass' | 'equine_dm' | 'guidance_only'

export interface NutritionFacts {
  speciesCode: string
  model: NutritionModel
  dateOfBirth: string | null
  gender: string | null
  isNeutered: boolean | null
  activityLevel: string | null
  housing: string | null
  breedingStatus: string | null
  avgDailyMilkLitres?: number | null
  weightKg: number | null
  weightRecordedAt: string | null
  bcs9: number | null
  bcsRecordedAt: string | null
  muscleCondition: string | null
}

export interface MissingFact { key: 'weight' | 'dateOfBirth' | 'gender' | 'isNeutered' | 'activityLevel' | 'housing' | 'bodyCondition'; owner: string; required: boolean }

export interface Measurement {
  id: string
  weight: number | null
  unit: string
  weightKg: number | null
  bodyConditionScore: number | null
  bcsScale: number | null
  bcs9: number | null
  muscleCondition: string | null
  source: string
  recordedAt: string
  recordedByName: string
}

export interface PlanItem {
  id: string
  ingredientId: string | null
  label: string
  sharePct: number | null
  /** 'g' for a pet plan, 'kg' (as fed, per day) for a farm ration. */
  unit?: 'g' | 'kg'
  amountPerDay?: number | null
  costPerDay?: number | null
  gramsPerDay: number | null
  gramsPerMeal: number | null
  kcalPerDay: number | null
  kcalPer100g: number | null
}

export interface NutritionPlan {
  id: string
  status: string
  validation: 'suggested' | 'vet_reviewed'
  goal: string
  targetWeightKg: number | null
  dailyEnergyKcal: number | null
  vetOverrideKcal: number | null
  effectiveKcal: number | null
  mealsPerDay: number
  energy: { reasons?: string[]; requiresVet?: boolean; factorSource?: string; idealWeightKg?: number | null; suggestedGoal?: string } | null
  reviewNote: string | null
  /** A vet should look before the plan is followed (energy rules, or a recorded allergy). */
  requiresVet?: boolean
  /** Active allergies from the medical record at the time the plan was made. */
  allergies?: string[]
  /** Set once a vet prescribed this plan as a diet (an ordinary prescription). */
  prescriptionId?: string | null
  dailyDmKg?: number | null
  ration?: {
    /** Ruminants: nelMcal. Horses / donkeys: deMcal, cpMinG. */
    need: { nelMcal?: number; deMcal?: number; cpMinG?: number; dmiMinKg: number; dmiMaxKg: number } | null
    supplied: { dmKg: number; nelMcal?: number; deMcal?: number; concentratePct?: number } | null
    state: 'lactating' | 'dry' | 'maintenance' | null
    totalCostPerDay: number | null
    costPerLitre: number | null
    milkLitresPerDay: number | null
    work?: string | null
    weightKg?: number | null
    /** Herd rations: the per-head plan times the head count. */
    herd?: { headCount: number; totalCostPerDay: number; lines: Array<{ key: string; label: string; kgAsFedPerDay: number; costPerDay: number }> } | null
  } | null
  model?: NutritionModel
  groupId?: string | null
  createdByName: string
  createdAt: string
  reviewedByName: string
  reviewedAt: string | null
  items: PlanItem[]
}

export interface RiskFlag { id: string; type: string; severity: 'info' | 'watch' | 'act'; params: Record<string, string | number> }

export interface UnsafeFood {
  id: string; code: string; label: string; labelKey: string | null
  labelHi?: string | null; labelKn?: string | null; labelMl?: string | null; labelTa?: string | null; labelTe?: string | null
  severity: 'caution' | 'danger'; source: string; status: string
}

export interface NutritionOverview {
  animal: { id: string; name: string; species: string; enterpriseId: string | null }
  model: NutritionModel
  calculatorAvailable: boolean
  facts: NutritionFacts
  missingFacts: MissingFact[]
  canCalculate: boolean
  measurements: Measurement[]
  plan: NutritionPlan | null
  feeding: { today: { mealKcal: number; treatKcal: number; entries: number }; last7: { mealKcal: number; treatKcal: number; days: number } }
  flags: RiskFlag[]
  unsafeFoods: UnsafeFood[]
  permissions: { canWrite: boolean; canReview: boolean; via: 'admin' | 'owner' | 'farm' | 'vet' }
}

export interface Food {
  id: string; code: string | null; label: string; labelKey: string | null
  labelHi?: string | null; labelKn?: string | null; labelMl?: string | null; labelTa?: string | null; labelTe?: string | null
  kind: string; kcalPer100g: number | null; isOwn: boolean; status: string
  /** The farm's price per kg for this feed, from its stock (Feed Inventory); null when the feed is not in stock. */
  stockPricePerKg?: number | null
}

/** The scale a body condition score is entered on for this animal: dogs and cats 1-9, farm species 1-5. */
export const bcsScaleFor = (model: NutritionModel): 5 | 9 => (model === 'companion_energy' || model === 'guidance_only' ? 9 : 5)

export type ConditionBand = 'very_thin' | 'thin' | 'ideal' | 'overweight' | 'obese'

/** Same bands as the server engine (engine/condition.ts): outside 4-5 on the 9-point scale is a risk. */
export function conditionBand(bcs9: number | null): ConditionBand | null {
  if (bcs9 === null || !Number.isFinite(bcs9)) return null
  if (bcs9 <= 2) return 'very_thin'
  if (bcs9 < 4) return 'thin'
  if (bcs9 <= 5) return 'ideal'
  if (bcs9 < 8) return 'overweight'
  return 'obese'
}

/** 0-100 for a progress bar; 100 when over target (the label says by how much). */
export function progressPct(eaten: number, target: number | null): number {
  if (!target || target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((eaten / target) * 100)))
}

/** Whole number with a thousands separator in the reader's locale. */
export function formatKcal(n: number | null | undefined, locale?: string): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-'
  return Math.round(n).toLocaleString(locale)
}

/** A feed amount a farmer reads at a glance: grams under 1 kg ("50 g" of mineral mixture, never "0 kg"), else kg. */
export function formatAmount(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '-'
  return kg < 1 ? `${Math.round(kg * 1000)} g` : `${Math.round(kg * 10) / 10} kg`
}

export function formatKg(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-'
  return String(Math.round(n * 100) / 100)
}

/** Shares that add up to 100 for N foods (the last one takes the rounding remainder). */
export function evenShares(count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(100 / count)
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? 100 - base * (count - 1) : base))
}

export const FLAG_ICON: Record<RiskFlag['severity'], string> = { act: '⚠️', watch: '👀', info: 'ℹ️' }
