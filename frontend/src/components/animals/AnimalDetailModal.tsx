import React from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'
import { SectionTitle, classOrGenderLabel, calculateAge, type AnimalData } from './animalsShared'
import { useFarmProfile } from '../../hooks/useFarmProfile'
import { breedingStatusLabelKey } from '../../constants/breedingStatus'
import { asNumber } from '../../utils/farmProfile/animalFacts'
import NutritionPanel from '../nutrition/NutritionPanel'

interface Props {
  detailAnimal: AnimalData
  onClose: () => void
  onEdit: (animal: AnimalData) => void
  canManageAnimals: boolean
  t: TFunction
  speciesIcon: (species?: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  breedLabel: (species: string | undefined, breed: string) => string
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined
  resolveLabel: (item: AnimalClassTerm, t: (key: string) => string) => string
  formatDate: (date: string) => string
  navigate: (path: string) => void
}

/**
 * The breeding and production rows of the detail view. Which rows appear comes from the farm
 * profile for this species and class - the same rule the form uses - so a bull never shows an empty
 * milk row. Replaces two lines that mapped every status that was not "pregnant" or "not bred" to
 * "Not pregnant", which is how a served-but-unconfirmed animal came to read as not pregnant.
 */
const ProductionRows: React.FC<{ animal: AnimalData; t: TFunction; formatDate: (date: string) => string }> = ({ animal, t, formatDate }) => {
  const { profile } = useFarmProfile({ speciesCode: animal.species, animalClass: animal.animalClass, gender: animal.gender })
  const shown = (f: keyof typeof profile.fields) => profile.fields[f] !== 'hidden'
  const statusKey = shown('pregnancyStatus') ? breedingStatusLabelKey(animal.breedingStatus) : null
  const milk = asNumber(animal.avgDailyMilkLitres)
  const births = asNumber(animal.parity)
  const birthWeight = asNumber(animal.birthWeight)
  const row = (key: string, label: string, value: string) => (
    <div key={key}><span className="si-23033f05">{label}</span> <strong>{value}</strong></div>
  )
  return (
    <>
      {statusKey && row('status', t('animalClass.breedingStatus'), t(statusKey))}
      {statusKey && (animal.breedingStatus === 'pregnant' || animal.breedingStatus === 'bred') && animal.expectedDueDate && row('due', t('animalClass.expectedDueDate'), formatDate(animal.expectedDueDate))}
      {shown('avgDailyMilk') && milk !== null && row('milk', t('farmProfile.fieldLabels.avgDailyMilk'), `${milk} L`)}
      {shown('parity') && births !== null && row('parity', t('farmProfile.fieldLabels.parity'), String(births))}
      {shown('lastBirthDate') && animal.lastBirthDate && row('lastBirth', t('farmProfile.fieldLabels.lastBirthDate'), formatDate(animal.lastBirthDate))}
      {shown('dryOffDate') && animal.dryOffDate && row('dryOff', t('farmProfile.fieldLabels.dryOffDate'), formatDate(animal.dryOffDate))}
      {birthWeight !== null && row('birthWeight', t('farmProfile.fieldLabels.birthWeight'), `${birthWeight} kg`)}
    </>
  )
}

const AnimalDetailModal: React.FC<Props> = ({
  detailAnimal, onClose, onEdit, canManageAnimals, t, speciesIcon, speciesLabel, breedLabel,
  findClassTerm, resolveLabel, formatDate, navigate
}) => (
  <div className="si-10f9485f"
    onClick={onClose}>
    <div className="si-64d8c528"
      onClick={e => e.stopPropagation()}>
      {/* Modal Header */}
      <div className="si-b4f50afa">
        <div className="si-1ec723fc">
          <span className="si-0067e898">{speciesIcon(detailAnimal.species)}</span>
          <div>
            <div className="si-f0920f33">{detailAnimal.name}</div>
            <div className="si-e17c55f7">{speciesLabel(detailAnimal.species, t)}{detailAnimal.breed ? ` • ${breedLabel(detailAnimal.species, detailAnimal.breed)}` : ''} - {detailAnimal.uniqueId}</div>
          </div>
        </div>
        <button onClick={onClose} className="si-1b1a545b">✕</button>
      </div>
      {/* Modal Body */}
      <div className="si-4cea2692">
        <SectionTitle icon="📝" text={t('animals.detailModal.basicInfo')} />
        <div className="si-7e1e70ef">
          <div><span className="si-23033f05">{t('animals.detailModal.name')}</span> <strong>{detailAnimal.name}</strong></div>
          <div><span className="si-23033f05">{t('animals.detailModal.species')}</span> <strong>{speciesLabel(detailAnimal.species, t)}</strong></div>
          {detailAnimal.breed && <div><span className="si-23033f05">{t('animals.detailModal.breed')}</span> <strong>{breedLabel(detailAnimal.species, detailAnimal.breed)}</strong></div>}
          {(detailAnimal.animalClass || detailAnimal.gender) && <div><span className="si-23033f05">{t('animals.detailModal.gender')}</span> <strong>{classOrGenderLabel(t, findClassTerm, resolveLabel, detailAnimal.species, detailAnimal.animalClass, detailAnimal.gender)}</strong></div>}
          {detailAnimal.dateOfBirth && <div><span className="si-23033f05">{t('animals.detailModal.dob')}</span> <strong>{formatDate(detailAnimal.dateOfBirth)}</strong></div>}
          {detailAnimal.sireName && <div><span className="si-23033f05">{t('animalClass.sire')}</span> <strong>{detailAnimal.sireName}</strong></div>}
          {detailAnimal.damName && <div><span className="si-23033f05">{t('animalClass.dam')}</span> <strong>{detailAnimal.damName}</strong></div>}
          <ProductionRows animal={detailAnimal} t={t} formatDate={formatDate} />
          {detailAnimal.dateOfBirth && <div><span className="si-23033f05">{t('animals.detailModal.age')}</span> <strong>{calculateAge(t, detailAnimal.dateOfBirth)}</strong></div>}
          {detailAnimal.weight && <div><span className="si-23033f05">{t('animals.detailModal.weight')}</span> <strong>{detailAnimal.weight} kg</strong></div>}
          {detailAnimal.color && <div><span className="si-23033f05">{t('animals.detailModal.color')}</span> <strong>{detailAnimal.color}</strong></div>}
          <div><span className="si-23033f05">{t('animals.detailModal.neutered')}</span> <strong>{detailAnimal.isNeutered === null || detailAnimal.isNeutered === undefined ? '-' : detailAnimal.isNeutered ? t('animals.detailModal.yesCheck') : t('animals.detailModal.no')}</strong></div>
          {detailAnimal.ownerName && <div><span className="si-23033f05">{t('animals.detailModal.owner')}</span> <strong>{detailAnimal.ownerName}</strong></div>}
        </div>

        {/* Food plan, feeding, weight and body condition - the same panel every role sees (hidden while nutrition is off) */}
        <NutritionPanel animalId={detailAnimal.id} compact />

        <SectionTitle icon="🏷️" text={t('animals.detailModal.identificationSection')} />
        <div className="si-7e1e70ef">
          <div><span className="si-23033f05">{t('animals.detailModal.systemId')}</span> <strong className="si-d70e5ad0">{detailAnimal.uniqueId}</strong></div>
          {detailAnimal.microchipId && <div><span className="si-23033f05">{t('animals.detailModal.microchip')}</span> <strong className="si-d70e5ad0">{detailAnimal.microchipId}</strong></div>}
          {detailAnimal.earTagId && <div><span className="si-23033f05">{t('animals.detailModal.earTag')}</span> <strong className="si-d70e5ad0">{detailAnimal.earTagId}</strong></div>}
          {detailAnimal.registrationNumber && <div><span className="si-23033f05">{t('animals.detailModal.regNumber')}</span> <strong className="si-d70e5ad0">{detailAnimal.registrationNumber}</strong></div>}
        </div>

        {(detailAnimal.insuranceProvider || detailAnimal.insurancePolicyNumber) && (
          <>
            <SectionTitle icon="🛡️" text={t('animals.detailModal.insuranceSection')} />
            <div className="si-7e1e70ef">
              {detailAnimal.insuranceProvider && <div><span className="si-23033f05">{t('animals.detailModal.provider')}</span> <strong>{detailAnimal.insuranceProvider}</strong></div>}
              {detailAnimal.insurancePolicyNumber && <div><span className="si-23033f05">{t('animals.detailModal.policyNumber')}</span> <strong className="si-d70e5ad0">{detailAnimal.insurancePolicyNumber}</strong></div>}
              {detailAnimal.insuranceExpiry && <div><span className="si-23033f05">{t('animals.detailModal.expiry')}</span> <strong>{formatDate(detailAnimal.insuranceExpiry)}</strong></div>}
            </div>
          </>
        )}

        {detailAnimal.medicalNotes && (
          <>
            <SectionTitle icon="📋" text={t('animals.detailModal.medicalNotesSection')} />
            <p className="si-7670ba8d">{detailAnimal.medicalNotes}</p>
          </>
        )}
      </div>
      <div className="si-6a645de2">
        <button className="btn-small" onClick={() => navigate('/medical-records')}>{t('animals.detailModal.medicalRecords')}</button>
        {canManageAnimals && <button className="btn-small si-f8147336" onClick={() => onEdit(detailAnimal)}>{t('animals.detailModal.editBtn')}</button>}
        <button className="btn-small si-c0374481" onClick={onClose}>{t('animals.detailModal.closeBtn')}</button>
      </div>
    </div>
  </div>
)

export default AnimalDetailModal
