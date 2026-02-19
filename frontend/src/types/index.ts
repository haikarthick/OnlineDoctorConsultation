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
  uniqueId?: string
  name: string
  species: string
  breed?: string
  gender?: string
  dateOfBirth?: string
  weight?: number
  color?: string
  microchipId?: string
  earTagId?: string
  registrationNumber?: string
  isNeutered?: boolean
  insuranceProvider?: string
  insurancePolicyNumber?: string
  insuranceExpiry?: string
  allergies?: string[]
  medicalNotes?: string
  profileImage?: string
  isActive?: boolean
  ownerName?: string
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

// ─── Enterprise / Farm Management ───────────────────────────
export type EnterpriseType =
  | 'dairy_farm' | 'poultry_farm' | 'cattle_ranch' | 'mixed_farm'
  | 'zoo' | 'breeding_facility' | 'pet_shop' | 'sanctuary'
  | 'equestrian_center' | 'aquaculture' | 'wildlife_reserve'
  | 'veterinary_clinic' | 'kennel' | 'cattery' | 'aviary' | 'other'

export const ENTERPRISE_TYPE_LABELS: Record<EnterpriseType, string> = {
  dairy_farm: 'Dairy Farm',
  poultry_farm: 'Poultry Farm',
  cattle_ranch: 'Cattle Ranch',
  mixed_farm: 'Mixed Farm',
  zoo: 'Zoo',
  breeding_facility: 'Breeding Facility',
  pet_shop: 'Pet Shop',
  sanctuary: 'Sanctuary',
  equestrian_center: 'Equestrian Center',
  aquaculture: 'Aquaculture',
  wildlife_reserve: 'Wildlife Reserve',
  veterinary_clinic: 'Veterinary Clinic',
  kennel: 'Kennel',
  cattery: 'Cattery',
  aviary: 'Aviary',
  other: 'Other',
}

export interface Enterprise {
  id: string
  name: string
  enterpriseType: EnterpriseType
  description?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  gpsLatitude?: number
  gpsLongitude?: number
  totalArea?: number
  areaUnit?: string
  licenseNumber?: string
  regulatoryId?: string
  taxId?: string
  phone?: string
  email?: string
  website?: string
  logoUrl?: string
  ownerId: string
  isActive: boolean
  metadata?: any
  createdAt: string
  updatedAt: string
  ownerName?: string
  memberCount?: number
  animalCount?: number
}

export interface EnterpriseMember {
  id: string
  enterpriseId: string
  userId: string
  role: 'owner' | 'manager' | 'supervisor' | 'worker' | 'farm_vet' | 'viewer'
  title?: string
  permissions?: any
  isActive: boolean
  joinedAt: string
  updatedAt: string
  userName?: string
  userEmail?: string
  userRole?: string
}

export type AnimalGroupType =
  | 'herd' | 'flock' | 'pen' | 'paddock' | 'enclosure'
  | 'tank' | 'aviary' | 'kennel_group' | 'breeding_group'
  | 'quarantine' | 'nursery' | 'production' | 'other'

export const GROUP_TYPE_LABELS: Record<AnimalGroupType, string> = {
  herd: 'Herd',
  flock: 'Flock',
  pen: 'Pen',
  paddock: 'Paddock',
  enclosure: 'Enclosure',
  tank: 'Tank',
  aviary: 'Aviary',
  kennel_group: 'Kennel Group',
  breeding_group: 'Breeding Group',
  quarantine: 'Quarantine',
  nursery: 'Nursery',
  production: 'Production',
  other: 'Other',
}

export interface AnimalGroup {
  id: string
  enterpriseId: string
  name: string
  groupType: AnimalGroupType
  species?: string
  breed?: string
  purpose?: string
  targetCount: number
  currentCount: number
  description?: string
  colorCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  enterpriseName?: string
}

export type LocationType =
  | 'barn' | 'stable' | 'pen' | 'paddock' | 'field' | 'pasture'
  | 'quarantine' | 'isolation' | 'aviary' | 'tank' | 'pond'
  | 'enclosure' | 'kennel' | 'cattery' | 'warehouse' | 'office'
  | 'treatment_area' | 'milking_parlor' | 'feed_storage' | 'other'

export interface FarmLocation {
  id: string
  enterpriseId: string
  name: string
  locationType: LocationType
  parentLocationId?: string
  capacity: number
  currentOccupancy: number
  area?: number
  areaUnit?: string
  gpsLatitude?: number
  gpsLongitude?: number
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  enterpriseName?: string
  parentLocationName?: string
  children?: FarmLocation[]
}

export interface MovementRecord {
  id: string
  enterpriseId: string
  animalId?: string
  groupId?: string
  fromLocationId?: string
  toLocationId?: string
  movementType: 'transfer' | 'intake' | 'discharge' | 'quarantine' | 'sale' | 'death' | 'birth' | 'import' | 'export'
  reason?: string
  animalCount: number
  transportMethod?: string
  transportDate: string
  regulatoryPermit?: string
  recordedBy: string
  notes?: string
  createdAt: string
  animalName?: string
  groupName?: string
  fromLocationName?: string
  toLocationName?: string
  recordedByName?: string
}

export interface TreatmentCampaign {
  id: string
  enterpriseId: string
  groupId?: string
  targetGroupId?: string
  campaignType: 'vaccination' | 'deworming' | 'testing' | 'treatment' | 'health_check' | 'tagging' | 'weighing' | 'hoof_trimming' | 'shearing' | 'dipping' | 'supplement' | 'other'
  name: string
  description?: string
  targetSpecies?: string
  productUsed?: string
  medication?: string
  dosage?: string
  targetCount: number
  completedCount: number
  totalAnimals: number
  treatedCount: number
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  scheduledDate?: string
  startedAt?: string
  completedAt?: string
  administeredBy?: string
  cost: number
  notes?: string
  createdAt: string
  updatedAt: string
  groupName?: string
  administeredByName?: string
}

export interface EnterpriseStats {
  totalAnimals: number
  animalsBySpecies: { species: string; count: number }[]
  totalGroups: number
  totalLocations: number
  campaignsByStatus: Record<string, number>
  totalMembers: number
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

// ═══════════════════════════════════════════════════════════════
// ─── Tier-2: Health Analytics ────────────────────────────────
export interface HealthObservation {
  id: string
  enterpriseId: string
  animalId?: string
  observerId?: string
  observationType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description?: string
  symptoms?: string[]
  bodyTemperature?: number
  heartRate?: number
  respiratoryRate?: number
  weightAtObservation?: number
  isResolved: boolean
  resolvedAt?: string
  createdAt: string
  updatedAt: string
  animalName?: string
  observerName?: string
}

export interface HealthDashboard {
  severityDistribution: { severity: string; count: number }[]
  observationTimeline: { week: string; count: number }[]
  unresolvedByType: { observation_type: string; count: number }[]
  healthScoreDistribution: { range: string; count: number }[]
  criticalObservations: HealthObservation[]
  mortalityTrend: { month: string; deaths: number }[]
}

// ─── Tier-2: Breeding & Genetics ────────────────────────────
export interface BreedingRecord {
  id: string
  enterpriseId: string
  damId: string
  sireId?: string
  breedingDate: string
  breedingMethod?: string
  technicianId?: string
  expectedDueDate?: string
  actualDeliveryDate?: string
  status: 'bred' | 'confirmed_pregnant' | 'not_pregnant' | 'delivered' | 'aborted' | 'reabsorbed'
  offspringCount?: number
  liveOffspring?: number
  stillborn?: number
  notes?: string
  createdAt: string
  updatedAt: string
  damName?: string
  sireName?: string
  technicianName?: string
}

export interface BreedingStats {
  total: number
  bred: number
  confirmed: number
  delivered: number
  live_births: number
  stillbirths: number
  avgGestation: number
}

// ─── Tier-2: Feed & Inventory ───────────────────────────────
export interface FeedItem {
  id: string
  enterpriseId: string
  feedType: string
  name: string
  brand?: string
  batchNumber?: string
  quantityInStock: number
  unit: string
  minimumStockLevel: number
  costPerUnit: number
  currency: string
  expiryDate?: string
  storageLocation?: string
  supplier?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FeedConsumptionLog {
  id: string
  feedId: string
  enterpriseId: string
  animalId?: string
  groupId?: string
  quantityUsed: number
  unit: string
  costAtTime: number
  recordedBy: string
  notes?: string
  consumptionDate: string
  createdAt: string
  feedName?: string
  animalName?: string
  groupName?: string
  recordedByName?: string
}

export interface FeedAnalytics {
  lowStockAlerts: FeedItem[]
  consumptionByType: { feed_type: string; total_used: number; total_cost: number }[]
  dailyConsumptionTrend: { day: string; total_used: number; total_cost: number }[]
  totalInventoryValue: number
}

// ─── Tier-2: Compliance & Regulatory ────────────────────────
export interface ComplianceDocument {
  id: string
  enterpriseId: string
  documentType: string
  documentNumber?: string
  title: string
  issuingAuthority?: string
  issueDate?: string
  expiryDate?: string
  status: 'draft' | 'active' | 'expired' | 'revoked' | 'pending_renewal'
  fileUrl?: string
  notes?: string
  verifiedBy?: string
  verifiedAt?: string
  createdAt: string
  updatedAt: string
  verifiedByName?: string
}

export interface ComplianceSummary {
  expiringSoon: ComplianceDocument[]
  expired: ComplianceDocument[]
  byType: { document_type: string; count: number }[]
  byStatus: { status: string; count: number }[]
}

// ─── Tier-2: Financial Analytics ────────────────────────────
export interface FinancialRecord {
  id: string
  enterpriseId: string
  recordType: 'income' | 'expense'
  category: string
  amount: number
  currency: string
  description?: string
  referenceNumber?: string
  transactionDate: string
  recordedBy: string
  animalId?: string
  groupId?: string
  notes?: string
  createdAt: string
  updatedAt: string
  recordedByName?: string
  animalName?: string
  groupName?: string
}

export interface FinancialDashboard {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  monthlyBreakdown: { month: string; income: number; expenses: number; profit: number }[]
  topExpenseCategories: { category: string; total: number }[]
  revenueByCategory: { category: string; total: number }[]
  recentTransactions: FinancialRecord[]
}

// ─── Tier-2: Smart Alerts ───────────────────────────────────
export interface AlertRule {
  id: string
  enterpriseId: string
  name: string
  ruleType: 'vaccination_due' | 'breeding_due' | 'low_feed_stock' | 'document_expiry' | 'health_threshold' | 'custom'
  conditions: any
  severity: 'info' | 'warning' | 'critical'
  isEnabled: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AlertEvent {
  id: string
  ruleId?: string
  enterpriseId: string
  eventType: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  animalId?: string
  metadata?: any
  isRead: boolean
  readAt?: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  createdAt: string
  ruleName?: string
  animalName?: string
  acknowledgedByName?: string
}

// ═══════════════════════════════════════════════════════════════
// Tier-3: Advanced Innovative Features
// ═══════════════════════════════════════════════════════════════

// ─── AI Disease Prediction ──────────────────────────────────
export interface DiseasePrediction {
  id: string
  enterpriseId: string
  animalId?: string
  groupId?: string
  diseaseName: string
  riskScore: number
  confidence: number
  predictedOnset?: string
  riskFactors: string[]
  recommendedActions: string[]
  status: 'active' | 'resolved' | 'false_positive'
  outcome?: string
  createdBy?: string
  resolvedAt?: string
  createdAt: string
  animalName?: string
  createdByName?: string
}

export interface OutbreakZone {
  id: string
  enterpriseId: string
  locationId?: string
  diseaseName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedCount: number
  totalAtRisk: number
  radiusKm?: number
  centerLat?: number
  centerLng?: number
  containmentStatus: 'monitoring' | 'contained' | 'escalating' | 'resolved'
  containmentActions: string[]
  startedAt: string
  resolvedAt?: string
  locationName?: string
}

export interface RiskDashboard {
  activePredictions: { disease_name: string; avg_risk: number; max_risk: number; count: number }[]
  riskTimeline: { week: string; avg_risk: number; predictions: number }[]
  outcomeDistribution: { outcome: string; count: number }[]
  topRiskAnimals: { id: string; name: string; species: string; breed: string; highest_risk: number; prediction_count: number }[]
  summary: { totalActive: number; avgRisk: number; diseases: number }
}

// ─── Genomic Lineage ────────────────────────────────────────
export interface GeneticProfile {
  id: string
  animalId: string
  enterpriseId: string
  sireId?: string
  damId?: string
  generation: number
  inbreedingCoefficient: number
  geneticTraits: Record<string, any>
  dnaTestDate?: string
  dnaLab?: string
  dnaSampleId?: string
  knownMarkers: string[]
  breedPurityPct?: number
  notes?: string
  createdAt: string
  animalName?: string
  species?: string
  breed?: string
  sireName?: string
  damName?: string
}

export interface LineagePair {
  id: string
  enterpriseId: string
  sireId: string
  damId: string
  compatibilityScore: number
  predictedInbreeding: number
  predictedTraits: Record<string, any>
  recommendation: 'highly_recommended' | 'recommended' | 'neutral' | 'not_recommended' | 'avoid'
  reason?: string
  createdAt: string
  sireName?: string
  sireBreed?: string
  damName?: string
  damBreed?: string
}

// ─── IoT Sensors ────────────────────────────────────────────
export interface IoTSensor {
  id: string
  enterpriseId: string
  locationId?: string
  animalId?: string
  sensorType: string
  sensorName: string
  serialNumber?: string
  manufacturer?: string
  unit?: string
  minThreshold?: number
  maxThreshold?: number
  readingIntervalSeconds: number
  status: 'active' | 'inactive' | 'maintenance' | 'decommissioned'
  batteryLevel?: number
  lastReadingAt?: string
  firmwareVersion?: string
  metadata: Record<string, any>
  createdAt: string
  locationName?: string
  animalName?: string
}

export interface SensorReading {
  id: string
  sensorId: string
  enterpriseId: string
  value: number
  unit?: string
  isAnomaly: boolean
  anomalyType?: string
  metadata: Record<string, any>
  recordedAt: string
  sensorName?: string
  sensorType?: string
}

// ─── Supply Chain & Traceability ────────────────────────────
export interface ProductBatch {
  id: string
  enterpriseId: string
  batchNumber: string
  productType: string
  description?: string
  quantity: number
  unit: string
  sourceAnimalIds: string[]
  sourceGroupId?: string
  productionDate?: string
  expiryDate?: string
  qualityGrade?: string
  certifications: string[]
  currentHolder?: string
  status: 'in_production' | 'quality_check' | 'in_transit' | 'delivered' | 'recalled'
  createdAt: string
  groupName?: string
}

export interface TraceabilityEvent {
  id: string
  enterpriseId: string
  batchId?: string
  animalId?: string
  eventType: string
  title: string
  description?: string
  location?: string
  gpsLat?: number
  gpsLng?: number
  recordedBy?: string
  verifiedBy?: string
  verificationHash?: string
  metadata: Record<string, any>
  eventDate: string
  createdAt: string
  recordedByName?: string
  batchNumber?: string
  animalName?: string
}

export interface QRCode {
  id: string
  enterpriseId: string
  entityType: string
  entityId: string
  codeData: string
  shortUrl?: string
  scanCount: number
  isActive: boolean
  createdAt: string
}

// ─── Workforce & Tasks ──────────────────────────────────────
export interface WorkforceTask {
  id: string
  enterpriseId: string
  title: string
  description?: string
  taskType: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  assignedTo?: string
  createdBy: string
  locationId?: string
  animalId?: string
  groupId?: string
  checklist: { label: string; done: boolean }[]
  dueDate?: string
  startedAt?: string
  completedAt?: string
  estimatedHours?: number
  actualHours?: number
  notes?: string
  createdAt: string
  assignedToName?: string
  createdByName?: string
  animalName?: string
  groupName?: string
  locationName?: string
}

export interface ShiftSchedule {
  id: string
  enterpriseId: string
  userId: string
  shiftDate: string
  startTime: string
  endTime: string
  roleOnShift?: string
  locationId?: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'no_show'
  checkInAt?: string
  checkOutAt?: string
  notes?: string
  createdAt: string
  userName?: string
  locationName?: string
}

// ─── Report Builder ─────────────────────────────────────────
export interface ReportTemplate {
  id: string
  enterpriseId?: string
  name: string
  description?: string
  reportType: string
  config: Record<string, any>
  columns: string[]
  filters: Record<string, any>
  grouping: string[]
  isSystem: boolean
  createdBy?: string
  createdAt: string
}

export interface GeneratedReport {
  id: string
  enterpriseId: string
  templateId?: string
  name: string
  reportType: string
  format: 'json' | 'csv' | 'pdf'
  parameters: Record<string, any>
  resultData: Record<string, any>
  rowCount: number
  fileUrl?: string
  status: 'completed' | 'failed' | 'processing'
  generatedBy: string
  generatedAt: string
  expiresAt?: string
  generatedByName?: string
}
