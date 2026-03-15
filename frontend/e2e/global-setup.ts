import { test as setup } from '@playwright/test'

/**
 * Global setup — verifies the app is reachable before running tests.
 * Playwright runs this first (declared in playwright.config.ts).
 */
setup('verify app is reachable', async ({ page }) => {
  // Health check — just make sure the app loads
  await page.goto('/', { timeout: 30_000 })
  await page.waitForLoadState('domcontentloaded')
})
