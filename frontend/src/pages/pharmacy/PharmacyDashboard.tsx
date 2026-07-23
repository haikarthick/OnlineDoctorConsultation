import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import client from '../../services/api/client'
import './PharmacyDashboard.css'

// Sub-components
import PharmacyInventory from './PharmacyInventory'
import PharmacySuppliers from './PharmacySuppliers'
import DispensingWorkflow from './DispensingWorkflow'
import PharmacySettings from './PharmacySettings'
import MedicationCatalog from './MedicationCatalog'
import DispensingHistory from './DispensingHistory'
import ReordersManagement from './ReordersManagement'
import MedicationTransfers from './MedicationTransfers'
import PrescriptionReviewModal from './PrescriptionReviewModal'
import DispensingModal from './DispensingModal'

interface Pharmacy {
  id: string
  pharmacy_name: string
  network_id: string
  hospital_id: string
  is_primary_pharmacy: boolean
  phone?: string
  email?: string
  address?: string
}

interface DashboardSummary {
  pending_reviews: number
  ready_to_dispense: number
  low_stock_count: number
  expiring_soon_count: number
  pending_reorders: number
  todays_dispensed: number
  todays_revenue: number
}

interface PendingPrescription {
  id: string
  pet_name: string
  owner_name: string
  vet_name: string
  medication_names: string
  medications?: any
  animal_species?: string
  created_at: string
  review_status: string
}

interface ReadyDispensing {
  id: string
  pet_name: string
  owner_name: string
  vet_name?: string
  medication_names: string
  medications?: any
  animal_species?: string
  target_pharmacy_id: string
  review_status: string
}

interface Analytics {
  total_revenue: number
  dispensing_count: number
  pending_reviews: number
  top_medications: { med_name: string; total_dispensed: number; total_revenue: number }[]
  low_stock_count: number
  expiring_count: number
}

const TABS = ['overview', 'review', 'dispense', 'inventory', 'catalog', 'suppliers', 'history', 'reorders', 'transfers', 'analytics', 'settings'] as const
type Tab = typeof TABS[number]

const TAB_ICONS: Record<Tab, string> = {
  overview: '🏠', review: '📋', dispense: '✅', inventory: '📦',
  catalog: '💊', suppliers: '🏭', history: '📜', reorders: '🔄', transfers: '🚚',
  analytics: '📊', settings: '⚙️'
}

export default function PharmacyDashboard() {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const { speciesLabel } = useMasterData()

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [pendingRx, setPendingRx] = useState<PendingPrescription[]>([])
  const [readyDispense, setReadyDispense] = useState<ReadyDispensing[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<PendingPrescription | null>(null)
  const [dispenseTarget, setDispenseTarget] = useState<ReadyDispensing | null>(null)
  const [networkId, setNetworkId] = useState<string | null>(null)
  const [analyticsDays, setAnalyticsDays] = useState(30)

  const loadPharmacies = useCallback(async () => {
    try {
      const res = await client.get('/pharmacy/my-pharmacies')
      const { data: list, networkId: nid } = res.data as { data: Pharmacy[]; networkId: string | null }
      setNetworkId(nid)
      setPharmacies(list || [])
      if (list && list.length > 0) {
        const primary = list.find(p => p.is_primary_pharmacy) || list[0]
        setSelectedPharmacy(prev => prev ?? primary)
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadDashboard = useCallback(async () => {
    if (!selectedPharmacy) return
    try {
      const [sumRes, rxRes, dispRes] = await Promise.all([
        client.get(`/pharmacies/${selectedPharmacy.id}/dashboard`),
        client.get(`/pharmacies/${selectedPharmacy.id}/pending-prescriptions`),
        client.get(`/pharmacies/${selectedPharmacy.id}/ready-for-dispensing`),
      ])
      setSummary(sumRes.data)
      setPendingRx(Array.isArray(rxRes.data) ? rxRes.data : [])
      setReadyDispense(Array.isArray(dispRes.data) ? dispRes.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    }
  }, [selectedPharmacy, t])

  const loadAnalytics = useCallback(async () => {
    if (!selectedPharmacy) return
    try {
      const res = await client.get(`/pharmacies/${selectedPharmacy.id}/analytics?days=${analyticsDays}`)
      setAnalytics(res.data)
    } catch { /* non-fatal */ }
  }, [selectedPharmacy, analyticsDays])

  useEffect(() => { loadPharmacies() }, [loadPharmacies])
  useEffect(() => { if (selectedPharmacy) loadDashboard() }, [selectedPharmacy, loadDashboard])
  useEffect(() => { if (tab === 'analytics' && selectedPharmacy) loadAnalytics() }, [tab, loadAnalytics])

  useAutoRefresh('pharmacy', useCallback(() => {
    if (selectedPharmacy && tab === 'overview') loadDashboard()
  }, [selectedPharmacy, tab, loadDashboard]), 30000)

  const handleReviewDone = () => { setReviewTarget(null); loadDashboard() }
  const handleDispenseDone = () => { setDispenseTarget(null); loadDashboard() }

  if (!loading && networkId === null) {
    return (
      <div className="pharmacy-page">
        <div className="pharmacy-empty si-a7bd6c2e">
          <div className="empty-icon">🔒</div>
          <p className="si-56e7c6ba">{t('pharmacy.noNetwork')}</p>
          <small className="si-40d2db53">{t('pharmacy.noNetworkHint')}</small>
        </div>
      </div>
    )
  }

  return (
    <div className="pharmacy-page">
      {/* Header */}
      <div className="pharmacy-header">
        <div>
          <h1>💊 {t('pharmacy.title')}</h1>
          <p>{selectedPharmacy?.pharmacy_name || t('pharmacy.selectPharmacy')}</p>
        </div>
        <div className="pharmacy-header-actions">
          {pharmacies.length > 1 && (
            <select
              className="pharmacy-select si-ef1e2ca0"
              value={selectedPharmacy?.id || ''}
              onChange={e => {
                const p = pharmacies.find(x => x.id === e.target.value)
                if (p) setSelectedPharmacy(p)
              }}
             
            >
              {pharmacies.map(p => (
                <option key={p.id} value={p.id} className="si-856e6b88">{p.pharmacy_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="pharm-error si-7e63ec4f">
          ⚠️ {error}
          <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="pharmacy-tabs">
        {TABS.map(tabId => (
          <button
            type="button"
            key={tabId}
            className={`pharmacy-tab${tab === tabId ? ' active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            <span className="si-a072da4e">{TAB_ICONS[tabId]}</span>
            {t(`pharmacy.tabs.${tabId}`)}
            {tabId === 'review' && (summary?.pending_reviews ?? 0) > 0 && (
              <span className="si-c466ace1">
                {summary?.pending_reviews}
              </span>
            )}
            {tabId === 'dispense' && (summary?.ready_to_dispense ?? 0) > 0 && (
              <span className="si-b3272c19">
                {summary?.ready_to_dispense}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <>
          {/* Stats tiles */}
          <div className="pharmacy-stats">
            <div className="pharmacy-stat-card warning si-3c1f81b9" onClick={() => setTab('review')}>
              <span className="stat-icon">📋</span>
              <span className="stat-value">{summary?.pending_reviews ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.pendingReviews')}</span>
            </div>
            <div className="pharmacy-stat-card success si-3c1f81b9" onClick={() => setTab('dispense')}>
              <span className="stat-icon">✅</span>
              <span className="stat-value">{summary?.ready_to_dispense ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.readyToDispense')}</span>
            </div>
            <div className="pharmacy-stat-card danger si-3c1f81b9" onClick={() => setTab('inventory')}>
              <span className="stat-icon">⚠️</span>
              <span className="stat-value">{summary?.low_stock_count ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.lowStock')}</span>
            </div>
            <div className="pharmacy-stat-card warning si-3c1f81b9" onClick={() => setTab('inventory')}>
              <span className="stat-icon">⏰</span>
              <span className="stat-value">{summary?.expiring_soon_count ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.expiringSoon')}</span>
            </div>
            <div className="pharmacy-stat-card info si-3c1f81b9" onClick={() => setTab('reorders')}>
              <span className="stat-icon">🔄</span>
              <span className="stat-value">{summary?.pending_reorders ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.pendingReorders')}</span>
            </div>
            <div className="pharmacy-stat-card primary">
              <span className="stat-icon">💰</span>
              <span className="stat-value">{formatCurrency(summary?.todays_revenue ?? 0)}</span>
              <span className="stat-label">{t('pharmacy.stats.todaysRevenue')}</span>
            </div>
          </div>

          {/* Pending Review Queue */}
          <div className="pharmacy-card">
            <div className="pharmacy-card-header">
              <h3>📋 {t('pharmacy.pendingReview')}</h3>
              <button type="button" className="module-btn small" onClick={() => setTab('review')}>{t('common.viewAll')}</button>
            </div>
            {loading ? (
              <p className="si-6a9f93ca">{t('common.loading')}</p>
            ) : pendingRx.length === 0 ? (
              <div className="pharmacy-empty si-8a6436c0">
                <p>✅ {t('pharmacy.noPendingReviews')}</p>
              </div>
            ) : (
              <div className="pharmacy-table-wrap">
                <table className="pharmacy-table">
                  <thead>
                    <tr>
                      <th>{t('pharmacy.table.patient')}</th>
                      <th>{t('pharmacy.table.owner')}</th>
                      <th>{t('pharmacy.table.vet')}</th>
                      <th>{t('pharmacy.table.medications')}</th>
                      <th>{t('pharmacy.table.date')}</th>
                      <th>{t('common.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRx.slice(0, 5).map(rx => (
                      <tr key={rx.id}>
                        <td>
                          <strong>{rx.pet_name || '—'}</strong>
                          {rx.animal_species && <small className="si-1a0c0bfa">{speciesLabel(rx.animal_species, t)}</small>}
                        </td>
                        <td>{rx.owner_name || '—'}</td>
                        <td>{rx.vet_name || '—'}</td>
                        <td className="si-cf8f70f1">{rx.medication_names || '—'}</td>
                        <td className="si-86931177">{rx.created_at ? new Date(rx.created_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <button type="button" className="module-btn small primary" onClick={() => setReviewTarget(rx)}>
                            {t('pharmacy.actions.review')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingRx.length > 5 && (
                  <div className="si-c0b3a91c">
                    <button type="button" className="module-btn small" onClick={() => setTab('review')}>
                      +{pendingRx.length - 5} more → {t('common.viewAll')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ready to Dispense */}
          <div className="pharmacy-card">
            <div className="pharmacy-card-header">
              <h3>✅ {t('pharmacy.readyToDispense')}</h3>
              <button type="button" className="module-btn small" onClick={() => setTab('dispense')}>{t('common.viewAll')}</button>
            </div>
            {readyDispense.length === 0 ? (
              <div className="pharmacy-empty si-8a6436c0">
                <p>{t('pharmacy.noReadyDispense')}</p>
              </div>
            ) : (
              <div className="pharmacy-table-wrap">
                <table className="pharmacy-table">
                  <thead>
                    <tr>
                      <th>{t('pharmacy.table.patient')}</th>
                      <th>{t('pharmacy.table.owner')}</th>
                      <th>{t('pharmacy.table.medications')}</th>
                      <th>{t('common.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readyDispense.slice(0, 5).map(rx => (
                      <tr key={rx.id}>
                        <td>
                          <strong>{rx.pet_name || '—'}</strong>
                          {rx.animal_species && <small className="si-1a0c0bfa">{speciesLabel(rx.animal_species, t)}</small>}
                        </td>
                        <td>{rx.owner_name || '—'}</td>
                        <td className="si-4a370a4e">{rx.medication_names || '—'}</td>
                        <td>
                          <button type="button" className="module-btn small primary" onClick={() => setDispenseTarget(rx)}>
                            {t('pharmacy.actions.dispense')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'review' && selectedPharmacy && (
        <DispensingWorkflow pharmacyId={selectedPharmacy.id} mode="review" onRefresh={loadDashboard} />
      )}

      {tab === 'dispense' && selectedPharmacy && (
        <DispensingWorkflow pharmacyId={selectedPharmacy.id} mode="dispense" onRefresh={loadDashboard} />
      )}

      {tab === 'inventory' && selectedPharmacy && (
        <PharmacyInventory pharmacyId={selectedPharmacy.id} networkId={networkId ?? ''} onRefresh={loadDashboard} />
      )}

      {tab === 'catalog' && networkId && selectedPharmacy && (
        <MedicationCatalog networkId={networkId} pharmacyId={selectedPharmacy.id} />
      )}

      {tab === 'suppliers' && (
        <PharmacySuppliers networkId={networkId ?? ''} />
      )}

      {tab === 'history' && selectedPharmacy && (
        <DispensingHistory pharmacyId={selectedPharmacy.id} />
      )}

      {tab === 'reorders' && selectedPharmacy && (
        <ReordersManagement pharmacyId={selectedPharmacy.id} networkId={networkId ?? ''} />
      )}

      {tab === 'transfers' && networkId && (
        <MedicationTransfers networkId={networkId} />
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && selectedPharmacy && (
        <div>
          <div className="pharmacy-card">
            <div className="pharmacy-card-header">
              <h3>📊 {t('pharmacy.analytics.title')}</h3>
              <select className="pharmacy-select" value={analyticsDays} onChange={e => setAnalyticsDays(parseInt(e.target.value))}>
                <option value={7}>7 {t('pharmacy.analytics.days')}</option>
                <option value={30}>30 {t('pharmacy.analytics.days')}</option>
                <option value={90}>90 {t('pharmacy.analytics.days')}</option>
              </select>
            </div>
            {!analytics ? (
              <p className="si-43f86130">{t('common.loading')}</p>
            ) : (
              <>
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <div className="value">{formatCurrency(analytics.total_revenue)}</div>
                    <div className="label">{t('pharmacy.analytics.totalRevenue')}</div>
                  </div>
                  <div className="analytics-card">
                    <div className="value">{analytics.dispensing_count}</div>
                    <div className="label">{t('pharmacy.analytics.dispensingCount')}</div>
                  </div>
                  <div className="analytics-card">
                    <div className="value" style={{ color: analytics.pending_reviews > 0 ? '#e65100' : '#2e7d32' }}>
                      {analytics.pending_reviews}
                    </div>
                    <div className="label">{t('pharmacy.analytics.pendingReviews')}</div>
                  </div>
                  <div className="analytics-card">
                    <div className="value" style={{ color: analytics.low_stock_count > 0 ? '#f57f17' : '#2e7d32' }}>
                      {analytics.low_stock_count}
                    </div>
                    <div className="label">{t('pharmacy.analytics.lowStock')}</div>
                  </div>
                  <div className="analytics-card">
                    <div className="value" style={{ color: analytics.expiring_count > 0 ? '#e65100' : '#2e7d32' }}>
                      {analytics.expiring_count}
                    </div>
                    <div className="label">{t('pharmacy.analytics.expiringSoon')}</div>
                  </div>
                </div>

                {analytics.top_medications?.length > 0 && (
                  <div className="si-138c678b">
                    <h4 className="si-fe789c18">
                      🏆 {t('pharmacy.analytics.topMedications')}
                    </h4>
                    <div className="si-977f8af1">
                      {analytics.top_medications.map((med, i) => {
                        const maxDispensed = analytics.top_medications[0]?.total_dispensed || 1
                        const pct = Math.round((med.total_dispensed / maxDispensed) * 100)
                        return (
                          <div key={i} className="si-98d3a741">
                            <span className="si-bed43d56">#{i + 1}</span>
                            <div className="si-6acd75e8">
                              <div className="si-50d7f990">
                                <strong>{med.med_name}</strong>
                                <span className="si-40d2db53">{med.total_dispensed} units · {formatCurrency(med.total_revenue)}</span>
                              </div>
                              <div className="si-9a7e25d0">
                                <div style={{ height: '100%', background: '#3949ab', borderRadius: 4, width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && selectedPharmacy && (
        <PharmacySettings pharmacy={selectedPharmacy} networkId={networkId ?? undefined} onRefresh={loadPharmacies} />
      )}

      {/* Modals */}
      {reviewTarget && (
        <PrescriptionReviewModal
          prescription={reviewTarget}
          pharmacyId={selectedPharmacy?.id || ''}
          onClose={() => setReviewTarget(null)}
          onDone={handleReviewDone}
        />
      )}
      {dispenseTarget && selectedPharmacy && (
        <DispensingModal
          prescription={dispenseTarget}
          pharmacyId={selectedPharmacy.id}
          onClose={() => setDispenseTarget(null)}
          onDone={handleDispenseDone}
        />
      )}
    </div>
  )
}
