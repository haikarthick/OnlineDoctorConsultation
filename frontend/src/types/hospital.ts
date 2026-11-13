// ─── Vet Hospital Module ────────────────────────────────────

export type HospitalType = 'multi_specialty' | 'specialty' | 'clinic' | 'emergency_center' | 'mobile_vet' | 'research' | 'teaching' | 'other'
export type HospitalDoctorRole = 'owner' | 'medical_director' | 'department_head' | 'consultant' | 'resident' | 'intern' | 'staff' | 'visiting'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'visiting' | 'honorary'
export type ServiceCategory = 'consultation' | 'diagnostics' | 'surgery' | 'vaccination' | 'dental' | 'grooming' | 'boarding' | 'emergency' | 'rehabilitation' | 'nutrition' | 'reproduction' | 'other'

export interface VetHospital {
  id: string
  name: string
  hospitalType: HospitalType
  tagline?: string
  registrationNumber?: string
  accreditationBody?: string
  accreditationNumber?: string
  accreditationExpiry?: string
  description?: string
  address?: string
  city?: string
  state?: string
  country: string
  postalCode?: string
  gpsLatitude?: number
  gpsLongitude?: number
  phone?: string
  emergencyPhone?: string
  email?: string
  website?: string
  logoUrl?: string
  coverImageUrl?: string
  establishedYear?: number
  totalBeds: number
  icuBeds: number
  is24Hours: boolean
  hasEmergency: boolean
  hasAmbulance: boolean
  hasPharmacy: boolean
  hasLab: boolean
  hasImaging: boolean
  hasSurgery: boolean
  hasIcu: boolean
  specializations: string[]
  facilities: string[]
  acceptedSpecies: string[]
  operatingHours: Record<string, any>
  ownerId: string
  isVerified: boolean
  isActive: boolean
  verificationStatus?: 'pending_documents' | 'under_review' | 'approved' | 'rejected' | 'suspended'
  drugLicenseExpiry?: string | null
  tradeLicenseExpiry?: string | null
  registrationRenewalDate?: string | null
  rating: number
  averageRating?: number   // alias for rating, populated by backend
  totalReviews: number
  totalConsultations: number
  createdAt: string
  updatedAt: string
  // computed
  ownerName?: string
  doctorCount?: number
  departmentCount?: number
  totalDoctors?: number       // alias for doctorCount
  totalDepartments?: number   // alias for departmentCount
  hospitalRole?: string  // current user's role (when listing own hospitals)
  isNetworkBranch?: boolean
  branchNetworkId?: string | null
}

export interface HospitalDepartment {
  id: string
  hospitalId: string
  name: string
  code?: string
  description?: string
  specializations: string[]
  floorNumber?: string
  roomNumbers?: string
  headDoctorId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  headDoctorName?: string
  doctorCount?: number
}

export interface HospitalDoctor {
  id: string
  hospitalId: string
  doctorId: string
  userId?: string  // alias for doctorId
  departmentId?: string
  hospitalRole: HospitalDoctorRole
  title?: string
  employmentType: EmploymentType
  isPrimaryHospital: boolean
  consultationFee?: number
  isAcceptingPatients: boolean
  joinedAt: string
  endsAt?: string
  isActive: boolean
  // joined vet profile fields
  doctorName?: string
  firstName?: string    // parsed from doctorName if available
  lastName?: string     // parsed from doctorName if available
  doctorEmail?: string
  departmentName?: string
  specializations?: string[]
  profileImage?: string
  licenseNumber?: string
  yearsOfExperience?: number
  vetProfileRating?: number
}

export interface HospitalService {
  id: string
  hospitalId: string
  serviceName: string
  category: ServiceCategory
  description?: string
  priceMin?: number
  priceMax?: number
  currency: string
  durationMinutes?: number
  requiresAppointment: boolean
  isAvailable: boolean
  createdAt: string
}

export interface HospitalStats {
  totalDoctors: number
  doctorsByRole: Record<string, number>
  totalDepartments: number
  servicesByCategory: Record<string, number>
  totalServices: number
  acceptingPatients?: number
}

export interface HospitalAdminStats {
  // snake_case from DB aggregate query
  total: string
  verified: string
  new_this_month: string
  avg_rating: string
  multi_specialty?: string
  emergency_centers?: string
  // camelCase aliases (populated by frontend helper or future backend update)
  totalHospitals?: number
  verifiedHospitals?: number
  unverifiedHospitals?: number
  newThisMonth?: number
  totalDoctors?: number
  withEmergency?: number
}

export interface CreateHospitalData {
  name: string
  tagline?: string
  hospitalType: HospitalType
  registrationNumber?: string
  accreditationBody?: string
  accreditationNumber?: string
  accreditationExpiry?: string
  description?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  gpsLatitude?: number
  gpsLongitude?: number
  phone?: string
  emergencyPhone?: string
  email?: string
  website?: string
  logoUrl?: string
  coverImageUrl?: string
  establishedYear?: number
  totalBeds?: number
  icuBeds?: number
  is24Hours?: boolean
  hasEmergency?: boolean
  hasAmbulance?: boolean
  hasPharmacy?: boolean
  hasLab?: boolean
  hasImaging?: boolean
  hasSurgery?: boolean
  hasIcu?: boolean
  specializations?: string[]
  facilities?: string[]
  acceptedSpecies?: string[]
  operatingHours?: Record<string, any>
}

// ─── Hospital Documents (KYC / Compliance) ───────────────────
export type DocType =
  | 'pan' | 'gst' | 'aadhaar' | 'bank_account'
  | 'vet_council' | 'trade_license' | 'drug_license'

export type DocStatus = 'pending_review' | 'approved' | 'rejected'

export type VerificationStatus =
  | 'pending_documents' | 'under_review' | 'approved' | 'rejected' | 'suspended'

export interface HospitalDocument {
  id: string
  hospitalId: string
  docType: DocType
  fileName: string
  fileUrl: string
  expiryDate?: string | null
  status: DocStatus
  rejectionReason?: string | null
  reviewedBy?: string | null
  reviewerName?: string
  reviewedAt?: string | null
  createdAt: string
  updatedAt: string
}

export const DOC_LABELS: Record<DocType, string> = {
  pan:           'PAN Card',
  gst:           'GST Certificate',
  aadhaar:       'Aadhaar Card (Owner)',
  bank_account:  'Bank Account Proof',
  vet_council:   'Vet Council Registration',
  trade_license: 'Trade License',
  drug_license:  'Drug License',
}

export const REQUIRED_DOC_TYPES: DocType[] = [
  'pan', 'gst', 'aadhaar', 'bank_account', 'vet_council', 'trade_license', 'drug_license',
]

export const EXPIRY_DOC_TYPES: DocType[] = ['vet_council', 'trade_license', 'drug_license']
