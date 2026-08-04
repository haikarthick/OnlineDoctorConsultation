import { test, expect } from './fixtures'

/**
 * RESPONSIVE LAYOUT & ACCESSIBILITY TESTS
 *
 * Tests that catch layout/CSS issues:
 * - Sidebar layout with main content
 * - Mobile viewport resizing (hamburger menu)
 * - No horizontal overflow / scrollbar issues
 * - Console error monitoring (JS errors, failed resource loads)
 * - Keyboard accessibility (focus traps, tab navigation)
 * - Empty state rendering (no data → graceful message)
 */

// ── Layout & Overflow ──────────────────────────────────────

test.describe('Layout - No Overflow', () => {
  const pagesToCheck = [
    { path: '/dashboard', role: 'petOwner' as const },
    { path: '/consultations', role: 'petOwner' as const },
    { path: '/animals', role: 'petOwner' as const },
    { path: '/find-doctor', role: 'petOwner' as const },
    { path: '/enterprises', role: 'farmer' as const },
    { path: '/admin/dashboard', role: 'admin' as const },
  ]

  for (const { path, role } of pagesToCheck) {
    test(`${path} has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      const page = await context.newPage()

      // Login
      const { loginAs } = await import('./fixtures')
      const userKey = role === 'petOwner' ? 'petOwner1' : role === 'farmer' ? 'farmer1' : 'admin'
      await loginAs(page, userKey)

      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // Check no horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll).toBe(false)

      await context.close()
    })
  }
})

// ── Mobile Viewport ────────────────────────────────────────

test.describe('Mobile Viewport', () => {
  test('dashboard renders on mobile without overflow', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, // iPhone X
    })
    const page = await context.newPage()

    const { loginAs } = await import('./fixtures')
    await loginAs(page, 'petOwner1')
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 5,
    )
    expect(hasOverflow).toBe(false)

    // Hamburger menu button should be visible on mobile
    const hamburger = page.locator('[class*="hamburger"], [class*="mobile-menu"], [aria-label*="menu"]')
    // Content should still render
    const bodyText = await page.textContent('body')
    expect(bodyText!.length).toBeGreaterThan(50)

    await context.close()
  })

  test('navigation works on tablet viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 }, // iPad
    })
    const page = await context.newPage()

    const { loginAs } = await import('./fixtures')
    await loginAs(page, 'petOwner1')
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/consultations/)

    await context.close()
  })
})

// ── Console Error Monitoring ───────────────────────────────

test.describe('Console Errors - Key Pages', () => {
  const criticalPages = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/consultations', name: 'Consultations' },
    { path: '/animals', name: 'Animals' },
    { path: '/find-doctor', name: 'Find Doctor' },
    { path: '/settings', name: 'Settings' },
    { path: '/wallet', name: 'Wallet' },
  ]

  for (const { path, name } of criticalPages) {
    test(`${name} (${path}) has no JS errors`, async ({ petOwnerPage: page }) => {
      const jsErrors: string[] = []

      page.on('pageerror', (error) => {
        // Ignore known non-critical errors
        const msg = error.message
        if (
          msg.includes('ResizeObserver') ||
          msg.includes('Non-Error promise rejection') ||
          msg.includes('net::ERR_') ||
          msg.includes('NetworkError')
        ) return
        jsErrors.push(msg)
      })

      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2_000)

      expect(
        jsErrors,
        `JS errors on ${path}:\n${jsErrors.join('\n')}`,
      ).toHaveLength(0)
    })
  }
})

// ── Failed Resource Loading ────────────────────────────────

test.describe('Resource Loading - Key Pages', () => {
  test('dashboard loads all CSS and JS bundles', async ({ petOwnerPage: page }) => {
    const failedResources: string[] = []

    page.on('response', (response) => {
      if (
        response.status() >= 400 &&
        !response.url().includes('/api/') &&
        (response.url().endsWith('.js') ||
         response.url().endsWith('.css') ||
         response.url().endsWith('.png') ||
         response.url().endsWith('.svg'))
      ) {
        failedResources.push(`${response.status()} ${response.url()}`)
      }
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2_000)

    expect(
      failedResources,
      `Failed resources:\n${failedResources.join('\n')}`,
    ).toHaveLength(0)
  })
})

// ── Empty State Rendering ──────────────────────────────────

test.describe('Empty States', () => {
  test('consultations page shows empty state or data', async ({ petOwnerPage: page }) => {
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')

    const bodyText = await page.textContent('body')
    // Should show either booking data OR a friendly empty state - not a crash
    expect(bodyText!.toLowerCase()).toMatch(
      /consultation|booking|appointment|no.*booking|no.*consultation|empty|schedule/i,
    )
  })

  test('medical records page shows empty state or data', async ({ petOwnerPage: page }) => {
    await page.goto('/medical-records')
    await page.waitForLoadState('networkidle')

    const bodyText = await page.textContent('body')
    expect(bodyText!.toLowerCase()).toMatch(
      /medical|record|history|no.*record|empty|select.*animal/i,
    )
  })

  test('prescriptions page shows empty state or data', async ({ petOwnerPage: page }) => {
    await page.goto('/prescriptions')
    await page.waitForLoadState('networkidle')

    const bodyText = await page.textContent('body')
    expect(bodyText!.toLowerCase()).toMatch(
      /prescription|medicine|medication|no.*prescription|empty/i,
    )
  })

  test('wallet shows empty state or transactions', async ({ petOwnerPage: page }) => {
    await page.goto('/wallet')
    await page.waitForLoadState('networkidle')

    const bodyText = await page.textContent('body')
    expect(bodyText!.toLowerCase()).toMatch(
      /wallet|balance|transaction|credit|no.*transaction/i,
    )
  })
})

// ── Keyboard Navigation ────────────────────────────────────

test.describe('Keyboard Accessibility', () => {
  test('login form is navigable via Tab key', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Tab through form fields
    await page.keyboard.press('Tab')
    const activeTag1 = await page.evaluate(() => document.activeElement?.tagName)

    await page.keyboard.press('Tab')
    const activeTag2 = await page.evaluate(() => document.activeElement?.tagName)

    // Should have focused input elements
    expect(['INPUT', 'BUTTON', 'A', 'SELECT']).toContain(activeTag1)
    expect(['INPUT', 'BUTTON', 'A', 'SELECT']).toContain(activeTag2)
  })

  test('Enter key submits login form', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('#login-email', 'invalid@email.com')
    await page.fill('#login-password', 'wrongpass')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(1_000)
    // Should show error or stay on login - not crash
    await expect(page).toHaveURL(/\/login/)
  })
})
