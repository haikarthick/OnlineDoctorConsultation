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
        <div className="si-677dc8b7">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : (
        <div className="si-2a57fba0">
          {DOC_TYPES.map((docType) => {
            const version = activeVersionOf(docType)
            const stat = statFor(docType)
            return (
              <div key={docType} className="si-59aaa11e">
                <div>
                  <div className="si-f3347717">{t(`legalAdmin.docTypes.${docType}`)}</div>
                  <div className="si-c3b93ebb">
                    {version > 0
                      ? `${t('policy.version')} ${version}${stat ? ` · ${stat.acceptedUsers} ${t('legalAdmin.usersAccepted')}` : ''}`
                      : t('legalAdmin.notPublished')}
                  </div>
                </div>
                <div className="si-d223efb3">
                  <a className="btn btn-outline si-115b986f"
                     href={`/policies/${docType}`} target="_blank" rel="noopener noreferrer">
                    {t('legalAdmin.view')}
                  </a>
                  <button className="btn btn-primary si-efbe533c" onClick={() => startEdit(docType)}>
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
        <div className="si-9f028f26">
          <div className="si-914527c6">
            <h2 className="si-e57614ee">{t('legalAdmin.publishTitle')} — {t(`legalAdmin.docTypes.${editing.docType}`)}</h2>
            <p className="si-ea95bef1">{t('legalAdmin.publishHint')}</p>

            <label className="si-2262bb4a">{t('legalAdmin.docTitle')}</label>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="si-134b590c"
            />

            <label className="si-2262bb4a">{t('legalAdmin.docContent')}</label>
            <textarea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              className="si-771c4134"
            />

            <label className="si-8a93465c">
              <input
                type="checkbox"
                checked={editing.requiresReacceptance}
                onChange={(e) => setEditing({ ...editing, requiresReacceptance: e.target.checked })}
              />
              <span>{t('legalAdmin.requireReacceptance')}</span>
            </label>

            <div className="si-ad918842">
              <button className="btn btn-outline si-6acd75e8" onClick={() => setEditing(null)} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary si-6acd75e8" onClick={publish} disabled={saving || !editing.title.trim() || !editing.content.trim()}>
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
