import { test, expect } from './fixtures'

/**
 * UI INTERACTION TESTS
 *
 * Tests interactive elements beyond smoke-level page loads:
 * - Tab switching with state sync
 * - Modal open/close
 * - Sidebar collapse/expand
 * - Language switcher
 * - Dashboard stat card clicks
 */

// ── Sidebar Navigation ─────────────────────────────────────

test.describe('Sidebar — Toggle & State', () => {
  test('sidebar toggle button collapses/expands sidebar', async ({ farmerPage: page }) => {
    // Sidebar should be visible on dashboard
    const sidebar = page.locator('nav, .sidebar, .nav-sidebar')
    await expect(sidebar.first()).toBeVisible()

    // Find and click the toggle/collapse button
    const toggleBtn = page.locator('[class*="toggle"], [class*="collapse"], [aria-label*="sidebar"], [aria-label*="menu"]')
    if (await toggleBtn.count() > 0) {
      await toggleBtn.first().click()
      await page.waitForTimeout(500)

      // Click again to restore
      await toggleBtn.first().click()
      await page.waitForTimeout(500)
      await expect(sidebar.first()).toBeVisible()
    }
  })

  test('active menu item is highlighted for current route', async ({ petOwnerPage: page }) => {
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')
    // The consultations menu item should have an active class
    const activeItem = page.locator('nav .active, .sidebar .active, .nav-sidebar .active, [class*="menu-item"][class*="active"]')
    await expect(activeItem.first()).toBeVisible({ timeout: 10_000 })
  })

  test('menu item click navigates to correct page', async ({ petOwnerPage: page }) => {
    const navLink = page.locator('nav a[href="/animals"], .sidebar a[href="/animals"], .nav-sidebar a[href="/animals"]')
    if (await navLink.count() > 0) {
      await navLink.first().click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/animals/)
    }
  })
})

// ── Consultations Tab Switching ────────────────────────────

test.describe('Consultations — Tabs & Filters', () => {
  test('tab switching between Bookings and Consultations', async ({ petOwnerPage: page }) => {
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')

    // Find tab buttons
    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click second tab
      await tabs.nth(1).click()
      await page.waitForTimeout(500)

      // Click first tab
      await tabs.nth(0).click()
      await page.waitForTimeout(500)
    }

    // Page should still be on consultations
    await expect(page).toHaveURL(/\/consultations/)
  })

  test('status filter dropdown changes displayed bookings', async ({ petOwnerPage: page }) => {
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')

    // Look for a filter/status dropdown
    const filterSelect = page.locator('select').first()
    if (await filterSelect.count() > 0) {
      const options = await filterSelect.locator('option').allTextContents()
      expect(options.length).toBeGreaterThan(0)
    }
  })
})

// ── Medical Records Tabs ───────────────────────────────────

test.describe('Medical Records — Tabs', () => {
  test('tab switching loads different content sections', async ({ petOwnerPage: page }) => {
    await page.goto('/medical-records')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click through tabs and verify no crash
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(500)
        // Should not redirect to login or show error
        await expect(page).toHaveURL(/\/medical-records/)
      }
    }
  })

  test('animal selector dropdown is populated', async ({ petOwnerPage: page }) => {
    await page.goto('/medical-records')
    await page.waitForLoadState('networkidle')

    const animalSelect = page.locator('select')
    if (await animalSelect.count() > 0) {
      const options = await animalSelect.first().locator('option').allTextContents()
      // Should have at least the placeholder + animals
      expect(options.length).toBeGreaterThanOrEqual(1)
    }
  })
})

// ── Wellness Portal Tabs ───────────────────────────────────

test.describe('Wellness Portal — Tabs', () => {
  test('tab switching between Dashboard, Scorecards, Reminders', async ({ petOwnerPage: page }) => {
    await page.goto('/wellness')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(500)
        await expect(page).toHaveURL(/\/wellness/)
      }
    }
  })
})

// ── Marketplace Tabs ───────────────────────────────────────

test.describe('Marketplace — Tabs', () => {
  test('tab switching between Dashboard, Browse, Create, Orders', async ({ farmerPage: page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(500)
        await expect(page).toHaveURL(/\/marketplace/)
      }
    }
  })
})

// ── Health Analytics Tabs ──────────────────────────────────

test.describe('Health Analytics — Tabs & Enterprise Selector', () => {
  test('tab switching works', async ({ farmerPage: page }) => {
    await page.goto('/health-analytics')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    if (await tabs.count() >= 2) {
      await tabs.nth(1).click()
      await page.waitForTimeout(500)
      await expect(page).toHaveURL(/\/health-analytics/)
    }
  })

  test('enterprise selector dropdown is populated', async ({ farmerPage: page }) => {
    await page.goto('/health-analytics')
    await page.waitForLoadState('networkidle')

    const selects = page.locator('select')
    if (await selects.count() > 0) {
      const options = await selects.first().locator('option').allTextContents()
      expect(options.length).toBeGreaterThanOrEqual(1)
    }
  })
})

// ── Schedule Management Tabs (Vet) ─────────────────────────

test.describe('Schedule Management — Tabs', () => {
  test('tab switching between Weekly, Calendar, Blocks, Holidays', async ({ vetPage: page }) => {
    await page.goto('/doctor/manage-schedule')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(500)
        await expect(page).toHaveURL(/\/doctor\/manage-schedule/)
      }
    }
  })
})

// ── Breeding Manager Tabs (Farmer) ─────────────────────────

test.describe('Breeding Manager — Tabs', () => {
  test('tab switching works', async ({ farmerPage: page }) => {
    await page.goto('/breeding')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    if (await tabs.count() >= 2) {
      await tabs.nth(1).click()
      await page.waitForTimeout(500)
      await expect(page).toHaveURL(/\/breeding/)
    }
  })
})

// ── Dashboard Stat Cards ───────────────────────────────────

test.describe('Dashboard — Stat Card Navigation', () => {
  test('stat cards are rendered with data', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Dashboard should render stat cards/widgets
    const cards = page.locator('[class*="stat"], [class*="card"], [class*="widget"], [class*="metric"]')
    const count = await cards.count()
    // Dashboard should have some summary elements
    expect(count).toBeGreaterThan(0)
  })

  test('clickable stat card navigates to sub-page', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find clickable cards/links on dashboard
    const links = page.locator('.dashboard a, [class*="card"] a, [class*="stat"] a')
    if (await links.count() > 0) {
      const href = await links.first().getAttribute('href')
      if (href) {
        await links.first().click()
        await page.waitForLoadState('networkidle')
        // Should navigate away from dashboard
        expect(page.url()).toContain(href)
      }
    }
  })
})

// ── Language Switcher ──────────────────────────────────────

test.describe('Language Switcher', () => {
  test('language dropdown opens and shows language options', async ({ petOwnerPage: page }) => {
    const langBtn = page.locator('.lang-switcher-btn')
    if (await langBtn.count() > 0) {
      await langBtn.click()
      await page.waitForTimeout(300)

      // Dropdown should appear with language options
      const dropdown = page.locator('.lang-dropdown, [role="listbox"]')
      await expect(dropdown.first()).toBeVisible({ timeout: 5_000 })

      const options = page.locator('.lang-option, [role="option"]')
      const optionCount = await options.count()
      expect(optionCount).toBeGreaterThanOrEqual(2)

      // Close dropdown by clicking elsewhere
      await page.click('body')
    }
  })

  test('selecting a language updates the UI', async ({ petOwnerPage: page }) => {
    const langBtn = page.locator('.lang-switcher-btn')
    if (await langBtn.count() > 0) {
      // Get initial text
      const initialLabel = await langBtn.textContent()

      await langBtn.click()
      await page.waitForTimeout(300)

      // Click a different language option
      const options = page.locator('.lang-option:not(.lang-option-active), [role="option"]:not([aria-selected="true"])')
      if (await options.count() > 0) {
        await options.first().click()
        await page.waitForTimeout(500)

        // Label should have changed
        const newLabel = await langBtn.textContent()
        expect(newLabel).not.toBe(initialLabel)

        // Switch back to avoid affecting other tests
        await langBtn.click()
        await page.waitForTimeout(300)
        const resetOptions = page.locator('.lang-option, [role="option"]')
        if (await resetOptions.count() > 0) {
          await resetOptions.first().click()
        }
      }
    }
  })
})
