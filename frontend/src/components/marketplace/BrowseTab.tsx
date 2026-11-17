import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing, MarketplaceBid } from '../../types'
import { ListingCard } from './ListingCard'
import { ListingDetail } from './ListingDetail'

export const BrowseTab: React.FC<{
  filters: Record<string, string>; updateFilter: (key: string, value: string) => void;
  sortBy: string; onSortByChange: (v: string) => void;
  categoryKeys: Array<{ value: string; label: string }>; speciesList: string[];
  classTermsForSpecies: (species: string) => any[]; resolveLabel: (term: any, t: TFunction) => string; speciesLabel: (s: string, t: TFunction) => string;
  onSearch: () => void; onClearAllFilters: () => void;
  nearMeActive: boolean; onNearMeToggle: () => void; radiusKm: string; onRadiusChange: (v: string) => void;
  userLocation: { lat: number; lng: number } | null; locationError: string;
  treasureMount?: { enabled: boolean; url: string };
  showSaveSearch: boolean; onShowSaveSearchChange: (v: boolean) => void;
  saveSearchName: string; onSaveSearchNameChange: (v: string) => void; onSaveCurrentSearch: () => void;
  loading: boolean; listings: MarketplaceListing[]; favoriteIds: Set<string>; onToggleFavorite: (id: string) => void; isAuthenticated: boolean;
  onViewListing: (l: MarketplaceListing) => void;
  totalListings: number; pageSize: number; page: number; onPageChange: (p: number) => void;
  formatCurrency: (n: number) => string;
  selectedListing: MarketplaceListing | null; bids: MarketplaceBid[];
  bidAmount: string; bidMessage: string; onBidAmountChange: (v: string) => void; onBidMessageChange: (v: string) => void;
  onPlaceBid: () => void; onBuyNow: () => void; onBack: () => void;
  isAdmin: boolean; onToggleHotDeal: (id: string, v: boolean) => void; onToggleFeatured: (id: string, v: boolean) => void;
  userId?: string; onRequestContact: () => void; onMessageSeller: () => void; onReport: () => void; onBookVetCheck: () => void;
  transport?: { url: string };
  t: TFunction;
}> = (props) => {
  const { filters, updateFilter, sortBy, onSortByChange, categoryKeys, speciesList, classTermsForSpecies, resolveLabel, speciesLabel,
    onSearch, onClearAllFilters, nearMeActive, onNearMeToggle, radiusKm, onRadiusChange, userLocation, locationError, treasureMount,
    showSaveSearch, onShowSaveSearchChange, saveSearchName, onSaveSearchNameChange, onSaveCurrentSearch,
    loading, listings, favoriteIds, onToggleFavorite, isAuthenticated, onViewListing, totalListings, pageSize, page, onPageChange,
    formatCurrency, selectedListing, bids, bidAmount, bidMessage, onBidAmountChange, onBidMessageChange, onPlaceBid, onBuyNow, onBack,
    isAdmin, onToggleHotDeal, onToggleFeatured, userId, onRequestContact, onMessageSeller, onReport, onBookVetCheck, transport, t } = props

  if (selectedListing) {
    return (
      <ListingDetail
        listing={selectedListing} bids={bids} formatCurrency={formatCurrency}
        bidAmount={bidAmount} bidMessage={bidMessage} onBidAmountChange={onBidAmountChange} onBidMessageChange={onBidMessageChange}
        onPlaceBid={onPlaceBid} onBuyNow={onBuyNow} onBack={onBack}
        isAdmin={isAdmin} onToggleHotDeal={onToggleHotDeal} onToggleFeatured={onToggleFeatured}
        userId={userId}
        onRequestContact={onRequestContact}
        isFavorite={favoriteIds.has(selectedListing.id)}
        onToggleFavorite={isAuthenticated ? () => onToggleFavorite(selectedListing.id) : undefined}
        onMessageSeller={isAuthenticated ? onMessageSeller : undefined}
        onReport={isAuthenticated && selectedListing.seller_id !== userId ? onReport : undefined}
        onBookVetCheck={onBookVetCheck}
        transport={transport}
        t={t}
      />
    )
  }

  return (
    <div>
      {/* Advanced Filters */}
      <div className="mp-filter-bar">
        <input className="module-input si-0d5963cb" value={filters.search || ''} onChange={e => updateFilter('search', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()} placeholder={t('marketplace.searchLivestock')} />
        <select className="module-input si-549dd079" value={filters.category || ''} onChange={e => updateFilter('category', e.target.value)}>
          {categoryKeys.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="module-input si-1403a954" value={filters.species || ''} onChange={e => updateFilter('species', e.target.value)}>
          <option value="">{t('marketplace.livestock.allSpecies')}</option>
          {speciesList.map(s => <option key={s} value={s}>{speciesLabel(s, t)}</option>)}
        </select>
        <select className="module-input si-8ceadd67" value={filters.gender || ''} onChange={e => updateFilter('gender', e.target.value)}>
          <option value="">{t('marketplace.livestock.anyGender')}</option>
          <option value="male">{t('marketplace.genderLabel.male')}</option><option value="female">{t('marketplace.genderLabel.female')}</option>
        </select>
        {filters.species && classTermsForSpecies(filters.species).length > 0 && (
          <select className="module-input si-e28594a4" value={filters.animalClass || ''} onChange={e => updateFilter('animalClass', e.target.value)}>
            <option value="">{t('animalClass.anyClass')}</option>
            {classTermsForSpecies(filters.species).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
          </select>
        )}
        <select className="module-input si-e28594a4" value={sortBy} onChange={e => onSortByChange(e.target.value)}>
          <option value="">{t('marketplace.sort.default')}</option>
          <option value="price_asc">{t('marketplace.sort.priceAsc')}</option>
          <option value="price_desc">{t('marketplace.sort.priceDesc')}</option>
          <option value="newest">{t('marketplace.sort.newest')}</option>
          <option value="milk_yield">{t('marketplace.sort.milkYield')}</option>
        </select>
        <button className="module-btn primary" onClick={onSearch}>🔍</button>
      </div>

      {/* Proximity filter row */}
      <div className="mp-proximity-bar">
        <button
          className={`mp-chip ${nearMeActive ? 'active' : ''}`}
          onClick={onNearMeToggle}
        >
          📍 {nearMeActive ? t('marketplace.proximity.nearMeOn', 'Near Me ON') : t('marketplace.proximity.nearMe', 'Near Me')}
        </button>
        {nearMeActive && (
          <select className="module-input si-8ceadd67" value={radiusKm} onChange={e => onRadiusChange(e.target.value)}>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
          </select>
        )}
        {nearMeActive && userLocation && (
          <span className="mp-location-hint si-48a0b045">
            {t('marketplace.proximity.searching', 'Searching within')} {radiusKm} km
          </span>
        )}
        {locationError && <span className="si-a41d01e2">{locationError}</span>}
      </div>

      {/* Quick filter chips */}
      <div className="mp-chip-bar">
        <button className={`mp-chip ${filters.isHotDeal === 'true' ? 'active' : ''}`} onClick={() => updateFilter('isHotDeal', filters.isHotDeal === 'true' ? '' : 'true')}>{t('marketplace.chips.hotDeals')}</button>
        <button className={`mp-chip ${filters.healthCertificate === 'true' ? 'active' : ''}`} onClick={() => updateFilter('healthCertificate', filters.healthCertificate === 'true' ? '' : 'true')}>{t('marketplace.chips.healthCert')}</button>
        <button className={`mp-chip ${filters.vaccinationStatus === 'fully_vaccinated' ? 'active' : ''}`} onClick={() => updateFilter('vaccinationStatus', filters.vaccinationStatus === 'fully_vaccinated' ? '' : 'fully_vaccinated')}>{t('marketplace.chips.vaccinated')}</button>
        <button className={`mp-chip ${filters.pregnancyStatus === 'pregnant' ? 'active' : ''}`} onClick={() => updateFilter('pregnancyStatus', filters.pregnancyStatus === 'pregnant' ? '' : 'pregnant')}>{t('marketplace.chips.pregnant')}</button>
        <button className={`mp-chip ${filters.listingTier === 'premium' ? 'active' : ''}`} onClick={() => updateFilter('listingTier', filters.listingTier === 'premium' ? '' : 'premium')}>{t('marketplace.chips.premium')}</button>
        {Object.keys(filters).length > 0 && <button className="mp-chip clear" onClick={onClearAllFilters}>{t('marketplace.chips.clearAll')}</button>}
      </div>

      {/* Treasure Mount interlink - surfaced when browsing non-animal product categories */}
      {treasureMount?.enabled && ['feed', 'equipment', 'medicine', 'other'].includes(filters.category || '') && (
        <a className="mp-treasure-banner" href={treasureMount.url} target="_blank" rel="noopener noreferrer">
          🛒 {t('marketplace.interlink.treasureBanner')} <span className="mp-treasure-cta">{t('marketplace.interlink.visitTreasure')} →</span>
        </a>
      )}
      {/* Save this search */}
      <div className="mp-save-search-bar">
        {showSaveSearch ? (
          <div className="mp-save-search-form">
            <input className="module-input" value={saveSearchName} onChange={e => onSaveSearchNameChange(e.target.value)}
              placeholder={t('marketplace.engagement.searchNamePlaceholder')} maxLength={120} />
            <button className="module-btn primary small" onClick={onSaveCurrentSearch}>{t('marketplace.engagement.save')}</button>
            <button className="module-btn small" onClick={() => onShowSaveSearchChange(false)}>{t('marketplace.sell.back')}</button>
          </div>
        ) : (
          <button className="mp-chip" onClick={() => onShowSaveSearchChange(true)}>🔔 {t('marketplace.engagement.saveThisSearch')}</button>
        )}
      </div>
      {loading ? <div className="mp-loading">{t('marketplace.loadingListings')}</div> : (
        <div className="mp-grid">
          {listings.map(l => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => onViewListing(l)}
            isFavorite={favoriteIds.has(l.id)} onToggleFavorite={isAuthenticated ? () => onToggleFavorite(l.id) : undefined} t={t} />)}
          {listings.length === 0 && <p className="mp-empty">{t('marketplace.emptyListings')}</p>}
        </div>
      )}
      {/* Pagination */}
      {totalListings > pageSize && (
        <div className="mp-pagination">
          <button className="module-btn small" disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))}>← {t('common.previous', 'Previous')}</button>
          <span className="mp-page-info">{t('marketplace.pageOf', { current: page + 1, total: Math.ceil(totalListings / pageSize) })}</span>
          <button className="module-btn small" disabled={(page + 1) * pageSize >= totalListings} onClick={() => onPageChange(page + 1)}>{t('common.next', 'Next')} →</button>
        </div>
      )}
    </div>
  )
}
