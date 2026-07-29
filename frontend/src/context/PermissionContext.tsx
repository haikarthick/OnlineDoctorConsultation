import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import apiService from '../services/api'

// ─── Types ──────────────────────────────────────────────────
// §7 reconciliation: the caller's network membership + effective action matrix, returned by
// GET /permissions/my. Drives network-role-aware navigation / visibility / action gating so the
// hospital hierarchy (corporate_admin → hospital_director → staff) is enforced on the frontend.
export interface NetworkAccess {
  networkId: string
  networkName: string
  networkRole: string
  hospitalId: string | null
  hospitalName: string | null
  isBranchScoped: boolean
  actions: Record<string, boolean>
}

interface PermissionContextType {
  permissions: string[]
  loading: boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  reloadPermissions: () => Promise<void>
  // Network-role layer
  networks: NetworkAccess[]
  /** True if the caller's role in the given network grants the action (admin always true). */
  hasNetworkAction: (networkId: string, action: string) => boolean
  /** The caller's network role in a network, or null if not a member. */
  networkRoleFor: (networkId: string) => string | null
  /** True if the caller holds any of the given network roles in ANY network (e.g. director/corp admin). */
  hasAnyNetworkRole: (roles: string[]) => boolean
}

// ─── Permission-to-Route mapping ────────────────────────────
// Maps page permissions to their route paths (used by RoleRoute)
export const PERMISSION_ROUTE_MAP: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  consultations: ['/consultations'],
  find_doctor: ['/find-doctor', '/vet-profile'],
  book_consultation: ['/book-consultation'],
  animals: ['/animals'],
  medical_records: ['/medical-records'],
  schedule: ['/doctor/manage-schedule'],
  prescriptions: ['/doctor/prescriptions', '/doctor/prescriptions/new', '/prescriptions'],
  reviews: ['/doctor/reviews'],
  video_consultation: ['/video-consultation'],
  settings: ['/settings'],
  write_review: ['/write-review'],
  admin_dashboard: ['/admin/dashboard'],
  admin_users: ['/admin/users'],
  admin_consultations: ['/admin/consultations'],
  admin_payments: ['/admin/payments'],
  admin_reviews: ['/admin/reviews'],
  admin_settings: ['/admin/settings', '/admin/prescription-settings'],
  admin_audit: ['/admin/audit-logs'],
  admin_permissions: ['/admin/permissions'],
  // Enterprise
  enterprise_manage: ['/enterprises'],
  enterprise_groups: ['/animal-groups'],
  enterprise_locations: ['/locations'],
  enterprise_movements: ['/movement-log'],
  enterprise_campaigns: ['/campaigns'],
  herd_medical: ['/herd-medical'],
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
  // Vet Hospitals
  hospital_browse: ['/vet-hospitals'],
  hospital_manage: ['/vet-hospitals/manage'],
  admin_hospitals: ['/admin/vet-hospitals'],
  admin_compliance: ['/admin/compliance'],
  // Hospital Network
  hospital_network_manage: ['/hospital-networks', '/hospital-networks/:id', '/hospital-networks/:id/hospitals', '/hospital-networks/:id/members'],
  hospital_network_view: ['/hospital-networks'],
  hospital_network_subscription: ['/admin/network-subscriptions'],
  hospital_network_audit: ['/hospital-networks/:id/audit'],
  patient_consent_manage: ['/patient-consent'],
  network_membership_manage: ['/network-memberships'],
  // Hospital Workflow
  hospital_workflow: ['/hospital-workflow'],
  inpatient_manage: ['/inpatient'],
  admin_staff_settings: ['/admin/staff-settings'],
  // Wallet & Cancellation
  wallet: ['/wallet'],
  admin_cancellation_dashboard: ['/admin/cancellation-dashboard'],
  admin_holidays: ['/admin/holidays'],
  // Timeline
  animal_timeline: ['/animal-timeline'],
  // Vaccination
  vaccination_passport: ['/vaccination-passport'],
  admin_vaccine_protocols: ['/admin/vaccine-protocols'],
  admin_master_data: ['/admin/master-data'],
  // Veterinary Certificates
  vet_certificates: ['/vet-certificates', '/doctor/certificates/new'],
  vet_earnings: ['/doctor/earnings'],
  admin_certificates: ['/admin/certificate-settings'],
  // Dispute Management
  dispute_management: ['/admin/disputes'],
  // Pharmacy
  pharmacy_view_dashboard: ['/pharmacy'],
  // Grooming & Spa
  // /grooming/provider is guarded by grooming_provider_apply, NOT grooming_provider_console.
  // The page is dual-purpose: it shows the "register your grooming business" onboarding form
  // when the caller has no provider, and the provider console when they do. Guarding it with
  // the console permission created a catch-22 — only existing providers could reach the form
  // that makes you a provider. Every console holder also holds apply, and the console UI only
  // renders when the backend actually returns a provider for the caller.
  grooming_provider_apply: ['/grooming/provider'],
  grooming_provider_console: [],
  grooming_admin: ['/admin/grooming-providers'],
  grooming_browse: ['/grooming/find', '/grooming/provider/:id'],
  grooming_book: ['/grooming/book'],
  grooming_my_orders: ['/grooming/my-orders'],
  // Working hours sit with booking management: whoever runs the diary sets when it is open.
  grooming_manage_bookings: ['/grooming/orders', '/grooming/schedule'],
  grooming_earnings_view: ['/grooming/earnings'],
  // /grooming/order/:id is intentionally NOT mapped — shared by provider + customer, so it is
  // auth-only at the route layer and access is enforced per-order by the backend.
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
  'write-review': 'write_review',
  'settings': 'settings',
  'admin-dashboard': 'admin_dashboard',
  'admin-users': 'admin_users',
  'admin-consultations': 'admin_consultations',
  'admin-payments': 'admin_payments',
  'admin-reviews': 'admin_reviews',
  'admin-settings': 'admin_settings',
  'admin-prescription-settings': 'admin_settings',
  'admin-audit': 'admin_audit',
  'admin-permissions': 'admin_permissions',
  'admin-medical-records': 'admin_medical_records',
  // Enterprise
  'enterprises': 'enterprise_manage',
  'animal-groups': 'enterprise_groups',
  'locations': 'enterprise_locations',
  'movement-log': 'enterprise_movements',
  'campaigns': 'enterprise_campaigns',
  'herd-medical': 'herd_medical',
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
  // Vet Hospitals
  'vet-hospitals': 'hospital_browse',
  'vet-hospitals-manage': 'hospital_manage',
  'admin-hospitals': 'admin_hospitals',
  'admin-compliance': 'admin_compliance',
  // Hospital Network
  'hospital-networks': 'hospital_network_view',
  'admin-network-subscriptions': 'hospital_network_subscription',
  'patient-consent': 'patient_consent_manage',
  'networkMemberships': 'network_membership_manage',
  // Hospital Workflow
  'hospital-workflow': 'hospital_workflow',
  'inpatient': 'inpatient_manage',
  'admin-staff-settings': 'admin_staff_settings',
  // Wallet & Cancellation
  'wallet': 'wallet',
  'admin-cancellation-dashboard': 'admin_cancellation_dashboard',
  'admin-holidays': 'admin_holidays',
  // Timeline
  'animal-timeline': 'animal_timeline',
  // Vaccination
  'vaccination-passport': 'vaccination_passport',
  'admin-vaccine-protocols': 'admin_vaccine_protocols',
  'admin-master-data': 'admin_master_data',
  // Veterinary Certificates
  'vet-certificates': 'vet_certificates',
  'certificate-writer': 'vet_certificates',
  'vet-earnings': 'vet_earnings',
  'admin-certificate-settings': 'admin_certificates',
  // Dispute Management
  'admin-disputes': 'dispute_management',
  // Pharmacy
  'pharmacy': 'pharmacy_view_dashboard',
  // Grooming & Spa
  'grooming-provider': 'grooming_provider_console',
  'grooming-apply': 'grooming_provider_apply',
  'admin-grooming-providers': 'grooming_admin',
  'grooming-find': 'grooming_browse',
  'grooming-my-orders': 'grooming_my_orders',
  'grooming-orders': 'grooming_manage_bookings',
  'grooming-schedule': 'grooming_manage_bookings',
  'grooming-earnings': 'grooming_earnings_view',
}

// ─── Context ────────────────────────────────────────────────
const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

export const PermissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth()
  const [permissions, setPermissions] = useState<string[]>([])
  const [networks, setNetworks] = useState<NetworkAccess[]>([])
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions([])
      setNetworks([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await apiService.getMyPermissions()
      const perms = result.data?.permissions || []
      setPermissions(perms)
      setNetworks(Array.isArray(result.data?.networks) ? result.data.networks : [])
    } catch (err) {
      setPermissions([])
      setNetworks([])
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

  const networkRoleFor = useCallback((networkId: string): string | null => {
    const n = networks.find(x => x.networkId === networkId)
    return n ? n.networkRole : null
  }, [networks])

  const hasNetworkAction = useCallback((networkId: string, action: string): boolean => {
    if (user?.role === 'admin') return true
    const n = networks.find(x => x.networkId === networkId)
    return !!n && n.actions?.[action] === true
  }, [networks, user?.role])

  const hasAnyNetworkRole = useCallback((roles: string[]): boolean => {
    if (user?.role === 'admin') return true
    return networks.some(n => roles.includes(n.networkRole))
  }, [networks, user?.role])

  return (
    <PermissionContext.Provider value={{
      permissions,
      loading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      reloadPermissions: loadPermissions,
      networks,
      hasNetworkAction,
      networkRoleFor,
      hasAnyNetworkRole,
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
