import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import { usePermission } from '../../context/PermissionContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

const FindGrooming: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const { hasPermission } = usePermission()
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [mobileOnly, setMobileOnly] = useState(false)

  useEffect(() => { const tmr = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(tmr) }, [search])

  const load = useCallback(async () => {
    try {
      setLoading(true); setErr('')
      const res = await apiService.discoverGroomingProviders({ search: debounced || undefined, mobile: mobileOnly ? 'true' : undefined })
      setItems(res.data?.providers || [])
      setTotal(res.data?.total || 0)
    } catch (e: any) { setErr(e?.response?.data?.message || e.message) } finally { setLoading(false) }
  }, [debounced, mobileOnly])
  useEffect(() => { load() }, [load])

  return (
    <div className="module-page">
      <div className="module-header"><h1>💈 {t('groomingFind.title')}</h1></div>
      <p className="page-subtitle">{t('groomingFind.subtitle')}</p>

      <div className="module-card search-filter-bar">
        <input className="module-input search-input" placeholder={t('groomingFind.searchPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)} />
        <label className="filter-checkbox">
          <input type="checkbox" checked={mobileOnly} onChange={e => setMobileOnly(e.target.checked)} />
          <span>🚐 {t('groomingFind.mobileOnly')}</span>
        </label>
      </div>

      {err && <div className="module-alert error">{err}</div>}
      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💈</div>
            <h3>{t('groomingFind.none')}</h3>
            <p>{t('groomingFind.noneHint')}</p>
          </div>
        ) : (
          <>
            <p className="result-count">{t('groomingFind.count', { count: total })}</p>
            {/* Same grid the doctor search uses, so the two discovery journeys match. */}
            <div className="vet-grid">
              {items.map(p => (
                <div key={p.id} className="module-card provider-card"
                  onClick={() => onNavigate(`/grooming/provider/${p.id}`)}>
                  <div className="provider-card-head">
                    <div className="provider-avatar" aria-hidden="true">💈</div>
                    <div className="provider-card-identity">
                      <h3 className="provider-card-name">{p.businessName}</h3>
                      <div className="provider-card-rating">
                        ⭐ {Number(p.rating || 0).toFixed(1)} · {p.totalReviews || 0}
                      </div>
                    </div>
                  </div>
                  <div className="provider-card-tags">
                    {p.offersMobile && <span className="module-badge">🚐 {t('groomingFind.mobile')}</span>}
                    {p.offersAtPremises && <span className="module-badge">🏠 {t('groomingFind.atPremises')}</span>}
                  </div>
                  {p.priceFrom != null && (
                    <div className="provider-card-price">
                      {t('groomingFind.from')} {formatCurrency(Number(p.priceFrom))}
                    </div>
                  )}
                  <button className="module-btn primary provider-card-cta"
                    onClick={e => { e.stopPropagation(); onNavigate(`/grooming/provider/${p.id}`) }}>
                    {t('groomingFind.viewBook')}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

      {/* Supply-side entry point: the marketplace only works if groomers can find their way in.
          Hidden for users who already run a business (they have the console instead). */}
      {!hasPermission('grooming_provider_console') && (
        <div className="module-card cta-banner">
          <div className="cta-banner-copy">
            <h3>🏪 {t('groomingFind.ownerCtaTitle')}</h3>
            <p>{t('groomingFind.ownerCtaDesc')}</p>
          </div>
          <button className="module-btn primary" onClick={() => onNavigate('/grooming/provider')}>
            {t('groomingFind.ownerCtaBtn')}
          </button>
        </div>
      )}
    </div>
  )
}

export default FindGrooming
