import { useEffect, useState } from 'react'
import apiService from '../services/api'

/**
 * Reads the dark-launch master flag for the Grooming & Spa module (`grooming.enabled`).
 *
 * `GET /grooming/status` is deliberately public (no auth, no groomingEnabled gate) so the
 * unauthenticated Register page can use it too. The result is cached in a module-level promise:
 * the flag cannot change within a page session, and several components need it at once.
 *
 * Fails closed - if the probe errors the module stays hidden, which matches the backend, where
 * every other /grooming route 404s while the flag is off.
 */
let cachedProbe: Promise<boolean> | null = null

export function probeGroomingEnabled(): Promise<boolean> {
  if (!cachedProbe) {
    cachedProbe = apiService.groomingStatus()
      .then((res: any) => res?.data?.enabled === true)
      .catch(() => false)
  }
  return cachedProbe
}

/** Test/HMR escape hatch - drops the cached probe so the next call refetches. */
export function resetGroomingEnabledCache(): void {
  cachedProbe = null
}

export function useGroomingEnabled(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    probeGroomingEnabled().then(v => {
      if (!active) return
      setEnabled(v)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { enabled, loading }
}

export default useGroomingEnabled
