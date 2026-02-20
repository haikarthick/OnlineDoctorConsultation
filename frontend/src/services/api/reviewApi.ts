import { client } from './client'

export async function createReview(data: { consultationId: string; veterinarianId: string; rating: number; comment?: string }) {
  const response = await client.post('/reviews', data)
  return response.data
}

export async function listVetReviews(vetId: string, params?: { limit?: number; offset?: number }) {
  const response = await client.get(`/reviews/vet/${vetId}`, { params })
  return response.data
}
