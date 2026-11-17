import React from 'react'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../../context/MasterDataContext'
import { useSettings } from '../../context/SettingsContext'
import { useFarmProfile } from '../../hooks/useFarmProfile'
import { breedingStatusLabelKey } from '../../constants/breedingStatus'
import { asNumber, daysUntil, doseWarnings, lactationState } from '../../utils/farmProfile/animalFacts'
import { calculateAge, classOrGenderLabel } from '../animals/animalsShared'

/**
 * What a vet - or anyone else looking at an animal - needs to know at a glance: who it is, how old,
 * how heavy, and what the farmer has recorded about breeding and milk. ONE component for every
 * screen that shows an animal (consultation room, prescription writer, animal detail), so a
 * pregnant cow reads the same everywhere and a new fact is added in one place.
 *
 * Which facts appear is decided by the farm profile for this species and class, never by a
 * species name: a bull never shows an empty "Milk" row, a calf never shows births.
 */

/** Any animal-shaped record; every field optional because a record may lack any of them. */
export interface SubjectAnimal {
  name?: string | null
  uniqueId?: string | null
  species?: string | null
  breed?: string | null
  animalClass?: string | null
  gender?: string | null
  dateOfBirth?: string | null
  weight?: number | string | null
  currentWeight?: number | string | null
  breedingStatus?: string | null
  expectedDueDate?: string | null
  avgDailyMilkLitres?: number | string | null
  parity?: number | string | null
  lastBirthDate?: string | null
  dryOffDate?: string | null
  enterpriseName?: string | null
  groupName?: string | null
}

/** Adapts a prescription row (its animal fields are prefixed "animal") to the shape above. */
export function subjectFromPrescription(rx: Record<string, any> | null | undefined): SubjectAnimal | null {
  if (!rx || !rx.animalName) return null
  return {
    name: rx.animalName, uniqueId: rx.animalUniqueId, species: rx.animalSpecies, breed: rx.animalBreed,
    animalClass: rx.animalClass, gender: rx.animalGender, dateOfBirth: rx.animalDob, weight: rx.animalWeight,
    breedingStatus: rx.animalBreedingStatus, expectedDueDate: rx.animalDueDate,
    avgDailyMilkLitres: rx.animalAvgMilkLitres, parity: rx.animalParity, dryOffDate: rx.animalDryOffDate,
    groupName: rx.groupName,
  }
}

interface SubjectSummaryProps {
  animal: SubjectAnimal | null | undefined
  /** Vet view: add the "check before choosing a medicine" note for a pregnant or milking animal. */
  emphasis?: boolean
  /** Show the farm and group the animal belongs to. */
  showFarm?: boolean
}

interface Fact { key: string; text: string; tone?: 'alert' | 'quiet' }

export const SubjectSummary: React.FC<SubjectSummaryProps> = ({ animal, emphasis = false, showFarm = false }) => {
  const { t } = useTranslation()
  const { speciesLabel, breedLabel, findClassTerm, resolveLabel } = useMasterData()
  const { formatDate } = useSettings()
  const { profile } = useFarmProfile({ speciesCode: animal?.species, animalClass: animal?.animalClass, gender: animal?.gender })

  if (!animal) return null

  const weight = asNumber(animal.currentWeight) ?? asNumber(animal.weight)
  const yieldPerDay = asNumber(animal.avgDailyMilkLitres)
  const births = asNumber(animal.parity)
  const lactation = lactationState(animal, profile)
  const warnings = doseWarnings(animal, profile)
  const statusKey = profile.fields.pregnancyStatus === 'hidden' ? null : breedingStatusLabelKey(animal.breedingStatus)
  const dueIn = daysUntil(animal.expectedDueDate)

  const facts: Fact[] = []
  if (animal.dateOfBirth) facts.push({ key: 'age', text: calculateAge(t, animal.dateOfBirth) })
  if (weight !== null) facts.push({ key: 'weight', text: t('farmProfile.summary.weightKg', { kg: weight }) })
  if (statusKey) {
    const due = animal.breedingStatus === 'pregnant' && animal.expectedDueDate ? ` · ${t('farmProfile.summary.due', { date: formatDate(animal.expectedDueDate) })}` : ''
    facts.push({ key: 'status', text: `${t(statusKey)}${due}`, tone: warnings.pregnant ? 'alert' : undefined })
  }
  if (lactation === 'lactating') {
    facts.push({ key: 'milk', text: `${t('farmProfile.summary.inMilk')}${yieldPerDay !== null ? ` · ${t('farmProfile.summary.milkPerDay', { litres: yieldPerDay })}` : ''}`, tone: 'alert' })
  } else if (lactation === 'dry') {
    facts.push({ key: 'dry', text: t('farmProfile.summary.dry') })
  }
  if (births !== null && profile.fields.parity !== 'hidden') facts.push({ key: 'births', text: t('farmProfile.summary.births', { count: births }) })
  if (animal.lastBirthDate && profile.fields.lastBirthDate !== 'hidden') facts.push({ key: 'lastBirth', text: t('farmProfile.summary.lastBirth', { date: formatDate(animal.lastBirthDate) }), tone: 'quiet' })
  if (animal.dryOffDate && lactation === 'lactating' && (daysUntil(animal.dryOffDate) ?? -1) > 0) {
    facts.push({ key: 'dryOff', text: t('farmProfile.summary.dryOff', { date: formatDate(animal.dryOffDate) }), tone: 'quiet' })
  }

  const identity = [
    animal.species ? speciesLabel(animal.species, t) : '',
    animal.breed && animal.species ? breedLabel(animal.species, animal.breed) : animal.breed || '',
    animal.species ? classOrGenderLabel(t, findClassTerm, resolveLabel, animal.species, animal.animalClass || undefined, animal.gender || undefined) || '' : '',
  ].filter(Boolean).join(' · ')

  const farm = showFarm && animal.enterpriseName
    ? `${animal.enterpriseName}${animal.groupName ? ` › ${animal.groupName}` : ''}`
    : null

  return (
    <div className="subject-summary">
      <div className="subject-summary-head">
        <strong className="subject-summary-name">{animal.name || '-'}</strong>
        {animal.uniqueId && <span className="subject-summary-id">{animal.uniqueId}</span>}
      </div>
      {identity && <div className="subject-summary-line">{identity}</div>}
      {facts.length > 0 && (
        <ul className="subject-summary-facts">
          {facts.map(f => <li key={f.key} className={`subject-summary-fact${f.tone ? ` is-${f.tone}` : ''}`}>{f.text}</li>)}
        </ul>
      )}
      {farm && <div className="subject-summary-farm">{t('farmProfile.summary.farm')}: {farm}</div>}
      {emphasis && (warnings.pregnant || warnings.lactating) && (
        <div className="subject-summary-warning" role="note">
          <strong>{t('farmProfile.summary.warnTitle')}</strong>
          {warnings.pregnant && <span>{t('farmProfile.summary.warnPregnant')}{dueIn !== null && dueIn >= 0 && dueIn <= 30 ? ` ${t('farmProfile.summary.warnDueSoon', { days: dueIn })}` : ''}</span>}
          {warnings.lactating && <span>{t('farmProfile.summary.warnLactating')}</span>}
        </div>
      )}
    </div>
  )
}
