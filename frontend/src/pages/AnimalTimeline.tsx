import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import { useTranslation } from 'react-i18next'
import './AnimalTimeline.css'

// ─── Types ──────────────────────────────────────────────────
interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string
  date: string
  severity?: string
  status?: string
  createdBy?: string
  createdByName?: string
  metadata?: Record<string, unknown>
}

interface AnimalOption {
  id: string
  name: string
  species: string
}

// ─── Event type config ──────────────────────────────────────
const EVENT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  vaccination:       { label: 'Vaccinations',   icon: '💉', color: '#4caf50', bg: '#e8f5e9' },
  record_diagnosis:  { label: 'Diagnosis',      icon: '🩺', color: '#2196f3', bg: '#e3f2fd' },
  record_surgery:    { label: 'Surgery',        icon: '🔪', color: '#f44336', bg: '#ffebee' },
  record_imaging:    { label: 'Imaging',        icon: '📷', color: '#607d8b', bg: '#eceff1' },
  record_follow_up:  { label: 'Follow-up',      icon: '🔄', color: '#00bcd4', bg: '#e0f7fa' },
  record_vaccination:{ label: 'Vaccination Rec', icon: '💉', color: '#4caf50', bg: '#e8f5e9' },
  record_prescription:{ label: 'Prescription Rec', icon: '💊', color: '#9c27b0', bg: '#f3e5f5' },
  record_lab_report: { label: 'Lab Report Rec',  icon: '🧪', color: '#ff9800', bg: '#fff3e0' },
  record_other:      { label: 'Other Record',   icon: '📄', color: '#78909c', bg: '#eceff1' },
  prescription:      { label: 'Prescriptions',  icon: '💊', color: '#9c27b0', bg: '#f3e5f5' },
  lab_result:        { label: 'Lab Results',     icon: '🧪', color: '#ff9800', bg: '#fff3e0' },
  weight:            { label: 'Weight',          icon: '⚖️', color: '#009688', bg: '#e0f2f1' },
  booking:           { label: 'Bookings',        icon: '📅', color: '#3f51b5', bg: '#e8eaf6' },
  consultation:      { label: 'Consultations',   icon: '🏥', color: '#673ab7', bg: '#ede7f6' },
  allergy:           { label: 'Allergies',       icon: '⚠️', color: '#ff5722', bg: '#fbe9e7' },
}

// Aggregate "record_*" types for chip filter grouping
const FILTER_CATEGORIES: { key: string; label: string; icon: string; matchTypes: string[] }[] = [
  { key: 'vaccination',  label: 'Vaccinations',  icon: '💉', matchTypes: ['vaccination', 'record_vaccination'] },
  { key: 'diagnosis',    label: 'Diagnosis',      icon: '🩺', matchTypes: ['record_diagnosis'] },
  { key: 'surgery',      label: 'Surgery',        icon: '🔪', matchTypes: ['record_surgery'] },
  { key: 'prescription', label: 'Prescriptions',  icon: '💊', matchTypes: ['prescription', 'record_prescription'] },
  { key: 'lab_result',   label: 'Lab Results',    icon: '🧪', matchTypes: ['lab_result', 'record_lab_report'] },
  { key: 'weight',       label: 'Weight',         icon: '⚖️', matchTypes: ['weight'] },
  { key: 'booking',      label: 'Bookings',       icon: '📅', matchTypes: ['booking'] },
  { key: 'consultation', label: 'Consultations',  icon: '🏥', matchTypes: ['consultation'] },
  { key: 'allergy',      label: 'Allergies',      icon: '⚠️', matchTypes: ['allergy'] },
  { key: 'other',        label: 'Other',          icon: '📄', matchTypes: ['record_imaging', 'record_follow_up', 'record_other'] },
]

const getEventConfig = (type: string) =>
  EVENT_TYPES[type] || { label: type, icon: '📋', color: '#78909c', bg: '#eceff1' }

const severityColor = (sev?: string) => {
  switch (sev) {
    case 'critical': return '#d32f2f'
    case 'high': return '#f44336'
    case 'medium': return '#ff9800'
    case 'low': return '#4caf50'
    default: return ''
  }
}

// ─── Component ──────────────────────────────────────────────
const AnimalTimeline: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()

  // State
  const [animals, setAnimals] = useState<AnimalOption[]>([])
  const [selectedAnimalId, setSelectedAnimalId] = useState('')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [animalsLoading, setAnimalsLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical'>('horizontal')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'

  // ── Load animals ──
  useEffect(() => {
    const loadAnimals = async () => {
      try {
        setAnimalsLoading(true)
        let list: AnimalOption[] = []
        if (isVet || isAdmin) {
          // Vets/admins see all animals via admin or medical-records context
          const res = await apiService.listAnimals({ limit: 500 })
          list = (res.data?.items || res.data || []).map((a: any) => ({
            id: a.id, name: a.name, species: a.species
          }))
        } else {
          const res = await apiService.listAnimals({ limit: 200 })
          list = (res.data?.items || res.data || []).map((a: any) => ({
            id: a.id, name: a.name, species: a.species
          }))
        }
        setAnimals(list)
        if (list.length > 0) setSelectedAnimalId(list[0].id)
      } catch {
        setAnimals([])
      } finally {
        setAnimalsLoading(false)
      }
    }
    loadAnimals()
  }, [isVet, isAdmin])

  // ── Load timeline events ──
  const loadTimeline = useCallback(async () => {
    if (!selectedAnimalId) return
    try {
      setLoading(true)
      const params: Record<string, string | number> = { limit: 500 }
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await apiService.getAnimalTimeline(selectedAnimalId, params as any)
      setEvents(res.data || [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [selectedAnimalId, dateFrom, dateTo])

  useEffect(() => { loadTimeline() }, [loadTimeline])

  // ── Filter logic ──
  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filteredEvents = useMemo(() => {
    let ev = events
    if (activeFilters.size > 0) {
      const allowedTypes = new Set<string>()
      activeFilters.forEach(key => {
        const cat = FILTER_CATEGORIES.find(c => c.key === key)
        cat?.matchTypes.forEach(t => allowedTypes.add(t))
      })
      ev = ev.filter(e => allowedTypes.has(e.type))
    }
    const sorted = [...ev].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortAsc ? diff : -diff
    })
    return sorted
  }, [events, activeFilters, sortAsc])

  // ── Group by month ──
  const groupedByMonth = useMemo(() => {
    const groups: { label: string; key: string; items: TimelineEvent[] }[] = []
    const map = new Map<string, TimelineEvent[]>()
    filteredEvents.forEach(e => {
      const d = new Date(e.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    })
    map.forEach((items, key) => {
      const [y, m] = key.split('-')
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      groups.push({ label, key, items })
    })
    return groups
  }, [filteredEvents])

  // ── Category counts ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    FILTER_CATEGORIES.forEach(cat => {
      counts[cat.key] = events.filter(e => cat.matchTypes.includes(e.type)).length
    })
    return counts
  }, [events])

  // ── Stats ──
  const stats = useMemo(() => {
    const total = events.length
    const highSeverity = events.filter(e => e.severity === 'high' || e.severity === 'critical').length
    const activeCount = events.filter(e => e.status === 'active' || e.status === 'valid').length
    const types = new Set(events.map(e => e.type)).size
    return { total, highSeverity, activeCount, types }
  }, [events])

  // ── Minimap data ──
  const minimapSegments = useMemo(() => {
    if (events.length === 0) return []
    const segments: { type: string; pct: number; color: string }[] = []
    const counts: Record<string, number> = {}
    events.forEach(e => {
      const cfg = getEventConfig(e.type)
      const k = cfg.label
      counts[k] = (counts[k] || 0) + 1
    })
    const total = events.length
    Object.entries(counts).forEach(([label, count]) => {
      const evType = Object.entries(EVENT_TYPES).find(([, v]) => v.label === label)
      segments.push({
        type: label,
        pct: (count / total) * 100,
        color: evType ? evType[1].color : '#78909c'
      })
    })
    return segments
  }, [events])

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId)

  const clearFilters = () => {
    setActiveFilters(new Set())
    setDateFrom('')
    setDateTo('')
  }

  const formatEventDate = (dateStr: string) => {
    try {
      return formatDate(dateStr)
    } catch {
      return new Date(dateStr).toLocaleDateString()
    }
  }

  // ── Render ──
  if (animalsLoading) {
    return (
      <div className="timeline-page">
        <div className="timeline-loading">
          <div className="spinner" />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="timeline-page">
      <h1>📅 {t('timeline.title', 'Animal Life Timeline')}</h1>
      <p className="timeline-subtitle">
        {t('timeline.subtitle', 'Complete chronological view of health events, treatments, and milestones')}
      </p>

      {/* ── Controls Bar ── */}
      <div className="timeline-controls">
        <div className="timeline-control-group">
          <label>{t('timeline.selectAnimal', 'Animal')}</label>
          <select
            value={selectedAnimalId}
            onChange={e => setSelectedAnimalId(e.target.value)}
          >
            {animals.length === 0 && <option value="">{t('timeline.noAnimals', 'No animals found')}</option>}
            {animals.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.species})
              </option>
            ))}
          </select>
        </div>

        <div className="timeline-control-group">
          <label>{t('timeline.from', 'From')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>

        <div className="timeline-control-group">
          <label>{t('timeline.to', 'To')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        {(activeFilters.size > 0 || dateFrom || dateTo) && (
          <button className="timeline-clear-btn" onClick={clearFilters}>
            ✕ {t('timeline.clearFilters', 'Clear Filters')}
          </button>
        )}

        <div className="timeline-view-toggle">
          <button
            className={`timeline-view-btn ${viewMode === 'horizontal' ? 'active' : ''}`}
            onClick={() => setViewMode('horizontal')}
          >↔ {t('timeline.horizontal', 'Horizontal')}</button>
          <button
            className={`timeline-view-btn ${viewMode === 'vertical' ? 'active' : ''}`}
            onClick={() => setViewMode('vertical')}
          >↕ {t('timeline.vertical', 'Vertical')}</button>
        </div>
      </div>

      {/* ── Filter Chips ── */}
      <div className="timeline-filter-chips">
        {FILTER_CATEGORIES.map(cat => {
          const count = categoryCounts[cat.key] || 0
          if (count === 0 && activeFilters.size === 0) return null
          const isActive = activeFilters.has(cat.key)
          const matchCfg = getEventConfig(cat.matchTypes[0])
          return (
            <button
              key={cat.key}
              className={`timeline-chip ${isActive ? 'active' : ''}`}
              style={isActive ? { background: matchCfg.bg, color: matchCfg.color, borderColor: matchCfg.color } : {}}
              onClick={() => toggleFilter(cat.key)}
            >
              <span className="timeline-chip-icon">{cat.icon}</span>
              {cat.label}
              {count > 0 && <span className="timeline-chip-count">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Stats ── */}
      {selectedAnimalId && !loading && events.length > 0 && (
        <div className="timeline-stats">
          <div className="timeline-stat-card">
            <div className="timeline-stat-icon" style={{ background: '#e3f2fd' }}>📊</div>
            <div className="timeline-stat-info">
              <h4>{stats.total}</h4>
              <p>{t('timeline.totalEvents', 'Total Events')}</p>
            </div>
          </div>
          <div className="timeline-stat-card">
            <div className="timeline-stat-icon" style={{ background: '#fff3e0' }}>📋</div>
            <div className="timeline-stat-info">
              <h4>{stats.types}</h4>
              <p>{t('timeline.eventTypes', 'Event Types')}</p>
            </div>
          </div>
          <div className="timeline-stat-card">
            <div className="timeline-stat-icon" style={{ background: '#e8f5e9' }}>✅</div>
            <div className="timeline-stat-info">
              <h4>{stats.activeCount}</h4>
              <p>{t('timeline.activeItems', 'Active Items')}</p>
            </div>
          </div>
          {stats.highSeverity > 0 && (
            <div className="timeline-stat-card">
              <div className="timeline-stat-icon" style={{ background: '#ffebee' }}>🔴</div>
              <div className="timeline-stat-info">
                <h4>{stats.highSeverity}</h4>
                <p>{t('timeline.highSeverity', 'High Severity')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sort & Count ── */}
      {filteredEvents.length > 0 && (
        <div className="timeline-sort-info">
          <span>{t('timeline.showing', 'Showing')} {filteredEvents.length} {t('timeline.of', 'of')} {events.length} {t('timeline.events', 'events')}</span>
          {selectedAnimal && <span>— <b>{selectedAnimal.name}</b></span>}
          <button className="timeline-sort-btn" onClick={() => setSortAsc(!sortAsc)}>
            {sortAsc ? '↑ Oldest First' : '↓ Newest First'}
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="timeline-loading">
          <div className="spinner" />
          <p>{t('timeline.loadingEvents', 'Loading timeline events...')}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">📅</div>
          <h3>{t('timeline.noEvents', 'No Timeline Events')}</h3>
          <p>
            {selectedAnimalId
              ? t('timeline.noEventsDesc', 'No events found for this animal with the current filters.')
              : t('timeline.selectAnimalFirst', 'Select an animal to view their life timeline.')}
          </p>
        </div>
      ) : (
        <>
          {/* Horizontal View */}
          {viewMode === 'horizontal' && (
            <div className="timeline-horizontal-wrap">
              <div className="timeline-horizontal">
                {groupedByMonth.map((group, gi) => (
                  <React.Fragment key={group.key}>
                    {gi > 0 && <div className="timeline-h-separator" />}
                    <div className="timeline-h-group">
                      <div className="timeline-h-month-label">{group.label}</div>
                      <div className="timeline-h-items">
                        {group.items.map(ev => {
                          const cfg = getEventConfig(ev.type)
                          const sevColor = severityColor(ev.severity)
                          return (
                            <div
                              key={ev.id}
                              className="timeline-h-node"
                              onClick={() => setSelectedEvent(ev)}
                              title={ev.title}
                            >
                              {sevColor && (
                                <div
                                  className="timeline-h-severity-badge"
                                  style={{ background: sevColor }}
                                />
                              )}
                              <div className="timeline-h-dot" style={{ background: cfg.color, color: '#fff' }}>
                                {cfg.icon}
                              </div>
                              <div className="timeline-h-label">
                                <div className="timeline-h-label-title">{ev.title}</div>
                                <div className="timeline-h-label-date">{formatEventDate(ev.date)}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Vertical View (always visible on mobile via CSS) */}
          <div
            className={viewMode === 'vertical' ? 'timeline-vertical' : 'timeline-vertical timeline-force-vertical'}
            style={viewMode === 'horizontal' ? { display: 'none' } : {}}
          >
            {groupedByMonth.map(group => (
              <React.Fragment key={group.key}>
                <div className="timeline-v-month-label">{group.label}</div>
                {group.items.map(ev => {
                  const cfg = getEventConfig(ev.type)
                  return (
                    <div
                      key={ev.id}
                      className="timeline-v-item"
                      style={{ borderLeftColor: cfg.color }}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <div className="timeline-v-dot" style={{ background: cfg.color, color: '#fff' }}>
                        {cfg.icon}
                      </div>
                      <div className="timeline-v-header">
                        <span className="timeline-v-title">{ev.title}</span>
                        <span className="timeline-v-date">{formatEventDate(ev.date)}</span>
                      </div>
                      {ev.description && <p className="timeline-v-desc">{ev.description}</p>}
                      <div className="timeline-v-meta">
                        {ev.status && (
                          <span
                            className="timeline-v-badge"
                            style={{
                              background: ev.status === 'active' || ev.status === 'valid' ? '#e8f5e9' : '#f5f5f5',
                              color: ev.status === 'active' || ev.status === 'valid' ? '#2e7d32' : '#757575',
                            }}
                          >
                            {ev.status}
                          </span>
                        )}
                        {ev.severity && (
                          <span
                            className="timeline-v-badge"
                            style={{
                              background: severityColor(ev.severity) ? `${severityColor(ev.severity)}15` : '#f5f5f5',
                              color: severityColor(ev.severity) || '#757575',
                            }}
                          >
                            {ev.severity}
                          </span>
                        )}
                        {ev.createdByName && (
                          <span className="timeline-v-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                            👤 {ev.createdByName}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>

          {/* ── Minimap ── */}
          {events.length > 0 && (
            <div className="timeline-minimap">
              <div className="timeline-minimap-label">{t('timeline.distribution', 'Event Distribution')}</div>
              <div className="timeline-minimap-bar">
                {minimapSegments.map(seg => (
                  <div
                    key={seg.type}
                    className="timeline-minimap-segment"
                    style={{ width: `${seg.pct}%`, background: seg.color }}
                    title={`${seg.type}: ${Math.round(seg.pct)}%`}
                  />
                ))}
              </div>
              <div className="timeline-minimap-legend">
                {minimapSegments.map(seg => (
                  <div key={seg.type} className="timeline-minimap-legend-item">
                    <div className="timeline-minimap-legend-dot" style={{ background: seg.color }} />
                    {seg.type} ({Math.round(seg.pct)}%)
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Detail Modal ── */}
      {selectedEvent && (
        <div className="timeline-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="timeline-modal" onClick={e => e.stopPropagation()}>
            <div className="timeline-modal-header">
              <div
                className="timeline-modal-icon"
                style={{ background: getEventConfig(selectedEvent.type).bg, color: getEventConfig(selectedEvent.type).color }}
              >
                {getEventConfig(selectedEvent.type).icon}
              </div>
              <h3>{selectedEvent.title}</h3>
              <button className="timeline-modal-close" onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <div className="timeline-modal-body">
              <div className="timeline-modal-row">
                <span className="timeline-modal-label">{t('timeline.detail.type', 'Type')}</span>
                <span className="timeline-modal-value">{getEventConfig(selectedEvent.type).label}</span>
              </div>
              <div className="timeline-modal-row">
                <span className="timeline-modal-label">{t('timeline.detail.date', 'Date')}</span>
                <span className="timeline-modal-value">{formatEventDate(selectedEvent.date)}</span>
              </div>
              {selectedEvent.description && (
                <div className="timeline-modal-row">
                  <span className="timeline-modal-label">{t('timeline.detail.description', 'Description')}</span>
                  <span className="timeline-modal-value">{selectedEvent.description}</span>
                </div>
              )}
              {selectedEvent.status && (
                <div className="timeline-modal-row">
                  <span className="timeline-modal-label">{t('timeline.detail.status', 'Status')}</span>
                  <span className="timeline-modal-value" style={{
                    color: selectedEvent.status === 'active' || selectedEvent.status === 'valid' ? '#2e7d32' : '#757575'
                  }}>
                    {selectedEvent.status}
                  </span>
                </div>
              )}
              {selectedEvent.severity && (
                <div className="timeline-modal-row">
                  <span className="timeline-modal-label">{t('timeline.detail.severity', 'Severity')}</span>
                  <span className="timeline-modal-value" style={{ color: severityColor(selectedEvent.severity) || undefined }}>
                    {selectedEvent.severity}
                  </span>
                </div>
              )}
              {selectedEvent.createdByName && (
                <div className="timeline-modal-row">
                  <span className="timeline-modal-label">{t('timeline.detail.recordedBy', 'Recorded By')}</span>
                  <span className="timeline-modal-value">👤 {selectedEvent.createdByName}</span>
                </div>
              )}
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <>
                  {Object.entries(selectedEvent.metadata).map(([key, val]) => (
                    val ? (
                      <div className="timeline-modal-row" key={key}>
                        <span className="timeline-modal-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                        <span className="timeline-modal-value">{String(val)}</span>
                      </div>
                    ) : null
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnimalTimeline
