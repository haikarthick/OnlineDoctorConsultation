import React from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'
import { classOrGenderLabel, calculateAge, type AnimalData } from './animalsShared'

interface Props {
  animal: AnimalData
  t: TFunction
  speciesIcon: (species?: string) => string
  speciesLabel: (species: string | undefined, t: TFunction) => string
  breedLabel: (species: string | undefined, breed: string) => string
  findClassTerm: (species: string, value: string) => AnimalClassTerm | undefined
  resolveLabel: (item: AnimalClassTerm, t: (key: string) => string) => string
  formatDate: (date: string) => string
  isVet: boolean
  isAdmin: boolean
  isPetOwner: boolean
  canManageAnimals: boolean
  copiedId: string | null
  setCopiedId: React.Dispatch<React.SetStateAction<string | null>>
  setError: (msg: string) => void
  navigate: (path: string) => void
  onViewDetails: (animal: AnimalData) => void
  onEdit: (animal: AnimalData) => void
  onDelete: (id: string) => void
  onDownloadPassport: (animal: AnimalData) => void
  passportLoading: string | null
}

const AnimalCard: React.FC<Props> = ({
  animal, t, speciesIcon, speciesLabel, breedLabel, findClassTerm, resolveLabel, formatDate,
  isVet, isAdmin, isPetOwner, canManageAnimals, copiedId, setCopiedId, setError, navigate,
  onViewDetails, onEdit, onDelete, onDownloadPassport, passportLoading
}) => {
  const age = calculateAge(t, animal.dateOfBirth)
  const insured = animal.insuranceProvider && animal.insurancePolicyNumber
  const insExpired = Boolean(animal.insuranceExpiry && new Date(animal.insuranceExpiry) < new Date())

  return (
    <div className="si-9a7422fb">
      {/* Card Header */}
      <div className="si-6ac50557">
        <div className="si-0b20392f">
          <span className="si-42fc55d5">{speciesIcon(animal.species)}</span>
          <div>
            <div className="si-90c2c65d">{animal.name}</div>
            <div className="si-122e0f6b">{speciesLabel(animal.species, t)}{animal.breed ? ` • ${breedLabel(animal.species, animal.breed)}` : ''}</div>
          </div>
        </div>
        <div className="si-f4e64596">
          <div
            className="si-ddf63368"
            onClick={() => {
              const id = animal.uniqueId
              if (id) {
                navigator.clipboard?.writeText(id).then(() => {
                  setCopiedId(id)
                  setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
                }).catch(() => setError(t('common.copyFailed')))
              }
            }}
            title={animal.uniqueId ? `Click to copy: ${animal.uniqueId}` : ''}
          >
            {animal.uniqueId && copiedId === animal.uniqueId ? `✅ ${t('common.copied')}` : (animal.uniqueId || `ID-${animal.id.substring(0, 8).toUpperCase()}`)}
          </div>
          {age && <div className="si-706df161">{t('animals.cardLabels.age')} {age}</div>}
        </div>
      </div>

      {/* Card Body */}
      <div className="si-d29f2575">
        <div className="si-3b3a79d7">
          {(animal.animalClass || animal.gender) && <div><span className="si-23033f05">{t('animals.cardLabels.gender')}</span> <strong>{classOrGenderLabel(t, findClassTerm, resolveLabel, animal.species, animal.animalClass, animal.gender)}</strong></div>}
          {animal.weight && <div><span className="si-23033f05">{t('animals.cardLabels.weight')}</span> <strong>{animal.weight} kg</strong></div>}
          {animal.color && <div><span className="si-23033f05">{t('animals.cardLabels.color')}</span> <strong>{animal.color}</strong></div>}
          {animal.isNeutered && <div><span className="si-23033f05">{t('animals.cardLabels.neutered')}</span> <strong className="si-487e8582">{t('animals.cardLabels.yesCheck')}</strong></div>}
          {animal.dateOfBirth && <div><span className="si-23033f05">{t('animals.cardLabels.dob')}</span> <strong>{formatDate(animal.dateOfBirth)}</strong></div>}
          {animal.ownerName && (isVet || isAdmin) && <div><span className="si-23033f05">{t('animals.cardLabels.owner')}</span> <strong>{animal.ownerName}</strong></div>}
        </div>

        {/* Enterprise / Group (Farmer view) */}
        {(animal.enterpriseName || animal.groupName) && (
          <div className="si-83b1e87d">
            {animal.groupColor && (
              /* eslint-disable-next-line react/forbid-dom-props -- per-animal herd-group color is arbitrary, not a finite enum */
              <span className="an-group-dot" style={{ ['--dot-color' as string]: animal.groupColor }} />
            )}
            {animal.enterpriseName && <span className="si-5fd5ba20">🏢 {animal.enterpriseName}</span>}
            {animal.groupName && <span className="si-c12e23c3">· {animal.groupName}</span>}
          </div>
        )}

        {/* IDs Row */}
        {(animal.microchipId || animal.earTagId || animal.registrationNumber) && (
          <div className="si-96553843">
            <div className="si-c3f28cd6">{t('animals.cardLabels.identification')}</div>
            {animal.microchipId && <div className="si-91a28c8c">{t('animals.cardLabels.microchip')} <span className="si-2c506e3b">{animal.microchipId}</span></div>}
            {animal.earTagId && <div className="si-91a28c8c">{t('animals.cardLabels.earTag')} <span className="si-2c506e3b">{animal.earTagId}</span></div>}
            {animal.registrationNumber && <div className="si-91a28c8c">{t('animals.cardLabels.regNumber')} <span className="si-2c506e3b">{animal.registrationNumber}</span></div>}
          </div>
        )}

        {/* Insurance Row */}
        {insured && (
          <div className={`an-insurance-box ${insExpired ? 'is-expired' : ''}`}>
            <div className={`an-insurance-status ${insExpired ? 'is-expired' : ''}`}>
              {insExpired ? t('animals.cardLabels.insuranceExpired') : `🛡️ ${t('animals.cardLabels.insured')}`}
            </div>
            <div className="si-91a28c8c">{animal.insuranceProvider} - {animal.insurancePolicyNumber}</div>
            {animal.insuranceExpiry && <div className={`an-insurance-expiry-text ${insExpired ? 'is-expired' : ''}`}>{t('animals.cardLabels.expires')} {formatDate(animal.insuranceExpiry)}</div>}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="si-ab8d87a7">
        <button className="btn-small si-72b31bb1"
          onClick={() => onViewDetails(animal)}>{t('animals.cardLabels.details')}</button>
        <button className="btn-small" onClick={() => navigate('/medical-records')}>{t('animals.cardActions.records')}</button>
        {canManageAnimals && (
          <>
            <button className="btn-small si-f8147336"
              onClick={() => onEdit(animal)}>{t('animals.cardActions.edit')}</button>
            <button className="btn-small si-415f0ec0"
              onClick={() => onDelete(animal.id)}>🗑️</button>
          </>
        )}
        {isPetOwner && (
          <button className="btn-small si-a0f947bf"
            onClick={() => navigate(`/book-consultation?animalId=${animal.id}`)}>{t('animals.actions.bookConsultation')}</button>
        )}
        <button
          className="btn-small si-14989fd1"
          onClick={() => onDownloadPassport(animal)}
          disabled={passportLoading === animal.id}
        >
          {passportLoading === animal.id ? t('animals.generatingPassport') : `\u{1F6C2} ${t('animals.healthPassport')}`}
        </button>
      </div>
    </div>
  )
}

export default AnimalCard
