import { sharedClient } from '../core'

export const patientConsentRolesApi = {
  // ─── Patient Data Consent ───────────────────────────────────────
  async createPatientConsent(data: Record<string, any>) {
    const response = await sharedClient.post('/patient-consent', data)
    return response.data
  },
  async listPatientConsents(animalId: string) {
    const response = await sharedClient.get(`/patient-consent/${animalId}`)
    return response.data
  },
  async revokePatientConsent(consentId: string) {
    const response = await sharedClient.delete(`/patient-consent/${consentId}`)
    return response.data
  },

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
    const response = await sharedClient.post('/role-change-requests', data)
    return response.data
  },
  async getMyRoleChangeRequests() {
    const response = await sharedClient.get('/role-change-requests/my')
    return response.data
  },
  async cancelRoleChangeRequest(id: string) {
    const response = await sharedClient.put(`/role-change-requests/${id}/cancel`, {})
    return response.data
  },
  async adminListRoleChangeRequests(status = 'pending') {
    const response = await sharedClient.get('/admin/role-change-requests', { params: { status } })
    return response.data
  },
  async adminApproveRoleChangeRequest(id: string) {
    const response = await sharedClient.put(`/admin/role-change-requests/${id}/approve`, {})
    return response.data
  },
  async adminRejectRoleChangeRequest(id: string, rejection_reason: string) {
    const response = await sharedClient.put(`/admin/role-change-requests/${id}/reject`, { rejection_reason })
    return response.data
  }

}
