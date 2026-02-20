import { client } from './client'

export async function createPayment(data: { consultationId: string; amount: number; currency?: string; paymentMethod?: string }) {
  const response = await client.post('/payments', data)
  return response.data
}

export async function listPayments(params?: { limit?: number; offset?: number }) {
  const response = await client.get('/payments', { params })
  return response.data
}
