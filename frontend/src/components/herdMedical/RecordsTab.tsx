import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import AutocompleteInput from '../AutocompleteInput'
import GroupFilterSelect from './GroupFilterSelect'
import { RECORD_TYPE_ICONS, RECORD_TYPES, severityClass } from './herdMedicalShared'
import type { Animal, AnimalGroup } from './herdMedicalShared'

interface RecordsTabProps {
  records: any[]
  recordsTotal: number
  animals: Animal[]
  groups: AnimalGroup[]
  recordTypeFilter: string
  severityFilter: string
  groupFilter: string
  searchQuery: string
  page: number
  canCreate: boolean
  canManage: boolean
  fmtDate: (d: string) => string
  speciesLabel: (species: string, t: TFunction) => string
  onSearchChange: (v: string) => void
  onRecordTypeFilterChange: (v: string) => void
  onSeverityFilterChange: (v: string) => void
  onGroupFilterChange: (v: string) => void
  onPageChange: (updater: (p: number) => number) => void
  onAddRecord: () => void
  onViewRecord: (id: string) => void
  onDeleteRecord: (id: string) => void
}

const RecordsTab: React.FC<RecordsTabProps> = ({
  records, recordsTotal, animals, groups, recordTypeFilter, severityFilter, groupFilter, searchQuery, page,
  canCreate, canManage, fmtDate, speciesLabel, onSearchChange, onRecordTypeFilterChange, onSeverityFilterChange,
  onGroupFilterChange, onPageChange, onAddRecord, onViewRecord, onDeleteRecord,
}) => {
  const { t } = useTranslation()
  return (
    <div>
      <div className="si-0dba974a">
        <div className="si-87a4ff70">
          <AutocompleteInput
            value={searchQuery}
            onChange={onSearchChange}
            options={animals.map(a => a.name)}
            placeholder={t('herdMedical.records.searchPlaceholder')}
            className="herd-search"
          />
          <select value={recordTypeFilter} onChange={e => onRecordTypeFilterChange(e.target.value)} className="search-input si-28627afe">
            <option value="">{t('herdMedical.records.allTypes')}</option>{RECORD_TYPES.map(rt => <option key={rt.value} value={rt.value}>{t(`herdMedical.recordTypes.${rt.value}`)}</option>)}
          </select>
          <select value={severityFilter} onChange={e => onSeverityFilterChange(e.target.value)} className="search-input si-4a1efd17">
            <option value="">{t('herdMedical.records.allSeverities')}</option><option value="low">{t('herdMedical.severity.low')}</option><option value="normal">{t('herdMedical.severity.normal')}</option><option value="high">{t('herdMedical.severity.high')}</option><option value="critical">{t('herdMedical.severity.critical')}</option>
          </select>
          <GroupFilterSelect groups={groups} value={groupFilter} onChange={onGroupFilterChange} />
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={onAddRecord}>
            {t('herdMedical.records.addRecord')}
          </button>
        )}
      </div>
      {records.length === 0 ? (
        <div className="empty-state">{animals.length === 0 ? t('herdMedical.records.noAnimalsYet') : t('herdMedical.records.noRecords')}</div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>{t('common.date')}</th><th>{t('herdMedical.table.animal')}</th><th>{t('herdMedical.table.group')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.title')}</th><th>{t('herdMedical.table.severity')}</th><th>{t('common.status')}</th><th>{t('herdMedical.table.vet')}</th><th>{t('common.actions')}</th></tr></thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td><strong>{r.animalName}</strong><br /><small className="si-50edd4e9">{speciesLabel(r.animalSpecies, t)}{r.animalBreed ? ' - ' + r.animalBreed : ''}</small></td>
                    <td>{r.groupName || '-'}</td>
                    <td>{RECORD_TYPE_ICONS[r.recordType] || ''} {r.recordType?.replace(/_/g, ' ')}</td>
                    <td>{r.title}</td>
                    <td><span className={severityClass(r.severity)}>{r.severity}</span></td>
                    <td>{r.status}</td>
                    <td>{r.veterinarianName || '-'}</td>
                    <td className="si-ba472c26">
                      <button className="btn btn-secondary si-74c81f79" onClick={() => onViewRecord(r.id)}>{t('common.view')}</button>
                      {canManage && <button className="btn btn-secondary si-3941d76e" onClick={() => onDeleteRecord(r.id)}>{t('herdMedical.records.archive')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="si-80de668f">
            <span className="si-07b0717a">{t('herdMedical.records.showing', { from: page * 20 + 1, to: Math.min((page + 1) * 20, recordsTotal), total: recordsTotal })}</span>
            <div className="si-fe667bdf">
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => onPageChange(p => p - 1)}>{t('herdMedical.records.prev')}</button>
              <button className="btn btn-secondary" disabled={(page + 1) * 20 >= recordsTotal} onClick={() => onPageChange(p => p + 1)}>{t('herdMedical.records.next')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RecordsTab
