import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing } from '../../types'
import { cldCardImageProps } from '../../utils/media'
import { useMasterData } from '../../context/MasterDataContext'
import { CATEGORY_ICONS, g } from './publicListingShared'

// ─── Listing Card Component (authenticated marketplace) ───
export const ListingCard: React.FC<{ listing: MarketplaceListing; formatCurrency: (n: number) => string; onView: () => void; t: TFunction; isFavorite?: boolean; onToggleFavorite?: () => void }> = ({ listing: l, formatCurrency, onView, t, isFavorite, onToggleFavorite }) => {
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
  const breedAvgPrice = g(l, 'breedAvgPrice', 'breed_avg_price')
  const hasHealthPassport = g(l, 'hasHealthPassport', 'has_health_passport')
  // Moderation state - only ever present on the seller's own listings (and for admins)
  const adminApproved = g(l, 'adminApproved', 'admin_approved')
  const isRejected = adminApproved === false && l.status === 'rejected'
  const isPendingReview = adminApproved === false && !isRejected
  const isReserved = l.status === 'reserved'
  // Fair Deal badge: price is ≥15% below breed average → good deal; ≥15% above → premium priced
  const fairDealPct = breedAvgPrice && l.price ? Math.round(100 * l.price / breedAvgPrice) : null
  const isFairDeal = fairDealPct !== null && fairDealPct < 85
  const isPremiumPriced = fairDealPct !== null && fairDealPct > 115

  return (
    <div className={`mp-listing-card ${tier === 'spotlight' ? 'spotlight' : tier === 'premium' ? 'premium' : ''}`} onClick={onView}>
      {isHot && <div className="mp-hot-ribbon">{t('marketplace.card.hotDeal')}</div>}
      {tier === 'spotlight' && !isHot && <div className="mp-hot-ribbon spotlight-ribbon">{t('marketplace.card.spotlightLabel')}</div>}

      {/* Favorite heart */}
      {onToggleFavorite && (
        <button
          className={`mp-fav-btn ${isFavorite ? 'active' : ''}`}
          title={isFavorite ? t('marketplace.engagement.removeFavorite') : t('marketplace.engagement.addFavorite')}
          aria-label={isFavorite ? t('marketplace.engagement.removeFavorite') : t('marketplace.engagement.addFavorite')}
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
        >{isFavorite ? '❤️' : '🤍'}</button>
      )}

      {/* Image placeholder */}
      <div className="mp-card-img">
        {images.length > 0 ? <img {...cldCardImageProps(images[0])} alt={l.title} loading="lazy" /> : <div className="mp-card-img-placeholder">{CATEGORY_ICONS[l.category] || '📦'}</div>}
        {g(l, 'videoUrl', 'video_url') && <span className="mp-card-video-badge" title={t('marketplace.card.hasVideo')}>🎥</span>}
      </div>

      <div className="mp-card-body">
        {/* Category + Type badges */}
        <div className="mp-card-badges">
          <span className="mp-badge category">{CATEGORY_ICONS[l.category]} {l.category}</span>
          <span className={`mp-badge ${listingType === 'auction' ? 'auction' : 'sale'}`}>{listingType === 'auction' ? t('marketplace.listingType.auctionType') : t('marketplace.fixedBadge')}</span>
          {tier === 'premium' && <span className="mp-badge premium">⭐</span>}
          {isPendingReview && <span className="mp-badge pending-review">⏳ {t('marketplace.deal.pendingReview')}</span>}
          {isRejected && <span className="mp-badge rejected">❌ {t('marketplace.deal.rejected')}</span>}
          {isReserved && <span className="mp-badge reserved">🤝 {t('marketplace.deal.status.reserved')}</span>}
        </div>

        <h4 className="mp-card-title">{l.title}</h4>
        {/* VC Animal ID badge */}
        {(g(l, 'animalUniqueId', 'animal_unique_id')) && (
          <div className="si-849b9ee0">
            🏷️ {g(l, 'animalUniqueId', 'animal_unique_id')}
          </div>
        )}

        {/* Livestock details row */}
        {(species || breed) && (
          <div className="mp-card-livestock">
            {species && <span className="mp-tag species">{speciesLabel(species, t)}</span>}
            {breed && <span className="mp-tag breed">{breedLabel(species, breed)}</span>}
            {gender && <span className="mp-tag gender">{gender === 'female' ? '♀' : '♂'}</span>}
          </div>
        )}

        {/* Key metrics */}
        <div className="mp-card-metrics">
          {milkYield && <span className="mp-metric">🥛 {milkYield}{t('marketplace.card.lPerDay')}</span>}
          {weight && <span className="mp-metric">⚖️ {weight}{t('marketplace.card.kg')}</span>}
          {pregnancy === 'pregnant' && <span className="mp-metric pregnant">🤰 {t('marketplace.card.pregnant')}</span>}
          {vax === 'fully_vaccinated' && <span className="mp-metric vax">{t('marketplace.card.vaccinated')}</span>}
          {hasCert && <span className="mp-metric cert">{t('marketplace.card.certified')}</span>}
          {welfareAtt && <span className="mp-metric welfare">🛡️ {t('marketplace.card.welfareAttested')}</span>}
          {sellerType === 'registered_breeder' && <span className={`mp-metric breeder ${breederVerified ? 'verified' : ''}`}>{breederVerified ? '✅' : '📋'} {t('marketplace.card.registeredBreeder')}</span>}
          {hasHealthPassport && <span className="mp-metric cert" title="Vaccination records verified in waytovet system">🏥 {t('marketplace.card.healthPassport')}</span>}
          {isFairDeal && <span className="mp-metric si-7cbce2ec">💚 {t('marketplace.card.fairDeal')} ({fairDealPct}%)</span>}
          {isPremiumPriced && <span className="mp-metric si-aa4985c8">⭐ {t('marketplace.card.premiumPriced')}</span>}
        </div>

        {/* Price */}
        <div className="mp-card-price">
          {l.price ? formatCurrency(l.price) : t('marketplace.card.contact')}
          {listingType === 'auction' && bidCount && <span className="mp-bid-count">{bidCount} {t('marketplace.units.listings').replace('listings', 'bids')}</span>}
        </div>

        {/* Footer */}
        <div className="mp-card-footer">
          <span>{sellerName || t('marketplace.genderLabel.unknown')}</span>
          <span>{viewsCount || 0} {t('marketplace.units.views')}</span>
        </div>

        {/* Tags */}
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
