import { sharedClient } from '../core'

export const adminApi = {
  // ─── Admin ────────────────────────────────────────────────
  async getAdminDashboard() {
    const response = await sharedClient.get('/admin/dashboard')
    return response.data
  },

  async getAdminPharmacyOverview() {
    const response = await sharedClient.get('/admin/pharmacy-overview')
    return response.data
  },

  async adminListUsers(params?: { limit?: number; offset?: number; role?: string; search?: string; isActive?: string }) {
    const response = await sharedClient.get('/admin/users', { params })
    return response.data
  },

  async adminToggleUserStatus(userId: string, isActive: boolean) {
    const response = await sharedClient.put(`/admin/users/${userId}/status`, { isActive })
    return response.data
  },

  async adminChangeUserRole(
    userId: string,
    role: string,
    profile?: { licenseNumber?: string; consultationFee?: number; yearsOfExperience?: number; specializations?: string[]; clinicName?: string }
  ) {
    const response = await sharedClient.put(`/admin/users/${userId}/role`, profile ? { role, profile } : { role })
    return response.data
  },

  async adminResetUserPassword(userId: string, newPassword: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/reset-password`, { newPassword })
    return response.data
  },

  async adminListPendingUsers() {
    const response = await sharedClient.get('/admin/users/pending')
    return response.data
  },

  async adminApproveUser(userId: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/approve`)
    return response.data
  },

  async adminRejectUser(userId: string, reason: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/reject`, { reason })
    return response.data
  },

  async adminFreezeUser(userId: string, reason: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/freeze`, { reason })
    return response.data
  },

  async adminUnfreezeUser(userId: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/unfreeze`)
    return response.data
  },

  async adminSuspendUser(userId: string, reason: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/suspend`, { reason })
    return response.data
  },

  async adminReactivateUser(userId: string) {
    const response = await sharedClient.post(`/admin/users/${userId}/reactivate`)
    return response.data
  },

  async adminGetWalletSummary() {
    const response = await sharedClient.get('/admin/wallet-summary')
    return response.data
  },

  // P4-HIGH1: Secondary role management
  async getUserRoles(userId: string) {
    const response = await sharedClient.get(`/users/${userId}/roles`)
    return response.data
  },

  async addUserRole(userId: string, role: string, notes?: string) {
    const response = await sharedClient.post(`/users/${userId}/roles`, { role, notes })
    return response.data
  },

  async removeUserRole(userId: string, role: string) {
    const response = await sharedClient.delete(`/users/${userId}/roles/${role}`)
    return response.data
  },

  // P4-MED2: Unified referral history for an animal
  async getAnimalReferrals(animalId: string) {
    const response = await sharedClient.get(`/animals/${animalId}/referrals`)
    return response.data
  },

  async adminListConsultations(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await sharedClient.get('/admin/consultations', { params })
    return response.data
  },

  async adminListPayments(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await sharedClient.get('/admin/payments', { params })
    return response.data
  },

  async adminProcessRefund(paymentId: string, amount: number, reason: string) {
    const response = await sharedClient.post(`/admin/payments/${paymentId}/refund`, { amount, reason })
    return response.data
  },

  async adminListReviews(params?: { limit?: number; offset?: number; status?: string }) {
    const response = await sharedClient.get('/admin/reviews', { params })
    return response.data
  },

  async adminModerateReview(reviewId: string, action: 'approve' | 'hide' | 'remove') {
    const response = await sharedClient.put(`/admin/reviews/${reviewId}/moderate`, { action })
    return response.data
  },

  async adminGetSettings() {
    const response = await sharedClient.get('/admin/settings')
    return response.data
  },

  async getPrescriptionTemplate(): Promise<Record<string, string>> {
    // Fetches prescription.* settings from the public settings endpoint (accessible to all users)
    const response = await sharedClient.get('/settings/public')
    const list: { key: string; value: string }[] = response.data?.data || []
    const template: Record<string, string> = {}
    for (const item of list) {
      if (item.key.startsWith('prescription.')) {
        const shortKey = item.key.replace('prescription.', '')
        template[shortKey] = item.value
      }
    }
    return template
  },

  async getCertificateTemplate(): Promise<Record<string, string>> {
    // Fetches cert.* settings from the public settings endpoint (accessible to all users)
    const response = await sharedClient.get('/settings/public')
    const list: { key: string; value: string }[] = response.data?.data || []
    const template: Record<string, string> = {}
    for (const item of list) {
      if (item.key.startsWith('cert.')) {
        const shortKey = item.key.replace('cert.', '')
        template[shortKey] = item.value
      }
    }
    return template
  },

  async adminUpdateSetting(key: string, value: string) {
    const response = await sharedClient.put('/admin/settings', { key, value })
    return response.data
  },

  async adminSendTestEmail(to: string) {
    const response = await sharedClient.post('/admin/settings/test-email', { to })
    return response.data
  },

  async adminGetEmailTemplates() {
    const response = await sharedClient.get('/admin/email-templates')
    return response.data
  },

  async adminUpdateEmailTemplate(templateName: string, data: { subject: string; body: string }) {
    const response = await sharedClient.put(`/admin/email-templates/${templateName}`, data)
    return response.data
  },

  async adminGetAuditLogs(params?: { limit?: number; offset?: number; userId?: string; action?: string }) {
    const response = await sharedClient.get('/admin/audit-logs', { params })
    return response.data
  },

  // ── HIPAA Compliance ──────────────────────────────────────
  async getComplianceDashboard() {
    const response = await sharedClient.get('/admin/compliance/dashboard')
    return response.data
  },

  async getPhiAccessLog(params?: { limit?: number; offset?: number; userId?: string; entityType?: string; startDate?: string; endDate?: string }) {
    const response = await sharedClient.get('/admin/compliance/phi-access', { params })
    return response.data
  },

  async getUserDataSummary(userId?: string) {
    const url = userId ? `/admin/compliance/user-data/${userId}` : '/admin/compliance/my-data'
    const response = await sharedClient.get(url)
    return response.data
  },

  async revokeUserSessions(userId: string) {
    const response = await sharedClient.post(`/admin/compliance/revoke-sessions/${userId}`)
    return response.data
  },

  async adminGetCancellationStats() {
    const response = await sharedClient.get('/admin/cancellation-stats')
    return response.data
  },

  async adminGetVetProfile(userId: string) {
    const response = await sharedClient.get(`/admin/vet-profiles/${userId}`)
    return response.data
  },

  async adminUpdateVetProfile(userId: string, data: Record<string, unknown>) {
    const response = await sharedClient.put(`/admin/vet-profiles/${userId}`, data)
    return response.data
  },

  async adminGetGatewaySettings() {
    const response = await sharedClient.get('/payments/gateway-settings')
    return response.data
  },

  async adminGetRazorpayCredentials() {
    const response = await sharedClient.get('/admin/razorpay-credentials')
    return response.data
  },

  async adminUpdateRazorpayCredentials(environment: 'test' | 'live', data: { keyId: string; keySecret?: string; webhookSecret?: string }) {
    const response = await sharedClient.put(`/admin/razorpay-credentials/${environment}`, data)
    return response.data
  },

  // ─── Feature Flags ─────────────────────────────────────────
  async getFeatureFlags() {
    const response = await sharedClient.get('/features')
    return response.data
  },

  // ─── Permissions (RBAC) ────────────────────────────────────
  async getMyPermissions() {
    const response = await sharedClient.get('/permissions/my')
    return response.data
  },

  async adminGetPermissions() {
    const response = await sharedClient.get('/admin/permissions')
    return response.data
  },

  async adminUpdatePermission(role: string, permission: string, isEnabled: boolean) {
    const response = await sharedClient.put('/admin/permissions', { role, permission, isEnabled })
    return response.data
  },

  async adminBulkUpdatePermissions(role: string, permissions: Record<string, boolean>) {
    const response = await sharedClient.put('/admin/permissions/bulk', { role, permissions })
    return response.data
  },

  async adminResetPermissions(role: string) {
    const response = await sharedClient.post('/admin/permissions/reset', { role })
    return response.data
  },

  async adminGetNetworkRolePermissions(networkId: string) {
    const response = await sharedClient.get('/admin/network-role-permissions', { params: { networkId } })
    return response.data
  },

  async adminUpdateNetworkRolePermission(networkId: string, networkRole: string, action: string, isEnabled: boolean) {
    const response = await sharedClient.put('/admin/network-role-permissions', { networkId, networkRole, action, isEnabled })
    return response.data
  },

  async adminResetNetworkRolePermissions(networkId: string, networkRole?: string) {
    const response = await sharedClient.post('/admin/network-role-permissions/reset', { networkId, networkRole })
    return response.data
  },

  // ─── Network Custom Roles ──────────────────────────────────────
  async getNetworkRoles(networkId: string) {
    const response = await sharedClient.get(`/hospital-networks/${networkId}/roles`)
    return response.data
  },

  async createNetworkCustomRole(networkId: string, data: {
    roleKey: string; displayName: string; description?: string; baseTemplate: string; icon?: string;
  }) {
    const response = await sharedClient.post(`/hospital-networks/${networkId}/roles`, data)
    return response.data
  },

  async updateNetworkCustomRole(networkId: string, roleKey: string, data: {
    displayName?: string; description?: string; baseTemplate?: string; icon?: string;
  }) {
    const response = await sharedClient.put(`/hospital-networks/${networkId}/roles/${roleKey}`, data)
    return response.data
  },

  async deleteNetworkCustomRole(networkId: string, roleKey: string) {
    const response = await sharedClient.delete(`/hospital-networks/${networkId}/roles/${roleKey}`)
    return response.data
  },

  // ─── Health check ──────────────────────────────────────────
  async healthCheck() {
    const response = await sharedClient.get('/health')
    return response.data
  }

}
