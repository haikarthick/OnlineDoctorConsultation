import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
import PharmacyAlerts from './PharmacyAlerts'
import PrescriptionReviewModal from './PrescriptionReviewModal'
import DispensingModal from './DispensingModal'
import PharmacyCreateModal from './PharmacyCreateModal'
import PharmacyOverviewTab from './PharmacyOverviewTab'
import PharmacyAnalyticsTab from './PharmacyAnalyticsTab'
import type { Pharmacy, DashboardSummary, PendingPrescription, ReadyDispensing, Analytics, NetworkPharmacyRow } from './pharmacyDashboardShared'

const TABS =['overview', 'review', 'dispense', 'inventory', 'alerts', 'catalog', 'suppliers', 'history', 'reorders', 'transfers', 'analytics', 'settings'] as const
type Tab = typeof TABS[number]

const TAB_ICONS: Record<Tab, string> = {
  overview: '🏠', review: '📋', dispense: '✅', inventory: '📦', alerts: '🔔',
  catalog: '💊', suppliers: '🏭', history: '📜', reorders: '🔄', transfers: '🚚',
  analytics: '📊', settings: '⚙️'
}

export default function PharmacyDashboard() {
  const { t } = useTranslation()

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [pendingRx, setPendingRx] = useState<PendingPrescription[]>([])
  const [readyDispense, setReadyDispense] = useState<ReadyDispensing[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [networkReport, setNetworkReport] = useState<{ period_days: number; pharmacies: NetworkPharmacyRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<PendingPrescription | null>(null)
  const [dispenseTarget, setDispenseTarget] = useState<ReadyDispensing | null>(null)
  const [networkId, setNetworkId] = useState<string | null>(null)
  // Why the pharmacy list is empty: 'not_in_network' | 'no_pharmacy_in_network' | 'ok'.
  // The screen previously showed the same dead end for both causes.
  const [emptyReason, setEmptyReason] = useState<string>('')
  const [canCreate, setCanCreate] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [analyticsDays, setAnalyticsDays] = useState(30)

  const loadPharmacies = useCallback(async () => {
    try {
      const res = await client.get('/pharmacy/my-pharmacies')
      const { data: list, networkId: nid, reason, canCreate: mayCreate } =
        res.data as { data: Pharmacy[]; networkId: string | null; reason?: string; canCreate?: boolean }
      setNetworkId(nid)
      setEmptyReason(reason || '')
      setCanCreate(!!mayCreate)
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

  // Network-wide comparison across every pharmacy in the network. The endpoint
  // existed with no caller, so a network operator could only ever see one
  // pharmacy at a time and had no way to compare them.
  const loadNetworkReports = useCallback(async () => {
    if (!networkId) return
    try {
      const res = await client.get(`/networks/${networkId}/pharmacy-reports?days=${analyticsDays}`)
      setNetworkReport(res.data)
    } catch { /* non-fatal - requires network membership */ }
  }, [networkId, analyticsDays])

  useEffect(() => { loadPharmacies() }, [loadPharmacies])
  useEffect(() => { if (selectedPharmacy) loadDashboard() }, [selectedPharmacy, loadDashboard])
  useEffect(() => { if (tab === 'analytics' && selectedPharmacy) loadAnalytics() }, [tab, loadAnalytics])
  useEffect(() => { if (tab === 'analytics' && networkId) loadNetworkReports() }, [tab, networkId, loadNetworkReports])

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
          {pharmacies.length > 0 && (
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

      {/* Nothing to select, and previously no explanation either - the header just said
          "Select a pharmacy" beside a control that only renders when one already exists. */}
      {!loading && pharmacies.length === 0 && (
        <div className="pharm-empty-state">
          <div className="pharm-empty-icon" aria-hidden="true">💊</div>
          <h2>{t('pharmacy.empty.title')}</h2>
          <p>
            {emptyReason === 'not_in_network'
              ? t('pharmacy.empty.notInNetwork')
              : t('pharmacy.empty.noPharmacy')}
          </p>
          {canCreate && emptyReason === 'no_pharmacy_in_network' && (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              ➕ {t('pharmacy.empty.createCta')}
            </button>
          )}
          {!canCreate && (
            <p className="pharm-empty-hint">{t('pharmacy.empty.askAdmin')}</p>
          )}
        </div>
      )}

      {showCreate && networkId && (
        <PharmacyCreateModal
          networkId={networkId}
          onClose={() => setShowCreate(false)}
          onCreated={loadPharmacies}
          onError={setError}
        />
      )}

      {error && (
        <div className="pharm-error si-7e63ec4f">
          ⚠️ {error}
          <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button>
        </div>
      )}

      {/* Tabs are pointless without a pharmacy: every loader short-circuits on
          `if (!selectedPharmacy) return`, so they rendered as clickable buttons that silently
          did nothing. Hidden until there is something to show. */}
      {pharmacies.length > 0 && (
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
      )}

      {tab === 'overview' && (
        <PharmacyOverviewTab
          summary={summary}
          pendingRx={pendingRx}
          readyDispense={readyDispense}
          loading={loading}
          onTabChange={setTab}
          onReview={setReviewTarget}
          onDispense={setDispenseTarget}
        />
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

      {tab === 'alerts' && selectedPharmacy && (
        <PharmacyAlerts pharmacyId={selectedPharmacy.id} />
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

      {tab === 'analytics' && selectedPharmacy && (
        <PharmacyAnalyticsTab
          selectedPharmacyId={selectedPharmacy.id}
          analytics={analytics}
          networkReport={networkReport}
          analyticsDays={analyticsDays}
          onDaysChange={setAnalyticsDays}
        />
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
