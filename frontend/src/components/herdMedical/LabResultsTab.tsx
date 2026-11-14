import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { labStatusClass } from './herdMedicalShared'
import type { Animal } from './herdMedicalShared'

interface LabResultsTabProps {
  labResults: any[]
  animals: Animal[]
  canCreate: boolean
  canManage: boolean
  fmtDate: (d: string) => string
  speciesLabel: (species: string, t: TFunction) => string
  onAddLab: () => void
  onUpdateLabStatus: (id: string, status: string) => void
}

const LabResultsTab: React.FC<LabResultsTabProps> = ({ labResults, animals, canCreate, canManage, fmtDate, speciesLabel, onAddLab, onUpdateLabStatus }) => {
  const { t } = useTranslation()
  return (
    <div>
      <div className="si-ff3206fd">
        <span className="si-50edd4e9">{t('herdMedical.labResults.countText', { count: labResults.length })}</span>
        {canCreate && (
          <button className="btn btn-primary" onClick={onAddLab}>
            {t('herdMedical.labResults.addButton')}
          </button>
        )}
      </div>
      {labResults.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.labResults.noRecords')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>{t('common.date')}</th><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.test')}</th><th>{t('herdMedical.table.category')}</th><th>{t('herdMedical.table.result')}</th><th>{t('herdMedical.table.normalRange')}</th><th>{t('common.status')}</th>{canManage && <th>{t('common.actions')}</th>}</tr></thead>
            <tbody>
              {labResults.map((l: any, i: number) => (
                <tr key={l.id || i}>
                  <td>{fmtDate(l.testDate || l.createdAt)}</td>
                  <td><strong>{l.animalName}</strong> ({speciesLabel(l.animalSpecies, t)})</td>
                  <td><strong>{l.testName}</strong></td>
                  <td>{l.testCategory || '-'}</td>
                  <td className={l.isAbnormal ? 'hm-lab-result is-abnormal' : 'hm-lab-result'}>{l.resultValue || t('common.pending')} {l.unit || ''}</td>
                  <td>{l.normalRange || '-'}</td>
                  <td>
                    <span className={labStatusClass(l.status)}>{l.status || 'pending'}</span>
                  </td>
                  {canManage && (
                    <td className="si-ba472c26">
                      {l.status === 'pending' && <button className="btn btn-secondary si-7579293e" onClick={() => onUpdateLabStatus(l.id, 'completed')}>{t('herdMedical.labResults.complete')}</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default LabResultsTab
