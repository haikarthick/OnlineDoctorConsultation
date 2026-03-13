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

export async function updateProfile(data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }) {
  const response = await client.put('/auth/profile', data)
  return response.data
}

export async function uploadFile(file: File, folder?: string) {
  const formData = new FormData()
  formData.append('file', file)
  if (folder) formData.append('folder', folder)
  const response = await client.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return response.data
}
