import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing } from '../../types'
import { cldCardImageProps } from '../../utils/media'
import { useMasterData } from '../../context/MasterDataContext'
import { CATEGORY_ICONS, g } from './publicListingShared'

// ─── Public Listing Card (reuses marketplace CSS) ───
export const PublicListingCard: React.FC<{ listing: MarketplaceListing; formatCurrency: (n: number) => string; onView: () => void; t: TFunction }> = ({ listing: l, formatCurrency, onView, t }) => {
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
