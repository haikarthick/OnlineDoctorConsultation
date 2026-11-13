import { sharedClient } from '../core'

export const hospitalApi = {
  // ─── Vaccine Protocols ────────────────────────────────────────
  async adminListVaccineProtocols(filters: { species?: string; category?: string; country?: string; activeOnly?: boolean } = {}) {
    const response = await sharedClient.get('/admin/vaccine-protocols', { params: filters })
    return response.data
  },

  async adminCreateVaccineProtocol(data: any) {
    const response = await sharedClient.post('/admin/vaccine-protocols', data)
    return response.data
  },

  async adminUpdateVaccineProtocol(id: string, data: any) {
    const response = await sharedClient.put(`/admin/vaccine-protocols/${id}`, data)
    return response.data
  },

  async adminArchiveVaccineProtocol(id: string) {
    const response = await sharedClient.patch(`/admin/vaccine-protocols/${id}/archive`, {})
    return response.data
  },

  async adminRestoreVaccineProtocol(id: string) {
    const response = await sharedClient.patch(`/admin/vaccine-protocols/${id}/restore`, {})
    return response.data
  },

  async getVaccineProtocolChanges(id: string) {
    const response = await sharedClient.get(`/admin/vaccine-protocols/${id}/changes`)
    return response.data
  },

  async addVaccineProtocolChange(id: string, data: any) {
    const response = await sharedClient.post(`/admin/vaccine-protocols/${id}/changes`, data)
    return response.data
  },

  async listVaccineProtocols(filters: { species?: string; category?: string } = {}) {
    const response = await sharedClient.get('/vaccine-protocols', { params: filters })
    return response.data
  },

  // ─── Master Data (admin CRUD) ──────────────────────────────────
  async adminListMasterSpecies() { return (await sharedClient.get('/admin/master-data/species')).data },
  async adminCreateMasterSpecies(data: any) { return (await sharedClient.post('/admin/master-data/species', data)).data },
  async adminUpdateMasterSpecies(id: string, data: any) { return (await sharedClient.put(`/admin/master-data/species/${id}`, data)).data },
  async adminArchiveMasterSpecies(id: string) { return (await sharedClient.patch(`/admin/master-data/species/${id}/archive`, {})).data },
  async adminRestoreMasterSpecies(id: string) { return (await sharedClient.patch(`/admin/master-data/species/${id}/restore`, {})).data },
  async adminDeleteMasterSpecies(id: string) { return (await sharedClient.delete(`/admin/master-data/species/${id}`)).data },

  async adminListMasterBreeds(speciesId?: string) { return (await sharedClient.get('/admin/master-data/breeds', { params: speciesId ? { speciesId } : {} })).data },
  async adminCreateMasterBreed(data: any) { return (await sharedClient.post('/admin/master-data/breeds', data)).data },
  async adminUpdateMasterBreed(id: string, data: any) { return (await sharedClient.put(`/admin/master-data/breeds/${id}`, data)).data },
  async adminArchiveMasterBreed(id: string) { return (await sharedClient.patch(`/admin/master-data/breeds/${id}/archive`, {})).data },
  async adminRestoreMasterBreed(id: string) { return (await sharedClient.patch(`/admin/master-data/breeds/${id}/restore`, {})).data },
  async adminDeleteMasterBreed(id: string) { return (await sharedClient.delete(`/admin/master-data/breeds/${id}`)).data },

  async adminListMasterAnimalClasses(speciesId?: string) { return (await sharedClient.get('/admin/master-data/animal-classes', { params: speciesId ? { speciesId } : {} })).data },
  async adminCreateMasterAnimalClass(data: any) { return (await sharedClient.post('/admin/master-data/animal-classes', data)).data },
  async adminUpdateMasterAnimalClass(id: string, data: any) { return (await sharedClient.put(`/admin/master-data/animal-classes/${id}`, data)).data },
  async adminArchiveMasterAnimalClass(id: string) { return (await sharedClient.patch(`/admin/master-data/animal-classes/${id}/archive`, {})).data },
  async adminRestoreMasterAnimalClass(id: string) { return (await sharedClient.patch(`/admin/master-data/animal-classes/${id}/restore`, {})).data },
  async adminDeleteMasterAnimalClass(id: string) { return (await sharedClient.delete(`/admin/master-data/animal-classes/${id}`)).data },

  async adminListMasterMarketplaceCategories() { return (await sharedClient.get('/admin/master-data/marketplace/categories')).data },
  async adminCreateMasterMarketplaceCategory(data: any) { return (await sharedClient.post('/admin/master-data/marketplace/categories', data)).data },
  async adminUpdateMasterMarketplaceCategory(id: string, data: any) { return (await sharedClient.put(`/admin/master-data/marketplace/categories/${id}`, data)).data },
  async adminArchiveMasterMarketplaceCategory(id: string) { return (await sharedClient.patch(`/admin/master-data/marketplace/categories/${id}/archive`, {})).data },
  async adminRestoreMasterMarketplaceCategory(id: string) { return (await sharedClient.patch(`/admin/master-data/marketplace/categories/${id}/restore`, {})).data },
  async adminDeleteMasterMarketplaceCategory(id: string) { return (await sharedClient.delete(`/admin/master-data/marketplace/categories/${id}`)).data },

  async adminListMasterMarketplaceConditions() { return (await sharedClient.get('/admin/master-data/marketplace/conditions')).data },
  async adminCreateMasterMarketplaceCondition(data: any) { return (await sharedClient.post('/admin/master-data/marketplace/conditions', data)).data },
  async adminUpdateMasterMarketplaceCondition(id: string, data: any) { return (await sharedClient.put(`/admin/master-data/marketplace/conditions/${id}`, data)).data },
  async adminArchiveMasterMarketplaceCondition(id: string) { return (await sharedClient.patch(`/admin/master-data/marketplace/conditions/${id}/archive`, {})).data },
  async adminRestoreMasterMarketplaceCondition(id: string) { return (await sharedClient.patch(`/admin/master-data/marketplace/conditions/${id}/restore`, {})).data },
  async adminDeleteMasterMarketplaceCondition(id: string) { return (await sharedClient.delete(`/admin/master-data/marketplace/conditions/${id}`)).data },

  async getAnimalVaccineAssignments(animalId: string) {
    const response = await sharedClient.get(`/animals/${animalId}/vaccine-assignments`)
    return response.data
  },

  async assignVaccineProtocol(animalId: string, data: { protocolId: string; notes?: string }) {
    const response = await sharedClient.post(`/animals/${animalId}/vaccine-assignments`, data)
    return response.data
  },

  async waiveVaccineProtocol(animalId: string, protocolId: string, reason: string) {
    const response = await sharedClient.patch(`/animals/${animalId}/vaccine-assignments/${protocolId}/waive`, { reason })
    return response.data
  },

  async getAnimalVaccineSchedule(animalId: string) {
    const response = await sharedClient.get(`/vaccine-schedule/animal/${animalId}`)
    return response.data
  },

  async markVaccineDoseAdministered(scheduleId: string, data: { vaccinationRecordId: string; administeredAt?: string }) {
    const response = await sharedClient.patch(`/vaccine-schedule/${scheduleId}/administer`, data)
    return response.data
  },

  async getVaccinationPassport(animalId: string) {
    const response = await sharedClient.get(`/vaccination-passport/animal/${animalId}`)
    return response.data
  },

  async getGroupVaccinationPassport(groupId: string) {
    const response = await sharedClient.get(`/vaccination-passport/group/${groupId}`)
    return response.data
  },

  async getVaccinationComplianceSummary(filters: { enterpriseId?: string; species?: string } = {}) {
    const response = await sharedClient.get('/vaccination-passport/compliance-summary', { params: filters })
    return response.data
  },

  async logVaccineCertificateDownload(data: { animalId: string; vaccinationRecordId?: string; certificateType?: string; fileName?: string }) {
    const response = await sharedClient.post('/vaccine-certificate-log', data)
    return response.data
  },

  async getAnimalCertificateLogs(animalId: string) {
    const response = await sharedClient.get(`/vaccine-certificate-log/animal/${animalId}`)
    return response.data
  },


  async checkAnimalAccess(animalId: string) {
    const response = await sharedClient.get(`/animals/${animalId}/access-check`)
    return response.data
  },
  // ─── Hospital Networks ──────────────────────────────────────────
  async listHospitalNetworks(filters: { isApproved?: boolean; isActive?: boolean } = {}) {
    const response = await sharedClient.get('/hospital-networks', { params: filters })
    return response.data
  },
  async createHospitalNetwork(data: Record<string, any>) {
    const response = await sharedClient.post('/hospital-networks', data)
    return response.data
  },
  async getHospitalNetwork(id: string) {
    const response = await sharedClient.get(`/hospital-networks/${id}`)
    return response.data
  },
  async updateHospitalNetwork(id: string, data: Record<string, any>) {
    const response = await sharedClient.put(`/hospital-networks/${id}`, data)
    return response.data
  },
  async approveHospitalNetwork(id: string) {
    const response = await sharedClient.post(`/hospital-networks/${id}/approve`)
    return response.data
  },

  async deactivateNetwork(networkId: string): Promise<any> {
    const response = await sharedClient.patch(`/hospital-networks/${networkId}/deactivate`)
    return response.data
  },
  async getNetworkAuditLogs(networkId: string, filters: { page?: number; limit?: number; recordType?: string; accessGranted?: boolean; animalId?: string } = {}) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/audit-logs`, { params: filters })
    return response.data
  },
  /**
   * Network CONFIGURATION change trail (who changed roles/members/settings),
   * distinct from getNetworkAuditLogs above which is the patient-record ACCESS
   * trail. Requires the viewAuditLogs network action.
   */
  async getNetworkSecurityAudit(networkId: string, params: { limit?: number; offset?: number } = {}) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/security-audit`, { params })
    return response.data
  },
  /** Per-pharmacy revenue and dispensing volume across a network. */
  async getNetworkPharmacyReports(networkId: string, days = 30) {
    const response = await sharedClient.get(`/networks/${networkId}/pharmacy-reports`, { params: { days } })
    return response.data
  },
  async getNetworkDashboard(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/dashboard`)
    return response.data
  },
  async listNetworkHospitals(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/hospitals`)
    return response.data
  },
  async assignHospitalToNetwork(networkId: string, hospitalId: string) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/hospitals/${hospitalId}`)
    return response.data
  },
  async listNetworkMembers(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/members`)
    return response.data
  },
  async addNetworkMember(networkId: string, data: { userId: string; networkRole: string; hospitalId?: string; notes?: string; validUntil?: string }) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/members`, data)
    return response.data
  },
  async removeNetworkMember(networkId: string, userId: string) {
    const response = await sharedClient.delete(`/hospital-networks/${networkId}/members/${userId}`)
    return response.data
  },
  async updateNetworkMember(networkId: string, userId: string, data: { networkRole?: string; hospitalId?: string; department?: string }) {
    const response = await sharedClient.put(`/hospital-networks/${networkId}/members/${userId}`, data)
    return response.data
  },

  async enrollAnimalInNetwork(networkId: string, data: { animalId: string; hospitalId?: string; notes?: string }) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/enroll-animal`, data)
    return response.data
  },
  async searchNetworkPatients(networkId: string, q: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/search-patients`, { params: { q } })
    return response.data
  },
  async getAllEnrollments(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/all-enrollments`)
    return response.data
  },
  async inviteWalkInPatient(networkId: string, data: Record<string, any>) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/invite-walkin`, data)
    return response.data
  },
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
    const response = await sharedClient.post(`/hospital-networks/${networkId}/register-walkin`, data)
    return response.data
  },
  async registerWalkInStandalone(hospitalId: string, data: {
    patientName: string; patientPhone?: string; patientEmail?: string; patientAddress?: string;
    animalName: string; animalSpecies: string; animalBreed?: string;
    animalGender?: string; animalClass?: string; animalDob?: string; animalWeight?: number;
    animalColor?: string; animalMicrochipId?: string; animalRegistrationNumber?: string;
    animalIsNeutered?: boolean; animalMedicalNotes?: string; animalAvatarUrl?: string;
    animalInsuranceProvider?: string; animalInsurancePolicyNumber?: string; animalInsuranceExpiry?: string;
    animalEarTagId?: string;
  }) {
    const response = await sharedClient.post(`/hospitals/${hospitalId}/register-walkin`, data)
    return response.data
  },
  async acceptEnrollment(contextId: string, consentScope?: string) {
    const response = await sharedClient.post(`/hospital-networks/enrollments/${contextId}/accept`, { consentScope })
    return response.data
  },
  async declineEnrollment(contextId: string) {
    const response = await sharedClient.post(`/hospital-networks/enrollments/${contextId}/decline`, {})
    return response.data
  },
  async getMyNetworkEnrollments() {
    const response = await sharedClient.get('/my-network-enrollments')
    return response.data
  }

}
