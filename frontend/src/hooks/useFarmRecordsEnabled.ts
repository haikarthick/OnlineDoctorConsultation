import { useEffect, useState } from 'react'
import apiService from '../services/api'

/**
 * Reads the dark-launch flag for farm daily records (`farm.records.enabled`).
 *
 * Unlike the grooming probe this endpoint needs a signed-in user, so a failed probe is NOT cached:
 * a probe made before login (401) must not leave the module hidden for the rest of the session.
 * Only a real answer is remembered. Fails closed - if the probe errors, the module stays hidden,
 * which matches the backend (every other /farm-records route 404s while the flag is off).
 */
let cached: Promise<boolean> | null = null

export function probeFarmRecordsEnabled(): Promise<boolean> {
  if (!cached) {
    cached = apiService.farmRecordsStatus()
      .then((res: any) => res?.data?.enabled === true)
      .catch(() => { cached = null; return false })
  }
  return cached
}

/** Test / sign-out escape hatch - the next call asks the server again. */
export function resetFarmRecordsEnabledCache(): void {
  cached = null
}

export function useFarmRecordsEnabled(isSignedIn: boolean): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(isSignedIn)

  useEffect(() => {
    if (!isSignedIn) { setEnabled(false); setLoading(false); return }
    let active = true
    setLoading(true)
    probeFarmRecordsEnabled().then(v => { if (active) { setEnabled(v); setLoading(false) } })
    return () => { active = false }
  }, [isSignedIn])

  return { enabled, loading }
}

export default useFarmRecordsEnabled
