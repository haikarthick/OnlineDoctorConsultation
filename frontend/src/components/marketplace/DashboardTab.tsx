import React from 'react'
import type { TFunction } from 'i18next'
import { ListingCard } from './ListingCard'

export const DashboardTab: React.FC<{
  dashboard: any; formatCurrency: (n: number) => string; speciesLabel: (s: string, t: TFunction) => string;
  onViewListing: (l: any) => void; onFilterBySpecies: (species: string) => void; t: TFunction;
}> = ({ dashboard, formatCurrency, speciesLabel, onViewListing, onFilterBySpecies, t }) => (
  <div className="mp-dashboard">
    <div className="module-stats">
      <div className="stat-card"><div className="stat-value">{dashboard.summary?.activeListings || 0}</div><div className="stat-label">{t('marketplace.stats.activeListings')}</div></div>
      <div className="stat-card"><div className="stat-value">{dashboard.summary?.soldListings || 0}</div><div className="stat-label">{t('marketplace.stats.itemsSold')}</div></div>
      <div className="stat-card"><div className="stat-value">{dashboard.summary?.pendingApproval || 0}</div><div className="stat-label">{t('marketplace.stats.pendingReview')}</div></div>
      <div className="stat-card"><div className="stat-value">{dashboard.bySpecies?.length || 0}</div><div className="stat-label">{t('marketplace.stats.speciesListed')}</div></div>
    </div>

    {/* Hot Deals Section */}
    {dashboard.hotDeals?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.sections.hotDeals')}</h3>
        <div className="mp-grid">
          {dashboard.hotDeals.map((l: any) => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => onViewListing(l)} t={t} />)}
        </div>
      </div>
    )}

    {/* Species Breakdown */}
    {dashboard.bySpecies?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.sections.bySpecies')}</h3>
        <div className="mp-species-grid">
          {dashboard.bySpecies.map((s: any) => (
            <div key={s.species} className="mp-species-card" onClick={() => onFilterBySpecies(s.species)}>
              <div className="mp-species-name">{speciesLabel(s.species, t)}</div>
              <div className="mp-species-count">{s.count} {t('marketplace.units.listings')}</div>
              <div className="mp-species-price">{t('common.average')}: {formatCurrency(Math.round(s.avg_price || 0))}</div>
              {s.avg_milk_yield > 0 && <div className="mp-species-milk">🥛 {Number(s.avg_milk_yield).toFixed(1)}{t('marketplace.units.avgLPerDay')}</div>}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Recent Listings */}
    {dashboard.recentListings?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.sections.latestListings')}</h3>
        <div className="mp-grid">
          {dashboard.recentListings.map((l: any) => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => onViewListing(l)} t={t} />)}
        </div>
      </div>
    )}

    {/* Top Sellers */}
    {dashboard.topSellers?.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">{t('marketplace.sections.topSellers')}</h3>
        <div className="mp-sellers-list">
          {dashboard.topSellers.map((s: any, i: number) => (
            <div key={i} className="mp-seller-row">
              <span className="mp-seller-rank">#{i + 1}</span>
              <span className="mp-seller-name">{s.name}</span>
              <span className="mp-seller-stat">{s.listings} {t('marketplace.units.listings')}</span>
              <span className="mp-seller-stat">{s.total_views} {t('marketplace.units.views')}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)
