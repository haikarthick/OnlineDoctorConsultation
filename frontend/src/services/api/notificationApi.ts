import { client } from './client'

export async function listNotifications(params?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
  const response = await client.get('/notifications', { params })
  return response.data
}

export async function markNotificationRead(id: string) {
  const response = await client.put(`/notifications/${id}/read`)
  return response.data
}

export async function markAllNotificationsRead() {
  const response = await client.put('/notifications/read-all')
  return response.data
}
