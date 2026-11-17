import React from 'react'
import type { TFunction } from 'i18next'
import { STATUS_COLORS } from './inpatientShared'

// ─── Dashboard stat tiles - click to filter the patient list by status ───
export const InpatientStatsPanel: React.FC<{
  dashboard: any
  statusFilter: string
  onFilterChange: (status: string) => void
  t: TFunction
}> = ({ dashboard, statusFilter, onFilterChange, t }) => {
  const tiles = [
    { label: t('inpatientManagement.totalOccupied'), value: dashboard.total_occupied, statusKey: null, icon: '🛏️' },
    { label: t('inpatientManagement.admitted'), value: dashboard.admitted, statusKey: 'admitted' },
    { label: t('inpatientManagement.inTreatment'), value: dashboard.in_treatment, statusKey: 'in_treatment' },
    { label: t('inpatientManagement.recovering'), value: dashboard.recovering, statusKey: 'recovering' },
    { label: t('inpatientManagement.readyToDischarge'), value: dashboard.ready_to_discharge, statusKey: 'ready_to_discharge' },
    { label: t('inpatientManagement.icu'), value: dashboard.icu_count, statusKey: 'icu' },
    { label: t('inpatientManagement.dischargedToday'), value: dashboard.discharged_today, statusKey: 'discharged' },
  ]

  return (
    <div className="si-60815cf3">
      {tiles.map((s, i) => {
        const sc = s.statusKey ? STATUS_COLORS[s.statusKey] : null
        const icon = sc ? sc.icon : (s.icon || '🛏️')
        const isActive = s.statusKey === null ? statusFilter === '' : statusFilter === s.statusKey
        const statusClass = s.statusKey === null ? 'status-total' : `status-${s.statusKey}`
        return (
          <div
            key={i}
            className={`inpatient-stat-tile ${statusClass} ${isActive ? 'is-active' : ''}`}
            onClick={() => onFilterChange(s.statusKey === null ? '' : (statusFilter === s.statusKey ? '' : s.statusKey))}
          >
            <div className="tile-label">{icon} {s.label}</div>
            <div className="tile-value">{s.value ?? 0}</div>
            {isActive && <div className="si-0442ac3c">🔍 Filtered</div>}
          </div>
        )
      })}
    </div>
  )
}
