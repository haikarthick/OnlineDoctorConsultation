import { client } from './client'

// ─── Medical Records ──────────────────────────────────────────
export async function createMedicalRecord(data: { recordType: string; title: string; content: string; animalId?: string; consultationId?: string; veterinarianId?: string; severity?: string; medications?: any[]; attachments?: any[]; isConfidential?: boolean; followUpDate?: string; tags?: string[]; userId?: string }) {
  const response = await client.post('/medical-records', data)
  return response.data
}

export async function listMedicalRecords(params?: { limit?: number; offset?: number; animalId?: string; recordType?: string; status?: string; severity?: string; search?: string }) {
  const response = await client.get('/medical-records', { params })
  return response.data
}

export async function getMedicalRecord(id: string) {
  const response = await client.get(`/medical-records/${id}`)
  return response.data
}

export async function updateMedicalRecord(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/medical-records/${id}`, data)
  return response.data
}

export async function deleteMedicalRecord(id: string) {
  const response = await client.delete(`/medical-records/${id}`)
  return response.data
}

export async function getMedicalStats(params?: { animalId?: string }) {
  const response = await client.get('/medical-records/stats', { params })
  return response.data
}

export async function getMedicalAuditLog(params?: { recordId?: string; recordType?: string; action?: string; limit?: number; offset?: number }) {
  const response = await client.get('/medical-records/audit', { params })
  return response.data
}

// ─── Vaccinations ─────────────────────────────────────────────
export async function createVaccination(data: { animalId: string; vaccineName: string; dateAdministered: string; vaccineType?: string; batchNumber?: string; manufacturer?: string; nextDueDate?: string; siteOfAdministration?: string; dosage?: string; reactionNotes?: string; certificateNumber?: string }) {
  const response = await client.post('/vaccinations', data)
  return response.data
}

export async function listVaccinations(animalId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/vaccinations/animal/${animalId}`, { params })
  return response.data
}

export async function updateVaccination(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/vaccinations/${id}`, data)
  return response.data
}

export async function deleteVaccination(id: string) {
  const response = await client.delete(`/vaccinations/${id}`)
  return response.data
}

// ─── Weight History ───────────────────────────────────────────
export async function addWeight(data: { animalId: string; weight: number; unit?: string; notes?: string }) {
  const response = await client.post('/weight-history', data)
  return response.data
}

export async function listWeightHistory(animalId: string, params?: { limit?: number }) {
  const response = await client.get(`/weight-history/animal/${animalId}`, { params })
  return response.data
}

// ─── Allergies ────────────────────────────────────────────────
export async function createAllergy(data: { animalId: string; allergen: string; reaction?: string; severity?: string; identifiedDate?: string; notes?: string }) {
  const response = await client.post('/allergies', data)
  return response.data
}

export async function listAllergies(animalId: string) {
  const response = await client.get(`/allergies/animal/${animalId}`)
  return response.data
}

export async function updateAllergy(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/allergies/${id}`, data)
  return response.data
}

// ─── Lab Results ──────────────────────────────────────────────
export async function createLabResult(data: { animalId: string; testName: string; testDate: string; testCategory?: string; resultValue?: string; normalRange?: string; unit?: string; status?: string; interpretation?: string; labName?: string; isAbnormal?: boolean; notes?: string }) {
  const response = await client.post('/lab-results', data)
  return response.data
}

export async function listLabResults(animalId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/lab-results/animal/${animalId}`, { params })
  return response.data
}

export async function updateLabResult(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/lab-results/${id}`, data)
  return response.data
}

// ─── Medical Timeline ─────────────────────────────────────────
export async function getAnimalTimeline(animalId: string, params?: { limit?: number }) {
  const response = await client.get(`/timeline/animal/${animalId}`, { params })
  return response.data
}
