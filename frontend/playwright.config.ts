import { defineConfig, devices } from '@playwright/test'

/**
 * VetCare Platform — Playwright E2E Configuration
 *
 * Usage:
 *   npm run test:e2e              — headless (CI-friendly)
 *   npm run test:e2e:headed       — visible browser
 *   npm run test:e2e:ui           — Playwright UI mode
 *   npm run test:e2e -- --grep "login" — run specific tests
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,           // Run serially — tests share server state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                     // Single worker — shared DB
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth setup — runs first, saves storage state for each role
    { name: 'auth-setup', testDir: './e2e', testMatch: 'global-setup.ts' },

    // Main tests — run against Chromium
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },
  ],
})
