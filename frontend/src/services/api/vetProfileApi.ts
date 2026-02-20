import { client } from './client'

export async function createVetProfile(data: Record<string, unknown>) {
  const response = await client.post('/vet-profiles', data)
  return response.data
}

export async function getMyVetProfile() {
  const response = await client.get('/vet-profiles/me')
  return response.data
}

export async function listVets(params?: { limit?: number; offset?: number; specialization?: string }) {
  const response = await client.get('/vet-profiles', { params })
  return response.data
}

export async function getVetProfile(userId: string) {
  const response = await client.get(`/vet-profiles/${userId}`)
  return response.data
}
