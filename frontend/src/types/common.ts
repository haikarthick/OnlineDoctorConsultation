import type { UserRole } from './core'

// ─── Cancellation & Reliability ─────────────────────────────
export interface DoctorReliability {
  totalCancellations: number
  monthCancellations: number
  totalBookings: number
  reliabilityScore: number
  isReliable: boolean
}

export interface CancellationStats {
  totalCancellations: number
  doctorCancellations: number
  patientCancellations: number
  adminCancellations: number
  totalRefunded: number
  avgRefundAmount: number
}

export interface GatewaySettings {
  gatewayMode: string
  gatewayUrl: string
  gatewayApiKey: string
  gatewayProvider: string
}

// ─── Pagination & Common ────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface Module {
  id: string
  name: string
  title: string
  description: string
  icon: string
  path: string
  component: React.ComponentType<any>
  roles: UserRole[]
  order: number
}

export interface MenuItem {
  id: string
  label: string
  icon: string
  path: string
  roles: UserRole[]
  subItems?: MenuItem[]
  badge?: string
  section?: string
}

// ═══════════════════════════════════════════════════════════════
