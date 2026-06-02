import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import axios from 'axios'
import './PharmacyDashboard.css'

// ── Sub-components ──────────────────────────────────────────────
import PharmacyInventory from './PharmacyInventory'
import PharmacySuppliers from './PharmacySuppliers'
import DispensingWorkflow from './DispensingWorkflow'
import PharmacySettings from './PharmacySettings'
import PrescriptionReviewModal from './PrescriptionReviewModal'
import DispensingModal from './DispensingModal'

interface Pharmacy {
  id: string
  pharmacy_name: string
  network_id: string
  hospital_id: string
  is_primary_pharmacy: boolean
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
  created_at: string
  review_status: string
}

interface ReadyDispensing {
  id: string
  pet_name: string
  owner_name: string
  medication_names: string
  target_pharmacy_id: string
  review_status: string
}

const TABS = ['overview', 'review', 'dispense', 'inventory', 'suppliers', 'settings'] as const
type Tab = typeof TABS[number]

export default function PharmacyDashboard() {
  const { t } = useTranslation()

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [pendingRx, setPendingRx] = useState<PendingPrescription[]>([])
  const [readyDispense, setReadyDispense] = useState<ReadyDispensing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<PendingPrescription | null>(null)
  const [dispenseTarget, setDispenseTarget] = useState<ReadyDispensing | null>(null)

  const [networkId, setNetworkId] = useState<string | null>(null)

  const loadPharmacies = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/pharmacy/my-pharmacies')
      const { data: list, networkId: nid } = res.data as { data: Pharmacy[]; networkId: string | null }
      setNetworkId(nid)
      setPharmacies(list || [])
      if (list && list.length > 0) {
        const primary = list.find(p => p.is_primary_pharmacy) || list[0]
        setSelectedPharmacy(prev => prev ?? primary)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadDashboard = useCallback(async () => {
    if (!selectedPharmacy) return
    try {
      const [sumRes, rxRes, dispRes] = await Promise.all([
        axios.get(`/api/v1/pharmacies/${selectedPharmacy.id}/dashboard-summary`),
        axios.get(`/api/v1/pharmacies/${selectedPharmacy.id}/pending-prescriptions`),
        axios.get(`/api/v1/pharmacies/${selectedPharmacy.id}/ready-for-dispensing`),
      ])
      setSummary(sumRes.data)
      setPendingRx(rxRes.data || [])
      setReadyDispense(dispRes.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('common.error'))
    }
  }, [selectedPharmacy, t])

  useEffect(() => { loadPharmacies() }, [])
  useEffect(() => { if (selectedPharmacy) loadDashboard() }, [selectedPharmacy, loadDashboard])

  // Auto-refresh every 30 seconds
  useAutoRefresh('pharmacy', () => {
    if (selectedPharmacy && tab === 'overview') loadDashboard()
  }, 30000)

  const handleReviewDone = () => {
    setReviewTarget(null)
    loadDashboard()
  }
  const handleDispenseDone = () => {
    setDispenseTarget(null)
    loadDashboard()
  }

  if (!loading && networkId === null) {
    return (
      <div className="pharmacy-page">
        <div className="pharmacy-empty">
          <div className="empty-icon">🔒</div>
          <p>{t('pharmacy.noNetwork')}</p>
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
              className="pharmacy-select"
              value={selectedPharmacy?.id || ''}
              onChange={e => {
                const p = pharmacies.find(x => x.id === e.target.value)
                if (p) setSelectedPharmacy(p)
              }}
            >
              {pharmacies.map(p => (
                <option key={p.id} value={p.id}>{p.pharmacy_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && <div className="pharm-error">⚠️ {error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}

      {/* Tabs */}
      <div className="pharmacy-tabs">
        {TABS.map(tabId => (
          <button
            key={tabId}
            className={`pharmacy-tab${tab === tabId ? ' active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            {t(`pharmacy.tabs.${tabId}`)}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <>
          {/* Stats tiles */}
          <div className="pharmacy-stats">
            <div className="pharmacy-stat-card warning">
              <span className="stat-icon">📋</span>
              <span className="stat-value">{summary?.pending_reviews ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.pendingReviews')}</span>
            </div>
            <div className="pharmacy-stat-card success">
              <span className="stat-icon">✅</span>
              <span className="stat-value">{summary?.ready_to_dispense ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.readyToDispense')}</span>
            </div>
            <div className="pharmacy-stat-card danger">
              <span className="stat-icon">⚠️</span>
              <span className="stat-value">{summary?.low_stock_count ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.lowStock')}</span>
            </div>
            <div className="pharmacy-stat-card warning">
              <span className="stat-icon">⏰</span>
              <span className="stat-value">{summary?.expiring_soon_count ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.expiringSoon')}</span>
            </div>
            <div className="pharmacy-stat-card info">
              <span className="stat-icon">🔄</span>
              <span className="stat-value">{summary?.pending_reorders ?? '—'}</span>
              <span className="stat-label">{t('pharmacy.stats.pendingReorders')}</span>
            </div>
            <div className="pharmacy-stat-card primary">
              <span className="stat-icon">💰</span>
              <span className="stat-value">₹{(summary?.todays_revenue ?? 0).toLocaleString()}</span>
              <span className="stat-label">{t('pharmacy.stats.todaysRevenue')}</span>
            </div>
          </div>

          {/* Pending Review Queue */}
          <div className="pharmacy-card">
            <div className="pharmacy-card-header">
              <h3>📋 {t('pharmacy.pendingReview')}</h3>
              <button className="module-btn small" onClick={() => setTab('review')}>{t('common.viewAll')}</button>
            </div>
            {loading ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>{t('common.loading')}</p>
            ) : pendingRx.length === 0 ? (
              <div className="pharmacy-empty"><p>{t('pharmacy.noPendingReviews')}</p></div>
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
                        <td>{rx.pet_name || '—'}</td>
                        <td>{rx.owner_name || '—'}</td>
                        <td>{rx.vet_name || '—'}</td>
                        <td style={{ maxWidth: 180 }}>{rx.medication_names || '—'}</td>
                        <td>{new Date(rx.created_at).toLocaleDateString()}</td>
                        <td>
                          <button className="module-btn small primary" onClick={() => setReviewTarget(rx)}>
                            {t('pharmacy.actions.review')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ready to Dispense */}
          <div className="pharmacy-card">
            <div className="pharmacy-card-header">
              <h3>✅ {t('pharmacy.readyToDispense')}</h3>
              <button className="module-btn small" onClick={() => setTab('dispense')}>{t('common.viewAll')}</button>
            </div>
            {readyDispense.length === 0 ? (
              <div className="pharmacy-empty"><p>{t('pharmacy.noReadyDispense')}</p></div>
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
                        <td>{rx.pet_name || '—'}</td>
                        <td>{rx.owner_name || '—'}</td>
                        <td style={{ maxWidth: 200 }}>{rx.medication_names || '—'}</td>
                        <td>
                          <button className="module-btn small primary" onClick={() => setDispenseTarget(rx)}>
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
        <DispensingWorkflow
          pharmacyId={selectedPharmacy.id}
          mode="review"
          onRefresh={loadDashboard}
        />
      )}

      {tab === 'dispense' && selectedPharmacy && (
        <DispensingWorkflow
          pharmacyId={selectedPharmacy.id}
          mode="dispense"
          onRefresh={loadDashboard}
        />
      )}

      {tab === 'inventory' && selectedPharmacy && (
        <PharmacyInventory
          pharmacyId={selectedPharmacy.id}
          networkId={networkId ?? ''}
          onRefresh={loadDashboard}
        />
      )}

      {tab === 'suppliers' && (
        <PharmacySuppliers networkId={networkId ?? ''} />
      )}

      {tab === 'settings' && selectedPharmacy && (
        <PharmacySettings
          pharmacy={selectedPharmacy}
          networkId={networkId ?? undefined}
          onRefresh={loadPharmacies}
        />
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
