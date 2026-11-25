import { test, expect } from '@playwright/test'
import { USERS } from './constants'
import { settleServiceWorker } from './fixtures'

/**
 * AUTH E2E TESTS
 * Covers: Login, logout, registration, invalid credentials, session persistence
 */

test.describe('Authentication - Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await settleServiceWorker(page)
  })

  test('should display login form with email and password fields', async ({ page }) => {
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.locator('.login-submit')).toBeVisible()
  })

  test('should show error for empty submission', async ({ page }) => {
    await page.click('.login-submit')
    // HTML5 validation or app-level error
    const emailField = page.locator('#login-email')
    const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('#login-email', 'wrong@email.com')
    await page.fill('#login-password', 'WrongPassword')
    await page.click('.login-submit')
    // Wait for error message
    await expect(page.locator('.message.error, [role="status"]')).toBeVisible({ timeout: 10_000 })
  })

  // Test login for each role
  for (const [key, user] of Object.entries(USERS)) {
    // Only test one user per role to keep suite fast
    if (!['admin', 'vet1', 'petOwner1', 'farmer1'].includes(key)) continue

    test(`should login as ${user.role} (${key})`, async ({ page }) => {
      await page.fill('#login-email', user.email)
      await page.fill('#login-password', user.password)
      await page.click('.login-submit')
      await page.waitForURL('**/dashboard', { timeout: 15_000 })
      // Verify we're on dashboard
      await expect(page).toHaveURL(/\/dashboard/)
      // Verify auth token was stored
      const token = await page.evaluate(() => localStorage.getItem('authToken'))
      expect(token).toBeTruthy()
    })
  }

  test('should redirect authenticated user away from login page', async ({ page }) => {
    // Login first
    await page.fill('#login-email', USERS.petOwner1.email)
    await page.fill('#login-password', USERS.petOwner1.password)
    await page.click('.login-submit')
    await page.waitForURL('**/dashboard')
    // Try navigating back to login
    await page.goto('/login')
    await settleServiceWorker(page)
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe('Authentication - Logout', () => {
  test('should logout and redirect to login/home', async ({ page }) => {
    // Login
    await page.goto('/login')
    await settleServiceWorker(page)
    await page.fill('#login-email', USERS.petOwner1.email)
    await page.fill('#login-password', USERS.petOwner1.password)
    await page.click('.login-submit')
    await page.waitForURL('**/dashboard')

    // Find and click logout button
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), .logout-btn, [aria-label="Logout"]')
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click()
      // Should redirect away from dashboard
      await page.waitForURL(/\/(login|$)/, { timeout: 10_000 })
      // Token should be cleared
      const token = await page.evaluate(() => localStorage.getItem('authToken'))
      expect(token).toBeFalsy()
    }
  })
})

test.describe('Authentication - Registration', () => {
  test('should display registration form with all fields', async ({ page }) => {
    await page.goto('/register')
    await settleServiceWorker(page)
    await expect(page.locator('#reg-firstName')).toBeVisible()
    await expect(page.locator('#reg-lastName')).toBeVisible()
    await expect(page.locator('#reg-email')).toBeVisible()
    await expect(page.locator('#reg-phone')).toBeVisible()
    await expect(page.locator('#reg-password')).toBeVisible()
    await expect(page.locator('#reg-confirmPassword')).toBeVisible()
    // Role selector should be visible
    await expect(page.locator('.role-selector, [role="radiogroup"]')).toBeVisible()
  })

  test('should show role options: pet_owner, farmer, veterinarian', async ({ page }) => {
    await page.goto('/register')
    await settleServiceWorker(page)
    // The radios are visually hidden; the person sees and taps the role CARD (a label that wraps the radio).
    for (const role of ['pet_owner', 'farmer', 'veterinarian']) {
      await expect(page.locator(`label.role-option:has(input[name="role"][value="${role}"])`)).toBeVisible()
    }
  })

  test('should validate password mismatch', async ({ page }) => {
    await page.goto('/register')
    await settleServiceWorker(page)
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', `test-${Date.now()}@e2e-test.com`)
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', 'TestPass123')
    await page.fill('#reg-confirmPassword', 'DifferentPass')
    // Create Account stays disabled until the terms are accepted; accept them so the password check is what is tested.
    await page.check('input[type="checkbox"]')
    await page.click('.register-submit')
    const errorMsg = page.locator('.message.error')
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
    await expect(errorMsg).toContainText(/do not match/i)
    await expect(page).toHaveURL(/\/register/)
  })

  test('should validate minimum password length', async ({ page }) => {
    await page.goto('/register')
    await settleServiceWorker(page)
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', `test-${Date.now()}@e2e-test.com`)
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', '12345')
    await page.fill('#reg-confirmPassword', '12345')
    await page.check('input[type="checkbox"]')
    await page.click('.register-submit')
    // The form (not the browser) explains the rule in words: at least 8 characters.
    const errorMsg = page.locator('.message.error')
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
    await expect(errorMsg).toContainText(/at least 8 characters/i)
    await expect(page).toHaveURL(/\/register/)
  })

  test('create account is disabled until the terms are accepted', async ({ page }) => {
    await page.goto('/register')
    await settleServiceWorker(page)
    await expect(page.locator('.register-submit')).toBeDisabled()
    await page.check('input[type="checkbox"]')
    await expect(page.locator('.register-submit')).toBeEnabled()
  })
})

test.describe('Authentication - Public Routes', () => {
  test('home page loads for unauthenticated user', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Should show home page content (not redirect to login)
    await expect(page).toHaveURL(/^\/$|\/$/  )
  })

  test('public marketplace browse loads without login', async ({ page }) => {
    await page.goto('/browse-marketplace')
    await page.waitForLoadState('domcontentloaded')
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
    // Should NOT redirect to login
    await expect(page).toHaveURL(/\/browse-marketplace/)
  })

  test('unauthenticated user is redirected from protected routes', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
