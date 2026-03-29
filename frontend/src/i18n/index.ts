import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '../locales/en/translation.json'
import hi from '../locales/hi/translation.json'
import ta from '../locales/ta/translation.json'
import te from '../locales/te/translation.json'
import kn from '../locales/kn/translation.json'
import ml from '../locales/ml/translation.json'

export const supportedLanguages = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳' }
] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ta: { translation: ta },
      te: { translation: te },
      kn: { translation: kn },
      ml: { translation: ml }
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
