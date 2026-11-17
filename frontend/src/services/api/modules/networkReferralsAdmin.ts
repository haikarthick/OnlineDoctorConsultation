import { sharedClient } from '../core'

export const networkReferralsAdminApi = {
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
    const response = await sharedClient.post('/network-referrals', data)
    return response.data
  },

  async updateNetworkReferralStatus(referralId: string, status: string, responseNotes?: string): Promise<any> {
    const response = await sharedClient.patch(`/network-referrals/${referralId}/status`, { status, responseNotes })
    return response.data
  },

  async listNetworkReferrals(params: {
    networkId?: string;
    hospitalId?: string;
    direction?: 'incoming' | 'outgoing' | 'all';
    animalId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await sharedClient.get('/network-referrals', { params })
    return response.data
  },

  // ── Corporate Admin ──
  async getCorporateDashboardStats(): Promise<any> {
    return sharedClient.get('/dashboard/corporate')
  },

  async getHospitalStaffDashboard(): Promise<any> {
    return sharedClient.get('/dashboard/hospital-staff')
  },

  /**
   * Candidate users for network membership: doctors/staff already attached to one of this
   * network's branch hospitals who are not yet members. An empty query returns the full
   * candidate list. Network-scoped by the backend - this is NOT a platform user directory.
   */
  async searchNetworkUsers(networkId: string, query: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/user-search`, { params: { q: query } })
  },

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
    return sharedClient.post(`/hospital-networks/${networkId}/branch-hospitals`, data)
  },

  async updateBranchHospital(networkId: string, hospitalId: string, data: Record<string, any>): Promise<any> {
    return sharedClient.put(`/hospital-networks/${networkId}/branch-hospitals/${hospitalId}`, data)
  },

  async deleteBranchHospital(networkId: string, hospitalId: string): Promise<any> {
    return sharedClient.delete(`/hospital-networks/${networkId}/branch-hospitals/${hospitalId}`)
  },

  // P5-ANALYTICS
  async getNetworkAnalytics(networkId: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/analytics`)
  },

  // P5-COMPLIANCE-EXPORT
  async getNetworkComplianceReport(networkId: string, from: string, to: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/compliance-report`, { params: { from, to } })
  },

  // P6-APPROVAL
  async getNetworkApprovalHistory(networkId: string): Promise<any> {
    return sharedClient.get(`/hospital-networks/${networkId}/approval-history`)
  },

  async addNetworkApprovalEvent(networkId: string, eventType: string, notes?: string): Promise<any> {
    return sharedClient.post(`/hospital-networks/${networkId}/approval-events`, { eventType, notes })
  },

  // P6-BRANDING
  async updateNetworkBranding(networkId: string, data: Record<string, any>): Promise<any> {
    return sharedClient.put(`/hospital-networks/${networkId}/branding`, data)
  },

  // P6-NOTIFICATIONS
  async getNotificationPreferences(): Promise<any> {
    return sharedClient.get('/notification-preferences')
  },

  async updateNotificationPreferences(prefs: Record<string, any>): Promise<any> {
    return sharedClient.put('/notification-preferences', prefs)
  }
}
