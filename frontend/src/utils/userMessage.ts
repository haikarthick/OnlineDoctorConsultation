import i18n from 'i18next'

/**
 * The words a person sees when something fails - the ONE place a caught error becomes text.
 *
 * Rule (CLAUDE.md "users never see error codes"): never show `err.message`, a status code, or
 * "Request failed with status code 404". The server's own readable message wins (it says what is
 * wrong for THIS request); otherwise a specific translated sentence says what happened and what to
 * do next. Use this everywhere an error is shown:
 *
 *     } catch (err) { setError(userMessage(err, 'animals.saveFailed')) }
 *
 * `fallbackKey` is the screen's own translated "could not do X" sentence, used only when the server
 * gave nothing readable and the failure is not one of the common cases below. `defaultText` is the
 * English used if that key has no translation yet.
 */

/** A server message a person can read: plain words, not a code, a status line or a stack. */
export function isReadableMessage(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = s.trim()
  if (m.length < 3 || m.length > 400) return false
  if (/status code|^request failed|network error|timeout of|^error:|^\[object|^undefined$|^null$/i.test(m)) return false
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(m)) return false // INTERNAL_SERVER_ERROR, VALIDATION_ERROR
  if (/^(?:E[A-Z]{3,}|[45]\d\d)\b/.test(m) && m.split(/\s+/).length <= 3) return false // ECONNRESET, "404", "500 Internal"
  if (/\bat [\w.<>]+ \(.*:\d+:\d+\)/.test(m)) return false // stack frame
  return true
}

/**
 * An error whose message was written FOR the person (a server reply the sign-in flow passes on, or a
 * validation sentence). userMessage() shows these as they are; every other Error is treated as a
 * developer error and replaced with a plain sentence.
 */
export class UserFacingError extends Error {
  accountStatus?: string
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

const NETWORK_WORDS = /network|offline|failed to fetch|load failed|fetch failed|aborted|econn|enotfound/i

interface ErrorLike {
  response?: { status?: number; data?: any }
  isTimeout?: boolean
  code?: string
}

export function userMessage(err: unknown, fallbackKey?: string, defaultText?: string): string {
  const e = (err || {}) as ErrorLike
  const data = e.response?.data
  const server = [data?.error?.message, typeof data?.error === 'string' ? data.error : undefined, data?.message]
    .find(isReadableMessage)
  if (server) return server

  const t = i18n.t.bind(i18n)
  if (e.isTimeout) return t('errors.slowServer')
  if (!e.response) {
    // A readable message from OUR OWN code (e.g. the sign-in flow throws 'Invalid email or password') is
    // for the person. A transport failure (axios / fetch) is not: the request never reached the server.
    const own = err instanceof UserFacingError ? err.message : ''
    if (isReadableMessage(own) && !NETWORK_WORDS.test(own)) return own
    // Only a real transport failure is "offline"; a developer error falls through to the screen's own sentence.
    const transport = (err as any)?.isAxiosError || err instanceof TypeError || NETWORK_WORDS.test(String((err as any)?.message || '')) || e.code === 'ERR_NETWORK'
    if (transport) return t('errors.offline')
    return fallbackKey ? t(fallbackKey, { defaultValue: defaultText || t('errors.generic') }) : (defaultText || t('errors.generic'))
  }

  const status = e.response.status || 0
  if (status === 401) return t('errors.sessionEnded')
  if (status === 403) return t('errors.forbidden')
  if (status === 404) return t('errors.notFound')
  if (status === 409) return t('errors.conflict')
  if (status === 429) return t('errors.tooManyRequests')
  if (status >= 500) return t('errors.serverTrouble')
  if (fallbackKey) return t(fallbackKey, { defaultValue: defaultText || t('errors.generic') })
  return defaultText || t('errors.generic')
}
