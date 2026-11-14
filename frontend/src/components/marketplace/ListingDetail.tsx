import React, { useState } from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing, MarketplaceBid } from '../../types'
import { cldCardImageProps, cldDetailImageProps } from '../../utils/media'
import { useMasterData } from '../../context/MasterDataContext'
import { CATEGORY_ICONS, g } from './publicListingShared'
import { AuctionCountdown } from './AuctionCountdown'

// ─── Listing Detail Component ───
export const ListingDetail: React.FC<{
  listing: MarketplaceListing; bids: MarketplaceBid[]; formatCurrency: (n: number) => string;
  bidAmount: string; bidMessage: string; onBidAmountChange: (v: string) => void; onBidMessageChange: (v: string) => void;
  onPlaceBid: () => void; onBuyNow: () => void; onBack: () => void;
  isAdmin: boolean; onToggleHotDeal: (id: string, v: boolean) => void; onToggleFeatured: (id: string, v: boolean) => void;
  userId?: string; onRequestContact?: () => void;
  isFavorite?: boolean; onToggleFavorite?: () => void; onMessageSeller?: () => void;
  onReport?: () => void; onBookVetCheck?: () => void; transport?: { url: string };
  t: TFunction;
}> = ({ listing: l, bids, formatCurrency, bidAmount, bidMessage, onBidAmountChange, onBidMessageChange, onPlaceBid, onBuyNow, onBack, isAdmin, onToggleHotDeal, onToggleFeatured, userId, onRequestContact, isFavorite, onToggleFavorite, onMessageSeller, onReport, onBookVetCheck, transport, t }) => {
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
  const contact = g(l, 'contactPhone', 'contact_phone')
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
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  return (
    <div className="mp-detail">
      <button className="module-btn small" onClick={onBack}>{t('marketplace.detail.backToListings')}</button>

      <div className="mp-detail-layout">
        <div className="mp-detail-main">
          {/* Header badges */}
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

          <div className="mp-detail-title-row">
            <h2>{l.title}</h2>
            <div className="mp-detail-title-actions">
              {onToggleFavorite && (
                <button className={`mp-fav-btn inline ${isFavorite ? 'active' : ''}`} onClick={onToggleFavorite}
                  title={isFavorite ? t('marketplace.engagement.removeFavorite') : t('marketplace.engagement.addFavorite')}>
                  {isFavorite ? '❤️' : '🤍'}
                </button>
              )}
              {onMessageSeller && userId && l.seller_id !== userId && (
                <button className="module-btn small" onClick={onMessageSeller}>💬 {t('marketplace.engagement.messageSeller')}</button>
              )}
            </div>
          </div>
          <p className="mp-sell-step-desc">{l.description || t('marketplace.detail.noDescription')}</p>

          {/* Price */}
          <div className="mp-detail-price">{l.price ? formatCurrency(l.price) : t('marketplace.contactForPrice')}</div>

          {/* Video */}
          {(() => {
            const videoUrl = g(l, 'videoUrl', 'video_url')
            if (!videoUrl) return null
            const isUploaded = String(videoUrl).startsWith('/uploads/') || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoUrl)
            return (
              <div className="mp-detail-video">
                {isUploaded ? (
                  <video controls preload="metadata" src={videoUrl} className="mp-detail-video-el" />
                ) : (
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="module-btn small">▶ {t('marketplace.detail.watchVideo')}</a>
                )}
              </div>
            )
          })()}

          {/* Animal Profile Section */}
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

          {/* Health Section */}
          <div className="mp-detail-section">
            <h3>{t('marketplace.detail.healthCert')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.vaccination')}</span><span className="mp-detail-value">{vax ? ({ fully_vaccinated: t('marketplace.vaxLabel.fully'), partially_vaccinated: t('marketplace.vaxLabel.partial'), not_vaccinated: t('marketplace.vaxLabel.none'), unknown: t('marketplace.vaxLabel.unknown') } as Record<string, string>)[vax] || vax : t('marketplace.genderLabel.unknown')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.reviewLabels.healthCert')}</span><span className="mp-detail-value">{hasCert ? t('marketplace.reviewLabels.yes') : t('marketplace.reviewLabels.no')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.livestock.condition')}</span><span className="mp-detail-value">{l.condition}</span></div>
            </div>
          </div>

          {/* Seller & Location */}
          <div className="mp-detail-section">
            <h3>{t('marketplace.detail.sellerLocation')}</h3>
            <div className="mp-detail-grid">
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.seller')}</span><span className="mp-detail-value">{sellerName || t('marketplace.genderLabel.unknown')}</span></div>
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.detail.location')}</span><span className="mp-detail-value">{l.location || t('marketplace.detail.notSpecified')}</span></div>
              <div className="mp-detail-item">
                <span className="mp-detail-label">{t('marketplace.livestock.contact')}</span>
                <span className="mp-detail-value">
                  {contact ? (
                    <div className="mp-contact-actions">
                      <span>{contact}</span>
                      <a href={`https://wa.me/${contact.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in your listing: ${l.title}`)}`}
                        target="_blank" rel="noopener noreferrer" className="mp-contact-btn whatsapp"
                        onClick={e => e.stopPropagation()}>
                        💬 WhatsApp
                      </a>
                      <a href={`tel:${contact}`} className="mp-contact-btn call" onClick={e => e.stopPropagation()}>
                        📞 {t('marketplace.detail.call')}
                      </a>
                    </div>
                  ) : userId && l.seller_id !== userId ? (
                    <div>
                      <span className="si-7b05444b">{t('marketplace.detail.contactHidden')}</span>
                      {onRequestContact && (
                        <button className="module-btn small si-5dc995a0" onClick={onRequestContact}>
                          📩 {t('marketplace.detail.requestContact')}
                        </button>
                      )}
                    </div>
                  ) : <span className="si-e70e9abd">-</span>}
                </span>
              </div>
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
              <div className="mp-detail-item"><span className="mp-detail-label">{t('marketplace.compliance.termsStatus')}</span><span className="mp-detail-value">✅ {t('marketplace.compliance.accepted')}</span></div>
            </div>
            <div className="mp-compliance-info">{t('marketplace.compliance.detailDisclaimer')}</div>
          </div>

          {tags.length > 0 && (
            <div className="mp-card-tags">
              {tags.map((tag: string) => <span key={tag} className="mp-tag">{tag}</span>)}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="mp-admin-bg">
              <h3>{t('marketplace.detail.adminControls')}</h3>
              <div className="mp-action-cluster">
                <button className="module-btn small" onClick={() => onToggleHotDeal(l.id, isHot || false)}>{isHot ? t('marketplace.detail.removeHotDeal') : t('marketplace.detail.makeHotDeal')}</button>
                <button className="module-btn small" onClick={() => onToggleFeatured(l.id, l.featured || false)}>{l.featured ? t('marketplace.detail.unfeature') : t('marketplace.detail.feature')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Buy/Bid panel */}
        <div className="mp-detail-sidebar">
          {(l.seller_id && l.seller_id === userId) ? (
            <div className="mp-buy-panel">
              <h4>{t('marketplace.detail.yourListing')}</h4>
              <p className="mp-sell-step-desc">{t('marketplace.detail.yourListingDesc')}</p>
            </div>
          ) : listingType !== 'auction' ? (
            <div className="mp-buy-panel">
              <h4>🤝 {t('marketplace.deal.reserveTitle')}</h4>
              <div className="mp-buy-price">{l.price ? formatCurrency(l.price) : t('marketplace.detail.contactSeller')}</div>
              <div className="mp-sell-step-desc">{t('marketplace.orders.qty')}: {l.quantity} {l.unit || t('marketplace.units.head')}</div>
              {/* Free-classifieds deal: how it works */}
              <div className="mp-deal-steps">
                <div className="mp-deal-step"><span className="mp-deal-step-num">1</span>{t('marketplace.deal.howStep1')}</div>
                <div className="mp-deal-step"><span className="mp-deal-step-num">2</span>{t('marketplace.deal.howStep2')}</div>
                <div className="mp-deal-step"><span className="mp-deal-step-num">3</span>{t('marketplace.deal.howStep3')}</div>
                <div className="mp-deal-step"><span className="mp-deal-step-num">4</span>{t('marketplace.deal.howStep4')}</div>
              </div>
              <div className="mp-deal-free-note">{t('marketplace.deal.freeNote')}</div>
              {l.status === 'active' && <button className="module-btn primary" onClick={onBuyNow}>🤝 {t('marketplace.deal.reserveNow')}</button>}
              {l.status === 'reserved' && <div className="mp-deal-reserved-badge">⏳ {t('marketplace.deal.currentlyReserved')}</div>}
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
                  <span>{t('marketplace.detail.ends')} </span>
                  <AuctionCountdown endTime={auctionEnd} t={t} />
                  <div className="si-b1a83cef">{new Date(auctionEnd).toLocaleString()}</div>
                </div>
              )}
              <input className="module-input" type="number" placeholder={t('marketplace.detail.yourBidAmount')} value={bidAmount} onChange={e => onBidAmountChange(e.target.value)} />
              <textarea className="module-input" placeholder={t('marketplace.detail.messageOptional')} value={bidMessage} onChange={e => onBidMessageChange(e.target.value)} />
              <button className="module-btn primary" onClick={onPlaceBid}>{t('marketplace.detail.placeBidTitle')}</button>

              {bids.length > 0 && (
                <div className="mp-bid-history">
                  <h5>{t('marketplace.detail.placeBidTitle').replace('🔨 ', '')} ({bids.length})</h5>
                  {bids.slice(0, 8).map(b => (
                    <div key={b.id} className="mp-bid-row">
                      <span className="mp-bid-row-amount">{formatCurrency(b.amount)}</span>
                      <span>{g(b, 'bidderName', 'bidder_name')}</span>
                      {(g(b, 'isWinning', 'is_winning')) && <span className="mp-bid-winning">{t('marketplace.detail.leading')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paid-services funnel: pre-purchase vet check (only for animal listings, non-owners) */}
          {onBookVetCheck && l.category === 'animal' && userId && l.seller_id !== userId && (
            <div className="mp-vetcheck-panel">
              <div className="mp-vetcheck-title">🩺 {t('marketplace.services.vetCheckTitle')}</div>
              <p className="mp-vetcheck-desc">{t('marketplace.services.vetCheckDesc')}</p>
              <button className="module-btn primary" onClick={onBookVetCheck}>{t('marketplace.services.bookVetCheck')}</button>
            </div>
          )}

          {/* Transport referral (config-driven) */}
          {transport && userId && l.seller_id !== userId && (
            <div className="mp-transport-panel">
              <span>🚚 {t('marketplace.services.transportDesc')}</span>
              <a className="module-btn small" href={transport.url} target="_blank" rel="noopener noreferrer">{t('marketplace.services.arrangeTransport')}</a>
            </div>
          )}

          {/* Report */}
          {onReport && (
            <button className="mp-report-link" onClick={onReport}>🚩 {t('marketplace.report.reportListing')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
