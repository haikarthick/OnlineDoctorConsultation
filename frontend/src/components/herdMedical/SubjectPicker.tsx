import React from 'react'
import { useTranslation } from 'react-i18next'
import AnimalSelect from './AnimalSelect'
import type { Animal, AnimalGroup } from './herdMedicalShared'
import type { TFunction } from 'i18next'

interface SubjectPickerProps {
  subjectType: string
  animalId: string
  groupId: string
  onChange: (patch: { subjectType?: string; animalId?: string; groupId?: string }) => void
  animals: Animal[]
  groups: AnimalGroup[]
  speciesLabel: (species: string, t: TFunction) => string
}

/**
 * Subject picker: this record is about ONE animal, or about a whole group.
 *
 * For a batch group the animal list is not shown at all - a 5,000-bird flock has no
 * per-bird rows to choose from, and offering them would be the dead end this feature exists
 * to remove. Groups already in batch mode are labelled with their head count so the farmer
 * can see what the record will cover.
 */
const SubjectPicker: React.FC<SubjectPickerProps> = ({ subjectType, animalId, groupId, onChange, animals, groups, speciesLabel }) => {
  const { t } = useTranslation()
  const batchGroups = groups.filter(g => g.managementMode === 'batch')
  const selectedGroup = groups.find(g => g.id === groupId)
  return (
    <div className="hm-field">
      <label className="hm-field-label">{t('herdMedical.modal.subject')} *</label>
      <div className="hm-subject-toggle">
        <button
          type="button"
          className={`hm-subject-btn ${subjectType === 'animal' ? 'hm-subject-btn--active' : ''}`}
          onClick={() => onChange({ subjectType: 'animal', groupId: '' })}
        >
          🐄 {t('herdMedical.modal.subjectAnimal')}
        </button>
        <button
          type="button"
          className={`hm-subject-btn ${subjectType === 'group' ? 'hm-subject-btn--active' : ''}`}
          onClick={() => onChange({ subjectType: 'group', animalId: '' })}
        >
          🐔 {t('herdMedical.modal.subjectGroup')}
        </button>
      </div>

      {subjectType === 'animal' ? (
        <AnimalSelect animals={animals} value={animalId} onChange={v => onChange({ animalId: v })} required speciesLabel={speciesLabel} />
      ) : (
        <>
          <select
            className="search-input si-7d984748"
            value={groupId}
            onChange={e => onChange({ groupId: e.target.value })}
            required
          >
            <option value="">{t('herdMedical.modal.selectGroup')}</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.name}{g.managementMode === 'batch' ? ` - ${g.currentCount ?? 0} ${t('herdMedical.modal.head')}` : ''}
              </option>
            ))}
          </select>
          <p className="hm-subject-hint">
            {batchGroups.length === 0
              ? t('herdMedical.modal.noBatchGroups')
              : selectedGroup && selectedGroup.managementMode === 'batch'
                ? t('herdMedical.modal.groupRecordNote', { count: (selectedGroup.currentCount ?? 0) })
                : t('herdMedical.modal.groupRecordGeneric')}
          </p>
        </>
      )}
    </div>
  )
}

export default SubjectPicker
