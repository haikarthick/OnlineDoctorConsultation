import { TFunction } from 'i18next'

const CERT_TYPES = ['health_certificate','fitness_to_travel','rabies_vaccination','vaccination_record','pre_travel','sterilization','treatment','animal_injury','post_mortem','breeding_soundness','pregnancy_diagnosis','infertility_evaluation','fitness_for_sale','animal_valuation']

function RatingFilter({ minRating, onChange }: { minRating: number; onChange: (r: number) => void }) {
  return (
    <div className="si-ba711cbb">
      {[0, 1, 2, 3, 4].map(r => (
        <button key={r} onClick={() => onChange(r === minRating ? 0 : r)}
          className={`fd-rating-btn ${minRating === r && r > 0 ? 'is-active' : ''}`}>
          {r}+ ★
        </button>
      ))}
    </div>
  )
}

interface SearchFiltersBarProps {
  t: TFunction
  searchTerm: string
  onSearchTermChange: (v: string) => void
  specialtyFilter: string
  onSpecialtyFilterChange: (v: string) => void
  certTypeFilter: string
  onCertTypeFilterChange: (v: string) => void
  languageFilter: string
  onLanguageFilterChange: (v: string) => void
  allSpecializations: string[]
  allLanguages: string[]
  showFilters: boolean
  onToggleFilters: () => void
  minRating: number
  onMinRatingChange: (r: number) => void
  maxFee: number | ''
  onMaxFeeChange: (v: number | '') => void
  emergencyOnly: boolean
  onEmergencyOnlyChange: (v: boolean) => void
  availableOnly: boolean
  onAvailableOnlyChange: (v: boolean) => void
  activeFilterCount: number
  onClearFilters: () => void
}

export default function SearchFiltersBar({
  t, searchTerm, onSearchTermChange, specialtyFilter, onSpecialtyFilterChange,
  certTypeFilter, onCertTypeFilterChange, languageFilter, onLanguageFilterChange,
  allSpecializations, allLanguages, showFilters, onToggleFilters,
  minRating, onMinRatingChange, maxFee, onMaxFeeChange,
  emergencyOnly, onEmergencyOnlyChange, availableOnly, onAvailableOnlyChange,
  activeFilterCount, onClearFilters,
}: SearchFiltersBarProps) {
  return (
    <div className="si-5f8ad53d">
      <div className="si-1f73e46e">
        <div className="si-05f4f186">
          <span className="si-76ae0d73">🔍</span>
          <input
            type="text"
            placeholder={t('findDoctor.searchPlaceholder')}
            value={searchTerm}
            onChange={e => onSearchTermChange(e.target.value)}
            className="si-24d1216a"
          />
        </div>

        <select value={specialtyFilter} onChange={e => onSpecialtyFilterChange(e.target.value)}
          className="si-8e949da0">
          <option value="">{t('findDoctor.allSpecializations')}</option>
          {allSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={certTypeFilter} onChange={e => onCertTypeFilterChange(e.target.value)}
          className="si-615b5f01">
          <option value="">{t('findDoctor.allCertificates')}</option>
          {CERT_TYPES.map(ct => (
            <option key={ct} value={ct}>{t(`vetCertificates.certTypes.${ct}` as any)}</option>
          ))}
        </select>

        <select value={languageFilter} onChange={e => onLanguageFilterChange(e.target.value)}
          className="si-71e77c6f">
          <option value="">{t('findDoctor.allLanguages')}</option>
          {allLanguages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <button onClick={onToggleFilters} className={`fd-filters-toggle ${showFilters ? 'is-active' : ''}`}>
          ⚙️ {t('findDoctor.filters')}
          {activeFilterCount > 0 && (
            <span className="si-21a5804d">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Advanced Filters Panel ── */}
      {showFilters && (
        <div className="si-90643671">
          <div>
            <label className="si-13e1b2f2">{t('findDoctor.minimumRating')}</label>
            <RatingFilter minRating={minRating} onChange={onMinRatingChange} />
          </div>

          <div>
            <label className="si-13e1b2f2">{t('findDoctor.maxFee')}</label>
            <input type="number" min={0} step={10} placeholder="e.g. 100"
              value={maxFee} onChange={e => onMaxFeeChange(e.target.value ? Number(e.target.value) : '')}
              className="si-adaf9bd5"
            />
          </div>

          <div className="si-977f8af1">
            <label className="si-6fa2ebba">
              <input type="checkbox" checked={emergencyOnly} onChange={e => onEmergencyOnlyChange(e.target.checked)}
                className="si-78409a5a" />
              <span>🚨 {t('findDoctor.acceptsEmergency')}</span>
            </label>
            <label className="si-6fa2ebba">
              <input type="checkbox" checked={availableOnly} onChange={e => onAvailableOnlyChange(e.target.checked)}
                className="si-65c82051" />
              <span>🟢 {t('findDoctor.availableOnly')}</span>
            </label>
          </div>

          <div className="si-85143a6f">
            {activeFilterCount > 0 && (
              <button onClick={onClearFilters}
                className="si-32f42128">
                ✕ {t('findDoctor.clearAllFilters')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
