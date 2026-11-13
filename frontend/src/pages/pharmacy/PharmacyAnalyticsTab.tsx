import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import type { Analytics, NetworkPharmacyRow } from './pharmacyDashboardShared'

export default function PharmacyAnalyticsTab({
  selectedPharmacyId,
  analytics,
  networkReport,
  analyticsDays,
  onDaysChange,
}: {
  selectedPharmacyId: string
  analytics: Analytics | null
  networkReport: { period_days: number; pharmacies: NetworkPharmacyRow[] } | null
  analyticsDays: number
  onDaysChange: (days: number) => void
}) {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>📊 {t('pharmacy.analytics.title')}</h3>
          <select className="pharmacy-select" value={analyticsDays} onChange={e => onDaysChange(parseInt(e.target.value))}>
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
                <div className={`value ${analytics.pending_reviews > 0 ? 'analytics-value-pending-warn' : 'analytics-value-ok'}`}>
                  {analytics.pending_reviews}
                </div>
                <div className="label">{t('pharmacy.analytics.pendingReviews')}</div>
              </div>
              <div className="analytics-card">
                <div className={`value ${analytics.low_stock_count > 0 ? 'analytics-value-stock-warn' : 'analytics-value-ok'}`}>
                  {analytics.low_stock_count}
                </div>
                <div className="label">{t('pharmacy.analytics.lowStock')}</div>
              </div>
              <div className="analytics-card">
                <div className={`value ${analytics.expiring_count > 0 ? 'analytics-value-expiring-warn' : 'analytics-value-ok'}`}>
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
                            {/* eslint-disable-next-line react/forbid-dom-props -- runtime-computed bar width */}
                            <div className="top-medication-bar-fill" style={{ ['--fill' as string]: `${pct}%` }} />
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

      {/* Network-wide comparison. Every other view on this page is scoped to
          the one selected pharmacy; this is the only place a network
          operator can see them side by side. */}
      {networkReport && networkReport.pharmacies?.length > 0 && (
        <div className="pharmacy-card">
          <div className="pharmacy-card-header">
            <h3>🌐 {t('pharmacy.analytics.networkTitle')}</h3>
          </div>
          <div className="table-scroll">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.analytics.pharmacy')}</th>
                  <th>{t('pharmacy.analytics.revenue')}</th>
                  <th>{t('pharmacy.analytics.dispensings')}</th>
                </tr>
              </thead>
              <tbody>
                {networkReport.pharmacies.map(p => (
                  <tr key={p.pharmacy_id} className={p.pharmacy_id === selectedPharmacyId ? 'is-current' : undefined}>
                    <td>
                      {p.pharmacy_name}
                      {p.pharmacy_id === selectedPharmacyId && ` - ${t('pharmacy.analytics.thisPharmacy')}`}
                    </td>
                    <td>{formatCurrency(Number(p.revenue) || 0)}</td>
                    <td>{p.dispensing_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
