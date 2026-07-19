import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'

/**
 * Blocking re-acceptance modal (docs/PAYMENT_MODULE_PLAN.md §17.3).
 * Shown when the admin publishes a policy version flagged
 * requires_reacceptance that this user hasn't accepted yet.
 */
export default function PendingPolicyModal() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const [pending, setPending] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { setPending([]); return }
    apiService.getPendingPolicyAcceptances()
      .then((resp: any) => {
        const list = resp?.data || []
        setPending(Array.isArray(list) ? list : [])
      })
      .catch(() => setPending([]))
  }, [isAuthenticated])

  const toggleExpand = useCallback(async (docType: string) => {
    if (expanded === docType) { setExpanded(null); return }
    setExpanded(docType)
    if (!contents[docType]) {
      try {
        const resp: any = await apiService.getLegalDocument(docType)
        const doc = resp?.data || resp
        setContents((prev) => ({ ...prev, [docType]: doc?.content || '' }))
      } catch { /* content stays hidden; user can still open /policies page */ }
    }
  }, [expanded, contents])

  const handleAccept = useCallback(async () => {
    try {
      setSubmitting(true)
      await apiService.acceptPolicies(pending.map((p) => p.docType), 'login_reacceptance')
      setPending([])
    } catch { /* keep the modal; user can retry */ } finally {
      setSubmitting(false)
    }
  }, [pending])

  if (!isAuthenticated || pending.length === 0) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: 'white', borderRadius: 14, maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 24px 12px' }}>
          <h2 style={{ marginBottom: 6 }}>{t('policyModal.title')}</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>{t('policyModal.message')}</p>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 24px', flex: 1 }}>
          {pending.map((p) => (
            <div key={p.docType} style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 10 }}>
              <button
                onClick={() => toggleExpand(p.docType)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none',
                  border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.title}</span>
                <span style={{ color: '#9ca3af' }}>{expanded === p.docType ? '▲' : '▼'}</span>
              </button>
              {expanded === p.docType && (
                <div style={{ padding: '0 14px 14px', maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                  {contents[p.docType] || t('common.loading')}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 24px 24px', borderTop: '1px solid #f1f5f9' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>{t('policyModal.agreeCheckbox')}</span>
          </label>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!agreed || submitting}
            onClick={handleAccept}
          >
            {submitting ? t('common.loading') : t('policyModal.agreeButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
