import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSettings } from '../../context/SettingsContext'
import '../../styles/modules.css'

interface FinanceReportsProps {
  onNavigate?: (path: string) => void
}

/**
 * Admin → Payments & Finance → Finance Reports (plan §11).
 * Revenue overview, settlement + wallet liabilities, TDS register, payment health.
 */
const FinanceReports: React.FC<FinanceReportsProps> = () => {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp: any = await apiService.adminFinanceOverview(from, to)
      setData(resp?.data || null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const exportGstCsv = async () => {
    try {
      setExporting(true)
      setExportError('')
      const csv = await apiService.adminDownloadGstExport(from, to)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gst-export-${from}-to-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setExportError(err?.response?.data?.error?.message || err?.message || t('financeAdmin.gstExportFailed'))
    } finally {
      setExporting(false)
    }
  }

  const tile = (label: string, value: string, color: string, hint?: string) => (
    <div className="si-73701409">
      <div className="si-c3b93ebb">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {hint && <div className="si-a5de6cea">{hint}</div>}
    </div>
  )

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>{t('financeAdmin.title')}</h1>
          <p className="page-subtitle">{t('financeAdmin.subtitle')}</p>
        </div>
        <div className="page-header-actions si-bab2d193">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="si-676bd163" />
          <span>→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="si-676bd163" />
          <button className="btn btn-outline btn-sm" disabled={exporting} onClick={exportGstCsv}>
            {exporting ? t('common.loading') : t('financeAdmin.exportGst')}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="si-a1036ec3">
          {exportError}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /><p>{t('common.loading')}</p></div>
      ) : !data ? (
        <div className="si-8fce2994">{t('financeAdmin.noData')}</div>
      ) : (
        <>
          <h2 className="si-229a75d2">{t('financeAdmin.revenueTitle')}</h2>
          <div className="si-2f255410">
            {tile(t('financeAdmin.gmv'), formatCurrency(data.revenue.gmv), '#111827', t('financeAdmin.paidCount', { count: data.revenue.paidCount }))}
            {tile(t('financeAdmin.commission'), formatCurrency(data.revenue.commissionEarned), '#15803d')}
            {tile(t('financeAdmin.processingCharges'), formatCurrency(data.revenue.processingCharges), '#15803d')}
            {tile(t('financeAdmin.gatewayFees'), `− ${formatCurrency(data.revenue.gatewayFees)}`, '#b45309')}
            {tile(t('financeAdmin.refundsOut'), formatCurrency(data.revenue.refundsOut), '#1d4ed8')}
            {tile(t('financeAdmin.netRevenue'), formatCurrency(data.revenue.netPlatformRevenue), data.revenue.netPlatformRevenue >= 0 ? '#15803d' : '#dc2626', t('financeAdmin.netRevenueHint'))}
          </div>

          <h2 className="si-229a75d2">{t('financeAdmin.pharmacyRevenueTitle')}</h2>
          <div className="si-2f255410">
            {tile(t('financeAdmin.pharmacyCollected'), formatCurrency(data.pharmacyRevenue.collected), '#15803d', t('financeAdmin.paidCount', { count: data.pharmacyRevenue.dispensedCount }))}
            {tile(t('financeAdmin.pharmacyPending'), formatCurrency(data.pharmacyRevenue.pendingAmount), '#b45309', t('financeAdmin.paidCount', { count: data.pharmacyRevenue.pendingCount }))}
          </div>

          <h2 className="si-229a75d2">{t('financeAdmin.liabilitiesTitle')}</h2>
          <div className="si-2f255410">
            {tile(t('financeAdmin.doctorClearing'), formatCurrency(data.settlementLiability.clearing), '#b45309')}
            {tile(t('financeAdmin.doctorAvailable'), formatCurrency(data.settlementLiability.available), data.settlementLiability.available < 0 ? '#dc2626' : '#6d28d9')}
            {tile(t('financeAdmin.doctorLocked'), formatCurrency(data.settlementLiability.locked), '#6d28d9')}
            {tile(t('financeAdmin.walletLiability'), formatCurrency(data.walletLiability.total), '#1d4ed8', t('financeAdmin.walletLiabilityHint'))}
          </div>

          <h2 className="si-229a75d2">{t('financeAdmin.tdsTitle')}</h2>
          <div className="si-2f255410">
            {tile(t('financeAdmin.tdsDeducted'), formatCurrency(data.tds.totalDeducted), '#111827', t('financeAdmin.tdsCount', { count: data.tds.settledCount }))}
            {tile(t('financeAdmin.netPaidToDoctors'), formatCurrency(data.tds.netPaidTotal), '#15803d')}
          </div>

          <h2 className="si-229a75d2">{t('financeAdmin.healthTitle')}</h2>
          <div className="si-b3a5ea3d">
            {tile(t('financeAdmin.stuckPending'), String(data.health.stuckPending), data.health.stuckPending > 0 ? '#dc2626' : '#15803d', t('financeAdmin.stuckPendingHint'))}
            {tile(t('financeAdmin.openHolds'), String(data.health.openHolds), '#6b7280')}
          </div>
        </>
      )}
    </div>
  )
}

export default FinanceReports
