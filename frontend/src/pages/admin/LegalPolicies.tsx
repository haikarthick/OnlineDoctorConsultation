import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import '../../styles/modules.css'

const DOC_TYPES = ['terms', 'privacy', 'refund_policy', 'wallet_terms', 'doctor_agreement', 'grievance_policy', 'disclaimer']

interface LegalPoliciesProps {
  onNavigate?: (path: string) => void
}

/**
 * Admin → Payments & Finance → Legal & Policies (plan §10 item 8, §17).
 * Versioned policy manager: view versions, publish new version (immutable),
 * flag re-acceptance, and see acceptance coverage.
 */
const LegalPolicies: React.FC<LegalPoliciesProps> = () => {
  const { t } = useTranslation()
  const [docs, setDocs] = useState<any[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ docType: string; title: string; content: string; requiresReacceptance: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [docsResp, statsResp] = await Promise.all([
        apiService.adminListLegalDocuments(),
        apiService.adminGetAcceptanceStats(),
      ])
      setDocs(Array.isArray(docsResp?.data) ? docsResp.data : [])
      setStats(Array.isArray(statsResp?.data) ? statsResp.data : [])
    } catch { /* lists stay empty */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = useCallback(async (docType: string) => {
    setMessage('')
    try {
      const resp: any = await apiService.getLegalDocument(docType)
      const doc = resp?.data || resp
      setEditing({
        docType,
        title: doc?.title || docType,
        content: doc?.content || '',
        requiresReacceptance: false,
      })
    } catch {
      setEditing({ docType, title: docType, content: '', requiresReacceptance: false })
    }
  }, [])

  const publish = useCallback(async () => {
    if (!editing || !editing.title.trim() || !editing.content.trim()) return
    try {
      setSaving(true)
      await apiService.adminPublishLegalDocument({
        docType: editing.docType,
        title: editing.title.trim(),
        content: editing.content,
        requiresReacceptance: editing.requiresReacceptance,
      })
      setMessage(t('legalAdmin.published'))
      setEditing(null)
      await load()
    } catch (err: any) {
      setMessage(err.response?.data?.error?.message || err.response?.data?.error || t('legalAdmin.publishFailed'))
    } finally {
      setSaving(false)
    }
  }, [editing, load, t])

  const activeVersionOf = (docType: string) => {
    const versions = docs.filter((d) => d.docType === docType && d.isActive)
    return versions.length > 0 ? Math.max(...versions.map((d) => d.version)) : 0
  }
  const statFor = (docType: string) => stats.find((s) => s.docType === docType)

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('legalAdmin.title')}</h1>
          <p className="page-subtitle">{t('legalAdmin.subtitle')}</p>
        </div>
      </div>

      {message && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {DOC_TYPES.map((docType) => {
            const version = activeVersionOf(docType)
            const stat = statFor(docType)
            return (
              <div key={docType} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t(`legalAdmin.docTypes.${docType}`)}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    {version > 0
                      ? `${t('policy.version')} ${version}${stat ? ` · ${stat.acceptedUsers} ${t('legalAdmin.usersAccepted')}` : ''}`
                      : t('legalAdmin.notPublished')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13, textDecoration: 'none' }}
                     href={`/policies/${docType}`} target="_blank" rel="noopener noreferrer">
                    {t('legalAdmin.view')}
                  </a>
                  <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => startEdit(docType)}>
                    {t('legalAdmin.newVersion')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Publish new version modal */}
      {editing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 720, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
            <h2 style={{ marginBottom: 4 }}>{t('legalAdmin.publishTitle')} — {t(`legalAdmin.docTypes.${editing.docType}`)}</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>{t('legalAdmin.publishHint')}</p>

            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('legalAdmin.docTitle')}</label>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}
            />

            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('legalAdmin.docContent')}</label>
            <textarea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', minHeight: 240, flex: 1, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={editing.requiresReacceptance}
                onChange={(e) => setEditing({ ...editing, requiresReacceptance: e.target.checked })}
              />
              <span>{t('legalAdmin.requireReacceptance')}</span>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditing(null)} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={publish} disabled={saving || !editing.title.trim() || !editing.content.trim()}>
                {saving ? t('common.loading') : t('legalAdmin.publishButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LegalPolicies
