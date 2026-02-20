import { client } from './client'

// ─── AI Disease Prediction ────────────────────────────────────
export async function getRiskDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/disease-predictions/dashboard`)
  return response.data
}

export async function listPredictions(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/disease-predictions`, { params })
  return response.data
}

export async function createPrediction(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/disease-predictions`, data)
  return response.data
}

export async function resolvePrediction(id: string, outcome: string) {
  const response = await client.patch(`/disease-predictions/${id}/resolve`, { outcome })
  return response.data
}

export async function listOutbreakZones(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/outbreak-zones`)
  return response.data
}

export async function createOutbreakZone(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/outbreak-zones`, data)
  return response.data
}

export async function resolveOutbreakZone(id: string) {
  const response = await client.patch(`/outbreak-zones/${id}/resolve`)
  return response.data
}

// ─── Genomic Lineage ──────────────────────────────────────────
export async function listGeneticProfiles(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/genetic-profiles`, { params })
  return response.data
}

export async function createGeneticProfile(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/genetic-profiles`, data)
  return response.data
}

export async function updateGeneticProfile(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/genetic-profiles/${id}`, data)
  return response.data
}

export async function getLineageTree(animalId: string, depth?: number) {
  const response = await client.get(`/genetic-profiles/${animalId}/lineage-tree`, { params: { depth } })
  return response.data
}

export async function listLineagePairs(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/lineage-pairs`)
  return response.data
}

export async function createLineagePair(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/lineage-pairs`, data)
  return response.data
}

export async function getGeneticDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/genetic-dashboard`)
  return response.data
}

// ─── IoT Sensors ──────────────────────────────────────────────
export async function getSensorDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/iot/dashboard`)
  return response.data
}

export async function listSensors(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/iot/sensors`, { params })
  return response.data
}

export async function createSensor(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/iot/sensors`, data)
  return response.data
}

export async function updateSensor(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/iot/sensors/${id}`, data)
  return response.data
}

export async function deleteSensor(id: string) {
  const response = await client.delete(`/iot/sensors/${id}`)
  return response.data
}

export async function recordSensorReading(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/iot/readings`, data)
  return response.data
}

export async function listSensorReadings(sensorId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/iot/sensors/${sensorId}/readings`, { params })
  return response.data
}

// ─── Supply Chain & Traceability ──────────────────────────────
export async function getSupplyChainDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/supply-chain/dashboard`)
  return response.data
}

export async function listBatches(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/supply-chain/batches`, { params })
  return response.data
}

export async function createBatch(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/supply-chain/batches`, data)
  return response.data
}

export async function updateBatch(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/supply-chain/batches/${id}`, data)
  return response.data
}

export async function listTraceabilityEvents(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/supply-chain/events`, { params })
  return response.data
}

export async function createTraceabilityEvent(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/supply-chain/events`, data)
  return response.data
}

export async function verifyTraceabilityEvent(id: string) {
  const response = await client.patch(`/supply-chain/events/${id}/verify`)
  return response.data
}

export async function getBatchTraceability(batchId: string) {
  const response = await client.get(`/supply-chain/batches/${batchId}/traceability`)
  return response.data
}

export async function generateQRCode(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/supply-chain/qr-codes`, data)
  return response.data
}

export async function listQRCodes(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/supply-chain/qr-codes`)
  return response.data
}

// ─── Workforce & Tasks ────────────────────────────────────────
export async function getWorkforceDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/workforce/dashboard`)
  return response.data
}

export async function listWorkforceTasks(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/workforce/tasks`, { params })
  return response.data
}

export async function createWorkforceTask(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/workforce/tasks`, data)
  return response.data
}

export async function updateWorkforceTask(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/workforce/tasks/${id}`, data)
  return response.data
}

export async function deleteWorkforceTask(id: string) {
  const response = await client.delete(`/workforce/tasks/${id}`)
  return response.data
}

export async function listShifts(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/workforce/shifts`, { params })
  return response.data
}

export async function createShift(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/workforce/shifts`, data)
  return response.data
}

export async function updateShift(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/workforce/shifts/${id}`, data)
  return response.data
}

export async function checkInShift(id: string) {
  const response = await client.patch(`/workforce/shifts/${id}/check-in`)
  return response.data
}

export async function checkOutShift(id: string) {
  const response = await client.patch(`/workforce/shifts/${id}/check-out`)
  return response.data
}

export async function deleteShift(id: string) {
  const response = await client.delete(`/workforce/shifts/${id}`)
  return response.data
}

// ─── Report Builder ───────────────────────────────────────────
export async function listReportTemplates(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/reports/templates`)
  return response.data
}

export async function createReportTemplate(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/reports/templates`, data)
  return response.data
}

export async function updateReportTemplate(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/reports/templates/${id}`, data)
  return response.data
}

export async function deleteReportTemplate(id: string) {
  const response = await client.delete(`/reports/templates/${id}`)
  return response.data
}

export async function generateReport(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/reports/generate`, data)
  return response.data
}

export async function listGeneratedReports(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/reports/generated`, { params })
  return response.data
}

export async function getReport(id: string) {
  const response = await client.get(`/reports/${id}`)
  return response.data
}

export async function deleteReport(id: string) {
  const response = await client.delete(`/reports/${id}`)
  return response.data
}
