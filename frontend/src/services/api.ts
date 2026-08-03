import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = '/api/v1'

/** Read a cookie value by name */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

// ─── Shared Axios client ──────────────────────────────────────────
// This is THE single Axios instance + auth/CSRF/refresh interceptor stack
// for the whole app. services/api/client.ts re-exports it rather than
// creating its own — previously it duplicated all of this with a subtly
// different (weaker) 403/CSRF error-shape check, and its CSRF token cache
// was a separate variable that never synced with this one, so a token
// rotated on one client wasn't known to the other.
let sharedCsrfToken: string | null = null

export const sharedClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s — free-tier Render DB can take up to 30-90s to wake from sleep
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach auth token + CSRF token
sharedClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Attach CSRF token for state-changing requests
    const method = (config.method || '').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = sharedCsrfToken || getCookie('__csrf')
      if (csrf && config.headers) {
        config.headers['X-CSRF-Token'] = csrf
      }
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Response interceptor - handle common errors
sharedClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as InternalAxiosRequestConfig & { _authRetry?: boolean; _csrfRetry?: boolean }

    // On 401, try to refresh the token before logging out
    if (error.response?.status === 401 && originalConfig && !originalConfig._authRetry) {
      originalConfig._authRetry = true
      const refreshTk = localStorage.getItem('refreshToken')
      if (refreshTk) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: refreshTk }, { withCredentials: true })
          const { token: newToken, refreshToken: newRefreshToken } = res.data.data
          localStorage.setItem('authToken', newToken)
          if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken)
          if (originalConfig.headers) {
            originalConfig.headers.Authorization = `Bearer ${newToken}`
          }
          return sharedClient.request(originalConfig)
        } catch {
          // Refresh failed — logout
        }
      }
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
      localStorage.removeItem('refreshToken')
      window.location.href = '/'
    }

    // If CSRF token expired/missing, fetch a new one and retry once
    if (error.response?.status === 403 && originalConfig && !originalConfig._csrfRetry) {
      const data = error.response?.data as any
      const errorStr = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || '')
      if (errorStr.includes('CSRF')) {
        await fetchCsrfToken()
        originalConfig._csrfRetry = true
        return sharedClient.request(originalConfig)
      }
    }
    return Promise.reject(error)
  }
)

// Add timeout flag so pages can show user-friendly message instead of raw axios error
sharedClient.interceptors.response.use(
  undefined,
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const enriched = new Error(
        'The server is taking longer than expected to respond (possibly waking from sleep). Please wait a moment and try again.'
      ) as any
      enriched.isTimeout = true
      enriched.originalError = error
      return Promise.reject(enriched)
    }
    return Promise.reject(error)
  }
)

/** Fetch a CSRF token from the server and cache it (shared across every consumer of sharedClient) */
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await sharedClient.get('/csrf-token')
    sharedCsrfToken = response.data.csrfToken
  } catch {
    // non-fatal; requests without cookies bypass CSRF anyway
  }
}

// Fetch initial CSRF token
fetchCsrfToken().catch(() => { /* silent — will retry on 403 */ })

class ApiService {
  private client: AxiosInstance = sharedClient

  /** Fetch a CSRF token from the server and cache it */
  async fetchCsrfToken(): Promise<void> {
    return fetchCsrfToken()
  }

  // ─── Auth ──────────────────────────────────────────────────
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password })
    return response.data
  }

  async register(data: { firstName: string; lastName: string; email: string; phone: string; password: string; role: string; acceptTerms?: boolean; [key: string]: any }) {
    const response = await this.client.post('/auth/register', data)
    return response.data
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email })
    return response.data
  }

  async validateResetToken(token: string) {
    const response = await this.client.get('/auth/reset-password/validate', { params: { token } })
    return response.data
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.client.post('/auth/reset-password', { token, newPassword })
    return response.data
  }

  /** Generic HTTP GET — use for ad-hoc endpoints without a typed wrapper */
  async get(url: string, config?: { params?: Record<string, any> }) {
    return this.client.get(url, config)
  }

  async getProfile() {
    const response = await this.client.get('/auth/profile')
    return response.data
  }

  async updateProfile(data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }) {
    const response = await this.client.put('/auth/profile', data)
    return response.data
  }

  async uploadFile(file: File, folder?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) formData.append('folder', folder)
    const response = await this.client.post('/files/upload', formData, { headers: { 'Content-Type': undefined } })
    return response.data
  }

  async uploadImageFile(file: File, folder?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) formData.append('folder', folder)
    const response = await this.client.post('/files/upload-image', formData, { headers: { 'Content-Type': undefined } })
    return response.data
  }

  async uploadVideoFile(file: File, folder?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) formData.append('folder', folder)
    const response = await this.client.post('/files/upload-video', formData, { headers: { 'Content-Type': undefined } })
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

  async listConsultations(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/consultations', { params })
    return response.data
  }

  // ─── Bookings ─────────────────────────────────────────────
  async createBooking(data: {
    veterinarianId: string; animalId?: string; enterpriseId?: string; groupId?: string;
    hospitalId?: string; scheduledDate: string;
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

  /**
   * Mark a confirmed/pending booking as a patient no-show (veterinarian or admin).
   * Sets status 'missed' and runs PaymentOrchestrator.settleMissedBooking, which
   * compensates the doctor on paid bookings — so leaving this unwired meant the
   * no-show rules in Admin Settings could never fire and that compensation never
   * happened.
   */
  async markBookingNoShow(id: string) {
    const response = await this.client.put(`/bookings/${id}/no-show`)
    return response.data
  }

  async rescheduleBooking(id: string, data: { scheduledDate: string; timeSlotStart: string; timeSlotEnd: string; veterinarianId?: string }) {
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

  // ─── WebRTC Signaling ─────────────────────────────────────
  async sendSignal(sessionId: string, type: string, data: string) {
    const response = await this.client.post(`/video-sessions/${sessionId}/signal`, { type, data })
    return response.data
  }

  async getSignals(sessionId: string) {
    const response = await this.client.get(`/video-sessions/${sessionId}/signals`)
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

  async getMonthlyAvailability(vetId: string, year: number, month: number) {
    const response = await this.client.get(`/availability/${vetId}/monthly/summary`, { params: { year, month } })
    return response.data
  }

  // ─── Date Overrides & Time Blocks ─────────────────────────
  async createDateOverride(data: { veterinarianId?: string; overrideDate: string; overrideType: string; startTime?: string; endTime?: string; slotDuration?: number; reason?: string }) {
    const response = await this.client.post('/schedules/date-overrides', data)
    return response.data
  }

  async bulkCreateDateOverrides(data: { veterinarianId?: string; dates: string[]; overrideType: string; startTime?: string; endTime?: string; slotDuration?: number; reason?: string }) {
    const response = await this.client.post('/schedules/date-overrides/bulk', data)
    return response.data
  }

  async listDateOverrides(vetId?: string, fromDate?: string, toDate?: string) {
    const url = vetId ? `/schedules/date-overrides/vet/${vetId}` : '/schedules/date-overrides/me'
    const response = await this.client.get(url, { params: { fromDate, toDate } })
    return response.data
  }

  async deleteDateOverride(id: string) {
    const response = await this.client.delete(`/schedules/date-overrides/${id}`)
    return response.data
  }

  async createBlockedSlot(data: { veterinarianId?: string; blockDate?: string; startTime: string; endTime: string; reason?: string; isRecurring?: boolean; recurringDay?: string }) {
    const response = await this.client.post('/schedules/blocked-slots', data)
    return response.data
  }

  async listBlockedSlots(vetId?: string) {
    const url = vetId ? `/schedules/blocked-slots/vet/${vetId}` : '/schedules/blocked-slots/me'
    const response = await this.client.get(url)
    return response.data
  }

  async deleteBlockedSlot(id: string) {
    const response = await this.client.delete(`/schedules/blocked-slots/${id}`)
    return response.data
  }

  // ─── Hospital Holidays ────────────────────────────────────
  async createHoliday(data: { hospitalId?: string; holidayDate: string; name: string; holidayType?: string; isFullDay?: boolean; startTime?: string; endTime?: string }) {
    const response = await this.client.post('/holidays', data)
    return response.data
  }

  async listHolidays(params?: { hospitalId?: string; fromDate?: string; toDate?: string; year?: number }) {
    const response = await this.client.get('/holidays', { params })
    return response.data
  }

  async updateHoliday(id: string, data: { holidayDate?: string; name?: string; holidayType?: string; isFullDay?: boolean; startTime?: string; endTime?: string }) {
    const response = await this.client.put(`/holidays/${id}`, data)
    return response.data
  }

  async deleteHoliday(id: string) {
    const response = await this.client.delete(`/holidays/${id}`)
    return response.data
  }

  // ─── Prescriptions ────────────────────────────────────────
  async createPrescription(data: {
    consultationId?: string; petOwnerId?: string; animalId?: string;
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

  async getPrescriptionsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/prescriptions/animal/${animalId}`, { params })
    return response.data
  }

  async getVetPharmacyStats() {
    const response = await this.client.get('/vet/pharmacy-stats')
    return response.data
  }

  async getConsultationsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/consultations/animal/${animalId}`, { params })
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

  async listPatients(params?: { limit?: number; search?: string }) {
    const response = await this.client.get('/prescriptions/patients', { params })
    return response.data
  }

  // ─── Veterinary Certificates ──────────────────────────────
  async createCertificate(data: {
    certificateType: string; animalId?: string; petOwnerId?: string;
    consultationId?: string; bookingId?: string; enterpriseId?: string;
    examinationDate?: string; clinicalFindings?: string; diagnosis?: string;
    treatmentSummary?: string; recommendations?: string;
    vaccinationDetails?: object; travelDetails?: object;
    breedingDetails?: object; valuationDetails?: object;
    validUntil?: string; notes?: string;
  }) {
    const response = await this.client.post('/certificates', data)
    return response.data
  }

  async getMyCertificates(params?: { limit?: number; offset?: number; type?: string; status?: string; animalId?: string; search?: string }) {
    const response = await this.client.get('/certificates/me', { params })
    return response.data
  }

  async getCertificate(id: string) {
    const response = await this.client.get(`/certificates/${id}`)
    return response.data
  }

  async getCertificatesByAnimal(animalId: string) {
    const response = await this.client.get(`/certificates/animal/${animalId}`)
    return response.data
  }

  async updateCertificate(id: string, data: {
    examinationDate?: string; clinicalFindings?: string; diagnosis?: string;
    treatmentSummary?: string; recommendations?: string;
    vaccinationDetails?: object; travelDetails?: object;
    breedingDetails?: object; valuationDetails?: object;
    validUntil?: string; notes?: string; animalId?: string; petOwnerId?: string; consultationId?: string;
  }) {
    const response = await this.client.put(`/certificates/${id}`, data)
    return response.data
  }

  async issueCertificate(id: string) {
    const response = await this.client.put(`/certificates/${id}/issue`)
    return response.data
  }

  async revokeCertificate(id: string, reason: string) {
    const response = await this.client.put(`/certificates/${id}/revoke`, { reason })
    return response.data
  }

  async deleteCertificate(id: string) {
    const response = await this.client.delete(`/certificates/${id}`)
    return response.data
  }

  // ─── Animals ──────────────────────────────────────────────
  async createAnimal(data: { name: string; species: string; breed?: string; gender?: string; weight?: number; color?: string; medicalNotes?: string; dateOfBirth?: string; microchipId?: string; earTagId?: string; registrationNumber?: string; isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceExpiry?: string }) {
    const response = await this.client.post('/animals', data)
    return response.data
  }

  async getAnimal(id: string) {
    const response = await this.client.get(`/animals/${id}`)
    return response.data
  }

  async listAnimals(params?: { limit?: number; offset?: number; view?: string; ownerId?: string }) {
    const response = await this.client.get('/animals', { params })
    return response.data
  }

  async searchAnimalByUniqueId(uid: string) {
    const response = await this.client.get('/animals/search/by-uid', { params: { uid } })
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

  async listVets(params?: {
    limit?: number; offset?: number; specialization?: string;
    language?: string; acceptsEmergency?: string; availableOnly?: string;
    minRating?: number; minFee?: number; maxFee?: number;
    search?: string; sortBy?: string; sortOrder?: string;
  }) {
    const response = await this.client.get('/vet-profiles', { params })
    return response.data
  }

  async getVetProfile(userId: string) {
    const response = await this.client.get(`/vet-profiles/${userId}`)
    return response.data
  }

  async updateVetProfile(data: Record<string, unknown>) {
    const response = await this.client.put('/vet-profiles', data)
    return response.data
  }

  // ─── Medical Records ──────────────────────────────────────
  async createMedicalRecord(data: { recordType: string; title: string; content: string; animalId?: string; consultationId?: string; veterinarianId?: string; severity?: string; medications?: any[]; attachments?: any[]; isConfidential?: boolean; followUpDate?: string; tags?: string[]; userId?: string }) {
    const response = await this.client.post('/medical-records', data)
    return response.data
  }

  async listMedicalRecords(params?: { limit?: number; offset?: number; animalId?: string; recordType?: string; status?: string; severity?: string; search?: string }) {
    const response = await this.client.get('/medical-records', { params })
    return response.data
  }

  async getMedicalRecord(id: string) {
    const response = await this.client.get(`/medical-records/${id}`)
    return response.data
  }

  async updateMedicalRecord(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/medical-records/${id}`, data)
    return response.data
  }

  async deleteMedicalRecord(id: string) {
    const response = await this.client.delete(`/medical-records/${id}`)
    return response.data
  }

  async getMedicalStats(params?: { animalId?: string }) {
    const response = await this.client.get('/medical-records/stats', { params })
    return response.data
  }

  async getMedicalAuditLog(params?: { recordId?: string; recordType?: string; action?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/medical-records/audit', { params })
    return response.data
  }

  // ─── Vaccinations ─────────────────────────────────────────
  async createVaccination(data: { animalId: string; vaccineName: string; dateAdministered: string; vaccineType?: string; batchNumber?: string; manufacturer?: string; nextDueDate?: string; siteOfAdministration?: string; dosage?: string; reactionNotes?: string; certificateNumber?: string }) {
    const response = await this.client.post('/vaccinations', data)
    return response.data
  }

  async listVaccinations(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/vaccinations/animal/${animalId}`, { params })
    return response.data
  }

  async updateVaccination(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/vaccinations/${id}`, data)
    return response.data
  }

  async deleteVaccination(id: string) {
    const response = await this.client.delete(`/vaccinations/${id}`)
    return response.data
  }

  // ─── Weight History ───────────────────────────────────────
  async addWeight(data: { animalId: string; weight: number; unit?: string; notes?: string }) {
    const response = await this.client.post('/weight-history', data)
    return response.data
  }

  async listWeightHistory(animalId: string, params?: { limit?: number }) {
    const response = await this.client.get(`/weight-history/animal/${animalId}`, { params })
    return response.data
  }

  // ─── Allergies ────────────────────────────────────────────
  async createAllergy(data: { animalId: string; allergen: string; reaction?: string; severity?: string; identifiedDate?: string; notes?: string }) {
    const response = await this.client.post('/allergies', data)
    return response.data
  }

  async listAllergies(animalId: string) {
    const response = await this.client.get(`/allergies/animal/${animalId}`)
    return response.data
  }

  async updateAllergy(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/allergies/${id}`, data)
    return response.data
  }

  // ─── Lab Results ──────────────────────────────────────────
  async createLabResult(data: { animalId: string; testName: string; testDate: string; testCategory?: string; resultValue?: string; normalRange?: string; unit?: string; status?: string; interpretation?: string; labName?: string; isAbnormal?: boolean; notes?: string }) {
    const response = await this.client.post('/lab-results', data)
    return response.data
  }

  async listLabResults(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/lab-results/animal/${animalId}`, { params })
    return response.data
  }

  async updateLabResult(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/lab-results/${id}`, data)
    return response.data
  }

  // ─── Medical Timeline ────────────────────────────────────
  async getAnimalTimeline(animalId: string, params?: { limit?: number; types?: string; dateFrom?: string; dateTo?: string }) {
    const response = await this.client.get(`/timeline/animal/${animalId}`, { params })
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
  async createPayment(data: { consultationId: string; bookingId?: string; amount: number; currency?: string; paymentMethod?: string }) {
    const response = await this.client.post('/payments', data)
    return response.data
  }

  async listPayments(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/payments', { params })
    return response.data
  }

  async getPaymentByBooking(bookingId: string) {
    const response = await this.client.get(`/payments/booking/${bookingId}`)
    return response.data
  }

  // ─── Payment module: checkout lifecycle ────────────────────
  async initiatePaymentCheckout(bookingId: string, useWallet: boolean) {
    const response = await this.client.post(`/payments/checkout/${bookingId}`, { useWallet })
    return response.data
  }

  async verifyPayment(data: { paymentId: string; gatewayOrderId?: string; gatewayPaymentId?: string; gatewaySignature?: string }) {
    const response = await this.client.post('/payments/verify', data)
    return response.data
  }

  async getRefundPreview(bookingId: string) {
    const response = await this.client.get(`/payments/refund-preview/${bookingId}`)
    return response.data
  }

  async getPaymentReceipt(paymentId: string) {
    const response = await this.client.get(`/payments/receipt/${paymentId}`)
    return response.data
  }

  // ─── Doctor earnings ledger ─────────────────────────────────
  async getEarningsSummary() {
    const response = await this.client.get('/earnings/summary')
    return response.data
  }

  async getEarningsStatement(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/earnings/statement', { params })
    return response.data
  }

  // ─── Invoices & GST ─────────────────────────────────────────
  async getInvoiceByPayment(paymentId: string) {
    const response = await this.client.get(`/invoices/payment/${paymentId}`)
    return response.data
  }

  async adminListTaxCodes() {
    const response = await this.client.get('/admin/tax-codes')
    return response.data
  }

  async adminUpdateTaxCode(sacCode: string, ratePercent: number) {
    const response = await this.client.put(`/admin/tax-codes/${sacCode}`, { ratePercent })
    return response.data
  }

  async adminFinanceOverview(from: string, to: string) {
    const response = await this.client.get('/admin/reports/finance/overview', { params: { from, to } })
    return response.data
  }

  async adminDownloadGstExport(from: string, to: string) {
    const response = await this.client.get('/admin/reports/gst-export', { params: { from, to }, responseType: 'blob' })
    return response.data
  }

  // ─── Platform referrals ─────────────────────────────────────
  async createPlatformReferral(data: { toVetId?: string | null; reason: string; bookingId?: string; consultationId?: string }) {
    const response = await this.client.post('/referrals/platform', data)
    return response.data
  }

  async listMyPlatformReferrals() {
    const response = await this.client.get('/referrals/platform/my')
    return response.data
  }

  async getReferableItems() {
    const response = await this.client.get('/referrals/platform/referable')
    return response.data
  }

  async acceptPlatformReferral(id: string, data: { veterinarianId?: string; scheduledDate: string; timeSlotStart: string; timeSlotEnd: string; bookingType?: string; reasonForVisit?: string }) {
    const response = await this.client.post(`/referrals/platform/${id}/accept`, data)
    return response.data
  }

  async declinePlatformReferral(id: string, refundDestination?: 'wallet' | 'gateway') {
    const response = await this.client.post(`/referrals/platform/${id}/decline`, { refundDestination })
    return response.data
  }

  async requestWithdrawal() {
    const response = await this.client.post('/withdrawals/request', {})
    return response.data
  }

  async cancelWithdrawal(id: string) {
    const response = await this.client.post(`/withdrawals/${id}/cancel`, {})
    return response.data
  }

  async listMyWithdrawals() {
    const response = await this.client.get('/withdrawals/my')
    return response.data
  }

  async adminListWithdrawals(status?: string) {
    const response = await this.client.get('/admin/withdrawals', { params: { status } })
    return response.data
  }

  async adminNegativeBalances() {
    const response = await this.client.get('/admin/withdrawals/negative-balances')
    return response.data
  }

  async adminApproveWithdrawal(id: string, note?: string) {
    const response = await this.client.put(`/admin/withdrawals/${id}/approve`, { note })
    return response.data
  }

  async adminRejectWithdrawal(id: string, reason: string) {
    const response = await this.client.put(`/admin/withdrawals/${id}/reject`, { reason })
    return response.data
  }

  async adminSettleWithdrawal(id: string, utrReference: string, note?: string) {
    const response = await this.client.put(`/admin/withdrawals/${id}/settle`, { utrReference, note })
    return response.data
  }

  async adminDiscretionaryPayout(doctorId: string, utrReference: string, note: string) {
    const response = await this.client.post('/admin/withdrawals/discretionary', { doctorId, utrReference, note })
    return response.data
  }

  async adminListCommissionDoctors(search?: string) {
    const response = await this.client.get('/admin/commission/doctors', { params: { search } })
    return response.data
  }

  async adminUpdateCommissionOverride(userId: string, data: { commissionPercentOverride: number | null; commissionFlatOverride: number | null }) {
    const response = await this.client.put(`/admin/commission/doctors/${userId}`, data)
    return response.data
  }

  // ─── Legal documents & consent ──────────────────────────────
  async getLegalDocuments() {
    const response = await this.client.get('/legal/documents')
    return response.data
  }

  async getLegalDocument(docType: string) {
    const response = await this.client.get(`/legal/documents/${docType}`)
    return response.data
  }

  async getPendingPolicyAcceptances() {
    const response = await this.client.get('/legal/acceptances/pending')
    return response.data
  }

  async acceptPolicies(docTypes: string[], context?: string) {
    const response = await this.client.post('/legal/acceptances', { docTypes, context })
    return response.data
  }

  async adminListLegalDocuments() {
    const response = await this.client.get('/admin/legal-documents')
    return response.data
  }

  async adminPublishLegalDocument(data: { docType: string; title: string; content: string; requiresReacceptance?: boolean }) {
    const response = await this.client.post('/admin/legal-documents', data)
    return response.data
  }

  async adminGetAcceptanceStats() {
    const response = await this.client.get('/admin/legal-documents/acceptance-stats')
    return response.data
  }

  // ─── Wallet ───────────────────────────────────────────────
  async getWallet() {
    const response = await this.client.get('/wallet')
    return response.data
  }

  async getWalletTransactions(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/wallet/transactions', { params })
    return response.data
  }

  // ─── Doctor Reliability ───────────────────────────────────
  async getDoctorReliability(vetId: string) {
    const response = await this.client.get(`/doctors/${vetId}/reliability`)
    return response.data
  }

  // ─── Reviews ──────────────────────────────────────────────
  async createReview(data: { consultationId: string; veterinarianId: string; rating: number; comment?: string; isPublic?: boolean }) {
    const response = await this.client.post('/reviews', data)
    return response.data
  }

  async getReviewableConsultations() {
    const response = await this.client.get('/reviews/reviewable')
    return response.data
  }

  async listVetReviews(vetId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/reviews/vet/${vetId}`, { params })
    return response.data
  }

  async addVetResponse(reviewId: string, response: string) {
    const res = await this.client.put(`/reviews/${reviewId}/vet-response`, { response })
    return res.data
  }

  async markReviewHelpful(reviewId: string) {
    const response = await this.client.post(`/reviews/${reviewId}/helpful`)
    return response.data
  }

  async reportReview(reviewId: string) {
    const response = await this.client.post(`/reviews/${reviewId}/report`)
    return response.data
  }

  // ─── Admin ────────────────────────────────────────────────
  async getAdminDashboard() {
    const response = await this.client.get('/admin/dashboard')
    return response.data
  }

  async getAdminPharmacyOverview() {
    const response = await this.client.get('/admin/pharmacy-overview')
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

  async adminChangeUserRole(
    userId: string,
    role: string,
    profile?: { licenseNumber?: string; consultationFee?: number; yearsOfExperience?: number; specializations?: string[]; clinicName?: string }
  ) {
    const response = await this.client.put(`/admin/users/${userId}/role`, profile ? { role, profile } : { role })
    return response.data
  }

  async adminResetUserPassword(userId: string, newPassword: string) {
    const response = await this.client.post(`/admin/users/${userId}/reset-password`, { newPassword })
    return response.data
  }

  async adminListPendingUsers() {
    const response = await this.client.get('/admin/users/pending')
    return response.data
  }

  async adminApproveUser(userId: string) {
    const response = await this.client.post(`/admin/users/${userId}/approve`)
    return response.data
  }

  async adminRejectUser(userId: string, reason: string) {
    const response = await this.client.post(`/admin/users/${userId}/reject`, { reason })
    return response.data
  }

  async adminFreezeUser(userId: string, reason: string) {
    const response = await this.client.post(`/admin/users/${userId}/freeze`, { reason })
    return response.data
  }

  async adminUnfreezeUser(userId: string) {
    const response = await this.client.post(`/admin/users/${userId}/unfreeze`)
    return response.data
  }

  async adminSuspendUser(userId: string, reason: string) {
    const response = await this.client.post(`/admin/users/${userId}/suspend`, { reason })
    return response.data
  }

  async adminReactivateUser(userId: string) {
    const response = await this.client.post(`/admin/users/${userId}/reactivate`)
    return response.data
  }

  async adminGetWalletSummary() {
    const response = await this.client.get('/admin/wallet-summary')
    return response.data
  }

  // P4-HIGH1: Secondary role management
  async getUserRoles(userId: string) {
    const response = await this.client.get(`/users/${userId}/roles`)
    return response.data
  }

  async addUserRole(userId: string, role: string, notes?: string) {
    const response = await this.client.post(`/users/${userId}/roles`, { role, notes })
    return response.data
  }

  async removeUserRole(userId: string, role: string) {
    const response = await this.client.delete(`/users/${userId}/roles/${role}`)
    return response.data
  }

  // P4-MED2: Unified referral history for an animal
  async getAnimalReferrals(animalId: string) {
    const response = await this.client.get(`/animals/${animalId}/referrals`)
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

  async getPrescriptionTemplate(): Promise<Record<string, string>> {
    // Fetches prescription.* settings from the public settings endpoint (accessible to all users)
    const response = await this.client.get('/settings/public')
    const list: { key: string; value: string }[] = response.data?.data || []
    const template: Record<string, string> = {}
    for (const item of list) {
      if (item.key.startsWith('prescription.')) {
        const shortKey = item.key.replace('prescription.', '')
        template[shortKey] = item.value
      }
    }
    return template
  }

  async getCertificateTemplate(): Promise<Record<string, string>> {
    // Fetches cert.* settings from the public settings endpoint (accessible to all users)
    const response = await this.client.get('/settings/public')
    const list: { key: string; value: string }[] = response.data?.data || []
    const template: Record<string, string> = {}
    for (const item of list) {
      if (item.key.startsWith('cert.')) {
        const shortKey = item.key.replace('cert.', '')
        template[shortKey] = item.value
      }
    }
    return template
  }

  async adminUpdateSetting(key: string, value: string) {
    const response = await this.client.put('/admin/settings', { key, value })
    return response.data
  }

  async adminSendTestEmail(to: string) {
    const response = await this.client.post('/admin/settings/test-email', { to })
    return response.data
  }

  async adminGetEmailTemplates() {
    const response = await this.client.get('/admin/email-templates')
    return response.data
  }

  async adminUpdateEmailTemplate(templateName: string, data: { subject: string; body: string }) {
    const response = await this.client.put(`/admin/email-templates/${templateName}`, data)
    return response.data
  }

  async adminGetAuditLogs(params?: { limit?: number; offset?: number; userId?: string; action?: string }) {
    const response = await this.client.get('/admin/audit-logs', { params })
    return response.data
  }

  // ── HIPAA Compliance ──────────────────────────────────────
  async getComplianceDashboard() {
    const response = await this.client.get('/admin/compliance/dashboard')
    return response.data
  }

  async getPhiAccessLog(params?: { limit?: number; offset?: number; userId?: string; entityType?: string; startDate?: string; endDate?: string }) {
    const response = await this.client.get('/admin/compliance/phi-access', { params })
    return response.data
  }

  async getUserDataSummary(userId?: string) {
    const url = userId ? `/admin/compliance/user-data/${userId}` : '/admin/compliance/my-data'
    const response = await this.client.get(url)
    return response.data
  }

  async revokeUserSessions(userId: string) {
    const response = await this.client.post(`/admin/compliance/revoke-sessions/${userId}`)
    return response.data
  }

  async adminGetCancellationStats() {
    const response = await this.client.get('/admin/cancellation-stats')
    return response.data
  }

  async adminGetVetProfile(userId: string) {
    const response = await this.client.get(`/admin/vet-profiles/${userId}`)
    return response.data
  }

  async adminUpdateVetProfile(userId: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/admin/vet-profiles/${userId}`, data)
    return response.data
  }

  async adminGetGatewaySettings() {
    const response = await this.client.get('/payments/gateway-settings')
    return response.data
  }

  async adminGetRazorpayCredentials() {
    const response = await this.client.get('/admin/razorpay-credentials')
    return response.data
  }

  async adminUpdateRazorpayCredentials(environment: 'test' | 'live', data: { keyId: string; keySecret?: string; webhookSecret?: string }) {
    const response = await this.client.put(`/admin/razorpay-credentials/${environment}`, data)
    return response.data
  }

  // ─── Feature Flags ─────────────────────────────────────────
  async getFeatureFlags() {
    const response = await this.client.get('/features')
    return response.data
  }

  // ─── Permissions (RBAC) ────────────────────────────────────
  async getMyPermissions() {
    const response = await this.client.get('/permissions/my')
    return response.data
  }

  async adminGetPermissions() {
    const response = await this.client.get('/admin/permissions')
    return response.data
  }

  async adminUpdatePermission(role: string, permission: string, isEnabled: boolean) {
    const response = await this.client.put('/admin/permissions', { role, permission, isEnabled })
    return response.data
  }

  async adminBulkUpdatePermissions(role: string, permissions: Record<string, boolean>) {
    const response = await this.client.put('/admin/permissions/bulk', { role, permissions })
    return response.data
  }

  async adminResetPermissions(role: string) {
    const response = await this.client.post('/admin/permissions/reset', { role })
    return response.data
  }

  async adminGetNetworkRolePermissions(networkId: string) {
    const response = await this.client.get('/admin/network-role-permissions', { params: { networkId } })
    return response.data
  }

  async adminUpdateNetworkRolePermission(networkId: string, networkRole: string, action: string, isEnabled: boolean) {
    const response = await this.client.put('/admin/network-role-permissions', { networkId, networkRole, action, isEnabled })
    return response.data
  }

  async adminResetNetworkRolePermissions(networkId: string, networkRole?: string) {
    const response = await this.client.post('/admin/network-role-permissions/reset', { networkId, networkRole })
    return response.data
  }

  // ─── Network Custom Roles ──────────────────────────────────────
  async getNetworkRoles(networkId: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/roles`)
    return response.data
  }

  async createNetworkCustomRole(networkId: string, data: {
    roleKey: string; displayName: string; description?: string; baseTemplate: string; icon?: string;
  }) {
    const response = await this.client.post(`/hospital-networks/${networkId}/roles`, data)
    return response.data
  }

  async updateNetworkCustomRole(networkId: string, roleKey: string, data: {
    displayName?: string; description?: string; baseTemplate?: string; icon?: string;
  }) {
    const response = await this.client.put(`/hospital-networks/${networkId}/roles/${roleKey}`, data)
    return response.data
  }

  async deleteNetworkCustomRole(networkId: string, roleKey: string) {
    const response = await this.client.delete(`/hospital-networks/${networkId}/roles/${roleKey}`)
    return response.data
  }

  // ─── Health check ──────────────────────────────────────────
  async healthCheck() {
    const response = await this.client.get('/health')
    return response.data
  }

  // ─── Enterprise / Farm Management ─────────────────────────
  async createEnterprise(data: { name: string; enterpriseType: string; description?: string; address?: string; city?: string; state?: string; country?: string; postalCode?: string; totalArea?: number; areaUnit?: string; licenseNumber?: string; regulatoryId?: string; taxId?: string; phone?: string; email?: string; website?: string }) {
    const response = await this.client.post('/enterprises', data)
    return response.data
  }

  async listEnterprises(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/enterprises', { params })
    return response.data
  }

  async getEnterprise(id: string) {
    const response = await this.client.get(`/enterprises/${id}`)
    return response.data
  }

  async updateEnterprise(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/enterprises/${id}`, data)
    return response.data
  }

  async deleteEnterprise(id: string) {
    const response = await this.client.delete(`/enterprises/${id}`)
    return response.data
  }

  async getEnterpriseStats(id: string) {
    const response = await this.client.get(`/enterprises/${id}/stats`)
    return response.data
  }

  // Enterprise Members
  async listEnterpriseMembers(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/members`)
    return response.data
  }

  async addEnterpriseMember(enterpriseId: string, data: { userId: string; role: string; title?: string }) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/members`, data)
    return response.data
  }

  async inviteEnterpriseMember(enterpriseId: string, data: { email: string; role: string }) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/invite-member`, data)
    return response.data
  }

  async updateEnterpriseMember(enterpriseId: string, userId: string, data: { role: string; title?: string }) {
    const response = await this.client.put(`/enterprises/${enterpriseId}/members/${userId}`, data)
    return response.data
  }

  async removeEnterpriseMember(enterpriseId: string, userId: string) {
    const response = await this.client.delete(`/enterprises/${enterpriseId}/members/${userId}`)
    return response.data
  }

  // Animal Groups
  async createAnimalGroup(data: { enterpriseId: string; name: string; groupType: string; species?: string; breed?: string; purpose?: string; targetCount?: number; description?: string; colorCode?: string }) {
    const response = await this.client.post('/animal-groups', data)
    return response.data
  }

  async getAnimalGroup(id: string) {
    const response = await this.client.get(`/animal-groups/${id}`)
    return response.data
  }

  async listAnimalGroups(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/groups`, { params })
    return response.data
  }

  async updateAnimalGroup(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/animal-groups/${id}`, data)
    return response.data
  }

  async deleteAnimalGroup(id: string) {
    const response = await this.client.delete(`/animal-groups/${id}`)
    return response.data
  }

  async assignAnimalToGroup(groupId: string, animalId: string) {
    const response = await this.client.post(`/animal-groups/${groupId}/assign`, { animalId })
    return response.data
  }

  async removeAnimalFromGroup(groupId: string, animalId: string) {
    const response = await this.client.delete(`/animal-groups/${groupId}/animals/${animalId}`)
    return response.data
  }

  // Locations
  async createLocation(data: { enterpriseId: string; name: string; locationType: string; parentLocationId?: string; capacity?: number; area?: number; areaUnit?: string; description?: string }) {
    const response = await this.client.post('/locations', data)
    return response.data
  }

  async getLocation(id: string) {
    const response = await this.client.get(`/locations/${id}`)
    return response.data
  }

  async listLocations(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/locations`, { params })
    return response.data
  }

  async getLocationTree(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/location-tree`)
    return response.data
  }

  async updateLocation(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/locations/${id}`, data)
    return response.data
  }

  async deleteLocation(id: string) {
    const response = await this.client.delete(`/locations/${id}`)
    return response.data
  }

  // Movement Records
  async createMovement(data: { enterpriseId: string; animalId?: string; groupId?: string; fromLocationId?: string; toLocationId?: string; movementType: string; reason?: string; animalCount?: number; transportDate?: string; notes?: string }) {
    const response = await this.client.post('/movements', data)
    return response.data
  }

  async listMovements(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/movements`, { params })
    return response.data
  }

  async getMovement(id: string) {
    const response = await this.client.get(`/movements/${id}`)
    return response.data
  }

  async approveMovement(id: string, action: 'approve' | 'reject') {
    const response = await this.client.patch(`/movements/${id}/approve`, { action })
    return response.data
  }

  // Treatment Campaigns
  async createCampaign(data: { enterpriseId: string; groupId?: string; campaignType: string; name: string; description?: string; productUsed?: string; dosage?: string; targetCount?: number; scheduledDate?: string; cost?: number; notes?: string }) {
    const response = await this.client.post('/campaigns', data)
    return response.data
  }

  async getCampaign(id: string) {
    const response = await this.client.get(`/campaigns/${id}`)
    return response.data
  }

  async listCampaigns(enterpriseId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/campaigns`, { params })
    return response.data
  }

  async updateCampaign(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/campaigns/${id}`, data)
    return response.data
  }

  async deleteCampaign(id: string) {
    const response = await this.client.delete(`/campaigns/${id}`)
    return response.data
  }

  // ═══════════════════════════════════════════════════════════════
  // ─── Health Analytics ─────────────────────────────────

  async getHealthDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/health/dashboard`)
    return response.data
  }

  async listHealthObservations(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/health/observations`, { params })
    return response.data
  }

  async createHealthObservation(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/health/observations`, data)
    return response.data
  }

  async resolveHealthObservation(id: string) {
    const response = await this.client.patch(`/health/observations/${id}/resolve`)
    return response.data
  }

  // ─── Enterprise Animals ────────────────────────────────

  async listEnterpriseAnimals(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/animals`, { params })
    return response.data
  }

  // ─── Enterprise / Herd Medical Management ────────────

  async getEnterpriseMedicalRecords(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/medical-records`, { params })
    return response.data
  }

  async getEnterpriseMedicalStats(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/medical-records/stats`)
    return response.data
  }

  async getEnterpriseVaccinations(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/vaccinations`, { params })
    return response.data
  }

  // ─── Breeding & Genetics ─────────────────────────────

  async listBreedingRecords(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/breeding`, { params })
    return response.data
  }

  async createBreedingRecord(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/breeding`, data)
    return response.data
  }

  async updateBreedingRecord(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/breeding/${id}`, data)
    return response.data
  }

  async getUpcomingDueDates(enterpriseId: string, days?: number) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/breeding/upcoming-due`, { params: { days } })
    return response.data
  }

  async getBreedingStats(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/breeding/stats`)
    return response.data
  }

  // ─── Feed & Inventory ─────────────────────────────────

  async listFeeds(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/feed`)
    return response.data
  }

  async createFeed(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/feed`, data)
    return response.data
  }

  async updateFeed(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/feed/${id}`, data)
    return response.data
  }

  async restockFeed(id: string, quantity: number) {
    const response = await this.client.post(`/feed/${id}/restock`, { quantity })
    return response.data
  }

  async deleteFeed(id: string) {
    const response = await this.client.delete(`/feed/${id}`)
    return response.data
  }

  async logFeedConsumption(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/feed/consumption`, data)
    return response.data
  }

  async listFeedConsumption(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/feed/consumption`, { params })
    return response.data
  }

  async getFeedAnalytics(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/feed/analytics`)
    return response.data
  }

  // ─── Compliance & Regulatory ──────────────────────────

  async listComplianceDocs(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/compliance`, { params })
    return response.data
  }

  async createComplianceDoc(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/compliance`, data)
    return response.data
  }

  async updateComplianceDoc(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/compliance/${id}`, data)
    return response.data
  }

  async verifyComplianceDoc(id: string) {
    const response = await this.client.patch(`/compliance/${id}/verify`)
    return response.data
  }

  async deleteComplianceDoc(id: string) {
    const response = await this.client.delete(`/compliance/${id}`)
    return response.data
  }

  async getComplianceSummary(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/compliance/summary`)
    return response.data
  }

  // ─── Financial Analytics ──────────────────────────────

  async listFinancialRecords(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/financial`, { params })
    return response.data
  }

  async createFinancialRecord(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/financial`, data)
    return response.data
  }

  async updateFinancialRecord(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/financial/${id}`, data)
    return response.data
  }

  async deleteFinancialRecord(id: string) {
    const response = await this.client.delete(`/financial/${id}`)
    return response.data
  }

  async getFinancialDashboard(enterpriseId: string, months?: number) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/financial/dashboard`, { params: { months } })
    return response.data
  }

  // ─── Smart Alerts ─────────────────────────────────────

  async listAlertRules(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/alerts/rules`)
    return response.data
  }

  async createAlertRule(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/alerts/rules`, data)
    return response.data
  }

  async updateAlertRule(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/alerts/rules/${id}`, data)
    return response.data
  }

  async deleteAlertRule(id: string) {
    const response = await this.client.delete(`/alerts/rules/${id}`)
    return response.data
  }

  async toggleAlertRule(id: string, isEnabled: boolean) {
    const response = await this.client.patch(`/alerts/rules/${id}/toggle`, { isEnabled })
    return response.data
  }

  async listAlertEvents(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/alerts/events`, { params })
    return response.data
  }

  async markAlertRead(id: string) {
    const response = await this.client.patch(`/alerts/events/${id}/read`)
    return response.data
  }

  async markAllAlertsRead(enterpriseId: string) {
    const response = await this.client.patch(`/enterprises/${enterpriseId}/alerts/events/read-all`)
    return response.data
  }

  async acknowledgeAlert(id: string) {
    const response = await this.client.patch(`/alerts/events/${id}/acknowledge`)
    return response.data
  }

  async runAlertChecks(enterpriseId: string) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/alerts/run-checks`)
    return response.data
  }

  // ═══════════════════════════════════════════════════════════════
  // Advanced Innovative Features
  // ═══════════════════════════════════════════════════════════════

  // ─── AI Disease Prediction ───────────────────────────────────

  async getRiskDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/disease-predictions/dashboard`)
    return response.data
  }

  async listPredictions(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/disease-predictions`, { params })
    return response.data
  }

  async createPrediction(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/disease-predictions`, data)
    return response.data
  }

  async resolvePrediction(id: string, outcome: string) {
    const response = await this.client.patch(`/disease-predictions/${id}/resolve`, { outcome })
    return response.data
  }

  async listOutbreakZones(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/outbreak-zones`)
    return response.data
  }

  async createOutbreakZone(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/outbreak-zones`, data)
    return response.data
  }

  async resolveOutbreakZone(id: string) {
    const response = await this.client.patch(`/outbreak-zones/${id}/resolve`)
    return response.data
  }

  // ─── Genomic Lineage ────────────────────────────────────────

  async listGeneticProfiles(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/genetic-profiles`, { params })
    return response.data
  }

  async createGeneticProfile(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/genetic-profiles`, data)
    return response.data
  }

  async updateGeneticProfile(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/genetic-profiles/${id}`, data)
    return response.data
  }

  async getLineageTree(animalId: string, depth?: number) {
    const response = await this.client.get(`/genetic-profiles/${animalId}/lineage-tree`, { params: { depth } })
    return response.data
  }

  async listLineagePairs(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/lineage-pairs`)
    return response.data
  }

  async createLineagePair(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/lineage-pairs`, data)
    return response.data
  }

  async getGeneticDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/genetic-dashboard`)
    return response.data
  }

  // ─── IoT Sensors ────────────────────────────────────────────

  async getSensorDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/iot/dashboard`)
    return response.data
  }

  async listSensors(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/iot/sensors`, { params })
    return response.data
  }

  async createSensor(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/iot/sensors`, data)
    return response.data
  }

  async updateSensor(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/iot/sensors/${id}`, data)
    return response.data
  }

  async deleteSensor(id: string) {
    const response = await this.client.delete(`/iot/sensors/${id}`)
    return response.data
  }

  async recordSensorReading(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/iot/readings`, data)
    return response.data
  }

  async listSensorReadings(sensorId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/iot/sensors/${sensorId}/readings`, { params })
    return response.data
  }

  // ─── Supply Chain & Traceability ─────────────────────────────

  async getSupplyChainDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/supply-chain/dashboard`)
    return response.data
  }

  async listBatches(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/supply-chain/batches`, { params })
    return response.data
  }

  async createBatch(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/supply-chain/batches`, data)
    return response.data
  }

  async updateBatch(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/supply-chain/batches/${id}`, data)
    return response.data
  }

  async listTraceabilityEvents(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/supply-chain/events`, { params })
    return response.data
  }

  async createTraceabilityEvent(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/supply-chain/events`, data)
    return response.data
  }

  async verifyTraceabilityEvent(id: string) {
    const response = await this.client.patch(`/supply-chain/events/${id}/verify`)
    return response.data
  }

  async getBatchTraceability(batchId: string) {
    const response = await this.client.get(`/supply-chain/batches/${batchId}/traceability`)
    return response.data
  }

  async generateQRCode(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/supply-chain/qr-codes`, data)
    return response.data
  }

  async listQRCodes(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/supply-chain/qr-codes`)
    return response.data
  }

  // ─── Workforce & Tasks ──────────────────────────────────────

  async getWorkforceDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/workforce/dashboard`)
    return response.data
  }

  async listWorkforceTasks(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/workforce/tasks`, { params })
    return response.data
  }

  async createWorkforceTask(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/workforce/tasks`, data)
    return response.data
  }

  async updateWorkforceTask(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/workforce/tasks/${id}`, data)
    return response.data
  }

  async deleteWorkforceTask(id: string) {
    const response = await this.client.delete(`/workforce/tasks/${id}`)
    return response.data
  }

  async listShifts(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/workforce/shifts`, { params })
    return response.data
  }

  async createShift(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/workforce/shifts`, data)
    return response.data
  }

  async updateShift(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/workforce/shifts/${id}`, data)
    return response.data
  }

  async checkInShift(id: string) {
    const response = await this.client.patch(`/workforce/shifts/${id}/check-in`)
    return response.data
  }

  async checkOutShift(id: string) {
    const response = await this.client.patch(`/workforce/shifts/${id}/check-out`)
    return response.data
  }

  async deleteShift(id: string) {
    const response = await this.client.delete(`/workforce/shifts/${id}`)
    return response.data
  }

  // ─── Report Builder ─────────────────────────────────────────

  async listReportTemplates(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/reports/templates`)
    return response.data
  }

  async createReportTemplate(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/reports/templates`, data)
    return response.data
  }

  async updateReportTemplate(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/reports/templates/${id}`, data)
    return response.data
  }

  async deleteReportTemplate(id: string) {
    const response = await this.client.delete(`/reports/templates/${id}`)
    return response.data
  }

  async generateReport(enterpriseId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/reports/generate`, data)
    return response.data
  }

  async listGeneratedReports(enterpriseId: string, params?: Record<string, unknown>) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/reports/generated`, { params })
    return response.data
  }

  async getReport(id: string) {
    const response = await this.client.get(`/reports/${id}`)
    return response.data
  }

  async deleteReport(id: string) {
    const response = await this.client.delete(`/reports/${id}`)
    return response.data
  }

  // ─── Staff & Workflow Management ────────────────────────────

  // Staff Positions
  async listStaffPositions(hospitalId: string) {
    const response = await this.client.get(`/hospitals/${hospitalId}/staff`)
    return response.data
  }
  async addStaffPosition(hospitalId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/hospitals/${hospitalId}/staff`, data)
    return response.data
  }
  async updateStaffPosition(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/staff-positions/${id}`, data)
    return response.data
  }
  async removeStaffPosition(id: string) {
    const response = await this.client.delete(`/staff-positions/${id}`)
    return response.data
  }

  // Appointment Queue
  async searchWorkflowAnimals(query: string, hospitalId?: string) {
    const response = await this.client.get('/workflow/animals/search', { params: { q: query, hospitalId } })
    return response.data
  }
  async getAnimalMedicalSummary(animalId: string) {
    const response = await this.client.get(`/workflow/animals/${animalId}/medical-summary`)
    return response.data
  }
  async getQueue(hospitalId: string, status?: string) {
    const response = await this.client.get(`/hospitals/${hospitalId}/queue`, { params: { status } })
    return response.data
  }
  async checkInToQueue(hospitalId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/hospitals/${hospitalId}/queue/check-in`, data)
    return response.data
  }
  async triagePatient(queueId: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/queue/${queueId}/triage`, data)
    return response.data
  }
  async updateQueueStatus(queueId: string, status: string) {
    const response = await this.client.patch(`/queue/${queueId}/status`, { status })
    return response.data
  }
  async getQueueStats(hospitalId: string) {
    const response = await this.client.get(`/hospitals/${hospitalId}/queue/stats`)
    return response.data
  }

  // Workflow Cases
  async getWorkflowDashboard(hospitalId: string) {
    const response = await this.client.get(`/hospitals/${hospitalId}/workflow/dashboard`)
    return response.data
  }
  async listWorkflowCases(hospitalId: string, filters?: Record<string, unknown>) {
    const response = await this.client.get(`/hospitals/${hospitalId}/workflow/cases`, { params: filters })
    return response.data
  }
  async createWorkflowCase(hospitalId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/hospitals/${hospitalId}/workflow/cases`, data)
    return response.data
  }
  async getWorkflowCaseDetail(caseId: string) {
    const response = await this.client.get(`/workflow/cases/${caseId}`)
    return response.data
  }
  async updateWorkflowCase(caseId: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/workflow/cases/${caseId}`, data)
    return response.data
  }
  async transitionWorkflowStage(caseId: string, toStage: string, notes?: string) {
    const response = await this.client.patch(`/workflow/cases/${caseId}/transition`, { toStage, notes })
    return response.data
  }

  // Referrals
  async listReferrals(hospitalId: string, filters?: Record<string, unknown>) {
    const response = await this.client.get(`/hospitals/${hospitalId}/referrals`, { params: filters })
    return response.data
  }
  async createReferral(hospitalId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/hospitals/${hospitalId}/referrals`, data)
    return response.data
  }
  async updateReferralStatus(referralId: string, status: string, responseNotes?: string) {
    const response = await this.client.patch(`/referrals/${referralId}/status`, { status, responseNotes })
    return response.data
  }

  // Inpatient / Boarding
  async getInpatientDashboard(hospitalId: string) {
    const response = await this.client.get(`/hospitals/${hospitalId}/inpatient/dashboard`)
    return response.data
  }
  async listInpatients(hospitalId: string, status?: string) {
    const response = await this.client.get(`/hospitals/${hospitalId}/inpatient`, { params: { status } })
    return response.data
  }
  async admitPatient(hospitalId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/hospitals/${hospitalId}/inpatient/admit`, data)
    return response.data
  }
  async updateInpatientStatus(admissionId: string, status: string, notes?: string) {
    const response = await this.client.patch(`/inpatient/${admissionId}/status`, { status, notes })
    return response.data
  }
  async addVitalsLog(admissionId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/inpatient/${admissionId}/vitals`, data)
    return response.data
  }
  async getAnimalHospitalVisits(animalId: string) {
    const response = await this.client.get(`/animals/${animalId}/hospital-visits`)
    return response.data
  }
  async searchVets(query: string) {
    const response = await this.client.get('/vets/search', { params: { q: query } })
    return response.data
  }
  async updateInpatientDetails(admissionId: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/inpatient/${admissionId}`, data)
    return response.data
  }

  // ═══════════════════════════════════════════════════════════════
  // Next-Generation Innovative Features
  // ═══════════════════════════════════════════════════════════════

  // ─── AI Veterinary Copilot ──────────────────────────────────
  async listChatSessions(filters: any = {}) {
    const response = await this.client.get('/ai-copilot/sessions', { params: filters })
    return response.data
  }

  async createChatSession(data: any) {
    const response = await this.client.post('/ai-copilot/sessions', data)
    return response.data
  }

  async getChatSession(id: string) {
    const response = await this.client.get(`/ai-copilot/sessions/${id}`)
    return response.data
  }

  async deleteChatSession(id: string) {
    const response = await this.client.delete(`/ai-copilot/sessions/${id}`)
    return response.data
  }

  async listChatMessages(sessionId: string) {
    const response = await this.client.get(`/ai-copilot/sessions/${sessionId}/messages`)
    return response.data
  }

  async sendChatMessage(sessionId: string, content: string) {
    const response = await this.client.post(`/ai-copilot/sessions/${sessionId}/messages`, { content })
    return response.data
  }

  async checkDrugInteractions(drugs: string[]) {
    const response = await this.client.post('/ai-copilot/drug-interactions', { drugs })
    return response.data
  }

  async analyzeSymptoms(symptoms: string[], species?: string) {
    const response = await this.client.post('/ai-copilot/symptom-analysis', { symptoms, species })
    return response.data
  }

  async analyzeScan(file: File, context?: { species?: string; scanType?: string; bodyPart?: string; notes?: string }) {
    const formData = new FormData()
    formData.append('image', file)
    if (context?.species) formData.append('species', context.species)
    if (context?.scanType) formData.append('scanType', context.scanType)
    if (context?.bodyPart) formData.append('bodyPart', context.bodyPart)
    if (context?.notes) formData.append('notes', context.notes)
    const response = await this.client.post('/ai-copilot/analyze-scan', formData, { headers: { 'Content-Type': undefined }, timeout: 60000 })
    return response.data
  }

  // ─── Digital Twin & Simulator ───────────────────────────────
  async getDigitalTwinDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/digital-twins/dashboard`)
    return response.data
  }

  async listDigitalTwins(enterpriseId: string, filters: any = {}) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/digital-twins`, { params: filters })
    return response.data
  }

  async createDigitalTwin(enterpriseId: string, data: any) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/digital-twins`, data)
    return response.data
  }

  async updateDigitalTwin(id: string, data: any) {
    const response = await this.client.put(`/digital-twins/${id}`, data)
    return response.data
  }

  async deleteDigitalTwin(id: string) {
    const response = await this.client.delete(`/digital-twins/${id}`)
    return response.data
  }

  async listSimulations(enterpriseId: string, filters: any = {}) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/simulations`, { params: filters })
    return response.data
  }

  async runSimulation(enterpriseId: string, data: any) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/simulations`, data)
    return response.data
  }

  async getSimulation(id: string) {
    const response = await this.client.get(`/simulations/${id}`)
    return response.data
  }

  async deleteSimulation(id: string) {
    const response = await this.client.delete(`/simulations/${id}`)
    return response.data
  }

  // ─── Public Marketplace (no auth required) ──────────────────
  async listPublicMarketplaceListings(filters: any = {}) {
    const response = await axios.get(`${API_BASE_URL}/public/marketplace/listings`, { params: filters })
    return response.data
  }

  async getPublicMarketplaceListing(id: string) {
    const response = await axios.get(`${API_BASE_URL}/public/marketplace/listings/${id}`)
    return response.data
  }

  async getPublicMarketplaceStats() {
    const response = await axios.get(`${API_BASE_URL}/public/marketplace/stats`)
    return response.data
  }

  // ─── Marketplace & Auctions ─────────────────────────────────
  async getMarketplaceDashboard(filters: any = {}) {
    const response = await this.client.get('/marketplace/dashboard', { params: filters })
    return response.data
  }

  async listMarketplaceListings(filters: any = {}) {
    const response = await this.client.get('/marketplace/listings', { params: filters })
    return response.data
  }

  async getMarketplaceListing(id: string) {
    const response = await this.client.get(`/marketplace/listings/${id}`)
    return response.data
  }

  async createMarketplaceListing(data: any) {
    const response = await this.client.post('/marketplace/listings', data)
    return response.data
  }

  async updateMarketplaceListing(id: string, data: any) {
    const response = await this.client.put(`/marketplace/listings/${id}`, data)
    return response.data
  }

  async deleteMarketplaceListing(id: string) {
    const response = await this.client.delete(`/marketplace/listings/${id}`)
    return response.data
  }

  async listMarketplaceBids(listingId: string) {
    const response = await this.client.get(`/marketplace/listings/${listingId}/bids`)
    return response.data
  }

  async placeMarketplaceBid(listingId: string, data: any) {
    const response = await this.client.post(`/marketplace/listings/${listingId}/bids`, data)
    return response.data
  }

  async listMarketplaceOrders(role: 'buyer' | 'seller' = 'buyer') {
    const response = await this.client.get('/marketplace/orders', { params: { role } })
    return response.data
  }

  async createMarketplaceOrder(data: any) {
    const response = await this.client.post('/marketplace/orders', data)
    return response.data
  }

  // Deal handshake: both parties confirm the off-platform settlement
  async confirmMarketplaceDeal(orderId: string, paymentMethod?: string) {
    const response = await this.client.post(`/marketplace/orders/${orderId}/confirm`, paymentMethod ? { paymentMethod } : {})
    return response.data
  }

  async cancelMarketplaceDeal(orderId: string, reason?: string) {
    const response = await this.client.post(`/marketplace/orders/${orderId}/cancel`, reason ? { reason } : {})
    return response.data
  }

  // ── Marketplace engagement (Phase 3): messaging, favorites, saved searches ──
  async listMarketplaceThreads() {
    const response = await this.client.get('/marketplace/threads')
    return response.data
  }

  async getMarketplaceUnreadCount() {
    const response = await this.client.get('/marketplace/threads/unread-count')
    return response.data
  }

  async startMarketplaceThread(listingId: string, message?: string) {
    const response = await this.client.post(`/marketplace/listings/${listingId}/threads`, message ? { message } : {})
    return response.data
  }

  async getMarketplaceThreadMessages(threadId: string) {
    const response = await this.client.get(`/marketplace/threads/${threadId}/messages`)
    return response.data
  }

  async sendMarketplaceMessage(threadId: string, message: string) {
    const response = await this.client.post(`/marketplace/threads/${threadId}/messages`, { message })
    return response.data
  }

  async listMarketplaceFavorites() {
    const response = await this.client.get('/marketplace/favorites')
    return response.data
  }

  async getMarketplaceFavoriteIds() {
    const response = await this.client.get('/marketplace/favorites/ids')
    return response.data
  }

  async addMarketplaceFavorite(listingId: string) {
    const response = await this.client.post(`/marketplace/listings/${listingId}/favorite`, {})
    return response.data
  }

  async removeMarketplaceFavorite(listingId: string) {
    const response = await this.client.delete(`/marketplace/listings/${listingId}/favorite`)
    return response.data
  }

  async listMarketplaceSavedSearches() {
    const response = await this.client.get('/marketplace/saved-searches')
    return response.data
  }

  async createMarketplaceSavedSearch(data: { name: string; filters?: any; alertsEnabled?: boolean }) {
    const response = await this.client.post('/marketplace/saved-searches', data)
    return response.data
  }

  async updateMarketplaceSavedSearch(id: string, data: { name?: string; filters?: any; alertsEnabled?: boolean }) {
    const response = await this.client.put(`/marketplace/saved-searches/${id}`, data)
    return response.data
  }

  async deleteMarketplaceSavedSearch(id: string) {
    const response = await this.client.delete(`/marketplace/saved-searches/${id}`)
    return response.data
  }

  // ── Phase 5: config, reports ──
  async getMarketplaceConfig() {
    const response = await this.client.get('/marketplace/config')
    return response.data
  }

  async reportMarketplaceListing(listingId: string, reason: string, details?: string) {
    const response = await this.client.post(`/marketplace/listings/${listingId}/report`, { reason, details })
    return response.data
  }

  async adminListMarketplaceReports(status?: string) {
    const response = await this.client.get('/marketplace/admin/reports', { params: status ? { status } : {} })
    return response.data
  }

  async adminResolveMarketplaceReport(id: string, status: string, resolution?: string) {
    const response = await this.client.patch(`/marketplace/admin/reports/${id}`, { status, resolution })
    return response.data
  }

  async updateOrderStatus(id: string, status: string) {
    const response = await this.client.patch(`/marketplace/orders/${id}/status`, { status })
    return response.data
  }

  async getMarketPrices(filters: any = {}) {
    const response = await this.client.get('/marketplace/prices', { params: filters })
    return response.data
  }

  async adminListMarketplaceListings(filters: any = {}) {
    const response = await this.client.get('/marketplace/admin/listings', { params: filters })
    return response.data
  }

  async adminGetMarketplaceStats() {
    const response = await this.client.get('/marketplace/admin/stats')
    return response.data
  }

  async adminApproveMarketplaceListing(id: string, notes?: string) {
    const response = await this.client.patch(`/marketplace/admin/listings/${id}/approve`, { notes })
    return response.data
  }

  async adminRejectMarketplaceListing(id: string, reason: string) {
    const response = await this.client.patch(`/marketplace/admin/listings/${id}/reject`, { reason })
    return response.data
  }

  async adminToggleHotDeal(id: string, isHotDeal: boolean) {
    const response = await this.client.patch(`/marketplace/admin/listings/${id}/hot-deal`, { isHotDeal })
    return response.data
  }

  async adminToggleFeatured(id: string, featured: boolean) {
    const response = await this.client.patch(`/marketplace/admin/listings/${id}/featured`, { featured })
    return response.data
  }

  // ─── Marketplace Monetization — Admin ───────────────────────
  async getMonetizationSettings() {
    const response = await this.client.get('/marketplace/admin/monetization/settings')
    return response.data
  }

  async updateMonetizationSetting(key: string, data: { settingValue?: any; isEnabled?: boolean }) {
    const response = await this.client.put(`/marketplace/admin/monetization/settings/${key}`, data)
    return response.data
  }

  async getMonetizationPlans() {
    const response = await this.client.get('/marketplace/admin/monetization/plans')
    return response.data
  }

  async createMonetizationPlan(data: any) {
    const response = await this.client.post('/marketplace/admin/monetization/plans', data)
    return response.data
  }

  async updateMonetizationPlan(id: string, data: any) {
    const response = await this.client.put(`/marketplace/admin/monetization/plans/${id}`, data)
    return response.data
  }

  async deleteMonetizationPlan(id: string) {
    const response = await this.client.delete(`/marketplace/admin/monetization/plans/${id}`)
    return response.data
  }

  async getMonetizationDashboard() {
    const response = await this.client.get('/marketplace/admin/monetization/dashboard')
    return response.data
  }

  // ─── Marketplace Monetization — User ────────────────────────
  async getUserSubscription() {
    const response = await this.client.get('/marketplace/subscription')
    return response.data
  }

  async createUserSubscription(planId: string) {
    const response = await this.client.post('/marketplace/subscription', { planId })
    return response.data
  }

  async cancelUserSubscription() {
    const response = await this.client.delete('/marketplace/subscription')
    return response.data
  }

  async boostListing(id: string, boostType: string = 'standard') {
    const response = await this.client.post(`/marketplace/listings/${id}/boost`, { boostType })
    return response.data
  }

  async createInquiry(listingId: string, message: string) {
    const response = await this.client.post(`/marketplace/listings/${listingId}/inquiries`, { message })
    return response.data
  }

  async listInquiries(role: 'buyer' | 'seller' = 'buyer') {
    const response = await this.client.get('/marketplace/inquiries', { params: { role } })
    return response.data
  }

  async respondToInquiry(id: string, revealContact: boolean) {
    const response = await this.client.patch(`/marketplace/inquiries/${id}/respond`, { revealContact })
    return response.data
  }

  async getUserMonetizationStatus() {
    const response = await this.client.get('/marketplace/monetization-status')
    return response.data
  }

  async getAuctionEnabled() {
    const response = await this.client.get('/marketplace/auction-enabled')
    return response.data
  }

  async setAuctionEnabled(enabled: boolean) {
    const response = await this.client.put('/marketplace/admin/auction-enabled', { enabled })
    return response.data
  }

  // ─── Sustainability & Carbon ────────────────────────────────
  async getSustainabilityDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/sustainability/dashboard`)
    return response.data
  }

  async listSustainabilityMetrics(enterpriseId: string, filters: any = {}) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/sustainability/metrics`, { params: filters })
    return response.data
  }

  async createSustainabilityMetric(enterpriseId: string, data: any) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/sustainability/metrics`, data)
    return response.data
  }

  async updateSustainabilityMetric(id: string, data: any) {
    const response = await this.client.put(`/sustainability/metrics/${id}`, data)
    return response.data
  }

  async deleteSustainabilityMetric(id: string) {
    const response = await this.client.delete(`/sustainability/metrics/${id}`)
    return response.data
  }

  async listSustainabilityGoals(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/sustainability/goals`)
    return response.data
  }

  async createSustainabilityGoal(enterpriseId: string, data: any) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/sustainability/goals`, data)
    return response.data
  }

  async updateSustainabilityGoal(id: string, data: any) {
    const response = await this.client.put(`/sustainability/goals/${id}`, data)
    return response.data
  }

  async deleteSustainabilityGoal(id: string) {
    const response = await this.client.delete(`/sustainability/goals/${id}`)
    return response.data
  }

  async getCarbonFootprint(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/sustainability/carbon-footprint`)
    return response.data
  }

  // ─── Client Portal & Wellness ───────────────────────────────
  async getWellnessDashboard() {
    const response = await this.client.get('/wellness/dashboard')
    return response.data
  }

  async listWellnessScorecards(filters: any = {}) {
    const response = await this.client.get('/wellness/scorecards', { params: filters })
    return response.data
  }

  async createWellnessScorecard(data: any) {
    const response = await this.client.post('/wellness/scorecards', data)
    return response.data
  }

  async updateWellnessScorecard(id: string, data: any) {
    const response = await this.client.put(`/wellness/scorecards/${id}`, data)
    return response.data
  }

  async deleteWellnessScorecard(id: string) {
    const response = await this.client.delete(`/wellness/scorecards/${id}`)
    return response.data
  }

  async listWellnessReminders(filters: any = {}) {
    const response = await this.client.get('/wellness/reminders', { params: filters })
    return response.data
  }

  async createWellnessReminder(data: any) {
    const response = await this.client.post('/wellness/reminders', data)
    return response.data
  }

  async completeReminder(id: string) {
    const response = await this.client.patch(`/wellness/reminders/${id}/complete`)
    return response.data
  }

  async snoozeReminder(id: string, until: string) {
    const response = await this.client.patch(`/wellness/reminders/${id}/snooze`, { until })
    return response.data
  }

  async deleteReminder(id: string) {
    const response = await this.client.delete(`/wellness/reminders/${id}`)
    return response.data
  }

  // ─── Geospatial Analytics ───────────────────────────────────
  async getGeospatialDashboard(enterpriseId: string) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/geospatial/dashboard`)
    return response.data
  }

  async listGeofenceZones(enterpriseId: string, filters: any = {}) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/geospatial/zones`, { params: filters })
    return response.data
  }

  async createGeofenceZone(enterpriseId: string, data: any) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/geospatial/zones`, data)
    return response.data
  }

  async updateGeofenceZone(id: string, data: any) {
    const response = await this.client.put(`/geospatial/zones/${id}`, data)
    return response.data
  }

  async deleteGeofenceZone(id: string) {
    const response = await this.client.delete(`/geospatial/zones/${id}`)
    return response.data
  }

  async listGeospatialEvents(enterpriseId: string, filters: any = {}) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/geospatial/events`, { params: filters })
    return response.data
  }

  async createGeospatialEvent(enterpriseId: string, data: any) {
    const response = await this.client.post(`/enterprises/${enterpriseId}/geospatial/events`, data)
    return response.data
  }

  async getHeatmapData(enterpriseId: string, filters: any = {}) {
    const response = await this.client.get(`/enterprises/${enterpriseId}/geospatial/heatmap`, { params: filters })
    return response.data
  }

  async getMovementTrail(animalId: string, filters: any = {}) {
    const response = await this.client.get(`/geospatial/animals/${animalId}/trail`, { params: filters })
    return response.data
  }

  // ─── Vaccine Protocols ────────────────────────────────────────
  async adminListVaccineProtocols(filters: { species?: string; category?: string; country?: string; activeOnly?: boolean } = {}) {
    const response = await this.client.get('/admin/vaccine-protocols', { params: filters })
    return response.data
  }

  async adminCreateVaccineProtocol(data: any) {
    const response = await this.client.post('/admin/vaccine-protocols', data)
    return response.data
  }

  async adminUpdateVaccineProtocol(id: string, data: any) {
    const response = await this.client.put(`/admin/vaccine-protocols/${id}`, data)
    return response.data
  }

  async adminArchiveVaccineProtocol(id: string) {
    const response = await this.client.patch(`/admin/vaccine-protocols/${id}/archive`, {})
    return response.data
  }

  async adminRestoreVaccineProtocol(id: string) {
    const response = await this.client.patch(`/admin/vaccine-protocols/${id}/restore`, {})
    return response.data
  }

  async getVaccineProtocolChanges(id: string) {
    const response = await this.client.get(`/admin/vaccine-protocols/${id}/changes`)
    return response.data
  }

  async addVaccineProtocolChange(id: string, data: any) {
    const response = await this.client.post(`/admin/vaccine-protocols/${id}/changes`, data)
    return response.data
  }

  async listVaccineProtocols(filters: { species?: string; category?: string } = {}) {
    const response = await this.client.get('/vaccine-protocols', { params: filters })
    return response.data
  }

  // ─── Master Data (admin CRUD) ──────────────────────────────────
  async adminListMasterSpecies() { return (await this.client.get('/admin/master-data/species')).data }
  async adminCreateMasterSpecies(data: any) { return (await this.client.post('/admin/master-data/species', data)).data }
  async adminUpdateMasterSpecies(id: string, data: any) { return (await this.client.put(`/admin/master-data/species/${id}`, data)).data }
  async adminArchiveMasterSpecies(id: string) { return (await this.client.patch(`/admin/master-data/species/${id}/archive`, {})).data }
  async adminRestoreMasterSpecies(id: string) { return (await this.client.patch(`/admin/master-data/species/${id}/restore`, {})).data }
  async adminDeleteMasterSpecies(id: string) { return (await this.client.delete(`/admin/master-data/species/${id}`)).data }

  async adminListMasterBreeds(speciesId?: string) { return (await this.client.get('/admin/master-data/breeds', { params: speciesId ? { speciesId } : {} })).data }
  async adminCreateMasterBreed(data: any) { return (await this.client.post('/admin/master-data/breeds', data)).data }
  async adminUpdateMasterBreed(id: string, data: any) { return (await this.client.put(`/admin/master-data/breeds/${id}`, data)).data }
  async adminArchiveMasterBreed(id: string) { return (await this.client.patch(`/admin/master-data/breeds/${id}/archive`, {})).data }
  async adminRestoreMasterBreed(id: string) { return (await this.client.patch(`/admin/master-data/breeds/${id}/restore`, {})).data }
  async adminDeleteMasterBreed(id: string) { return (await this.client.delete(`/admin/master-data/breeds/${id}`)).data }

  async adminListMasterAnimalClasses(speciesId?: string) { return (await this.client.get('/admin/master-data/animal-classes', { params: speciesId ? { speciesId } : {} })).data }
  async adminCreateMasterAnimalClass(data: any) { return (await this.client.post('/admin/master-data/animal-classes', data)).data }
  async adminUpdateMasterAnimalClass(id: string, data: any) { return (await this.client.put(`/admin/master-data/animal-classes/${id}`, data)).data }
  async adminArchiveMasterAnimalClass(id: string) { return (await this.client.patch(`/admin/master-data/animal-classes/${id}/archive`, {})).data }
  async adminRestoreMasterAnimalClass(id: string) { return (await this.client.patch(`/admin/master-data/animal-classes/${id}/restore`, {})).data }
  async adminDeleteMasterAnimalClass(id: string) { return (await this.client.delete(`/admin/master-data/animal-classes/${id}`)).data }

  async adminListMasterMarketplaceCategories() { return (await this.client.get('/admin/master-data/marketplace/categories')).data }
  async adminCreateMasterMarketplaceCategory(data: any) { return (await this.client.post('/admin/master-data/marketplace/categories', data)).data }
  async adminUpdateMasterMarketplaceCategory(id: string, data: any) { return (await this.client.put(`/admin/master-data/marketplace/categories/${id}`, data)).data }
  async adminArchiveMasterMarketplaceCategory(id: string) { return (await this.client.patch(`/admin/master-data/marketplace/categories/${id}/archive`, {})).data }
  async adminRestoreMasterMarketplaceCategory(id: string) { return (await this.client.patch(`/admin/master-data/marketplace/categories/${id}/restore`, {})).data }
  async adminDeleteMasterMarketplaceCategory(id: string) { return (await this.client.delete(`/admin/master-data/marketplace/categories/${id}`)).data }

  async adminListMasterMarketplaceConditions() { return (await this.client.get('/admin/master-data/marketplace/conditions')).data }
  async adminCreateMasterMarketplaceCondition(data: any) { return (await this.client.post('/admin/master-data/marketplace/conditions', data)).data }
  async adminUpdateMasterMarketplaceCondition(id: string, data: any) { return (await this.client.put(`/admin/master-data/marketplace/conditions/${id}`, data)).data }
  async adminArchiveMasterMarketplaceCondition(id: string) { return (await this.client.patch(`/admin/master-data/marketplace/conditions/${id}/archive`, {})).data }
  async adminRestoreMasterMarketplaceCondition(id: string) { return (await this.client.patch(`/admin/master-data/marketplace/conditions/${id}/restore`, {})).data }
  async adminDeleteMasterMarketplaceCondition(id: string) { return (await this.client.delete(`/admin/master-data/marketplace/conditions/${id}`)).data }

  async getAnimalVaccineAssignments(animalId: string) {
    const response = await this.client.get(`/animals/${animalId}/vaccine-assignments`)
    return response.data
  }

  async assignVaccineProtocol(animalId: string, data: { protocolId: string; notes?: string }) {
    const response = await this.client.post(`/animals/${animalId}/vaccine-assignments`, data)
    return response.data
  }

  async waiveVaccineProtocol(animalId: string, protocolId: string, reason: string) {
    const response = await this.client.patch(`/animals/${animalId}/vaccine-assignments/${protocolId}/waive`, { reason })
    return response.data
  }

  async getAnimalVaccineSchedule(animalId: string) {
    const response = await this.client.get(`/vaccine-schedule/animal/${animalId}`)
    return response.data
  }

  async markVaccineDoseAdministered(scheduleId: string, data: { vaccinationRecordId: string; administeredAt?: string }) {
    const response = await this.client.patch(`/vaccine-schedule/${scheduleId}/administer`, data)
    return response.data
  }

  async getVaccinationPassport(animalId: string) {
    const response = await this.client.get(`/vaccination-passport/animal/${animalId}`)
    return response.data
  }

  async getVaccinationComplianceSummary(filters: { enterpriseId?: string; species?: string } = {}) {
    const response = await this.client.get('/vaccination-passport/compliance-summary', { params: filters })
    return response.data
  }

  async logVaccineCertificateDownload(data: { animalId: string; vaccinationRecordId?: string; certificateType?: string; fileName?: string }) {
    const response = await this.client.post('/vaccine-certificate-log', data)
    return response.data
  }

  async getAnimalCertificateLogs(animalId: string) {
    const response = await this.client.get(`/vaccine-certificate-log/animal/${animalId}`)
    return response.data
  }


  async checkAnimalAccess(animalId: string) {
    const response = await this.client.get(`/animals/${animalId}/access-check`)
    return response.data
  }
  // ─── Hospital Networks ──────────────────────────────────────────
  async listHospitalNetworks(filters: { isApproved?: boolean; isActive?: boolean } = {}) {
    const response = await this.client.get('/hospital-networks', { params: filters })
    return response.data
  }
  async createHospitalNetwork(data: Record<string, any>) {
    const response = await this.client.post('/hospital-networks', data)
    return response.data
  }
  async getHospitalNetwork(id: string) {
    const response = await this.client.get(`/hospital-networks/${id}`)
    return response.data
  }
  async updateHospitalNetwork(id: string, data: Record<string, any>) {
    const response = await this.client.put(`/hospital-networks/${id}`, data)
    return response.data
  }
  async approveHospitalNetwork(id: string) {
    const response = await this.client.post(`/hospital-networks/${id}/approve`)
    return response.data
  }

  async deactivateNetwork(networkId: string): Promise<any> {
    const response = await this.client.patch(`/hospital-networks/${networkId}/deactivate`)
    return response.data
  }
  async getNetworkAuditLogs(networkId: string, filters: { page?: number; limit?: number; recordType?: string; accessGranted?: boolean; animalId?: string } = {}) {
    const response = await this.client.get(`/hospital-networks/${networkId}/audit-logs`, { params: filters })
    return response.data
  }
  async getNetworkDashboard(networkId: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/dashboard`)
    return response.data
  }
  async listNetworkHospitals(networkId: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/hospitals`)
    return response.data
  }
  async assignHospitalToNetwork(networkId: string, hospitalId: string) {
    const response = await this.client.post(`/hospital-networks/${networkId}/hospitals/${hospitalId}`)
    return response.data
  }
  async listNetworkMembers(networkId: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/members`)
    return response.data
  }
  async addNetworkMember(networkId: string, data: { userId: string; networkRole: string; hospitalId?: string; notes?: string; validUntil?: string }) {
    const response = await this.client.post(`/hospital-networks/${networkId}/members`, data)
    return response.data
  }
  async removeNetworkMember(networkId: string, userId: string) {
    const response = await this.client.delete(`/hospital-networks/${networkId}/members/${userId}`)
    return response.data
  }
  async updateNetworkMember(networkId: string, userId: string, data: { networkRole?: string; hospitalId?: string; department?: string }) {
    const response = await this.client.put(`/hospital-networks/${networkId}/members/${userId}`, data)
    return response.data
  }

  async enrollAnimalInNetwork(networkId: string, data: { animalId: string; hospitalId?: string; notes?: string }) {
    const response = await this.client.post(`/hospital-networks/${networkId}/enroll-animal`, data)
    return response.data
  }
  async searchNetworkPatients(networkId: string, q: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/search-patients`, { params: { q } })
    return response.data
  }
  async getAllEnrollments(networkId: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/all-enrollments`)
    return response.data
  }
  async inviteWalkInPatient(networkId: string, data: Record<string, any>) {
    const response = await this.client.post(`/hospital-networks/${networkId}/invite-walkin`, data)
    return response.data
  }
  async registerWalkInPatientDirect(networkId: string, data: {
    hospitalId: string; patientName: string; patientPhone?: string; patientEmail?: string; patientAddress?: string;
    animalName: string; animalSpecies: string; animalBreed?: string;
    animalGender?: string; animalClass?: string; animalDob?: string; animalWeight?: number;
    animalColor?: string; animalMicrochipId?: string; animalRegistrationNumber?: string;
    animalIsNeutered?: boolean; animalMedicalNotes?: string; animalAvatarUrl?: string;
    animalInsuranceProvider?: string; animalInsurancePolicyNumber?: string; animalInsuranceExpiry?: string;
    animalEarTagId?: string;
    reasonForVisit?: string;
    consentCollected?: boolean;
    consentMethod?: string;
  }) {
    const response = await this.client.post(`/hospital-networks/${networkId}/register-walkin`, data)
    return response.data
  }
  async registerWalkInStandalone(hospitalId: string, data: {
    patientName: string; patientPhone?: string; patientEmail?: string; patientAddress?: string;
    animalName: string; animalSpecies: string; animalBreed?: string;
    animalGender?: string; animalClass?: string; animalDob?: string; animalWeight?: number;
    animalColor?: string; animalMicrochipId?: string; animalRegistrationNumber?: string;
    animalIsNeutered?: boolean; animalMedicalNotes?: string; animalAvatarUrl?: string;
    animalInsuranceProvider?: string; animalInsurancePolicyNumber?: string; animalInsuranceExpiry?: string;
    animalEarTagId?: string;
  }) {
    const response = await this.client.post(`/hospitals/${hospitalId}/register-walkin`, data)
    return response.data
  }
  async acceptEnrollment(contextId: string, consentScope?: string) {
    const response = await this.client.post(`/hospital-networks/enrollments/${contextId}/accept`, { consentScope })
    return response.data
  }
  async declineEnrollment(contextId: string) {
    const response = await this.client.post(`/hospital-networks/enrollments/${contextId}/decline`, {})
    return response.data
  }
  async getMyNetworkEnrollments() {
    const response = await this.client.get('/my-network-enrollments')
    return response.data
  }

  // ─── Patient Data Consent ───────────────────────────────────────
  async createPatientConsent(data: Record<string, any>) {
    const response = await this.client.post('/patient-consent', data)
    return response.data
  }
  async listPatientConsents(animalId: string) {
    const response = await this.client.get(`/patient-consent/${animalId}`)
    return response.data
  }
  async revokePatientConsent(consentId: string) {
    const response = await this.client.delete(`/patient-consent/${consentId}`)
    return response.data
  }

  // Role Change Requests
  async submitRoleChangeRequest(data: {
    requested_role: string
    reason: string
    profile?: {
      licenseNumber: string
      specializations?: string[]
      qualifications?: string[]
      yearsOfExperience?: number
      consultationFee?: number
      clinicName?: string
    }
  }) {
    const response = await this.client.post('/role-change-requests', data)
    return response.data
  }
  async getMyRoleChangeRequests() {
    const response = await this.client.get('/role-change-requests/my')
    return response.data
  }
  async cancelRoleChangeRequest(id: string) {
    const response = await this.client.put(`/role-change-requests/${id}/cancel`, {})
    return response.data
  }
  async adminListRoleChangeRequests(status = 'pending') {
    const response = await this.client.get('/admin/role-change-requests', { params: { status } })
    return response.data
  }
  async adminApproveRoleChangeRequest(id: string) {
    const response = await this.client.put(`/admin/role-change-requests/${id}/approve`, {})
    return response.data
  }
  async adminRejectRoleChangeRequest(id: string, rejection_reason: string) {
    const response = await this.client.put(`/admin/role-change-requests/${id}/reject`, { rejection_reason })
    return response.data
  }

  // ── Grooming & Spa ──
  async groomingStatus() {
    const response = await this.client.get('/grooming/status')
    return response.data
  }
  async createGroomingProvider(data: any) {
    const response = await this.client.post('/grooming/providers', data)
    return response.data
  }
  async getMyGroomingProvider() {
    const response = await this.client.get('/grooming/providers/me')
    return response.data
  }
  async updateGroomingProvider(id: string, data: any) {
    const response = await this.client.put(`/grooming/providers/${id}`, data)
    return response.data
  }
  async listGroomingLocations(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/locations`)
    return response.data
  }
  async addGroomingLocation(id: string, data: any) {
    const response = await this.client.post(`/grooming/providers/${id}/locations`, data)
    return response.data
  }
  async deleteGroomingLocation(id: string, locId: string) {
    const response = await this.client.delete(`/grooming/providers/${id}/locations/${locId}`)
    return response.data
  }
  async listGroomingResources(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/resources`)
    return response.data
  }
  async addGroomingResource(id: string, data: any) {
    const response = await this.client.post(`/grooming/providers/${id}/resources`, data)
    return response.data
  }
  async deleteGroomingResource(id: string, resId: string) {
    const response = await this.client.delete(`/grooming/providers/${id}/resources/${resId}`)
    return response.data
  }
  async listGroomingServices(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/services`)
    return response.data
  }
  async addGroomingService(id: string, data: any) {
    const response = await this.client.post(`/grooming/providers/${id}/services`, data)
    return response.data
  }
  async updateGroomingService(id: string, svcId: string, data: any) {
    const response = await this.client.put(`/grooming/providers/${id}/services/${svcId}`, data)
    return response.data
  }
  async deleteGroomingService(id: string, svcId: string) {
    const response = await this.client.delete(`/grooming/providers/${id}/services/${svcId}`)
    return response.data
  }
  async listGroomingStaff(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/staff`)
    return response.data
  }
  async addGroomingStaff(id: string, email: string, role: string) {
    const response = await this.client.post(`/grooming/providers/${id}/staff`, { email, role })
    return response.data
  }
  async removeGroomingStaff(id: string, userId: string) {
    const response = await this.client.delete(`/grooming/providers/${id}/staff/${userId}`)
    return response.data
  }
  async discoverGroomingProviders(params: Record<string, any> = {}) {
    const response = await this.client.get('/grooming/discover', { params })
    return response.data
  }
  async getPublicGroomingProvider(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/public`)
    return response.data
  }
  async adminListGroomingProviders(status = 'pending') {
    const response = await this.client.get('/grooming/admin/providers', { params: { status } })
    return response.data
  }
  async adminVerifyGroomingProvider(id: string) {
    const response = await this.client.put(`/grooming/admin/providers/${id}/verify`, {})
    return response.data
  }
  async adminRejectGroomingProvider(id: string, reason: string) {
    const response = await this.client.put(`/grooming/admin/providers/${id}/reject`, { reason })
    return response.data
  }
  async adminSuspendGroomingProvider(id: string, reason: string) {
    const response = await this.client.put(`/grooming/admin/providers/${id}/suspend`, { reason })
    return response.data
  }
  async createGroomingOrder(data: any) {
    const response = await this.client.post('/grooming/orders', data)
    return response.data
  }
  async listMyGroomingOrders() {
    const response = await this.client.get('/grooming/orders')
    return response.data
  }
  async getGroomingOrder(id: string) {
    const response = await this.client.get(`/grooming/orders/${id}`)
    return response.data
  }
  async createGroomingCheckout(id: string, deposit = false) {
    const response = await this.client.post(`/grooming/orders/${id}/checkout`, { deposit })
    return response.data
  }
  async confirmGroomingPayment(id: string, body: any) {
    const response = await this.client.post(`/grooming/orders/${id}/confirm-payment`, body)
    return response.data
  }
  async createGroomingBalanceCheckout(id: string) {
    const response = await this.client.post(`/grooming/orders/${id}/balance-checkout`, {})
    return response.data
  }
  async confirmGroomingBalancePayment(id: string, body: any) {
    const response = await this.client.post(`/grooming/orders/${id}/confirm-balance`, body)
    return response.data
  }
  async getGroomingRefundPreview(id: string) {
    const response = await this.client.get(`/grooming/orders/${id}/refund-preview`)
    return response.data
  }
  async cancelGroomingOrder(id: string, reason?: string) {
    const response = await this.client.put(`/grooming/orders/${id}/cancel`, { reason })
    return response.data
  }
  async listGroomingProviderOrders(id: string, status?: string) {
    const response = await this.client.get(`/grooming/providers/${id}/orders`, { params: status ? { status } : {} })
    return response.data
  }
  async getGroomingOrderDetail(id: string) {
    const response = await this.client.get(`/grooming/orders/${id}/detail`)
    return response.data
  }
  async transitionGroomingOrder(id: string, toStatus: string, note?: string) {
    const response = await this.client.put(`/grooming/orders/${id}/transition`, { toStatus, note })
    return response.data
  }

  // ── Payables: who the platform currently owes, and payout evidence ──
  async getGroomingPayables() {
    const response = await this.client.get('/grooming/admin/payables')
    return response.data
  }

  async getDoctorPayables() {
    const response = await this.client.get('/admin/withdrawals/payables')
    return response.data
  }

  async getGroomingSettlementStatement(settlementId: string) {
    const response = await this.client.get(`/grooming/settlements/${settlementId}/statement`)
    return response.data
  }

  // ── Wallet withdrawals (038) — money out of the platform ──
  async requestWalletWithdrawal(data: {
    amount: number; method?: string; accountName?: string; accountNumber?: string; ifsc?: string; upiId?: string
  }) {
    const response = await this.client.post('/wallet/withdrawals', data)
    return response.data
  }

  async listMyWalletWithdrawals() {
    const response = await this.client.get('/wallet/withdrawals')
    return response.data
  }

  async cancelWalletWithdrawal(id: string) {
    const response = await this.client.post(`/wallet/withdrawals/${id}/cancel`, {})
    return response.data
  }

  async adminListWalletWithdrawals(status?: string) {
    const response = await this.client.get('/admin/wallet-withdrawals', { params: { status } })
    return response.data
  }

  async adminApproveWalletWithdrawal(id: string, note?: string) {
    const response = await this.client.put(`/admin/wallet-withdrawals/${id}/approve`, { note })
    return response.data
  }

  async adminRejectWalletWithdrawal(id: string, reason: string) {
    const response = await this.client.put(`/admin/wallet-withdrawals/${id}/reject`, { reason })
    return response.data
  }

  async adminSettleWalletWithdrawal(id: string, utrReference: string, note?: string) {
    const response = await this.client.put(`/admin/wallet-withdrawals/${id}/settle`, { utrReference, note })
    return response.data
  }

  // ── Grooming availability & working hours (037) ──
  /** Bookable slots for one provider/date. Sized to the service when one is given. */
  async getGroomingAvailability(providerId: string, date: string, opts: { serviceId?: string; locationId?: string } = {}) {
    const response = await this.client.get(`/grooming/providers/${providerId}/availability`, {
      params: { date, serviceId: opts.serviceId, locationId: opts.locationId },
    })
    return response.data
  }

  /** Which days in a month have any capacity — drives the booking calendar. */
  async getGroomingMonthAvailability(providerId: string, year: number, month: number, opts: { serviceId?: string; locationId?: string } = {}) {
    const response = await this.client.get(`/grooming/providers/${providerId}/availability/month`, {
      params: { year, month, serviceId: opts.serviceId, locationId: opts.locationId },
    })
    return response.data
  }

  async listGroomingSchedules(providerId: string) {
    const response = await this.client.get(`/grooming/providers/${providerId}/schedules`)
    return response.data
  }

  async saveGroomingSchedule(providerId: string, data: any) {
    const response = await this.client.put(`/grooming/providers/${providerId}/schedules`, data)
    return response.data
  }

  async deleteGroomingSchedule(providerId: string, scheduleId: string) {
    const response = await this.client.delete(`/grooming/providers/${providerId}/schedules/${scheduleId}`)
    return response.data
  }

  async listGroomingDateOverrides(providerId: string, from?: string, to?: string) {
    const response = await this.client.get(`/grooming/providers/${providerId}/date-overrides`, { params: { from, to } })
    return response.data
  }

  async saveGroomingDateOverride(providerId: string, data: any) {
    const response = await this.client.put(`/grooming/providers/${providerId}/date-overrides`, data)
    return response.data
  }

  async deleteGroomingDateOverride(providerId: string, overrideId: string) {
    const response = await this.client.delete(`/grooming/providers/${providerId}/date-overrides/${overrideId}`)
    return response.data
  }

  async listGroomingBlockedSlots(providerId: string) {
    const response = await this.client.get(`/grooming/providers/${providerId}/blocked-slots`)
    return response.data
  }

  async createGroomingBlockedSlot(providerId: string, data: any) {
    const response = await this.client.post(`/grooming/providers/${providerId}/blocked-slots`, data)
    return response.data
  }

  async deleteGroomingBlockedSlot(providerId: string, slotId: string) {
    const response = await this.client.delete(`/grooming/providers/${providerId}/blocked-slots/${slotId}`)
    return response.data
  }

  /** Provider accepts a paid booking sitting at the acceptance gate → confirmed. */
  async acceptGroomingOrder(id: string, note?: string) {
    const response = await this.client.put(`/grooming/orders/${id}/accept`, { note })
    return response.data
  }

  /** Provider declines a paid booking → customer is refunded in full. Reason is required. */
  async declineGroomingOrder(id: string, reason: string) {
    const response = await this.client.put(`/grooming/orders/${id}/decline`, { reason })
    return response.data
  }
  async assignGroomingOrder(id: string, data: any) {
    const response = await this.client.put(`/grooming/orders/${id}/assign`, data)
    return response.data
  }
  async saveGroomingIntake(id: string, data: any) {
    const response = await this.client.put(`/grooming/orders/${id}/intake`, data)
    return response.data
  }
  async updateGroomingItem(id: string, itemId: string, status: string, reason?: string) {
    const response = await this.client.put(`/grooming/orders/${id}/items/${itemId}`, { status, reason })
    return response.data
  }
  async createGroomingReportCard(id: string, data: any) {
    const response = await this.client.put(`/grooming/orders/${id}/report-card`, data)
    return response.data
  }
  async getGroomingEarnings(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/earnings`)
    return response.data
  }
  async listGroomingSettlements(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/settlements`)
    return response.data
  }
  async adminSettleGrooming(id: string, data: any) {
    const response = await this.client.post(`/grooming/admin/providers/${id}/settle`, data)
    return response.data
  }
  async adminGroomingReconciliation() {
    const response = await this.client.get('/grooming/admin/reconciliation')
    return response.data
  }
  async requestGroomingVariableItem(id: string, data: any) {
    const response = await this.client.post(`/grooming/orders/${id}/variable-items`, data)
    return response.data
  }
  async respondGroomingVariableItem(id: string, itemId: string, approve: boolean) {
    const response = await this.client.put(`/grooming/orders/${id}/variable-items/${itemId}/respond`, { approve })
    return response.data
  }
  async raiseGroomingEscalation(id: string, data: any) {
    const response = await this.client.post(`/grooming/orders/${id}/escalations`, data)
    return response.data
  }
  async listGroomingEscalations(id: string) {
    const response = await this.client.get(`/grooming/orders/${id}/escalations`)
    return response.data
  }
  async respondGroomingEscalation(escId: string, status: string, consultationBookingId?: string) {
    const response = await this.client.put(`/grooming/escalations/${escId}/respond`, { status, consultationBookingId })
    return response.data
  }
  async getGroomingPetPassport(animalId: string) {
    const response = await this.client.get(`/grooming/pets/${animalId}/passport`)
    return response.data
  }
  async raiseGroomingDispute(id: string, data: any) {
    const response = await this.client.post(`/grooming/orders/${id}/disputes`, data)
    return response.data
  }
  async listMyGroomingDisputes() {
    const response = await this.client.get('/grooming/disputes/mine')
    return response.data
  }
  async listGroomingProviderDisputes(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/disputes`)
    return response.data
  }
  async respondGroomingDispute(disputeId: string, data: any) {
    const response = await this.client.put(`/grooming/disputes/${disputeId}/respond`, data)
    return response.data
  }
  /** Platform-wide dispute queue. Optional status filter; omit for all. */
  async adminListGroomingDisputes(status?: string) {
    const response = await this.client.get('/grooming/admin/disputes', { params: status ? { status } : undefined })
    return response.data
  }
  /** A single provider's earnings ledger, for reviewing what is owed before settling. */
  async adminGroomingProviderEarnings(providerId: string) {
    const response = await this.client.get(`/grooming/admin/providers/${providerId}/earnings`)
    return response.data
  }
  async getGroomingProviderReport(id: string) {
    const response = await this.client.get(`/grooming/providers/${id}/report`)
    return response.data
  }
  async getGroomingPlatformReport() {
    const response = await this.client.get('/grooming/admin/report')
    return response.data
  }

  // ── Network Subscription Plans ──
  async getNetworkSubscriptionPlans() {
    const response = await this.client.get('/network-subscription-plans')
    return response.data
  }
  async createNetworkPlan(data: Record<string, unknown>) {
    const response = await this.client.post('/admin/network-subscription-plans', data)
    return response.data
  }
  async updateNetworkPlan(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/admin/network-subscription-plans/${id}`, data)
    return response.data
  }
  async deleteNetworkPlan(id: string) {
    const response = await this.client.delete(`/admin/network-subscription-plans/${id}`)
    return response.data
  }

  // ── Network Subscriptions ──
  async adminListNetworkSubscriptions() {
    const response = await this.client.get('/admin/network-subscriptions')
    return response.data
  }
  async setNetworkSubscription(networkId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/admin/networks/${networkId}/set-subscription`, data)
    return response.data
  }
  async overrideSeatLimit(networkId: string, seatLimit: number, adminNotes?: string) {
    const response = await this.client.put(`/admin/networks/${networkId}/override-seat-limit`, { seat_limit: seatLimit, admin_notes: adminNotes })
    return response.data
  }
  async suspendNetwork(networkId: string, suspensionReason: string) {
    const response = await this.client.post(`/admin/networks/${networkId}/suspend`, { suspension_reason: suspensionReason })
    return response.data
  }
  async unsuspendNetwork(networkId: string) {
    const response = await this.client.post(`/admin/networks/${networkId}/unsuspend`, {})
    return response.data
  }
  async getMyNetworkSubscription() {
    const response = await this.client.get('/my-network-subscription')
    return response.data
  }

  // ── Pricing (public + admin) ──
  async getPricingPlans() {
    const response = await this.client.get('/pricing/plans')
    return response.data
  }
  async getPricingSettings() {
    const response = await this.client.get('/admin/pricing-settings')
    return response.data
  }
  async updatePricingSettings(settings: Record<string, string>) {
    const response = await this.client.put('/admin/pricing-settings', settings)
    return response.data
  }

  // ── Hospital Staff Invites ──
  async inviteHospitalStaff(networkId: string, data: { inviteeEmail: string; inviteeName?: string; staffPosition: string; hospitalId?: string; expiresInHours?: number }) {
    const response = await this.client.post(`/hospital-networks/${networkId}/staff-invites`, data)
    return response.data
  }
  async listStaffInvites(networkId: string) {
    const response = await this.client.get(`/hospital-networks/${networkId}/staff-invites`)
    return response.data
  }
  async revokeStaffInvite(networkId: string, inviteId: string) {
    const response = await this.client.delete(`/hospital-networks/${networkId}/staff-invites/${inviteId}`)
    return response.data
  }

  // Audit log export
  async exportAuditLogs(networkId: string): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/audit-logs/export`, {
      responseType: 'blob'
    })
  }

  // Financial summary
  async getNetworkFinancialSummary(networkId: string): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/financial-summary`)
  }

  // Leave management
  async listLeaveRequests(networkId: string, params: Record<string, any> = {}): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/leave-requests`, { params })
  }
  async createLeaveRequest(networkId: string, data: Record<string, any>): Promise<any> {
    return this.client.post(`/hospital-networks/${networkId}/leave-requests`, data)
  }
  async updateLeaveRequest(networkId: string, requestId: string, data: Record<string, any>): Promise<any> {
    return this.client.patch(`/hospital-networks/${networkId}/leave-requests/${requestId}`, data)
  }

  // Patient transfers
  async listPatientTransfers(networkId: string): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/patient-transfers`)
  }
  async createPatientTransfer(networkId: string, data: Record<string, any>): Promise<any> {
    return this.client.post(`/hospital-networks/${networkId}/patient-transfers`, data)
  }
  async completePatientTransfer(networkId: string, transferId: string): Promise<any> {
    return this.client.post(`/hospital-networks/${networkId}/patient-transfers/${transferId}/complete`)
  }

  async getStaffInviteByToken(token: string) {
    const response = await this.client.get(`/hospital-staff-invites/token/${token}`)
    return response.data
  }
  async acceptStaffInvite(data: { token: string; first_name: string; last_name: string; phone?: string; password: string; acceptTerms?: boolean }) {
    const response = await this.client.post('/hospital-staff-invites/accept', data)
    return response.data
  }

  // ── Network Referrals ──
  async createNetworkReferral(data: {
    networkId: string;
    fromHospitalId: string;
    toHospitalId: string;
    toVetId?: string;
    animalId: string;
    consultationId?: string;
    reason: string;
    priority?: string;
    clinicalNotes?: string;
  }): Promise<any> {
    const response = await this.client.post('/network-referrals', data)
    return response.data
  }

  async updateNetworkReferralStatus(referralId: string, status: string, responseNotes?: string): Promise<any> {
    const response = await this.client.patch(`/network-referrals/${referralId}/status`, { status, responseNotes })
    return response.data
  }

  async listNetworkReferrals(params: {
    networkId?: string;
    hospitalId?: string;
    direction?: 'incoming' | 'outgoing' | 'all';
    animalId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get('/network-referrals', { params })
    return response.data
  }

  // ── Corporate Admin ──
  async getCorporateDashboardStats(): Promise<any> {
    return this.client.get('/dashboard/corporate')
  }

  async getHospitalStaffDashboard(): Promise<any> {
    return this.client.get('/dashboard/hospital-staff')
  }

  async searchNetworkUsers(query: string): Promise<any> {
    return this.client.get('/network-user-search', { params: { q: query } })
  }

  async createBranchHospital(networkId: string, data: {
    name: string;
    hospitalType?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    description?: string;
  }): Promise<any> {
    return this.client.post(`/hospital-networks/${networkId}/branch-hospitals`, data)
  }

  async updateBranchHospital(networkId: string, hospitalId: string, data: Record<string, any>): Promise<any> {
    return this.client.put(`/hospital-networks/${networkId}/branch-hospitals/${hospitalId}`, data)
  }

  async deleteBranchHospital(networkId: string, hospitalId: string): Promise<any> {
    return this.client.delete(`/hospital-networks/${networkId}/branch-hospitals/${hospitalId}`)
  }

  // P5-ANALYTICS
  async getNetworkAnalytics(networkId: string): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/analytics`)
  }

  // P5-COMPLIANCE-EXPORT
  async getNetworkComplianceReport(networkId: string, from: string, to: string): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/compliance-report`, { params: { from, to } })
  }

  // P6-APPROVAL
  async getNetworkApprovalHistory(networkId: string): Promise<any> {
    return this.client.get(`/hospital-networks/${networkId}/approval-history`)
  }

  async addNetworkApprovalEvent(networkId: string, eventType: string, notes?: string): Promise<any> {
    return this.client.post(`/hospital-networks/${networkId}/approval-events`, { eventType, notes })
  }

  // P6-BRANDING
  async updateNetworkBranding(networkId: string, data: Record<string, any>): Promise<any> {
    return this.client.put(`/hospital-networks/${networkId}/branding`, data)
  }

  // P6-NOTIFICATIONS
  async getNotificationPreferences(): Promise<any> {
    return this.client.get('/notification-preferences')
  }

  async updateNotificationPreferences(prefs: Record<string, any>): Promise<any> {
    return this.client.put('/notification-preferences', prefs)
  }
}
export const apiService = new ApiService()
export default apiService

// ── RESPONSE STANDARDIZATION UTILITIES ──
// All API responses should follow { success, data, error, total } shape
// This helper safely extracts arrays/items from inconsistent response shapes
export function extractArrayFromResponse(response: any, fallbackArrays: string[] = []): any[] {
  // Direct array response
  if (Array.isArray(response)) return response

  // Try response.data first (most common)
  if (Array.isArray(response.data)) return response.data

  // Try nested arrays (res.data.items, res.data.animals, etc.)
  for (const key of fallbackArrays) {
    if (Array.isArray(response.data?.[key])) return response.data[key]
  }

  // Fallback: if response.data is an object, try common item keys
  const data = response.data || response
  if (typeof data === 'object' && !Array.isArray(data)) {
    for (const key of ['items', 'data', 'animals', 'users', 'records', 'consultations', 'bookings']) {
      if (Array.isArray(data[key])) return data[key]
    }
  }

  return []
}

export function extractTotalFromResponse(response: any): number {
  return response.total || response.data?.total || 0
}


