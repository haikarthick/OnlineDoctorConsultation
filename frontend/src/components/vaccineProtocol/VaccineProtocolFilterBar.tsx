import React from 'react'
import AutocompleteInput from '../AutocompleteInput'
import { SPECIES_OPTIONS, Protocol } from './vaccineProtocolShared'

interface VaccineProtocolFilterBarProps {
  search: string
  setSearch: (v: string) => void
  protocols: Protocol[]
  filterSpecies: string
  setFilterSpecies: (v: string) => void
  filterCategory: string
  setFilterCategory: (v: string) => void
  showArchived: boolean
  setShowArchived: (v: boolean) => void
  filteredCount: number
  onAdd: () => void
  t: any
}

const VaccineProtocolFilterBar: React.FC<VaccineProtocolFilterBarProps> = ({
  search, setSearch, protocols, filterSpecies, setFilterSpecies, filterCategory, setFilterCategory,
  showArchived, setShowArchived, filteredCount, onAdd, t,
}) => (
  <div className="vpa-filter-bar">
    <div className="vpa-filter-search">
      <AutocompleteInput
        value={search}
        onChange={setSearch}
        options={protocols.map(p => p.name)}
        placeholder={t('vaccineProtocol.searchPlaceholder')}
      />
    </div>
    <div className="vpa-filter-row">
      <div className="vpa-filter-section">
        <span className="vpa-filter-label">{t('vaccineProtocol.allSpecies')}:</span>
        <div className="vpa-filter-chips">
          <button
            className={`vpa-filter-chip ${!filterSpecies ? 'active' : ''}`}
            onClick={() => setFilterSpecies('')}
          >{t('vaccineProtocol.allSpecies')}</button>
          {SPECIES_OPTIONS.map(s => (
            <button
              key={s}
              className={`vpa-filter-chip ${filterSpecies === s ? 'active' : ''}`}
              onClick={() => setFilterSpecies(filterSpecies === s ? '' : s)}
            >{s}</button>
          ))}
        </div>
      </div>
      <div className="vpa-filter-section">
        <span className="vpa-filter-label">{t('vaccineProtocol.allCategories')}:</span>
        <div className="vpa-filter-chips">
          <button className={`vpa-filter-chip cat-all ${!filterCategory ? 'active' : ''}`} onClick={() => setFilterCategory('')}>{t('vaccineProtocol.allCategories')}</button>
          <button className={`vpa-filter-chip cat-core ${filterCategory === 'core' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'core' ? '' : 'core')}>{t('vaccineProtocol.category.core')}</button>
          <button className={`vpa-filter-chip cat-noncore ${filterCategory === 'non_core' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'non_core' ? '' : 'non_core')}>{t('vaccineProtocol.category.nonCore')}</button>
          <button className={`vpa-filter-chip cat-mandatory ${filterCategory === 'mandatory_govt' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'mandatory_govt' ? '' : 'mandatory_govt')}>{t('vaccineProtocol.category.mandatoryGovt')}</button>
          <button className={`vpa-filter-chip cat-legal ${filterCategory === 'legally_mandated' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'legally_mandated' ? '' : 'legally_mandated')}>{t('vaccineProtocol.category.legallyMandated')}</button>
        </div>
      </div>
    </div>
    <div className="vpa-filter-actions">
      <label className="vpa-checkbox-label">
        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
        {t('vaccineProtocol.showArchived')}
      </label>
      <span className="vpa-results-count">{filteredCount} {t('vaccineProtocol.stats.total').toLowerCase()}</span>
      <button className="module-btn primary" onClick={onAdd}>
        + {t('vaccineProtocol.addProtocol')}
      </button>
    </div>
  </div>
)

export default VaccineProtocolFilterBar
