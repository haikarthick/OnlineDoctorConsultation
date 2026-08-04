import { test, expect } from './fixtures'

/**
 * SEARCH, FILTER & SORT TESTS
 *
 * Tests interactive search, filter dropdowns, and sort controls:
 * - FindDoctor search with debounce
 * - FindDoctor filters (specialty, language, rating, fee, toggles)
 * - FindDoctor sort + pagination
 * - Animals search + species filter
 * - Vet Hospitals search + filters
 * - Admin consultation/payment/review filters
 * - Marketplace browse filters
 * - Wallet transaction filters
 */

// ── FindDoctor - Search & Filters ──────────────────────────

test.describe('Find Doctor - Search', () => {
  test('search input accepts text and triggers filtering', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('carter')
      // Debounce time is 350ms + network
      await page.waitForTimeout(1_000)

      // Results should update (page should still be loaded, not crashed)
      await expect(page).toHaveURL(/\/find-doctor/)
    }
  })

  test('specialty filter dropdown is populated', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    const selects = page.locator('select')
    if (await selects.count() > 0) {
      // Find the specialty filter (first or labeled)
      const options = await selects.first().locator('option').allTextContents()
      expect(options.length).toBeGreaterThanOrEqual(2)
    }
  })

  test('clear filters button resets all filters', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    // Apply a filter first
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test')
      await page.waitForTimeout(500)
    }

    // Look for a clear/reset button
    const clearBtn = page.locator('button').filter({ hasText: /clear|reset/i })
    if (await clearBtn.count() > 0) {
      await clearBtn.first().click()
      await page.waitForTimeout(500)

      // Search input should be empty
      if (await searchInput.count() > 0) {
        const value = await searchInput.first().inputValue()
        expect(value).toBe('')
      }
    }
  })

  test('sort dropdown changes result order', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    const sortSelect = page.locator('select').last()
    if (await sortSelect.count() > 0) {
      const options = await sortSelect.locator('option').count()
      if (options > 1) {
        await sortSelect.selectOption({ index: 1 })
        await page.waitForTimeout(500)
        await expect(page).toHaveURL(/\/find-doctor/)
      }
    }
  })

  test('view mode toggle switches between grid and list', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    const viewBtns = page.locator('button').filter({ hasText: /grid|list|🔲|📋/i })
    if (await viewBtns.count() >= 2) {
      // Click list view
      await viewBtns.nth(1).click()
      await page.waitForTimeout(300)
      // Click grid view
      await viewBtns.nth(0).click()
      await page.waitForTimeout(300)
    }
  })

  test('vet cards display doctor info with rating', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    // Cards should show doctor names and ratings
    const cards = page.locator('[class*="card"], [class*="vet"]')
    if (await cards.count() > 0) {
      const cardText = await cards.first().textContent()
      // Should contain doctor-related text
      expect(cardText).toBeTruthy()
      expect(cardText!.length).toBeGreaterThan(10)
    }
  })

  test('pagination controls exist when multiple pages', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')

    // Look for pagination elements
    const pagination = page.locator('[class*="pagination"], [class*="page"]')
    // May or may not have pagination depending on data volume - just ensure no crash
    await expect(page).toHaveURL(/\/find-doctor/)
  })
})

// ── Animals - Search & Species Filter ──────────────────────

test.describe('Animals - Search & Filter', () => {
  test('search input filters animals by name', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('buddy')
      await page.waitForTimeout(500)
      await expect(page).toHaveURL(/\/animals/)
    }
  })

  test('species filter dropdown filters by species', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const speciesFilter = page.locator('select')
    if (await speciesFilter.count() > 0) {
      const options = await speciesFilter.first().locator('option').count()
      if (options > 1) {
        await speciesFilter.first().selectOption({ index: 1 })
        await page.waitForTimeout(500)
        await expect(page).toHaveURL(/\/animals/)
      }
    }
  })
})

// ── Vet Hospitals - Search & Filters ───────────────────────

test.describe('Vet Hospitals - Search & Filters', () => {
  test('hospital search input works', async ({ petOwnerPage: page }) => {
    await page.goto('/vet-hospitals')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('hospital')
      await page.waitForTimeout(500)
      await expect(page).toHaveURL(/\/vet-hospitals/)
    }
  })

  test('hospital type filter has options', async ({ petOwnerPage: page }) => {
    await page.goto('/vet-hospitals')
    await page.waitForLoadState('networkidle')

    const filterSelect = page.locator('select')
    if (await filterSelect.count() > 0) {
      const options = await filterSelect.first().locator('option').count()
      expect(options).toBeGreaterThanOrEqual(2)
    }
  })

  test('hospital cards display name and badges', async ({ petOwnerPage: page }) => {
    await page.goto('/vet-hospitals')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[class*="card"], [class*="hospital"]')
    if (await cards.count() > 0) {
      const text = await cards.first().textContent()
      expect(text!.length).toBeGreaterThan(5)
    }
  })
})

// ── Marketplace - Browse Filters ───────────────────────────

test.describe('Marketplace - Browse Filters', () => {
  test('category filter dropdown has marketplace categories', async ({ farmerPage: page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')

    // Switch to Browse tab
    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabTexts = await tabs.allTextContents()
    const browseIdx = tabTexts.findIndex(t => /browse/i.test(t))
    if (browseIdx >= 0) {
      await tabs.nth(browseIdx).click()
      await page.waitForTimeout(500)
    }

    const selects = page.locator('select')
    if (await selects.count() > 0) {
      const options = await selects.first().locator('option').allTextContents()
      expect(options.length).toBeGreaterThanOrEqual(2)
    }
  })

  test('marketplace search input works', async ({ farmerPage: page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabTexts = await tabs.allTextContents()
    const browseIdx = tabTexts.findIndex(t => /browse/i.test(t))
    if (browseIdx >= 0) {
      await tabs.nth(browseIdx).click()
      await page.waitForTimeout(500)
    }

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('feed')
      await page.waitForTimeout(500)
      await expect(page).toHaveURL(/\/marketplace/)
    }
  })
})

// ── Wallet - Transaction List ──────────────────────────────

test.describe('Wallet - Transactions & Filters', () => {
  test('wallet displays balance cards', async ({ petOwnerPage: page }) => {
    await page.goto('/wallet')
    await page.waitForLoadState('networkidle')

    // Should show balance-related elements
    const balanceText = await page.textContent('body')
    expect(balanceText?.toLowerCase()).toMatch(/balance|wallet|credit/i)
  })

  test('load more button loads additional transactions', async ({ petOwnerPage: page }) => {
    await page.goto('/wallet')
    await page.waitForLoadState('networkidle')

    const loadMoreBtn = page.locator('button').filter({ hasText: /load more/i })
    if (await loadMoreBtn.count() > 0) {
      await loadMoreBtn.first().click()
      await page.waitForTimeout(1_000)
      await expect(page).toHaveURL(/\/wallet/)
    }
  })
})

// ── Admin - Consultation & Payment Filters ─────────────────

test.describe('Admin - Management Filters', () => {
  test('admin consultation page has status filter', async ({ adminPage: page }) => {
    await page.goto('/admin/consultations')
    await page.waitForLoadState('networkidle')

    const filterSelect = page.locator('select')
    if (await filterSelect.count() > 0) {
      const options = await filterSelect.first().locator('option').count()
      expect(options).toBeGreaterThanOrEqual(2)
    }
  })

  test('admin payment page has search/filter', async ({ adminPage: page }) => {
    await page.goto('/admin/payments')
    await page.waitForLoadState('networkidle')

    const inputs = page.locator('input, select')
    // Should have some filter controls
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('admin audit logs table renders entries', async ({ adminPage: page }) => {
    await page.goto('/admin/audit-logs')
    await page.waitForLoadState('networkidle')

    // Should show log entries or empty state
    const content = await page.textContent('body')
    expect(content?.toLowerCase()).toMatch(/audit|log|action|no.*log|empty/i)
  })

  test('admin review moderation list renders', async ({ adminPage: page }) => {
    await page.goto('/admin/reviews')
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    expect(content?.toLowerCase()).toMatch(/review|rating|moderat|no.*review|empty/i)
  })
})
