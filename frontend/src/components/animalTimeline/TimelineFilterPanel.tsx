import React from 'react'
import { TFunction } from 'i18next'
import { FILTER_CATEGORIES } from './animalTimelineShared'

interface TimelineFilterPanelProps {
  t: TFunction
  filterPanelOpen: boolean
  setFilterPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  categoryCounts: Record<string, number>
  activeFilters: Set<string>
  setActiveFilters: React.Dispatch<React.SetStateAction<Set<string>>>
  dateFrom: string
  setDateFrom: React.Dispatch<React.SetStateAction<string>>
  dateTo: string
  setDateTo: React.Dispatch<React.SetStateAction<string>>
  activeFilterCount: number
  clearAll: () => void
}

const TimelineFilterPanel: React.FC<TimelineFilterPanelProps> = ({
  t, filterPanelOpen, setFilterPanelOpen, categoryCounts, activeFilters, setActiveFilters,
  dateFrom, setDateFrom, dateTo, setDateTo, activeFilterCount, clearAll,
}) => (
  <div className={`tl-filter-panel ${filterPanelOpen ? 'open' : ''}`}>
    <div className="tl-fp-header">
      <span>{t('timeline.filters.title')}</span>
      <button className="tl-fp-close" onClick={() => setFilterPanelOpen(false)}>×</button>
    </div>
    <div className="tl-fp-section">
      <div className="tl-fp-label">{t('timeline.filters.typesToShow')}</div>
      {FILTER_CATEGORIES.map(cat => {
        const count   = categoryCounts[cat.key] || 0
        const isActive = activeFilters.has(cat.key)
        return (
          <label key={cat.key} className={`tl-fp-check ${isActive ? 'checked' : ''}`}>
            <input type="checkbox" checked={isActive} onChange={() => {
              setActiveFilters(prev => { const n = new Set(prev); isActive ? n.delete(cat.key) : n.add(cat.key); return n })
            }} />
            <span className="tl-fp-check-icon">{cat.icon}</span>
            <span className="tl-fp-check-label">{cat.label}</span>
            {count > 0 && <span className="tl-fp-check-count">{count}</span>}
          </label>
        )
      })}
    </div>
    <div className="tl-fp-section">
      <div className="tl-fp-label">{t('timeline.filters.dateRange')}</div>
      <label className="tl-fp-date-label">{t('timeline.filters.from')}</label>
      <input type="date" className="tl-fp-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
      <label className="tl-fp-date-label">{t('timeline.filters.to')}</label>
      <input type="date" className="tl-fp-date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      {(dateFrom || dateTo) && (
        <div className="tl-fp-date-range-badge">{dateFrom || '...'} to {dateTo || '...'}</div>
      )}
    </div>
    {activeFilterCount > 0 && <button className="tl-fp-clear" onClick={clearAll}>✕ {t('timeline.filters.clearAll')}</button>}
    <button className="tl-fp-apply" onClick={() => setFilterPanelOpen(false)}>{t('timeline.filters.apply')}</button>
  </div>
)

export default TimelineFilterPanel
