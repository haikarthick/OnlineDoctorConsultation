import { sharedClient } from '../core'

export const enterpriseApi = {
  // ─── Enterprise / Farm Management ─────────────────────────
  async createEnterprise(data: { name: string; enterpriseType: string; description?: string; address?: string; city?: string; state?: string; country?: string; postalCode?: string; totalArea?: number; areaUnit?: string; licenseNumber?: string; regulatoryId?: string; taxId?: string; phone?: string; email?: string; website?: string }) {
    const response = await sharedClient.post('/enterprises', data)
    return response.data
  },

  async listEnterprises(params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get('/enterprises', { params })
    return response.data
  },

  async getEnterprise(id: string) {
    const response = await sharedClient.get(`/enterprises/${id}`)
    return response.data
  },

  async updateEnterprise(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/enterprises/${id}`, data)
    return response.data
  },

  async deleteEnterprise(id: string) {
    const response = await sharedClient.delete(`/enterprises/${id}`)
    return response.data
  },

  async getEnterpriseStats(id: string) {
    const response = await sharedClient.get(`/enterprises/${id}/stats`)
    return response.data
  },

  // Enterprise Members
  async listEnterpriseMembers(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/members`)
    return response.data
  },

  async addEnterpriseMember(enterpriseId: string, data: { userId: string; role: string; title?: string }) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/members`, data)
    return response.data
  },

  async inviteEnterpriseMember(enterpriseId: string, data: { email: string; role: string }) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/invite-member`, data)
    return response.data
  },

  async updateEnterpriseMember(enterpriseId: string, userId: string, data: { role: string; title?: string }) {
    const response = await sharedClient.put(`/enterprises/${enterpriseId}/members/${userId}`, data)
    return response.data
  },

  async removeEnterpriseMember(enterpriseId: string, userId: string) {
    const response = await sharedClient.delete(`/enterprises/${enterpriseId}/members/${userId}`)
    return response.data
  },

  // Animal Groups
  async createAnimalGroup(data: { enterpriseId: string; name: string; groupType: string; species?: string; breed?: string; purpose?: string; targetCount?: number; description?: string; colorCode?: string }) {
    const response = await sharedClient.post('/animal-groups', data)
    return response.data
  },

  async getAnimalGroup(id: string) {
    const response = await sharedClient.get(`/animal-groups/${id}`)
    return response.data
  },

  async listAnimalGroups(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/groups`, { params })
    return response.data
  },

  async updateAnimalGroup(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/animal-groups/${id}`, data)
    return response.data
  },

  async deleteAnimalGroup(id: string) {
    const response = await sharedClient.delete(`/animal-groups/${id}`)
    return response.data
  },

  async assignAnimalToGroup(groupId: string, animalId: string) {
    const response = await sharedClient.post(`/animal-groups/${groupId}/assign`, { animalId })
    return response.data
  },

  async removeAnimalFromGroup(groupId: string, animalId: string) {
    const response = await sharedClient.delete(`/animal-groups/${groupId}/animals/${animalId}`)
    return response.data
  },

  // Locations
  async createLocation(data: { enterpriseId: string; name: string; locationType: string; parentLocationId?: string; capacity?: number; area?: number; areaUnit?: string; description?: string }) {
    const response = await sharedClient.post('/locations', data)
    return response.data
  },

  async getLocation(id: string) {
    const response = await sharedClient.get(`/locations/${id}`)
    return response.data
  },

  async listLocations(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/locations`, { params })
    return response.data
  },

  async getLocationTree(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/location-tree`)
    return response.data
  },

  async updateLocation(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/locations/${id}`, data)
    return response.data
  },

  async deleteLocation(id: string) {
    const response = await sharedClient.delete(`/locations/${id}`)
    return response.data
  },

  // Movement Records
  async createMovement(data: { enterpriseId: string; animalId?: string; groupId?: string; fromLocationId?: string; toLocationId?: string; movementType: string; reason?: string; animalCount?: number; transportDate?: string; notes?: string }) {
    const response = await sharedClient.post('/movements', data)
    return response.data
  },

  async listMovements(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/movements`, { params })
    return response.data
  },

  async getMovement(id: string) {
    const response = await sharedClient.get(`/movements/${id}`)
    return response.data
  },

  async approveMovement(id: string, action: 'approve' | 'reject') {
    const response = await sharedClient.patch(`/movements/${id}/approve`, { action })
    return response.data
  },

  // Treatment Campaigns
  async createCampaign(data: { enterpriseId: string; groupId?: string; campaignType: string; name: string; description?: string; productUsed?: string; dosage?: string; targetCount?: number; scheduledDate?: string; cost?: number; notes?: string }) {
    const response = await sharedClient.post('/campaigns', data)
    return response.data
  },

  async getCampaign(id: string) {
    const response = await sharedClient.get(`/campaigns/${id}`)
    return response.data
  },

  async listCampaigns(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/campaigns`, { params })
    return response.data
  },

  async updateCampaign(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/campaigns/${id}`, data)
    return response.data
  },

  async deleteCampaign(id: string) {
    const response = await sharedClient.delete(`/campaigns/${id}`)
    return response.data
  },

  // ═══════════════════════════════════════════════════════════════
  // ─── Health Analytics ─────────────────────────────────

  async getHealthDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/health/dashboard`)
    return response.data
  },

  async listHealthObservations(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/health/observations`, { params })
    return response.data
  },

  async createHealthObservation(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/health/observations`, data)
    return response.data
  },

  async resolveHealthObservation(id: string) {
    const response = await sharedClient.patch(`/health/observations/${id}/resolve`)
    return response.data
  },

  // ─── Enterprise Animals ────────────────────────────────

  async listEnterpriseAnimals(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/animals`, { params })
    return response.data
  },

  // ─── Enterprise / Herd Medical Management ────────────

  async getEnterpriseMedicalRecords(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/medical-records`, { params })
    return response.data
  },

  async getEnterpriseMedicalStats(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/medical-records/stats`)
    return response.data
  },

  async getEnterpriseVaccinations(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/vaccinations`, { params })
    return response.data
  },

  // ─── Breeding & Genetics ─────────────────────────────

  async listBreedingRecords(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/breeding`, { params })
    return response.data
  },

  async createBreedingRecord(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/breeding`, data)
    return response.data
  },

  async updateBreedingRecord(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/breeding/${id}`, data)
    return response.data
  },

  async getUpcomingDueDates(enterpriseId: string, days?: number) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/breeding/upcoming-due`, { params: { days } })
    return response.data
  },

  async getBreedingStats(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/breeding/stats`)
    return response.data
  },

  // ─── Feed & Inventory ─────────────────────────────────

  async listFeeds(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/feed`)
    return response.data
  },

  async createFeed(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/feed`, data)
    return response.data
  },

  async updateFeed(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/feed/${id}`, data)
    return response.data
  },

  async restockFeed(id: string, quantity: number) {
    const response = await sharedClient.post(`/feed/${id}/restock`, { quantity })
    return response.data
  },

  async deleteFeed(id: string) {
    const response = await sharedClient.delete(`/feed/${id}`)
    return response.data
  },

  async logFeedConsumption(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/feed/consumption`, data)
    return response.data
  },

  async listFeedConsumption(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/feed/consumption`, { params })
    return response.data
  },

  async getFeedAnalytics(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/feed/analytics`)
    return response.data
  },

  // ─── Compliance & Regulatory ──────────────────────────

  async listComplianceDocs(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/compliance`, { params })
    return response.data
  },

  async createComplianceDoc(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/compliance`, data)
    return response.data
  },

  async updateComplianceDoc(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/compliance/${id}`, data)
    return response.data
  },

  async verifyComplianceDoc(id: string) {
    const response = await sharedClient.patch(`/compliance/${id}/verify`)
    return response.data
  },

  async deleteComplianceDoc(id: string) {
    const response = await sharedClient.delete(`/compliance/${id}`)
    return response.data
  },

  async getComplianceSummary(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/compliance/summary`)
    return response.data
  },

  // ─── Financial Analytics ──────────────────────────────

  async listFinancialRecords(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/financial`, { params })
    return response.data
  },

  async createFinancialRecord(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/financial`, data)
    return response.data
  },

  async updateFinancialRecord(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/financial/${id}`, data)
    return response.data
  },

  async deleteFinancialRecord(id: string) {
    const response = await sharedClient.delete(`/financial/${id}`)
    return response.data
  },

  async getFinancialDashboard(enterpriseId: string, months?: number) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/financial/dashboard`, { params: { months } })
    return response.data
  },

  // ─── Smart Alerts ─────────────────────────────────────

  async listAlertRules(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/alerts/rules`)
    return response.data
  },

  async createAlertRule(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/alerts/rules`, data)
    return response.data
  },

  async updateAlertRule(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/alerts/rules/${id}`, data)
    return response.data
  },

  async deleteAlertRule(id: string) {
    const response = await sharedClient.delete(`/alerts/rules/${id}`)
    return response.data
  },

  async toggleAlertRule(id: string, isEnabled: boolean) {
    const response = await sharedClient.patch(`/alerts/rules/${id}/toggle`, { isEnabled })
    return response.data
  },

  async listAlertEvents(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/alerts/events`, { params })
    return response.data
  },

  async markAlertRead(id: string) {
    const response = await sharedClient.patch(`/alerts/events/${id}/read`)
    return response.data
  },

  async markAllAlertsRead(enterpriseId: string) {
    const response = await sharedClient.patch(`/enterprises/${enterpriseId}/alerts/events/read-all`)
    return response.data
  },

  async acknowledgeAlert(id: string) {
    const response = await sharedClient.patch(`/alerts/events/${id}/acknowledge`)
    return response.data
  },

  async runAlertChecks(enterpriseId: string) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/alerts/run-checks`)
    return response.data
  },

  // ═══════════════════════════════════════════════════════════════
  // Advanced Innovative Features
  // ═══════════════════════════════════════════════════════════════

}
