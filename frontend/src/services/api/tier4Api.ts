import { client } from './client'

// ─── AI Veterinary Copilot ────────────────────────────────────
export async function listChatSessions(filters: any = {}) {
  const response = await client.get('/ai-copilot/sessions', { params: filters })
  return response.data
}

export async function createChatSession(data: any) {
  const response = await client.post('/ai-copilot/sessions', data)
  return response.data
}

export async function getChatSession(id: string) {
  const response = await client.get(`/ai-copilot/sessions/${id}`)
  return response.data
}

export async function deleteChatSession(id: string) {
  const response = await client.delete(`/ai-copilot/sessions/${id}`)
  return response.data
}

export async function listChatMessages(sessionId: string) {
  const response = await client.get(`/ai-copilot/sessions/${sessionId}/messages`)
  return response.data
}

export async function sendChatMessage(sessionId: string, content: string) {
  const response = await client.post(`/ai-copilot/sessions/${sessionId}/messages`, { content })
  return response.data
}

export async function checkDrugInteractions(drugs: string[]) {
  const response = await client.post('/ai-copilot/drug-interactions', { drugs })
  return response.data
}

export async function analyzeSymptoms(symptoms: string[], species?: string) {
  const response = await client.post('/ai-copilot/symptom-analysis', { symptoms, species })
  return response.data
}

// ─── Digital Twin & Simulator ─────────────────────────────────
export async function getDigitalTwinDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/digital-twins/dashboard`)
  return response.data
}

export async function listDigitalTwins(enterpriseId: string, filters: any = {}) {
  const response = await client.get(`/enterprises/${enterpriseId}/digital-twins`, { params: filters })
  return response.data
}

export async function createDigitalTwin(enterpriseId: string, data: any) {
  const response = await client.post(`/enterprises/${enterpriseId}/digital-twins`, data)
  return response.data
}

export async function updateDigitalTwin(id: string, data: any) {
  const response = await client.put(`/digital-twins/${id}`, data)
  return response.data
}

export async function deleteDigitalTwin(id: string) {
  const response = await client.delete(`/digital-twins/${id}`)
  return response.data
}

export async function listSimulations(enterpriseId: string, filters: any = {}) {
  const response = await client.get(`/enterprises/${enterpriseId}/simulations`, { params: filters })
  return response.data
}

export async function runSimulation(enterpriseId: string, data: any) {
  const response = await client.post(`/enterprises/${enterpriseId}/simulations`, data)
  return response.data
}

export async function getSimulation(id: string) {
  const response = await client.get(`/simulations/${id}`)
  return response.data
}

export async function deleteSimulation(id: string) {
  const response = await client.delete(`/simulations/${id}`)
  return response.data
}

// ─── Marketplace & Auctions ──────────────────────────────────
export async function getMarketplaceDashboard(filters: any = {}) {
  const response = await client.get('/marketplace/dashboard', { params: filters })
  return response.data
}

export async function listMarketplaceListings(filters: any = {}) {
  const response = await client.get('/marketplace/listings', { params: filters })
  return response.data
}

export async function getMarketplaceListing(id: string) {
  const response = await client.get(`/marketplace/listings/${id}`)
  return response.data
}

export async function createMarketplaceListing(data: any) {
  const response = await client.post('/marketplace/listings', data)
  return response.data
}

export async function updateMarketplaceListing(id: string, data: any) {
  const response = await client.put(`/marketplace/listings/${id}`, data)
  return response.data
}

export async function deleteMarketplaceListing(id: string) {
  const response = await client.delete(`/marketplace/listings/${id}`)
  return response.data
}

export async function listMarketplaceBids(listingId: string) {
  const response = await client.get(`/marketplace/listings/${listingId}/bids`)
  return response.data
}

export async function placeMarketplaceBid(listingId: string, data: any) {
  const response = await client.post(`/marketplace/listings/${listingId}/bids`, data)
  return response.data
}

export async function listMarketplaceOrders(role: 'buyer' | 'seller' = 'buyer') {
  const response = await client.get('/marketplace/orders', { params: { role } })
  return response.data
}

export async function createMarketplaceOrder(data: any) {
  const response = await client.post('/marketplace/orders', data)
  return response.data
}

export async function updateOrderStatus(id: string, status: string) {
  const response = await client.patch(`/marketplace/orders/${id}/status`, { status })
  return response.data
}

// ─── Sustainability & Carbon ──────────────────────────────────
export async function getSustainabilityDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/sustainability/dashboard`)
  return response.data
}

export async function listSustainabilityMetrics(enterpriseId: string, filters: any = {}) {
  const response = await client.get(`/enterprises/${enterpriseId}/sustainability/metrics`, { params: filters })
  return response.data
}

export async function createSustainabilityMetric(enterpriseId: string, data: any) {
  const response = await client.post(`/enterprises/${enterpriseId}/sustainability/metrics`, data)
  return response.data
}

export async function updateSustainabilityMetric(id: string, data: any) {
  const response = await client.put(`/sustainability/metrics/${id}`, data)
  return response.data
}

export async function deleteSustainabilityMetric(id: string) {
  const response = await client.delete(`/sustainability/metrics/${id}`)
  return response.data
}

export async function listSustainabilityGoals(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/sustainability/goals`)
  return response.data
}

export async function createSustainabilityGoal(enterpriseId: string, data: any) {
  const response = await client.post(`/enterprises/${enterpriseId}/sustainability/goals`, data)
  return response.data
}

export async function updateSustainabilityGoal(id: string, data: any) {
  const response = await client.put(`/sustainability/goals/${id}`, data)
  return response.data
}

export async function deleteSustainabilityGoal(id: string) {
  const response = await client.delete(`/sustainability/goals/${id}`)
  return response.data
}

export async function getCarbonFootprint(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/sustainability/carbon-footprint`)
  return response.data
}

// ─── Client Portal & Wellness ─────────────────────────────────
export async function getWellnessDashboard() {
  const response = await client.get('/wellness/dashboard')
  return response.data
}

export async function listWellnessScorecards(filters: any = {}) {
  const response = await client.get('/wellness/scorecards', { params: filters })
  return response.data
}

export async function createWellnessScorecard(data: any) {
  const response = await client.post('/wellness/scorecards', data)
  return response.data
}

export async function updateWellnessScorecard(id: string, data: any) {
  const response = await client.put(`/wellness/scorecards/${id}`, data)
  return response.data
}

export async function deleteWellnessScorecard(id: string) {
  const response = await client.delete(`/wellness/scorecards/${id}`)
  return response.data
}

export async function listWellnessReminders(filters: any = {}) {
  const response = await client.get('/wellness/reminders', { params: filters })
  return response.data
}

export async function createWellnessReminder(data: any) {
  const response = await client.post('/wellness/reminders', data)
  return response.data
}

export async function completeReminder(id: string) {
  const response = await client.patch(`/wellness/reminders/${id}/complete`)
  return response.data
}

export async function snoozeReminder(id: string, until: string) {
  const response = await client.patch(`/wellness/reminders/${id}/snooze`, { until })
  return response.data
}

export async function deleteReminder(id: string) {
  const response = await client.delete(`/wellness/reminders/${id}`)
  return response.data
}

// ─── Geospatial Analytics ─────────────────────────────────────
export async function getGeospatialDashboard(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/geospatial/dashboard`)
  return response.data
}

export async function listGeofenceZones(enterpriseId: string, filters: any = {}) {
  const response = await client.get(`/enterprises/${enterpriseId}/geospatial/zones`, { params: filters })
  return response.data
}

export async function createGeofenceZone(enterpriseId: string, data: any) {
  const response = await client.post(`/enterprises/${enterpriseId}/geospatial/zones`, data)
  return response.data
}

export async function updateGeofenceZone(id: string, data: any) {
  const response = await client.put(`/geospatial/zones/${id}`, data)
  return response.data
}

export async function deleteGeofenceZone(id: string) {
  const response = await client.delete(`/geospatial/zones/${id}`)
  return response.data
}

export async function listGeospatialEvents(enterpriseId: string, filters: any = {}) {
  const response = await client.get(`/enterprises/${enterpriseId}/geospatial/events`, { params: filters })
  return response.data
}

export async function createGeospatialEvent(enterpriseId: string, data: any) {
  const response = await client.post(`/enterprises/${enterpriseId}/geospatial/events`, data)
  return response.data
}

export async function getHeatmapData(enterpriseId: string, filters: any = {}) {
  const response = await client.get(`/enterprises/${enterpriseId}/geospatial/heatmap`, { params: filters })
  return response.data
}

export async function getMovementTrail(animalId: string, filters: any = {}) {
  const response = await client.get(`/geospatial/animals/${animalId}/trail`, { params: filters })
  return response.data
}
