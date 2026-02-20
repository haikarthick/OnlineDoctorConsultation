import { client } from './client'

export async function createSchedule(data: { dayOfWeek: string; startTime: string; endTime: string; slotDuration?: number; maxAppointments?: number }) {
  const response = await client.post('/schedules', data)
  return response.data
}

export async function getMySchedules() {
  const response = await client.get('/schedules/me')
  return response.data
}

export async function getVetSchedules(vetId: string) {
  const response = await client.get(`/schedules/vet/${vetId}`)
  return response.data
}

export async function updateSchedule(id: string, data: Record<string, unknown>) {
  const response = await client.put(`/schedules/${id}`, data)
  return response.data
}

export async function deleteSchedule(id: string) {
  const response = await client.delete(`/schedules/${id}`)
  return response.data
}

export async function getVetAvailability(vetId: string, date: string) {
  const response = await client.get(`/availability/${vetId}/${date}`)
  return response.data
}
