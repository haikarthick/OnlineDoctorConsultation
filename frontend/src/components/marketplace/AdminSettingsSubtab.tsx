import React from 'react'
import type { TFunction } from 'i18next'

export const AdminSettingsSubtab: React.FC<{
  auctionEnabled: boolean; onAuctionToggle: () => void;
  monetizationSettings: any[]; onToggleSetting: (key: string, current: boolean) => void; t: TFunction;
}> = ({ auctionEnabled, onAuctionToggle, monetizationSettings, onToggleSetting, t }) => (
  <div>
    {/* Auction Feature Toggle - prominent card */}
    <div className="mp-section">
      <h3 className="mp-section-title">🔨 {t('marketplace.admin.auctionFeature', 'Auction Feature')}</h3>
      <div className={`mp-setting-card ${auctionEnabled ? 'enabled' : ''} si-197ba518`}>
        <div className="mp-setting-header">
          <span className="mp-setting-icon">🔨</span>
          <div className="mp-setting-info">
            <h4>{t('marketplace.admin.auctionTitle', 'Live Auction Bidding')}</h4>
            <p className="si-48a0b045">
              {auctionEnabled
                ? t('marketplace.admin.auctionEnabledDesc', 'Auctions are LIVE. Users can create auction listings and place bids.')
                : t('marketplace.admin.auctionDisabledDesc', 'Auctions are DISABLED platform-wide. Legal review pending. Enable only after legal clearance.')}
            </p>
          </div>
          <label className="mp-toggle-switch">
            <input type="checkbox" checked={auctionEnabled} onChange={onAuctionToggle} />
            <span className="mp-toggle-slider"></span>
          </label>
        </div>
        <div className="mp-setting-status">
          <span className={`module-badge ${auctionEnabled ? 'success' : 'error'}`}>
            {auctionEnabled ? t('marketplace.monetization.active') : t('marketplace.monetization.inactive')}
          </span>
          <span className="mp-setting-category si-a213bf41">
            {t('marketplace.admin.auctionLegalNote', 'Consult legal before enabling in India')}
          </span>
        </div>
      </div>
    </div>
    <div className="mp-section">
      <h3 className="mp-section-title">{t('marketplace.monetization.featureToggles')}</h3>
      <p className="mp-monetization-note">{t('marketplace.monetization.allFreeNote')}</p>
      <div className="mp-settings-grid">
        {monetizationSettings.filter((s: any) => s.settingKey !== 'auction_enabled').map(s => {
          const SETTING_ICONS: Record<string, string> = {
            listing_fee: '📝', listing_boost: '🚀', subscription_plans: '💎',
            inquiry_fee: '📩', featured_seller: '⭐', transaction_fee: '💰',
            premium_analytics: '📊', priority_placement: '📌',
          }
          return (
            <div key={s.settingKey} className={`mp-setting-card ${s.isEnabled ? 'enabled' : ''}`}>
              <div className="mp-setting-header">
                <span className="mp-setting-icon">{SETTING_ICONS[s.settingKey] || '⚙️'}</span>
                <div className="mp-setting-info">
                  <h4>{t(`marketplace.monetization.settings.${s.settingKey}.title`)}</h4>
                  <p>{t(`marketplace.monetization.settings.${s.settingKey}.desc`)}</p>
                </div>
                <label className="mp-toggle-switch">
                  <input type="checkbox" checked={s.isEnabled} onChange={() => onToggleSetting(s.settingKey, s.isEnabled)} />
                  <span className="mp-toggle-slider"></span>
                </label>
              </div>
              <div className="mp-setting-status">
                <span className={`module-badge ${s.isEnabled ? 'success' : ''}`}>
                  {s.isEnabled ? t('marketplace.monetization.active') : t('marketplace.monetization.inactive')}
                </span>
                <span className="mp-setting-category">{s.category}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)
