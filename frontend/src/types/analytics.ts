// ─── Health Analytics ────────────────────────────────
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

// ─── Breeding & Genetics ────────────────────────────
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

// ─── Feed & Inventory ───────────────────────────────
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

// ─── Compliance & Regulatory ────────────────────────
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

// ─── Financial Analytics ────────────────────────────
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

// ─── Smart Alerts ───────────────────────────────────
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
// Advanced Innovative Features
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

