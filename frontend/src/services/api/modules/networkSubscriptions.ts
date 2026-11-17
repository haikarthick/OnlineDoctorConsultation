import { sharedClient } from '../core'

export const networkSubscriptionsApi = {
  // ── Network Subscription Plans ──
  async getNetworkSubscriptionPlans() {
    const response = await sharedClient.get('/network-subscription-plans')
    return response.data
  },
  async createNetworkPlan(data: Record<string, unknown>) {
    const response = await sharedClient.post('/admin/network-subscription-plans', data)
    return response.data
  },
  async updateNetworkPlan(id: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/admin/network-subscription-plans/${id}`, data)
    return response.data
  },
  async deleteNetworkPlan(id: string) {
    const response = await sharedClient.delete(`/admin/network-subscription-plans/${id}`)
    return response.data
  },

  // ── Network Subscriptions ──
  async adminListNetworkSubscriptions() {
    const response = await sharedClient.get('/admin/network-subscriptions')
    return response.data
  },
  async setNetworkSubscription(networkId: string, data: Record<string, unknown>) {
    const response = await sharedClient.post(`/admin/networks/${networkId}/set-subscription`, data)
    return response.data
  },
  async overrideSeatLimit(networkId: string, seatLimit: number, adminNotes?: string) {
    const response = await sharedClient.put(`/admin/networks/${networkId}/override-seat-limit`, { seat_limit: seatLimit, admin_notes: adminNotes })
    return response.data
  },
  async suspendNetwork(networkId: string, suspensionReason: string) {
    const response = await sharedClient.post(`/admin/networks/${networkId}/suspend`, { suspension_reason: suspensionReason })
    return response.data
  },
  async unsuspendNetwork(networkId: string) {
    const response = await sharedClient.post(`/admin/networks/${networkId}/unsuspend`, {})
    return response.data
  },
  async getMyNetworkSubscription() {
    const response = await sharedClient.get('/my-network-subscription')
    return response.data
  },

  // ── Pricing (public + admin) ──
  async getPricingPlans() {
    const response = await sharedClient.get('/pricing/plans')
    return response.data
  },
  async getPricingSettings() {
    const response = await sharedClient.get('/admin/pricing-settings')
    return response.data
  },
  async updatePricingSettings(settings: Record<string, string>) {
    const response = await sharedClient.put('/admin/pricing-settings', settings)
    return response.data
  },

  // ── Hospital Staff Invites ──
  async inviteHospitalStaff(networkId: string, data: { inviteeEmail: string; inviteeName?: string; staffPosition: string; hospitalId?: string; expiresInHours?: number }) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/staff-invites`, data)
    return response.data
  },
  async listStaffInvites(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/staff-invites`)
    return response.data
  },
  async revokeStaffInvite(networkId: string, inviteId: string) {
    const response = await sharedClient.delete(`/hospital-networks/${networkId}/staff-invites/${inviteId}`)
    return response.data
  },

  // Audit log export
  async exportAuditLogs(networkId: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/audit-logs/export`, {
      responseType: 'blob'
    })
  },

  // Financial summary
  async getNetworkFinancialSummary(networkId: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/financial-summary`)
  },

  // Leave management
  async listLeaveRequests(networkId: string, params: Record<string, any> = {}): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/leave-requests`, { params })
  },
  async createLeaveRequest(networkId: string, data: Record<string, any>): Promise<any> {
    return sharedClient.post(`/hospital-networks/${networkId}/leave-requests`, data)
  },
  async updateLeaveRequest(networkId: string, requestId: string, data: Record<string, any>): Promise<any> {
    return sharedClient.patch(`/hospital-networks/${networkId}/leave-requests/${requestId}`, data)
  },

  // Patient transfers
  async listPatientTransfers(networkId: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/patient-transfers`)
  },
  async createPatientTransfer(networkId: string, data: Record<string, any>): Promise<any> {
    return sharedClient.post(`/hospital-networks/${networkId}/patient-transfers`, data)
  },
  async completePatientTransfer(networkId: string, transferId: string): Promise<any> {
    return sharedClient.post(`/hospital-networks/${networkId}/patient-transfers/${transferId}/complete`)
  },

  async getStaffInviteByToken(token: string) {
    const response = await sharedClient.get(`/hospital-staff-invites/token/${token}`)
    return response.data
  },
  async acceptStaffInvite(data: { token: string; first_name: string; last_name: string; phone?: string; password: string; acceptTerms?: boolean }) {
    const response = await sharedClient.post('/hospital-staff-invites/accept', data)
    return response.data
  }

}
