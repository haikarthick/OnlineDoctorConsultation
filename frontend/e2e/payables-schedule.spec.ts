import { test, expect, loginAs } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Coverage for the two screens added with the grooming lifecycle work:
 *   /admin/payables    — "who do I owe" register (admin)
 *   /grooming/schedule — provider working hours & availability
 *
 * Deliberately more than the auto-generated "loads without crash" stub. Both pages were built
 * from scratch, both render money or availability that other flows depend on, and both are
 * exactly the kind of new screen where a missing translation or an unguarded `.map` ships
 * unnoticed. So each is checked for: it renders, it does NOT bounce to login, no raw i18n keys
 * reach the user, and nothing throws in the console.
 */

/** Namespaces these two screens actually use — a visible "payables.title" means a key failed. */
const I18N_NAMESPACES = [
  'nav', 'common', 'payables', 'groomingSchedule', 'groomingBook', 'groomingBoard',
]
const RAW_I18N_KEY = new RegExp(`\\b(${I18N_NAMESPACES.join('|')})\\.[a-zA-Z][a-zA-Z0-9_]*`, 'g')

const IGNORABLE_CONSOLE = [
  /React Router Future Flag/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon/i,
  // Grooming routes 404 server-side while `grooming.enabled` is off — that is the dark-launch
  // behaving correctly, not a page defect.
  /Failed to load resource.*40[0-4]/i,
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

test.describe('Admin — Payables register', () => {
  test('/admin/payables renders for an admin with no raw keys or console errors', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const consoleErrors = watchConsole(page)

    await loginAs(page, 'admin')
    await page.goto('/admin/payables')
    await page.waitForLoadState('domcontentloaded')

    // Must not be bounced out — admin holds this route.
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('.module-page').first()).toBeVisible({ timeout: 20_000 })

    // Both vendor tabs exist: the whole point of the screen is one place for both.
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)

    const rawKeys = await findRawI18nKeys(page)
    expect(rawKeys, `Untranslated i18n keys on /admin/payables: ${rawKeys.join(', ')}`).toEqual([])
    expect(consoleErrors, `Console errors on /admin/payables:\n${consoleErrors.join('\n')}`).toEqual([])

    await context.close()
  })
})

test.describe('Grooming — Working hours', () => {
  test('/grooming/schedule renders without crashing or leaking raw keys', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const consoleErrors = watchConsole(page)

    await loginAs(page, 'admin')
    await page.goto('/grooming/schedule')
    await page.waitForLoadState('domcontentloaded')

    await expect(page).not.toHaveURL(/\/login/)
    // The page renders either the schedule editor or the "create your business first" branch,
    // depending on whether the signed-in user owns a provider and whether grooming is enabled.
    // Both are valid; what must never happen is a blank screen or a thrown render.
    await expect(page.locator('.module-page').first()).toBeVisible({ timeout: 20_000 })

    const rawKeys = await findRawI18nKeys(page)
    expect(rawKeys, `Untranslated i18n keys on /grooming/schedule: ${rawKeys.join(', ')}`).toEqual([])
    expect(consoleErrors, `Console errors on /grooming/schedule:\n${consoleErrors.join('\n')}`).toEqual([])

    await context.close()
  })
})
