import { sharedClient } from '../core'

export const medicalRecordsApi = {
  // ─── Prescriptions ────────────────────────────────────────
  async createPrescription(data: {
    consultationId?: string; petOwnerId?: string; animalId?: string;
    medications: { name: string; dosage: string; frequency: string; duration: string; instructions?: string }[];
    instructions: string; validUntil?: string; diagnosis?: string; followUpDate?: string
  }) {
    const response = await sharedClient.post('/prescriptions', data)
    return response.data
  },

  async getPrescription(id: string) {
    const response = await sharedClient.get(`/prescriptions/${id}`)
    return response.data
  },

  async getMyPrescriptions(params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get('/prescriptions/me', { params })
    return response.data
  },

  async getPrescriptionsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/prescriptions/animal/${animalId}`, { params })
    return response.data
  },

  async getVetPharmacyStats() {
    const response = await sharedClient.get('/vet/pharmacy-stats')
    return response.data
  },

  async getConsultationsByAnimal(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/consultations/animal/${animalId}`, { params })
    return response.data
  },

  async getPrescriptionsByConsultation(consultationId: string) {
    const response = await sharedClient.get(`/prescriptions/consultation/${consultationId}`)
    return response.data
  },

  async deactivatePrescription(id: string) {
    const response = await sharedClient.put(`/prescriptions/${id}/deactivate`)
    return response.data
  },

  async listPatients(params?: { limit?: number; search?: string }) {
    const response = await sharedClient.get('/prescriptions/patients', { params })
    return response.data
  },

  // ─── Veterinary Certificates ──────────────────────────────
  async createCertificate(data: {
    certificateType: string; animalId?: string; petOwnerId?: string;
    consultationId?: string; bookingId?: string; enterpriseId?: string;
    examinationDate?: string; clinicalFindings?: string; diagnosis?: string;
    treatmentSummary?: string; recommendations?: string;
    vaccinationDetails?: object; travelDetails?: object;
    breedingDetails?: object; valuationDetails?: object; movementDetails?: object; herdDetails?: object;
    groupId?: string; cycleId?: string;
    validUntil?: string; notes?: string;
  }) {
    const response = await sharedClient.post('/certificates', data)
    return response.data
  },

  async getMyCertificates(params?: { limit?: number; offset?: number; type?: string; status?: string; animalId?: string; search?: string }) {
    const response = await sharedClient.get('/certificates/me', { params })
    return response.data
  },

  async getCertificate(id: string) {
    const response = await sharedClient.get(`/certificates/${id}`)
    return response.data
  },

  async getCertificatesByAnimal(animalId: string) {
    const response = await sharedClient.get(`/certificates/animal/${animalId}`)
    return response.data
  },

  async updateCertificate(id: string, data: {
    examinationDate?: string; clinicalFindings?: string; diagnosis?: string;
    treatmentSummary?: string; recommendations?: string;
    vaccinationDetails?: object; travelDetails?: object;
    breedingDetails?: object; valuationDetails?: object; movementDetails?: object; herdDetails?: object;
    groupId?: string; cycleId?: string;
    validUntil?: string; notes?: string; animalId?: string; petOwnerId?: string; consultationId?: string;
  }) {
    const response = await sharedClient.put(`/certificates/${id}`, data)
    return response.data
  },

  async issueCertificate(id: string) {
    const response = await sharedClient.put(`/certificates/${id}/issue`)
    return response.data
  },

  async revokeCertificate(id: string, reason: string) {
    const response = await sharedClient.put(`/certificates/${id}/revoke`, { reason })
    return response.data
  },

  async deleteCertificate(id: string) {
    const response = await sharedClient.delete(`/certificates/${id}`)
    return response.data
  },

  // ─── Animals ──────────────────────────────────────────────
  async createAnimal(data: { name: string; species: string; breed?: string; gender?: string; weight?: number; color?: string; medicalNotes?: string; dateOfBirth?: string; microchipId?: string; earTagId?: string; registrationNumber?: string; isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string; insuranceExpiry?: string }) {
    const response = await sharedClient.post('/animals', data)
    return response.data
  },

  async getAnimal(id: string) {
    const response = await sharedClient.get(`/animals/${id}`)
    return response.data
  },

  async listAnimals(params?: { limit?: number; offset?: number; view?: string; ownerId?: string }) {
    const response = await sharedClient.get('/animals', { params })
    return response.data
  },

  async searchAnimalByUniqueId(uid: string) {
    const response = await sharedClient.get('/animals/search/by-uid', { params: { uid } })
    return response.data
  },

  async updateAnimal(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/animals/${id}`, data)
    return response.data
  },

  async deleteAnimal(id: string) {
    const response = await sharedClient.delete(`/animals/${id}`)
    return response.data
  },

  // ─── Vet Profiles ─────────────────────────────────────────
  async createVetProfile(data: Record<string, unknown>) {
    const response = await sharedClient.post('/vet-profiles', data)
    return response.data
  },

  async getMyVetProfile() {
    const response = await sharedClient.get('/vet-profiles/me')
    return response.data
  },

  async listVets(params?: {
    limit?: number; offset?: number; specialization?: string;
    language?: string; acceptsEmergency?: string; availableOnly?: string;
    minRating?: number; minFee?: number; maxFee?: number;
    search?: string; sortBy?: string; sortOrder?: string;
  }) {
    const response = await sharedClient.get('/vet-profiles', { params })
    return response.data
  },

  async getVetProfile(userId: string) {
    const response = await sharedClient.get(`/vet-profiles/${userId}`)
    return response.data
  },

  async updateVetProfile(data: Record<string, unknown>) {
    const response = await sharedClient.put('/vet-profiles', data)
    return response.data
  },

  // ─── Medical Records ──────────────────────────────────────
  /**
   * A record has ONE subject: animalId OR groupId. Group records carry the batch facts
   * (head count treated, affected, mortality) - a 5,000-bird flock is one record, not 5,000.
   */
  async createMedicalRecord(data: { recordType: string; title: string; content: string; animalId?: string; groupId?: string; cycleId?: string; eventDate?: string; headCountTreated?: number; affectedCount?: number; mortalityCount?: number; consultationId?: string; veterinarianId?: string; severity?: string; medications?: any[]; attachments?: any[]; isConfidential?: boolean; followUpDate?: string; tags?: string[]; userId?: string }) {
    const response = await sharedClient.post('/medical-records', data)
    return response.data
  },

  async listMedicalRecords(params?: { limit?: number; offset?: number; animalId?: string; recordType?: string; status?: string; severity?: string; search?: string }) {
    const response = await sharedClient.get('/medical-records', { params })
    return response.data
  },

  async getMedicalRecord(id: string) {
    const response = await sharedClient.get(`/medical-records/${id}`)
    return response.data
  },

  async updateMedicalRecord(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/medical-records/${id}`, data)
    return response.data
  },

  async deleteMedicalRecord(id: string) {
    const response = await sharedClient.delete(`/medical-records/${id}`)
    return response.data
  },

  async getMedicalStats(params?: { animalId?: string }) {
    const response = await sharedClient.get('/medical-records/stats', { params })
    return response.data
  },

  async getMedicalAuditLog(params?: { recordId?: string; recordType?: string; action?: string; limit?: number; offset?: number }) {
    const response = await sharedClient.get('/medical-records/audit', { params })
    return response.data
  },

  // ─── Vaccinations ─────────────────────────────────────────
  /** animalId OR groupId - see createMedicalRecord. */
  async createVaccination(data: { animalId?: string; groupId?: string; cycleId?: string; headCountTreated?: number; vaccineName: string; dateAdministered: string; vaccineType?: string; batchNumber?: string; manufacturer?: string; nextDueDate?: string; siteOfAdministration?: string; dosage?: string; reactionNotes?: string; certificateNumber?: string }) {
    const response = await sharedClient.post('/vaccinations', data)
    return response.data
  },

  async listVaccinations(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/vaccinations/animal/${animalId}`, { params })
    return response.data
  },

  async updateVaccination(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/vaccinations/${id}`, data)
    return response.data
  },

  async deleteVaccination(id: string) {
    const response = await sharedClient.delete(`/vaccinations/${id}`)
    return response.data
  },

  // ─── Weight History ───────────────────────────────────────
  async addWeight(data: { animalId: string; weight: number; unit?: string; notes?: string }) {
    const response = await sharedClient.post('/weight-history', data)
    return response.data
  },

  async listWeightHistory(animalId: string, params?: { limit?: number }) {
    const response = await sharedClient.get(`/weight-history/animal/${animalId}`, { params })
    return response.data
  },

  // ─── Allergies ────────────────────────────────────────────
  async createAllergy(data: { animalId: string; allergen: string; reaction?: string; severity?: string; identifiedDate?: string; notes?: string }) {
    const response = await sharedClient.post('/allergies', data)
    return response.data
  },

  async listAllergies(animalId: string) {
    const response = await sharedClient.get(`/allergies/animal/${animalId}`)
    return response.data
  },

  async updateAllergy(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/allergies/${id}`, data)
    return response.data
  },

  // ─── Lab Results ──────────────────────────────────────────
  async createLabResult(data: { animalId: string; testName: string; testDate: string; testCategory?: string; resultValue?: string; normalRange?: string; unit?: string; status?: string; interpretation?: string; labName?: string; isAbnormal?: boolean; notes?: string }) {
    const response = await sharedClient.post('/lab-results', data)
    return response.data
  },

  async listLabResults(animalId: string, params?: { limit?: number; offset?: number }) {
    const response = await sharedClient.get(`/lab-results/animal/${animalId}`, { params })
    return response.data
  },

  async updateLabResult(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/lab-results/${id}`, data)
    return response.data
  },

  // ─── Medical Timeline ────────────────────────────────────
  async getAnimalTimeline(animalId: string, params?: { limit?: number; types?: string; dateFrom?: string; dateTo?: string }) {
    const response = await sharedClient.get(`/timeline/animal/${animalId}`, { params })
    return response.data
  },

  // ─── Notifications ────────────────────────────────────────
  async listNotifications(params?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
    const response = await sharedClient.get('/notifications', { params })
    return response.data
  },

  async markNotificationRead(id: string) {
    const response = await sharedClient.put(`/notifications/${id}/read`)
    return response.data
  },

  async markAllNotificationsRead() {
    const response = await sharedClient.put('/notifications/read-all')
    return response.data
  }

}
