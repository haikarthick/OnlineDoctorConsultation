import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { TFunction } from 'i18next'
import { MarketplaceListing } from '../../types'
import { cldCardImageProps, cldDetailImageProps } from '../../utils/media'
import { useMasterData } from '../../context/MasterDataContext'
import { CATEGORY_ICONS, g } from './publicListingShared'

// ─── Public Listing Detail (with login gates) ───
export const PublicListingDetail: React.FC<{
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
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.welfareStatus')}</span><span className="mp-detail-value">{welfareAtt ? '✅ ' + t('marketplace.compliance.attested') : '-'}</span></div>
            </div>
            <div className="mp-compliance-info">{t('marketplace.compliance.detailDisclaimer')}</div>
          </div>

          {tags.length > 0 && (
            <div className="mp-card-tags si-b0aee75b">
              {tags.map((tag: string) => <span key={tag} className="mp-tag">{tag}</span>)}
            </div>
          )}
        </div>

        {/* Sidebar - Login Gate */}
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
