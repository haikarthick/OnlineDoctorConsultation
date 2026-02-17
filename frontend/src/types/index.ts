export type UserRole = 'veterinarian' | 'pet_owner' | 'farmer' | 'admin'
export type ConsultationStatus = 'pending' | 'confirmed' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'missed'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded'
export type VideoSessionStatus = 'waiting' | 'active' | 'paused' | 'ended' | 'failed'
export type AppointmentPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency'
export type ReviewStatus = 'pending' | 'approved' | 'active' | 'hidden' | 'flagged' | 'removed'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: UserRole
  avatar?: string
  isActive?: boolean
  isVerified?: boolean
  createdAt?: string
}

export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
}

export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  role: UserRole
}

// ─── Consultation & Booking ─────────────────────────────────
export interface Consultation {
  id: string
  userId: string
  veterinarianId: string
  animalId?: string
  animalType: string
  symptomDescription: string
  status: ConsultationStatus
  priority: AppointmentPriority
  bookingId?: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  duration?: number
  diagnosis?: string
  prescription?: string
  followUpDate?: string
  notes?: string
  videoSessionId?: string
  title?: string
  petOwnerName?: string
  vetName?: string
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: string
  petOwnerId: string
  veterinarianId: string
  animalId?: string
  consultationId?: string
  scheduledDate: string
  timeSlotStart: string
  timeSlotEnd: string
  status: BookingStatus
  bookingType: 'video_call' | 'in_person' | 'phone' | 'chat'
  consultationType?: string
  priority: AppointmentPriority
  reasonForVisit: string
  reason?: string
  symptoms?: string
  notes?: string
  cancellationReason?: string
  confirmedAt?: string
  petOwnerName?: string
  vetName?: string
  createdAt: string
  updatedAt: string
}

export interface TimeSlot {
  startTime: string
  endTime: string
  isAvailable: boolean
  bookingId?: string
}

export interface VetAvailability {
  veterinarianId: string
  date: string
  slots: TimeSlot[]
}

// ─── Video Session ──────────────────────────────────────────
export interface VideoSession {
  id: string
  consultationId: string
  roomId: string
  hostUserId: string
  participantUserId: string
  status: VideoSessionStatus
  startedAt?: string
  endedAt?: string
  duration?: number
  recordingUrl?: string
  quality?: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  message: string
  messageType: 'text' | 'image' | 'file' | 'system'
  timestamp: string
}

// ─── Medical & Prescription ─────────────────────────────────
export interface MedicalRecord {
  id: string
  userId: string
  animalId?: string
  consultationId?: string
  veterinarianId?: string
  recordType: string
  recordNumber?: string
  title?: string
  content: string
  severity?: string
  status?: string
  medications?: Medication[]
  attachments?: any[]
  isConfidential?: boolean
  followUpDate?: string
  tags?: string[]
  fileUrl?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  ownerName?: string
  animalName?: string
  animalUniqueId?: string
  ownerUniqueId?: string
  veterinarianName?: string
}

export interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

export interface Prescription {
  id: string
  consultationId: string
  veterinarianId: string
  petOwnerId: string
  animalId?: string
  medications: Medication[]
  instructions: string
  validUntil: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface VaccinationRecord {
  id: string
  animalId: string
  vaccineName: string
  vaccineType?: string
  batchNumber?: string
  manufacturer?: string
  dateAdministered: string
  nextDueDate?: string
  administeredBy?: string
  siteOfAdministration?: string
  dosage?: string
  reactionNotes?: string
  isValid: boolean
  certificateNumber?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  administeredByName?: string
  animalName?: string
  animalUniqueId?: string
}

export interface WeightRecord {
  id: string
  animalId: string
  weight: number
  unit: string
  recordedAt: string
  recordedBy?: string
  notes?: string
  createdAt: string
  recordedByName?: string
}

export interface AllergyRecord {
  id: string
  animalId: string
  allergen: string
  reaction?: string
  severity: string
  identifiedDate?: string
  isActive: boolean
  notes?: string
  reportedBy?: string
  createdAt: string
  updatedAt: string
  reportedByName?: string
}

export interface LabResult {
  id: string
  animalId: string
  consultationId?: string
  medicalRecordId?: string
  testName: string
  testCategory?: string
  testDate: string
  resultValue?: string
  normalRange?: string
  unit?: string
  status: string
  interpretation?: string
  labName?: string
  orderedBy?: string
  verifiedBy?: string
  isAbnormal: boolean
  attachments?: any[]
  notes?: string
  createdAt: string
  updatedAt: string
  orderedByName?: string
  verifiedByName?: string
  animalName?: string
  animalUniqueId?: string
}

export interface MedicalTimeline {
  id: string
  type: string
  title: string
  description: string
  date: string
  severity?: string
  status?: string
  createdBy?: string
  createdByName?: string
  metadata?: any
}

export interface MedicalAuditEntry {
  id: string
  recordId: string
  recordType: string
  action: string
  changedBy?: string
  changedByName?: string
  oldValues?: any
  newValues?: any
  changeReason?: string
  ipAddress?: string
  createdAt: string
}

// ─── Vet Profile & Schedule ─────────────────────────────────
export interface VetProfile {
  id: string
  userId: string
  licenseNumber?: string
  specializations: string[]
  qualifications: string[]
  experience: number
  bio?: string
  consultationFee: number
  currency: string
  rating: number
  totalReviews: number
  totalConsultations: number
  isAvailable: boolean
  acceptsEmergency?: boolean
  languages: string[]
  clinicName?: string
  clinicAddress?: string
  profileImage?: string
  createdAt: string
  updatedAt: string
  // joined user fields for display
  firstName?: string
  lastName?: string
  email?: string
}

export interface VetSchedule {
  id: string
  veterinarianId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  slotDuration: number
  slotDurationMinutes: number
  maxAppointments: number
  isActive: boolean
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

// ─── Review ─────────────────────────────────────────────────
export interface Review {
  id: string
  consultationId: string
  reviewerId: string
  veterinarianId: string
  rating: number
  comment?: string
  responseFromVet?: string
  isPublic: boolean
  isVerified?: boolean
  helpfulCount?: number
  reportCount?: number
  status: ReviewStatus
  petOwnerName?: string
  vetName?: string
  createdAt: string
  updatedAt: string
  reviewerName?: string
}

// ─── Payment ────────────────────────────────────────────────
export interface Payment {
  id: string
  consultationId: string
  bookingId?: string
  payerId: string
  payeeId: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentMethod: string
  transactionId?: string
  invoiceNumber?: string
  taxAmount?: number
  discountAmount?: number
  refundAmount?: number
  refundReason?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Animal / Pet ───────────────────────────────────────────
export interface Animal {
  id: string
  ownerId: string
  name: string
  species: string
  breed?: string
  gender?: string
  dateOfBirth?: string
  weight?: number
  color?: string
  microchipId?: string
  allergies?: string[]
  medicalNotes?: string
  profileImage?: string
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

// ─── Notification ───────────────────────────────────────────
export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'booking' | 'consultation' | 'payment' | 'review' | 'system' | 'reminder' | 'video_call'
  referenceId?: string
  isRead: boolean
  actionUrl?: string
  priority: string
  createdAt: string
}

// ─── Admin ──────────────────────────────────────────────────
export interface AdminDashboardStats {
  totalUsers: number
  activeUsers: number
  totalPetOwners: number
  totalVeterinarians: number
  totalVets: number
  totalConsultations: number
  activeConsultations: number
  completedConsultations: number
  cancelledConsultations: number
  totalRevenue: number
  totalPayments: number
  pendingPayments: number
  pendingBookings: number
  totalReviews: number
  averageRating: number
  totalBookings: number
  todayBookings: number
  activeVideoSessions: number
  systemHealth: {
    uptime: number
    memoryUsage: number
    cpuUsage: number
    activeConnections: number
  }
}

export interface AuditLog {
  id: string
  userId: string
  userEmail?: string
  action: string
  resource: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, any> | string
  ipAddress?: string
  timestamp: string
}

export interface SystemSetting {
  id?: string
  key: string
  value: string
  category?: string
  description?: string
  updatedBy?: string
  updatedAt?: string
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
}
