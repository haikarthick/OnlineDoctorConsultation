import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface NearMeState {
  active: boolean
  setActive: (v: boolean) => void
  location: { lat: number; lng: number } | null
  radiusKm: string
  setRadiusKm: (v: string) => void
  /** A plain sentence for the person (what happened, what to do) - empty when all is well. */
  error: string
  toggle: () => void
}

/**
 * "Near me" for the marketplace: ask the device for its position once, then keep it while the person
 * browses. One implementation for the signed-in and the public page so they cannot drift apart.
 * A refusal or a device without location support is explained in words, never silently ignored.
 */
export function useNearMe(initialRadiusKm = '25'): NearMeState {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(initialRadiusKm)
  const [error, setError] = useState('')

  const toggle = useCallback(() => {
    if (active) { setActive(false); setError(''); return }
    if (!navigator.geolocation) {
      setError(t('marketplace.proximity.notSupported', 'Your phone or browser cannot share its location. Pick a state and district in Filters instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setActive(true); setError('') },
      () => setError(t('marketplace.proximity.denied', 'Location access was denied. Allow it in your browser settings, or pick a state and district in Filters instead.')),
    )
  }, [active, t])

  return { active, setActive, location, radiusKm, setRadiusKm, error, toggle }
}
