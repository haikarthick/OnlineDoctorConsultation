import React from 'react'
import type { TFunction } from 'i18next'
import { INDIAN_STATES } from '../../constants/indianStates'

export const SellStep3Pricing: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void;
  currency: string;
  priceHint: { avg: number; min: number; max: number; count: number } | null;
  formatCurrency: (n: number) => string;
  geoLocating: boolean; onUseMyLocation: () => void;
  onBack: () => void; onReview: () => void; t: TFunction;
}> = ({ sellForm, sf, currency, priceHint, formatCurrency, geoLocating, onUseMyLocation, onBack, onReview, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.pricingTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.pricingDesc')}</p>
    <div className="module-form">
      <div className="module-form-row">
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.reviewLabels.price')} ({currency})</label>
          <input className="module-input" type="number" inputMode="decimal" value={sellForm.price} onChange={e => sf('price', e.target.value)} placeholder={t('marketplace.sell.pricePlaceholder')} />
        </div>
        {sellForm.listingType === 'auction' && (
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.sell.reservePrice')}</label>
            <input className="module-input" type="number" inputMode="decimal" value={sellForm.reservePrice} onChange={e => sf('reservePrice', e.target.value)} placeholder={t('marketplace.sell.reservePricePlaceholder')} />
          </div>
        )}
      </div>
      {/* Price suggestion from live market data */}
      {priceHint && (
        <div className="mp-price-hint">
          <div className="mp-price-hint-title">💡 {t('marketplace.sell.priceHintTitle')}</div>
          <div className="mp-price-hint-body">
            <span>{t('marketplace.sell.priceHintAvg')}: <strong>{formatCurrency(priceHint.avg)}</strong></span>
            <span>{t('marketplace.prices.min')}-{t('marketplace.prices.max')}: {formatCurrency(priceHint.min)} - {formatCurrency(priceHint.max)}</span>
            <span className="mp-price-hint-count">{t('marketplace.sell.priceHintBasis', { count: priceHint.count })}</span>
          </div>
          {sellForm.price && (() => {
            const p = +sellForm.price
            if (p > 0 && priceHint.avg > 0) {
              const pct = Math.round((p / priceHint.avg) * 100)
              if (pct < 85) return <div className="mp-price-hint-tag good">💚 {t('marketplace.card.fairDeal')} ({pct}%)</div>
              if (pct > 115) return <div className="mp-price-hint-tag high">⭐ {t('marketplace.card.premiumPriced')} ({pct}%)</div>
              return <div className="mp-price-hint-tag ok">✅ {t('marketplace.sell.priceHintFair')}</div>
            }
            return null
          })()}
        </div>
      )}
      {sellForm.listingType === 'auction' && (
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.sell.auctionEndTime')}</label>
          <input className="module-input" type="datetime-local" value={sellForm.auctionEndTime} onChange={e => sf('auctionEndTime', e.target.value)} />
        </div>
      )}
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.sell.location')}</label>
        <input className="module-input" value={sellForm.location} onChange={e => sf('location', e.target.value)} placeholder={t('marketplace.sell.locationPlaceholder')} />
        <div className="module-form-row">
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.filters.state')}</label>
            <select className="module-input" value={sellForm.state || ''} onChange={e => sf('state', e.target.value)}>
              <option value="">{t('marketplace.filters.anyState')}</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.filters.district')}</label>
            <input className="module-input" value={sellForm.district || ''} maxLength={80} onChange={e => sf('district', e.target.value)} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.filters.pincode')}</label>
            <input className="module-input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={sellForm.pincode || ''} onChange={e => sf('pincode', e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div className="mp-geo-row">
          <button type="button" className="module-btn small" onClick={onUseMyLocation} disabled={geoLocating}>
            📍 {geoLocating ? t('marketplace.sell.locating') : t('marketplace.sell.useMyLocation')}
          </button>
          {sellForm.latitude && sellForm.longitude && (
            <span className="mp-geo-set">✅ {t('marketplace.sell.locationSet')}</span>
          )}
        </div>
        <div className="mp-compliance-hint">{t('marketplace.sell.locationGeoHint')}</div>
      </div>
    </div>
    <div className="mp-step-actions">
      <button className="module-btn" onClick={onBack}>{t('marketplace.sell.back')}</button>
      <button className="module-btn primary" onClick={onReview}>{t('marketplace.sell.review')}</button>
    </div>
  </div>
)
