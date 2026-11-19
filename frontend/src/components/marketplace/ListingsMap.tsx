import React, { Suspense } from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing } from '../../types'
import type { MapMarker } from '../MapView'

// Leaflet is a big chunk; it loads only when a person opens the map.
const MapView = React.lazy(() => import('../MapView'))

const num = (v: unknown): number | null => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n }

/** The pin position of a listing: the ~1 km rounded pin the server sends, never an exact farm location. */
export function listingPin(l: MarketplaceListing): { lat: number; lng: number } | null {
  const lat = num((l as any).map_lat), lng = num((l as any).map_lng)
  return lat !== null && lng !== null && !(lat === 0 && lng === 0) ? { lat, lng } : null
}

/** The current page of results on a map. Pins are approximate (about 1 km) on purpose. */
export const ListingsMap: React.FC<{
  listings: MarketplaceListing[]; formatCurrency: (n: number) => string;
  onOpen: (l: MarketplaceListing) => void; userLocation?: { lat: number; lng: number } | null; t: TFunction;
}> = ({ listings, formatCurrency, onOpen, userLocation, t }) => {
  const pinned = listings.map(l => ({ l, pin: listingPin(l) })).filter((x): x is { l: MarketplaceListing; pin: { lat: number; lng: number } } => !!x.pin)
  const markers: MapMarker[] = pinned.map(({ l, pin }) => ({
    id: l.id, lat: pin.lat, lng: pin.lng, color: '#667eea', title: l.title,
    popup: (
      <div className="mp-map-pop">
        <strong>{l.title}</strong>
        <div>{l.price ? formatCurrency(l.price) : t('marketplace.card.contact')}</div>
        {(l.district || l.state) && <div>📍 {[l.district, l.state].filter(Boolean).join(', ')}</div>}
        <button type="button" className="module-btn small primary" onClick={() => onOpen(l)}>{t('marketplace.mine.view')}</button>
      </div>
    ),
  }))
  if (userLocation) markers.push({ id: 'me', lat: userLocation.lat, lng: userLocation.lng, color: '#16a34a', pulse: true, title: t('marketplace.map.you') })

  return (
    <div className="mp-map-wrap">
      {pinned.length === 0 ? (
        <p className="mp-empty">{t('marketplace.map.none')}</p>
      ) : (
        <Suspense fallback={<div className="mp-loading">{t('marketplace.map.loading')}</div>}>
          <MapView height="min(70vh, 520px)" markers={markers} zoom={6} />
        </Suspense>
      )}
      <p className="mp-compliance-hint">
        {t('marketplace.map.approx')}
        {pinned.length > 0 && pinned.length < listings.length ? ` ${t('marketplace.map.someHidden', { count: listings.length - pinned.length })}` : ''}
      </p>
    </div>
  )
}
