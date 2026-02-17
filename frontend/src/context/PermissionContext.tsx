import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import apiService from '../services/api'

// ─── Types ──────────────────────────────────────────────────
interface PermissionContextType {
  permissions: string[]
  loading: boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  reloadPermissions: () => Promise<void>
}

// ─── Permission-to-Route mapping ────────────────────────────
// Maps page permissions to their route paths (used by RoleRoute)
export const PERMISSION_ROUTE_MAP: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  consultations: ['/consultations'],
  find_doctor: ['/find-doctor'],
  book_consultation: ['/book-consultation'],
  my_bookings: ['/my-bookings'],
  animals: ['/animals'],
  medical_records: ['/medical-records'],
  schedule: ['/doctor/manage-schedule'],
  prescriptions: ['/doctor/prescriptions', '/doctor/prescriptions/new'],
  reviews: ['/doctor/reviews'],
  video_consultation: ['/video-consultation'],
  settings: ['/settings'],
  write_review: ['/write-review'],
  admin_dashboard: ['/admin/dashboard'],
  admin_users: ['/admin/users'],
  admin_consultations: ['/admin/consultations'],
  admin_payments: ['/admin/payments'],
  admin_reviews: ['/admin/reviews'],
  admin_settings: ['/admin/settings'],
  admin_audit: ['/admin/audit-logs'],
  admin_permissions: ['/admin/permissions'],
}

// Reverse map: route path → required permission
export const ROUTE_PERMISSION_MAP: Record<string, string> = {}
for (const [perm, routes] of Object.entries(PERMISSION_ROUTE_MAP)) {
  for (const route of routes) {
    ROUTE_PERMISSION_MAP[route] = perm
  }
}

// Navigation menu item → permission mapping
export const NAV_PERMISSION_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'consultations': 'consultations',
  'find-doctor': 'find_doctor',
  'book-consultation': 'book_consultation',
  'my-bookings': 'my_bookings',
  'animals': 'animals',
  'medical': 'medical_records',
  'manage-schedule': 'schedule',
  'prescriptions': 'prescriptions',
  'my-reviews': 'reviews',
  'settings': 'settings',
  'admin-dashboard': 'admin_dashboard',
  'admin-users': 'admin_users',
  'admin-consultations': 'admin_consultations',
  'admin-payments': 'admin_payments',
  'admin-reviews': 'admin_reviews',
  'admin-settings': 'admin_settings',
  'admin-audit': 'admin_audit',
  'admin-permissions': 'admin_permissions',
  'admin-medical-records': 'admin_medical_records',
}

// ─── Context ────────────────────────────────────────────────
const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

export const PermissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await apiService.getMyPermissions()
      const perms = result.data?.permissions || []
      setPermissions(perms)
    } catch (err) {
      console.error('[RBAC] Failed to load permissions, using empty set:', err)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const hasPermission = useCallback((permission: string): boolean => {
    // Admin always has all permissions as a safety net
    if (user?.role === 'admin') return true
    return permissions.includes(permission)
  }, [permissions, user?.role])

  const hasAnyPermission = useCallback((perms: string[]): boolean => {
    if (user?.role === 'admin') return true
    return perms.some(p => permissions.includes(p))
  }, [permissions, user?.role])

  const hasAllPermissions = useCallback((perms: string[]): boolean => {
    if (user?.role === 'admin') return true
    return perms.every(p => permissions.includes(p))
  }, [permissions, user?.role])

  return (
    <PermissionContext.Provider value={{
      permissions,
      loading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      reloadPermissions: loadPermissions,
    }}>
      {children}
    </PermissionContext.Provider>
  )
}

export const usePermission = (): PermissionContextType => {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider')
  }
  return context
}

export default PermissionContext
