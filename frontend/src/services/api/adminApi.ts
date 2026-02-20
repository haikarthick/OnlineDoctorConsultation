import { client } from './client'

// ─── Admin Dashboard & Users ──────────────────────────────────
export async function getAdminDashboard() {
  const response = await client.get('/admin/dashboard')
  return response.data
}

export async function adminListUsers(params?: { limit?: number; offset?: number; role?: string; search?: string; isActive?: string }) {
  const response = await client.get('/admin/users', { params })
  return response.data
}

export async function adminToggleUserStatus(userId: string, isActive: boolean) {
  const response = await client.put(`/admin/users/${userId}/status`, { isActive })
  return response.data
}

export async function adminChangeUserRole(userId: string, role: string) {
  const response = await client.put(`/admin/users/${userId}/role`, { role })
  return response.data
}

export async function adminListConsultations(params?: { limit?: number; offset?: number; status?: string }) {
  const response = await client.get('/admin/consultations', { params })
  return response.data
}

export async function adminListPayments(params?: { limit?: number; offset?: number; status?: string }) {
  const response = await client.get('/admin/payments', { params })
  return response.data
}

export async function adminProcessRefund(paymentId: string, amount: number, reason: string) {
  const response = await client.post(`/admin/payments/${paymentId}/refund`, { amount, reason })
  return response.data
}

export async function adminListReviews(params?: { limit?: number; offset?: number; status?: string }) {
  const response = await client.get('/admin/reviews', { params })
  return response.data
}

export async function adminModerateReview(reviewId: string, action: 'approve' | 'hide' | 'remove') {
  const response = await client.put(`/admin/reviews/${reviewId}/moderate`, { action })
  return response.data
}

export async function adminGetSettings() {
  const response = await client.get('/admin/settings')
  return response.data
}

export async function adminUpdateSetting(key: string, value: string) {
  const response = await client.put('/admin/settings', { key, value })
  return response.data
}

export async function adminGetAuditLogs(params?: { limit?: number; offset?: number; userId?: string; action?: string }) {
  const response = await client.get('/admin/audit-logs', { params })
  return response.data
}

// ─── Feature Flags ────────────────────────────────────────────
export async function getFeatureFlags() {
  const response = await client.get('/features')
  return response.data
}

// ─── Permissions (RBAC) ───────────────────────────────────────
export async function getMyPermissions() {
  const response = await client.get('/permissions/my')
  return response.data
}

export async function adminGetPermissions() {
  const response = await client.get('/admin/permissions')
  return response.data
}

export async function adminUpdatePermission(role: string, permission: string, isEnabled: boolean) {
  const response = await client.put('/admin/permissions', { role, permission, isEnabled })
  return response.data
}

export async function adminBulkUpdatePermissions(role: string, permissions: Record<string, boolean>) {
  const response = await client.put('/admin/permissions/bulk', { role, permissions })
  return response.data
}

export async function adminResetPermissions(role: string) {
  const response = await client.post('/admin/permissions/reset', { role })
  return response.data
}

// ─── Health check ─────────────────────────────────────────────
export async function healthCheck() {
  const response = await client.get('/health')
  return response.data
}
