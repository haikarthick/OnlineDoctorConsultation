import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { RECORD_TYPE_ICONS, severityClass } from './herdMedicalShared'

interface OverviewTabProps {
  stats: any
  canCreate: boolean
  fmtDate: (d: string) => string
  speciesLabel: (species: string, t: TFunction) => string
  onAddRecord: () => void
  onAddVaccination: () => void
  onAddAllergy: () => void
  onAddLab: () => void
  onFilterByType: (type: string) => void
  onViewRecord: (id: string) => void
}

const OverviewTab: React.FC<OverviewTabProps> = ({ stats, canCreate, fmtDate, speciesLabel, onAddRecord, onAddVaccination, onAddAllergy, onAddLab, onFilterByType, onViewRecord }) => {
  const { t } = useTranslation()
  if (!stats) return <div className="empty-state">{t('herdMedical.overview.noStats')}</div>
  return (
    <div>
      <div className="dashboard-grid">
        <div className="stat-card"><div className="stat-icon">&#x1F404;</div><div className="stat-value">{stats.activeAnimals || 0}</div><div className="stat-label">{t('herdMedical.overview.activeAnimals')}</div></div>
        <div className="stat-card"><div className="stat-icon">&#x1F4CB;</div><div className="stat-value">{stats.totalRecords || 0}</div><div className="stat-label">{t('herdMedical.overview.medicalRecords')}</div></div>
        <div className="stat-card"><div className="stat-icon">&#x1F489;</div><div className="stat-value">{stats.vaccinations?.total || 0}</div><div className="stat-label">{t('herdMedical.overview.vaccinations')}</div></div>
        <div className={`stat-card ${(stats.vaccinations?.overdue || 0) > 0 ? 'hm-stat-overdue' : ''}`}>
          <div className="stat-icon">&#x26A0;&#xFE0F;</div>
          <div className="stat-value">{stats.vaccinations?.overdue || 0}</div>
          <div className="stat-label">{t('herdMedical.overview.overdueVaccinations')}</div>
        </div>
        <div className="stat-card"><div className="stat-icon">&#x1F52C;</div><div className="stat-value">{stats.labResults?.pending || 0}</div><div className="stat-label">{t('herdMedical.overview.pendingLabResults')}</div></div>
        <div className="stat-card"><div className="stat-icon">&#x1F927;</div><div className="stat-value">{stats.allergies?.active || 0}</div><div className="stat-label">{t('herdMedical.overview.activeAllergies')}</div></div>
        <div className="stat-card"><div className="stat-icon">&#x1F4C5;</div><div className="stat-value">{stats.upcomingFollowUps || 0}</div><div className="stat-label">{t('herdMedical.overview.followUps')}</div></div>
        <div className="stat-card"><div className="stat-icon">&#x1F4CA;</div><div className="stat-value">{stats.vaccinations?.upcomingDue || 0}</div><div className="stat-label">{t('herdMedical.overview.vaccinationsDue')}</div></div>
      </div>

      {canCreate && (
        <div className="si-81bfb3b5">
          <h3 className="si-a70422fe">{t('herdMedical.overview.quickActions')}</h3>
          <div className="si-11b3a707">
            <button className="btn btn-primary" onClick={onAddRecord}>{t('herdMedical.overview.addRecord')}</button>
            <button className="btn btn-primary" onClick={onAddVaccination}>{t('herdMedical.overview.addVaccination')}</button>
            <button className="btn btn-primary" onClick={onAddAllergy}>{t('herdMedical.overview.addAllergy')}</button>
            <button className="btn btn-primary" onClick={onAddLab}>{t('herdMedical.overview.addLabResult')}</button>
          </div>
        </div>
      )}

      {stats.recordsByType && Object.keys(stats.recordsByType).length > 0 && (
        <div className="si-81bfb3b5">
          <h3 className="si-a70422fe">{t('herdMedical.overview.recordsByType')}</h3>
          <div className="dashboard-grid">
            {Object.entries(stats.recordsByType).map(([type, count]: any) => (
              <div key={type} className="stat-card si-3c1f81b9" onClick={() => onFilterByType(type)}>
                <div className="stat-icon">{RECORD_TYPE_ICONS[type] || '&#x1F4CB;'}</div>
                <div className="stat-value">{count}</div>
                <div className="stat-label">{type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.groupHealth && stats.groupHealth.length > 0 && (
        <div className="si-81bfb3b5">
          <h3 className="si-a70422fe">{t('herdMedical.overview.groupHealth')}</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>{t('herdMedical.table.group')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.animals')}</th><th>{t('herdMedical.table.records')}</th><th>{t('herdMedical.table.overdueVaccinations')}</th></tr></thead>
              <tbody>
                {stats.groupHealth.map((g: any) => (
                  <tr key={g.id}>
                    <td><strong>{g.name}</strong></td><td>{g.groupType || '-'}</td><td>{g.animalCount}</td><td>{g.recordCount}</td>
                    <td className={`hm-count-cell ${g.overdueVaccinations > 0 ? 'bad' : 'good'}`}>{g.overdueVaccinations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.recentRecords && stats.recentRecords.length > 0 && (
        <div className="si-81bfb3b5">
          <h3 className="si-a70422fe">{t('herdMedical.overview.recentRecords')}</h3>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>{t('common.date')}</th><th>{t('herdMedical.table.animal')}</th><th>{t('common.type')}</th><th>{t('herdMedical.table.title')}</th><th>{t('herdMedical.table.severity')}</th><th>{t('common.status')}</th><th>{t('common.actions')}</th></tr></thead>
              <tbody>
                {stats.recentRecords.map((r: any) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td>{r.animalName} ({speciesLabel(r.animalSpecies, t)})</td>
                    <td>{RECORD_TYPE_ICONS[r.recordType] || ''} {r.recordType?.replace(/_/g, ' ')}</td>
                    <td>{r.title}</td>
                    <td><span className={severityClass(r.severity)}>{r.severity}</span></td>
                    <td>{r.status}</td>
                    <td><button className="btn btn-secondary si-7579293e" onClick={() => onViewRecord(r.id)}>{t('common.view')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default OverviewTab
