import { client } from './client'

export async function createAnimal(data: { name: string; species: string; breed?: string; gender?: string; weight?: number; color?: string; medicalNotes?: string; dateOfBirth?: string; microchipId?: string; earTagId?: string; registrationNumber?: string; isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceExpiry?: string }) {
  const response = await client.post('/animals', data)
  return response.data
}

export async function getAnimal(id: string) {
  const response = await client.get(`/animals/${id}`)
  return response.data
}

export async function listAnimals(params?: { limit?: number; offset?: number }) {
  const response = await client.get('/animals', { params })
  return response.data
}

export async function updateAnimal(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/animals/${id}`, data)
  return response.data
}

export async function deleteAnimal(id: string) {
  const response = await client.delete(`/animals/${id}`)
  return response.data
}
