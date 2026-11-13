import React from 'react'
import type { TFunction } from 'i18next'
import type { AnimalClassTerm } from '../../constants/speciesBreeds'
import { SectionTitle, classOrGenderLabel, calculateAge, type AnimalData } from './animalsShared'

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
          {detailAnimal.breedingStatus && <div><span className="si-23033f05">{t('animalClass.breedingStatus')}</span> <strong>{t(`animalClass.${detailAnimal.breedingStatus === 'not_bred' ? 'notBred' : detailAnimal.breedingStatus === 'pregnant' ? 'pregnant' : 'notPregnant'}`)}</strong></div>}
          {detailAnimal.breedingStatus === 'pregnant' && detailAnimal.expectedDueDate && <div><span className="si-23033f05">{t('animalClass.expectedDueDate')}</span> <strong>{formatDate(detailAnimal.expectedDueDate)}</strong></div>}
          {detailAnimal.dateOfBirth && <div><span className="si-23033f05">{t('animals.detailModal.age')}</span> <strong>{calculateAge(t, detailAnimal.dateOfBirth)}</strong></div>}
          {detailAnimal.weight && <div><span className="si-23033f05">{t('animals.detailModal.weight')}</span> <strong>{detailAnimal.weight} kg</strong></div>}
          {detailAnimal.color && <div><span className="si-23033f05">{t('animals.detailModal.color')}</span> <strong>{detailAnimal.color}</strong></div>}
          <div><span className="si-23033f05">{t('animals.detailModal.neutered')}</span> <strong>{detailAnimal.isNeutered ? t('animals.detailModal.yesCheck') : t('animals.detailModal.no')}</strong></div>
          {detailAnimal.ownerName && <div><span className="si-23033f05">{t('animals.detailModal.owner')}</span> <strong>{detailAnimal.ownerName}</strong></div>}
        </div>

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
