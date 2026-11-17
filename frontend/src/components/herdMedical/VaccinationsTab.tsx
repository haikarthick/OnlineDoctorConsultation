import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import GroupFilterSelect from './GroupFilterSelect'
import { dueStatusClass } from './herdMedicalShared'
import type { Animal, AnimalGroup } from './herdMedicalShared'

interface VaccinationsTabProps {
  vaccinations: any[]
  vaccinationsTotal: number
  animals: Animal[]
  groups: AnimalGroup[]
  vaccFilter: 'all' | 'overdue' | 'upcoming'
  groupFilter: string
  canCreate: boolean
  fmtDate: (d: string) => string
  speciesLabel: (species: string, t: TFunction) => string
  onVaccFilterChange: (v: 'all' | 'overdue' | 'upcoming') => void
  onGroupFilterChange: (v: string) => void
  onAddVaccination: () => void
}

const VaccinationsTab: React.FC<VaccinationsTabProps> = ({
  vaccinations, vaccinationsTotal, animals, groups, vaccFilter, groupFilter, canCreate, fmtDate, speciesLabel,
  onVaccFilterChange, onGroupFilterChange, onAddVaccination,
}) => {
  const { t } = useTranslation()
  return (
    <div>
      <div className="si-0dba974a">
        <div className="si-dc4323dc">
          <select value={vaccFilter} onChange={e => onVaccFilterChange(e.target.value as any)} className="search-input si-172609b2">
            <option value="all">{t('herdMedical.vaccinations.all')}</option><option value="overdue">{t('herdMedical.vaccinations.overdueOnly')}</option><option value="upcoming">{t('herdMedical.vaccinations.upcoming')}</option>
          </select>
          <GroupFilterSelect groups={groups} value={groupFilter} onChange={onGroupFilterChange} />
          <span className="si-07b0717a">{t('herdMedical.vaccinations.totalCount', { count: vaccinationsTotal })}</span>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={onAddVaccination}>
            {t('herdMedical.vaccinations.addButton')}
          </button>
        )}
      </div>
      {vaccinations.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.vaccinations.noRecords')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.group')}</th><th>{t('herdMedical.table.vaccine')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.dosage')}</th><th>{t('herdMedical.table.administered')}</th><th>{t('herdMedical.table.nextDue')}</th><th>{t('common.status')}</th></tr></thead>
            <tbody>
              {vaccinations.map((v: any) => (
                <tr key={v.id}>
                  <td><strong>{v.animalName}</strong><br /><small className="si-50edd4e9">{speciesLabel(v.animalSpecies, t)}</small></td>
                  <td>{v.groupName || '-'}</td>
                  <td><strong>{v.vaccineName}</strong></td>
                  <td>{v.vaccineType || '-'}</td>
                  <td>{v.dosage || '-'}</td>
                  <td>{fmtDate(v.dateAdministered)}</td>
                  <td>{v.nextDueDate ? fmtDate(v.nextDueDate) : 'N/A'}</td>
                  <td>
                    <span className={dueStatusClass(v.dueStatus)}>
                      {v.dueStatus === 'overdue' ? t('herdMedical.vaccinations.overdue') : v.dueStatus === 'upcoming' ? t('herdMedical.vaccinations.dueSoon') : t('herdMedical.vaccinations.current')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default VaccinationsTab
