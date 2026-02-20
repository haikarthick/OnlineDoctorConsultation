import { client } from './client'

export async function createVideoSession(data: { consultationId: string; participantUserId: string }) {
  const response = await client.post('/video-sessions', data)
  return response.data
}

export async function getVideoSession(id: string) {
  const response = await client.get(`/video-sessions/${id}`)
  return response.data
}

export async function getVideoSessionByConsultation(consultationId: string) {
  const response = await client.get(`/video-sessions/consultation/${consultationId}`)
  return response.data
}

export async function joinVideoSession(roomId: string) {
  const response = await client.post(`/video-sessions/join/${roomId}`)
  return response.data
}

export async function startVideoSession(id: string) {
  const response = await client.put(`/video-sessions/${id}/start`)
  return response.data
}

export async function endVideoSession(id: string) {
  const response = await client.put(`/video-sessions/${id}/end`)
  return response.data
}

export async function sendVideoMessage(sessionId: string, message: string, messageType: string = 'text') {
  const response = await client.post(`/video-sessions/${sessionId}/messages`, { message, messageType })
  return response.data
}

export async function getVideoMessages(sessionId: string) {
  const response = await client.get(`/video-sessions/${sessionId}/messages`)
  return response.data
}
