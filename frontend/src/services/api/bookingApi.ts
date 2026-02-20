import { client } from './client'

export async function createBooking(data: {
  veterinarianId: string; animalId?: string; scheduledDate: string;
  timeSlotStart: string; timeSlotEnd: string; bookingType: string;
  priority?: string; reasonForVisit: string; symptoms?: string; notes?: string
}) {
  const response = await client.post('/bookings', data)
  return response.data
}

export async function getBooking(id: string) {
  const response = await client.get(`/bookings/${id}`)
  return response.data
}

export async function listBookings(params?: { limit?: number; offset?: number; status?: string }) {
  const response = await client.get('/bookings', { params })
  return response.data
}

export async function confirmBooking(id: string) {
  const response = await client.put(`/bookings/${id}/confirm`)
  return response.data
}

export async function cancelBooking(id: string, reason: string) {
  const response = await client.put(`/bookings/${id}/cancel`, { reason })
  return response.data
}

export async function rescheduleBooking(id: string, data: { scheduledDate: string; timeSlotStart: string; timeSlotEnd: string }) {
  const response = await client.put(`/bookings/${id}/reschedule`, data)
  return response.data
}

export async function getBookingActionLogs(bookingId: string) {
  const response = await client.get(`/bookings/${bookingId}/action-logs`)
  return response.data
}

export async function getMyActionLogs(limit?: number, offset?: number) {
  const response = await client.get('/action-logs/my', { params: { limit, offset } })
  return response.data
}
