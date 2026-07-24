import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { MarketplaceListing } from '../types'
import { cldCardImageProps, cldDetailImageProps } from '../utils/media'
import { useMasterData } from '../context/MasterDataContext'
import './Marketplace.css'
import './PublicMarketplace.css'

const CATEGORY_ICONS: Record<string, string> = { animal: '🐄', feed: '🌾', equipment: '🔧', medicine: '💊', semen_embryo: '🧬', service: '🩺', other: '📦' }

const g = (l: any, ...keys: string[]): any => { for (const k of keys) { if (l[k] !== undefined && l[k] !== null) return l[k]; } return undefined }

const PublicMarketplace: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { classTermsForSpecies, marketplaceCategories, resolveLabel, marketplaceEligibleSpecies, speciesLabel } = useMasterData()
  const SPECIES_LIST = marketplaceEligibleSpecies
  const CATEGORY_KEYS: Array<{ value: string; label: string }> = [
    { value: '', label: t('marketplace.categories.all') },
    ...marketplaceCategories.map(c => ({ value: c.code, label: resolveLabel(c, t) })),
  ]

  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortBy, setSortBy] = useState('')
  const [page, setPage] = useState(0)
  const [browsePanel, setBrowsePanel] = useState<'' | 'species' | 'categories'>('')
  const [searchInput, setSearchInput] = useState('')
  const PAGE_SIZE = 24

  const listingsRef = React.useRef<HTMLDivElement>(null)

  const scrollToListings = () => {
    listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleStatClick = (type: 'listings' | 'species' | 'categories' | 'sellers') => {
    setPage(0)
    setSelectedListing(null)
    if (type === 'listings') {
      setFilters({}); setSearchInput(''); setSortBy(''); setBrowsePanel('')
    } else if (type === 'species') {
      setBrowsePanel(p => p === 'species' ? '' : 'species')
    } else if (type === 'categories') {
      setBrowsePanel(p => p === 'categories' ? '' : 'categories')
    } else if (type === 'sellers') {
      setFilters({}); setSearchInput(''); setSortBy('newest'); setBrowsePanel('')
    }
    setTimeout(scrollToListings, 100)
  }

  // Debounce free-text search so we don't fire a request per keystroke
  const applySearch = useCallback((value: string) => {
    const v = value.trim()
    setFilters(f => {
      if ((f.search || '') === v) return f
      const n = { ...f }
      if (v) n.search = v; else delete n.search
      return n
    })
    setPage(0)
  }, [])
  useEffect(() => {
    const h = setTimeout(() => applySearch(searchInput), 400)
    return () => clearTimeout(h)
  }, [searchInput, applySearch])

  const formatCurrency = (n: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  }

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
      if (sortBy) params.sortBy = sortBy
      const res = await apiService.listPublicMarketplaceListings(params)
      setListings(res.data?.items || [])
      setTotal(res.data?.total || 0)
    } catch { setListings([]); setTotal(0) }
    setLoading(false)
  }, [filters, sortBy, page])

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiService.getPublicMarketplaceStats()
      setStats(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchListings() }, [fetchListings])

  const viewListing = async (listing: MarketplaceListing) => {
    try {
      const res = await apiService.getPublicMarketplaceListing(listing.id)
      setSelectedListing(res.data)
    } catch { setSelectedListing(listing) }
  }

  const updateFilter = (key: string, value: string) => {
    setPage(0)
    setFilters(f => value ? { ...f, [key]: value } : (() => { const n = { ...f }; delete n[key]; return n })())
  }

  const handleLoginPrompt = () => {
    navigate('/login')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="pub-mp-page">
      {/* Top Nav Bar */}
      <nav className="pub-mp-topnav">
        <button className="pub-mp-topnav-back" onClick={() => navigate(-1)}>
          ← {t('common.back')}
        </button>
        <span className="pub-mp-topnav-logo">🐾 VetCare</span>
        {isAuthenticated && (
          <button className="pub-mp-topnav-cta" onClick={() => navigate('/marketplace')}>
            {t('publicMarketplace.goToFullMarketplace')}
          </button>
        )}
      </nav>

      {/* Hero Banner */}
      <div className="pub-mp-hero">
        <div className="pub-mp-hero-content">
          <h1 className="pub-mp-hero-title">{t('publicMarketplace.heroTitle')}</h1>
          <p className="pub-mp-hero-subtitle">{t('publicMarketplace.heroSubtitle')}</p>
          {stats && (
            <div className="pub-mp-hero-stats">
              <button className="pub-mp-stat pub-mp-stat-btn" onClick={() => handleStatClick('listings')} title={t('publicMarketplace.tipAllListings')}>
                <span className="pub-mp-stat-value">{stats.active_listings || 0}</span>
                <span className="pub-mp-stat-label">{t('publicMarketplace.stats.activeListings')}</span>
              </button>
              <button className={`pub-mp-stat pub-mp-stat-btn ${browsePanel === 'species' ? 'active' : ''}`} onClick={() => handleStatClick('species')} title={t('publicMarketplace.tipSpecies')}>
                <span className="pub-mp-stat-value">{stats.species_count || 0}</span>
                <span className="pub-mp-stat-label">{t('publicMarketplace.stats.species')}</span>
              </button>
              <button className={`pub-mp-stat pub-mp-stat-btn ${browsePanel === 'categories' ? 'active' : ''}`} onClick={() => handleStatClick('categories')} title={t('publicMarketplace.tipCategories')}>
                <span className="pub-mp-stat-value">{stats.category_count || 0}</span>
                <span className="pub-mp-stat-label">{t('publicMarketplace.stats.categories')}</span>
              </button>
              <button className="pub-mp-stat pub-mp-stat-btn" onClick={() => handleStatClick('sellers')} title={t('publicMarketplace.tipSellers')}>
                <span className="pub-mp-stat-value">{stats.seller_count || 0}</span>
                <span className="pub-mp-stat-label">{t('publicMarketplace.stats.sellers')}</span>
              </button>
            </div>
          )}
          {!isAuthenticated && (
            <div className="pub-mp-hero-cta">
              <button className="pub-mp-btn-primary" onClick={() => navigate('/register')}>
                {t('publicMarketplace.registerToSell')}
              </button>
              <button className="pub-mp-btn-secondary" onClick={() => navigate('/login')}>
                {t('publicMarketplace.signInToBid')}
              </button>
            </div>
          )}
          {isAuthenticated && (
            <div className="pub-mp-hero-cta">
              <button className="pub-mp-btn-primary" onClick={() => navigate('/marketplace')}>
                {t('publicMarketplace.goToFullMarketplace')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="pub-mp-container" ref={listingsRef}>
        {/* Browse-by panel (opened from hero stat tiles) */}
        {browsePanel && (
          <div className="pub-mp-browse-panel">
            <div className="pub-mp-browse-head">
              <h3>{browsePanel === 'species' ? t('publicMarketplace.browseBySpecies') : t('publicMarketplace.browseByCategory')}</h3>
              <button className="pub-mp-browse-close" onClick={() => setBrowsePanel('')} aria-label={t('common.close')}>✕</button>
            </div>
            <div className="pub-mp-facet-grid">
              {browsePanel === 'species' ? (
                (stats?.species_facets?.length ? stats.species_facets : SPECIES_LIST.map((s: string) => ({ species: s }))).map((f: any) => (
                  <button key={f.species}
                    className={`pub-mp-facet ${filters.species === f.species ? 'active' : ''}`}
                    onClick={() => updateFilter('species', filters.species === f.species ? '' : f.species)}>
                    <span className="pub-mp-facet-name">{speciesLabel(f.species, t)}</span>
                    {f.count !== undefined && <span className="pub-mp-facet-count">{f.count}</span>}
                  </button>
                ))
              ) : (
                (stats?.category_facets?.length ? stats.category_facets : CATEGORY_KEYS.filter(c => c.value).map(c => ({ category: c.value }))).map((f: any) => {
                  const catLabel = CATEGORY_KEYS.find(c => c.value === f.category)?.label
                  return (
                    <button key={f.category}
                      className={`pub-mp-facet ${filters.category === f.category ? 'active' : ''}`}
                      onClick={() => updateFilter('category', filters.category === f.category ? '' : f.category)}>
                      <span className="pub-mp-facet-icon">{CATEGORY_ICONS[f.category] || '📦'}</span>
                      <span className="pub-mp-facet-name">{catLabel || f.category}</span>
                      {f.count !== undefined && <span className="pub-mp-facet-count">{f.count}</span>}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        <div className="mp-filter-bar">
          <input className="module-input" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applySearch(searchInput) }} placeholder={t('marketplace.searchLivestock')} />
          <select className="module-input" value={filters.category || ''} onChange={e => updateFilter('category', e.target.value)}>
            {CATEGORY_KEYS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="module-input" value={filters.species || ''} onChange={e => updateFilter('species', e.target.value)}>
            <option value="">{t('marketplace.livestock.allSpecies')}</option>
            {SPECIES_LIST.map(s => <option key={s} value={s}>{speciesLabel(s, t)}</option>)}
          </select>
          <select className="module-input" value={filters.gender || ''} onChange={e => updateFilter('gender', e.target.value)}>
            <option value="">{t('marketplace.livestock.anyGender')}</option>
            <option value="male">{t('marketplace.genderLabel.male')}</option>
            <option value="female">{t('marketplace.genderLabel.female')}</option>
          </select>
          {filters.species && classTermsForSpecies(filters.species).length > 0 && (
            <select className="module-input" value={filters.animalClass || ''} onChange={e => updateFilter('animalClass', e.target.value)}>
              <option value="">{t('animalClass.anyClass')}</option>
              {classTermsForSpecies(filters.species).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
            </select>
          )}
          <select className="module-input" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0) }}>
            <option value="">{t('marketplace.sort.default')}</option>
            <option value="price_asc">{t('marketplace.sort.priceAsc')}</option>
            <option value="price_desc">{t('marketplace.sort.priceDesc')}</option>
            <option value="newest">{t('marketplace.sort.newest')}</option>
            <option value="milk_yield">{t('marketplace.sort.milkYield')}</option>
          </select>
          <button className="module-btn primary" onClick={() => applySearch(searchInput)} aria-label={t('common.search')}>🔍</button>
        </div>

        {/* Quick Chips */}
        <div className="mp-chip-bar">
          <button className={`mp-chip ${filters.healthCertificate === 'true' ? 'active' : ''}`} onClick={() => updateFilter('healthCertificate', filters.healthCertificate === 'true' ? '' : 'true')}>{t('marketplace.chips.healthCert')}</button>
          <button className={`mp-chip ${filters.vaccinationStatus === 'fully_vaccinated' ? 'active' : ''}`} onClick={() => updateFilter('vaccinationStatus', filters.vaccinationStatus === 'fully_vaccinated' ? '' : 'fully_vaccinated')}>{t('marketplace.chips.vaccinated')}</button>
          <button className={`mp-chip ${filters.pregnancyStatus === 'pregnant' ? 'active' : ''}`} onClick={() => updateFilter('pregnancyStatus', filters.pregnancyStatus === 'pregnant' ? '' : 'pregnant')}>{t('marketplace.chips.pregnant')}</button>
          {(Object.keys(filters).length > 0 || sortBy || searchInput) && <button className="mp-chip clear" onClick={() => { setFilters({}); setSearchInput(''); setSortBy(''); setPage(0) }}>{t('marketplace.chips.clearAll')}</button>}
        </div>

        {/* Detail View */}
        {selectedListing ? (
          <PublicListingDetail
            listing={selectedListing}
            formatCurrency={formatCurrency}
            onBack={() => setSelectedListing(null)}
            onLoginPrompt={handleLoginPrompt}
            isAuthenticated={isAuthenticated}
            t={t}
          />
        ) : (
          <>
            {/* Results count */}
            <div className="pub-mp-results-bar">
              <span className="pub-mp-results-count">
                {t('publicMarketplace.showingResults', { count: listings.length, total })}
              </span>
            </div>

            {/* Listings Grid */}
            {loading ? (
              <div className="mp-loading">{t('marketplace.loadingListings')}</div>
            ) : listings.length === 0 ? (
              <div className="mp-empty">{t('marketplace.emptyListings')}</div>
            ) : (
              <div className="mp-grid">
                {listings.map(l => (
                  <PublicListingCard key={l.id} listing={l} formatCurrency={formatCurrency} onView={() => viewListing(l)} t={t} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pub-mp-pagination">
                <button className="module-btn small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  {t('publicMarketplace.prev')}
                </button>
                <span className="pub-mp-page-info">
                  {t('publicMarketplace.pageOf', { current: page + 1, total: totalPages })}
                </span>
                <button className="module-btn small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  {t('publicMarketplace.next')}
                </button>
              </div>
            )}

            {/* Login CTA Banner */}
            {!isAuthenticated && listings.length > 0 && (
              <div className="pub-mp-login-banner">
                <div className="pub-mp-login-banner-content">
                  <h3>{t('publicMarketplace.ctaBanner.title')}</h3>
                  <p>{t('publicMarketplace.ctaBanner.subtitle')}</p>
                  <div className="pub-mp-login-banner-actions">
                    <button className="pub-mp-btn-primary" onClick={() => navigate('/register')}>
                      {t('publicMarketplace.ctaBanner.register')}
                    </button>
                    <button className="pub-mp-btn-secondary" onClick={() => navigate('/login')}>
                      {t('publicMarketplace.ctaBanner.signIn')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Public Listing Card (reuses marketplace CSS) ───
const PublicListingCard: React.FC<{ listing: MarketplaceListing; formatCurrency: (n: number) => string; onView: () => void; t: TFunction }> = ({ listing: l, formatCurrency, onView, t }) => {
  const { speciesLabel, breedLabel } = useMasterData()
  const species = l.species
  const breed = l.breed
  const milkYield = g(l, 'dailyMilkYield', 'daily_milk_yield')
  const isHot = g(l, 'isHotDeal', 'is_hot_deal')
  const tier = g(l, 'listingTier', 'listing_tier')
  const vax = g(l, 'vaccinationStatus', 'vaccination_status')
  const hasCert = g(l, 'healthCertificate', 'health_certificate')
  const pregnancy = g(l, 'pregnancyStatus', 'pregnancy_status')
  const gender = l.gender
  const listingType = g(l, 'listingType', 'listing_type')
  const bidCount = g(l, 'bidCount', 'bid_count')
  const sellerName = g(l, 'sellerName', 'seller_name')
  const viewsCount = g(l, 'viewsCount', 'views_count')
  const weight = g(l, 'animalWeightKg', 'animal_weight_kg')
  const sellerType = g(l, 'sellerType', 'seller_type')
  const breederVerified = g(l, 'breederVerified', 'breeder_verified')
  const welfareAtt = g(l, 'welfareAttestation', 'welfare_attestation')
  const images = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || [])
  const tags = typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : (l.tags || [])

  return (
    <div className={`mp-listing-card ${tier === 'spotlight' ? 'spotlight' : tier === 'premium' ? 'premium' : ''}`} onClick={onView}>
      {isHot && <div className="mp-hot-ribbon">{t('marketplace.card.hotDeal')}</div>}
      {tier === 'spotlight' && !isHot && <div className="mp-hot-ribbon spotlight-ribbon">{t('marketplace.card.spotlightLabel')}</div>}

      <div className="mp-card-img">
        {images.length > 0 ? <img {...cldCardImageProps(images[0])} alt={l.title} loading="lazy" /> : <div className="mp-card-img-placeholder">{CATEGORY_ICONS[l.category] || '📦'}</div>}
      </div>

      <div className="mp-card-body">
        <div className="mp-card-badges">
          <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
          <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? t('marketplace.listingType.auctionType') : t('marketplace.fixedBadge')}</span>
          {tier === 'premium' && <span className="mp-badge premium">⭐</span>}
        </div>

        <h4 className="mp-card-title">{l.title}</h4>

        {(species || breed) && (
          <div className="mp-card-livestock">
            {species && <span className="mp-tag species">{speciesLabel(species, t)}</span>}
            {breed && <span className="mp-tag breed">{breedLabel(species, breed)}</span>}
            {gender && <span className="mp-tag gender">{gender === 'female' ? '♀' : '♂'}</span>}
          </div>
        )}

        <div className="mp-card-metrics">
          {milkYield && <span className="mp-metric">🥛 {milkYield}{t('marketplace.card.lPerDay')}</span>}
          {weight && <span className="mp-metric">⚖️ {weight}{t('marketplace.card.kg')}</span>}
          {pregnancy === 'pregnant' && <span className="mp-metric pregnant">🤰 {t('marketplace.card.pregnant')}</span>}
          {vax === 'fully_vaccinated' && <span className="mp-metric vax">{t('marketplace.card.vaccinated')}</span>}
          {hasCert && <span className="mp-metric cert">{t('marketplace.card.certified')}</span>}
          {welfareAtt && <span className="mp-metric welfare">🛡️ {t('marketplace.card.welfareAttested')}</span>}
          {sellerType === 'registered_breeder' && <span className={`mp-metric breeder ${breederVerified ? 'verified' : ''}`}>{breederVerified ? '✅' : '📋'} {t('marketplace.card.registeredBreeder')}</span>}
        </div>

        <div className="mp-card-price">
          {l.price ? formatCurrency(l.price) : t('marketplace.card.contact')}
          {listingType === 'auction' && +bidCount > 0 && <span className="mp-bid-count">{+bidCount} {t('marketplace.units.bids')}</span>}
        </div>

        <div className="mp-card-footer">
          <span>{sellerName || t('marketplace.genderLabel.unknown')}</span>
          <span>{viewsCount || 0} {t('marketplace.units.views')}</span>
        </div>

        {tags.length > 0 && (
          <div className="mp-card-tags">
            {tags.slice(0, 3).map((tag: string) => <span key={tag} className="mp-tag">{tag}</span>)}
            {tags.length > 3 && <span className="mp-tag">+{tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Public Listing Detail (with login gates) ───
const PublicListingDetail: React.FC<{
  listing: MarketplaceListing; formatCurrency: (n: number) => string;
  onBack: () => void; onLoginPrompt: () => void; isAuthenticated: boolean;
  t: TFunction;
}> = ({ listing: l, formatCurrency, onBack, onLoginPrompt, isAuthenticated, t }) => {
  const navigate = useNavigate()
  const { findClassTerm, speciesLabel, resolveLabel, breedLabel } = useMasterData()
  const species = l.species
  const breed = l.breed
  const milkYield = g(l, 'dailyMilkYield', 'daily_milk_yield')
  const weight = g(l, 'animalWeightKg', 'animal_weight_kg')
  const age = g(l, 'animalAgeMonths', 'animal_age_months')
  const gender = l.gender
  const animalClass = g(l, 'animalClass', 'animal_class')
  const lactation = g(l, 'lactationNumber', 'lactation_number')
  const pregnancy = g(l, 'pregnancyStatus', 'pregnancy_status')
  const pregMonth = g(l, 'pregnancyMonth', 'pregnancy_month')
  const vax = g(l, 'vaccinationStatus', 'vaccination_status')
  const hasCert = g(l, 'healthCertificate', 'health_certificate')
  const tier = g(l, 'listingTier', 'listing_tier')
  const isHot = g(l, 'isHotDeal', 'is_hot_deal')
  const listingType = g(l, 'listingType', 'listing_type')
  const highestBid = g(l, 'highestBid', 'highest_bid')
  const sellerName = g(l, 'sellerName', 'seller_name')
  const viewsCount = g(l, 'viewsCount', 'views_count')
  const auctionEnd = g(l, 'auctionEndTime', 'auction_end_time')
  const sellerType = g(l, 'sellerType', 'seller_type')
  const breederVerified = g(l, 'breederVerified', 'breeder_verified')
  const welfareAtt = g(l, 'welfareAttestation', 'welfare_attestation')
  const tags = typeof l.tags === 'string' ? JSON.parse(l.tags || '[]') : (l.tags || [])
  const images = typeof l.images === 'string' ? JSON.parse(l.images || '[]') : (l.images || [])
  const videoUrl = g(l, 'videoUrl', 'video_url')
  const [activeImageIdx, setActiveImageIdx] = React.useState(0)

  return (
    <div className="mp-detail">
      <button className="module-btn small" onClick={onBack}>{t('marketplace.detail.backToListings')}</button>

      <div className="mp-detail-layout">
        <div className="mp-detail-main">
          <div className="mp-card-badges">
            <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
            <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? t('marketplace.listingType.auctionType') : t('marketplace.listingType.fixedPrice')}</span>
            {tier && <span className="mp-badge premium">{{ standard: t('marketplace.tier.standard'), premium: t('marketplace.tier.premium'), spotlight: t('marketplace.tier.spotlight') }[tier as 'standard' | 'premium' | 'spotlight'] || tier}</span>}
            {isHot && <span className="mp-badge hot">{t('marketplace.card.hotDeal')}</span>}
            {l.featured && <span className="mp-badge featured">⭐ Featured</span>}
          </div>

          {images.length > 0 && (
            <div className="mp-detail-gallery">
              <div className="mp-detail-gallery-main">
                <img {...cldDetailImageProps(images[activeImageIdx])} alt={l.title} />
              </div>
              {images.length > 1 && (
                <div className="mp-detail-gallery-thumbs">
                  {images.map((img: string, i: number) => (
                    <button key={i} type="button" className={`mp-detail-thumb ${i === activeImageIdx ? 'active' : ''}`} onClick={() => setActiveImageIdx(i)}>
                      <img {...cldCardImageProps(img)} alt={`${l.title} ${i + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {videoUrl && (
            <div className="mp-detail-video">
              <video controls preload="metadata" src={videoUrl} className="mp-detail-video-el" />
            </div>
          )}

          <h2>{l.title}</h2>
          <p className="mp-sell-step-desc">{l.description || t('marketplace.detail.noDescription')}</p>
          <div className="mp-detail-price">{l.price ? formatCurrency(l.price) : t('marketplace.contactForPrice')}</div>

          {/* Animal Profile */}
          {(species || breed || milkYield || weight || age) && (
            <div className="mp-detail-section">
              <h3>{t('marketplace.detail.animalProfile')}</h3>
              <div className="mp-detail-grid">
                {species && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.species')}</span><span className="mp-detail-value">{speciesLabel(species, t)}</span></div>}
                {breed && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.breed')}</span><span className="mp-detail-value">{breedLabel(species, breed)}</span></div>}
                {(gender || animalClass) && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.gender')}</span><span className="mp-detail-value">{(() => {
                  const term = animalClass ? findClassTerm(species || '', animalClass) : undefined
                  if (term) return resolveLabel(term, t)
                  return (gender && ({ male: t('marketplace.genderLabel.male'), female: t('marketplace.genderLabel.female'), unknown: t('marketplace.genderLabel.unknown') } as Record<string, string>)[gender]) || gender
                })()}</span></div>}
                {age && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.age')}</span><span className="mp-detail-value">{age >= 12 ? `${Math.floor(age / 12)}y ${age % 12}m` : `${age} ${t('marketplace.units.months')}`}</span></div>}
                {weight && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.weightKg')}</span><span className="mp-detail-value">{weight} {t('marketplace.units.kg')}</span></div>}
                {lactation !== undefined && lactation !== null && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.lactation')}</span><span className="mp-detail-value">{lactation}</span></div>}
                {milkYield && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.dailyMilk')}</span><span className="mp-detail-value highlight">🥛 {milkYield} {t('marketplace.units.lPerDay')}</span></div>}
                {pregnancy && <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.pregnancy')}</span><span className="mp-detail-value">{pregnancy === 'pregnant' ? `${t('marketplace.pregnancyLabel.pregnant')}${pregMonth ? ` (${pregMonth} ${t('marketplace.units.months')})` : ''}` : pregnancy}</span></div>}
              </div>
            </div>
          )}

          {/* Health */}
          <div className="mp-detail-section">
            <h3>{t('marketplace.detail.healthCert')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.vaccination')}</span><span className="mp-detail-value">{vax ? ({ fully_vaccinated: t('marketplace.vaxLabel.fully'), partially_vaccinated: t('marketplace.vaxLabel.partial'), not_vaccinated: t('marketplace.vaxLabel.none'), unknown: t('marketplace.vaxLabel.unknown') } as Record<string, string>)[vax] || vax : t('marketplace.genderLabel.unknown')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.reviewLabels.healthCert')}</span><span className="mp-detail-value">{hasCert ? t('marketplace.reviewLabels.yes') : t('marketplace.reviewLabels.no')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.condition')}</span><span className="mp-detail-value">{l.condition}</span></div>
            </div>
          </div>

          {/* Seller (privacy-filtered) */}
          <div className="mp-detail-section">
            <h3>{t('marketplace.detail.sellerLocation')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.seller')}</span><span className="mp-detail-value">{sellerName || t('marketplace.genderLabel.unknown')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.location')}</span><span className="mp-detail-value">{l.location || t('marketplace.detail.notSpecified')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.views')}</span><span className="mp-detail-value">{viewsCount || 0}</span></div>
              {sellerType === 'registered_breeder' && (
                <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.sellerType')}</span><span className="mp-detail-value">{breederVerified ? '✅ ' : '📋 '}{t('marketplace.compliance.registeredBreeder')}{breederVerified ? ` (${t('marketplace.compliance.verified')})` : ''}</span></div>
              )}
              {sellerType === 'individual' && (
                <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.sellerType')}</span><span className="mp-detail-value">{t('marketplace.compliance.individualOwner')}</span></div>
              )}
            </div>
          </div>

          {/* Compliance & Welfare */}
          <div className="mp-detail-section mp-compliance-detail">
            <h3>⚖️ {t('marketplace.compliance.complianceTitle')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.welfareStatus')}</span><span className="mp-detail-value">{welfareAtt ? '✅ ' + t('marketplace.compliance.attested') : '—'}</span></div>
            </div>
            <div className="mp-compliance-info">{t('marketplace.compliance.detailDisclaimer')}</div>
          </div>

          {tags.length > 0 && (
            <div className="mp-card-tags si-b0aee75b">
              {tags.map((tag: string) => <span key={tag} className="mp-tag">{tag}</span>)}
            </div>
          )}
        </div>

        {/* Sidebar — Login Gate */}
        <div className="mp-detail-sidebar">
          {listingType !== 'auction' ? (
            <div className="mp-buy-panel">
              <h4>{t('marketplace.detail.buyNowTitle')}</h4>
              <div className="mp-buy-price">{l.price ? formatCurrency(l.price) : t('marketplace.detail.contactSeller')}</div>
              <div className="mp-sell-step-desc">{t('marketplace.orders.qty')}: {l.quantity} {l.unit || t('marketplace.units.head')}</div>
              {isAuthenticated ? (
                <button className="module-btn primary" onClick={() => navigate('/marketplace')}>
                  {t('marketplace.detail.purchaseNow')}
                </button>
              ) : (
                <div className="pub-mp-login-gate">
                  <p className="pub-mp-gate-text">{t('publicMarketplace.loginGate.buyText')}</p>
                  <button className="module-btn primary" onClick={onLoginPrompt}>
                    {t('publicMarketplace.loginGate.signInToBuy')}
                  </button>
                  <button className="pub-mp-btn-link" onClick={() => navigate('/register')}>
                    {t('publicMarketplace.loginGate.createAccount')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mp-bid-panel">
              <h4>{t('marketplace.detail.placeBidTitle')}</h4>
              <div className="mp-bid-current">
                <span>{t('marketplace.detail.currentHighest')}</span>
                <span className="mp-bid-amount">{formatCurrency(highestBid || l.price || 0)}</span>
              </div>
              {auctionEnd && (
                <div className="mp-auction-end">
                  <span>{t('marketplace.detail.ends')} {new Date(auctionEnd).toLocaleString()}</span>
                </div>
              )}
              {isAuthenticated ? (
                <button className="module-btn primary" onClick={() => navigate('/marketplace')}>
                  {t('publicMarketplace.loginGate.placeBidFull')}
                </button>
              ) : (
                <div className="pub-mp-login-gate">
                  <p className="pub-mp-gate-text">{t('publicMarketplace.loginGate.bidText')}</p>
                  <button className="module-btn primary" onClick={onLoginPrompt}>
                    {t('publicMarketplace.loginGate.signInToBid')}
                  </button>
                  <button className="pub-mp-btn-link" onClick={() => navigate('/register')}>
                    {t('publicMarketplace.loginGate.createAccount')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicMarketplace
