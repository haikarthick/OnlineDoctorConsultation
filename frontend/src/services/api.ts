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
  async createConsultation(data: { veterinarianId: string; animalType: string; symptomDescription: string; scheduledAt?: string }) {
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

  // ─── Payments (feature-gated) ──────────────────────────────
  async createPayment(data: { consultationId: string; amount: number; currency?: string; paymentMethod?: string }) {
    const response = await this.client.post('/payments', data)
    return response.data
  }

  async listPayments(params?: { limit?: number; offset?: number }) {
    const response = await this.client.get('/payments', { params })
    return response.data
  }

  // ─── Reviews ───────────────────────────────────────────────
  async createReview(data: { consultationId: string; veterinarianId: string; rating: number; comment?: string }) {
    const response = await this.client.post('/reviews', data)
    return response.data
  }

  async listVetReviews(vetId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.client.get(`/reviews/vet/${vetId}`, { params })
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
