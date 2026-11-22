import { useEffect, useState } from 'react'
import apiService from '../services/api'

/**
 * Reads the dark-launch flag for animal nutrition (`nutrition.enabled`). Same rules as
 * useFarmRecordsEnabled: a failed probe (e.g. made before sign-in) is not cached, only a real answer is;
 * it fails closed - every other /nutrition route 404s server-side while the flag is off.
 */
let cached: Promise<boolean> | null = null

export function probeNutritionEnabled(): Promise<boolean> {
  if (!cached) {
    cached = apiService.nutritionStatus()
      .then((res: any) => res?.data?.enabled === true)
      .catch(() => { cached = null; return false })
  }
  return cached
}

export function resetNutritionEnabledCache(): void {
  cached = null
}

export function useNutritionEnabled(isSignedIn: boolean): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(isSignedIn)

  useEffect(() => {
    if (!isSignedIn) { setEnabled(false); setLoading(false); return }
    let active = true
    setLoading(true)
    probeNutritionEnabled().then(v => { if (active) { setEnabled(v); setLoading(false) } })
    return () => { active = false }
  }, [isSignedIn])

  return { enabled, loading }
}

export default useNutritionEnabled
