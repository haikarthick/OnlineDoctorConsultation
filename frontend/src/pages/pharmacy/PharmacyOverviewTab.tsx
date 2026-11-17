import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { useMasterData } from '../../context/MasterDataContext'
import type { DashboardSummary, PendingPrescription, ReadyDispensing } from './pharmacyDashboardShared'

export default function PharmacyOverviewTab({
  summary,
  pendingRx,
  readyDispense,
  loading,
  onTabChange,
  onReview,
  onDispense,
}: {
  summary: DashboardSummary | null
  pendingRx: PendingPrescription[]
  readyDispense: ReadyDispensing[]
  loading: boolean
  onTabChange: (tab: 'review' | 'dispense' | 'alerts' | 'reorders') => void
  onReview: (rx: PendingPrescription) => void
  onDispense: (rx: ReadyDispensing) => void
}) {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const { speciesLabel } = useMasterData()

  return (
    <>
      {/* Stats tiles */}
      <div className="pharmacy-stats">
        <div className="pharmacy-stat-card warning si-3c1f81b9" onClick={() => onTabChange('review')}>
          <span className="stat-icon">📋</span>
          <span className="stat-value">{summary?.pending_reviews ?? '-'}</span>
          <span className="stat-label">{t('pharmacy.stats.pendingReviews')}</span>
        </div>
        <div className="pharmacy-stat-card success si-3c1f81b9" onClick={() => onTabChange('dispense')}>
          <span className="stat-icon">✅</span>
          <span className="stat-value">{summary?.ready_to_dispense ?? '-'}</span>
          <span className="stat-label">{t('pharmacy.stats.readyToDispense')}</span>
        </div>
        {/* These two link to Alerts, not Inventory: the inventory table lists
            one row per batch, so a medication that has run out entirely has
            nothing to show there and the count led to a page it was absent
            from. */}
        <div className="pharmacy-stat-card danger si-3c1f81b9" onClick={() => onTabChange('alerts')}>
          <span className="stat-icon">⚠️</span>
          <span className="stat-value">{summary?.low_stock_count ?? '-'}</span>
          <span className="stat-label">{t('pharmacy.stats.lowStock')}</span>
        </div>
        <div className="pharmacy-stat-card warning si-3c1f81b9" onClick={() => onTabChange('alerts')}>
          <span className="stat-icon">⏰</span>
          <span className="stat-value">{summary?.expiring_soon_count ?? '-'}</span>
          <span className="stat-label">{t('pharmacy.stats.expiringSoon')}</span>
        </div>
        <div className="pharmacy-stat-card info si-3c1f81b9" onClick={() => onTabChange('reorders')}>
          <span className="stat-icon">🔄</span>
          <span className="stat-value">{summary?.pending_reorders ?? '-'}</span>
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
          <button type="button" className="module-btn small" onClick={() => onTabChange('review')}>{t('common.viewAll')}</button>
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
                      <strong>{rx.pet_name || '-'}</strong>
                      {rx.animal_species && <small className="si-1a0c0bfa">{speciesLabel(rx.animal_species, t)}</small>}
                    </td>
                    <td>{rx.owner_name || '-'}</td>
                    <td>{rx.vet_name || '-'}</td>
                    <td className="si-cf8f70f1">{rx.medication_names || '-'}</td>
                    <td className="si-86931177">{rx.created_at ? new Date(rx.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                      <button type="button" className="module-btn small primary" onClick={() => onReview(rx)}>
                        {t('pharmacy.actions.review')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingRx.length > 5 && (
              <div className="si-c0b3a91c">
                <button type="button" className="module-btn small" onClick={() => onTabChange('review')}>
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
          <button type="button" className="module-btn small" onClick={() => onTabChange('dispense')}>{t('common.viewAll')}</button>
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
                      <strong>{rx.pet_name || '-'}</strong>
                      {rx.animal_species && <small className="si-1a0c0bfa">{speciesLabel(rx.animal_species, t)}</small>}
                    </td>
                    <td>{rx.owner_name || '-'}</td>
                    <td className="si-4a370a4e">{rx.medication_names || '-'}</td>
                    <td>
                      <button type="button" className="module-btn small primary" onClick={() => onDispense(rx)}>
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
  )
}
