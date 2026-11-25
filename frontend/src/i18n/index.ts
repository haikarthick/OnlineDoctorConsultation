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
//
// English itself is split into src/locales/en/modules/*.json (grooming.json,
// pharmacy.json, ...) for editability - a single ~8,400-line file was
// unmanageable. Merged back into one `en` object at module-eval time via
// import.meta.glob, so this is the only place the split is visible; every
// translation call site elsewhere in the app is unaffected.
// Lazy (one chunk per module, fetched in parallel) so ~430KB of English text is not inside the entry chunk. main.tsx waits for
// `i18nInitialized` before it renders, so English is always loaded before the first screen - no raw-key flash.
const enModules = import.meta.glob('../locales/en/modules/*.json') as Record<string, () => Promise<{ default: Record<string, unknown> }>>
async function loadEnglish(): Promise<Record<string, unknown>> {
  const en: Record<string, unknown> = {}
  const mods = await Promise.all(Object.values(enModules).map(load => load()))
  for (const mod of mods) {
    for (const key of Object.keys(mod.default)) {
      if (Object.prototype.hasOwnProperty.call(en, key)) {
        throw new Error(`[i18n] Duplicate top-level key "${key}" across en/modules/*.json files.`)
      }
      en[key] = mod.default[key]
    }
  }
  return en
}

export const supportedLanguages = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳' }
] as const

export const i18nInitialized = loadEnglish().then(en => i18n
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
  }))

export default i18n
