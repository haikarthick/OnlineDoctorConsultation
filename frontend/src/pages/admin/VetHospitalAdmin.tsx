import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { vetHospitalApi } from '../../services/api/vetHospitalApi'
import type { VetHospital, HospitalAdminStats } from '../../types'
import '../../styles/modules.css'
import '../VetHospitals.css'

const HOSPITAL_TYPE_LABELS: Record<string, string> = {
  general: 'General Practice', emergency: 'Emergency & Trauma', specialty: 'Specialty',
  multi_specialty: 'Multi-Specialty', teaching: 'Teaching Hospital',
  research: 'Research Centre', mobile: 'Mobile Unit', shelter: 'Shelter Clinic',
}

const VetHospitalAdmin: React.FC = () => {
  const navigate = useNavigate()
  const [hospitals, setHospitals] = useState<VetHospital[]>([])
  const [stats, setStats] = useState<HospitalAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState<'' | 'true' | 'false'>('')
  const [verifyTarget, setVerifyTarget] = useState<VetHospital | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [res, st] = await Promise.all([
        vetHospitalApi.listHospitals({
          search: search || undefined,
          hospitalType: typeFilter || undefined,
          isVerified: verifiedFilter === '' ? undefined : verifiedFilter === 'true',
          limit: 100,
        }),
        vetHospitalApi.getAdminStats(),
      ])
      setHospitals(res.hospitals)
      setStats(st)
    } catch { setError('Failed to load hospital data') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [search, typeFilter, verifiedFilter])

  const flash = (msg: string, isErr = false) => {
    if (isErr) { setError(msg); setTimeout(() => setError(''), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  const handleVerify = async (hospital: VetHospital, verified: boolean) => {
    setActionLoading(hospital.id)
    try {
      const updated = await vetHospitalApi.verifyHospital(hospital.id, verified)
      setHospitals(prev => prev.map(h => h.id === hospital.id ? updated : h))
      flash(verified ? `${hospital.name} verified` : `${hospital.name} unverified`)
      await vetHospitalApi.getAdminStats().then(setStats)
    } catch { flash('Failed to update verification', true) }
    finally { setActionLoading(null); setVerifyTarget(null) }
  }

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>🏥 Hospital Management</h1>
          <p style={{ margin: '.3rem 0 0', color: 'var(--text-muted,#666)' }}>Verify and manage all vet hospitals on the platform</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/vet-hospitals')}>Browse as User</button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="vh-manage-stats" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Hospitals', value: Number(stats.total) || 0, icon: '🏥' },
            { label: 'Verified', value: Number(stats.verified) || 0, icon: '✓', accent: '#059669' },
            { label: 'Pending', value: (Number(stats.total) - Number(stats.verified)) || 0, icon: '⏳', accent: '#d97706' },
            { label: 'New This Month', value: Number(stats.new_this_month) || 0, icon: '📈' },
            { label: 'Avg Rating', value: parseFloat(stats.avg_rating || '0').toFixed(1), icon: '⭐' },
            { label: 'Multi-Specialty', value: Number(stats.multi_specialty) || 0, icon: '🏨' },
          ].map(s => (
            <div key={s.label} className="vh-stat-card">
              <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
              <div className="vh-stat-value" style={{ color: s.accent }}>{s.value}</div>
              <div className="vh-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="vh-filters" style={{ marginBottom: '1.25rem' }}>
        <div className="vh-search-row">
          <input className="vh-search-input" placeholder="Search by name, city…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="vh-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(HOSPITAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="vh-select" value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value as any)}>
            <option value="">All Status</option>
            <option value="true">Verified</option>
            <option value="false">Pending</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="success-message" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : hospitals.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🏥</div><p>No hospitals found</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="vh-admin-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Type</th>
                <th>City</th>
                <th>Doctors</th>
                <th>Rating</th>
                <th>Flags</th>
                <th>Verified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map(h => (
                <tr key={h.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{h.name}</div>
                    <div style={{ fontSize: '.77rem', color: 'var(--text-muted,#888)' }}>{h.id.slice(0,8)}…</div>
                  </td>
                  <td>{HOSPITAL_TYPE_LABELS[h.hospitalType] || h.hospitalType}</td>
                  <td>{h.city || '—'}{h.state ? `, ${h.state}` : ''}</td>
                  <td style={{ textAlign: 'center' }}>{(h as any).totalDoctors ?? 0}</td>
                  <td>
                    {Number(h.rating) > 0
                      ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>★ {Number(h.rating).toFixed(1)}</span>
                      : <span style={{ color: 'var(--text-muted,#aaa)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
                      {h.hasEmergency && <span className="badge badge-emergency">⚡</span>}
                      {h.is24Hours && <span className="badge badge-24h">24h</span>}
                      {!h.isActive && <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Inactive</span>}
                    </div>
                  </td>
                  <td>
                    {h.isVerified
                      ? <span className="badge badge-verified">✓ Verified</span>
                      : <span className="badge" style={{ background: '#fef9c3', color: '#92400e' }}>⏳ Pending</span>}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-secondary" style={{ fontSize: '.76rem', padding: '.25rem .55rem' }}
                        onClick={() => navigate(`/vet-hospitals/${h.id}`)}>View</button>
                      {!h.isVerified
                        ? <button className="btn-primary" style={{ fontSize: '.76rem', padding: '.25rem .55rem' }}
                            disabled={actionLoading === h.id}
                            onClick={() => setVerifyTarget(h)}>
                            {actionLoading === h.id ? '…' : 'Verify'}
                          </button>
                        : <button className="btn-danger" style={{ fontSize: '.76rem', padding: '.25rem .55rem' }}
                            disabled={actionLoading === h.id}
                            onClick={() => handleVerify(h, false)}>
                            {actionLoading === h.id ? '…' : 'Unverify'}
                          </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Verify Confirmation Modal */}
      {verifyTarget && (
        <div className="modal-overlay" onClick={() => setVerifyTarget(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setVerifyTarget(null)}>✕</button>
            <h2>Verify Hospital</h2>
            <p>Are you sure you want to verify <strong>{verifyTarget.name}</strong>?</p>
            <p style={{ fontSize: '.88rem', color: 'var(--text-muted,#666)' }}>
              This will mark it as a verified hospital and it will appear with a verification badge to all users.
            </p>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setVerifyTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={!!actionLoading} onClick={() => handleVerify(verifyTarget, true)}>
                {actionLoading ? 'Verifying…' : 'Confirm Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VetHospitalAdmin
