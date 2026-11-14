import React from 'react'
import type { TFunction } from 'i18next'

export const AdminRevenueSubtab: React.FC<{
  monetizationDashboard: any; formatCurrency: (n: number) => string; t: TFunction;
}> = ({ monetizationDashboard, formatCurrency, t }) => (
  <div>
    <div className="module-stats">
      <div className="stat-card"><div className="stat-value">{formatCurrency(monetizationDashboard?.totalRevenue?.total || 0)}</div><div className="stat-label">{t('marketplace.monetization.totalRevenue')}</div></div>
      <div className="stat-card"><div className="stat-value">{monetizationDashboard?.totalRevenue?.count || 0}</div><div className="stat-label">{t('marketplace.monetization.totalTransactions')}</div></div>
      <div className="stat-card"><div className="stat-value">{monetizationDashboard?.inquiryStats?.total || 0}</div><div className="stat-label">{t('marketplace.monetization.totalInquiries')}</div></div>
      <div className="stat-card"><div className="stat-value">{formatCurrency(monetizationDashboard?.inquiryStats?.revenue || 0)}</div><div className="stat-label">{t('marketplace.monetization.inquiryRevenue')}</div></div>
    </div>
    {/* Revenue by Type */}
    {monetizationDashboard?.revenueByType?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.monetization.revenueByType')}</h3>
        <div className="module-stats">
          {monetizationDashboard.revenueByType.map((r: any, i: number) => (
            <div className="stat-card" key={i}>
              <div className="stat-value">{formatCurrency(r.total || 0)}</div>
              <div className="stat-label">{r.type} ({r.count})</div>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Subscription Stats */}
    {monetizationDashboard?.subscriptionStats?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.monetization.subscriptionStats')}</h3>
        <div className="module-stats">
          {monetizationDashboard.subscriptionStats.map((s: any, i: number) => (
            <div className="stat-card" key={i}>
              <div className="stat-value">{s.count}</div>
              <div className="stat-label">{s.status}</div>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Boost Stats */}
    {monetizationDashboard?.boostStats?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.monetization.boostStats')}</h3>
        <div className="module-stats">
          {monetizationDashboard.boostStats.map((b: any, i: number) => (
            <div className="stat-card" key={i}>
              <div className="stat-value">{b.count}</div>
              <div className="stat-label">{b.boost_type} ({formatCurrency(b.revenue || 0)})</div>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* Recent Transactions */}
    {monetizationDashboard?.recentTransactions?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.monetization.recentTransactions')}</h3>
        <div className="data-table-container">
          <table className="module-table">
            <thead><tr><th>{t('marketplace.monetization.user')}</th><th>{t('marketplace.monetization.type')}</th><th>{t('marketplace.monetization.amount')}</th><th>{t('marketplace.orders.status')}</th><th>{t('marketplace.monetization.date')}</th></tr></thead>
            <tbody>
              {monetizationDashboard.recentTransactions.map((tx: any) => (
                <tr key={tx.id}>
                  <td>{tx.userName || '-'}</td>
                  <td><span className="module-badge">{tx.transaction_type}</span></td>
                  <td>{formatCurrency(tx.amount)}</td>
                  <td><span className={`module-badge ${tx.status === 'completed' ? 'success' : ''}`}>{tx.status}</span></td>
                  <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    {(!monetizationDashboard?.recentTransactions?.length && !monetizationDashboard?.revenueByType?.length) && (
      <div className="mp-section">
        <p className="mp-empty">{t('marketplace.monetization.noRevenue')}</p>
      </div>
    )}
  </div>
)
