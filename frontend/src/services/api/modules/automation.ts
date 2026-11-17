import { sharedClient } from '../core'

export const automationApi = {
  // ─── Staff & Workflow Management ────────────────────────────

  // Staff Positions
  async listStaffPositions(hospitalId: string) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/staff`)
    return response.data
  },
  async addStaffPosition(hospitalId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/hospitals/${hospitalId}/staff`, data)
    return response.data
  },
  async updateStaffPosition(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/staff-positions/${id}`, data)
    return response.data
  },
  async removeStaffPosition(id: string) {
    const response = await sharedClient.delete(`/staff-positions/${id}`)
    return response.data
  },

  // Appointment Queue
  async searchWorkflowAnimals(query: string, hospitalId?: string) {
    const response = await sharedClient.get('/workflow/animals/search', { params: { q: query, hospitalId } })
    return response.data
  },
  async getAnimalMedicalSummary(animalId: string) {
    const response = await sharedClient.get(`/workflow/animals/${animalId}/medical-summary`)
    return response.data
  },
  async getQueue(hospitalId: string, status?: string) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/queue`, { params: { status } })
    return response.data
  },
  async checkInToQueue(hospitalId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/hospitals/${hospitalId}/queue/check-in`, data)
    return response.data
  },
  async triagePatient(queueId: string, data: Record<string, unknown>) {
    const response = await sharedClient.patch(`/queue/${queueId}/triage`, data)
    return response.data
  },
  async updateQueueStatus(queueId: string, status: string) {
    const response = await sharedClient.patch(`/queue/${queueId}/status`, { status })
    return response.data
  },
  async getQueueStats(hospitalId: string) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/queue/stats`)
    return response.data
  },

  // Workflow Cases
  async getWorkflowDashboard(hospitalId: string) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/workflow/dashboard`)
    return response.data
  },
  async listWorkflowCases(hospitalId: string, filters?: Record<string, unknown>) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/workflow/cases`, { params: filters })
    return response.data
  },
  async createWorkflowCase(hospitalId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/hospitals/${hospitalId}/workflow/cases`, data)
    return response.data
  },
  async getWorkflowCaseDetail(caseId: string) {
    const response = await sharedClient.get(`/workflow/cases/${caseId}`)
    return response.data
  },
  async updateWorkflowCase(caseId: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/workflow/cases/${caseId}`, data)
    return response.data
  },
  async transitionWorkflowStage(caseId: string, toStage: string, notes?: string) {
    const response = await sharedClient.patch(`/workflow/cases/${caseId}/transition`, { toStage, notes })
    return response.data
  },

  // Referrals
  async listReferrals(hospitalId: string, filters?: Record<string, unknown>) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/referrals`, { params: filters })
    return response.data
  },
  async createReferral(hospitalId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/hospitals/${hospitalId}/referrals`, data)
    return response.data
  },
  async updateReferralStatus(referralId: string, status: string, responseNotes?: string) {
    const response = await sharedClient.patch(`/referrals/${referralId}/status`, { status, responseNotes })
    return response.data
  },

  // Inpatient / Boarding
  async getInpatientDashboard(hospitalId: string) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/inpatient/dashboard`)
    return response.data
  },
  async listInpatients(hospitalId: string, status?: string) {
    const response = await sharedClient.get(`/hospitals/${hospitalId}/inpatient`, { params: { status } })
    return response.data
  },
  async admitPatient(hospitalId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/hospitals/${hospitalId}/inpatient/admit`, data)
    return response.data
  },
  async updateInpatientStatus(admissionId: string, status: string, notes?: string) {
    const response = await sharedClient.patch(`/inpatient/${admissionId}/status`, { status, notes })
    return response.data
  },
  async addVitalsLog(admissionId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/inpatient/${admissionId}/vitals`, data)
    return response.data
  },
  async getAnimalHospitalVisits(animalId: string) {
    const response = await sharedClient.get(`/animals/${animalId}/hospital-visits`)
    return response.data
  },
  async searchVets(query: string) {
    const response = await sharedClient.get('/vets/search', { params: { q: query } })
    return response.data
  },
  async updateInpatientDetails(admissionId: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/inpatient/${admissionId}`, data)
    return response.data
  },

  // ═══════════════════════════════════════════════════════════════
  // Next-Generation Innovative Features
  // ═══════════════════════════════════════════════════════════════

  // ─── AI Veterinary Copilot ──────────────────────────────────
  async listChatSessions(filters: any = {}) {
    const response = await sharedClient.get('/ai-copilot/sessions', { params: filters })
    return response.data
  },

  async createChatSession(data: any) {
    const response = await sharedClient.post('/ai-copilot/sessions', data)
    return response.data
  },

  async getChatSession(id: string) {
    const response = await sharedClient.get(`/ai-copilot/sessions/${id}`)
    return response.data
  },

  async deleteChatSession(id: string) {
    const response = await sharedClient.delete(`/ai-copilot/sessions/${id}`)
    return response.data
  },

  async listChatMessages(sessionId: string) {
    const response = await sharedClient.get(`/ai-copilot/sessions/${sessionId}/messages`)
    return response.data
  },

  async sendChatMessage(sessionId: string, content: string) {
    const response = await sharedClient.post(`/ai-copilot/sessions/${sessionId}/messages`, { content })
    return response.data
  },

  async checkDrugInteractions(drugs: string[]) {
    const response = await sharedClient.post('/ai-copilot/drug-interactions', { drugs })
    return response.data
  },

  async analyzeSymptoms(symptoms: string[], species?: string) {
    const response = await sharedClient.post('/ai-copilot/symptom-analysis', { symptoms, species })
    return response.data
  },

  async analyzeScan(file: File, context?: { species?: string; scanType?: string; bodyPart?: string; notes?: string }) {
    const formData = new FormData()
    formData.append('image', file)
    if (context?.species) formData.append('species', context.species)
    if (context?.scanType) formData.append('scanType', context.scanType)
    if (context?.bodyPart) formData.append('bodyPart', context.bodyPart)
    if (context?.notes) formData.append('notes', context.notes)
    const response = await sharedClient.post('/ai-copilot/analyze-scan', formData, { headers: { 'Content-Type': undefined }, timeout: 60000 })
    return response.data
  },

  // ─── Digital Twin & Simulator ───────────────────────────────
  async getDigitalTwinDashboard(enterpriseId: string) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/digital-twins/dashboard`)
    return response.data
  },

  async listDigitalTwins(enterpriseId: string, filters: any = {}) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/digital-twins`, { params: filters })
    return response.data
  },

  async createDigitalTwin(enterpriseId: string, data: any) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/digital-twins`, data)
    return response.data
  },

  async updateDigitalTwin(id: string, data: any) {
    const response = await sharedClient.put(`/digital-twins/${id}`, data)
    return response.data
  },

  async deleteDigitalTwin(id: string) {
    const response = await sharedClient.delete(`/digital-twins/${id}`)
    return response.data
  },

  async listSimulations(enterpriseId: string, filters: any = {}) {
    const response = await sharedClient.get(`/enterprises/${enterpriseId}/simulations`, { params: filters })
    return response.data
  },

  async runSimulation(enterpriseId: string, data: any) {
    const response = await sharedClient.post(`/enterprises/${enterpriseId}/simulations`, data)
    return response.data
  },

  async getSimulation(id: string) {
    const response = await sharedClient.get(`/simulations/${id}`)
    return response.data
  },

  async deleteSimulation(id: string) {
    const response = await sharedClient.delete(`/simulations/${id}`)
    return response.data
  }

}
