import React, { useState, useEffect, useCallback } from 'react'
import apiService from '../../services/api'
import { VetProfile } from '../../types'
import '../../styles/modules.css'

interface FindDoctorProps {
  onNavigate: (path: string) => void
}

type ViewMode = 'grid' | 'list'
type SortOption = 'rating' | 'fee_asc' | 'fee_desc' | 'experience' | 'consultations' | 'reviews' | 'name'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'rating', label: '⭐ Highest Rated' },
  { value: 'experience', label: '📅 Most Experienced' },
  { value: 'consultations', label: '🏥 Most Consultations' },
  { value: 'reviews', label: '💬 Most Reviewed' },
  { value: 'fee_asc', label: '💰 Fee: Low to High' },
  { value: 'fee_desc', label: '💰 Fee: High to Low' },
  { value: 'name', label: '🔤 Name A–Z' },
]

const FindDoctor: React.FC<FindDoctorProps> = ({ onNavigate }) => {
  const [vets, setVets] = useState<VetProfile[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 12

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
      const params: Record<string, any> = {
        limit: pageSize,
        offset: pageNum * pageSize,
        sortBy,
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (specialtyFilter) params.specialization = specialtyFilter
      if (languageFilter) params.language = languageFilter
      if (emergencyOnly) params.acceptsEmergency = 'true'
      if (availableOnly) params.availableOnly = 'true'
      if (minRating > 0) params.minRating = minRating
      if (maxFee !== '' && maxFee > 0) params.maxFee = maxFee

      const result = await apiService.listVets(params)
      const vetList = result.data?.vets || result.data?.items || (Array.isArray(result.data) ? result.data : [])
      const totalCount = result.data?.total || vetList.length
      setVets(vetList)
      setTotal(totalCount)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load veterinarians')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, specialtyFilter, languageFilter, emergencyOnly, availableOnly, minRating, maxFee, sortBy])

  // Populate filter dropdown options on mount
  useEffect(() => {
    apiService.listVets({ limit: 200 }).then(res => {
      const all = res.data?.vets || res.data?.items || []
      setAllSpecializations([...new Set(all.flatMap((v: VetProfile) => v.specializations || []))].sort() as string[])
      setAllLanguages([...new Set(all.flatMap((v: VetProfile) => v.languages || []))].sort() as string[])
    }).catch(() => {})
  }, [])

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

  const activeFilterCount = [
    specialtyFilter, languageFilter, emergencyOnly, availableOnly,
    minRating > 0, maxFee !== '' && (maxFee as number) > 0
  ].filter(Boolean).length

  const renderStars = (rating: number) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#d1d5db', fontSize: 14 }}>★</span>
      ))}
    </span>
  )

  const renderRatingFilter = () => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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

  // ── VET CARD ──
  const renderVetCard = (vet: VetProfile) => {
    const experience = vet.yearsOfExperience || vet.experience || 0
    const isGrid = viewMode === 'grid'

    return (
      <div key={vet.id} style={{
        background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s, transform 0.2s',
        display: isGrid ? 'block' : 'flex', gap: isGrid ? 0 : 24, alignItems: isGrid ? undefined : 'center',
        cursor: 'pointer', position: 'relative'
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 6px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
        onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}
      >
        {/* Availability badge */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
          {vet.isAvailable ? (
            <span style={{ background: '#059669', color: 'white', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>● Available</span>
          ) : (
            <span style={{ background: '#6b7280', color: 'white', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Unavailable</span>
          )}
        </div>

        {/* Avatar section */}
        <div style={{
          padding: isGrid ? '24px 20px 16px' : '20px 0 20px 24px',
          textAlign: isGrid ? 'center' : 'left',
          display: isGrid ? 'block' : 'flex', alignItems: 'center', gap: 16, flexShrink: 0
        }}>
          <div style={{
            width: isGrid ? 72 : 64, height: isGrid ? 72 : 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isGrid ? 28 : 24, fontWeight: 700, color: 'white',
            margin: isGrid ? '0 auto 12px' : '0', flexShrink: 0,
            border: '3px solid #e5e7eb'
          }}>
            {vet.firstName?.charAt(0) || '🐾'}
          </div>

          {isGrid && (
            <>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#1f2937' }}>
                Dr. {vet.firstName || ''} {vet.lastName || ''}
              </h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 13, lineHeight: 1.4 }}>
                {(vet.specializations || []).slice(0, 3).join(', ') || 'General Veterinarian'}
              </p>
            </>
          )}
        </div>

        {/* Info section */}
        <div style={{
          padding: isGrid ? '0 20px 16px' : '16px 20px 16px 0',
          flex: isGrid ? undefined : 1, minWidth: 0
        }}>
          {!isGrid && (
            <>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#1f2937' }}>
                Dr. {vet.firstName || ''} {vet.lastName || ''}
              </h3>
              <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: 13, lineHeight: 1.4 }}>
                {(vet.specializations || []).join(', ') || 'General Veterinarian'}
              </p>
            </>
          )}

          {/* Rating + Reviews */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, justifyContent: isGrid ? 'center' : 'flex-start' }}>
            {renderStars(vet.rating || 0)}
            <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{(vet.rating || 0).toFixed(1)}</span>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>({vet.totalReviews || 0})</span>
          </div>

          {/* Stats Row */}
          <div style={{
            display: 'flex', gap: isGrid ? 16 : 24, justifyContent: isGrid ? 'center' : 'flex-start',
            marginBottom: 10, fontSize: 13
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#2563eb', fontSize: 16 }}>{experience}</div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>Years Exp.</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#059669', fontSize: 16 }}>{vet.totalConsultations || 0}</div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>Consults</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#8b5cf6', fontSize: 16 }}>{vet.currency || '$'}{vet.consultationFee || 0}</div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>Per Session</div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, justifyContent: isGrid ? 'center' : 'flex-start' }}>
            {(vet.languages || []).map(l => (
              <span key={l} style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>
                🌐 {l}
              </span>
            ))}
            {vet.acceptsEmergency && (
              <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                🚨 Emergency
              </span>
            )}
            {vet.isVerified && (
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                ✓ Verified
              </span>
            )}
          </div>

          {vet.clinicName && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, textAlign: isGrid ? 'center' : 'left' }}>
              🏥 {vet.clinicName}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{
          padding: isGrid ? '0 20px 20px' : '16px 24px 16px 0',
          display: 'flex', flexDirection: 'column', gap: 6,
          flexShrink: 0, justifyContent: 'center'
        }}
          onClick={e => e.stopPropagation()}>
          <button className="btn btn-primary"
            style={{ width: '100%', fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
            onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}`)}>
            📅 Book Consultation
          </button>
          <button className="btn btn-outline"
            style={{ width: '100%', fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
            onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}>
            View Profile & Reviews
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, color: '#1f2937' }}>🔍 Find a Veterinarian</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
          Browse {total > 0 ? `${total} ` : ''}qualified veterinarians — search by name, specialty, language, and more
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 16 }}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, specialization, clinic, qualification..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, minWidth: 160, background: 'white' }}>
            <option value="">All Specializations</option>
            {allSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, minWidth: 130, background: 'white' }}>
            <option value="">All Languages</option>
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
            ⚙️ Filters
            {activeFilterCount > 0 && (
              <span style={{ background: '#4F46E5', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Advanced Filters Panel ── */}
        {showFilters && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid #e5e7eb',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, alignItems: 'end'
          }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Minimum Rating</label>
              {renderRatingFilter()}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Max Fee ($)</label>
              <input type="number" min={0} step={10} placeholder="e.g. 100"
                value={maxFee} onChange={e => setMaxFee(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={emergencyOnly} onChange={e => setEmergencyOnly(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#dc2626' }} />
                <span>🚨 Accepts Emergency</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#059669' }} />
                <span>🟢 Available Only</span>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                  ✕ Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar: Sort, View Toggle, Results Count ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, flexWrap: 'wrap', gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {loading ? 'Searching...' : `${total} veterinarian${total !== 1 ? 's' : ''} found`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, background: 'white' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
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
        <div style={{ padding: '14px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => loadVets(page)}>Retry</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="loading-spinner" />
        </div>
      )}

      {/* ── Results ── */}
      {!loading && vets.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
          <h3 style={{ fontSize: 20, color: '#1f2937', marginBottom: 8 }}>No veterinarians match your criteria</h3>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
            Try broadening your search or removing some filters.
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="btn btn-primary" style={{ fontSize: 14 }}>Clear All Filters</button>
          )}
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
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 8, marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb'
            }}>
              <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db',
                  background: page === 0 ? '#f9fafb' : 'white', cursor: page === 0 ? 'default' : 'pointer',
                  color: page === 0 ? '#9ca3af' : '#374151', fontSize: 13, fontWeight: 600
                }}>
                ← Previous
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
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FindDoctor
