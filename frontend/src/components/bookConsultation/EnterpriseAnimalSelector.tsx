import React from 'react'
import { useTranslation } from 'react-i18next'
import { Animal } from '../../types'
import { Enterprise, AnimalGroup } from './bookConsultationShared'

interface EnterpriseAnimalSelectorProps {
  enterprises: Enterprise[]
  selectedEnterprise: string
  selectedEnterpriseName: string
  onEnterpriseChange: (enterpriseId: string) => void
  groups: AnimalGroup[]
  selectedGroup: string
  selectedGroupName: string
  onGroupChange: (groupId: string) => void
  loadingEnterpriseData: boolean
  filteredEnterpriseAnimals: Animal[]
  selectedAnimal: string
  onSelectedAnimalChange: (animalId: string) => void
  selectedAnimalObj: Animal | undefined
  onNavigate: (path: string) => void
  speciesLabel: (species: string, t: any) => string
}

const EnterpriseAnimalSelector: React.FC<EnterpriseAnimalSelectorProps> = ({
  enterprises, selectedEnterprise, selectedEnterpriseName, onEnterpriseChange,
  groups, selectedGroup, selectedGroupName, onGroupChange, loadingEnterpriseData,
  filteredEnterpriseAnimals, selectedAnimal, onSelectedAnimalChange, selectedAnimalObj,
  onNavigate, speciesLabel
}) => {
  const { t } = useTranslation()
  return (
    <>
      <div className="form-group">
        <label className="form-label">🏢 {t('bookConsultation.selectFarm')}</label>
        <select
          className="form-select"
          value={selectedEnterprise}
          onChange={(e) => onEnterpriseChange(e.target.value)}
        >
          <option value="">-- {t('bookConsultation.selectFarmPlaceholder')} --</option>
          {enterprises.map(ent => (
            <option key={ent.id} value={ent.id}>
              {ent.name} - {ent.type}{ent.location ? ` (${ent.location})` : ''}
            </option>
          ))}
        </select>
        {enterprises.length === 0 && (
          <p className="si-322b324f">
            {t('bookConsultation.noEnterprises')}
          </p>
        )}
      </div>

      {selectedEnterprise && (
        <div className="form-group">
          <label className="form-label">🐄 {t('bookConsultation.selectHerd')}</label>
          {loadingEnterpriseData ? (
            <div className="si-83bdeb6c">
              <div className="loading-spinner si-22c0fd35" />
            </div>
          ) : (
            <select
              className="form-select"
              value={selectedGroup}
              onChange={(e) => onGroupChange(e.target.value)}
            >
              <option value="">-- {t('bookConsultation.allAnimalsNoFilter')} --</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} - {g.type}{g.animalCount != null ? ` (${g.animalCount} animals)` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {selectedEnterprise && !loadingEnterpriseData && (
        <div className="form-group">
          <label className="form-label">🐾 {t('bookConsultation.selectAnimal')}</label>
          <select
            className="form-select"
            value={selectedAnimal}
            onChange={(e) => onSelectedAnimalChange(e.target.value)}
          >
            <option value="">-- {t('bookConsultation.selectAnimalOptional')} --</option>
            {filteredEnterpriseAnimals.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name} - {speciesLabel(a.species, t)}{a.breed ? ` / ${a.breed}` : ''}{a.uniqueId ? ` [${a.uniqueId}]` : ''}
              </option>
            ))}
          </select>
          {filteredEnterpriseAnimals.length === 0 && (
            <div className="si-ae724942">
              <strong className="si-31823d6c">⚠️ {selectedGroup ? t('bookConsultation.noAnimalsInGroup') : t('bookConsultation.noAnimalsInEnterprise')}</strong>
              <p className="si-645dbab8">
                {t('bookConsultation.toAddAnimals')}{' '}
                <button type="button" onClick={() => onNavigate('/animals')}
                  className="si-7e869b25">
                  {t('bookConsultation.registerNewAnimal')}
                </button>
                {' '}{t('bookConsultation.andAssign')}{' '}
                <button type="button" onClick={() => onNavigate('/animal-groups')}
                  className="si-7e869b25">
                  {t('bookConsultation.herdsAndGroups')}
                </button>
                {' '}{t('bookConsultation.toAssignExisting')}
              </p>
              <p className="si-d7b1325f">
                {t('bookConsultation.canStillProceed')}
              </p>
            </div>
          )}
        </div>
      )}

      {selectedEnterprise && (
        <div className="si-08054a82">
          <strong className="si-27f26492">📋 Selection:</strong>{' '}
          <span className="si-f2153d80">
            {selectedEnterpriseName}
            {selectedGroupName ? ` → ${selectedGroupName}` : ''}
            {selectedAnimalObj ? ` → ${selectedAnimalObj.name}` : ' (general / herd-level)'}
          </span>
        </div>
      )}
    </>
  )
}

export default EnterpriseAnimalSelector
