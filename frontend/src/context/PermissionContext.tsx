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
  // Enterprise
  enterprise_manage: ['/enterprises'],
  enterprise_groups: ['/animal-groups'],
  enterprise_locations: ['/locations'],
  enterprise_movements: ['/movement-log'],
  enterprise_campaigns: ['/campaigns'],
  // Advanced
  health_analytics: ['/health-analytics'],
  breeding_manage: ['/breeding'],
  feed_manage: ['/feed-inventory'],
  compliance_manage: ['/compliance'],
  financial_analytics: ['/financial'],
  alert_manage: ['/alerts'],
  // Innovation Modules
  disease_prediction: ['/disease-prediction'],
  genomic_lineage: ['/genomic-lineage'],
  iot_sensors: ['/iot-sensors'],
  supply_chain: ['/supply-chain'],
  workforce_manage: ['/workforce'],
  report_builder: ['/report-builder'],
  // Intelligence Modules
  ai_copilot: ['/ai-copilot'],
  digital_twin: ['/digital-twin'],
  marketplace_access: ['/marketplace'],
  sustainability_manage: ['/sustainability'],
  wellness_portal: ['/wellness'],
  geospatial_analytics: ['/geospatial'],
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
  // Enterprise
  'enterprises': 'enterprise_manage',
  'animal-groups': 'enterprise_groups',
  'locations': 'enterprise_locations',
  'movement-log': 'enterprise_movements',
  'campaigns': 'enterprise_campaigns',
  // Advanced
  'health-analytics': 'health_analytics',
  'breeding': 'breeding_manage',
  'feed-inventory': 'feed_manage',
  'compliance': 'compliance_manage',
  'financial': 'financial_analytics',
  'alerts': 'alert_manage',
  // Innovation Modules
  'disease-prediction': 'disease_prediction',
  'genomic-lineage': 'genomic_lineage',
  'iot-sensors': 'iot_sensors',
  'supply-chain': 'supply_chain',
  'workforce': 'workforce_manage',
  'report-builder': 'report_builder',
  // Intelligence Modules
  'ai-copilot': 'ai_copilot',
  'digital-twin': 'digital_twin',
  'marketplace': 'marketplace_access',
  'sustainability': 'sustainability_manage',
  'wellness': 'wellness_portal',
  'geospatial': 'geospatial_analytics',
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
