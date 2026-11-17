import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import i18n from 'i18next'

// userMessage() uses the global i18next instance. With no resources a missing key returns the key
// itself, so tests can assert on 'errors.offline' etc. without depending on real translations.
void i18n.init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } })

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
