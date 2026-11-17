import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceSavedSearch } from '../../types'

export const SavedSearchesTab: React.FC<{
  savedSearches: MarketplaceSavedSearch[]; onApplySearch: (s: MarketplaceSavedSearch) => void;
  onToggleAlerts: (s: MarketplaceSavedSearch) => void; onDeleteSearch: (id: string) => void; t: TFunction;
}> = ({ savedSearches, onApplySearch, onToggleAlerts, onDeleteSearch, t }) => (
  <div>
    <h3 className="mp-section-title">🔔 {t('marketplace.tabs.saved')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.engagement.savedSearchesDesc')}</p>
    {savedSearches.length === 0 ? (
      <p className="mp-empty">{t('marketplace.engagement.noSavedSearches')}</p>
    ) : (
      <div className="mp-saved-list">
        {savedSearches.map(s => {
          const chips = Object.entries(s.filters || {}).filter(([, v]) => v !== '' && v != null)
          return (
            <div key={s.id} className="mp-saved-card">
              <div className="mp-saved-main">
                <div className="mp-saved-name">{s.name}</div>
                <div className="mp-saved-chips">
                  {chips.length === 0 ? <span className="mp-saved-chip">{t('marketplace.engagement.allListings')}</span>
                    : chips.map(([k, v]) => <span key={k} className="mp-saved-chip">{k}: {String(v)}</span>)}
                </div>
              </div>
              <div className="mp-saved-actions">
                <button className="module-btn small primary" onClick={() => onApplySearch(s)}>{t('marketplace.engagement.applySearch')}</button>
                <button className={`module-btn small ${s.alertsEnabled ? '' : 'muted'}`} onClick={() => onToggleAlerts(s)}
                  title={s.alertsEnabled ? t('marketplace.engagement.alertsOn') : t('marketplace.engagement.alertsOff')}>
                  {s.alertsEnabled ? '🔔' : '🔕'}
                </button>
                <button className="module-btn small" onClick={() => onDeleteSearch(s.id)}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
)
