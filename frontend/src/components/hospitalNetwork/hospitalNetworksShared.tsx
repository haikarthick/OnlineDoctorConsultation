import React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HospitalNetwork {
  id: string
  name: string
  legalName?: string
  registrationNumber?: string
  taxId?: string
  networkType?: string
  country?: string
  headquartersCity?: string
  headquartersState?: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  isActive: boolean
  isApproved: boolean
  createdAt: string
  updatedAt?: string
  approvedByName?: string
  memberCount?: number
  hospitalCount?: number
  idPrefix?: string
}

export interface NetworkMember {
  id: string
  networkId: string
  userId: string
  networkRole: string
  hospitalId?: string
  isActive: boolean
  grantedAt: string
  userName?: string
  userEmail?: string
  userRole?: string
  hospitalName?: string
}

export interface NetworkDashboard {
  totalMembers: number
  totalHospitals: number
  totalPatients: number
  activeConsents: number
  recentAccessLogs?: any[]
  membersByRole?: Record<string, number>
}

export interface NetworkHospital {
  id: string
  name: string
  city?: string
  state?: string
  hospitalType?: string
  contactEmail?: string
  contactPhone?: string
  isVerified?: boolean
  isNetworkBranch?: boolean
  specializations?: string[]
  staffCount?: number
}

export interface AuditEntry {
  id: string
  accessedBy: string
  accessorName: string
  accessorEmail: string
  accessorRole: string
  animalId: string
  animalName: string
  animalUniqueId: string
  recordType: string
  accessType: string
  accessGranted: boolean
  denialReason: string
  consentId: string
  accessedAt: string
}

export interface AuditStats {
  total: number
  granted: number
  denied: number
  last7days: number
}

export interface PatientSearchResult {
  userId: string
  userName: string
  userEmail: string
  userPhone?: string
  animals: Array<{ id: string; name: string; species: string; uniqueId?: string }>
}

export interface EnrollmentRecord {
  id: string
  animalId: string
  enrollmentStatus: string
  networkPatientId?: string
  enrollmentRequestedAt: string
  enrollmentRespondedAt?: string
  animalName: string
  species: string
  ownerName: string
  ownerEmail: string
}

export interface WalkInInviteForm {
  patientName: string
  patientEmail: string
  patientPhone: string
  animalName: string
  animalSpecies: string
  message: string
}

export interface BranchHospitalFormData {
  name: string
  hospitalType: string
  address: string
  city: string
  state: string
  country: string
  postalCode: string
  phone: string
  email: string
  description: string
  operatingHours?: string
  specializations?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const NETWORK_TYPES = [
  { value: 'private', label: 'Private' },
  { value: 'government', label: 'Government' },
  { value: 'ngo', label: 'NGO' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'franchise', label: 'Franchise' },
]

export const MEMBER_ROLES = [
  { value: 'corporate_admin', label: 'Corporate Admin' },
  { value: 'hospital_director', label: 'Hospital Director' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'hospital_staff', label: 'Hospital Staff' },
]

export const AUDIT_RECORD_TYPE_LABELS: Record<string, string> = {
  animal_profile: 'Profile',
  consultations: 'Consultations',
  prescriptions: 'Prescriptions',
  vaccinations: 'Vaccinations',
}

export const EMPTY_NETWORK_FORM = {
  name: '', legalName: '', registrationNumber: '', taxId: '',
  networkType: 'private', country: '', headquartersCity: '', headquartersState: '',
  contactEmail: '', contactPhone: '', website: '',
  dpoName: '', dpoEmail: '', dataResidencyRegion: '',
  idPrefix: '',
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────
export interface RoleBadgeProps { role: string }
export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const label = MEMBER_ROLES.find(r => r.value === role)?.label ?? role
  return <span className={`hn-role-badge hn-role-badge-${role}`}>{label}</span>
}

// ─── NetworkTypeLabel ─────────────────────────────────────────────────────────
export interface NetworkTypeLabelProps { type?: string }
export const NetworkTypeLabel: React.FC<NetworkTypeLabelProps> = ({ type }) => {
  const label = NETWORK_TYPES.find(t => t.value === type)?.label ?? type ?? '-'
  return <span>{label}</span>
}
