import { sharedClient } from '../core'

// Animal nutrition - backend routes/nutrition.routes.ts (docs/NUTRITION_PLAN.md, migration 056).
export interface NutritionFoodChoice { ingredientId?: string | null; label?: string | null; kcalPer100g?: number | null; sharePct: number }
export interface NutritionPlanPayload {
  goal?: string | null; targetWeightKg?: number | null; mealsPerDay?: number; foods: NutritionFoodChoice[]
  markReviewed?: boolean; reviewNote?: string | null
}

export interface RationPayload {
  milkLitresPerDay?: number | null; milkFatPct?: number | null
  /** Horses / donkeys: work level. Herds: average weight when none is recorded. */
  work?: 'low' | 'moderate' | 'high' | 'working' | null; avgWeightKg?: number | null
  feeds: Array<{ ingredientId: string; pricePerKg?: number | null; minKg?: number | null; maxKg?: number | null }>
}

export const nutritionApi = {
  /** Whether the module is switched on (nutrition.enabled). Needs a signed-in user. */
  async nutritionStatus() {
    const response = await sharedClient.get('/nutrition/enabled')
    return response.data
  },
  /** Counts for the dashboard card: animals needing attention, plans waiting for a vet, animals with no plan, feed cost today. */
  async nutritionSummary() {
    const response = await sharedClient.get('/nutrition/summary')
    return response.data
  },
  async listNutritionAnimals(params: { search?: string; filter?: 'attention' | 'no_plan' | 'to_review'; limit?: number; offset?: number } = {}) {
    const response = await sharedClient.get('/nutrition/animals', { params })
    return response.data
  },
  async nutritionOverview(animalId: string) {
    const response = await sharedClient.get(`/nutrition/animals/${animalId}`)
    return response.data
  },
  /** Saves profile facts THROUGH the animal module (date of birth, sex, neutered, activity, housing). */
  async saveNutritionFacts(animalId: string, facts: Record<string, unknown>) {
    const response = await sharedClient.patch(`/nutrition/animals/${animalId}/facts`, facts)
    return response.data
  },
  /** Weight / body condition / muscle condition - goes into the one body-measurement history. */
  async addBodyMeasurement(animalId: string, data: {
    weight?: number | null; unit?: string; bodyConditionScore?: number | null; bcsScale?: 5 | 9 | null
    muscleCondition?: string | null; notes?: string | null
  }) {
    const response = await sharedClient.post(`/nutrition/animals/${animalId}/measurements`, data)
    return response.data
  },
  async previewNutritionPlan(animalId: string, data: NutritionPlanPayload) {
    const response = await sharedClient.post(`/nutrition/animals/${animalId}/plan/preview`, data)
    return response.data
  },
  async saveNutritionPlan(animalId: string, data: NutritionPlanPayload) {
    const response = await sharedClient.post(`/nutrition/animals/${animalId}/plan`, data)
    return response.data
  },
  /** Least-cost ration for a cow, buffalo, goat or sheep from the feeds the farmer has (migration 057). */
  async previewRation(animalId: string, data: RationPayload) {
    const response = await sharedClient.post(`/nutrition/animals/${animalId}/ration/preview`, data)
    return response.data
  },
  async saveRation(animalId: string, data: RationPayload) {
    const response = await sharedClient.post(`/nutrition/animals/${animalId}/ration`, data)
    return response.data
  },
  /** A herd's ration (cattle, buffalo, goats, sheep, horses - one solve for the whole group, migration 060). */
  async groupRation(groupId: string) {
    const response = await sharedClient.get(`/nutrition/groups/${groupId}/ration`)
    return response.data
  },
  async previewGroupRation(groupId: string, data: RationPayload) {
    const response = await sharedClient.post(`/nutrition/groups/${groupId}/ration/preview`, data)
    return response.data
  },
  async saveGroupRation(groupId: string, data: RationPayload) {
    const response = await sharedClient.post(`/nutrition/groups/${groupId}/ration`, data)
    return response.data
  },
  /** Today's feed for a flock / pig batch / pond and the cycle's FCR (migration 059). */
  async groupFeeding(groupId: string) {
    const response = await sharedClient.get(`/nutrition/groups/${groupId}/feeding`)
    return response.data
  },
  async nutritionAdminCurves() {
    const response = await sharedClient.get('/nutrition/admin/curves')
    return response.data
  },
  async nutritionAdminSaveCurve(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/nutrition/admin/curves/${id}`, data)
    return response.data
  },
  async nutritionAdminApprovePending() {
    const response = await sharedClient.post('/nutrition/admin/approve-pending')
    return response.data
  },
  async reviewNutritionPlan(planId: string, data: { overrideKcal?: number | null; note?: string | null }) {
    const response = await sharedClient.post(`/nutrition/plans/${planId}/review`, data)
    return response.data
  },
  /** A vet prescribes a plan or ration as a diet - it becomes an ordinary prescription (migration 061). */
  async prescribeNutritionPlan(planId: string, data: { consultationId?: string | null; durationDays?: number | null; note?: string | null }) {
    const response = await sharedClient.post(`/nutrition/plans/${planId}/prescribe`, data)
    return response.data
  },
  /** Plain-language explanation of a plan (AI, animal facts only, numbers checked; source 'ai' or none). */
  async explainNutritionPlan(planId: string, language: string) {
    const response = await sharedClient.post(`/nutrition/plans/${planId}/explain`, { language })
    return response.data
  },
  async listFeeding(animalId: string, days = 7) {
    const response = await sharedClient.get(`/nutrition/animals/${animalId}/feeding`, { params: { days } })
    return response.data
  },
  async logFeeding(animalId: string, data: {
    planItemId?: string | null; ingredientId?: string | null; label?: string | null; kind?: 'meal' | 'treat'
    amountG?: number | null; kcal?: number | null; fedOn?: string | null
  }) {
    const response = await sharedClient.post(`/nutrition/animals/${animalId}/feeding`, data)
    return response.data
  },
  async deleteFeeding(id: string) {
    const response = await sharedClient.delete(`/nutrition/feeding/${id}`)
    return response.data
  },
  async listNutritionFoods(params: { animalId?: string; groupId?: string; search?: string; kind?: string } = {}) {
    const response = await sharedClient.get('/nutrition/foods', { params })
    return response.data
  },
  async createNutritionFood(data: { animalId?: string | null; label: string; kcalPer100g?: number | null; kind?: string }) {
    const response = await sharedClient.post('/nutrition/foods', data)
    return response.data
  },
  async setNutritionFlagStatus(id: string, status: 'reviewed' | 'dismissed') {
    const response = await sharedClient.patch(`/nutrition/flags/${id}`, { status })
    return response.data
  },

  // ─── Admin master data ───
  async nutritionAdminList(kind: 'species' | 'energy-factors' | 'unsafe-foods' | 'requirement-sets') {
    const response = await sharedClient.get(`/nutrition/admin/${kind}`)
    return response.data
  },
  async nutritionAdminFoods(params: { search?: string; kind?: string; limit?: number; offset?: number } = {}) {
    const response = await sharedClient.get('/nutrition/admin/foods', { params })
    return response.data
  },
  async nutritionAdminRequirementSet(id: string) {
    const response = await sharedClient.get(`/nutrition/admin/requirement-sets/${id}`)
    return response.data
  },
  async nutritionAdminSetSpeciesModel(code: string, nutritionModel: string) {
    const response = await sharedClient.put(`/nutrition/admin/species/${encodeURIComponent(code)}`, { nutritionModel })
    return response.data
  },
  async nutritionAdminSave(kind: 'energy-factors' | 'foods' | 'unsafe-foods' | 'requirement-sets', id: string | null, data: Record<string, unknown>) {
    const response = id
      ? await sharedClient.put(`/nutrition/admin/${kind}/${id}`, data)
      : await sharedClient.post(`/nutrition/admin/${kind}`, data)
    return response.data
  },
  async nutritionAdminUsage(days = 30) {
    const response = await sharedClient.get('/nutrition/admin/usage', { params: { days } })
    return response.data
  },
}
