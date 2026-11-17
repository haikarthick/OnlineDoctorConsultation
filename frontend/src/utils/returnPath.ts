/**
 * Where to send a person after sign-in: the page they first asked for (kept by the route guard in
 * the navigation state, or - when their session ended mid-use - remembered for the next sign-in),
 * else the dashboard. Only same-app paths are honoured - never a full URL a crafted link could
 * point somewhere else with.
 */
function safePath(p: string | undefined | null, search?: string): string | null {
  if (p && p.startsWith('/') && !p.startsWith('//') && p !== '/login' && p !== '/register') return `${p}${search || ''}`
  return null
}

export function returnPathFrom(state: unknown, remembered?: string | null): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from
  return safePath(from?.pathname, from?.search) || safePath(remembered) || '/dashboard'
}

const RETURN_KEY = 'returnTo'
const ENDED_KEY = 'sessionEnded'

/** The session ended while the person was on this page: bring them back to it after signing in again. */
export function rememberSessionEnded(currentPath: string): void {
  try {
    sessionStorage.setItem(ENDED_KEY, '1')
    sessionStorage.setItem(RETURN_KEY, currentPath)
  } catch { /* storage unavailable: they simply land on the dashboard after signing in */ }
}

/** True once if the person was just signed out because their session ended (for the sign-in notice). */
export function takeSessionEnded(): boolean {
  try {
    const v = sessionStorage.getItem(ENDED_KEY) === '1'
    sessionStorage.removeItem(ENDED_KEY)
    return v
  } catch { return false }
}

/** The page remembered by rememberSessionEnded(), once. */
export function takeReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return v
  } catch { return null }
}
