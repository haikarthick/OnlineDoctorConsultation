import i18n from 'i18next'
import { serverErrorCode, userMessage } from './userMessage'

/**
 * A refusal the server sent with its own short code (e.g. RV_OWN_REVIEW) is said in the person's language from the screen's own
 * translations - `<namespace>.errors.<CODE>` - and anything else falls through to userMessage(). Use it where a screen has its
 * own refusals so the sentence is never English-only and never a status code.
 */
export function codedMessage(err: unknown, namespace: string, fallbackKey?: string, defaultText?: string): string {
  const code = serverErrorCode(err)
  const key = code ? `${namespace}.errors.${code}` : ''
  if (key && i18n.exists(key)) return i18n.t(key)
  return userMessage(err, fallbackKey, defaultText)
}
