import { useCallback, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

export interface SaveAction<TArgs extends unknown[]> {
  status: SaveStatus
  /** The server's own message when it sent one; otherwise the fallback given to the hook. */
  error: string
  /** True when the failure looks like "no connection" rather than the server refusing. */
  offline: boolean
  /** Run the save. A second call while one is in flight is ignored, so a double tap is harmless. */
  run: (...args: TArgs) => Promise<boolean>
  /** Run again with the arguments of the last attempt. */
  retry: () => Promise<boolean>
  /** Back to idle (e.g. when the form is edited after a failure or reused for the next entry). */
  reset: () => void
}

function messageFrom(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

/**
 * The shared way to save from any form - "never lose an entry".
 *
 *   - while saving, a repeated tap does nothing (no duplicate records)
 *   - on failure the caller's form state is untouched, so everything typed is still there, and
 *     `retry()` sends it again; the server's real message is shown, never a generic one
 *   - a dropped connection is reported as such (`offline`), not as the user's mistake
 *
 * Pair it with <SaveState> for the status line. `fallbackError` is only used when the server
 * sent no message at all.
 */
export function useSaveAction<TArgs extends unknown[]>(
  save: (...args: TArgs) => Promise<unknown>,
  fallbackError: string,
): SaveAction<TArgs> {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const inFlight = useRef(false)
  const lastArgs = useRef<TArgs | null>(null)

  const run = useCallback(async (...args: TArgs): Promise<boolean> => {
    if (inFlight.current) return false
    inFlight.current = true
    lastArgs.current = args
    setStatus('saving')
    setError('')
    setOffline(false)
    try {
      await save(...args)
      setStatus('saved')
      return true
    } catch (err: any) {
      // No response at all = the request never reached the server (signal dropped in the shed).
      const noResponse = !err?.response
      setOffline(noResponse || (typeof navigator !== 'undefined' && navigator.onLine === false))
      setError(messageFrom(err, fallbackError))
      setStatus('failed')
      return false
    } finally {
      inFlight.current = false
    }
  }, [save, fallbackError])

  const retry = useCallback(async (): Promise<boolean> => {
    if (!lastArgs.current) return false
    return run(...lastArgs.current)
  }, [run])

  const reset = useCallback(() => {
    setStatus('idle')
    setError('')
    setOffline(false)
  }, [])

  return { status, error, offline, run, retry, reset }
}
