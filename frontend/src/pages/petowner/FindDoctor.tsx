import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { searchVetsByAvailability } from '../../services/api/scheduleApi'
import { useSettings } from '../../context/SettingsContext'
import { VetProfile, TimeSlot } from '../../types'
import '../../styles/modules.css'

interface FindDoctorProps {
  onNavigate: (path: string) => void
}

interface VetWithAvailability extends VetProfile {
  availableSlots?: TimeSlot[]
  totalAvailableSlots?: number
  nextAvailableTime?: string
}

type ViewMode = 'grid' | 'list'
type SortOption = 'rating' | 'fee_asc' | 'fee_desc' | 'experience' | 'consultations' | 'reviews' | 'name'
type TimeOfDay = '' | 'morning' | 'afternoon' | 'evening'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'rating', label: '⭐ Highest Rated' },
  { value: 'experience', label: '📅 Most Experienced' },
  { value: 'consultations', label: '🏥 Most Consultations' },
  { value: 'reviews', label: '💬 Most Reviewed' },
  { value: 'fee_asc', label: '💰 Fee: Low to High' },
  { value: 'fee_desc', label: '💰 Fee: High to Low' },
  { value: 'name', label: '🔤 Name A–Z' },
]

const TIME_RANGES: Record<string, { label: string; from: string; to: string; desc: string }> = {
  morning:   { label: '🌅 Morning',   from: '08:00', to: '12:00', desc: '8am–12pm' },
  afternoon: { label: '☀️ Afternoon', from: '12:00', to: '17:00', desc: '12pm–5pm' },
  evening:   { label: '🌆 Evening',   from: '17:00', to: '20:00', desc: '5pm–8pm'  },
}

function getDateChips() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { dateStr, label }
  })
}

/** Filter out past time slots for today using browser local time + 15min buffer */
function filterPastSlots(slots: TimeSlot[], forDate: string): TimeSlot[] {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (forDate !== todayStr) return slots
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + 15
  return slots.filter(s => {
    const [h, m] = (s.startTime || '00:00').split(':').map(Number)
    return h * 60 + m > nowMinutes
  })
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return ''
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === today)    return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
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

  const dateChips = getDateChips()

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

  const handleSlotBook = (vet: VetWithAvailability, slotTime: string) => {
    onNavigate(`/book-consultation?vetId=${vet.userId}&date=${selectedDate}&time=${slotTime}`)
  }

  const activeFilterCount = [
    specialtyFilter, languageFilter, emergencyOnly, availableOnly,
    minRating > 0, maxFee !== '' && (maxFee as number) > 0, certTypeFilter
  ].filter(Boolean).length

  const renderStars = (rating: number) => (
    <span className="si-317a3d7a">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#d1d5db', fontSize: 14 }}>★</span>
      ))}
    </span>
  )

  const renderRatingFilter = () => (
    <div className="si-ba711cbb">
      {[0, 1, 2, 3, 4].map(r => (
        <button key={r} onClick={() => setMinRating(r === minRating ? 0 : r)}
          style={{
            padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: minRating === r && r > 0 ? '2px solid #f59e0b' : '1px solid #d1d5db',
            background: minRating === r && r > 0 ? '#fef3c7' : 'white',
            color: minRating === r && r > 0 ? '#92400e' : '#6b7280'
          }}>
          {r}+ ★
        </button>
      ))}
    </div>
  )

  // ── Slot chips displayed on each card in availability mode ──
  const renderSlotChips = (vet: VetWithAvailability) => {
    const allSlots = vet.availableSlots || []
    if (!selectedDate || allSlots.length === 0) return null
    const slots = filterPastSlots(allSlots, selectedDate)
    if (slots.length === 0) return null
    const shown     = slots.slice(0, 8)
    const remainder = slots.length - 8

    return (
      <div className="si-2bc3baf0">
        <div className="si-f7c49cb1">
          <span className="si-d14faa43">
            ✅ {slots.length} slot{slots.length !== 1 ? 's' : ''} · {formatDateLabel(selectedDate)}
            {timeOfDay ? ` · ${TIME_RANGES[timeOfDay].desc}` : ''}
          </span>
        </div>
        <div className="si-a3a7e182">
          {shown.map(slot => (
            <button
              key={slot.startTime}
              onClick={e => { e.stopPropagation(); handleSlotBook(vet, slot.startTime) }}
              title={`Book ${formatSlotTime(slot.startTime)} — pre-fills date & time`}
              className="si-98553089"
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#16a34a'
                ;(e.currentTarget as HTMLElement).style.color = 'white'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'white'
                ;(e.currentTarget as HTMLElement).style.color = '#16a34a'
              }}
            >
              {formatSlotTime(slot.startTime)}
            </button>
          ))}
          {remainder > 0 && (
            <span className="si-e3289aa0">
              +{remainder} more
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── VET CARD ──
  const renderVetCard = (vet: VetWithAvailability) => {
    const experience = vet.yearsOfExperience || vet.experience || 0
    const isGrid     = viewMode === 'grid'
    const hasSlots   = selectedDate && (vet.totalAvailableSlots ?? 0) > 0

    return (
      <div key={vet.id} style={{
        background: 'white', borderRadius: 14, overflow: 'hidden',
        border: hasSlots ? '1px solid #d1fae5' : '1px solid #e5e7eb',
        boxShadow: hasSlots ? '0 2px 12px rgba(22,163,74,0.10)' : '0 1px 6px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        display: isGrid ? 'flex' : 'flex',
        flexDirection: 'column',
        cursor: 'pointer', position: 'relative',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = hasSlots ? '0 2px 12px rgba(22,163,74,0.10)' : '0 1px 6px rgba(0,0,0,0.04)'
          ;(e.currentTarget as HTMLElement).style.transform = 'none'
        }}
        onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}
      >
        {/* ── Badge row (top-right) ── */}
        <div className="si-5f623a02">
          {vet.isAvailable
            ? <span className="si-bc5175b0">● Available</span>
            : <span className="si-03c300cb">Unavailable</span>
          }
          {hasSlots && (
            <span className="si-be418e92">
              📅 {vet.totalAvailableSlots} open
            </span>
          )}
        </div>

        {/* ── Avatar + name ── */}
        <div className="si-5c24077d">
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: 'white',
            margin: '0 auto 10px',
            border: hasSlots ? '3px solid #d1fae5' : '3px solid #e5e7eb',
          }}>
            {vet.firstName?.charAt(0) || '🐾'}
          </div>
          <h3 className="si-4777b23e">
            Dr. {vet.firstName || ''} {vet.lastName || ''}
          </h3>
          <p className="si-21080d68">
            {(vet.specializations || []).slice(0, 2).join(' · ') || 'General Veterinarian'}
          </p>
        </div>

        {/* ── Ratings + stats ── */}
        <div className="si-b406d666">
          <div className="si-528a0cfa">
            {renderStars(Number(vet.rating) || 0)}
            <span className="si-2fed5332">{Number(vet.rating || 0).toFixed(1)}</span>
            <span className="si-3f4bbe41">({vet.totalReviews || 0})</span>
          </div>

          <div className="si-963f6cba">
            <div className="si-4b6b7fbc">
              <div className="si-91310d8f">{experience}</div>
              <div className="si-85dee051">Yrs Exp</div>
            </div>
            <div className="si-4b6b7fbc">
              <div className="si-609091ae">{vet.totalConsultations || 0}</div>
              <div className="si-85dee051">Consults</div>
            </div>
            <div className="si-4b6b7fbc">
              <div className="si-9c2e9d7b">{formatCurrency(vet.consultationFee || 0)}</div>
              <div className="si-85dee051">Per Session</div>
            </div>
          </div>

          {/* Tags */}
          <div className="si-620f955b">
            {(vet.languages || []).slice(0, 2).map(l => (
              <span key={l} className="si-d9973be4">
                🌐 {l}
              </span>
            ))}
            {vet.acceptsEmergency && (
              <span className="si-41dff0f1">
                🚨 Emergency
              </span>
            )}
            {vet.isVerified && (
              <span className="si-97e68fb4">
                ✓ Verified
              </span>
            )}
          </div>

          {vet.clinicName && (
            <div className="si-6a41eb8b">
              🏥 {vet.clinicName}
            </div>
          )}
        </div>

        {/* ── Slot chips (availability mode) ── */}
        {renderSlotChips(vet)}

        {/* ── Action buttons ── */}
        <div className="si-6e677b63"
          onClick={e => e.stopPropagation()}>
          <button className="btn btn-primary si-1e1fafbf"
           
            onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}${selectedDate ? `&date=${selectedDate}` : ''}`)}>
            📅 {t('findDoctor.bookConsultation')}
          </button>
          <button className="btn btn-outline si-1e1fafbf"
           
            onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}>
            {t('findDoctor.viewProfile')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      {/* ── Page Header ── */}
      <div className="si-7e63ec4f">
        <h1 className="si-d52452f6">🔍 {t('findDoctor.title')}</h1>
        <p className="si-48d05eba">
          {selectedDate
            ? <>Showing doctors available on <strong>{formatDateLabel(selectedDate)}</strong>{timeOfDay ? ` · ${TIME_RANGES[timeOfDay].desc}` : ''}</>
            : <>Browse {total > 0 ? `${total} ` : ''}qualified veterinarians — search by name, specialty, language, and more</>
          }
        </p>
      </div>

      {/* ── Smart Availability Panel ── */}
      <div className="si-32fdb2f0">
        {/* Panel header */}
        <div className="si-eab13361">
          <div>
            <span className="si-135ec834">📅 {t('findDoctor.findByAvailability')}</span>
            <span className="si-98e040aa">
              {selectedDate ? t('findDoctor.filteringTo', { date: formatDateLabel(selectedDate) }) : t('findDoctor.pickDate')}
            </span>
          </div>
          {selectedDate && (
            <button onClick={clearDateFilter} className="si-030751bf">✕ {t('findDoctor.clearDate')}</button>
          )}
        </div>

        {/* Date chips */}
        <div className="si-8be018fb">
          {dateChips.map(({ dateStr, label }) => {
            const active = selectedDate === dateStr
            return (
              <button key={dateStr}
                onClick={() => { setSelectedDate(dateStr); setPage(0) }}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: active ? '2px solid #0284c7' : '1px solid #bae6fd',
                  background: active ? '#0284c7' : 'white',
                  color: active ? 'white' : '#0369a1',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                {label}
              </button>
            )
          })}
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => { setSelectedDate(e.target.value); setPage(0) }}
            className="si-4efb60c9"
          />
        </div>

        {/* Time-of-day filter */}
        <div className="si-c94c5bb2">
          <span className="si-c96f2222">🕐 Time:</span>
          {([
            { key: '' as TimeOfDay,        label: 'Any time'       },
            { key: 'morning'   as TimeOfDay, label: '🌅 Morning',   sub: '8am–12pm' },
            { key: 'afternoon' as TimeOfDay, label: '☀️ Afternoon', sub: '12pm–5pm' },
            { key: 'evening'   as TimeOfDay, label: '🌆 Evening',   sub: '5pm–8pm'  },
          ] as { key: TimeOfDay; label: string; sub?: string }[]).map(({ key, label, sub }) => {
            const active = timeOfDay === key
            return (
              <button key={key || 'any'} onClick={() => setTimeOfDay(key)} style={{
                padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: active ? '2px solid #0284c7' : '1px solid #bae6fd',
                background: active ? '#0284c7' : 'white',
                color: active ? 'white' : '#0369a1',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>
                {label}{active && sub ? <span className="si-b23916fa">{sub}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="si-5f8ad53d">
        <div className="si-1f73e46e">
          <div className="si-05f4f186">
            <span className="si-76ae0d73">🔍</span>
            <input
              type="text"
              placeholder={t('findDoctor.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="si-24d1216a"
            />
          </div>

          <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
            className="si-8e949da0">
            <option value="">{t('findDoctor.allSpecializations')}</option>
            {allSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={certTypeFilter} onChange={e => { setCertTypeFilter(e.target.value); setPage(0) }}
            className="si-615b5f01">
            <option value="">{t('findDoctor.allCertificates')}</option>
            {['health_certificate','fitness_to_travel','rabies_vaccination','vaccination_record','pre_travel','sterilization','treatment','animal_injury','post_mortem','breeding_soundness','pregnancy_diagnosis','infertility_evaluation','fitness_for_sale','animal_valuation'].map(ct => (
              <option key={ct} value={ct}>{t(`vetCertificates.certTypes.${ct}` as any)}</option>
            ))}
          </select>

          <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}
            className="si-71e77c6f">
            <option value="">{t('findDoctor.allLanguages')}</option>
            {allLanguages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <button onClick={() => setShowFilters(f => !f)}
            style={{
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: showFilters ? '2px solid #4F46E5' : '1px solid #d1d5db',
              background: showFilters ? '#eef2ff' : 'white',
              color: showFilters ? '#4F46E5' : '#374151',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
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
              {renderRatingFilter()}
            </div>

            <div>
              <label className="si-13e1b2f2">{t('findDoctor.maxFee')}</label>
              <input type="number" min={0} step={10} placeholder="e.g. 100"
                value={maxFee} onChange={e => setMaxFee(e.target.value ? Number(e.target.value) : '')}
                className="si-adaf9bd5"
              />
            </div>

            <div className="si-977f8af1">
              <label className="si-6fa2ebba">
                <input type="checkbox" checked={emergencyOnly} onChange={e => setEmergencyOnly(e.target.checked)}
                  className="si-78409a5a" />
                <span>🚨 {t('findDoctor.acceptsEmergency')}</span>
              </label>
              <label className="si-6fa2ebba">
                <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)}
                  className="si-65c82051" />
                <span>🟢 {t('findDoctor.availableOnly')}</span>
              </label>
            </div>

            <div className="si-85143a6f">
              {activeFilterCount > 0 && (
                <button onClick={clearFilters}
                  className="si-32f42128">
                  ✕ {t('findDoctor.clearAllFilters')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar: Sort, View Toggle, Results Count ── */}
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
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
            className="si-5d9b44b7">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="si-e4a608e7">
            <button onClick={() => setViewMode('grid')}
              style={{
                padding: '7px 10px', border: 'none', cursor: 'pointer', fontSize: 14,
                background: viewMode === 'grid' ? '#4F46E5' : 'white',
                color: viewMode === 'grid' ? 'white' : '#6b7280'
              }}>▦</button>
            <button onClick={() => setViewMode('list')}
              style={{
                padding: '7px 10px', border: 'none', cursor: 'pointer', fontSize: 14,
                borderLeft: '1px solid #d1d5db',
                background: viewMode === 'list' ? '#4F46E5' : 'white',
                color: viewMode === 'list' ? 'white' : '#6b7280'
              }}>☰</button>
          </div>
        </div>
      </div>

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
          <div style={{
            display: viewMode === 'grid' ? 'grid' : 'flex',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : undefined,
            flexDirection: viewMode === 'list' ? 'column' : undefined,
            gap: 16
          }}>
            {vets.map(renderVetCard)}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="si-7f5fc3d9">
              <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db',
                  background: page === 0 ? '#f9fafb' : 'white', cursor: page === 0 ? 'default' : 'pointer',
                  color: page === 0 ? '#9ca3af' : '#374151', fontSize: 13, fontWeight: 600
                }}>
                ← {t('findDoctor.previous')}
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 7) {
                  pageNum = i
                } else if (page < 4) {
                  pageNum = i
                } else if (page > totalPages - 5) {
                  pageNum = totalPages - 7 + i
                } else {
                  pageNum = page - 3 + i
                }
                return (
                  <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: page === pageNum ? '2px solid #4F46E5' : '1px solid #d1d5db',
                      background: page === pageNum ? '#eef2ff' : 'white',
                      color: page === pageNum ? '#4F46E5' : '#374151',
                      cursor: 'pointer', fontWeight: 600, fontSize: 13
                    }}>
                    {pageNum + 1}
                  </button>
                )
              })}

              <button disabled={page >= totalPages - 1} onClick={() => handlePageChange(page + 1)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db',
                  background: page >= totalPages - 1 ? '#f9fafb' : 'white',
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                  color: page >= totalPages - 1 ? '#9ca3af' : '#374151', fontSize: 13, fontWeight: 600
                }}>
                {t('findDoctor.next')} →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FindDoctor
