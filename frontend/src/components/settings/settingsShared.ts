export interface VetFormState {
  consultationFee: string
  bio: string
  specializations: string
  qualifications: string
  languages: string
  clinicName: string
  clinicAddress: string
  licenseNumber: string
  yearsOfExperience: string
  availableDays: string
  availableHoursStart: string
  availableHoursEnd: string
  isAvailable: boolean
  acceptsEmergency: boolean
  profileImage: string
}

export const CERTIFICATE_TYPES = [
  'health_certificate', 'fitness_to_travel', 'rabies_vaccination', 'vaccination_record',
  'pre_travel', 'sterilization', 'treatment', 'animal_injury', 'post_mortem',
  'breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation',
  'fitness_for_sale', 'animal_valuation',
]
