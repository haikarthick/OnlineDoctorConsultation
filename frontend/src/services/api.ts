import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = '/api/v1'

/** Read a cookie value by name */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

class ApiService {
  private client: AxiosInstance
  private csrfToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor - attach auth token + CSRF token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('authToken')
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        // Attach CSRF token for state-changing requests
        const method = (config.method || '').toUpperCase()
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const csrf = this.csrfToken || getCookie('__csrf')
          if (csrf && config.headers) {
            config.headers['X-CSRF-Token'] = csrf
          }
        }
        return config
      },
      (error: AxiosError) => Promise.reject(error)
    )

    // Response interceptor - handle common errors
    this.client.interceptors.response.use(
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
              return this.client.request(originalConfig)
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
            await this.fetchCsrfToken()
            originalConfig._csrfRetry = true
            return this.client.request(originalConfig)
          }
        }
        return Promise.reject(error)
      }
    )

    // Fetch initial CSRF token
    this.fetchCsrfToken().catch(() => { /* silent — will retry on 403 */ })
  }

  /** Fetch a CSRF token from the server and cache it */
  async fetchCsrfToken(): Promise<void> {
    try {
      const response = await this.client.get('/csrf-token')
      this.csrfToken = response.data.csrfToken
    } catch {
      // non-fatal; requests without cookies bypass CSRF anyway
    }
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

  async listConsultations(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await this.client.get('/consultations', { params })
    return response.data
  }

  // ─── Bookings ─────────────────────────────────────────────
  async createBooking(data: {
    veterinarianId: string; animalId?: string; enterpriseId?: string; groupId?: string;
    scheduledDate: string;
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

  async getPrescriptionsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/prescriptions/animal/${animalId}`, { params })
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

  // ─── Animals ──────────────────────────────────────────────
  async createAnimal(data: { name: string; species: string; breed?: string; gender?: string; weight?: number; color?: string; medicalNotes?: string; dateOfBirth?: string; microchipId?: string; earTagId?: string; registrationNumber?: string; isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceExpiry?: string }) {
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
  async getAnimalTimeline(animalId: string, params?: { limit?: number }) {
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

  async updateOrderStatus(id: string, status: string) {
    const response = await this.client.patch(`/marketplace/orders/${id}/status`, { status })
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
}

export const apiService = new ApiService()
export default apiService
