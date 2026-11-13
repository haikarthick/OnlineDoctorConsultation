import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react'
import { useNavigate as useRouterNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useMasterData } from '../context/MasterDataContext'
import apiService from '../services/api'
import { useTranslation } from 'react-i18next'
import './AnimalTimeline.css'
import {
  TimelineEvent, AnimalOption, GroupHistoryItem,
  FILTER_CATEGORIES, getEventConfig, severityColor, ZOOM_LEVELS, assignLanes,
} from '../components/animalTimeline/animalTimelineShared'
import TimelineHeader from '../components/animalTimeline/TimelineHeader'
import TimelineStatsBar from '../components/animalTimeline/TimelineStatsBar'
import GroupHistoryPanel from '../components/animalTimeline/GroupHistoryPanel'
import TimelineFilterPanel from '../components/animalTimeline/TimelineFilterPanel'
import TimelineRail from '../components/animalTimeline/TimelineRail'
import TimelineScrubberBar from '../components/animalTimeline/TimelineScrubberBar'
import EventHoverTooltip from '../components/animalTimeline/EventHoverTooltip'
import EventDetailDrawer from '../components/animalTimeline/EventDetailDrawer'

const AnimalTimeline: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const { speciesLabel } = useMasterData()
  const routerNavigate = useRouterNavigate()

  const isVet   = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const isFarmer = user?.role === 'farmer'

  const [animals, setAnimals]               = useState<AnimalOption[]>([])
  const [selectedAnimalId, setSelectedAnimalId] = useState('')
  const [events, setEvents]                 = useState<TimelineEvent[]>([])
  const [loading, setLoading]               = useState(false)

  // Batch group history rolled up from getAnimalLifetimeHistory - the group events (treatments/
  // vaccinations) that applied to this animal while it was a member of a batch herd/flock.
  const [groupHistory, setGroupHistory]     = useState<GroupHistoryItem[]>([])
  const [groupHistoryLoading, setGroupHistoryLoading] = useState(false)
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
        const res = await apiService.listAnimals({ limit: isVet || isAdmin || isFarmer ? 500 : 200 })
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

  // Load rolled-up batch group history (group treatments/vaccinations that applied during membership)
  useEffect(() => {
    let isCancelled = false
    if (!selectedAnimalId) { setGroupHistory([]); return }
    setGroupHistoryLoading(true)
    apiService.getAnimalLifetimeHistory(selectedAnimalId).then(res => {
      if (isCancelled) return
      const items = (res.data || (Array.isArray(res) ? res : [])) as GroupHistoryItem[]
      setGroupHistory(items.filter((e: GroupHistoryItem) => e.source === 'group' && e.groupId))
    }).catch(() => { if (!isCancelled) setGroupHistory([]) }).finally(() => { if (!isCancelled) setGroupHistoryLoading(false) })
    return () => { isCancelled = true }
  }, [selectedAnimalId])

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

  if (!isAdmin && !isVet && animals.length === 0) {
    return (
      <div className="tl-page">
        <button className="page-back-btn" onClick={() => routerNavigate(-1)}>← {t('common.back')}</button>
        <div className="si-7d3f112c">
          <div className="si-71a36f28">📅</div>
          <h2 className="si-68be4326">{t('timeline.noAnimalsTitle', 'No Animals Registered')}</h2>
          <p className="si-b399e78f">
            {t('timeline.noAnimalsHint', 'Register your pets or animals to view their life timeline.')}
          </p>
          <button className="module-btn primary si-e01a9e73" onClick={() => routerNavigate('/animals')}>
            + {t('timeline.addAnimal', 'Register Animal')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tl-page">
      {/* Back navigation */}
      <button className="page-back-btn" onClick={() => routerNavigate(-1)}>
        ← {t('common.back')}
      </button>

      <TimelineHeader
        t={t}
        eventsCount={events.length}
        filteredEventsCount={filteredEvents.length}
        selectedAnimal={selectedAnimal}
        speciesLabel={speciesLabel}
        animals={animals}
        selectedAnimalId={selectedAnimalId}
        setSelectedAnimalId={setSelectedAnimalId}
        isAdmin={isAdmin}
        isVet={isVet}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchDropdownOpen={searchDropdownOpen}
        setSearchDropdownOpen={setSearchDropdownOpen}
        searchWrapRef={searchWrapRef}
        filteredSuggestions={filteredSuggestions}
        zoomIndex={zoomIndex}
        setZoomIndex={setZoomIndex}
        sortAsc={sortAsc}
        setSortAsc={setSortAsc}
        filterPanelOpen={filterPanelOpen}
        setFilterPanelOpen={setFilterPanelOpen}
        activeFilterCount={activeFilterCount}
        loadTimeline={loadTimeline}
      />

      <TimelineStatsBar t={t} eventsCount={events.length} stats={stats} />

      <GroupHistoryPanel
        t={t}
        selectedAnimalId={selectedAnimalId}
        groupHistoryLoading={groupHistoryLoading}
        groupHistory={groupHistory}
        formatEventDate={formatEventDate}
      />

      {/* Main area */}
      <div className="tl-main">
        <TimelineFilterPanel
          t={t}
          filterPanelOpen={filterPanelOpen}
          setFilterPanelOpen={setFilterPanelOpen}
          categoryCounts={categoryCounts}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          activeFilterCount={activeFilterCount}
          clearAll={clearAll}
        />

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
              <TimelineRail
                railRef={railRef}
                railHeight={railHeight}
                railWidth={railWidth}
                onRailMouseDown={onRailMouseDown}
                onRailTouchStart={onRailTouchStart}
                onRailTouchMove={onRailTouchMove}
                ticks={ticks}
                msToX={msToX}
                filteredEvents={filteredEvents}
                laneMap={laneMap}
                railPadTop={RAIL_PAD_T}
                laneHeight={LANE_H}
                formatEventDate={formatEventDate}
                showHover={showHover}
                hideHover={hideHover}
                setHoverEvent={setHoverEvent}
                setDrawerEvent={setDrawerEvent}
              />

              <TimelineScrubberBar
                viewStartMs={viewStartMs}
                daysVisible={daysVisible}
                filteredEventsCount={filteredEvents.length}
                minimapSegments={minimapSegments}
                scrubberRef={scrubberRef}
                minMs={minMs}
                maxMs={maxMs}
                fullRangeMs={fullRangeMs}
                scrubDots={scrubDots}
                thumbLeftPct={thumbLeftPct}
                thumbWidthPct={thumbWidthPct}
                onScrubThumbDown={onScrubThumbDown}
              />
            </>
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverEvent && (
        <EventHoverTooltip
          t={t}
          hoverEvent={hoverEvent}
          hoverPos={hoverPos}
          formatEventDate={formatEventDate}
          keepHover={keepHover}
          hideHover={hideHover}
          onShowDetails={() => { setDrawerEvent(hoverEvent); setHoverEvent(null) }}
          onOpenRecord={() => { navigate(buildRecordPath(hoverEvent)); setHoverEvent(null) }}
          onGoToConsultation={() => { navigate('/consultations'); setHoverEvent(null) }}
        />
      )}

      {/* Detail drawer */}
      {drawerEvent && (
        <EventDetailDrawer
          t={t}
          drawerEvent={drawerEvent}
          selectedAnimal={selectedAnimal}
          speciesLabel={speciesLabel}
          formatEventDate={formatEventDate}
          filteredEvents={filteredEvents}
          onClose={() => setDrawerEvent(null)}
          setDrawerEvent={setDrawerEvent}
          onOpenFullRecord={(ev) => navigate(buildRecordPath(ev))}
          onGoToConsultation={() => navigate('/consultations')}
          onViewPrescriptions={(ev) => navigate(`/medical-records?animalId=${selectedAnimalId}&tab=prescriptions&recordId=${ev.id}`)}
        />
      )}
    </div>
  )
}

export default AnimalTimeline
