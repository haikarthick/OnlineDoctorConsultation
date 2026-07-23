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
    <div className="si-eedc6ede">
      <div className="si-be241fff">
        <Link to="/" className="si-bc0ad2ea">
          ← {t('policy.backToHome')}
        </Link>

        {loading && (
          <div className="si-3086e186">{t('common.loading')}</div>
        )}

        {error && !loading && (
          <div className="si-c3a5d0e8">
            <h2>{t('policy.notFoundTitle')}</h2>
            <p className="si-23033f05">{t('policy.notFoundMessage')}</p>
          </div>
        )}

        {doc && !loading && (
          <div className="si-d4e81483">
            <h1 className="si-e57614ee">{doc.title}</h1>
            <p className="si-bc7c0248">
              {t('policy.version')} {doc.version} · {t('policy.effectiveFrom')}{' '}
              {doc.effectiveFrom ? new Date(doc.effectiveFrom).toLocaleDateString() : '—'}
            </p>
            <div className="si-3fcc6b1f">
              {doc.content}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
