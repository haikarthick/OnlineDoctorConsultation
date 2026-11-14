import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { severityClass } from './herdMedicalShared'
import type { Animal } from './herdMedicalShared'

interface AllergiesTabProps {
  allergies: any[]
  animals: Animal[]
  canCreate: boolean
  fmtDate: (d: string) => string
  speciesLabel: (species: string, t: TFunction) => string
  onAddAllergy: () => void
}

const AllergiesTab: React.FC<AllergiesTabProps> = ({ allergies, animals, canCreate, fmtDate, speciesLabel, onAddAllergy }) => {
  const { t } = useTranslation()
  return (
    <div>
      <div className="si-ff3206fd">
        <span className="si-50edd4e9">{t('herdMedical.allergies.countText', { count: allergies.length })}</span>
        {canCreate && (
          <button className="btn btn-primary" onClick={onAddAllergy}>
            {t('herdMedical.allergies.addButton')}
          </button>
        )}
      </div>
      {allergies.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.allergies.noRecords')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.allergen')}</th><th>{t('herdMedical.table.reaction')}</th><th>{t('herdMedical.table.severity')}</th><th>{t('herdMedical.table.active')}</th><th>{t('herdMedical.table.identified')}</th></tr></thead>
            <tbody>
              {allergies.map((a: any, i: number) => (
                <tr key={a.id || i}>
                  <td><strong>{a.animalName}</strong> ({speciesLabel(a.animalSpecies, t)})</td>
                  <td><strong>{a.allergen}</strong></td>
                  <td>{a.reaction || '-'}</td>
                  <td><span className={severityClass(a.severity || 'normal')}>{a.severity || 'normal'}</span></td>
                  <td>{a.isActive === false ? t('herdMedical.allergies.inactive') : t('herdMedical.allergies.active')}</td>
                  <td>{a.identifiedDate ? fmtDate(a.identifiedDate) : fmtDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AllergiesTab
