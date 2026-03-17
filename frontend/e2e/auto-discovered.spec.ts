import { test, expect } from './fixtures'
import { loginAs } from './fixtures'
import { USERS } from './constants'

/**
 * AUTO-GENERATED + ENHANCED TEST STUBS
 *
 * Animal Life Timeline E2E tests
 * Generated: 2026-03-17T03:12:15.135Z
 */

test.describe('Animal Life Timeline — /animal-timeline', () => {
  test('should load /animal-timeline without crash (pet_owner)', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'petOwner1')
    await page.goto('/animal-timeline')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/)
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
    await context.close()
  })

  test('should display timeline page title and controls', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'petOwner1')
    await page.goto('/animal-timeline')
    await page.waitForLoadState('domcontentloaded')
    // Check for page title
    await expect(page.locator('.timeline-page h1')).toBeVisible()
    // Check for animal selector
    await expect(page.locator('.timeline-controls select').first()).toBeVisible()
    // Check for date inputs
    await expect(page.locator('.timeline-controls input[type="date"]').first()).toBeVisible()
    await context.close()
  })

  test('should toggle between horizontal and vertical views', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'petOwner1')
    await page.goto('/animal-timeline')
    await page.waitForLoadState('domcontentloaded')
    const verticalBtn = page.locator('.timeline-view-btn', { hasText: 'Vertical' })
    if (await verticalBtn.isVisible()) {
      await verticalBtn.click()
      await expect(page.locator('.timeline-vertical')).toBeVisible()
    }
    await context.close()
  })

  test('should open detail modal on event click', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'petOwner1')
    await page.goto('/animal-timeline')
    await page.waitForLoadState('domcontentloaded')
    // If events exist, clicking one should open a modal
    const eventNode = page.locator('.timeline-v-item, .timeline-h-node').first()
    if (await eventNode.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventNode.click()
      await expect(page.locator('.timeline-modal')).toBeVisible()
      // Close modal
      await page.locator('.timeline-modal-close').click()
      await expect(page.locator('.timeline-modal')).not.toBeVisible()
    }
    await context.close()
  })

  test('should be accessible to farmers', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAs(page, 'farmer1')
    await page.goto('/animal-timeline')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('.timeline-page')).toBeVisible()
    await context.close()
  })
})
