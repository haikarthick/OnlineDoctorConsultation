export interface PassportDose {
  scheduleId: string
  doseNumber: number
  dueDate: string
  administeredAt: string | null
  status: 'pending' | 'administered' | 'overdue' | 'skipped' | 'waived'
  reminderSent: boolean
  vaccinationRecordId: string | null
}

export interface PassportProtocol {
  protocolId: string
  protocolName: string
  disease: string
  category: string
  isZoonotic: boolean
  assignedAt: string
  waived: boolean
  waiverReason: string | null
  compliancePercent: number
  lastAdministeredAt: string | null
  nextDueDate: string | null
  overdueCount: number
  doses: PassportDose[]
}

export interface PassportAnimal {
  animalId: string
  animalName: string
  animalUniqueId?: string
  species: string
  breed: string | null
  gender: string | null
  dateOfBirth: string | null
  ownerName?: string | null
  overallCompliancePercent: number
  protocols: PassportProtocol[]
}

export interface ComplianceSummaryRow {
  animalId: string
  animalName: string
  species: string
  ownerName: string | null
  totalProtocols: number
  administeredDoses: number
  totalDoses: number
  overdueDoses: number
  dueSoon: number
  compliancePercent: number
}

export interface CertificateLog {
  id: string
  animalId: string
  animalName: string | null
  vaccinationRecordId: string | null
  certificateType: string
  fileName: string | null
  generatedByName: string | null
  generatedAt: string
}

export interface GroupPassportData {
  group?: { id: string; name: string; groupType?: string; species?: string; managementMode?: string; currentCount?: number }
  cycle?: any
  vaccines?: { vaccineName: string; vaccineType?: string; applications: number; headCountTreated: number; batchNumbers: string[]; cyclesCovered: string[]; fromCampaign?: boolean; lastAdministeredAt?: string; nextDueDate?: string; coveragePercent?: number | null }[]
  totalApplications?: number
}
