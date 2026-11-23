import React from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'
import type { FarmProfile } from '../../utils/farmProfile/resolveFarmProfile'

export interface AnimalData {
  id: string; uniqueId?: string; name: string; species: string; breed?: string;
  dateOfBirth?: string; gender?: string; weight?: number; color?: string;
  microchipId?: string; earTagId?: string; registrationNumber?: string;
  isNeutered?: boolean | null; insuranceProvider?: string; insurancePolicyNumber?: string;
  insuranceExpiry?: string; medicalNotes?: string; ownerName?: string;
  enterpriseId?: string; groupId?: string; enterpriseName?: string; groupName?: string; groupColor?: string;
  animalClass?: string; sireId?: string; damId?: string; sireName?: string; damName?: string;
  breedingStatus?: string; lastBreedingDate?: string; expectedDueDate?: string;
  // Production facts (migration 044). DECIMAL columns arrive as strings.
  avgDailyMilkLitres?: number | string | null; parity?: number | null; lastBirthDate?: string | null;
  dryOffDate?: string | null; birthWeight?: number | string | null;
  // Owned by the animal profile, also asked by nutrition when missing (migration 056).
  activityLevel?: string | null; housing?: string | null;
}

export interface EnterpriseOption { id: string; name: string }
export interface GroupOption { id: string; name: string }

export interface AnimalFormData {
  name: string; species: string; breed: string; customBreed: string; gender: string;
  weight: string; color: string; dateOfBirth: string; microchipId: string; earTagId: string;
  registrationNumber: string; isNeutered: boolean | null; insuranceProvider: string;
  insurancePolicyNumber: string; insuranceExpiry: string; medicalNotes: string;
  enterpriseId: string; groupId: string; animalClass: string; sireId: string; damId: string;
  breedingStatus: string; lastBreedingDate: string; expectedDueDate: string;
  avgDailyMilkLitres: string; parity: string; lastBirthDate: string; dryOffDate: string; birthWeight: string;
  activityLevel: string; housing: string;
}

export const emptyAnimalFormData: AnimalFormData = {
  name: '', species: '', breed: '', customBreed: '', gender: '', weight: '', color: '',
  dateOfBirth: '', microchipId: '', earTagId: '', registrationNumber: '',
  isNeutered: null, insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
  medicalNotes: '', enterpriseId: '', groupId: '',
  animalClass: '', sireId: '', damId: '',
  breedingStatus: '', lastBreedingDate: '', expectedDueDate: '',
  avgDailyMilkLitres: '', parity: '', lastBirthDate: '', dryOffDate: '', birthWeight: '',
  activityLevel: '', housing: '',
}

const datePart = (value?: string | null): string => (value ? value.split('T')[0] : '')
const textOf = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

/** An animal as the edit form holds it. The inverse of buildAnimalPayload for the fields a person types. */
export function animalToFormData(a: AnimalData, breedList: string[]): AnimalFormData {
  const isCustomBreed = !!a.breed && !breedList.includes(a.breed)
  return {
    name: a.name, species: a.species, breed: isCustomBreed ? 'Other' : (a.breed || ''),
    customBreed: isCustomBreed ? (a.breed || '') : '',
    gender: a.gender || '', weight: textOf(a.weight), color: a.color || '',
    dateOfBirth: datePart(a.dateOfBirth),
    microchipId: a.microchipId || '', earTagId: a.earTagId || '',
    registrationNumber: a.registrationNumber || '',
    // unanswered stays unanswered (null) - it is not the same as "no"
    isNeutered: a.isNeutered ?? null,
    insuranceProvider: a.insuranceProvider || '', insurancePolicyNumber: a.insurancePolicyNumber || '',
    insuranceExpiry: datePart(a.insuranceExpiry),
    medicalNotes: a.medicalNotes || '',
    enterpriseId: a.enterpriseId || (a as any).enterprise_id || '',
    groupId: a.groupId || (a as any).group_id || '',
    animalClass: a.animalClass || '', sireId: a.sireId || '', damId: a.damId || '',
    breedingStatus: a.breedingStatus || '',
    lastBreedingDate: datePart(a.lastBreedingDate),
    expectedDueDate: datePart(a.expectedDueDate),
    avgDailyMilkLitres: textOf(a.avgDailyMilkLitres), parity: textOf(a.parity),
    lastBirthDate: datePart(a.lastBirthDate), dryOffDate: datePart(a.dryOffDate),
    birthWeight: textOf(a.birthWeight),
    activityLevel: a.activityLevel || '', housing: a.housing || '',
  }
}

/**
 * The request body for registering or editing an animal.
 *
 * Fields the farm profile hides for this species and class are NOT sent: a screen that never asked
 * for them must not submit stale values (the server would refuse a milk yield for a bull). Hiding is
 * not deleting - an existing value in a hidden field is simply left alone. For a field that IS
 * shown, an empty box on an edit means "clear it" (null); on a new animal it means "not given".
 */
export function buildAnimalPayload(
  form: AnimalFormData,
  profile: Pick<FarmProfile, 'fields'>,
  opts: { editing: boolean; placementVisible: boolean }
): Record<string, unknown> {
  const { editing } = opts
  const shown = (field: keyof FarmProfile['fields']) => profile.fields[field] !== 'hidden'
  const text = (v: string): string | null | undefined => (v ? v : editing ? null : undefined)
  const num = (v: string): number | null | undefined => {
    const n = parseFloat(v.replace(',', '.'))
    return v.trim() !== '' && Number.isFinite(n) ? n : editing ? null : undefined
  }

  const payload: Record<string, unknown> = {
    name: form.name, species: form.species,
    breed: (form.breed === 'Other' ? form.customBreed : form.breed) || undefined,
    gender: form.gender || undefined,
    weight: num(form.weight),
    color: form.color || undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    microchipId: form.microchipId || undefined,
    registrationNumber: form.registrationNumber || undefined,
    isNeutered: form.isNeutered,
    insuranceProvider: form.insuranceProvider || undefined,
    insurancePolicyNumber: form.insurancePolicyNumber || undefined,
    insuranceExpiry: form.insuranceExpiry || undefined,
    medicalNotes: form.medicalNotes || undefined,
    animalClass: form.animalClass || undefined,
    sireId: form.sireId || undefined,
    damId: form.damId || undefined,
    activityLevel: text(form.activityLevel),
    housing: text(form.housing),
  }
  if (shown('earTag')) payload.earTagId = form.earTagId || undefined
  if (shown('birthWeight')) payload.birthWeight = num(form.birthWeight)
  if (shown('pregnancyStatus')) {
    payload.breedingStatus = text(form.breedingStatus)
    payload.lastBreedingDate = text(form.lastBreedingDate)
    payload.expectedDueDate = text(form.expectedDueDate)
  }
  if (shown('parity')) payload.parity = num(form.parity)
  if (shown('lastBirthDate')) payload.lastBirthDate = text(form.lastBirthDate)
  if (shown('avgDailyMilk')) payload.avgDailyMilkLitres = num(form.avgDailyMilkLitres)
  if (shown('dryOffDate')) payload.dryOffDate = text(form.dryOffDate)
  if (opts.placementVisible) {
    payload.enterpriseId = form.enterpriseId || (editing ? null : undefined)
    payload.groupId = form.groupId || (editing ? null : undefined)
  }
  return payload
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
