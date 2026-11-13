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
  pen: 'Pen / Corral',
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
  /**
   * 'individual' = one animal row per head; 'batch' = a headcount maintained by the population
   * ledger, with no per-head rows. Decides whether health records attach to an animal or to the
   * group. See docs/BATCH_ANIMAL_MANAGEMENT_PLAN.md.
   */
  managementMode?: 'individual' | 'batch'
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
  status?: 'pending' | 'approved' | 'rejected' | 'completed'
  approvedBy?: string
  approvedByName?: string
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
  pendingNetworkApprovals: number
  pendingUserApprovals: number
  pendingActions: number
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
  userName?: string
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

// ─── Wallet ─────────────────────────────────────────────────
export interface Wallet {
  id: string
  userId: string
  balance: number
  bonusCredits: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface WalletTransaction {
  id: string
  walletId: string
  type: 'credit' | 'debit' | 'refund' | 'bonus'
  amount: number
  description: string
  referenceId?: string
  referenceType?: string
  createdAt: string
}

