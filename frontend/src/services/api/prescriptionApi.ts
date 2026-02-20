import { client } from './client'

export async function createPrescription(data: {
  consultationId: string; petOwnerId?: string; animalId?: string;
  medications: { name: string; dosage: string; frequency: string; duration: string; instructions?: string }[];
  instructions: string; validUntil?: string; diagnosis?: string; followUpDate?: string
}) {
  const response = await client.post('/prescriptions', data)
  return response.data
}

export async function getPrescription(id: string) {
  const response = await client.get(`/prescriptions/${id}`)
  return response.data
}

export async function getMyPrescriptions(params?: { limit?: number; offset?: number }) {
  const response = await client.get('/prescriptions/me', { params })
  return response.data
}

export async function getPrescriptionsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/prescriptions/animal/${animalId}`, { params })
  return response.data
}

export async function getPrescriptionsByConsultation(consultationId: string) {
  const response = await client.get(`/prescriptions/consultation/${consultationId}`)
  return response.data
}

export async function deactivatePrescription(id: string) {
  const response = await client.put(`/prescriptions/${id}/deactivate`)
  return response.data
}
