import { client } from './client'

export async function login(email: string, password: string) {
  const response = await client.post('/auth/login', { email, password })
  return response.data
}

export async function register(data: { firstName: string; lastName: string; email: string; phone: string; password: string; role: string }) {
  const response = await client.post('/auth/register', data)
  return response.data
}

export async function getProfile() {
  const response = await client.get('/auth/profile')
  return response.data
}
