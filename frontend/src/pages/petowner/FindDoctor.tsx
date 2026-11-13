import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { searchVetsByAvailability } from '../../services/api/scheduleApi'
import { useSettings } from '../../context/SettingsContext'
import { VetProfile } from '../../types'
import '../../styles/modules.css'
import {
  VetWithAvailability, ViewMode, SortOption, TimeOfDay, TIME_RANGES,
  filterPastSlots, formatDateLabel,
} from '../../components/findDoctor/findDoctorShared'
import VetCard from '../../components/findDoctor/VetCard'
import AvailabilityPanel from '../../components/findDoctor/AvailabilityPanel'
import SearchFiltersBar from '../../components/findDoctor/SearchFiltersBar'
import ResultsToolbar from '../../components/findDoctor/ResultsToolbar'
import Pagination from '../../components/findDoctor/Pagination'

interface FindDoctorProps {
  onNavigate: (path: string) => void
}

const FindDoctor: React.FC<FindDoctorProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency, formatSlotTime } = useSettings()
  const [vets, setVets] = useState<VetWithAvailability[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 12

  // Availability date/time state
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('')

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [emergencyOnly, setEmergencyOnly] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [minRating, setMinRating] = useState(0)
  const [maxFee, setMaxFee] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState<SortOption>('rating')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [certTypeFilter, setCertTypeFilter] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 350)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Dropdown options
  const [allSpecializations, setAllSpecializations] = useState<string[]>([])
  const [allLanguages, setAllLanguages] = useState<string[]>([])

  const loadVets = useCallback(async (pageNum: number = 0) => {
    try {
      setLoading(true)
      setError('')

      if (selectedDate) {
        // ── Availability mode: search vets by date & optional time window ──
        const timeInfo = timeOfDay ? TIME_RANGES[timeOfDay] : null
        const result = await searchVetsByAvailability({
          date: selectedDate,
          timeFrom: timeInfo?.from,
          timeTo:   timeInfo?.to,
          specialization: specialtyFilter || undefined,
          language:       languageFilter  || undefined,
          acceptsEmergency: emergencyOnly || undefined,
          minRating: minRating > 0 ? minRating : undefined,
          maxFee:    maxFee !== '' && (maxFee as number) > 0 ? (maxFee as number) : undefined,
          search:    debouncedSearch || undefined,
          limit:     pageSize,
          offset:    pageNum * pageSize,
        })
        const vetList = result.data?.vets || []
        // Post-process: for each vet, filter out past slots (client-side, using browser local time).
        // This ensures the badge count and vet list are accurate even when selectedDate === today.
        const processedVets: VetWithAvailability[] = vetList
          .map((vet: VetWithAvailability) => {
            const futureSlots = filterPastSlots(vet.availableSlots || [], selectedDate)
            return { ...vet, availableSlots: futureSlots, totalAvailableSlots: futureSlots.length }
          })
          .filter((vet: VetWithAvailability) => (vet.totalAvailableSlots ?? 0) > 0)
        setVets(processedVets)
        setTotal(processedVets.length)
      } else {
        // ── Standard mode: list vets with regular filters ──
        const params: Record<string, any> = {
          limit:  pageSize,
          offset: pageNum * pageSize,
          sortBy,
        }
        if (debouncedSearch) params.search          = debouncedSearch
        if (specialtyFilter) params.specialization  = specialtyFilter
        if (languageFilter)  params.language        = languageFilter
        if (emergencyOnly)   params.acceptsEmergency = 'true'
        if (availableOnly)   params.availableOnly    = 'true'
        if (minRating > 0)   params.minRating        = minRating
        if (maxFee !== '' && maxFee > 0) params.maxFee = maxFee
        if (certTypeFilter) params.certificateType = certTypeFilter

        const result     = await apiService.listVets(params)
        const vetList    = result.data?.vets || result.data?.items || (Array.isArray(result.data) ? result.data : [])
        const totalCount = result.data?.total || vetList.length
        setVets(vetList)
        setTotal(totalCount)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || t('findDoctor.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [selectedDate, timeOfDay, debouncedSearch, specialtyFilter, languageFilter, emergencyOnly, availableOnly, minRating, maxFee, sortBy, certTypeFilter])

  // Populate filter dropdown options on mount
  useEffect(() => {
    apiService.listVets({ limit: 200 }).then(res => {
      const all = res.data?.vets || res.data?.items || []
      setAllSpecializations([...new Set(all.flatMap((v: VetProfile) => v.specializations || []))].sort() as string[])
      setAllLanguages([...new Set(all.flatMap((v: VetProfile) => v.languages || []))].sort() as string[])
    }).catch(() => setError(t('findDoctor.filterOptionsLoadFailed')))
  }, [t])

  useEffect(() => { setPage(0); loadVets(0) }, [loadVets])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadVets(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.ceil(total / pageSize)

  const clearFilters = () => {
    setSearchTerm(''); setSpecialtyFilter(''); setLanguageFilter('')
    setEmergencyOnly(false); setAvailableOnly(false)
    setMinRating(0); setMaxFee(''); setSortBy('rating')
  }

  const clearDateFilter = () => { setSelectedDate(''); setTimeOfDay('') }

  const handleSelectDate = (date: string) => { setSelectedDate(date); setPage(0) }
  const handleCertTypeFilterChange = (v: string) => { setCertTypeFilter(v); setPage(0) }

  const handleSlotBook = (vet: VetWithAvailability, slotTime: string) => {
    onNavigate(`/book-consultation?vetId=${vet.userId}&date=${selectedDate}&time=${slotTime}`)
  }

  const activeFilterCount = [
    specialtyFilter, languageFilter, emergencyOnly, availableOnly,
    minRating > 0, maxFee !== '' && (maxFee as number) > 0, certTypeFilter
  ].filter(Boolean).length

  return (
    <div className="module-page">
      {/* ── Page Header ── */}
      <div className="si-7e63ec4f">
        <h1 className="si-d52452f6">🔍 {t('findDoctor.title')}</h1>
        <p className="si-48d05eba">
          {selectedDate
            ? <>Showing doctors available on <strong>{formatDateLabel(selectedDate)}</strong>{timeOfDay ? ` · ${TIME_RANGES[timeOfDay].desc}` : ''}</>
            : <>Browse {total > 0 ? `${total} ` : ''}qualified veterinarians - search by name, specialty, language, and more</>
          }
        </p>
      </div>

      <AvailabilityPanel
        selectedDate={selectedDate}
        timeOfDay={timeOfDay}
        t={t}
        onSelectDate={handleSelectDate}
        onSelectTimeOfDay={setTimeOfDay}
        onClearDate={clearDateFilter}
      />

      <SearchFiltersBar
        t={t}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        specialtyFilter={specialtyFilter}
        onSpecialtyFilterChange={setSpecialtyFilter}
        certTypeFilter={certTypeFilter}
        onCertTypeFilterChange={handleCertTypeFilterChange}
        languageFilter={languageFilter}
        onLanguageFilterChange={setLanguageFilter}
        allSpecializations={allSpecializations}
        allLanguages={allLanguages}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        minRating={minRating}
        onMinRatingChange={setMinRating}
        maxFee={maxFee}
        onMaxFeeChange={setMaxFee}
        emergencyOnly={emergencyOnly}
        onEmergencyOnlyChange={setEmergencyOnly}
        availableOnly={availableOnly}
        onAvailableOnlyChange={setAvailableOnly}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        loading={loading}
        selectedDate={selectedDate}
        total={total}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* ── Error ── */}
      {error && (
        <div className="si-5cb041a9">
          <span>⚠️ {error}</span>
          <button className="btn btn-outline si-8e26482f" onClick={() => loadVets(page)}>Retry</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="si-9c193b4c">
          <div className="loading-spinner" />
        </div>
      )}

      {/* ── Results ── */}
      {!loading && vets.length === 0 && !error ? (
        <div className="si-9ae995d6">
          <div className="si-71a36f28">{selectedDate ? '📅' : '🔍'}</div>
          <h3 className="si-3bada533">
            {selectedDate
              ? t('findDoctor.noAvailable', { date: formatDateLabel(selectedDate), time: timeOfDay ? ` · ${TIME_RANGES[timeOfDay].desc}` : '' })
              : t('findDoctor.noMatch')
            }
          </h3>
          <p className="si-edc77e88">
            {selectedDate
              ? t('findDoctor.tryDifferentDate')
              : t('findDoctor.tryBroadening')
            }
          </p>
          <div className="si-ba6b8f5f">
            {selectedDate && (
              <button onClick={clearDateFilter} className="btn btn-primary si-38c57a68">
                {t('findDoctor.browseAll')}
              </button>
            )}
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="btn btn-outline si-38c57a68">{t('findDoctor.clearFiltersBtn')}</button>
            )}
          </div>
        </div>
      ) : !loading && (
        <>
          <div className={`fd-results ${viewMode === 'grid' ? 'grid' : 'list'}`}>
            {vets.map(vet => (
              <VetCard
                key={vet.id}
                vet={vet}
                selectedDate={selectedDate}
                timeOfDay={timeOfDay}
                formatCurrency={formatCurrency}
                formatSlotTime={formatSlotTime}
                t={t}
                onNavigate={onNavigate}
                onSlotBook={handleSlotBook}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} t={t} />
        </>
      )}
    </div>
  )
}

export default FindDoctor
