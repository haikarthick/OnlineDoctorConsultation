import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../../styles/modules.css'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface Dispute {
  id: string
  subject: string
  description: string
  disputeType: string
  status: string
  bookingId?: string
  consultationId?: string
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
  createdAt: string
  reportedByName?: string
  reportedByEmail?: string
}

interface DisputeManagementProps {
  onNavigate?: (path: string) => void
}

const STATUS_BADGE: Record<string, string> = {
  open: 'badge-pending',
  under_review: 'badge-warning',
  resolved: 'badge-success',
  dismissed: 'badge-inactive',
  escalated: 'badge-error',
}

const DisputeManagement: React.FC<DisputeManagementProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Resolve modal state
  const [resolving, setResolving] = useState<Dispute | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolveStatus, setResolveStatus] = useState('resolved')
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveError, setResolveError] = useState('')

  useEffect(() => {
    loadDisputes()
  }, [statusFilter])

  useAutoRefresh(['disputes'], loadDisputes)

  async function loadDisputes() {
    try {
      setLoading(true)
      setError('')
      const result = await (apiService as any).get('/disputes')
      const data: Dispute[] = result?.data?.data || result?.data || []
      const filtered = statusFilter ? data.filter((d: Dispute) => d.status === statusFilter) : data
      setDisputes(filtered)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }

  async function handleResolve() {
    if (!resolving || !resolution.trim()) return
    setResolveLoading(true)
    setResolveError('')
    try {
      await (apiService as any).put(`/disputes/${resolving.id}/resolve`, { resolution, status: resolveStatus })
      setResolving(null)
      setResolution('')
      setResolveStatus('resolved')
      await loadDisputes()
    } catch (err: any) {
      setResolveError(err?.response?.data?.error || err?.message || 'Failed to resolve dispute')
    } finally {
      setResolveLoading(false)
    }
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>⚖️ {t('disputeManagement.title')}</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{disputes.length} {t('disputeManagement.title')}</p>
        </div>
        {onNavigate && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="module-btn" onClick={() => onNavigate('/admin/dashboard')}>← Dashboard</button>
          </div>
        )}
      </div>

      {error && (
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="module-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="module-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">{t('common.all')}</option>
            <option value="open">{t('disputeManagement.open')}</option>
            <option value="under_review">{t('disputeManagement.underReview')}</option>
            <option value="resolved">{t('disputeManagement.resolved')}</option>
            <option value="dismissed">{t('disputeManagement.dismissed')}</option>
            <option value="escalated">{t('disputeManagement.escalated')}</option>
          </select>
          <button className="module-btn" onClick={loadDisputes}>🔄 {t('common.refresh')}</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚖️</div>
          <h3>{t('disputeManagement.noDisputes')}</h3>
        </div>
      ) : (
        <div className="module-card">
          <div className="data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('disputeManagement.subject')}</th>
                  <th>{t('common.type')}</th>
                  <th>{t('disputeManagement.status')}</th>
                  <th>Reporter</th>
                  <th>{t('common.date')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map(d => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.subject}</strong>
                      {d.description && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</div>
                      )}
                    </td>
                    <td>
                      <span className="module-badge">{d.disputeType.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[d.status] || 'badge-inactive'}`}>{d.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <div>{d.reportedByName || '—'}</div>
                      {d.reportedByEmail && <div style={{ fontSize: 12, color: '#6b7280' }}>{d.reportedByEmail}</div>}
                    </td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      {!['resolved', 'dismissed'].includes(d.status) && (
                        <button
                          className="module-btn primary small"
                          onClick={() => { setResolving(d); setResolution(''); setResolveStatus('resolved'); setResolveError('') }}
                        >
                          {t('disputeManagement.resolve')}
                        </button>
                      )}
                      {d.resolution && (
                        <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>✓ {d.resolution.substring(0, 40)}{d.resolution.length > 40 ? '…' : ''}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolving && (
        <div className="edit-form-overlay" onClick={() => setResolving(null)}>
          <div className="edit-form-panel edit-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <button className="edit-form-close" onClick={() => setResolving(null)} aria-label="Close">✕</button>
            <h2>⚖️ {t('disputeManagement.resolve')}</h2>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>
              <strong>{resolving.subject}</strong>
            </p>

            {resolveError && (
              <div className="module-alert error" style={{ marginBottom: 12 }}>⚠️ {resolveError}</div>
            )}

            <div className="module-form-group">
              <label className="module-label">{t('common.status')} *</label>
              <select className="module-input" value={resolveStatus} onChange={e => setResolveStatus(e.target.value)}>
                <option value="resolved">{t('disputeManagement.resolved')}</option>
                <option value="dismissed">{t('disputeManagement.dismissed')}</option>
                <option value="escalated">{t('disputeManagement.escalated')}</option>
              </select>
            </div>

            <div className="module-form-group">
              <label className="module-label">{t('disputeManagement.resolution')} *</label>
              <textarea
                className="module-input"
                rows={4}
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder={t('disputeManagement.description')}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="module-btn" onClick={() => setResolving(null)}>{t('common.cancel')}</button>
              <button
                className="module-btn primary"
                onClick={handleResolve}
                disabled={resolveLoading || !resolution.trim()}
              >
                {resolveLoading ? '⏳ Saving...' : t('disputeManagement.resolve')}
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>* {t('common.required')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisputeManagement
