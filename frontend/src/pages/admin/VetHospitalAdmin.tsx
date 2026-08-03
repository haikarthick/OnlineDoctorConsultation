import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
  const [adminTab, setAdminTab] = useState<'hospitals' | 'documents'>('hospitals')
  const [pendingHospitals, setPendingHospitals] = useState<any[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

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

  useEffect(() => {
    if (adminTab === 'documents' && pendingHospitals.length === 0 && !pendingLoading) {
      setPendingLoading(true)
      vetHospitalApi.listPendingVerification({ limit: 50 })
        .then(data => setPendingHospitals(data?.hospitals || data || []))
        .catch(() => flash(t('vetHospitalAdmin.pendingLoadFailed'), true))
        .finally(() => setPendingLoading(false))
    }
  }, [adminTab])

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
      <div className="si-5e716629">
        <div>
          <h1 className="si-b3b517f5">🏥 {t('vetHospitalAdmin.title')}</h1>
          <p className="si-0331b58e">{t('vetHospitalAdmin.subtitle')}</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/vet-hospitals')}>{t('vetHospitalAdmin.browseAsUser')}</button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="vh-manage-stats si-1e52b2bd">
          {[
            { label: t('vetHospitalAdmin.totalHospitals'), value: Number(stats.total) || 0, icon: '🏥' },
            { label: t('vetHospitalAdmin.verified'), value: Number(stats.verified) || 0, icon: '✓', accent: '#059669' },
            { label: t('vetHospitalAdmin.pending'), value: (Number(stats.total) - Number(stats.verified)) || 0, icon: '⏳', accent: '#d97706' },
            { label: t('vetHospitalAdmin.newThisMonth'), value: Number(stats.new_this_month) || 0, icon: '📈' },
            { label: t('vetHospitalAdmin.avgRating'), value: parseFloat(stats.avg_rating || '0').toFixed(1), icon: '⭐' },
            { label: t('vetHospitalAdmin.multiSpecialty'), value: Number(stats.multi_specialty) || 0, icon: '🏨' },
          ].map(s => (
            <div key={s.label} className="vh-stat-card">
              <div className="si-46606d89">{s.icon}</div>
              <div className="vh-stat-value" style={{ color: s.accent }}>{s.value}</div>
              <div className="vh-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Tabs */}
      <div className="vh-profile-tabs si-78c26469">
        <button className={`vh-tab${adminTab === 'hospitals' ? ' active' : ''}`} onClick={() => setAdminTab('hospitals')}>
          🏥 {t('vetHospitalAdmin.hospitals')} ({hospitals.length})
        </button>
        <button className={`vh-tab${adminTab === 'documents' ? ' active' : ''}`} onClick={() => setAdminTab('documents')}>
          📄 {t('vetHospitalAdmin.documentReview')} {pendingHospitals.length > 0 ? `(${pendingHospitals.length})` : ''}
        </button>
      </div>

      {adminTab === 'hospitals' && (<>
      {/* Filters */}
      <div className="vh-filters si-78c26469">
        <div className="vh-search-row">
          <input className="vh-search-input" placeholder={t('vetHospitalAdmin.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="vh-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">{t('vetHospitalAdmin.allTypes')}</option>
            {Object.entries(HOSPITAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="vh-select" value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value as any)}>
            <option value="">{t('vetHospitalAdmin.allStatus')}</option>
            <option value="true">{t('vetHospitalAdmin.verified')}</option>
            <option value="false">{t('vetHospitalAdmin.pendingStatus')}</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message si-1cb81cae">{error}</div>}
      {success && <div className="success-message si-1cb81cae">{success}</div>}

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : hospitals.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🏥</div><p>{t('vetHospitalAdmin.noHospitals')}</p></div>
      ) : (
        <div className="si-9aa6c55f">
          <table className="vh-admin-table">
            <thead>
              <tr>
                <th>{t('vetHospitalAdmin.hospital')}</th>
                <th>{t('vetHospitalAdmin.type')}</th>
                <th>{t('vetHospitalAdmin.city')}</th>
                <th>{t('vetHospitalAdmin.doctors')}</th>
                <th>{t('vetHospitalAdmin.rating')}</th>
                <th>{t('vetHospitalAdmin.flags')}</th>
                <th>{t('vetHospitalAdmin.verifiedCol')}</th>
                <th>{t('vetHospitalAdmin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map(h => (
                <tr key={h.id}>
                  <td>
                    <div className="si-b2cfcbec">{h.name}</div>
                    <div className="si-a734c257">{h.id.slice(0,8)}…</div>
                  </td>
                  <td>{HOSPITAL_TYPE_LABELS[h.hospitalType] || h.hospitalType}</td>
                  <td>{h.city || '-'}{h.state ? `, ${h.state}` : ''}</td>
                  <td className="si-4b6b7fbc">{(h as any).totalDoctors ?? 0}</td>
                  <td>
                    {Number(h.rating) > 0
                      ? <span className="si-37c6b3a7">★ {Number(h.rating).toFixed(1)}</span>
                      : <span className="si-d436f5f9">-</span>}
                  </td>
                  <td>
                    <div className="si-b06973c0">
                      {h.hasEmergency && <span className="badge badge-emergency">⚡</span>}
                      {h.is24Hours && <span className="badge badge-24h">24h</span>}
                      {!h.isActive && <span className="badge si-fbb9810e">{t('vetHospitalAdmin.inactive')}</span>}
                    </div>
                  </td>
                  <td>
                    {h.isVerified
                      ? <span className="badge badge-verified">✓ {t('vetHospitalAdmin.verified')}</span>
                      : <span className="badge si-48e60a28">⏳ {t('vetHospitalAdmin.pendingStatus')}</span>}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-secondary si-bdd5e4ae"
                        onClick={() => navigate(`/vet-hospitals/${h.id}`)}>{t('vetHospitalAdmin.view')}</button>
                      {!h.isVerified
                        ? <button className="btn-primary si-bdd5e4ae"
                            disabled={actionLoading === h.id}
                            onClick={() => setVerifyTarget(h)}>
                            {actionLoading === h.id ? '…' : t('vetHospitalAdmin.verify')}
                          </button>
                        : <button className="btn-danger si-bdd5e4ae"
                            disabled={actionLoading === h.id}
                            onClick={() => handleVerify(h, false)}>
                            {actionLoading === h.id ? '…' : t('vetHospitalAdmin.unverify')}
                          </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}

      {/* ── Document Review Tab ── */}
      {adminTab === 'documents' && (
        <div>
          <h3 className="si-7f683059">{t('vetHospitalAdmin.pendingDocReviews')}</h3>
          {pendingLoading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : pendingHospitals.length === 0 ? (
            <div className="empty-state si-41acd90c">
              <div className="si-28db9f67">✅</div>
              <p>{t('vetHospitalAdmin.noDocReviews')}</p>
            </div>
          ) : (
            <div className="doc-cards-grid">
              {pendingHospitals.map((h: any) => (
                <div key={h.id} className="doc-card si-3c1f81b9" onClick={() => navigate(`/vet-hospitals/${h.id}`)}>
                  <div className="doc-card-top">
                    <div>
                      <div className="doc-type-label">{h.name}</div>
                      <div className="doc-expiry-hint">{h.city || ''}{h.state ? `, ${h.state}` : ''}</div>
                    </div>
                    <span className="doc-status-badge pending_review">
                      {h.pending_docs || h.pendingDocs || 0} pending
                    </span>
                  </div>
                  <div className="si-3a2a02b0">
                    <span className="dac-item approved">{h.approved_docs || h.approvedDocs || 0} Approved</span>
                    <span className="dac-item rejected">{h.rejected_docs || h.rejectedDocs || 0} Rejected</span>
                    <span className="dac-item missing">{h.missing_docs || h.missingDocs || 0} Missing</span>
                  </div>
                  <div className="si-f13c452b">
                    <span className="si-44ed7787">{t('vetHospitalAdmin.reviewDocuments')} →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verify Confirmation Modal */}
      {verifyTarget && (
        <div className="modal-overlay" onClick={() => setVerifyTarget(null)}>
          <div className="modal-content si-25615047" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setVerifyTarget(null)}>✕</button>
            <h2>{t('vetHospitalAdmin.verifyHospital')}</h2>
            <p>{t('vetHospitalAdmin.verifyConfirm')} <strong>{verifyTarget.name}</strong>?</p>
            <p className="si-2c46f209">
              {t('vetHospitalAdmin.verifyMsg')}
            </p>
            <div className="si-19fe263f">
              <button className="btn-secondary" onClick={() => setVerifyTarget(null)}>{t('vetHospitalAdmin.cancel')}</button>
              <button className="btn-primary" disabled={!!actionLoading} onClick={() => handleVerify(verifyTarget, true)}>
                {actionLoading ? t('vetHospitalAdmin.verifying') : t('vetHospitalAdmin.confirmVerify')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VetHospitalAdmin
