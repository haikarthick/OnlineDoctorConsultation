import React from 'react'
import { TFunction } from 'i18next'
import { AnimalOption, ZOOM_LEVELS } from './animalTimelineShared'

interface SearchSuggestion {
  label: string
  icon: string
  color: string
  type: 'type' | 'title' | 'status' | 'severity'
  value: string
  count: number
}

interface TimelineHeaderProps {
  t: TFunction
  eventsCount: number
  filteredEventsCount: number
  selectedAnimal: AnimalOption | undefined
  speciesLabel: (species: string, t: TFunction) => string
  animals: AnimalOption[]
  selectedAnimalId: string
  setSelectedAnimalId: (id: string) => void
  isAdmin: boolean
  isVet: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchDropdownOpen: boolean
  setSearchDropdownOpen: (open: boolean) => void
  searchWrapRef: React.RefObject<HTMLDivElement>
  filteredSuggestions: SearchSuggestion[]
  zoomIndex: number
  setZoomIndex: React.Dispatch<React.SetStateAction<number>>
  sortAsc: boolean
  setSortAsc: React.Dispatch<React.SetStateAction<boolean>>
  filterPanelOpen: boolean
  setFilterPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  activeFilterCount: number
  loadTimeline: () => void
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  t, eventsCount, filteredEventsCount, selectedAnimal, speciesLabel, animals,
  selectedAnimalId, setSelectedAnimalId, isAdmin, isVet,
  searchQuery, setSearchQuery, searchDropdownOpen, setSearchDropdownOpen, searchWrapRef,
  filteredSuggestions, zoomIndex, setZoomIndex, sortAsc, setSortAsc,
  filterPanelOpen, setFilterPanelOpen, activeFilterCount, loadTimeline,
}) => (
  <div className="tl-header">
    <div className="tl-header-left">
      <h1>📅 {t('timeline.title', 'Animal Life Timeline')}</h1>
      <p className="tl-subtitle">
        {t('timeline.showing', 'Showing')} {filteredEventsCount !== eventsCount ? `${filteredEventsCount} of` : ''} {eventsCount} {t('timeline.events', 'events')}
        {selectedAnimal && <> - <strong>{selectedAnimal.name}</strong> ({speciesLabel(selectedAnimal.species, t)})</>}
      </p>
    </div>
    <div className="tl-toolbar">
      <select className="tl-select" value={selectedAnimalId} onChange={e => setSelectedAnimalId(e.target.value)}>
        {animals.length === 0 && <option value="">No animals</option>}
        {animals.map(a => (
          <option key={a.id} value={a.id}>
            {a.name} ({speciesLabel(a.species, t)}){(isAdmin || isVet) && a.ownerName ? ` - ${a.ownerName}` : ''}
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
                {/* eslint-disable-next-line react/forbid-dom-props -- suggestion color mixes event-type colors, severity colors, and 2 fixed colors across 4 suggestion categories, not a single finite enum */}
                <span className="tl-search-dropdown-icon" style={{ ['--s-color' as string]: s.color }}>{s.icon}</span>
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
)

export default TimelineHeader
