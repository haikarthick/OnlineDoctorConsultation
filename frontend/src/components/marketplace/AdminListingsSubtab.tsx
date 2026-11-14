import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing, MarketplaceStats } from '../../types'
import { g } from './publicListingShared'

export const AdminListingsSubtab: React.FC<{
  adminStats: MarketplaceStats | null; adminFilter: string; onAdminFilterChange: (v: string) => void;
  adminListings: MarketplaceListing[]; speciesLabel: (s: string, t: TFunction) => string; formatCurrency: (n: number) => string;
  onTitleClick: (l: MarketplaceListing) => void;
  onApprove: (id: string) => void; onToggleHotDeal: (id: string, v: boolean) => void; onToggleFeatured: (id: string, v: boolean) => void;
  adminRejectReason: string; onRejectReasonChange: (v: string) => void; onReject: (id: string) => void; t: TFunction;
}> = ({ adminStats, adminFilter, onAdminFilterChange, adminListings, speciesLabel, formatCurrency, onTitleClick, onApprove, onToggleHotDeal, onToggleFeatured, adminRejectReason, onRejectReasonChange, onReject, t }) => (
  <div>
    {adminStats && (
      <div className="module-stats">
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.total_listings || 0}</div><div className="stat-label">{t('marketplace.stats.totalListings')}</div></div>
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.active_listings || 0}</div><div className="stat-label">{t('marketplace.stats.active')}</div></div>
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.sold_listings || 0}</div><div className="stat-label">{t('marketplace.stats.sold')}</div></div>
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.pending_review || 0}</div><div className="stat-label">{t('marketplace.stats.pendingReview')}</div></div>
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.hot_deals || 0}</div><div className="stat-label">{t('marketplace.stats.hotDeals')}</div></div>
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.auctions || 0}</div><div className="stat-label">{t('marketplace.stats.auctions')}</div></div>
        <div className="stat-card"><div className="stat-value">{adminStats.overview?.total_views || 0}</div><div className="stat-label">{t('marketplace.stats.totalViews')}</div></div>
      </div>
    )}
    {adminStats?.bySpecies && adminStats.bySpecies.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.sections.speciesAnalytics')}</h3>
        <table className="module-table">
          <thead><tr><th>{t('marketplace.livestock.species')}</th><th>{t('marketplace.admin.count')}</th><th>{t('marketplace.prices.avgPrice')}</th><th>{t('marketplace.admin.avgMilkYield')}</th><th>{t('marketplace.prices.avgWeight')}</th></tr></thead>
          <tbody>{adminStats.bySpecies.map((s, i) => (
            <tr key={i}><td><strong>{speciesLabel(s.species, t)}</strong></td><td>{s.count}</td>
              <td>{formatCurrency(Math.round(s.avg_price || 0))}</td>
              <td>{s.avg_milk_yield ? `${Number(s.avg_milk_yield).toFixed(1)}L` : '-'}</td>
              <td>{s.avg_weight ? `${Number(s.avg_weight).toFixed(0)}${t('marketplace.units.kg')}` : '-'}</td></tr>
          ))}</tbody>
        </table>
      </div>
    )}
    {adminStats?.priceDistribution && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.sections.priceDistribution')}</h3>
        <div className="module-stats">
          <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.under_10k}</div><div className="stat-label">{t('marketplace.admin.priceUnder10k')}</div></div>
          <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.range_10k_50k}</div><div className="stat-label">{t('marketplace.admin.price10k50k')}</div></div>
          <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.range_50k_100k}</div><div className="stat-label">{t('marketplace.admin.price50k1l')}</div></div>
          <div className="stat-card"><div className="stat-value">{adminStats.priceDistribution.above_100k}</div><div className="stat-label">{t('marketplace.admin.priceAbove1l')}</div></div>
        </div>
      </div>
    )}
    <div className="mp-section">
      <div className="mp-admin-header">
        <h3 className="mp-section-title">{t('marketplace.sections.listingManagement')}</h3>
        <select className="module-input" value={adminFilter} onChange={e => onAdminFilterChange(e.target.value)}>
          <option value="">{t('marketplace.admin.allListings')}</option>
          <option value="true">{t('marketplace.admin.approved')}</option>
          <option value="false">{t('marketplace.admin.rejectedPending')}</option>
        </select>
      </div>
      <div className="data-table-container">
        <table className="module-table">
          <thead><tr><th>{t('marketplace.admin.titleCol')}</th><th>{t('marketplace.admin.sellerCol')}</th><th>{t('marketplace.livestock.species')}</th><th>{t('marketplace.admin.priceCol')}</th><th>{t('marketplace.orders.status')}</th><th>{t('marketplace.admin.approvedCol')}</th><th>{t('marketplace.admin.actionsCol')}</th></tr></thead>
          <tbody>
            {adminListings.map(l => (
              <tr key={l.id}>
                <td>
                  <div className="mp-title-cell">
                    {g(l, 'isHotDeal', 'is_hot_deal') && <span title="Hot Deal">🔥</span>}
                    {l.featured && <span title="Featured">⭐</span>}
                    <span className="mp-title-link" onClick={() => onTitleClick(l)}>{l.title}</span>
                  </div>
                </td>
                <td>{g(l, 'sellerName', 'seller_name') || '-'}</td>
                <td>{l.species ? speciesLabel(l.species, t) : '-'}</td>
                <td>{l.price ? formatCurrency(l.price) : '-'}</td>
                <td><span className={`module-badge ${l.status === 'active' ? 'success' : l.status === 'rejected' ? 'error' : ''}`}>{l.status}</span></td>
                <td>{g(l, 'adminApproved', 'admin_approved') === true ? '✅' : g(l, 'adminApproved', 'admin_approved') === false ? '❌' : '⏳'}</td>
                <td>
                  <div className="mp-action-cluster">
                    {g(l, 'adminApproved', 'admin_approved') !== true && <button className="module-btn small" onClick={() => onApprove(l.id)} title="Approve">✅</button>}
                    <button className="module-btn small" onClick={() => onToggleHotDeal(l.id, g(l, 'isHotDeal', 'is_hot_deal') || false)} title="Toggle Hot Deal">{g(l, 'isHotDeal', 'is_hot_deal') ? '🔥' : '💤'}</button>
                    <button className="module-btn small" onClick={() => onToggleFeatured(l.id, l.featured || false)} title="Toggle Featured">{l.featured ? '⭐' : '☆'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adminListings.length === 0 && <p className="mp-empty">{t('marketplace.admin.noListings')}</p>}
    </div>
    <div className="mp-section">
      <h3 className="mp-section-title">{t('marketplace.sections.rejectListing')}</h3>
      <div className="mp-reject-row">
        <input className="module-input" value={adminRejectReason} onChange={e => onRejectReasonChange(e.target.value)} placeholder={t('marketplace.admin.rejectionReason')} />
        <select className="module-input" id="rejectListingSelect">
          <option value="">{t('marketplace.admin.selectToReject')}</option>
          {adminListings.filter(l => g(l, 'adminApproved', 'admin_approved') !== false).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <button className="module-btn primary" onClick={() => {
          const sel = (document.getElementById('rejectListingSelect') as HTMLSelectElement)?.value
          if (sel) onReject(sel)
        }}>{t('marketplace.admin.reject')}</button>
      </div>
    </div>
  </div>
)
