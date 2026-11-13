import React from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'

export interface AnimalData {
  id: string; uniqueId?: string; name: string; species: string; breed?: string;
  dateOfBirth?: string; gender?: string; weight?: number; color?: string;
  microchipId?: string; earTagId?: string; registrationNumber?: string;
  isNeutered?: boolean; insuranceProvider?: string; insurancePolicyNumber?: string;
  insuranceExpiry?: string; medicalNotes?: string; ownerName?: string;
  enterpriseId?: string; groupId?: string; enterpriseName?: string; groupName?: string; groupColor?: string;
  animalClass?: string; sireId?: string; damId?: string; sireName?: string; damName?: string;
  breedingStatus?: string; lastBreedingDate?: string; expectedDueDate?: string;
}

export interface EnterpriseOption { id: string; name: string }
export interface GroupOption { id: string; name: string }

export interface AnimalFormData {
  name: string; species: string; breed: string; customBreed: string; gender: string;
  weight: string; color: string; dateOfBirth: string; microchipId: string; earTagId: string;
  registrationNumber: string; isNeutered: boolean; insuranceProvider: string;
  insurancePolicyNumber: string; insuranceExpiry: string; medicalNotes: string;
  enterpriseId: string; groupId: string; animalClass: string; sireId: string; damId: string;
  breedingStatus: string; lastBreedingDate: string; expectedDueDate: string;
}

export const emptyAnimalFormData: AnimalFormData = {
  name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
  dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
  isNeutered: false, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
  medicalNotes: '', enterpriseId: '', groupId: '',
  animalClass: '', sireId: '', damId: '',
  breedingStatus: '', lastBreedingDate: '', expectedDueDate: ''
}

/** Species-correct class label ("Bullock") when set, falling back to raw gender ("Male"). */
export function classOrGenderLabel(
  t: TFunction,
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined,
  resolveLabel: (item: AnimalClassTerm, t: (key: string) => string) => string,
  species: string, animalClass: string | undefined, gender: string | undefined
): string | null {
  const term = animalClass ? findClassTerm(species, animalClass) : undefined
  // Locale-aware (per-locale override → English label → labelKey translation), via resolveLabel.
  if (term) { const l = resolveLabel(term, t); if (l) return l }
  if (gender === 'male') return t('animals.form.maleDisplay')
  if (gender === 'female') return t('animals.form.femaleDisplay')
  return null
}

export function calculateAge(t: TFunction, dob?: string): string {
  if (!dob) return ''
  const birth = new Date(dob)
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  if (years > 0) return months < 0 ? `${years - 1}y ${12 + months}m` : `${years}y ${months}m`
  return months <= 0 ? t('animals.newborn') : `${months}m`
}

export const SectionTitle: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div className="si-56b1c7d7">
    <span className="si-09aa6941">{icon}</span>
    <span className="si-e378c82e">{text}</span>
  </div>
)
