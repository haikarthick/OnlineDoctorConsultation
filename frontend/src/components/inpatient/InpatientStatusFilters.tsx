import React from 'react'
import type { TFunction } from 'i18next'
import { STATUS_COLORS } from './inpatientShared'

const FILTERS = ['', 'admitted', 'in_treatment', 'recovering', 'ready_to_discharge', 'discharged']

// ─── Quick status filter chips above the patient list ───
export const InpatientStatusFilters: React.FC<{
  statusFilter: string
  onChange: (status: string) => void
  t: TFunction
}> = ({ statusFilter, onChange, t }) => {
  return (
    <div className="si-c5224945">
      {FILTERS.map(s => {
        const sc = s ? STATUS_COLORS[s] : null
        const isActive = statusFilter === s
        const statusClass = s ? `status-${s}` : ''
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`inpatient-filter-chip ${statusClass} ${isActive ? 'is-active' : ''}`}
          >
            {s === '' ? t('inpatientManagement.active') : `${sc?.icon || ''} ${s.replace(/_/g, ' ')}`}
          </button>
        )
      })}
    </div>
  )
}
