import React, { useState } from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing, MarketplaceBid } from '../../types'
import { ListingCard } from './ListingCard'
import { ListingDetail } from './ListingDetail'
import { NearMeBar } from './NearMeBar'
import { ListingsMap } from './ListingsMap'
import type { NearMeState } from '../../hooks/useNearMe'
import { MarketplaceFilterSheet, AGE_BANDS, SHEET_FILTER_KEYS } from './MarketplaceFilterSheet'

export const BrowseTab: React.FC<{
  filters: Record<string, string>; updateFilter: (key: string, value: string) => void;
  setFilters: (updater: (f: Record<string, string>) => Record<string, string>) => void;
  breedsForSpecies: (species?: string) => string[]; breedLabel: (species: string | undefined, name: string) => string;
  sortBy: string; onSortByChange: (v: string) => void;
  categoryKeys: Array<{ value: string; label: string }>; speciesList: string[];
  classTermsForSpecies: (species: string) => any[]; resolveLabel: (term: any, t: TFunction) => string; speciesLabel: (s: string, t: TFunction) => string;
  onSearch: () => void; onClearAllFilters: () => void;
  nearMe: NearMeState;
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
  userId?: string; onRequestContact: () => void; onRevealContact: (channel: 'call' | 'whatsapp') => Promise<string | null>; onMessageSeller: () => void; onReport: () => void; onBookVetCheck: () => void;
  transport?: { url: string };
  t: TFunction;
}> = (props) => {
  const { filters, updateFilter, setFilters, breedsForSpecies, breedLabel, sortBy, onSortByChange, categoryKeys, speciesList, classTermsForSpecies, resolveLabel, speciesLabel,
    onSearch, onClearAllFilters, nearMe, treasureMount,
    showSaveSearch, onShowSaveSearchChange, saveSearchName, onSaveSearchNameChange, onSaveCurrentSearch,
    loading, listings, favoriteIds, onToggleFavorite, isAuthenticated, onViewListing, totalListings, pageSize, page, onPageChange,
    formatCurrency, selectedListing, bids, bidAmount, bidMessage, onBidAmountChange, onBidMessageChange, onPlaceBid, onBuyNow, onBack,
    isAdmin, onToggleHotDeal, onToggleFeatured, userId, onRequestContact, onRevealContact, onMessageSeller, onReport, onBookVetCheck, transport, t } = props

  const [sheetOpen, setSheetOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  // Filters set in the sheet, shown as removable chips so a person always sees why the list is short.
  // Price and age are each one chip even though each is two keys.
  const activeSheetKeys = SHEET_FILTER_KEYS.filter(k => filters[k])
  const activeChips: Array<{ id: string; text: string; keys: string[] }> = []
  if (filters.minPrice || filters.maxPrice) {
    activeChips.push({ id: 'price', keys: ['minPrice', 'maxPrice'],
      text: `${filters.minPrice ? formatCurrency(+filters.minPrice) : '0'} – ${filters.maxPrice ? formatCurrency(+filters.maxPrice) : '∞'}` })
  }
  if (filters.minAge || filters.maxAge) {
    const band = AGE_BANDS.find(b => (b.minAge || '') === (filters.minAge || '') && (b.maxAge || '') === (filters.maxAge || ''))
    if (band) activeChips.push({ id: 'age', keys: ['minAge', 'maxAge'], text: t(band.labelKey) })
  }
  if (filters.breed) activeChips.push({ id: 'breed', keys: ['breed'], text: breedLabel(filters.species, filters.breed) })
  if (filters.minMilkYield) activeChips.push({ id: 'milk', keys: ['minMilkYield'], text: `🥛 ${filters.minMilkYield}+ ${t('marketplace.units.lPerDay')}` })
  if (filters.gender) activeChips.push({ id: 'gender', keys: ['gender'], text: filters.gender === 'female' ? `♀ ${t('marketplace.genderLabel.female')}` : `♂ ${t('marketplace.genderLabel.male')}` })
  if (filters.animalClass) {
    const term = classTermsForSpecies(filters.species || '').find(c => c.value === filters.animalClass)
    activeChips.push({ id: 'class', keys: ['animalClass'], text: term ? resolveLabel(term, t) : filters.animalClass })
  }
  if (filters.state) activeChips.push({ id: 'state', keys: ['state', 'district'], text: filters.district ? `${filters.district}, ${filters.state}` : filters.state })
  else if (filters.district) activeChips.push({ id: 'district', keys: ['district'], text: filters.district })
  if (filters.pincode) activeChips.push({ id: 'pincode', keys: ['pincode'], text: `📮 ${filters.pincode}` })
  if (filters.pregnancyStatus) activeChips.push({ id: 'preg', keys: ['pregnancyStatus'], text: t('marketplace.chips.pregnant') })
  if (filters.vaccinationStatus) activeChips.push({ id: 'vax', keys: ['vaccinationStatus'], text: t('marketplace.chips.vaccinated') })
  if (filters.healthCertificate) activeChips.push({ id: 'cert', keys: ['healthCertificate'], text: t('marketplace.chips.healthCert') })
  const removeKeys = (keys: string[]) => setFilters(f => { const n = { ...f }; keys.forEach(k => delete n[k]); return n })
  const clearSheetFilters = () => removeKeys(SHEET_FILTER_KEYS)

  if (selectedListing) {
    return (
      <ListingDetail
        listing={selectedListing} bids={bids} formatCurrency={formatCurrency}
        bidAmount={bidAmount} bidMessage={bidMessage} onBidAmountChange={onBidAmountChange} onBidMessageChange={onBidMessageChange}
        onPlaceBid={onPlaceBid} onBuyNow={onBuyNow} onBack={onBack}
        isAdmin={isAdmin} onToggleHotDeal={onToggleHotDeal} onToggleFeatured={onToggleFeatured}
        userId={userId}
        onRequestContact={onRequestContact}
        onRevealContact={isAuthenticated ? onRevealContact : undefined}
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
        <button type="button" className="module-btn mp-filters-btn" onClick={() => setSheetOpen(true)}>
          ⚙️ {t('marketplace.filters.button')}{activeSheetKeys.length > 0 ? ` (${activeSheetKeys.length})` : ''}
        </button>
        <select className="module-input si-e28594a4" value={sortBy} onChange={e => onSortByChange(e.target.value)}>
          <option value="">{t('marketplace.sort.default')}</option>
          <option value="price_asc">{t('marketplace.sort.priceAsc')}</option>
          <option value="price_desc">{t('marketplace.sort.priceDesc')}</option>
          <option value="newest">{t('marketplace.sort.newest')}</option>
          <option value="milk_yield">{t('marketplace.sort.milkYield')}</option>
        </select>
        <button className="module-btn primary" onClick={onSearch}>🔍</button>
      </div>

      {activeChips.length > 0 && (
        <div className="mp-chip-bar" aria-label={t('marketplace.filters.active')}>
          {activeChips.map(c => (
            <button key={c.id} type="button" className="mp-chip active" onClick={() => removeKeys(c.keys)}
              aria-label={`${t('marketplace.filters.remove')}: ${c.text}`}>{c.text} ✕</button>
          ))}
        </div>
      )}
      <MarketplaceFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} filters={filters} setFilters={setFilters}
        breeds={filters.species ? breedsForSpecies(filters.species) : []} breedLabel={breedLabel}
        classTerms={filters.species ? classTermsForSpecies(filters.species) : []} resolveLabel={resolveLabel}
        onClear={clearSheetFilters} resultCount={totalListings} t={t} />

      <NearMeBar nearMe={nearMe} t={t} />

      {/* Quick filter chips */}
      <div className="mp-chip-bar">
        <button className={`mp-chip ${filters.isHotDeal === 'true' ? 'active' : ''}`} onClick={() => updateFilter('isHotDeal', filters.isHotDeal === 'true' ? '' : 'true')}>{t('marketplace.chips.hotDeals')}</button>
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
      <div className="mp-view-toggle" role="tablist" aria-label={t('marketplace.view.label')}>
        <button type="button" role="tab" aria-selected={viewMode === 'list'} className={`mp-chip ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰ {t('marketplace.view.list')}</button>
        <button type="button" role="tab" aria-selected={viewMode === 'map'} className={`mp-chip ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>🗺️ {t('marketplace.view.map')}</button>
      </div>
      {loading ? <div className="mp-loading">{t('marketplace.loadingListings')}</div> : viewMode === 'map' ? (
        <ListingsMap listings={listings} formatCurrency={formatCurrency} onOpen={onViewListing} userLocation={nearMe.active ? nearMe.location : null} t={t} />
      ) : (
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
