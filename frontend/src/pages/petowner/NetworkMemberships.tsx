import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import apiService from '../../services/api'
import '../ModulePage.css'
import './NetworkMemberships.css'

const NetworkMemberships: React.FC = () => {
  const { t } = useTranslation()
  const { formatDate } = useSettings()

  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [consentScope, setConsentScope] = useState<Record<string, string>>({})
  const [showPast, setShowPast] = useState(false)

  const loadEnrollments = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiService.getMyNetworkEnrollments()
      const arr = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : [])
      setEnrollments(arr.filter((item: any) => item != null))
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEnrollments() }, [])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(''), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const pending = enrollments.filter(e => e?.enrollmentStatus === 'pending_consent')
  const active = enrollments.filter(e => e?.enrollmentStatus === 'active')
  const past = enrollments.filter(e => e?.enrollmentStatus === 'declined' || e?.enrollmentStatus === 'revoked')

  const handleAccept = async (contextId: string, networkName: string, animalName: string) => {
    setActing(contextId)
    try {
      await apiService.acceptEnrollment(contextId, consentScope[contextId] ?? 'basic_history')
      setSuccessMsg(t('networkMemberships.acceptSuccess', { network: networkName, animal: animalName }))
      await loadEnrollments()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to accept')
    } finally {
      setActing(null)
    }
  }

  const handleDecline = async (contextId: string) => {
    setActing(contextId)
    try {
      await apiService.declineEnrollment(contextId)
      setSuccessMsg(t('networkMemberships.declineSuccess'))
      await loadEnrollments()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to decline')
    } finally {
      setActing(null)
    }
  }

  const getStatusBadgeText = (status: string) => {
    switch (status) {
      case 'pending_consent': return t('networkMemberships.statusPending')
      case 'active': return t('networkMemberships.statusActive')
      case 'declined': return t('networkMemberships.statusDeclined')
      case 'revoked': return t('networkMemberships.statusRevoked')
      default: return status
    }
  }

  const getConsentHint = (scope: string) => {
    if (scope === 'basic_history') return t('networkMemberships.consentBasic')
    if (scope === 'full_history') return t('networkMemberships.consentFull')
    return t('networkMemberships.consentViewOnly')
  }

  return (
    <div className="module-page nm-page">
      <div className="module-header">
        <div>
          <h1>{t('networkMemberships.title')}</h1>
          <p className="nm-subtitle">{t('networkMemberships.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="module-alert error">
          {error}
          <button style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
        </div>
      )}
      {successMsg && <div className="module-alert success">{successMsg}</div>}

      <div className="nm-privacy-note">
        🔐 {t('networkMemberships.privacyNote')}
      </div>

      {loading ? (
        <div className="nm-loading">⏳ {t('common.loading')}</div>
      ) : enrollments.length === 0 ? (
        <div className="nm-empty-state">
          <div className="nm-empty-icon">🏥</div>
          <div className="nm-empty-title">{t('networkMemberships.noEnrollments')}</div>
          <div className="nm-empty-sub">{t('networkMemberships.noEnrollmentsSubtitle')}</div>
        </div>
      ) : (
        <>
          {/* ── Pending Requests ── */}
          {pending.length > 0 && (
            <div className="module-card" style={{ marginBottom: 24 }}>
              <div className="nm-pending-banner">
                🔔 {t('networkMemberships.pendingBanner', { count: pending.length })}
              </div>
              <h2 className="nm-section-title">{t('networkMemberships.pendingRequests')}</h2>
              <div className="nm-cards-grid">
                {pending.map((e, idx) => (
                  <div key={e?.id ?? `pending-${idx}`} className="nm-card pending">
                    <div className="nm-card-header">
                      <span className="nm-card-icon">🏥</span>
                      <div>
                        <p className="nm-card-title">{t('networkMemberships.requestFrom', { network: e.networkName, animal: e.animalName })}</p>
                        <p className="nm-card-sub">
                          {e.enrolledByName ? t('networkMemberships.requestedBy', { name: e.enrolledByName }) : ''}
                          {' '}{t('networkMemberships.requestedOn', { date: formatDate(e.enrollmentRequestedAt) })}
                        </p>
                      </div>
                    </div>

                    <span className={`nm-status-badge pending_consent`}>{getStatusBadgeText('pending_consent')}</span>

                    {e.networkPatientId && (
                      <div className="nm-id-row">
                        <span className="nm-id-label">{t('networkMemberships.networkPatientId')}</span>
                        <span className="nm-id-value">{e.networkPatientId}</span>
                      </div>
                    )}
                    {e.platformUniqueId && (
                      <div className="nm-id-row">
                        <span className="nm-id-label">{t('networkMemberships.platformId')}</span>
                        <span className="nm-id-value">{e.platformUniqueId}</span>
                      </div>
                    )}

                    <div className="nm-consent-select-row">
                      <label>{t('networkMemberships.consentLevel')}</label>
                      <select
                        className="nm-consent-select"
                        value={consentScope[e.id] ?? 'basic_history'}
                        onChange={ev => setConsentScope(s => ({ ...s, [e.id]: ev.target.value }))}
                      >
                        <option value="basic_history">{t('networkMemberships.basicTreatment')}</option>
                        <option value="full_history">{t('networkMemberships.fullAccess')}</option>
                        <option value="emergency_only">{t('networkMemberships.viewOnly')}</option>
                      </select>
                      <p className="nm-consent-hint">{getConsentHint(consentScope[e.id] ?? 'basic_history')}</p>
                    </div>

                    <div className="nm-card-actions">
                      <button
                        className="nm-btn-accept"
                        disabled={acting === e.id}
                        onClick={() => handleAccept(e.id, e.networkName, e.animalName)}
                      >
                        {acting === e.id ? '⏳' : t('networkMemberships.accept')}
                      </button>
                      <button
                        className="nm-btn-decline"
                        disabled={acting === e.id}
                        onClick={() => handleDecline(e.id)}
                      >
                        {t('networkMemberships.decline')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Active Memberships ── */}
          {active.length > 0 && (
            <div className="module-card" style={{ marginBottom: 24 }}>
              <h2 className="nm-section-title">{t('networkMemberships.activeMemberships')}</h2>
              <div className="nm-cards-grid">
                {active.map((e, idx) => (
                  <div key={e?.id ?? `active-${idx}`} className="nm-card active">
                    <div className="nm-card-header">
                      <span className="nm-card-icon">✅</span>
                      <div>
                        <p className="nm-card-title">{e.networkName} — {e.animalName}</p>
                        <p className="nm-card-sub">{e.species}{e.breed ? ` · ${e.breed}` : ''}</p>
                      </div>
                    </div>

                    <span className={`nm-status-badge active`}>{getStatusBadgeText('active')}</span>

                    {e.networkPatientId && (
                      <div className="nm-id-row">
                        <span className="nm-id-label">{t('networkMemberships.networkPatientId')}</span>
                        <span className="nm-id-value">{e.networkPatientId}</span>
                      </div>
                    )}
                    {e.platformUniqueId && (
                      <div className="nm-id-row">
                        <span className="nm-id-label">{t('networkMemberships.platformId')}</span>
                        <span className="nm-id-value">{e.platformUniqueId}</span>
                      </div>
                    )}

                    <p className="nm-date-info">
                      {e.enrollmentRespondedAt ? t('networkMemberships.enrolledSince', { date: formatDate(e.enrollmentRespondedAt) }) : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Past / Declined ── */}
          {past.length > 0 && (
            <div>
              <button className="nm-past-toggle" onClick={() => setShowPast(s => !s)}>
                {showPast ? '▼' : '▶'} {t('networkMemberships.pastMemberships')} ({past.length})
              </button>
              {showPast && (
                <div className="nm-cards-grid">
                  {past.map((e, idx) => (
                    <div key={e?.id ?? `past-${idx}`} className={`nm-card ${e?.enrollmentStatus}`}>
                      <div className="nm-card-header">
                        <span className="nm-card-icon">📋</span>
                        <div>
                          <p className="nm-card-title">{e.networkName} — {e.animalName}</p>
                          <p className="nm-card-sub">{e.species}</p>
                        </div>
                      </div>
                      <span className={`nm-status-badge ${e.enrollmentStatus}`}>{getStatusBadgeText(e.enrollmentStatus)}</span>
                      {e.networkPatientId && (
                        <div className="nm-id-row">
                          <span className="nm-id-label">{t('networkMemberships.networkPatientId')}</span>
                          <span className="nm-id-value">{e.networkPatientId}</span>
                        </div>
                      )}
                      <p className="nm-date-info">
                        {e.enrollmentRespondedAt ? formatDate(e.enrollmentRespondedAt) : formatDate(e.enrollmentRequestedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default NetworkMemberships
