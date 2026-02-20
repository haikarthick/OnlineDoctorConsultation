import { client } from './client'

export async function createConsultation(data: { veterinarianId: string; animalType: string; symptomDescription: string; scheduledAt?: string; animalId?: string; bookingId?: string; petOwnerId?: string }) {
  const response = await client.post('/consultations', data)
  return response.data
}

export async function getConsultation(id: string) {
  const response = await client.get(`/consultations/${id}`)
  return response.data
}

export async function updateConsultation(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/consultations/${id}`, data)
  return response.data
}

export async function listConsultations(params?: { limit?: number; offset?: number; status?: string }) {
  const response = await client.get('/consultations', { params })
  return response.data
}

export async function getConsultationsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/consultations/animal/${animalId}`, { params })
  return response.data
}
