import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import apiService from '../services/api'
import CertificatePrintView, { CertificatePrintData, CertificateTemplate } from '../components/CertificatePrintView'
import '../styles/modules.css'
import './VetCertificates.css'

interface VetCertificatesProps {
  onNavigate: (path: string) => void
}

interface CertItem {
  id: string
  certificateNumber: string
  certificateType: string
  status: 'draft' | 'active' | 'revoked' | 'expired'
  examinationDate?: string
  issuedAt?: string
  validUntil?: string
  createdAt: string
  animalId?: string
  animalName?: string
  animalSpecies?: string
  animalUniqueId?: string
  enterpriseId?: string
  enterpriseName?: string
  vetFirstName?: string
  vetLastName?: string
  ownerFirstName?: string
  ownerLastName?: string
}

const CERT_TYPES = [
  'health_certificate', 'fitness_to_travel', 'rabies_vaccination', 'vaccination_record',
  'pre_travel', 'sterilization', 'treatment', 'animal_injury', 'post_mortem',
  'breeding_soundness', 'pregnancy_diagnosis', 'infertility_evaluation',
  'fitness_for_sale', 'animal_valuation',
  // Farm/enterprise types
  'movement_permit', 'herd_health_certificate', 'slaughter_fitness', 'export_health_certificate',
]

const VetCertificates: React.FC<VetCertificatesProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatDate } = useSettings()

  const [certificates, setCertificates] = useState<CertItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [enterpriseFilter, setEnterpriseFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  // Enterprise options for farmer/admin
  const [enterpriseOptions, setEnterpriseOptions] = useState<{ id: string; name: string }[]>([])
  const isFarmerOrAdmin = user?.role === 'farmer' || user?.role === 'admin'

  // Print
  const [printData, setPrintData] = useState<CertificatePrintData | null>(null)
  const [printTemplate, setPrintTemplate] = useState<CertificateTemplate | null>(null)
  const [loadingPrint, setLoadingPrint] = useState<string | null>(null)

  // Revoke modal
  const [revokeTarget, setRevokeTarget] = useState<CertItem | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  // Issue confirm
  const [issueTarget, setIssueTarget] = useState<CertItem | null>(null)
  const [issuing, setIssuing] = useState(false)

  const isVet = user?.role === 'veterinarian'
  const isAdmin = user?.role === 'admin'

  // Load enterprises for farmer/admin filter
  useEffect(() => {
    if (!isFarmerOrAdmin) return
    apiService.listEnterprises({ limit: 100 }).then(res => {
      const items = res.data?.items || res.data?.enterprises || (Array.isArray(res.data) ? res.data : [])
      setEnterpriseOptions(items.map((e: any) => ({ id: e.id, name: e.name })))
    }).catch(() => setError(t('vetCertificates.failedToLoadEnterprises')))
  }, [isFarmerOrAdmin, t])

  const loadCertificates = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params: Record<string, any> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }
      if (typeFilter) params.type = typeFilter
      if (statusFilter) params.status = statusFilter
      if (enterpriseFilter) params.enterpriseId = enterpriseFilter
      if ((isAdmin || isFarmerOrAdmin) && searchTerm.trim()) params.search = searchTerm.trim()

      const res = await apiService.getMyCertificates(params)
      const data = res.data || {}
      setCertificates(data.certificates || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || t('vetCertificates.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [t, typeFilter, statusFilter, enterpriseFilter, searchTerm, page, isAdmin, isFarmerOrAdmin])

  useEffect(() => { loadCertificates() }, [loadCertificates])

  const handlePrint = async (cert: CertItem) => {
    try {
      setLoadingPrint(cert.id)
      const [certRes, tplMap] = await Promise.all([
        apiService.getCertificate(cert.id),
        apiService.getCertificateTemplate(),
      ])
      const fullCert = certRes.data?.certificate || certRes.data

      const tpl: CertificateTemplate = {
        clinicName: tplMap.clinicName || 'VetCare Platform',
        clinicAddress: tplMap.clinicAddress || '',
        clinicPhone: tplMap.clinicPhone || '',
        clinicEmail: tplMap.clinicEmail || '',
        clinicWebsite: tplMap.clinicWebsite || '',
        registrationNumber: tplMap.registrationNumber || '',
        clinicLogo: tplMap.clinicLogo || '',
        footerText: tplMap.footerText || '',
      }
      setPrintTemplate(tpl)
      setPrintData(fullCert)
    } catch {
      setError(t('vetCertificates.failedToPrint'))
    } finally {
      setLoadingPrint(null)
    }
  }

  const handleIssue = async () => {
    if (!issueTarget) return
    try {
      setIssuing(true)
      await apiService.issueCertificate(issueTarget.id)
      setIssueTarget(null)
      loadCertificates()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('certificateWriter.failedToIssue'))
    } finally {
      setIssuing(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget || !revokeReason.trim()) return
    try {
      setRevoking(true)
      await apiService.revokeCertificate(revokeTarget.id, revokeReason.trim())
      setRevokeTarget(null)
      setRevokeReason('')
      loadCertificates()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || t('vetCertificates.failedToLoad'))
    } finally {
      setRevoking(false)
    }
  }

  const handleDelete = async (cert: CertItem) => {
    if (!window.confirm('Delete this draft certificate? This cannot be undone.')) return
    try {
      await apiService.deleteCertificate(cert.id)
      loadCertificates()
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to delete certificate')
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'badge badge-pending',
      active: 'badge badge-success',
      revoked: 'badge badge-error',
      expired: 'badge',
    }
    const label: Record<string, string> = {
      draft: t('vetCertificates.draft'),
      active: t('vetCertificates.active'),
      revoked: t('vetCertificates.revoked'),
      expired: t('vetCertificates.expired'),
    }
    return <span className={map[status] || 'badge'}>{label[status] || status}</span>
  }

  const certTypeLabel = (type: string) =>
    t(`vetCertificates.certTypes.${type}` as any) || type.replace(/_/g, ' ')

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading && certificates.length === 0) {
    return (
      <div className="module-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      {/* ── Header ── */}
      <div className="module-header">
        <div>
          <h1>📜 {t('vetCertificates.title')}</h1>
          <p>{t('vetCertificates.subtitle')}</p>
        </div>
        {isVet && (
          <button className="module-btn primary" onClick={() => onNavigate('/doctor/certificates/new')}>
            + {t('vetCertificates.createNew')}
          </button>
        )}
      </div>

      {error && (
        <div className="module-alert error" style={{ marginBottom: 16 }}>
          {error}
          <button className="module-alert-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="module-card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div className="module-form-row">
          <div className="module-form-group">
            <label className="module-label">{t('vetCertificates.filterType')}</label>
            <select
              className="module-input"
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
            >
              <option value="">{t('vetCertificates.filterAll')}</option>
              {CERT_TYPES.map(ct => (
                <option key={ct} value={ct}>{certTypeLabel(ct)}</option>
              ))}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('vetCertificates.filterStatus')}</label>
            <select
              className="module-input"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            >
              <option value="">{t('vetCertificates.filterAll')}</option>
              <option value="draft">{t('vetCertificates.draft')}</option>
              <option value="active">{t('vetCertificates.active')}</option>
              <option value="revoked">{t('vetCertificates.revoked')}</option>
              <option value="expired">{t('vetCertificates.expired')}</option>
            </select>
          </div>
          {isFarmerOrAdmin && enterpriseOptions.length > 0 && (
            <div className="module-form-group">
              <label className="module-label">🏢 Enterprise</label>
              <select
                className="module-input"
                value={enterpriseFilter}
                onChange={e => { setEnterpriseFilter(e.target.value); setPage(0) }}
              >
                <option value="">{t('vetCertificates.filterAll')}</option>
                {enterpriseOptions.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
          {(isAdmin || isFarmerOrAdmin) && (
            <div className="module-form-group">
              <label className="module-label">{t('common.search')}</label>
              <input
                className="module-input"
                type="text"
                placeholder="Search by vet, owner, animal, cert #, Animal ID..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0) }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {certificates.length === 0 ? (
        <div className="module-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 32 }}>📜</p>
          <h3>{isVet ? t('vetCertificates.vetNoCertificates') : t('vetCertificates.noCertificates')}</h3>
          <p style={{ color: '#718096' }}>{isVet ? t('vetCertificates.vetNoCertificatesMsg') : t('vetCertificates.noCertificatesMsg')}</p>
          {isVet && (
            <button className="module-btn primary" onClick={() => onNavigate('/doctor/certificates/new')} style={{ marginTop: 12 }}>
              + {t('vetCertificates.createNew')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="data-table-container">
            <table className="module-table">
              <thead>
                <tr>
                  <th>{t('vetCertificates.certNumber')}</th>
                  <th>{t('vetCertificates.type')}</th>
                  <th>{t('vetCertificates.animal')}</th>
                  {isFarmerOrAdmin && <th>Enterprise</th>}
                  {(isAdmin || !isVet) && <th>{t('vetCertificates.vet')}</th>}
                  {(isAdmin || isVet) && <th>{t('vetCertificates.owner')}</th>}
                  <th>{t('vetCertificates.issuedDate')}</th>
                  <th>{t('vetCertificates.validUntil')}</th>
                  <th>{t('vetCertificates.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map(cert => (
                  <tr key={cert.id}>
                    <td>
                      <code style={{ fontSize: 11, background: '#f7fafc', padding: '2px 5px', borderRadius: 3 }}>
                        {cert.certificateNumber.startsWith('DRAFT') ? '—' : cert.certificateNumber}
                      </code>
                    </td>
                    <td style={{ fontSize: 12 }}>{certTypeLabel(cert.certificateType)}</td>
                    <td>
                      {cert.animalName || '—'}
                      {cert.animalSpecies && <div style={{ fontSize: 11, color: '#718096' }}>{cert.animalSpecies}</div>}
                      {cert.animalUniqueId && <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#4F46E5', background: '#EEF2FF', padding: '1px 5px', borderRadius: 4, display: 'inline-block', marginTop: 2 }}>{cert.animalUniqueId}</div>}
                    </td>
                    {isFarmerOrAdmin && (
                      <td style={{ fontSize: 12, color: cert.enterpriseName ? '#374151' : '#9ca3af' }}>
                        {cert.enterpriseName || '—'}
                      </td>
                    )}
                    {(isAdmin || !isVet) && (
                      <td style={{ fontSize: 12 }}>
                        {cert.vetFirstName || cert.vetLastName
                          ? `Dr. ${[cert.vetFirstName, cert.vetLastName].filter(Boolean).join(' ')}`
                          : '—'}
                      </td>
                    )}
                    {(isAdmin || isVet) && (
                      <td style={{ fontSize: 12 }}>
                        {[cert.ownerFirstName, cert.ownerLastName].filter(Boolean).join(' ') || '—'}
                      </td>
                    )}
                    <td style={{ fontSize: 12 }}>
                      {cert.issuedAt ? formatDate(cert.issuedAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {cert.validUntil ? formatDate(cert.validUntil) : '—'}
                    </td>
                    <td>{statusBadge(cert.status)}</td>
                    <td>
                      <div className="cert-actions">
                        {/* View / Print */}
                        <button
                          className="cert-action-btn view"
                          onClick={() => handlePrint(cert)}
                          disabled={loadingPrint === cert.id}
                          title={t('vetCertificates.printCertificate')}
                        >
                          {loadingPrint === cert.id
                            ? <span className="cert-action-spinner" />
                            : <>
                                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/>
                                  <circle cx="10" cy="10" r="2.5"/>
                                </svg>
                                <span>{t('vetCertificates.printCertificate')}</span>
                              </>
                          }
                        </button>

                        {/* Issue (vet + draft) */}
                        {isVet && cert.status === 'draft' && (
                          <button
                            className="cert-action-btn issue"
                            onClick={() => setIssueTarget(cert)}
                            title={t('vetCertificates.issueCertificate')}
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 10l4.5 4.5L16 6"/>
                            </svg>
                            <span>{t('vetCertificates.issueCertificate')}</span>
                          </button>
                        )}

                        {/* Edit (vet + draft) */}
                        {isVet && cert.status === 'draft' && (
                          <button
                            className="cert-action-btn edit"
                            onClick={() => onNavigate(`/doctor/certificates/new?edit=${cert.id}`)}
                            title={t('common.edit')}
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M13.5 3.5a2.12 2.12 0 013 3L6 17H3v-3L13.5 3.5z"/>
                            </svg>
                            <span>{t('common.edit')}</span>
                          </button>
                        )}

                        {/* Delete (vet + draft) */}
                        {isVet && cert.status === 'draft' && (
                          <button
                            className="cert-action-btn delete"
                            onClick={() => handleDelete(cert)}
                            title={t('common.delete')}
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M3 6h14M8 6V4h4v2M5 6l1 11h8l1-11"/>
                            </svg>
                            <span>{t('common.delete')}</span>
                          </button>
                        )}

                        {/* Revoke (vet/admin + active) */}
                        {(isVet || isAdmin) && cert.status === 'active' && (
                          <button
                            className="cert-action-btn revoke"
                            onClick={() => { setRevokeTarget(cert); setRevokeReason('') }}
                            title={t('vetCertificates.revoke')}
                          >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <circle cx="10" cy="10" r="8"/>
                              <path d="M7 7l6 6M13 7l-6 6"/>
                            </svg>
                            <span>{t('vetCertificates.revoke')}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                className="module-btn small"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ padding: '6px 12px', fontSize: 13, color: '#4a5568' }}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                className="module-btn small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 13, color: '#718096', marginTop: 10 }}>
            {t('vetCertificates.showing', { count: certificates.length, total })}
          </p>
        </>
      )}

      {/* ── Issue Confirmation Modal ── */}
      {issueTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9980, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setIssueTarget(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 10, padding: '28px 32px', maxWidth: 440, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px' }}>✅ {t('vetCertificates.issueCertificate')}</h3>
            <p style={{ color: '#4a5568', marginBottom: 20, fontSize: 14 }}>
              Issue <strong>{certTypeLabel(issueTarget.certificateType)}</strong> for <strong>{issueTarget.animalName || 'this animal'}</strong>?
              A certificate number will be auto-generated.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="module-btn" onClick={() => setIssueTarget(null)} disabled={issuing}>
                {t('common.cancel')}
              </button>
              <button className="module-btn primary" onClick={handleIssue} disabled={issuing}>
                {issuing ? t('common.saving') : `✓ ${t('vetCertificates.issue')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke Modal ── */}
      {revokeTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9980, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setRevokeTarget(null); setRevokeReason('') }}
        >
          <div
            style={{ background: '#fff', borderRadius: 10, padding: '28px 32px', maxWidth: 460, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', color: '#c53030' }}>🚫 {t('vetCertificates.revoke')}</h3>
            <p style={{ color: '#4a5568', marginBottom: 16, fontSize: 14 }}>
              {t('vetCertificates.confirmRevoke')}<br />
              <strong>{certTypeLabel(revokeTarget.certificateType)}</strong> — {revokeTarget.certificateNumber}
            </p>
            <div className="module-form-group">
              <label className="module-label">{t('vetCertificates.revokeReason')} *</label>
              <textarea
                className="module-input"
                rows={3}
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                placeholder="Enter reason for revocation..."
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="module-btn" onClick={() => { setRevokeTarget(null); setRevokeReason('') }} disabled={revoking}>
                {t('common.cancel')}
              </button>
              <button
                className="module-btn primary"
                onClick={handleRevoke}
                disabled={revoking || !revokeReason.trim()}
                style={{ background: '#e53e3e' }}
              >
                {revoking ? t('common.saving') : `🚫 ${t('vetCertificates.revoke')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print view ── */}
      {printData && printTemplate && (
        <CertificatePrintView
          certificate={printData}
          template={printTemplate}
          onClose={() => { setPrintData(null); setPrintTemplate(null) }}
        />
      )}
    </div>
  )
}

export default VetCertificates
