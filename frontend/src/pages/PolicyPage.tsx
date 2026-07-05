import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import apiService from '../services/api'

/**
 * Public policy page (docs/PAYMENT_MODULE_PLAN.md §17.1) — renders the active
 * version of a legal document. Linked from registration, checkout, footers,
 * and required to be live for Razorpay merchant KYC.
 */
export default function PolicyPage() {
  const { docType } = useParams<{ docType: string }>()
  const { t } = useTranslation()
  const [doc, setDoc] = useState<any>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!docType) return
    setLoading(true)
    setError(false)
    apiService.getLegalDocument(docType)
      .then((resp: any) => setDoc(resp?.data || resp))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [docType])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
        <Link to="/" style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>
          ← {t('policy.backToHome')}
        </Link>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>{t('common.loading')}</div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <h2>{t('policy.notFoundTitle')}</h2>
            <p style={{ color: '#6b7280' }}>{t('policy.notFoundMessage')}</p>
          </div>
        )}

        {doc && !loading && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '32px 28px', marginTop: 20 }}>
            <h1 style={{ marginBottom: 4 }}>{doc.title}</h1>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24 }}>
              {t('policy.version')} {doc.version} · {t('policy.effectiveFrom')}{' '}
              {doc.effectiveFrom ? new Date(doc.effectiveFrom).toLocaleDateString() : '—'}
            </p>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#374151', fontSize: 15, overflowWrap: 'break-word' }}>
              {doc.content}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
