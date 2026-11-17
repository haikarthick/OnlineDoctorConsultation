import React from 'react'
import { TFunction } from 'i18next'

interface Props {
  t: TFunction
  isVet: boolean
  isAdmin: boolean
  isFarmer: boolean
  enterprises: { id: string; name: string }[]
  enterpriseFilter: string
  setEnterpriseFilter: (v: string) => void
  selectedAnimal: string
  setSelectedAnimal: (v: string) => void
  filteredAnimals: any[]
  speciesLabel: (species: string, t: TFunction) => string
  error: string
  setError: (v: string) => void
  selectedAnimalData: any
  fmtDate: (d: string) => string
  onNewRecord: () => void
}

const MedicalRecordsHeader: React.FC<Props> = ({
  t, isVet, isAdmin, isFarmer, enterprises, enterpriseFilter, setEnterpriseFilter,
  selectedAnimal, setSelectedAnimal, filteredAnimals, speciesLabel, error, setError,
  selectedAnimalData, fmtDate, onNewRecord,
}) => (
  <>
    <div className="module-header si-45f02350">
      <h1>{t('medicalRecords.pageTitle')}</h1>
      <div className="si-ef8e09e5">
        {/* Animal selector */}
        {enterprises.length > 0 && (isVet || isAdmin) && (
          <select
            className="module-input si-7d2a9fcb"
            value={enterpriseFilter}
            onChange={e => setEnterpriseFilter(e.target.value)}
          >
            <option value="">All Animals</option>
            <option value="__enterprise__">🏢 {t('medicalRecords.enterpriseFarmAnimals')}</option>
            {enterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select
          value={selectedAnimal}
          onChange={(e) => setSelectedAnimal(e.target.value)}
          className="si-c8f927e4"
        >
          <option value="">{t('medicalRecords.allAnimals')}</option>
          {filteredAnimals.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.uniqueId || a.unique_id || ''} {a.name} - {speciesLabel(a.species, t)}{a.breed ? ` / ${a.breed}` : ''}{(isAdmin || isVet) && a.ownerName ? ` · ${a.ownerName}` : ''}
            </option>
          ))}
        </select>
        {(isVet || isAdmin || isFarmer) && (
          <button className="btn-primary si-f1d94d5d" onClick={onNewRecord}>
            {t('medicalRecords.newRecord')}
          </button>
        )}
      </div>
    </div>

    {error && (
      <div className="si-14daa2be">
        <span>⚠️ {error}</span>
        <button onClick={() => setError('')} className="si-8949525c">✕</button>
      </div>
    )}

    {/* Selected Animal Info Bar */}
    {selectedAnimalData && (
      <div className="si-75ecbe2d">
        <div className="si-475f4b02">
          <span className="si-4dac8ea3">🐾 {selectedAnimalData.uniqueId || selectedAnimalData.unique_id || 'N/A'}</span>
          <span><strong>{selectedAnimalData.name}</strong> ({speciesLabel(selectedAnimalData.species, t)}{selectedAnimalData.breed ? ` / ${selectedAnimalData.breed}` : ''})</span>
          {selectedAnimalData.ownerName && <span>{t('medicalRecords.animalInfo.owner')} {selectedAnimalData.ownerName}</span>}
          {selectedAnimalData.gender && <span>{t('medicalRecords.animalInfo.gender')} {selectedAnimalData.gender === 'male' ? t('medicalRecords.animalInfo.maleSymbol') : t('medicalRecords.animalInfo.femaleSymbol')}</span>}
          {selectedAnimalData.weight && <span>{t('medicalRecords.animalInfo.weight')} {selectedAnimalData.weight} kg</span>}
          {selectedAnimalData.dateOfBirth && <span>{t('medicalRecords.animalInfo.dob')} {fmtDate(selectedAnimalData.dateOfBirth || selectedAnimalData.date_of_birth)}</span>}
          {selectedAnimalData.isNeutered && <span className="si-487e8582">{t('medicalRecords.animalInfo.neutered')}</span>}
        </div>
        <div className="si-dd57460c">
          {selectedAnimalData.microchipId && <span>🏷️ {t('medicalRecords.animalInfo.microchip')} <strong className="si-d70e5ad0">{selectedAnimalData.microchipId}</strong></span>}
          {selectedAnimalData.earTagId && <span>🏷️ {t('medicalRecords.animalInfo.earTag')} <strong className="si-d70e5ad0">{selectedAnimalData.earTagId}</strong></span>}
          {selectedAnimalData.registrationNumber && <span>📋 {t('medicalRecords.animalInfo.regNumber')} <strong className="si-d70e5ad0">{selectedAnimalData.registrationNumber}</strong></span>}
          {selectedAnimalData.insuranceProvider && <span>🛡️ {t('medicalRecords.animalInfo.insurance')} <strong>{selectedAnimalData.insuranceProvider}</strong>{selectedAnimalData.insurancePolicyNumber ? ` (${selectedAnimalData.insurancePolicyNumber})` : ''}</span>}
        </div>
      </div>
    )}
  </>
)

export default MedicalRecordsHeader
