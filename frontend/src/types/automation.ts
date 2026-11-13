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

// ═══════════════════════════════════════════════════════════════
// Next-Generation Innovative Features
// ═══════════════════════════════════════════════════════════════

// ─── AI Veterinary Copilot ───────────────────────────────────
export interface AIChatSession {
  id: string
  enterpriseId?: string
  userId: string
  animalId?: string
  title: string
  contextType: 'general' | 'animal' | 'enterprise' | 'emergency'
  status: 'active' | 'archived'
  messageCount: number
  lastMessageAt?: string
  animalName?: string
  species?: string
  breed?: string
  enterpriseName?: string
  createdAt: string
  updatedAt: string
}

export interface AIChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  confidence?: number
  sources?: string[]
  tokensUsed?: number
  createdAt: string
}

export interface DrugInteractionResult {
  drugs: string[]
  interactions: { drug1: string; drug2: string; severity: string; note: string }[]
  hasInteractions: boolean
}

export interface SymptomAnalysisResult {
  symptoms: string[]
  species: string
  findings: { symptom: string; response: string; confidence: number; sources: string[] }[]
  overallUrgency: string
  disclaimer: string
}

// ─── Digital Twin & Simulator ────────────────────────────────
export interface DigitalTwin {
  id: string
  enterpriseId: string
  name: string
  twinType: 'farm' | 'herd' | 'facility' | 'supply_chain'
  description?: string
  modelData: Record<string, any>
  currentState: Record<string, any>
  creatorName?: string
  createdAt: string
  updatedAt: string
}

export interface SimulationRun {
  id: string
  twinId: string
  enterpriseId: string
  name: string
  scenarioType: 'disease_spread' | 'resource_optimization' | 'financial_forecast' | 'capacity_planning'
  parameters: Record<string, any>
  inputState: Record<string, any>
  resultData: { rows: any[]; summary: Record<string, any>; totalRows: number }
  outcomeSummary: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed'
  durationMs?: number
  twinName?: string
  createdAt: string
}

