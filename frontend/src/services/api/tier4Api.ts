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

// Deal handshake: both parties confirm the off-platform settlement
export async function confirmMarketplaceDeal(orderId: string, paymentMethod?: string) {
  const response = await client.post(`/marketplace/orders/${orderId}/confirm`, paymentMethod ? { paymentMethod } : {})
  return response.data
}

export async function cancelMarketplaceDeal(orderId: string, reason?: string) {
  const response = await client.post(`/marketplace/orders/${orderId}/cancel`, reason ? { reason } : {})
  return response.data
}

// ── Marketplace engagement (Phase 3): messaging, favorites, saved searches ──
export async function listMarketplaceThreads() {
  const response = await client.get('/marketplace/threads')
  return response.data
}
export async function getMarketplaceUnreadCount() {
  const response = await client.get('/marketplace/threads/unread-count')
  return response.data
}
export async function startMarketplaceThread(listingId: string, message?: string) {
  const response = await client.post(`/marketplace/listings/${listingId}/threads`, message ? { message } : {})
  return response.data
}
export async function getMarketplaceThreadMessages(threadId: string) {
  const response = await client.get(`/marketplace/threads/${threadId}/messages`)
  return response.data
}
export async function sendMarketplaceMessage(threadId: string, message: string) {
  const response = await client.post(`/marketplace/threads/${threadId}/messages`, { message })
  return response.data
}
export async function listMarketplaceFavorites() {
  const response = await client.get('/marketplace/favorites')
  return response.data
}
export async function getMarketplaceFavoriteIds() {
  const response = await client.get('/marketplace/favorites/ids')
  return response.data
}
export async function addMarketplaceFavorite(listingId: string) {
  const response = await client.post(`/marketplace/listings/${listingId}/favorite`, {})
  return response.data
}
export async function removeMarketplaceFavorite(listingId: string) {
  const response = await client.delete(`/marketplace/listings/${listingId}/favorite`)
  return response.data
}
export async function listMarketplaceSavedSearches() {
  const response = await client.get('/marketplace/saved-searches')
  return response.data
}
export async function createMarketplaceSavedSearch(data: { name: string; filters?: any; alertsEnabled?: boolean }) {
  const response = await client.post('/marketplace/saved-searches', data)
  return response.data
}
export async function updateMarketplaceSavedSearch(id: string, data: { name?: string; filters?: any; alertsEnabled?: boolean }) {
  const response = await client.put(`/marketplace/saved-searches/${id}`, data)
  return response.data
}
export async function deleteMarketplaceSavedSearch(id: string) {
  const response = await client.delete(`/marketplace/saved-searches/${id}`)
  return response.data
}

// ── Phase 5: config, reports ──
export async function getMarketplaceConfig() {
  const response = await client.get('/marketplace/config')
  return response.data
}
export async function reportMarketplaceListing(listingId: string, reason: string, details?: string) {
  const response = await client.post(`/marketplace/listings/${listingId}/report`, { reason, details })
  return response.data
}
export async function adminListMarketplaceReports(status?: string) {
  const response = await client.get('/marketplace/admin/reports', { params: status ? { status } : {} })
  return response.data
}
export async function adminResolveMarketplaceReport(id: string, status: string, resolution?: string) {
  const response = await client.patch(`/marketplace/admin/reports/${id}`, { status, resolution })
  return response.data
}

export async function getMarketPrices(filters: any = {}) {
  const response = await client.get('/marketplace/prices', { params: filters })
  return response.data
}

// Admin marketplace endpoints
export async function adminListMarketplaceListings(filters: any = {}) {
  const response = await client.get('/marketplace/admin/listings', { params: filters })
  return response.data
}

export async function adminGetMarketplaceStats() {
  const response = await client.get('/marketplace/admin/stats')
  return response.data
}

export async function adminApproveMarketplaceListing(id: string, notes?: string) {
  const response = await client.patch(`/marketplace/admin/listings/${id}/approve`, { notes })
  return response.data
}

export async function adminRejectMarketplaceListing(id: string, reason: string) {
  const response = await client.patch(`/marketplace/admin/listings/${id}/reject`, { reason })
  return response.data
}

export async function adminToggleHotDeal(id: string, isHotDeal: boolean) {
  const response = await client.patch(`/marketplace/admin/listings/${id}/hot-deal`, { isHotDeal })
  return response.data
}

export async function adminToggleFeatured(id: string, featured: boolean) {
  const response = await client.patch(`/marketplace/admin/listings/${id}/featured`, { featured })
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
