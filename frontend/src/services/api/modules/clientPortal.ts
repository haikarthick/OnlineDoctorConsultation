import { sharedClient } from '../core'

export const clientPortalApi = {
  // ─── Sustainability & Carbon ────────────────────────────────
  async getSustainabilityDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/sustainability/dashboard`)
    return response.data
  },

  async listSustainabilityMetrics(enterpriseId: string, filters: any = {}) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/sustainability/metrics`, { params: filters })
    return response.data
  },

  async createSustainabilityMetric(enterpriseId: string, data: any) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/sustainability/metrics`, data)
    return response.data
  },

  async updateSustainabilityMetric(id: string, data: any) {
    const response = await sharedClient.put(`/sustainability/metrics/${id}`, data)
    return response.data
  },

  async deleteSustainabilityMetric(id: string) {
    const response = await sharedClient.delete(`/sustainability/metrics/${id}`)
    return response.data
  },

  async listSustainabilityGoals(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/sustainability/goals`)
    return response.data
  },

  async createSustainabilityGoal(enterpriseId: string, data: any) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/sustainability/goals`, data)
    return response.data
  },

  async updateSustainabilityGoal(id: string, data: any) {
    const response = await sharedClient.put(`/sustainability/goals/${id}`, data)
    return response.data
  },

  async deleteSustainabilityGoal(id: string) {
    const response = await sharedClient.delete(`/sustainability/goals/${id}`)
    return response.data
  },

  async getCarbonFootprint(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/sustainability/carbon-footprint`)
    return response.data
  },

  // ─── Client Portal & Wellness ───────────────────────────────
  async getWellnessDashboard() {
    const response = await sharedClient.get('/wellness/dashboard')
    return response.data
  },

  async listWellnessScorecards(filters: any = {}) {
    const response = await sharedClient.get('/wellness/scorecards', { params: filters })
    return response.data
  },

  async createWellnessScorecard(data: any) {
    const response = await sharedClient.post('/wellness/scorecards', data)
    return response.data
  },

  async updateWellnessScorecard(id: string, data: any) {
    const response = await sharedClient.put(`/wellness/scorecards/${id}`, data)
    return response.data
  },

  async deleteWellnessScorecard(id: string) {
    const response = await sharedClient.delete(`/wellness/scorecards/${id}`)
    return response.data
  },

  async listWellnessReminders(filters: any = {}) {
    const response = await sharedClient.get('/wellness/reminders', { params: filters })
    return response.data
  },

  async createWellnessReminder(data: any) {
    const response = await sharedClient.post('/wellness/reminders', data)
    return response.data
  },

  async completeReminder(id: string) {
    const response = await sharedClient.patch(`/wellness/reminders/${id}/complete`)
    return response.data
  },

  async snoozeReminder(id: string, until: string) {
    const response = await sharedClient.patch(`/wellness/reminders/${id}/snooze`, { until })
    return response.data
  },

  async deleteReminder(id: string) {
    const response = await sharedClient.delete(`/wellness/reminders/${id}`)
    return response.data
  },

  // ─── Geospatial Analytics ───────────────────────────────────
  async getGeospatialDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/geospatial/dashboard`)
    return response.data
  },

  async listGeofenceZones(enterpriseId: string, filters: any = {}) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/geospatial/zones`, { params: filters })
    return response.data
  },

  async createGeofenceZone(enterpriseId: string, data: any) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/geospatial/zones`, data)
    return response.data
  },

  async updateGeofenceZone(id: string, data: any) {
    const response = await sharedClient.put(`/geospatial/zones/${id}`, data)
    return response.data
  },

  async deleteGeofenceZone(id: string) {
    const response = await sharedClient.delete(`/geospatial/zones/${id}`)
    return response.data
  },

  async listGeospatialEvents(enterpriseId: string, filters: any = {}) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/geospatial/events`, { params: filters })
    return response.data
  },

  async createGeospatialEvent(enterpriseId: string, data: any) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/geospatial/events`, data)
    return response.data
  },

  async getHeatmapData(enterpriseId: string, filters: any = {}) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/geospatial/heatmap`, { params: filters })
    return response.data
  },

  async getMovementTrail(animalId: string, filters: any = {}) {
    const response = await sharedClient.get(`/geospatial/animals/${animalId}/trail`, { params: filters })
    return response.data
  }

}
