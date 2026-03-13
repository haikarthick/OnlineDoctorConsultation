import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { vetHospitalApi } from '../services/api/vetHospitalApi'
import type { VetHospital } from '../types'
import './ModulePage.css'
import './VetHospitals.css'
import { useTranslation } from 'react-i18next'

const HOSPITAL_TYPE_LABELS: Record<string, string> = {
  clinic:           'General Practice',
  emergency_center: 'Emergency & Trauma',
  specialty:        'Specialty',
  multi_specialty:  'Multi-Specialty',
  teaching:         'Teaching Hospital',
  research:         'Research Centre',
  mobile_vet:       'Mobile Unit',
  other:            'Other / Shelter Clinic',
}

const FILTER_TYPES = ['', 'clinic', 'emergency_center', 'specialty', 'multi_specialty', 'teaching', 'research', 'mobile_vet', 'other']

const StarRating: React.FC<{ value: number; max?: number }> = ({ value, max = 5 }) => (
  <span className="star-row" aria-label={`${Number(value).toFixed(1)} stars`}>
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} className={i < Math.round(value) ? 'star filled' : 'star'}>★</span>
    ))}
    <span className="star-num">{value > 0 ? Number(value).toFixed(1) : ''}</span>
  </span>
)

const HospitalCard: React.FC<{ hospital: VetHospital; onView: (h: VetHospital) => void }> = ({ hospital, onView }) => (
  <div className="hospital-card" onClick={() => onView(hospital)} role="button" tabIndex={0}
    onKeyDown={e => e.key === 'Enter' && onView(hospital)}>
    <div className="hcard-banner">
      {hospital.coverImageUrl
        ? <img src={hospital.coverImageUrl} alt="" className="hcard-cover" />
        : <div className="hcard-cover hcard-cover-placeholder" />}
      {hospital.logoUrl && <img src={hospital.logoUrl} alt={hospital.name} className="hcard-logo" />}
      <div className="hcard-badges">
        {hospital.isVerified && <span className="badge badge-verified">✓ Verified</span>}
        {!hospital.isVerified && hospital.verificationStatus === 'under_review' && (
          <span className="badge badge-review">⏳ Under Review</span>
        )}
        {!hospital.isVerified && hospital.verificationStatus === 'pending_documents' && (
          <span className="badge badge-pending-docs">📋 Pending Docs</span>
        )}
        {hospital.verificationStatus === 'suspended' && (
          <span className="badge badge-suspended">⚠ Suspended</span>
        )}
        {hospital.hasEmergency && <span className="badge badge-emergency">⚡ Emergency</span>}
        {hospital.is24Hours && <span className="badge badge-24h">24h</span>}
      </div>
    </div>
    <div className="hcard-body">
      <div className="hcard-type-row">
        <span className="hcard-type">{HOSPITAL_TYPE_LABELS[hospital.hospitalType] || hospital.hospitalType}</span>
        {hospital.rating > 0 && <StarRating value={hospital.rating} />}
      </div>
      <h3 className="hcard-name">{hospital.name}</h3>
      {hospital.city && <p className="hcard-location">📍 {hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</p>}
      {(hospital as any).tagline && <p className="hcard-tagline">{(hospital as any).tagline}</p>}
      <div className="hcard-stats">
        <span className="hcard-stat">🏥 {(hospital as any).totalDoctors ?? 0} Doctors</span>
        <span className="hcard-stat">🏢 {(hospital as any).totalDepartments ?? 0} Depts</span>
        {hospital.totalReviews > 0 && <span className="hcard-stat">💬 {hospital.totalReviews} Reviews</span>}
      </div>
      {hospital.specializations && hospital.specializations.length > 0 && (
        <div className="hcard-chips">
          {hospital.specializations.slice(0, 3).map(s => <span key={s} className="chip">{s}</span>)}
          {hospital.specializations.length > 3 && <span className="chip chip-more">+{hospital.specializations.length - 3}</span>}
        </div>
      )}
    </div>
  </div>
)

const VetHospitals: React.FC = () => {  const { t } = useTranslation()

  const { user } = useAuth()
  const navigate = useNavigate()
  const [hospitals, setHospitals] = useState<VetHospital[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [onlyEmergency, setOnlyEmergency] = useState(false)
  const [only24h, setOnly24h] = useState(false)
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [formData, setFormData] = useState({
    name: '', hospitalType: 'clinic', tagline: '', description: '',
    address: '', city: '', state: '', country: 'IN', postalCode: '',
    phone: '', email: '', website: '', establishedYear: '',
  })

  const limit = 12

  const fetchHospitals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await vetHospitalApi.listHospitals({
        search: search || undefined,
        city: city || undefined,
        hospitalType: typeFilter || undefined,
        hasEmergency: onlyEmergency || undefined,
        is24Hours: only24h || undefined,
        isVerified: onlyVerified || undefined,
        limit, offset: page * limit,
      })
      setHospitals(res.hospitals)
      setTotal(res.total)
    } catch { setHospitals([]); setTotal(0) }
    finally { setLoading(false) }
  }, [search, city, typeFilter, onlyEmergency, only24h, onlyVerified, page])

  useEffect(() => { fetchHospitals() }, [fetchHospitals])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(0); fetchHospitals() }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.hospitalType) { setCreateError('Name and type are required'); return }
    setCreateLoading(true); setCreateError('')
    try {
      const hospital = await vetHospitalApi.createHospital({
        ...formData,
        establishedYear: formData.establishedYear ? parseInt(formData.establishedYear) : undefined,
      } as any)
      setShowCreateModal(false)
      navigate(`/vet-hospitals/${hospital.id}/manage`)
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to create hospital')
    } finally { setCreateLoading(false) }
  }

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="module-page vh-page">
      {/* ── Header ── */}
      <div className="module-header vh-header">
        <div className="vh-header-left">
          <h1 className="module-title">{t('consultations.pageTitle')}</h1>
          <p className="module-subtitle">Find verified veterinary hospitals and specialist centres near you</p>
        </div>
        {isVet && (
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + Register Hospital
          </button>
        )}
        {isAdmin && (
          <button className="btn-secondary" onClick={() => navigate('/admin/vet-hospitals')}>
            Admin Panel
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="vh-filters">
        <form onSubmit={handleSearch} className="vh-search-row">
          <input className="vh-search-input" placeholder="Search hospitals, specializations…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <input className="vh-city-input" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
          <button type="submit" className="btn-primary vh-search-btn">Search</button>
        </form>
        <div className="vh-filter-row">
          <select className="vh-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }}>
            <option value="">All Types</option>
            {FILTER_TYPES.slice(1).map(t => <option key={t} value={t}>{HOSPITAL_TYPE_LABELS[t]}</option>)}
          </select>
          <label className="vh-toggle"><input type="checkbox" checked={onlyEmergency}
            onChange={e => { setOnlyEmergency(e.target.checked); setPage(0) }} /> Emergency</label>
          <label className="vh-toggle"><input type="checkbox" checked={only24h}
            onChange={e => { setOnly24h(e.target.checked); setPage(0) }} /> 24/7 Open</label>
          <label className="vh-toggle"><input type="checkbox" checked={onlyVerified}
            onChange={e => { setOnlyVerified(e.target.checked); setPage(0) }} /> Verified Only</label>
          <div className="vh-view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid">⊞</button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List">☰</button>
          </div>
        </div>
      </div>

      {/* ── Results count ── */}
      {!loading && (
        <div className="vh-results-meta">
          Showing {hospitals.length} of {total} hospital{total !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : hospitals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏥</div>
          <h3>No hospitals found</h3>
          <p>Try adjusting your search or filters</p>
          {isVet && <button className="btn-primary" onClick={() => setShowCreateModal(true)}>Register your hospital</button>}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'vh-grid' : 'vh-list'}>
          {hospitals.map(h => <HospitalCard key={h.id} hospital={h} onView={h => navigate(`/vet-hospitals/${h.id}`)} />)}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} className={i === page ? 'active' : ''} onClick={() => setPage(i)}>{i + 1}</button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      )}

      {/* ── Create Hospital Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content vh-create-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            <h2>Register a Vet Hospital</h2>
            <p className="modal-subtitle">Create your hospital profile to connect with patients and other vets</p>
            {createError && <div className="error-message">{createError}</div>}
            <form onSubmit={handleCreate} className="vh-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Hospital Name *</label>
                  <input required value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sunrise Animal Hospital" />
                </div>
                <div className="form-group">
                  <label>Type *</label>
                  <select required value={formData.hospitalType} onChange={e => setFormData(f => ({ ...f, hospitalType: e.target.value }))}>
                    {FILTER_TYPES.slice(1).map(t => <option key={t} value={t}>{HOSPITAL_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Tagline</label>
                <input value={formData.tagline} onChange={e => setFormData(f => ({ ...f, tagline: e.target.value }))} placeholder="Brief motto or focus area" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="About your hospital…" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>State / Province</label>
                  <input value={formData.state} onChange={e => setFormData(f => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Website</label>
                  <input value={formData.website} onChange={e => setFormData(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
                </div>
                <div className="form-group">
                  <label>Established Year</label>
                  <input type="number" value={formData.establishedYear} onChange={e => setFormData(f => ({ ...f, establishedYear: e.target.value }))} placeholder="2010" min="1900" max={new Date().getFullYear()} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createLoading}>
                  {createLoading ? 'Creating…' : 'Create Hospital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default VetHospitals
