import { client } from './client'

// ─── Health Analytics ─────────────────────────────────────────
export async function getHealthDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/health/dashboard`)
  return response.data
}

export async function listHealthObservations(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/health/observations`, { params })
  return response.data
}

export async function createHealthObservation(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/health/observations`, data)
  return response.data
}

export async function resolveHealthObservation(id: string) {
  const response = await client.patch(`/health/observations/${id}/resolve`)
  return response.data
}

// ─── Breeding & Genetics ──────────────────────────────────────
export async function listBreedingRecords(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/breeding`, { params })
  return response.data
}

export async function createBreedingRecord(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/breeding`, data)
  return response.data
}

export async function updateBreedingRecord(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/breeding/${id}`, data)
  return response.data
}

export async function getUpcomingDueDates(enterpriseId: string, days?: number) {
  const response = await client.get(`/enterprises/${enterpriseId}/breeding/upcoming-due`, { params: { days } })
  return response.data
}

export async function getBreedingStats(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/breeding/stats`)
  return response.data
}

// ─── Feed & Inventory ─────────────────────────────────────────
export async function listFeeds(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/feed`)
  return response.data
}

export async function createFeed(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/feed`, data)
  return response.data
}

export async function updateFeed(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/feed/${id}`, data)
  return response.data
}

export async function restockFeed(id: string, quantity: number) {
  const response = await client.post(`/feed/${id}/restock`, { quantity })
  return response.data
}

export async function deleteFeed(id: string) {
  const response = await client.delete(`/feed/${id}`)
  return response.data
}

export async function logFeedConsumption(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/feed/consumption`, data)
  return response.data
}

export async function listFeedConsumption(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/feed/consumption`, { params })
  return response.data
}

export async function getFeedAnalytics(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/feed/analytics`)
  return response.data
}

// ─── Compliance & Regulatory ──────────────────────────────────
export async function listComplianceDocs(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/compliance`, { params })
  return response.data
}

export async function createComplianceDoc(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/compliance`, data)
  return response.data
}

export async function updateComplianceDoc(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/compliance/${id}`, data)
  return response.data
}

export async function verifyComplianceDoc(id: string) {
  const response = await client.patch(`/compliance/${id}/verify`)
  return response.data
}

export async function deleteComplianceDoc(id: string) {
  const response = await client.delete(`/compliance/${id}`)
  return response.data
}

export async function getComplianceSummary(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/compliance/summary`)
  return response.data
}

// ─── Financial Analytics ──────────────────────────────────────
export async function listFinancialRecords(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/financial`, { params })
  return response.data
}

export async function createFinancialRecord(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/financial`, data)
  return response.data
}

export async function updateFinancialRecord(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/financial/${id}`, data)
  return response.data
}

export async function deleteFinancialRecord(id: string) {
  const response = await client.delete(`/financial/${id}`)
  return response.data
}

export async function getFinancialDashboard(enterpriseId: string, months?: number) {
  const response = await client.get(`/enterprises/${enterpriseId}/financial/dashboard`, { params: { months } })
  return response.data
}

// ─── Smart Alerts ─────────────────────────────────────────────
export async function listAlertRules(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/alerts/rules`)
  return response.data
}

export async function createAlertRule(enterpriseId: string, data: Record<string, unknown>) {
  const response = await client.post(`/enterprises/${enterpriseId}/alerts/rules`, data)
  return response.data
}

export async function updateAlertRule(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/alerts/rules/${id}`, data)
  return response.data
}

export async function deleteAlertRule(id: string) {
  const response = await client.delete(`/alerts/rules/${id}`)
  return response.data
}

export async function toggleAlertRule(id: string, isEnabled: boolean) {
  const response = await client.patch(`/alerts/rules/${id}/toggle`, { isEnabled })
  return response.data
}

export async function listAlertEvents(enterpriseId: string, params?: Record<string, unknown>) {
  const response = await client.get(`/enterprises/${enterpriseId}/alerts/events`, { params })
  return response.data
}

export async function markAlertRead(id: string) {
  const response = await client.patch(`/alerts/events/${id}/read`)
  return response.data
}

export async function markAllAlertsRead(enterpriseId: string) {
  const response = await client.patch(`/enterprises/${enterpriseId}/alerts/events/read-all`)
  return response.data
}

export async function acknowledgeAlert(id: string) {
  const response = await client.patch(`/alerts/events/${id}/acknowledge`)
  return response.data
}

export async function runAlertChecks(enterpriseId: string) {
  const response = await client.post(`/enterprises/${enterpriseId}/alerts/run-checks`)
  return response.data
}
