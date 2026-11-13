// ─── Types ────────────────────────────────────────────────────
export interface VaccinationEntry {
  vaccine?: string
  batchNo?: string
  dateAdministered?: string
  nextDue?: string
  manufacturer?: string
}

export interface CertificatePrintData {
  id: string
  certificateNumber: string
  certificateType: string
  status: 'draft' | 'active' | 'revoked' | 'expired'
  examinationDate?: string
  issuedAt?: string
  validUntil?: string
  clinicalFindings?: string
  diagnosis?: string
  treatmentSummary?: string
  recommendations?: string
  notes?: string
  revocationReason?: string
  // JSONB detail objects
  vaccinationDetails?: { vaccines?: VaccinationEntry[]; [k: string]: any }
  travelDetails?: { destination?: string; departureDate?: string; airline?: string; [k: string]: any }
  breedingDetails?: {
    soundness?: string
    pregnancyStatus?: string
    estimatedGestation?: string
    [k: string]: any
  }
  valuationDetails?: { amount?: string | number; basis?: string; [k: string]: any }
  movementDetails?: {
    fromLocation?: string
    toLocation?: string
    vehicleNumber?: string
    transportDate?: string
    driverName?: string
    purpose?: string
    [k: string]: any
  }
  herdDetails?: {
    groupName?: string
    animalCount?: number | string
    species?: string
    purpose?: string
    [k: string]: any
  }
  // Animal / patient
  animalName?: string
  animalSpecies?: string
  animalBreed?: string
  animalDob?: string
  animalGender?: string
  animalClass?: string
  // Owner
  ownerFirstName?: string
  ownerLastName?: string
  ownerEmail?: string
  // Vet
  vetFirstName?: string
  vetLastName?: string
  vetLicenseNumber?: string
  vetSpecializations?: string[]
  vetClinicName?: string
}

export interface CertificateTemplate {
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  clinicEmail: string
  clinicWebsite: string
  registrationNumber: string
  clinicLogo: string
  footerText: string
}

export const DEFAULT_TEMPLATE: CertificateTemplate = {
  clinicName: 'waytovet Platform',
  clinicAddress: '123 Veterinary Avenue, Chennai, Tamil Nadu 600001, India',
  clinicPhone: '+91 44 1234 5678',
  clinicEmail: 'care@waytovet.com',
  clinicWebsite: 'www.waytovet.com',
  registrationNumber: 'VET-REG-2024-001',
  clinicLogo: '',
  footerText:
    'This certificate is digitally generated. Contact the issuing veterinarian for queries or verification.',
}

// ── Type-specific labels ──────────────────────────────────────
export const CERT_TYPE_LABELS: Record<string, string> = {
  health_certificate: 'GENERAL HEALTH CERTIFICATE',
  fitness_to_travel: 'FITNESS TO TRAVEL CERTIFICATE',
  rabies_vaccination: 'RABIES VACCINATION CERTIFICATE',
  vaccination_record: 'VACCINATION RECORD',
  pre_travel: 'PRE-TRAVEL VETERINARY CERTIFICATE',
  sterilization: 'STERILIZATION CERTIFICATE',
  treatment: 'TREATMENT CERTIFICATE',
  animal_injury: 'ANIMAL INJURY CERTIFICATE',
  post_mortem: 'POST-MORTEM REPORT',
  breeding_soundness: 'BREEDING SOUNDNESS CERTIFICATE',
  pregnancy_diagnosis: 'PREGNANCY DIAGNOSIS CERTIFICATE',
  infertility_evaluation: 'INFERTILITY / HEALTH EVALUATION',
  fitness_for_sale: 'FITNESS FOR SALE CERTIFICATE',
  animal_valuation: 'ANIMAL VALUATION CERTIFICATE',
}

export function calcAge(dob?: string): string {
  if (!dob) return '-'
  const ms = Date.now() - new Date(dob).getTime()
  const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25))
  if (years >= 1) return `${years}y`
  const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44))
  return months > 0 ? `${months}mo` : '<1mo'
}
