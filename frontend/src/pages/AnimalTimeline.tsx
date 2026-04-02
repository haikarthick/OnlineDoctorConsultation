import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react'
import { useNavigate as useRouterNavigate } from 'react-router-dom'
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
  ownerName?: string
}

// ─── Event type config ──────────────────────────────────────
const EVENT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string; navPath?: string }> = {
  vaccination:        { label: 'Vaccination',      icon: '💉', color: '#4caf50', bg: '#e8f5e9', navPath: '/medical-records' },
  record_diagnosis:   { label: 'Diagnosis',        icon: '🩺', color: '#2196f3', bg: '#e3f2fd', navPath: '/medical-records' },
  record_surgery:     { label: 'Surgery',          icon: '🔪', color: '#f44336', bg: '#ffebee', navPath: '/medical-records' },
  record_imaging:     { label: 'Imaging',          icon: '📷', color: '#607d8b', bg: '#eceff1', navPath: '/medical-records' },
  record_follow_up:   { label: 'Follow-up',        icon: '🔄', color: '#00bcd4', bg: '#e0f7fa', navPath: '/medical-records' },
  record_vaccination: { label: 'Vaccination Rec',  icon: '💉', color: '#4caf50', bg: '#e8f5e9', navPath: '/medical-records' },
  record_prescription:{ label: 'Prescription',     icon: '💊', color: '#9c27b0', bg: '#f3e5f5', navPath: '/prescriptions' },
  record_lab_report:  { label: 'Lab Report',       icon: '🧪', color: '#ff9800', bg: '#fff3e0', navPath: '/medical-records' },
  record_other:       { label: 'Other Record',     icon: '📄', color: '#78909c', bg: '#eceff1', navPath: '/medical-records' },
  prescription:       { label: 'Prescription',     icon: '💊', color: '#9c27b0', bg: '#f3e5f5', navPath: '/prescriptions' },
  lab_result:         { label: 'Lab Result',       icon: '🧪', color: '#ff9800', bg: '#fff3e0', navPath: '/medical-records' },
  weight:             { label: 'Weight Entry',     icon: '⚖️', color: '#009688', bg: '#e0f2f1', navPath: '/medical-records' },
  booking:            { label: 'Booking',          icon: '📅', color: '#3f51b5', bg: '#e8eaf6', navPath: '/consultations' },
  consultation:       { label: 'Consultation',     icon: '🏥', color: '#673ab7', bg: '#ede7f6', navPath: '/consultations' },
  allergy:            { label: 'Allergy',          icon: '⚠️', color: '#ff5722', bg: '#fbe9e7', navPath: '/medical-records' },
}

const FILTER_CATEGORIES = [
  { key: 'vaccination',  label: 'Vaccinations',   icon: '💉', matchTypes: ['vaccination', 'record_vaccination'] },
  { key: 'diagnosis',    label: 'Diagnosis',       icon: '🩺', matchTypes: ['record_diagnosis'] },
  { key: 'surgery',      label: 'Surgery',         icon: '🔪', matchTypes: ['record_surgery'] },
  { key: 'prescription', label: 'Prescriptions',   icon: '💊', matchTypes: ['prescription', 'record_prescription'] },
  { key: 'lab_result',   label: 'Lab Results',     icon: '🧪', matchTypes: ['lab_result', 'record_lab_report'] },
  { key: 'weight',       label: 'Weight',          icon: '⚖️', matchTypes: ['weight'] },
  { key: 'booking',      label: 'Bookings',        icon: '📅', matchTypes: ['booking'] },
  { key: 'consultation', label: 'Consultations',   icon: '🏥', matchTypes: ['consultation'] },
  { key: 'allergy',      label: 'Allergies',       icon: '⚠️', matchTypes: ['allergy'] },
  { key: 'other',        label: 'Other',           icon: '📄', matchTypes: ['record_imaging', 'record_follow_up', 'record_other'] },
]

const getEventConfig = (type: string) =>
  EVENT_TYPES[type] || { label: type, icon: '📋', color: '#78909c', bg: '#eceff1' }

const severityColor = (sev?: string) => {
  switch (sev) {
    case 'critical': return '#d32f2f'
    case 'high':     return '#f44336'
    case 'medium':   return '#ff9800'
    case 'low':      return '#4caf50'
    default:         return ''
  }
}

const ZOOM_LEVELS = [30, 60, 90, 180, 365, 730]

function assignLanes(events: TimelineEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const laneEndDate: number[] = []
  const laneMap = new Map<string, number>()
  sorted.forEach(ev => {
    const d = new Date(ev.date).getTime()
    let lane = laneEndDate.findIndex(end => d > end + 1000 * 60 * 60 * 24 * 3)
    if (lane === -1) { lane = laneEndDate.length; laneEndDate.push(0) }
    laneEndDate[lane] = d + 1000 * 60 * 60 * 24 * 14
    laneMap.set(ev.id, lane)
  })
  return laneMap
}

const AnimalTimeline: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const routerNavigate = useRouterNavigate()

  const isVet   = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'

  const [animals, setAnimals]               = useState<AnimalOption[]>([])
  const [selectedAnimalId, setSelectedAnimalId] = useState('')
  const [events, setEvents]                 = useState<TimelineEvent[]>([])
  const [loading, setLoading]               = useState(false)
  const [animalsLoading, setAnimalsLoading] = useState(true)

  const [searchQuery, setSearchQuery]       = useState('')
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const searchWrapRef                       = useRef<HTMLDivElement>(null)
  const [activeFilters, setActiveFilters]   = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [sortAsc, setSortAsc]               = useState(true)

  const [zoomIndex, setZoomIndex]           = useState(2)
  const [viewStartMs, setViewStartMs]       = useState(0)
  const railRef                             = useRef<HTMLDivElement>(null)
  const isDragging                          = useRef(false)
  const dragStartX                          = useRef(0)
  const dragStartViewMs                     = useRef(0)
  const scrubberRef                         = useRef<HTMLDivElement>(null)

  const [hoverEvent, setHoverEvent]         = useState<TimelineEvent | null>(null)
  const [hoverPos, setHoverPos]             = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const hoverTimer                          = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerEvent, setDrawerEvent]       = useState<TimelineEvent | null>(null)

  // ── Load animals ──
  useEffect(() => {
    const load = async () => {
      try {
        setAnimalsLoading(true)
        const res = await apiService.listAnimals({ limit: isVet || isAdmin ? 500 : 200 })
        const rawList = res.data?.animals || res.data?.items || (Array.isArray(res.data) ? res.data : [])
        const list: AnimalOption[] = rawList.map((a: any) => ({
          id: a.id, name: a.name, species: a.species,
          ownerName: a.ownerName || a.owner_name || undefined,
        }))
        setAnimals(list)
        if (list.length > 0) setSelectedAnimalId(list[0].id)
      } catch { setAnimals([]) }
      finally { setAnimalsLoading(false) }
    }
    load()
  }, [isVet, isAdmin])

  // ── Load events ──
  const loadTimeline = useCallback(async () => {
    if (!selectedAnimalId) return
    try {
      setLoading(true)
      const params: Record<string, string | number> = { limit: 500 }
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo)   params.dateTo   = dateTo
      const res = await apiService.getAnimalTimeline(selectedAnimalId, params as any)
      setEvents(res.data || [])
    } catch { setEvents([]) }
    finally { setLoading(false) }
  }, [selectedAnimalId, dateFrom, dateTo])

  useEffect(() => { loadTimeline() }, [loadTimeline])

  // ── Filtered events ──
  const filteredEvents = useMemo(() => {
    let ev = events
    if (activeFilters.size > 0) {
      const allowed = new Set<string>()
      activeFilters.forEach(key => {
        FILTER_CATEGORIES.find(c => c.key === key)?.matchTypes.forEach(t => allowed.add(t))
      })
      ev = ev.filter(e => allowed.has(e.type))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      ev = ev.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        getEventConfig(e.type).label.toLowerCase().includes(q) ||
        (e.status || '').toLowerCase().includes(q) ||
        (e.severity || '').toLowerCase().includes(q)
      )
    }
    return [...ev].sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortAsc ? d : -d
    })
  }, [events, activeFilters, searchQuery, sortAsc])

  // ── Date range ──
  const { minMs, maxMs } = useMemo(() => {
    if (filteredEvents.length === 0) {
      const now = Date.now()
      return { minMs: now - 86400000 * 90, maxMs: now + 86400000 * 30 }
    }
    const times = filteredEvents.map(e => new Date(e.date).getTime())
    const rawMin = Math.min(...times)
    const rawMax = Math.max(...times)
    const pad    = 86400000 * 14
    return { minMs: rawMin - pad, maxMs: rawMax + pad }
  }, [filteredEvents])

  useEffect(() => {
    const daysVisible = ZOOM_LEVELS[zoomIndex]
    const start = maxMs - daysVisible * 86400000 * 0.75
    setViewStartMs(Math.max(minMs, start))
  }, [minMs, maxMs, zoomIndex])

  const [railWidth, setRailWidth] = useState(900)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setRailWidth(entry.contentRect.width)
    })
    if (railRef.current) ro.observe(railRef.current)
    return () => ro.disconnect()
  }, [])

  const daysVisible = ZOOM_LEVELS[zoomIndex]
  const msPerPx  = (daysVisible * 86400000) / railWidth
  const msToX = useCallback((ms: number) => (ms - viewStartMs) / msPerPx, [viewStartMs, msPerPx])

  const laneMap  = useMemo(() => assignLanes(filteredEvents), [filteredEvents])
  const numLanes = useMemo(() => {
    let max = 0
    laneMap.forEach(v => { if (v > max) max = v })
    return max + 1
  }, [laneMap])

  // ── Ticks ──
  const ticks = useMemo(() => {
    const result: { label: string; x: number }[] = []
    const viewEndMs = viewStartMs + daysVisible * 86400000
    const tickIntervalDays = daysVisible <= 30 ? 3 : daysVisible <= 90 ? 7 : daysVisible <= 180 ? 14 : 30
    const dayInMs = 86400000
    const d = new Date(viewStartMs); d.setHours(0, 0, 0, 0)
    const originMs = d.getTime()
    const firstTick = originMs + ((tickIntervalDays - (Math.floor((originMs - minMs) / dayInMs) % tickIntervalDays)) % tickIntervalDays) * dayInMs
    let cur = firstTick
    while (cur <= viewEndMs) {
      const x = (cur - viewStartMs) / msPerPx
      const label = new Date(cur).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short',
        year: tickIntervalDays >= 28 ? 'numeric' : undefined,
      })
      result.push({ label, x })
      cur += tickIntervalDays * dayInMs
    }
    return result
  }, [viewStartMs, daysVisible, msPerPx, minMs])

  // ── Scrubber ──
  const fullRangeMs   = maxMs - minMs
  const thumbWidthPct = Math.min(100, Math.max(5, (daysVisible * 86400000) / fullRangeMs * 100))
  const thumbLeftPct  = Math.max(0, Math.min(100 - thumbWidthPct, ((viewStartMs - minMs) / fullRangeMs) * 100))

  const scrubDots = useMemo(() => filteredEvents.map(ev => ({
    id: ev.id,
    pct: ((new Date(ev.date).getTime() - minMs) / fullRangeMs) * 100,
    color: getEventConfig(ev.type).color,
  })), [filteredEvents, minMs, fullRangeMs])

  // ── Mouse drag rail ──
  const onRailMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('tl-node') ||
        (e.target as HTMLElement).closest('.tl-node')) return
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartViewMs.current = viewStartMs
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dms = -(e.clientX - dragStartX.current) * msPerPx
      const newStart = Math.max(minMs, Math.min(dragStartViewMs.current + dms, maxMs - daysVisible * 86400000))
      setViewStartMs(newStart)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [msPerPx, minMs, maxMs, daysVisible])

  // ── Touch pan ──
  const touchStart = useRef({ x: 0, startMs: 0 })
  const onRailTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, startMs: viewStartMs }
  }
  const onRailTouchMove = (e: React.TouchEvent) => {
    const dx  = e.touches[0].clientX - touchStart.current.x
    const newStart = Math.max(minMs, Math.min(touchStart.current.startMs - dx * msPerPx, maxMs - daysVisible * 86400000))
    setViewStartMs(newStart)
  }

  // ── Wheel zoom ──
  const onRailWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setZoomIndex(z => e.deltaY < 0 ? Math.max(0, z - 1) : Math.min(ZOOM_LEVELS.length - 1, z + 1))
  }, [])
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    el.addEventListener('wheel', onRailWheel, { passive: false })
    return () => el.removeEventListener('wheel', onRailWheel)
  }, [onRailWheel])

  // ── Hover ──
  const showHover = (ev: TimelineEvent, e: React.MouseEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    const x = e.clientX, y = e.clientY
    hoverTimer.current = setTimeout(() => { setHoverEvent(ev); setHoverPos({ x, y }) }, 200)
  }
  const hideHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoverEvent(null), 300)
  }
  const keepHover = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }

  // ── Scrubber drag ──
  const scrubDragging   = useRef(false)
  const scrubDragStartX = useRef(0)
  const scrubDragStartMs = useRef(0)
  const onScrubThumbDown = (e: React.MouseEvent) => {
    scrubDragging.current = true
    scrubDragStartX.current = e.clientX
    scrubDragStartMs.current = viewStartMs
    e.preventDefault(); e.stopPropagation()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!scrubDragging.current) return
      const trackW = scrubberRef.current?.clientWidth || 600
      const dms = (e.clientX - scrubDragStartX.current) * (fullRangeMs / trackW)
      const newStart = Math.max(minMs, Math.min(scrubDragStartMs.current + dms, maxMs - daysVisible * 86400000))
      setViewStartMs(newStart)
    }
    const onUp = () => { scrubDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [fullRangeMs, minMs, maxMs, daysVisible])

  // ── Navigation ──
  const buildRecordPath = (event: TimelineEvent) => {
    const config = getEventConfig(event.type)
    const basePath = config.navPath || '/medical-records'
    const animalId = selectedAnimalId
    // Map event types to MedicalRecords tab
    const tabMap: Record<string, string> = {
      vaccination: 'vaccinations', record_vaccination: 'vaccinations',
      lab_result: 'lab_results', record_lab_report: 'lab_results',
      allergy: 'allergies', weight: 'weight',
    }
    const tab = tabMap[event.type] || ''
    if (basePath === '/medical-records') {
      const params = new URLSearchParams()
      if (animalId) params.set('animalId', animalId)
      if (tab) params.set('tab', tab)
      params.set('recordId', event.id)
      return `${basePath}?${params.toString()}`
    }
    // For consultations/prescriptions, pass recordId as query param
    const params = new URLSearchParams()
    if (animalId) params.set('animalId', animalId)
    params.set('recordId', event.id)
    return `${basePath}?${params.toString()}`
  }

  const navigate = (path: string) => {
    routerNavigate(path)
  }

  // ── Stats ──
  const stats = useMemo(() => ({
    total:    events.length,
    types:    new Set(events.map(e => e.type)).size,
    active:   events.filter(e => e.status === 'active' || e.status === 'valid').length,
    highSev:  events.filter(e => e.severity === 'high' || e.severity === 'critical').length,
  }), [events])

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {}
    FILTER_CATEGORIES.forEach(cat => {
      c[cat.key] = events.filter(e => cat.matchTypes.includes(e.type)).length
    })
    return c
  }, [events])
  // ── Search suggestions ──
  const searchSuggestions = useMemo(() => {
    const suggestions: { label: string; icon: string; color: string; type: 'type' | 'title' | 'status' | 'severity'; value: string; count: number }[] = []
    // Event type labels
    const typeCounts: Record<string, { cfg: { label: string; icon: string; color: string }; count: number }> = {}
    events.forEach(e => {
      const cfg = getEventConfig(e.type)
      if (!typeCounts[cfg.label]) typeCounts[cfg.label] = { cfg, count: 0 }
      typeCounts[cfg.label].count++
    })
    Object.entries(typeCounts).forEach(([, v]) => {
      suggestions.push({ label: v.cfg.label, icon: v.cfg.icon, color: v.cfg.color, type: 'type', value: v.cfg.label, count: v.count })
    })
    // Unique titles
    const titleCounts: Record<string, number> = {}
    events.forEach(e => { titleCounts[e.title] = (titleCounts[e.title] || 0) + 1 })
    Object.entries(titleCounts).forEach(([title, count]) => {
      if (!suggestions.find(s => s.value === title)) {
        suggestions.push({ label: title, icon: '📝', color: '#78909c', type: 'title', value: title, count })
      }
    })
    // Unique statuses
    const statusSet = new Set(events.map(e => e.status).filter(Boolean))
    statusSet.forEach(status => {
      suggestions.push({ label: `Status: ${status}`, icon: '🏷️', color: '#607d8b', type: 'status', value: status!, count: events.filter(e => e.status === status).length })
    })
    // Unique severities
    const sevSet = new Set(events.map(e => e.severity).filter(Boolean))
    sevSet.forEach(sev => {
      suggestions.push({ label: `Severity: ${sev}`, icon: '⚡', color: severityColor(sev) || '#78909c', type: 'severity', value: sev!, count: events.filter(e => e.severity === sev).length })
    })
    return suggestions
  }, [events])

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return searchSuggestions
    const q = searchQuery.toLowerCase()
    return searchSuggestions.filter(s => s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))
  }, [searchSuggestions, searchQuery])

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const minimapSegments = useMemo(() => {
    if (!filteredEvents.length) return []
    const counts: Record<string, { count: number; color: string }> = {}
    filteredEvents.forEach(e => {
      const cfg = getEventConfig(e.type)
      if (!counts[cfg.label]) counts[cfg.label] = { count: 0, color: cfg.color }
      counts[cfg.label].count++
    })
    const total = filteredEvents.length
    return Object.entries(counts).map(([label, v]) => ({
      label, color: v.color, pct: (v.count / total) * 100,
    }))
  }, [filteredEvents])

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId)
  const formatEventDate = (d: string) => { try { return formatDate(d) } catch { return new Date(d).toLocaleDateString() } }
  const clearAll = () => { setActiveFilters(new Set()); setDateFrom(''); setDateTo(''); setSearchQuery('') }
  const activeFilterCount = activeFilters.size + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)

  const LANE_H     = 56
  const RAIL_PAD_T = 52
  const railHeight = RAIL_PAD_T + numLanes * LANE_H + 24

  if (animalsLoading) {
    return (
      <div className="tl-page">
        <div className="tl-loading"><div className="tl-spinner" /><p>{t('timeline.loadingAnimals')}</p></div>
      </div>
    )
  }

  return (
    <div className="tl-page">
      {/* Back navigation */}
      <button className="page-back-btn" onClick={() => routerNavigate(-1)}>
        ← {t('common.back')}
      </button>

      {/* Header */}
      <div className="tl-header">
        <div className="tl-header-left">
          <h1>📅 {t('timeline.title', 'Animal Life Timeline')}</h1>
          <p className="tl-subtitle">
            {t('timeline.showing', 'Showing')} {filteredEvents.length !== events.length ? `${filteredEvents.length} of` : ''} {events.length} {t('timeline.events', 'events')}
            {selectedAnimal && <> — <strong>{selectedAnimal.name}</strong> ({selectedAnimal.species})</>}
          </p>
        </div>
        <div className="tl-toolbar">
          <select className="tl-select" value={selectedAnimalId} onChange={e => setSelectedAnimalId(e.target.value)}>
            {animals.length === 0 && <option value="">No animals</option>}
            {animals.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.species}){(isAdmin || isVet) && a.ownerName ? ` — ${a.ownerName}` : ''}
              </option>
            ))}
          </select>
          <div className="tl-search-wrap" ref={searchWrapRef}>
            <span className="tl-search-icon">🔍</span>
            <input
              type="text"
              className="tl-search"
              placeholder={t('timeline.searchPlaceholder', 'Search events...')}
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchDropdownOpen(true) }}
              onFocus={() => setSearchDropdownOpen(true)}
            />
            {searchQuery && <button className="tl-search-clear" onClick={() => { setSearchQuery(''); setSearchDropdownOpen(false) }}>×</button>}
            {searchDropdownOpen && filteredSuggestions.length > 0 && (
              <div className="tl-search-dropdown">
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={`${s.type}-${s.value}-${i}`}
                    className="tl-search-dropdown-item"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setSearchQuery(s.value); setSearchDropdownOpen(false) }}
                  >
                    <span className="tl-search-dropdown-icon" style={{ color: s.color }}>{s.icon}</span>
                    <span className="tl-search-dropdown-label">{s.label}</span>
                    <span className="tl-search-dropdown-count">{s.count}</span>
                    <span className="tl-search-dropdown-type">{s.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="tl-zoom-group">
            <button className="tl-zoom-btn" onClick={() => setZoomIndex(z => Math.max(0, z - 1))} disabled={zoomIndex === 0} title={t('timeline.zoomIn')}>+</button>
            <span className="tl-zoom-label">{ZOOM_LEVELS[zoomIndex]}d</span>
            <button className="tl-zoom-btn" onClick={() => setZoomIndex(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))} disabled={zoomIndex === ZOOM_LEVELS.length - 1} title={t('timeline.zoomOut')}>−</button>
          </div>
          <button className="tl-sort-btn" onClick={() => setSortAsc(s => !s)}>{sortAsc ? `↑ ${t('timeline.oldest')}` : `↓ ${t('timeline.newest')}`}</button>
          <button className={`tl-filter-btn ${filterPanelOpen ? 'active' : ''}`} onClick={() => setFilterPanelOpen(o => !o)}>
            ▼ Filters {activeFilterCount > 0 && <span className="tl-filter-badge">{activeFilterCount}</span>}
          </button>
          <button className="tl-icon-btn" onClick={loadTimeline} title={t('timeline.refresh')}>↻</button>
        </div>
      </div>

      {/* Stats */}
      {events.length > 0 && (
        <div className="tl-stats">
          {[
            { icon: '📊', value: stats.total,   label: t('timeline.stats.totalEvents')  },
            { icon: '📋', value: stats.types,   label: t('timeline.stats.eventTypes')   },
            { icon: '✅', value: stats.active,  label: t('timeline.stats.activeItems')  },
            ...(stats.highSev > 0 ? [{ icon: '🔴', value: stats.highSev, label: t('timeline.stats.highSeverity') }] : []),
          ].map(s => (
            <div className="tl-stat" key={s.label}>
              <span className="tl-stat-icon">{s.icon}</span>
              <span className="tl-stat-val">{s.value}</span>
              <span className="tl-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main area */}
      <div className="tl-main">
        {/* Filter panel */}
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

        {/* Canvas */}
        <div className="tl-canvas-wrap">
          {loading ? (
            <div className="tl-loading"><div className="tl-spinner" /><p>{t('timeline.loadingTimeline')}</p></div>
          ) : filteredEvents.length === 0 ? (
            <div className="tl-empty">
              <div className="tl-empty-icon">📅</div>
              <h3>{searchQuery || activeFilters.size > 0 ? t('timeline.noMatching') : t('timeline.noEventsYet')}</h3>
              <p>{activeFilterCount > 0 ? t('timeline.tryClearingFilters') : selectedAnimalId ? t('timeline.noEventsFound') : t('timeline.selectAnimal')}</p>
              {activeFilterCount > 0 && <button className="tl-btn-outline" onClick={clearAll}>{t('timeline.filters.clearFilters')}</button>}
            </div>
          ) : (
            <>
              {/* Rail */}
              <div
                className="tl-rail-wrap"
                ref={railRef}
                style={{ height: railHeight, cursor: 'grab' }}
                onMouseDown={onRailMouseDown}
                onTouchStart={onRailTouchStart}
                onTouchMove={onRailTouchMove}
              >
                {ticks.map((tick, i) => (
                  <React.Fragment key={i}>
                    <div className="tl-tick-line"  style={{ left: tick.x }} />
                    <div className="tl-tick-label" style={{ left: tick.x }}>{tick.label}</div>
                  </React.Fragment>
                ))}
                {(() => {
                  const todayX = msToX(Date.now())
                  if (todayX < 0 || todayX > railWidth) return null
                  return (
                    <div className="tl-today-line" style={{ left: todayX }}>
                      <span className="tl-today-label">Today</span>
                    </div>
                  )
                })()}
                {filteredEvents.map(ev => {
                  const cfg  = getEventConfig(ev.type)
                  const x    = msToX(new Date(ev.date).getTime())
                  const lane = laneMap.get(ev.id) ?? 0
                  const top  = RAIL_PAD_T + lane * LANE_H
                  const sevCol = severityColor(ev.severity)
                  if (x < -60 || x > railWidth + 60) return null
                  return (
                    <div
                      key={ev.id}
                      className="tl-node"
                      style={{ left: x, top }}
                      onMouseEnter={e => showHover(ev, e)}
                      onMouseLeave={hideHover}
                      onClick={e => { e.stopPropagation(); setHoverEvent(null); setDrawerEvent(ev) }}
                    >
                      {sevCol && <div className="tl-node-sev-ring" style={{ borderColor: sevCol }} />}
                      <div className="tl-node-dot" style={{ background: cfg.color }}>{cfg.icon}</div>
                      <div className="tl-node-label">
                        <span className="tl-node-title">{ev.title}</span>
                        <span className="tl-node-date">{formatEventDate(ev.date)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Distribution bar */}
              <div className="tl-dist-bar-wrap">
                <span className="tl-dist-label">Showing: {new Date(viewStartMs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} – {new Date(viewStartMs + daysVisible * 86400000).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} · {daysVisible} day(s) · {filteredEvents.length} item(s)</span>
                <div className="tl-dist-bar">
                  {minimapSegments.map(seg => (
                    <div key={seg.label} className="tl-dist-seg" style={{ width: `${seg.pct}%`, background: seg.color }} title={`${seg.label} (${Math.round(seg.pct)}%)`} />
                  ))}
                </div>
                <div className="tl-dist-legend">
                  {minimapSegments.map(seg => (
                    <span key={seg.label} className="tl-dist-legend-item">
                      <span className="tl-dist-dot" style={{ background: seg.color }} />{seg.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scrubber */}
              <div className="tl-scrubber-wrap">
                <div className="tl-scrubber-track" ref={scrubberRef}>
                  <span className="tl-scrubber-min">{new Date(minMs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  <span className="tl-scrubber-max">{new Date(maxMs).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  {scrubDots.map(dot => (
                    <div key={dot.id} className="tl-scrubber-dot" style={{ left: `${Math.max(0, Math.min(100, dot.pct))}%`, background: dot.color }} />
                  ))}
                  <div
                    className="tl-scrubber-thumb"
                    style={{ left: `${thumbLeftPct}%`, width: `${thumbWidthPct}%` }}
                    onMouseDown={onScrubThumbDown}
                  />
                </div>
                <div className="tl-scrubber-years">
                  {(() => {
                    const years: { label: string; pct: number }[] = []
                    for (let y = new Date(minMs).getFullYear(); y <= new Date(maxMs).getFullYear(); y++) {
                      const ms  = new Date(y, 0, 1).getTime()
                      const pct = ((ms - minMs) / fullRangeMs) * 100
                      if (pct >= 0 && pct <= 100) years.push({ label: String(y), pct })
                    }
                    return years.map(y => (
                      <span key={y.label} className="tl-scrubber-year" style={{ left: `${y.pct}%` }}>{y.label}</span>
                    ))
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverEvent && (
        <div
          className="tl-tooltip"
          style={{ left: Math.min(hoverPos.x + 14, window.innerWidth - 270), top: Math.min(hoverPos.y - 10, window.innerHeight - 260) }}
          onMouseEnter={keepHover}
          onMouseLeave={hideHover}
        >
          <div className="tl-tt-header">
            <span className="tl-tt-icon" style={{ background: getEventConfig(hoverEvent.type).bg, color: getEventConfig(hoverEvent.type).color }}>
              {getEventConfig(hoverEvent.type).icon}
            </span>
            <div>
              <div className="tl-tt-title">{hoverEvent.title}</div>
              <div className="tl-tt-meta">{formatEventDate(hoverEvent.date)}</div>
            </div>
          </div>
          {hoverEvent.status && (
            <div className="tl-tt-row">
              <span className="tl-tt-key">{t('common.status')}</span>
              <span className="tl-tt-val" style={{ color: hoverEvent.status === 'active' || hoverEvent.status === 'valid' ? '#2e7d32' : '#757575' }}>{hoverEvent.status}</span>
            </div>
          )}
          {hoverEvent.severity && (
            <div className="tl-tt-row">
              <span className="tl-tt-key">{t('timeline.severity')}</span>
              <span className="tl-tt-val" style={{ color: severityColor(hoverEvent.severity) || undefined }}>{hoverEvent.severity}</span>
            </div>
          )}
          {hoverEvent.description && (
            <div className="tl-tt-desc">{hoverEvent.description.slice(0, 90)}{hoverEvent.description.length > 90 ? '...' : ''}</div>
          )}
          <div className="tl-tt-actions">
            <button className="tl-tt-action" onClick={() => { setDrawerEvent(hoverEvent); setHoverEvent(null) }}>📋 {t('timeline.details')}</button>
            {getEventConfig(hoverEvent.type).navPath && (
              <button className="tl-tt-action" onClick={() => { navigate(buildRecordPath(hoverEvent)); setHoverEvent(null) }}>🔗 {t('timeline.openRecord')}</button>
            )}
            {(hoverEvent.type === 'booking' || hoverEvent.type === 'consultation') && (
              <button className="tl-tt-action tl-tt-action-primary" onClick={() => { navigate('/consultations'); setHoverEvent(null) }}>🏥 {t('timeline.consultation')}</button>
            )}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {drawerEvent && (
        <div className="tl-drawer-overlay" onClick={() => setDrawerEvent(null)}>
          <div className="tl-drawer" onClick={e => e.stopPropagation()}>
            <div className="tl-drawer-header" style={{ background: getEventConfig(drawerEvent.type).bg }}>
              <span className="tl-drawer-icon" style={{ color: getEventConfig(drawerEvent.type).color }}>{getEventConfig(drawerEvent.type).icon}</span>
              <div className="tl-drawer-title-wrap">
                <h2 className="tl-drawer-title">{drawerEvent.title}</h2>
                <span className="tl-drawer-type-pill" style={{ background: getEventConfig(drawerEvent.type).color, color: '#fff' }}>{getEventConfig(drawerEvent.type).label}</span>
              </div>
              <button className="tl-drawer-close" onClick={() => setDrawerEvent(null)}>×</button>
            </div>
            <div className="tl-drawer-body">
              {[
                { k: t('common.date'),        v: formatEventDate(drawerEvent.date) },
                { k: t('common.animal'),      v: selectedAnimal ? `${selectedAnimal.name} (${selectedAnimal.species})` : undefined },
                { k: t('common.status'),      v: drawerEvent.status,       col: drawerEvent.status === 'active' || drawerEvent.status === 'valid' ? '#2e7d32' : undefined },
                { k: t('timeline.severity'),    v: drawerEvent.severity,     col: severityColor(drawerEvent.severity) || undefined },
                { k: t('timeline.recordedBy'), v: drawerEvent.createdByName },
                { k: t('common.description'), v: drawerEvent.description },
              ].filter(r => r.v).map(row => (
                <div className="tl-drawer-row" key={row.k}>
                  <span className="tl-drawer-key">{row.k}</span>
                  <span className="tl-drawer-val" style={{ color: (row as any).col }}>{row.v}</span>
                </div>
              ))}
              {drawerEvent.metadata && Object.entries(drawerEvent.metadata).filter(([, v]) => v).map(([k, v]) => (
                <div className="tl-drawer-row" key={k}>
                  <span className="tl-drawer-key">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="tl-drawer-val">{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="tl-drawer-actions">
              {getEventConfig(drawerEvent.type).navPath && (
                <button className="tl-drawer-action-primary" onClick={() => navigate(buildRecordPath(drawerEvent))}>🔗 {t('timeline.openFullRecord')}</button>
              )}
              {(drawerEvent.type === 'booking' || drawerEvent.type === 'consultation') && (
                <button className="tl-drawer-action-primary" onClick={() => navigate('/consultations')}>🏥 {t('timeline.viewConsultation')}</button>
              )}
              {(drawerEvent.type === 'prescription' || drawerEvent.type === 'record_prescription') && (
                <button className="tl-drawer-action" onClick={() => navigate('/prescriptions')}>💊 {t('timeline.viewPrescriptions')}</button>
              )}
              <div className="tl-drawer-nav">
                <button className="tl-drawer-action"
                  disabled={filteredEvents.findIndex(e => e.id === drawerEvent.id) === 0}
                  onClick={() => { const i = filteredEvents.findIndex(e => e.id === drawerEvent.id); if (i > 0) setDrawerEvent(filteredEvents[i - 1]) }}>
                  ← {t('vetHospitals.prev')}
                </button>
                <span className="tl-drawer-nav-pos">
                  {filteredEvents.findIndex(e => e.id === drawerEvent.id) + 1} / {filteredEvents.length}
                </span>
                <button className="tl-drawer-action"
                  disabled={filteredEvents.findIndex(e => e.id === drawerEvent.id) === filteredEvents.length - 1}
                  onClick={() => { const i = filteredEvents.findIndex(e => e.id === drawerEvent.id); if (i < filteredEvents.length - 1) setDrawerEvent(filteredEvents[i + 1]) }}>
                  {t('vetHospitals.next')} →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnimalTimeline
