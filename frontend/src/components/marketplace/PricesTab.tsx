import React from 'react'
import type { TFunction } from 'i18next'
import { MarketPriceData } from '../../types'

export const PricesTab: React.FC<{
  marketPrices: MarketPriceData[]; speciesLabel: (s: string, t: TFunction) => string; formatCurrency: (n: number) => string; t: TFunction;
}> = ({ marketPrices, speciesLabel, formatCurrency, t }) => (
  <div className="mp-section">
    <h3 className="mp-section-title">{t('marketplace.sections.marketPriceIntelligence')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.prices.subtitle')}</p>
    {marketPrices.length > 0 ? (
      <div className="data-table-container">
        <table className="module-table">
          <thead><tr><th>{t('marketplace.livestock.species')}</th><th>{t('marketplace.livestock.breed')}</th><th>{t('marketplace.prices.listings')}</th><th>{t('marketplace.prices.avgPrice')}</th><th>{t('marketplace.prices.min')}</th><th>{t('marketplace.prices.max')}</th><th>{t('marketplace.prices.avgMilkPerDay')}</th><th>{t('marketplace.prices.avgWeight')}</th></tr></thead>
          <tbody>
            {marketPrices.map((mp, i) => (
              <tr key={i}>
                <td><strong>{speciesLabel(mp.species, t)}</strong></td>
                <td>{mp.breed || '-'}</td>
                <td>{mp.total_listings}</td>
                <td className="mp-price-highlight">{formatCurrency(Math.round(mp.avg_price || 0))}</td>
                <td>{formatCurrency(Math.round(mp.min_price || 0))}</td>
                <td>{formatCurrency(Math.round(mp.max_price || 0))}</td>
                <td>{mp.avg_milk_yield ? `${Number(mp.avg_milk_yield).toFixed(1)}L` : '-'}</td>
                <td>{mp.avg_weight ? `${Number(mp.avg_weight).toFixed(0)} ${t('marketplace.units.kg')}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : <p className="mp-empty">{t('marketplace.prices.noData')}</p>}
  </div>
)
