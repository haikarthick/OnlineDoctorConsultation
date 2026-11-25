import i18n from 'i18next'

const TAGS: Record<string, string> = { hi: 'hi-IN', kn: 'kn-IN', ml: 'ml-IN', ta: 'ta-IN', te: 'te-IN' }

/**
 * The locale every date and time is formatted in: the language the person chose, so a Hindi screen shows a Hindi date instead of
 * "Wednesday, November 25, 2026". English returns undefined, which keeps the browser's own English format exactly as before.
 * ONE place decides; screens never hard-code a locale for a date.
 */
export function appLocale(): string | undefined {
  const lang = (i18n.language || 'en').slice(0, 2)
  return TAGS[lang]
}
