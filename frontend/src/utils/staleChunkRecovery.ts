/**
 * Recovery from a stale lazy-loaded chunk after a deploy.
 *
 * Vite fingerprints every code-split chunk (EnterpriseManagement-Bwry8HSo.js). A deploy
 * rebuilds them under new hashes and the old files stop existing. Any browser that had the app
 * open across that deploy is still running the PREVIOUS index.html, so the next navigation to
 * a lazily-loaded route asks for a filename the server no longer has, and the dynamic import
 * rejects with "Failed to fetch dynamically imported module".
 *
 * Nothing is actually broken - the user's app is simply out of date - and reloading fixes it
 * every time. Making the user work that out from a generic "Something went wrong" screen is
 * the failure. This reloads once, automatically.
 *
 * The one-shot guard matters: if a reload does NOT fix it (a genuinely missing chunk, a broken
 * deploy, an offline cache serving something odd) then reloading again would loop forever and
 * the user could never see the error. So we reload at most once per session per URL, then let
 * the error surface normally.
 */

const GUARD_KEY = 'vetcare:chunk-reload'

/** Vite's own message, plus the Firefox/Safari wordings for the same failure. */
const STALE_CHUNK_PATTERNS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'expected a javascript module script',           // server answered with HTML
  "expected a javascript-or-wasm module script",
  'unable to preload css',
]

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string' ? error : ''
  if (!message) return false
  const lower = message.toLowerCase()
  return STALE_CHUNK_PATTERNS.some(p => lower.includes(p))
}

/**
 * Reload once to pick up the current index.html. Returns false if we have already tried for
 * this URL in this tab, in which case the caller should surface the error instead.
 */
export function reloadForStaleChunk(): boolean {
  let alreadyTried = false
  try {
    alreadyTried = sessionStorage.getItem(GUARD_KEY) === location.pathname
    if (!alreadyTried) sessionStorage.setItem(GUARD_KEY, location.pathname)
  } catch {
    // Private mode / storage disabled: better to reload once than to loop, so treat an
    // unreadable guard as "already tried" and let the error show.
    return false
  }
  if (alreadyTried) return false

  // reload() re-requests the document; navigation is network-first in the service worker, so
  // this genuinely fetches the new index.html rather than replaying the cached shell.
  location.reload()
  return true
}

/**
 * Release the guard so a LATER deploy can recover in this same tab, but only after the app has
 * stayed up for a while.
 *
 * The delay is the whole point. Clearing it the instant we render would re-arm the reload
 * before the failing route had a chance to fail again: a genuinely missing chunk (broken
 * deploy, not a stale one) would then reload -> render -> clear -> import -> fail -> reload,
 * forever, and the user would never get to see the error. A chunk import fails within a second
 * or so of render, long inside this window, so a real loop stays blocked while an ordinary
 * session clears normally.
 */
const GUARD_RELEASE_MS = 30_000

export function scheduleStaleChunkGuardRelease(): void {
  setTimeout(() => {
    try { sessionStorage.removeItem(GUARD_KEY) } catch { /* storage disabled - nothing to clear */ }
  }, GUARD_RELEASE_MS)
}

/**
 * Vite fires `vite:preloadError` when its preload helper cannot fetch a chunk. Catching it
 * here recovers before the failure ever reaches React, so the user sees a reload rather than
 * an error screen.
 */
export function installStaleChunkRecovery(): void {
  window.addEventListener('vite:preloadError', event => {
    // Prevent Vite's default rethrow: we are handling it by reloading.
    event.preventDefault()
    if (!reloadForStaleChunk()) {
      // Second time around - let it through so the ErrorBoundary can show something real.
      console.error('[vetcare] chunk still missing after reload', event.payload)
    }
  })

  // A rejected import() that Vite's helper did not wrap still lands here.
  window.addEventListener('unhandledrejection', event => {
    if (isStaleChunkError(event.reason)) {
      event.preventDefault()
      reloadForStaleChunk()
    }
  })
}
