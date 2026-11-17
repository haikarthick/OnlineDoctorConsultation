export interface Animal {
  id: string
  name: string
  species: string
  uniqueId?: string
  breed?: string
}

export interface PatientConsent {
  id: string
  animalId: string
  ownerId: string
  grantedToUserId?: string
  grantedToHospitalId?: string
  grantedToNetworkId?: string
  consentScope: 'view_only' | 'full_history' | 'treatment' | 'emergency'
  allowMedicalRecords: boolean
  allowVaccinationRecords: boolean
  allowPrescriptions: boolean
  allowLabResults: boolean
  allowGeneticData: boolean
  includeHospitalRecords: boolean
  allowView: boolean
  allowCreateNotes: boolean
  allowPrescribe: boolean
  validFrom: string
  validUntil?: string
  isActive: boolean
  revokedAt?: string
  revokedReason?: string
  createdAt: string
  animalName?: string
  grantedToUserName?: string
  grantedToHospitalName?: string
  grantedToNetworkName?: string
}

export type GrantToType = 'doctor' | 'hospital' | 'network'
export type ScopeType = 'view_only' | 'full_history' | 'treatment' | 'emergency'

export interface ConsentFormState {
  scope: ScopeType
  grantToType: GrantToType
  grantToId: string
  allowMedicalRecords: boolean
  allowVaccinationRecords: boolean
  allowPrescriptions: boolean
  allowLabResults: boolean
  allowGeneticData: boolean
  includeHospitalRecords: boolean
  allowView: boolean
  allowCreateNotes: boolean
  allowPrescribe: boolean
  validFrom: string
  validUntil: string
}

export const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', cow: '🐄', sheep: '🐑', horse: '🐴',
  pig: '🐖', goat: '🐐', rabbit: '🐇', bird: '🐦', fish: '🐟',
  default: '🐾',
}

export function speciesEmoji(species: string): string {
  const key = (species || '').toLowerCase()
  return SPECIES_EMOJI[key] || SPECIES_EMOJI.default
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export const DEFAULT_FORM: ConsentFormState = {
  scope: 'view_only',
  grantToType: 'doctor',
  grantToId: '',
  allowMedicalRecords: true,
  allowVaccinationRecords: true,
  allowPrescriptions: false,
  allowLabResults: false,
  allowGeneticData: false,
  includeHospitalRecords: false,
  allowView: true,
  allowCreateNotes: false,
  allowPrescribe: false,
  validFrom: todayISO(),
  validUntil: '',
}
