import { client } from './client'

// ─── Enterprise CRUD ──────────────────────────────────────────
export async function createEnterprise(data: { name: string; enterpriseType: string; description?: string; address?: string; city?: string; state?: string; country?: string; postalCode?: string; totalArea?: number; areaUnit?: string; licenseNumber?: string; regulatoryId?: string; taxId?: string; phone?: string; email?: string; website?: string }) {
  const response = await client.post('/enterprises', data)
  return response.data
}

export async function listEnterprises(params?: { limit?: number; offset?: number }) {
  const response = await client.get('/enterprises', { params })
  return response.data
}

export async function getEnterprise(id: string) {
  const response = await client.get(`/enterprises/${id}`)
  return response.data
}

export async function updateEnterprise(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/enterprises/${id}`, data)
  return response.data
}

export async function deleteEnterprise(id: string) {
  const response = await client.delete(`/enterprises/${id}`)
  return response.data
}

export async function getEnterpriseStats(id: string) {
  const response = await client.get(`/enterprises/${id}/stats`)
  return response.data
}

// ─── Enterprise Members ───────────────────────────────────────
export async function listEnterpriseMembers(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/members`)
  return response.data
}

export async function addEnterpriseMember(enterpriseId: string, data: { userId: string; role: string; title?: string }) {
  const response = await client.post(`/enterprises/${enterpriseId}/members`, data)
  return response.data
}

export async function updateEnterpriseMember(enterpriseId: string, userId: string, data: { role: string; title?: string }) {
  const response = await client.put(`/enterprises/${enterpriseId}/members/${userId}`, data)
  return response.data
}

export async function removeEnterpriseMember(enterpriseId: string, userId: string) {
  const response = await client.delete(`/enterprises/${enterpriseId}/members/${userId}`)
  return response.data
}

// ─── Animal Groups ────────────────────────────────────────────
export async function createAnimalGroup(data: { enterpriseId: string; name: string; groupType: string; species?: string; breed?: string; purpose?: string; targetCount?: number; description?: string; colorCode?: string }) {
  const response = await client.post('/animal-groups', data)
  return response.data
}

export async function getAnimalGroup(id: string) {
  const response = await client.get(`/animal-groups/${id}`)
  return response.data
}

export async function listAnimalGroups(enterpriseId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/enterprises/${enterpriseId}/groups`, { params })
  return response.data
}

export async function updateAnimalGroup(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/animal-groups/${id}`, data)
  return response.data
}

export async function deleteAnimalGroup(id: string) {
  const response = await client.delete(`/animal-groups/${id}`)
  return response.data
}

export async function assignAnimalToGroup(groupId: string, animalId: string) {
  const response = await client.post(`/animal-groups/${groupId}/assign`, { animalId })
  return response.data
}

export async function removeAnimalFromGroup(groupId: string, animalId: string) {
  const response = await client.delete(`/animal-groups/${groupId}/animals/${animalId}`)
  return response.data
}

// ─── Locations ────────────────────────────────────────────────
export async function createLocation(data: { enterpriseId: string; name: string; locationType: string; parentLocationId?: string; capacity?: number; area?: number; areaUnit?: string; description?: string }) {
  const response = await client.post('/locations', data)
  return response.data
}

export async function getLocation(id: string) {
  const response = await client.get(`/locations/${id}`)
  return response.data
}

export async function listLocations(enterpriseId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/enterprises/${enterpriseId}/locations`, { params })
  return response.data
}

export async function getLocationTree(enterpriseId: string) {
  const response = await client.get(`/enterprises/${enterpriseId}/location-tree`)
  return response.data
}

export async function updateLocation(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/locations/${id}`, data)
  return response.data
}

export async function deleteLocation(id: string) {
  const response = await client.delete(`/locations/${id}`)
  return response.data
}

// ─── Movement Records ─────────────────────────────────────────
export async function createMovement(data: { enterpriseId: string; animalId?: string; groupId?: string; fromLocationId?: string; toLocationId?: string; movementType: string; reason?: string; animalCount?: number; transportDate?: string; notes?: string }) {
  const response = await client.post('/movements', data)
  return response.data
}

export async function listMovements(enterpriseId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/enterprises/${enterpriseId}/movements`, { params })
  return response.data
}

export async function getMovement(id: string) {
  const response = await client.get(`/movements/${id}`)
  return response.data
}

// ─── Treatment Campaigns ──────────────────────────────────────
export async function createCampaign(data: { enterpriseId: string; groupId?: string; campaignType: string; name: string; description?: string; productUsed?: string; dosage?: string; targetCount?: number; scheduledDate?: string; cost?: number; notes?: string }) {
  const response = await client.post('/campaigns', data)
  return response.data
}

export async function getCampaign(id: string) {
  const response = await client.get(`/campaigns/${id}`)
  return response.data
}

export async function listCampaigns(enterpriseId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/enterprises/${enterpriseId}/campaigns`, { params })
  return response.data
}

export async function updateCampaign(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/campaigns/${id}`, data)
  return response.data
}

export async function deleteCampaign(id: string) {
  const response = await client.delete(`/campaigns/${id}`)
  return response.data
}
