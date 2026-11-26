import i18n from 'i18next'
import { serverErrorCode, userMessage } from '../../utils/userMessage'

/**
 * The words for a failed correction. A refusal that carries one of this module's codes is said in the person's language here
 * (these sentences live in this module's own locale file); everything else goes through the one shared error-to-words function.
 */
export function correctionError(err: unknown): string {
  const code = serverErrorCode(err)
  if (code && i18n.exists(`recordCorrections.errors.${code}`)) return i18n.t(`recordCorrections.errors.${code}`)
  return userMessage(err, 'recordCorrections.errors.generic')
}
