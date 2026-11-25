import { test as base, expect, Page, BrowserContext } from '@playwright/test'
import { USERS, UserKey, authStatePath } from './constants'

/**
 * VetCare E2E - Custom Fixtures
 *
 * Provides pre-authenticated page contexts for each role.
 * Usage:
 *   test('my test', async ({ petOwnerPage }) => { ... })
 *   test('admin test', async ({ adminPage }) => { ... })
 */

// ── Auth helper: login via UI and return storage state ──────
/**
 * On a person's FIRST visit the app's service worker installs, takes control of the page and the app then reloads the page once
 * (frontend/src/pwa.ts: controllerchange -> location.reload(), about 0.4 s after load on a fast machine, later on a slow one).
 * Anything typed before that reload is wiped. A test must therefore wait for that one reload to be over before it types.
 * (Reported as an app defect: a first-time visitor on a slow connection loses what they typed, see the QA report.)
 */
export async function settleServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller, null, { timeout: 15_000 }).catch(() => undefined)
  // the reload (if one is coming) starts right after the controller is set: let it finish, then the page is stable
  await page.waitForTimeout(800)
  await page.waitForLoadState('load')
}

export async function loginAs(page: Page, userKey: UserKey): Promise<void> {
  const user = USERS[userKey]
  await page.goto('/login')
  await settleServiceWorker(page)
  // Fill both boxes and PROVE both still hold the typed text before pressing the button; a page that was reloaded underneath us
  // would otherwise submit an empty email and the test would fail 15 s later with a misleading "no dashboard" timeout.
  let filled = false
  for (let attempt = 0; attempt < 4 && !filled; attempt++) {
    await page.fill('#login-email', user.email)
    await page.fill('#login-password', user.password)
    filled = (await page.inputValue('#login-email')) === user.email && (await page.inputValue('#login-password')) === user.password
    if (!filled) await page.waitForTimeout(500)
  }
  expect(filled, `the sign-in form lost the typed email or password for ${user.email} (page reloaded while typing?)`).toBe(true)
  await page.click('.login-submit')
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  // The main navigation is the sidebar on a desktop and the bottom tab bar on a phone or tablet; either proves the signed-in layout.
  await expect(page.locator('.sidebar:visible, .nav-sidebar:visible, .navigation:visible, nav.bottom-tabbar:visible').first()).toBeVisible({ timeout: 10_000 })
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
  // A refusal is never silent: the person is sent to their dashboard or shown a plain explanation with a way back (no error code).
  const explained = page.getByRole('alert').filter({ hasText: /don't have access/i })
  await expect.poll(async () => /\/dashboard/.test(page.url()) || (await explained.count()) > 0, { timeout: 10_000 }).toBe(true)
  const text = (await page.textContent('body')) || ''
  expect(text).not.toMatch(/\b(403|404|500)\b|Request failed with status/)
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
