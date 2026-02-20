import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { VetProfile } from '../../types'
import '../../styles/modules.css'

interface FindDoctorProps {
  onNavigate: (path: string) => void
}

const FindDoctor: React.FC<FindDoctorProps> = ({ onNavigate }) => {
  const [vets, setVets] = useState<VetProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadVets()
  }, [])

  const loadVets = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await apiService.listVets({ limit: 50 })
      setVets(result.data?.vets || result.data?.items || (Array.isArray(result.data) ? result.data : []))
    } catch (err: any) {
setError(err?.response?.data?.error?.message || err?.message || 'Failed to load veterinarians')
    } finally {
      setLoading(false)
    }
  }

  const filteredVets = vets.filter(vet => {
    const matchesSearch = !searchTerm || 
      (vet.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       vet.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       vet.specializations?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())))
    const matchesSpecialty = !specialtyFilter ||
      vet.specializations?.includes(specialtyFilter)
    return matchesSearch && matchesSpecialty
  })

  const allSpecializations = [...new Set(vets.flatMap(v => v.specializations || []))]

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < Math.round(rating) ? 'filled' : ''}`}>★</span>
    ))
  }

  if (loading) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Finding veterinarians...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>Find a Veterinarian</h1>
          <p className="page-subtitle">Browse qualified veterinarians and book consultations</p>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or specialization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        >
          <option value="">All Specializations</option>
          {allSpecializations.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
          <button className="btn btn-outline" style={{ marginLeft: 12 }} onClick={loadVets}>Retry</button>
        </div>
      )}

      {filteredVets.length === 0 && !error ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No veterinarians found</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="vet-grid">
          {filteredVets.map(vet => (
            <div key={vet.id} className="vet-card">
              <div className="vet-avatar">
                {vet.firstName?.charAt(0) || '🐾'}
              </div>
              <h3 className="vet-name">
                Dr. {vet.firstName || ''} {vet.lastName || ''}
              </h3>
              <p className="vet-specialty">
                {(vet.specializations || []).join(', ') || 'General Veterinarian'}
              </p>
              
              <div className="star-rating-display">
                {renderStars(vet.rating || 0)}
                <span style={{ marginLeft: 6, fontSize: 14, color: '#6b7280' }}>
                  ({vet.totalReviews || 0})
                </span>
              </div>

              <div className="vet-stats">
                <div className="vet-stat">
                  <div className="vet-stat-value">{vet.experience || 0}</div>
                  <div className="vet-stat-label">Years Exp.</div>
                </div>
                <div className="vet-stat">
                  <div className="vet-stat-value">{vet.totalConsultations || 0}</div>
                  <div className="vet-stat-label">Consultations</div>
                </div>
              </div>

              <div className="vet-fee">
                {vet.currency || '$'}{vet.consultationFee || 0}/session
              </div>

              {vet.languages && vet.languages.length > 0 && (
                <div className="vet-tags">
                  {vet.languages.map(lang => (
                    <span key={lang} className="vet-tag">{lang}</span>
                  ))}
                </div>
              )}

              {vet.acceptsEmergency && (
                <div style={{ marginBottom: 12 }}>
                  <span className="badge badge-scheduled">🚨 Accepts Emergency</span>
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => onNavigate(`/book-consultation?vetId=${vet.userId}`)}
              >
                📅 Book Consultation
              </button>
              
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => onNavigate(`/vet-profile/${vet.userId}`)}
              >
                View Profile & Reviews
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FindDoctor
