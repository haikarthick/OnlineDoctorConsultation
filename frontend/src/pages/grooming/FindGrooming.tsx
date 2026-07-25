import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface Props { onNavigate: (path: string) => void }

const FindGrooming: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
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
      <p className="si-edc77e88">{t('groomingFind.subtitle')}</p>

      <div className="module-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="module-input" style={{ flex: '1 1 240px' }} placeholder={t('groomingFind.searchPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={mobileOnly} onChange={e => setMobileOnly(e.target.checked)} />
          <span>🚐 {t('groomingFind.mobileOnly')}</span>
        </label>
      </div>

      {err && <div className="module-alert error">{err}</div>}
      {loading ? <div className="loading-container"><div className="loading-spinner" /></div>
        : items.length === 0 ? <div className="empty-state"><div className="si-71a36f28">💈</div><h3>{t('groomingFind.none')}</h3><p>{t('groomingFind.noneHint')}</p></div>
          : (
            <>
              <p className="si-c3b93ebb">{t('groomingFind.count', { count: total })}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {items.map(p => (
                  <div key={p.id} className="module-card" style={{ cursor: 'pointer', transition: 'box-shadow .2s' }}
                    onClick={() => onNavigate(`/grooming/provider/${p.id}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,.12)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = ''}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 54, height: 54, borderRadius: 12, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💈</div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.businessName}</h3>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>⭐ {Number(p.rating || 0).toFixed(1)} · {p.totalReviews || 0}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.offersMobile && <span className="si-d9973be4">🚐 {t('groomingFind.mobile')}</span>}
                      {p.offersAtPremises && <span className="si-d9973be4">🏠 {t('groomingFind.atPremises')}</span>}
                    </div>
                    {p.priceFrom != null && <div style={{ marginTop: 10, fontWeight: 700 }}>{t('groomingFind.from')} {formatCurrency(Number(p.priceFrom))}</div>}
                    <button className="module-btn primary si-1e1fafbf" style={{ marginTop: 10, width: '100%' }}
                      onClick={e => { e.stopPropagation(); onNavigate(`/grooming/provider/${p.id}`) }}>
                      {t('groomingFind.viewBook')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
    </div>
  )
}

export default FindGrooming
