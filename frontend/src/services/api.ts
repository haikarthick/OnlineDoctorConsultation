import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = '/api/v1'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor - attach auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('authToken')
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error: AxiosError) => Promise.reject(error)
    )

    // Response interceptor - handle common errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken')
          localStorage.removeItem('authUser')
          window.location.href = '/'
        }
        return Promise.reject(error)
      }
    )
  }

  // ─── Auth ──────────────────────────────────────────────────
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password })
    return response.data
  }

  async register(data: { firstName: string; lastName: string; email: string; phone: string; password: string; role: string }) {
    const response = await this.client.post('/auth/register', data)
    return response.data
  }

  async getProfile() {
    const response = await this.client.get('/auth/profile')
    return response.data
  }

  // ─── Consultations ────────────────────────────────────────
  async createConsultation(data: { veterinarianId: string; animalType: string; symptomDescription: string; scheduledAt?: string; animalId?: string; bookingId?: string; petOwnerId?: string }) {
    const response = await this.client.post('/consultations', data)
    return response.data
  }

  async getConsultation(id: string) {
    const response = await this.client.get(`/consultations/${id}`)
    return response.data
  }

  async updateConsultation(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/consultations/${id}`, data)
    return response.data
  }

  async listConsultations(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/consultations', { params })
    return response.data
  }

  // ─── Bookings ─────────────────────────────────────────────
  async createBooking(data: {
    veterinarianId: string; animalId?: string; scheduledDate: string;
    timeSlotStart: string; timeSlotEnd: string; bookingType: string;
    priority?: string; reasonForVisit: string; symptoms?: string; notes?: string
  }) {
    const response = await this.client.post('/bookings', data)
    return response.data
  }

  async getBooking(id: string) {
    const response = await this.client.get(`/bookings/${id}`)
    return response.data
  }

  async listBookings(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/bookings', { params })
    return response.data
  }

  async confirmBooking(id: string) {
    const response = await this.client.put(`/bookings/${id}/confirm`)
    return response.data
  }

  async cancelBooking(id: string, reason: string) {
    const response = await this.client.put(`/bookings/${id}/cancel`, { reason })
    return response.data
  }

  async rescheduleBooking(id: string, data: { scheduledDate: string; timeSlotStart: string; timeSlotEnd: string }) {
    const response = await this.client.put(`/bookings/${id}/reschedule`, data)
    return response.data
  }

  async getBookingActionLogs(bookingId: string) {
    const response = await this.client.get(`/bookings/${bookingId}/action-logs`)
    return response.data
  }

  async getMyActionLogs(limit?: number, offset?: number) {
    const response = await this.client.get('/action-logs/my', { params: { limit, offset } })
    return response.data
  }

  // ─── Video Sessions ───────────────────────────────────────
  async createVideoSession(data: { consultationId: string; participantUserId: string }) {
    const response = await this.client.post('/video-sessions', data)
    return response.data
  }

  async getVideoSession(id: string) {
    const response = await this.client.get(`/video-sessions/${id}`)
    return response.data
  }

  async getVideoSessionByConsultation(consultationId: string) {
    const response = await this.client.get(`/video-sessions/consultation/${consultationId}`)
    return response.data
  }

  async joinVideoSession(roomId: string) {
    const response = await this.client.post(`/video-sessions/join/${roomId}`)
    return response.data
  }

  async startVideoSession(id: string) {
    const response = await this.client.put(`/video-sessions/${id}/start`)
    return response.data
  }

  async endVideoSession(id: string) {
    const response = await this.client.put(`/video-sessions/${id}/end`)
    return response.data
  }

  async sendVideoMessage(sessionId: string, message: string, messageType: string = 'text') {
    const response = await this.client.post(`/video-sessions/${sessionId}/messages`, { message, messageType })
    return response.data
  }

  async getVideoMessages(sessionId: string) {
    const response = await this.client.get(`/video-sessions/${sessionId}/messages`)
    return response.data
  }

  // ─── Schedule & Availability ──────────────────────────────
  async createSchedule(data: { dayOfWeek: string; startTime: string; endTime: string; slotDuration?: number; maxAppointments?: number }) {
    const response = await this.client.post('/schedules', data)
    return response.data
  }

  async getMySchedules() {
    const response = await this.client.get('/schedules/me')
    return response.data
  }

  async getVetSchedules(vetId: string) {
    const response = await this.client.get(`/schedules/vet/${vetId}`)
    return response.data
  }

  async updateSchedule(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/schedules/${id}`, data)
    return response.data
  }

  async deleteSchedule(id: string) {
    const response = await this.client.delete(`/schedules/${id}`)
    return response.data
  }

  async getVetAvailability(vetId: string, date: string) {
    const response = await this.client.get(`/availability/${vetId}/${date}`)
    return response.data
  }

  // ─── Prescriptions ────────────────────────────────────────
  async createPrescription(data: {
    consultationId: string; petOwnerId?: string; animalId?: string;
    medications: { name: string; dosage: string; frequency: string; duration: string; instructions?: string }[];
    instructions: string; validUntil?: string; diagnosis?: string; followUpDate?: string
  }) {
    const response = await this.client.post('/prescriptions', data)
    return response.data
  }

  async getPrescription(id: string) {
    const response = await this.client.get(`/prescriptions/${id}`)
    return response.data
  }

  async getMyPrescriptions(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/prescriptions/me', { params })
    return response.data
  }

  async getPrescriptionsByConsultation(consultationId: string) {
    const response = await this.client.get(`/prescriptions/consultation/${consultationId}`)
    return response.data
  }

  async deactivatePrescription(id: string) {
    const response = await this.client.put(`/prescriptions/${id}/deactivate`)
    return response.data
  }

  // ─── Animals ──────────────────────────────────────────────
  async createAnimal(data: { name: string; species: string; breed?: string; gender?: string; weight?: number; color?: string; medicalNotes?: string }) {
    const response = await this.client.post('/animals', data)
    return response.data
  }

  async getAnimal(id: string) {
    const response = await this.client.get(`/animals/${id}`)
    return response.data
  }

  async listAnimals(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/animals', { params })
    return response.data
  }

  async updateAnimal(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/animals/${id}`, data)
    return response.data
  }

  async deleteAnimal(id: string) {
    const response = await this.client.delete(`/animals/${id}`)
    return response.data
  }

  // ─── Vet Profiles ─────────────────────────────────────────
  async createVetProfile(data: Record<string, unknown>) {
    const response = await this.client.post('/vet-profiles', data)
    return response.data
  }

  async getMyVetProfile() {
    const response = await this.client.get('/vet-profiles/me')
    return response.data
  }

  async listVets(params?: { limit?: number; offset?: number; specialization?: string }) {
    const response = await this.client.get('/vet-profiles', { params })
    return response.data
  }

  async getVetProfile(userId: string) {
    const response = await this.client.get(`/vet-profiles/${userId}`)
    return response.data
  }

  // ─── Medical Records ──────────────────────────────────────
  async createMedicalRecord(data: { recordType: string; title: string; content: string; animalId?: string; consultationId?: string }) {
    const response = await this.client.post('/medical-records', data)
    return response.data
  }

  async listMedicalRecords(params?: { limit?: number; offset?: number; animalId?: string }) {
    const response = await this.client.get('/medical-records', { params })
    return response.data
  }

  async getMedicalRecord(id: string) {
    const response = await this.client.get(`/medical-records/${id}`)
    return response.data
  }

  async deleteMedicalRecord(id: string) {
    const response = await this.client.delete(`/medical-records/${id}`)
    return response.data
  }

  // ─── Notifications ────────────────────────────────────────
  async listNotifications(params?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
    const response = await this.client.get('/notifications', { params })
    return response.data
  }

  async markNotificationRead(id: string) {
    const response = await this.client.put(`/notifications/${id}/read`)
    return response.data
  }

  async markAllNotificationsRead() {
    const response = await this.client.put('/notifications/read-all')
    return response.data
  }

  // ─── Payments ─────────────────────────────────────────────
  async createPayment(data: { consultationId: string; amount: number; currency?: string; paymentMethod?: string }) {
    const response = await this.client.post('/payments', data)
    return response.data
  }

  async listPayments(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/payments', { params })
    return response.data
  }

  // ─── Reviews ──────────────────────────────────────────────
  async createReview(data: { consultationId: string; veterinarianId: string; rating: number; comment?: string }) {
    const response = await this.client.post('/reviews', data)
    return response.data
  }

  async listVetReviews(vetId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/reviews/vet/${vetId}`, { params })
    return response.data
  }

  // ─── Admin ────────────────────────────────────────────────
  async getAdminDashboard() {
    const response = await this.client.get('/admin/dashboard')
    return response.data
  }

  async adminListUsers(params?: { limit?: number; offset?: number; role?: string; search?: string; isActive?: string }) {
    const response = await this.client.get('/admin/users', { params })
    return response.data
  }

  async adminToggleUserStatus(userId: string, isActive: boolean) {
    const response = await this.client.put(`/admin/users/${userId}/status`, { isActive })
    return response.data
  }

  async adminChangeUserRole(userId: string, role: string) {
    const response = await this.client.put(`/admin/users/${userId}/role`, { role })
    return response.data
  }

  async adminListConsultations(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/admin/consultations', { params })
    return response.data
  }

  async adminListPayments(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/admin/payments', { params })
    return response.data
  }

  async adminProcessRefund(paymentId: string, amount: number, reason: string) {
    const response = await this.client.post(`/admin/payments/${paymentId}/refund`, { amount, reason })
    return response.data
  }

  async adminListReviews(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/admin/reviews', { params })
    return response.data
  }

  async adminModerateReview(reviewId: string, action: 'approve' | 'hide' | 'remove') {
    const response = await this.client.put(`/admin/reviews/${reviewId}/moderate`, { action })
    return response.data
  }

  async adminGetSettings() {
    const response = await this.client.get('/admin/settings')
    return response.data
  }

  async adminUpdateSetting(key: string, value: string) {
    const response = await this.client.put('/admin/settings', { key, value })
    return response.data
  }

  async adminGetAuditLogs(params?: { limit?: number; offset?: number; userId?: string; action?: string }) {
    const response = await this.client.get('/admin/audit-logs', { params })
    return response.data
  }

  // ─── Feature Flags ─────────────────────────────────────────
  async getFeatureFlags() {
    const response = await this.client.get('/features')
    return response.data
  }

  // ─── Health check ──────────────────────────────────────────
  async healthCheck() {
    const response = await this.client.get('/health')
    return response.data
  }
}

export const apiService = new ApiService()
export default apiService
