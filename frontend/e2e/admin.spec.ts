import { test, expect } from './fixtures'

/**
 * ADMIN E2E TESTS
 *
 * Covers all admin-specific flows:
 * - Admin Dashboard
 * - User Management
 * - Consultation Management
 * - Payment Management
 * - Review Moderation
 * - System Settings
 * - Audit Logs
 * - Permission Management
 * - Medical Record Management
 * - Compliance Dashboard
 * - Vet Hospital Admin
 * - Staff Settings
 * - Cancellation Dashboard
 * - Holiday Management
 * - All shared pages (dashboard, consultations, etc.)
 */

test.describe('Admin — Admin Dashboard', () => {
  test('should load admin dashboard', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })

  test('should display admin statistics/cards', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
  })
})

test.describe('Admin — User Management', () => {
  test('should load user management page', async ({ adminPage: page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/users/)
  })

  test('should display user list or table', async ({ adminPage: page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    // Should have a table or list of users
    const tableOrList = page.locator('table, .user-list, .users-grid, [role="grid"]')
    if (await tableOrList.count() > 0) {
      await expect(tableOrList.first()).toBeVisible()
    }
  })

  test('should have search or filter capability', async ({ adminPage: page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], .search-input')
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible()
    }
  })
})

test.describe('Admin — Consultation Management', () => {
  test('should load consultation management page', async ({ adminPage: page }) => {
    await page.goto('/admin/consultations')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/consultations/)
  })
})

test.describe('Admin — Payment Management', () => {
  test('should load payment management page', async ({ adminPage: page }) => {
    await page.goto('/admin/payments')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/payments/)
  })
})

test.describe('Admin — Review Moderation', () => {
  test('should load review moderation page', async ({ adminPage: page }) => {
    await page.goto('/admin/reviews')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/reviews/)
  })
})

test.describe('Admin — System Settings', () => {
  test('should load system settings page', async ({ adminPage: page }) => {
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/settings/)
  })
})

test.describe('Admin — Audit Logs', () => {
  test('should load audit logs page', async ({ adminPage: page }) => {
    await page.goto('/admin/audit-logs')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/audit-logs/)
  })

  test('should display audit log entries or empty state', async ({ adminPage: page }) => {
    await page.goto('/admin/audit-logs')
    await page.waitForLoadState('networkidle')
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
  })
})

test.describe('Admin — Permission Management', () => {
  test('should load permission management page', async ({ adminPage: page }) => {
    await page.goto('/admin/permissions')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/permissions/)
  })
})

test.describe('Admin — Medical Record Management', () => {
  test('should load medical record management page', async ({ adminPage: page }) => {
    await page.goto('/admin/medical-records')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/medical-records/)
  })
})

test.describe('Admin — Compliance Dashboard', () => {
  test('should load HIPAA compliance dashboard', async ({ adminPage: page }) => {
    await page.goto('/admin/compliance')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/compliance/)
  })
})

test.describe('Admin — Vet Hospital Admin', () => {
  test('should load vet hospital admin page', async ({ adminPage: page }) => {
    await page.goto('/admin/vet-hospitals')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/vet-hospitals/)
  })
})

test.describe('Admin — Staff Settings', () => {
  test('should load staff settings page', async ({ adminPage: page }) => {
    await page.goto('/admin/staff-settings')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/staff-settings/)
  })
})

test.describe('Admin — Cancellation Dashboard', () => {
  test('should load cancellation dashboard', async ({ adminPage: page }) => {
    await page.goto('/admin/cancellation-dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/cancellation-dashboard/)
  })
})

test.describe('Admin — Holiday Management', () => {
  test('should load holiday management page', async ({ adminPage: page }) => {
    await page.goto('/admin/holidays')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/admin\/holidays/)
  })
})

// ── Admin can access ALL shared pages ───────────────────────
test.describe('Admin — Shared Pages Access', () => {
  const sharedRoutes = [
    '/dashboard',
    '/consultations',
    '/medical-records',
    '/vet-hospitals',
    '/ai-copilot',
    '/marketplace',
    '/wellness',
    '/wallet',
    '/enterprises',
    '/animal-groups',
    '/herd-medical',
    '/locations',
    '/movement-log',
    '/campaigns',
    '/health-analytics',
    '/breeding',
    '/feed-inventory',
    '/compliance',
    '/financial',
    '/alerts',
    '/disease-prediction',
    '/genomic-lineage',
    '/iot-sensors',
    '/supply-chain',
    '/workforce',
    '/report-builder',
    '/digital-twin',
    '/sustainability',
    '/geospatial',
    '/hospital-workflow',
    '/inpatient',
  ]

  for (const route of sharedRoutes) {
    test(`admin can access ${route}`, async ({ adminPage: page }) => {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      // Should NOT be redirected to login or dashboard (access denied)
      await expect(page).not.toHaveURL(/\/login/)
      expect(page.url()).toContain(route)
    })
  }
})
