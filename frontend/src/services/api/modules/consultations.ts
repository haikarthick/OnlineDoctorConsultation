import { sharedClient } from '../core'

export const consultationsApi = {
  // ─── Consultations ────────────────────────────────────────
  async createConsultation(data: { veterinarianId: string; animalType: string; symptomDescription: string; scheduledAt?: string; animalId?: string; bookingId?: string; petOwnerId?: string }) {
    const response = await sharedClient.post('/consultations', data)
    return response.data
  },

  async getConsultation(id: string) {
    const response = await sharedClient.get(`/consultations/${id}`)
    return response.data
  },

  async updateConsultation(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/consultations/${id}`, data)
    return response.data
  },

  async listConsultations(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await sharedClient.get('/consultations', { params })
    return response.data
  },

  // ─── Bookings ─────────────────────────────────────────────
  async createBooking(data: {
    veterinarianId: string; animalId?: string; enterpriseId?: string; groupId?: string;
    hospitalId?: string; scheduledDate: string;
    timeSlotStart: string; timeSlotEnd: string; bookingType: string;
    priority?: string; reasonForVisit: string; symptoms?: string; notes?: string
  }) {
    const response = await sharedClient.post('/bookings', data)
    return response.data
  },

  async getBooking(id: string) {
    const response = await sharedClient.get(`/bookings/${id}`)
    return response.data
  },

  async listBookings(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await sharedClient.get('/bookings', { params })
    return response.data
  },

  async confirmBooking(id: string) {
    const response = await sharedClient.put(`/bookings/${id}/confirm`)
    return response.data
  },

  async cancelBooking(id: string, reason: string) {
    const response = await sharedClient.put(`/bookings/${id}/cancel`, { reason })
    return response.data
  },

  /**
   * Mark a confirmed/pending booking as a patient no-show (veterinarian or admin).
   * Sets status 'missed' and runs PaymentOrchestrator.settleMissedBooking, which
   * compensates the doctor on paid bookings - so leaving this unwired meant the
   * no-show rules in Admin Settings could never fire and that compensation never
   * happened.
   */
  async markBookingNoShow(id: string) {
    const response = await sharedClient.put(`/bookings/${id}/no-show`)
    return response.data
  },

  async rescheduleBooking(id: string, data: { scheduledDate: string; timeSlotStart: string; timeSlotEnd: string; veterinarianId?: string }) {
    const response = await sharedClient.put(`/bookings/${id}/reschedule`, data)
    return response.data
  },

  async getBookingActionLogs(bookingId: string) {
    const response = await sharedClient.get(`/bookings/${bookingId}/action-logs`)
    return response.data
  },

  async getMyActionLogs(limit?: number, offset?: number) {
    const response = await sharedClient.get('/action-logs/my', { params: { limit, offset } })
    return response.data
  },

  // ─── Video Sessions ───────────────────────────────────────
  async createVideoSession(data: { consultationId: string; participantUserId: string }) {
    const response = await sharedClient.post('/video-sessions', data)
    return response.data
  },

  async getVideoSession(id: string) {
    const response = await sharedClient.get(`/video-sessions/${id}`)
    return response.data
  },

  async getVideoSessionByConsultation(consultationId: string) {
    const response = await sharedClient.get(`/video-sessions/consultation/${consultationId}`)
    return response.data
  },

  async joinVideoSession(roomId: string) {
    const response = await sharedClient.post(`/video-sessions/join/${roomId}`)
    return response.data
  },

  async startVideoSession(id: string) {
    const response = await sharedClient.put(`/video-sessions/${id}/start`)
    return response.data
  },

  async endVideoSession(id: string) {
    const response = await sharedClient.put(`/video-sessions/${id}/end`)
    return response.data
  },

  async sendVideoMessage(sessionId: string, message: string, messageType: string = 'text') {
    const response = await sharedClient.post(`/video-sessions/${sessionId}/messages`, { message, messageType })
    return response.data
  },

  async getVideoMessages(sessionId: string) {
    const response = await sharedClient.get(`/video-sessions/${sessionId}/messages`)
    return response.data
  },

  // ─── WebRTC Signaling ─────────────────────────────────────
  async sendSignal(sessionId: string, type: string, data: string) {
    const response = await sharedClient.post(`/video-sessions/${sessionId}/signal`, { type, data })
    return response.data
  },

  async getSignals(sessionId: string) {
    const response = await sharedClient.get(`/video-sessions/${sessionId}/signals`)
    return response.data
  }

}
