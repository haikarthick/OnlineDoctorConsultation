import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

// English stays statically bundled (it's the fallback language, so it must
// be available with zero network round-trip and zero risk of a raw-key
// flash). The other 5 locales are fetched lazily via i18next-http-backend
// from public/locales/{{lng}}/translation.json - each is 400-500KB, and
// bundling all 6 into the JS entry chunk regardless of the user's chosen
// language used to account for ~85% of the initial bundle size.
import en from '../locales/en/translation.json'

export const supportedLanguages = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳' }
] as const

export const i18nInitialized = i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en }
    },
    // Only fetch languages not already covered by `resources` above.
    partialBundledLanguages: true,
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'ta', 'te', 'kn', 'ml'],
    interpolation: {
      escapeValue: false // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'vetcare_language'
    },
    react: {
      useSuspense: false
    }
  })

export default i18n
