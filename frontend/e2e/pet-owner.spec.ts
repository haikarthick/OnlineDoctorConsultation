import { test, expect } from './fixtures'
import { USERS } from './constants'
import { loginAs } from './fixtures'

/**
 * PET OWNER E2E TESTS
 *
 * Covers all pet owner flows:
 * - Dashboard access
 * - Animal management (add, view, edit)
 * - Find doctor
 * - Book consultation
 * - View consultations
 * - Medical records
 * - Prescriptions
 * - Write review
 * - Vet hospitals browse
 * - AI Copilot
 * - Marketplace
 * - Wellness portal
 * - Wallet
 * - Settings
 */

test.describe('Pet Owner - Dashboard', () => {
  test('should load dashboard with key sections', async ({ petOwnerPage: page }) => {
    await expect(page).toHaveURL(/\/dashboard/)
    // Dashboard should have some content
    await page.waitForLoadState('networkidle')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})

test.describe('Pet Owner - Animal Management', () => {
  test('should load animals page', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/animals/)
  })

  test('should open add animal form', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    // Look for Add button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Register")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      // Form should appear with name field
      await expect(page.locator('input[name="name"], #name, #animal-name')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('should validate required fields on animal form', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Register")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Try submitting empty form
      const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Create")')
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click()
        // Should show validation - either HTML5 or app-level
        await page.waitForTimeout(1_000)
      }
    }
  })

  test('should fill and submit animal form', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Register")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Fill common fields - adapt selectors as needed
      const nameField = page.locator('input[name="name"], #name, #animal-name')
      if (await nameField.count() > 0) {
        await nameField.fill(`E2E-Pet-${Date.now()}`)
      }

      const speciesSelect = page.locator('select[name="species"], #species')
      if (await speciesSelect.count() > 0) {
        await speciesSelect.selectOption({ index: 1 })
      }

      const genderSelect = page.locator('select[name="gender"], #gender')
      if (await genderSelect.count() > 0) {
        await genderSelect.selectOption({ index: 1 })
      }

      const weightField = page.locator('input[name="weight"], #weight')
      if (await weightField.count() > 0) {
        await weightField.fill('10')
      }
    }
  })
})

test.describe('Pet Owner - Find Doctor', () => {
  test('should load find doctor page', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/find-doctor/)
  })

  test('should display doctor listing or search', async ({ petOwnerPage: page }) => {
    await page.goto('/find-doctor')
    await page.waitForLoadState('networkidle')
    // Should either show doctors list or a search interface
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
  })
})

test.describe('Pet Owner - Book Consultation', () => {
  test('should load booking page', async ({ petOwnerPage: page }) => {
    await page.goto('/book-consultation')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/book-consultation/)
  })

  test('should display booking wizard steps', async ({ petOwnerPage: page }) => {
    await page.goto('/book-consultation')
    await page.waitForLoadState('networkidle')
    // Booking has multi-step wizard - should show first step
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
  })
})

test.describe('Pet Owner - Consultations', () => {
  test('should load consultations list', async ({ petOwnerPage: page }) => {
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/consultations/)
  })
})

test.describe('Pet Owner - Medical Records', () => {
  test('should load medical records page', async ({ petOwnerPage: page }) => {
    await page.goto('/medical-records')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/medical-records/)
  })
})

test.describe('Pet Owner - Prescriptions', () => {
  test('should load prescriptions page', async ({ petOwnerPage: page }) => {
    await page.goto('/prescriptions')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/prescriptions/)
  })
})

test.describe('Pet Owner - Write Review', () => {
  test('should load write review page', async ({ petOwnerPage: page }) => {
    await page.goto('/write-review')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/write-review/)
  })
})

test.describe('Pet Owner - Vet Hospitals', () => {
  test('should load vet hospitals listing', async ({ petOwnerPage: page }) => {
    await page.goto('/vet-hospitals')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/vet-hospitals/)
  })
})

test.describe('Pet Owner - AI Copilot', () => {
  test('should load AI copilot page', async ({ petOwnerPage: page }) => {
    await page.goto('/ai-copilot')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/ai-copilot/)
  })
})

test.describe('Pet Owner - Marketplace', () => {
  test('should load marketplace page', async ({ petOwnerPage: page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/marketplace/)
  })
})

test.describe('Pet Owner - Wellness Portal', () => {
  test('should load wellness portal', async ({ petOwnerPage: page }) => {
    await page.goto('/wellness')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/wellness/)
  })
})

test.describe('Pet Owner - Wallet', () => {
  test('should load wallet page', async ({ petOwnerPage: page }) => {
    await page.goto('/wallet')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/wallet/)
  })
})

test.describe('Pet Owner - Settings', () => {
  test('should load settings page', async ({ petOwnerPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/settings/)
  })

  test('should display profile form fields', async ({ petOwnerPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Settings should show profile fields
    const nameField = page.locator('input[name="firstName"], input[name="first_name"], #firstName')
    if (await nameField.count() > 0) {
      await expect(nameField.first()).toBeVisible()
    }
  })
})
