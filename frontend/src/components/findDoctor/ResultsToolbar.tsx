import { SortOption, ViewMode, SORT_OPTIONS, formatDateLabel } from './findDoctorShared'

interface ResultsToolbarProps {
  loading: boolean
  selectedDate: string
  total: number
  sortBy: SortOption
  onSortByChange: (v: SortOption) => void
  viewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
}

export default function ResultsToolbar({ loading, selectedDate, total, sortBy, onSortByChange, viewMode, onViewModeChange }: ResultsToolbarProps) {
  return (
    <div className="si-3ed6b9ef">
      <div className="si-98d3a741">
        <span className="si-c3b93ebb">
          {loading
            ? 'Searching...'
            : selectedDate
              ? `${total} doctor${total !== 1 ? 's' : ''} with open slots on ${formatDateLabel(selectedDate)}`
              : `${total} veterinarian${total !== 1 ? 's' : ''} found`
          }
        </span>
      </div>

      <div className="si-98d3a741">
        <select value={sortBy} onChange={e => onSortByChange(e.target.value as SortOption)}
          className="si-5d9b44b7">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="si-e4a608e7">
          <button onClick={() => onViewModeChange('grid')}
            className={`fd-view-toggle-btn fd-view-toggle-grid ${viewMode === 'grid' ? 'is-active' : ''}`}>▦</button>
          <button onClick={() => onViewModeChange('list')}
            className={`fd-view-toggle-btn fd-view-toggle-list ${viewMode === 'list' ? 'is-active' : ''}`}>☰</button>
        </div>
      </div>
    </div>
  )
}
