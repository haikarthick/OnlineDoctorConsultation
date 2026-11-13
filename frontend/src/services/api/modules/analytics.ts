import { sharedClient } from '../core'

export const analyticsApi = {
  // ─── AI Disease Prediction ───────────────────────────────────

  async getRiskDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/disease-predictions/dashboard`)
    return response.data
  },

  async listPredictions(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/disease-predictions`, { params })
    return response.data
  },

  async createPrediction(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/disease-predictions`, data)
    return response.data
  },

  async resolvePrediction(id: string, outcome: string) {
    const response = await sharedClient.patch(`/disease-predictions/${id}/resolve`, { outcome })
    return response.data
  },

  async listOutbreakZones(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/outbreak-zones`)
    return response.data
  },

  async createOutbreakZone(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/outbreak-zones`, data)
    return response.data
  },

  async resolveOutbreakZone(id: string) {
    const response = await sharedClient.patch(`/outbreak-zones/${id}/resolve`)
    return response.data
  },

  // ─── Genomic Lineage ────────────────────────────────────────

  async listGeneticProfiles(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/genetic-profiles`, { params })
    return response.data
  },

  async createGeneticProfile(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/genetic-profiles`, data)
    return response.data
  },

  async updateGeneticProfile(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/genetic-profiles/${id}`, data)
    return response.data
  },

  async getLineageTree(animalId: string, depth?: number) {
    const response = await sharedClient.get(`/genetic-profiles/${animalId}/lineage-tree`, { params: { depth } })
    return response.data
  },

  async listLineagePairs(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/lineage-pairs`)
    return response.data
  },

  async createLineagePair(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/lineage-pairs`, data)
    return response.data
  },

  async getGeneticDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/genetic-dashboard`)
    return response.data
  },

  // ─── IoT Sensors ────────────────────────────────────────────

  async getSensorDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/iot/dashboard`)
    return response.data
  },

  async listSensors(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/iot/sensors`, { params })
    return response.data
  },

  async createSensor(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/iot/sensors`, data)
    return response.data
  },

  async updateSensor(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/iot/sensors/${id}`, data)
    return response.data
  },

  async deleteSensor(id: string) {
    const response = await sharedClient.delete(`/iot/sensors/${id}`)
    return response.data
  },

  async recordSensorReading(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/iot/readings`, data)
    return response.data
  },

  async listSensorReadings(sensorId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/iot/sensors/${sensorId}/readings`, { params })
    return response.data
  },

  // ─── Supply Chain & Traceability ─────────────────────────────

  async getSupplyChainDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/supply-chain/dashboard`)
    return response.data
  },

  async listBatches(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/supply-chain/batches`, { params })
    return response.data
  },

  async createBatch(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/supply-chain/batches`, data)
    return response.data
  },

  async updateBatch(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/supply-chain/batches/${id}`, data)
    return response.data
  },

  async listTraceabilityEvents(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/supply-chain/events`, { params })
    return response.data
  },

  async createTraceabilityEvent(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/supply-chain/events`, data)
    return response.data
  },

  async verifyTraceabilityEvent(id: string) {
    const response = await sharedClient.patch(`/supply-chain/events/${id}/verify`)
    return response.data
  },

  async getBatchTraceability(batchId: string) {
    const response = await sharedClient.get(`/supply-chain/batches/${batchId}/traceability`)
    return response.data
  },

  async generateQRCode(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/supply-chain/qr-codes`, data)
    return response.data
  },

  async listQRCodes(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/supply-chain/qr-codes`)
    return response.data
  },

  // ─── Workforce & Tasks ──────────────────────────────────────

  async getWorkforceDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/workforce/dashboard`)
    return response.data
  },

  async listWorkforceTasks(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/workforce/tasks`, { params })
    return response.data
  },

  async createWorkforceTask(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/workforce/tasks`, data)
    return response.data
  },

  async updateWorkforceTask(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/workforce/tasks/${id}`, data)
    return response.data
  },

  async deleteWorkforceTask(id: string) {
    const response = await sharedClient.delete(`/workforce/tasks/${id}`)
    return response.data
  },

  async listShifts(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/workforce/shifts`, { params })
    return response.data
  },

  async createShift(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/workforce/shifts`, data)
    return response.data
  },

  async updateShift(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/workforce/shifts/${id}`, data)
    return response.data
  },

  async checkInShift(id: string) {
    const response = await sharedClient.patch(`/workforce/shifts/${id}/check-in`)
    return response.data
  },

  async checkOutShift(id: string) {
    const response = await sharedClient.patch(`/workforce/shifts/${id}/check-out`)
    return response.data
  },

  async deleteShift(id: string) {
    const response = await sharedClient.delete(`/workforce/shifts/${id}`)
    return response.data
  },

  // ─── Report Builder ─────────────────────────────────────────

  async listReportTemplates(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/reports/templates`)
    return response.data
  },

  async createReportTemplate(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/reports/templates`, data)
    return response.data
  },

  async updateReportTemplate(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/reports/templates/${id}`, data)
    return response.data
  },

  async deleteReportTemplate(id: string) {
    const response = await sharedClient.delete(`/reports/templates/${id}`)
    return response.data
  },

  async generateReport(enterpriseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/reports/generate`, data)
    return response.data
  },

  async listGeneratedReports(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/reports/generated`, { params })
    return response.data
  },

  async getReport(id: string) {
    const response = await sharedClient.get(`/reports/${id}`)
    return response.data
  },

  async deleteReport(id: string) {
    const response = await sharedClient.delete(`/reports/${id}`)
    return response.data
  }

}
