import { sharedClient, fetchCsrfToken } from '../core'

export const authApi = {
  async fetchCsrfToken(): Promise<void> {
    return fetchCsrfToken()
  },

  // ─── Batch (flock/herd) management ─────────────────────────
  async listGroupCycles(groupId: string) {
    return (await sharedClient.get(`/animal-groups/${groupId}/cycles`)).data
  },
  async getActiveGroupCycle(groupId: string) {
    return (await sharedClient.get(`/animal-groups/${groupId}/cycles/active`)).data
  },
  async openGroupCycle(groupId: string, data: { name?: string; species?: string; breed?: string; placedCount: number; startedAt?: string; notes?: string }) {
    return (await sharedClient.post(`/animal-groups/${groupId}/cycles`, data)).data
  },
  async closeGroupCycle(cycleId: string, reason?: string) {
    return (await sharedClient.post(`/group-cycles/${cycleId}/close`, { reason })).data
  },
  async listPopulationEvents(groupId: string, cycleId?: string) {
    return (await sharedClient.get(`/animal-groups/${groupId}/population-events`, { params: { cycleId } })).data
  },
  async recordPopulationEvent(groupId: string, data: { cycleId?: string; eventType: string; quantity: number; eventDate?: string; reason?: string; sourceRef?: string }) {
    return (await sharedClient.post(`/animal-groups/${groupId}/population-events`, data)).data
  },
  async reconcileGroup(groupId: string) {
    return (await sharedClient.get(`/animal-groups/${groupId}/reconcile`)).data
  },
  /** Flock health as rates: mortality %, morbidity %, treatment coverage, survival. */
  async getGroupHealthMetrics(groupId: string, cycleId?: string) {
    return (await sharedClient.get(`/animal-groups/${groupId}/health-metrics`, { params: { cycleId } })).data
  },
  async getGroupWithdrawal(groupId: string) {
    return (await sharedClient.get(`/animal-groups/${groupId}/withdrawal`)).data
  },
  async promoteAnimalFromBatch(groupId: string, data: { animalId: string; cycleId?: string; reason?: string }) {
    return (await sharedClient.post(`/animal-groups/${groupId}/promote`, data)).data
  },
  /** An animal's own records PLUS the group records that applied while it was in that cycle. */
  async getAnimalLifetimeHistory(animalId: string) {
    return (await sharedClient.get(`/animals/${animalId}/lifetime-history`)).data
  },

  // ─── Auth ──────────────────────────────────────────────────
  async login(email: string, password: string) {
    const response = await sharedClient.post('/auth/login', { email, password })
    return response.data
  },

  async register(data: { firstName: string; lastName: string; email: string; phone: string; password: string; role: string; acceptTerms?: boolean; [key: string]: any }) {
    const response = await sharedClient.post('/auth/register', data)
    return response.data
  },

  async forgotPassword(email: string) {
    const response = await sharedClient.post('/auth/forgot-password', { email })
    return response.data
  },

  async validateResetToken(token: string) {
    const response = await sharedClient.get('/auth/reset-password/validate', { params: { token } })
    return response.data
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await sharedClient.post('/auth/reset-password', { token, newPassword })
    return response.data
  },

  /** Generic HTTP GET - use for ad-hoc endpoints without a typed wrapper */
  async get(url: string, config?: { params?: Record<string, any> }) {
    return sharedClient.get(url, config)
  },

  async getProfile() {
    const response = await sharedClient.get('/auth/profile')
    return response.data
  },

  async updateProfile(data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }) {
    const response = await sharedClient.put('/auth/profile', data)
    return response.data
  },

  async uploadFile(file: File, folder?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) formData.append('folder', folder)
    const response = await sharedClient.post('/files/upload', formData, { headers: { 'Content-Type': undefined } })
    return response.data
  },

  async uploadImageFile(file: File, folder?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) formData.append('folder', folder)
    const response = await sharedClient.post('/files/upload-image', formData, { headers: { 'Content-Type': undefined } })
    return response.data
  },

  async uploadVideoFile(file: File, folder?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) formData.append('folder', folder)
    const response = await sharedClient.post('/files/upload-video', formData, { headers: { 'Content-Type': undefined } })
    return response.data
  }

}
