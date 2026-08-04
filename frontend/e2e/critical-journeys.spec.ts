import { test, expect, Page } from '@playwright/test'

/**
 * Critical UI journeys - the browser layer of the runtime gate.
 * ────────────────────────────────────────────────────────────
 * Run automatically as PHASE 7 of `backend/scripts/runtime-verify.js`, against the ephemeral
 * stack it builds: throwaway Postgres → real migrations → real compiled server serving the real
 * `frontend/dist`. That is production's exact topology (the API base is the relative `/api/v1`,
 * and the backend serves the SPA plus its client-side-routing fallback).
 *
 * WHY THIS FILE EXISTS, separate from the rest of e2e/:
 * the other specs need a pre-seeded, already-running app and are not wired into any gate.
 * These tests bring their own data - they register their users through the actual form - so
 * they can run on a database that is seconds old and still assert something meaningful.
 *
 * The gap being closed: runtime-verify PHASE 6 proves the API accepts each role. It cannot see
 * whether the SCREEN offers that role, whether submitting the form works, or whether the app
 * a new user lands in actually renders. The 2026-07-27 groomer bug was visible at both layers;
 * only the API layer was being checked.
 *
 * Tagged @critical so the gate can select exactly these.
 */

const UNIQUE = Date.now()

/** i18n namespaces used by the shell. A visible "nav.dashboard" means a key never resolved. */
const I18N_NAMESPACES = [
  'nav', 'register', 'login', 'settings', 'dashboard', 'common',
  'grooming', 'groomingFind', 'groomingBoard', 'marketplace', 'animals',
]
const RAW_I18N_KEY = new RegExp(`\\b(${I18N_NAMESPACES.join('|')})\\.[a-zA-Z][a-zA-Z0-9_]*`, 'g')

/**
 * Console noise that is not a defect: dev-tools chatter, React Router's v7 pre-announcements,
 * and network failures for genuinely optional things. Anything else fails the test - a thrown
 * `.map is not a function` is exactly the class of bug this is here to catch.
 */
const IGNORABLE_CONSOLE = [
  /React Router Future Flag/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon/i,
  /Failed to load resource.*40[34]/i,
]

function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORABLE_CONSOLE.some(re => re.test(text))) return
    errors.push(text)
  })
  page.on('pageerror', err => errors.push(`UNCAUGHT: ${err.message}`))
  return errors
}

async function findRawI18nKeys(page: Page): Promise<string[]> {
  const text = await page.locator('body').innerText()
  return [...new Set(text.match(RAW_I18N_KEY) || [])]
}

/**
 * Guarantees every navigation starts signed out, WITHOUT an extra page.goto.
 *
 * The obvious approach - goto('/'), clear localStorage, goto('/register') - is racy: the SPA
 * begins its own client-side redirect after the first load and interrupts the second
 * navigation ("interrupted by another navigation to /"). An init script runs before any app
 * code on every navigation, so the app simply boots unauthenticated the first time. One
 * navigation, no race. Call once per test.
 */
async function alwaysStartSignedOut(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.clear(); sessionStorage.clear() } catch { /* no storage access */ }
  })
}

/**
 * Opens the registration form from a guaranteed signed-out state.
 *
 * `waitUntil: 'domcontentloaded'` rather than the default `'load'`: this app opens a socket.io
 * connection and polls on boot, so the load event can stay pending long past the point the form
 * is interactive. Waiting for it made this intermittently time out - with the selector already
 * resolved and Playwright still "waiting for navigation to finish". The real readiness signal is
 * the form being in the DOM, which is exactly what the next line waits for.
 */
async function openRegister(page: Page) {
  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await readRoles(page)
}

/**
 * Returns the role values the form is offering, once that list has SETTLED.
 *
 * Two separate races make a naive read unreliable:
 *  - `domcontentloaded` fires before React mounts, so a plain waitForSelector can pass against
 *    a DOM that is about to be replaced and `evaluateAll` then returns [].
 *  - the groomer option only appears after the async `/grooming/status` probe resolves, so an
 *    early read silently sees a SHORTER list - the exact blind spot this suite exists to close.
 *
 * So: poll until at least the four always-present base roles exist, then require the count to
 * hold steady across two consecutive reads before trusting it.
 */
async function readRoles(page: Page): Promise<string[]> {
  const read = () => page.locator('input[name="role"]')
    .evaluateAll(els => els.map(e => (e as HTMLInputElement).value))

  let previous = -1
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const current = await read().catch(() => [] as string[])
    if (current.length >= 4 && current.length === previous) return current
    previous = current.length
    await page.waitForTimeout(250)
  }
  // Say WHAT page we are actually on. "0 options" is useless on its own - being bounced to
  // /dashboard by a still-authenticated session looks identical to a form that never rendered.
  const url = page.url()
  let body = ''
  try { body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300) } catch { /* nothing to read */ }
  throw new Error(
    `Role picker never settled - last saw ${previous} option(s) after 30s.\n` +
    `  url:  ${url}\n` +
    `  body: ${body || '(empty)'}`)
}

/**
 * The role radios are visually hidden behind styled `label.role-option` cards - clicking the
 * label is what a real user does, and what actually works. `.check()` on the input fails
 * because Playwright (correctly) refuses to interact with a non-visible element.
 */
async function pickRole(page: Page, role: string) {
  await page.locator('label.role-option')
    .filter({ has: page.locator(`input[name="role"][value="${role}"]`) })
    .click()
  await expect(page.locator(`input[name="role"][value="${role}"]`)).toBeChecked()
}

/** Fills everything except the role, which the caller picks first. */
async function fillRegistration(page: Page, email: string, lastName: string) {
  await page.fill('#reg-firstName', 'Journey')
  await page.fill('#reg-lastName', lastName)
  await page.fill('#reg-email', email)
  await page.fill('#reg-phone', '5550000000')
  await page.fill('#reg-password', 'Password1')
  await page.fill('#reg-confirmPassword', 'Password1')
  if (await page.locator('#reg-license').count()) {
    await page.fill('#reg-license', 'JOURNEY-LIC-1')
  }
  const form = page.locator('form[aria-label="Create account form"]')
  await form.locator('input[type="checkbox"]').first().check()
}

test.describe('@critical', () => {
  test.describe.configure({ mode: 'serial' })

  test('the registration form offers at least the four base roles', async ({ page }) => {
    await alwaysStartSignedOut(page)
    await openRegister(page)
    const roles = await readRoles(page)
    // Guards against a silently-empty role picker, which would make registration impossible
    // while every API-level check still passed.
    expect(roles).toEqual(expect.arrayContaining(['pet_owner', 'farmer', 'veterinarian', 'corporate_admin']))
  })

  /**
   * THE regression test for 2026-07-27. Enumerates the roles the UI actually renders - not a
   * hardcoded list - and drives each one through the real form. A role that the database will
   * reject fails here with the server's own message, at the exact point a user would hit it.
   */
  test('every role the UI offers can be registered through the form', async ({ page }) => {
    const consoleErrors = watchConsole(page)
    await alwaysStartSignedOut(page)
    await openRegister(page)

    const roles = await readRoles(page)
    expect(roles.length).toBeGreaterThan(0)

    const failures: string[] = []

    for (const [i, role] of roles.entries()) {
      await openRegister(page)
      await pickRole(page, role)
      await fillRegistration(
        page,
        `journey.${role.replace(/_/g, '.')}.${UNIQUE}.${i}@example.com`,
        role.replace(/_/g, ' '),
      )
      await page.locator('form[aria-label="Create account form"] button[type="submit"]').click()

      // Success = either landing inside the app (roles that activate immediately) or the
      // pending-approval confirmation (veterinarian / corporate_admin). Failure = the form's
      // own error banner, which is where a rejected DB write surfaces.
      const landed = page.locator('.nav-menu, nav, .dashboard-container').first()
      const pending = page.getByText(/under review|has been submitted|Account Review Required/i).first()
      const errorBanner = page.locator('.message.error, .auth-message.error, .module-alert.error').first()

      try {
        await expect(landed.or(pending).or(errorBanner)).toBeVisible({ timeout: 20_000 })
      } catch {
        failures.push(`role '${role}': form never resolved to success or an error`)
        continue
      }

      if (await errorBanner.isVisible().catch(() => false)) {
        failures.push(`role '${role}': ${(await errorBanner.innerText()).trim().slice(0, 200)}`)
      }
    }

    expect(failures, `Roles offered in the UI that cannot actually be created:\n${failures.join('\n')}`)
      .toEqual([])
    expect(consoleErrors, `Console errors during registration:\n${consoleErrors.join('\n')}`).toEqual([])
  })

  test('a newly registered user lands in a shell that renders, with no raw i18n keys', async ({ page }) => {
    const consoleErrors = watchConsole(page)
    await alwaysStartSignedOut(page)
    await openRegister(page)

    await pickRole(page, 'pet_owner')
    await fillRegistration(page, `shell.render.${UNIQUE}@example.com`, 'Render')
    await page.locator('form[aria-label="Create account form"] button[type="submit"]').click()

    await expect(page.locator('.nav-menu, nav, .dashboard-container').first()).toBeVisible({ timeout: 20_000 })

    // Raw keys are the documented symptom of a missing translation reaching the user.
    const rawKeys = await findRawI18nKeys(page)
    expect(rawKeys, `Untranslated i18n keys visible on screen: ${rawKeys.join(', ')}`).toEqual([])

    expect(consoleErrors, `Console errors on the authenticated shell:\n${consoleErrors.join('\n')}`).toEqual([])
  })

  test('the password reveal toggle actually reveals and re-masks', async ({ page }) => {
    // These tests share a browser context and run serially, so the previous test leaves this
    // one signed IN - and /register redirects an authenticated user straight to the dashboard,
    // detaching the field mid-interaction. Sign out first, then wait for the real form.
    await alwaysStartSignedOut(page)
    await openRegister(page)
    await page.waitForSelector('#reg-password', { state: 'visible' })

    const pw = page.locator('#reg-password')
    await pw.fill('Password1')
    await expect(pw).toHaveAttribute('type', 'password')

    // Each field owns its toggle; the first one belongs to the password input.
    await page.locator('.password-field').filter({ has: pw }).locator('.password-toggle').click()
    await expect(pw).toHaveAttribute('type', 'text')

    await page.locator('.password-field').filter({ has: pw }).locator('.password-toggle').click()
    await expect(pw).toHaveAttribute('type', 'password')
  })
})
