import React from 'react'
import type { TFunction } from 'i18next'
import type { NearMeState } from '../../hooks/useNearMe'

/** The "Near me" chip, its radius and any explanation - shared by the signed-in and the public marketplace. */
export const NearMeBar: React.FC<{ nearMe: NearMeState; t: TFunction }> = ({ nearMe, t }) => (
  <div className="mp-proximity-bar">
    <button type="button" className={`mp-chip ${nearMe.active ? 'active' : ''}`} onClick={nearMe.toggle}>
      📍 {nearMe.active ? t('marketplace.proximity.nearMeOn', 'Near Me ON') : t('marketplace.proximity.nearMe', 'Near Me')}
    </button>
    {nearMe.active && (
      <select className="module-input mp-radius-select" value={nearMe.radiusKm} onChange={e => nearMe.setRadiusKm(e.target.value)} aria-label={t('marketplace.proximity.searching', 'Searching within')}>
        {['5', '10', '25', '50', '100'].map(km => <option key={km} value={km}>{km} km</option>)}
      </select>
    )}
    {nearMe.active && nearMe.location && (
      <span className="mp-location-hint">{t('marketplace.proximity.searching', 'Searching within')} {nearMe.radiusKm} km</span>
    )}
    {nearMe.error && <span className="mp-location-error" role="alert">{nearMe.error}</span>}
  </div>
)
