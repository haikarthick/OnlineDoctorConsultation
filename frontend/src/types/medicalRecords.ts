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

