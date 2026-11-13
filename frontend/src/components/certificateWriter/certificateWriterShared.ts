import type { TFunction } from 'i18next'

export const CERT_TYPES_PET = [
  'health_certificate', 'fitness_to_travel', 'rabies_vaccination', 'vaccination_record',
  'pre_travel', 'sterilization', 'treatment', 'animal_injury', 'post_mortem',
  'fitness_for_sale',
]

export const CERT_TYPES_FARM = [
  'breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation', 'animal_valuation',
  'movement_permit', 'herd_health_certificate', 'slaughter_fitness', 'export_health_certificate',
]

// Herd-level certs: animal selection optional (cert covers a group)
export const CERT_TYPES_HERD = ['herd_health_certificate']

// Group-capable certs: can name a real animal_groups row (batch herd/flock) as the subject.
// These are the inherently-batch document types the backend persists group_id/cycle_id for.
export const CERT_TYPES_GROUP = ['herd_health_certificate', 'movement_permit', 'slaughter_fitness', 'export_health_certificate']

export interface VaccineRow {
  vaccine: string; batchNo: string; dateAdministered: string; nextDue: string; manufacturer: string
}

export const emptyVaccineRow = (): VaccineRow => ({
  vaccine: '', batchNo: '', dateAdministered: '', nextDue: '', manufacturer: ''
})

export const certTypeLabel = (t: TFunction, type: string) =>
  t(`vetCertificates.certTypes.${type}` as any) || type.replace(/_/g, ' ')
