// ─── Sustainability & Carbon ─────────────────────────────────
export interface SustainabilityMetric {
  id: string
  enterpriseId: string
  metricType: string
  metricName: string
  value: number
  unit?: string
  periodStart: string
  periodEnd: string
  category: string
  scope: 'scope_1' | 'scope_2' | 'scope_3'
  dataSource?: string
  notes?: string
  recordedByName?: string
  createdAt: string
}

export interface SustainabilityGoal {
  id: string
  enterpriseId: string
  goalName: string
  description?: string
  metricType: string
  targetValue: number
  currentValue: number
  unit?: string
  baselineValue?: number
  baselineDate?: string
  targetDate: string
  progressPct: number
  status: 'active' | 'achieved' | 'missed' | 'cancelled'
  creatorName?: string
  createdAt: string
}

export interface CarbonFootprintEstimate {
  estimates: { species: string; count: number; emissionFactor: number; annualCO2kg: number }[]
  totalEstimatedCO2kg: number
  totalEstimatedCO2tons: string
  trackedEmissions: any[]
  methodology: string
}

// ─── Client Portal & Wellness ────────────────────────────────
export interface WellnessScorecard {
  id: string
  animalId: string
  enterpriseId?: string
  ownerId: string
  overallScore: number
  nutritionScore: number
  activityScore: number
  vaccinationScore: number
  dentalScore: number
  weightStatus: 'underweight' | 'normal' | 'overweight' | 'obese'
  nextCheckup?: string
  recommendations: string[]
  riskFlags: string[]
  animalName?: string
  species?: string
  breed?: string
  assessedByName?: string
  assessedAt: string
}

export interface WellnessReminder {
  id: string
  animalId: string
  ownerId: string
  reminderType: string
  title: string
  description?: string
  dueDate: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'snoozed' | 'completed' | 'dismissed'
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  recurrenceInterval?: number
  snoozedUntil?: string
  completedAt?: string
  animalName?: string
  createdAt: string
}

// ─── Geospatial Analytics ────────────────────────────────────
export interface GeofenceZone {
  id: string
  enterpriseId: string
  name: string
  zoneType: 'boundary' | 'pasture' | 'barn' | 'quarantine' | 'water' | 'feeding' | 'restricted'
  centerLat?: number
  centerLng?: number
  radiusMeters?: number
  polygonCoords: { lat: number; lng: number }[]
  color: string
  alertOnEntry: boolean
  alertOnExit: boolean
  isRestricted: boolean
  status: 'active' | 'inactive'
  eventCount?: number
  creatorName?: string
  createdAt: string
}

export interface GeospatialEvent {
  id: string
  enterpriseId: string
  zoneId?: string
  animalId?: string
  sensorId?: string
  eventType: 'zone_entry' | 'zone_exit' | 'proximity_alert' | 'location_update' | 'speed_alert' | 'boundary_breach'
  latitude: number
  longitude: number
  altitude?: number
  accuracyMeters?: number
  speedKmh?: number
  heading?: number
  metadata: Record<string, any>
  zoneName?: string
  animalName?: string
  createdAt: string
}

