import { test as base, expect, Page, BrowserContext } from '@playwright/test'
import { USERS, UserKey, authStatePath } from './constants'

/**
 * VetCare E2E — Custom Fixtures
 *
 * Provides pre-authenticated page contexts for each role.
 * Usage:
 *   test('my test', async ({ petOwnerPage }) => { ... })
 *   test('admin test', async ({ adminPage }) => { ... })
 */

// ── Auth helper: login via UI and return storage state ──────
export async function loginAs(page: Page, userKey: UserKey): Promise<void> {
  const user = USERS[userKey]
  await page.goto('/login')
  await page.fill('#login-email', user.email)
  await page.fill('#login-password', user.password)
  await page.click('.login-submit')
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.locator('.sidebar, .nav-sidebar, .navigation')).toBeVisible({ timeout: 10_000 })
}

// ── Reusable helper: navigate via sidebar click ─────────────
export async function navigateTo(page: Page, path: string): Promise<void> {
  // Try sidebar nav link first, fall back to direct navigation
  const navLink = page.locator(`nav a[href="${path}"], .sidebar a[href="${path}"], .nav-sidebar a[href="${path}"]`)
  if (await navLink.count() > 0) {
    await navLink.first().click()
    await page.waitForLoadState('networkidle')
  } else {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
}

// ── Helper: fill form fields by label or id ─────────────────
export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    const el = page.locator(selector)
    await el.scrollIntoViewIfNeeded()
    await el.fill(value)
  }
}

// ── Helper: assert page loaded (no crash, no redirect to login) ──
export async function assertPageLoaded(page: Page, expectedPath: string): Promise<void> {
  // Should not be redirected to login page
  await expect(page).not.toHaveURL(/\/login/)
  // Should contain the expected path (allow query params)
  expect(page.url()).toContain(expectedPath)
  // Page should not show a full-page error
  const errorBanner = page.locator('.error-page, .error-boundary, [role="alert"]')
  const count = await errorBanner.count()
  if (count > 0) {
    const text = await errorBanner.first().textContent()
    // Allow "no data" or "empty" type messages
    if (text && /crash|fatal|unexpected|500/i.test(text)) {
      throw new Error(`Page ${expectedPath} shows error: ${text}`)
    }
  }
}

// ── Helper: assert access denied (redirected to /dashboard) ──
export async function assertAccessDenied(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
}

// ── Custom test fixture type ────────────────────────────────
type RoleFixtures = {
  adminPage: Page
  vetPage: Page
  petOwnerPage: Page
  farmerPage: Page
}

// ── Create authenticated context for a role ─────────────────
async function createRolePage(
  browser: BrowserContext,
  userKey: UserKey,
): Promise<Page> {
  const page = await browser.newPage()
  await loginAs(page, userKey)
  return page
}

// Extended test with role-based page fixtures
export const test = base.extend<RoleFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'admin')
    await use(page)
    await context.close()
  },
  vetPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'vet1')
    await use(page)
    await context.close()
  },
  petOwnerPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'petOwner1')
    await use(page)
    await context.close()
  },
  farmerPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'farmer1')
    await use(page)
    await context.close()
  },
})

export { expect }
