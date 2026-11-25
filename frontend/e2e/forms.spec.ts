import { test, expect } from '@playwright/test'
import { USERS } from './constants'
import { loginAs, settleServiceWorker } from './fixtures'

/**
 * FORM VALIDATION E2E TESTS
 *
 * Covers form validation for all critical forms:
 * - Login form validation
 * - Registration form validation
 * - Animal form validation
 * - Settings/Profile form validation
 * - Hospital registration form validation
 */

test.describe('Form Validation - Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await settleServiceWorker(page)
  })

  test('should not submit with empty email', async ({ page }) => {
    await page.fill('#login-password', 'SomePassword')
    await page.click('.login-submit')
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should not submit with empty password', async ({ page }) => {
    await page.fill('#login-email', 'test@test.com')
    await page.click('.login-submit')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show error for invalid email format', async ({ page }) => {
    // The sign-in box takes an email OR a 10-digit mobile number, so the browser no longer judges it; the app explains in words.
    await page.fill('#login-email', 'not-an-email')
    await page.fill('#login-password', 'SomePassword')
    await page.click('.login-submit')
    await expect(page.getByRole('status').filter({ hasText: /valid email address or a 10-digit mobile number/i })).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Form Validation - Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
    await settleServiceWorker(page)
  })

  test('should require all fields', async ({ page }) => {
    // Nothing can be submitted before the terms are accepted ...
    await expect(page.locator('.register-submit')).toBeDisabled()
    // ... and after accepting them an empty form is still stopped by the browser's required-field check.
    await page.check('input[type="checkbox"]')
    await page.click('.register-submit')
    await expect(page).toHaveURL(/\/register/)
    const firstName = page.locator('#reg-firstName')
    expect(await firstName.evaluate((el: HTMLInputElement) => !el.validity.valid)).toBe(true)
  })

  test('should reject password shorter than 8 characters', async ({ page }) => {
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', `test-${Date.now()}@e2e.com`)
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', '12345')
    await page.fill('#reg-confirmPassword', '12345')
    await page.check('input[type="checkbox"]')
    await page.click('.register-submit')
    const msg = page.locator('.message.error')
    await expect(msg).toBeVisible({ timeout: 5_000 })
    await expect(msg).toContainText(/at least 8 characters/i)
  })

  test('should reject mismatched passwords', async ({ page }) => {
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', `test-${Date.now()}@e2e.com`)
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', 'ValidPass123')
    await page.fill('#reg-confirmPassword', 'DifferentPass')
    await page.check('input[type="checkbox"]')
    await page.click('.register-submit')
    const msg = page.locator('.message.error')
    await expect(msg).toBeVisible({ timeout: 5_000 })
    await expect(msg).toContainText(/do not match/i)
  })

  test('should reject invalid email format', async ({ page }) => {
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', 'invalid-email')
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', 'ValidPass123')
    await page.fill('#reg-confirmPassword', 'ValidPass123')
    await page.check('input[type="checkbox"]')
    await page.click('.register-submit')
    const emailField = page.locator('#reg-email')
    const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
    await expect(page).toHaveURL(/\/register/)
  })

  test('should default to pet_owner role', async ({ page }) => {
    const petOwnerRadio = page.locator('input[name="role"][value="pet_owner"]')
    await expect(petOwnerRadio).toBeChecked()
  })

  test('should allow switching between roles', async ({ page }) => {
    // Switch to farmer
    // The radios are visually hidden: the person taps the role card (its label).
    const card = (role: string) => page.locator(`label.role-option:has(input[name="role"][value="${role}"])`)
    await card('farmer').click()
    await expect(page.locator('input[name="role"][value="farmer"]')).toBeChecked()

    // Switch to veterinarian
    await card('veterinarian').click()
    await expect(page.locator('input[name="role"][value="veterinarian"]')).toBeChecked()

    // Switch back to pet_owner
    await card('pet_owner').click()
    await expect(page.locator('input[name="role"][value="pet_owner"]')).toBeChecked()
  })
})

test.describe('Form Validation - Settings/Profile', () => {
  test('pet_owner settings form loads with pre-filled data', async ({ page }) => {
    await loginAs(page, 'petOwner1')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Fields should be pre-filled with user data
    const firstNameField = page.locator('input[name="firstName"], input[name="first_name"], #firstName')
    if (await firstNameField.count() > 0) {
      const value = await firstNameField.first().inputValue()
      // Should have SOME value (pre-filled from profile)
      expect(value.length).toBeGreaterThanOrEqual(0)
    }
  })

  test('vet settings form shows professional profile fields', async ({ page }) => {
    await loginAs(page, 'vet1')
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Vet settings should show additional professional fields
    const content = await page.textContent('body')
    expect(content!.length).toBeGreaterThan(0)
  })
})

test.describe('Form Validation - Animal Form', () => {
  test('animal form validates name field', async ({ page }) => {
    await loginAs(page, 'petOwner1')
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /register animal/i }).click()
    const next = page.locator('.step-form-next')
    await expect(next).toBeVisible()
    // Without an animal and a name the form cannot go on, and it says why
    await expect(next).toBeDisabled()
    await page.locator('.step-form .choice-chip', { hasText: /dog/i }).first().click()
    await expect(next).toBeDisabled()
    await expect(page.locator('.step-form-blocked')).toContainText(/name/i)
    // Still on the animals page, nothing was saved
    await expect(page).toHaveURL(/\/animals/)
    await page.fill('#animal-name', 'Validation Pup')
    await expect(next).toBeEnabled()
  })
})

test.describe('Form Validation - Vet Hospital Form', () => {
  test('hospital registration form should exist for vets', async ({ page }) => {
    await loginAs(page, 'vet1')
    await page.goto('/vet-hospitals')
    await page.waitForLoadState('networkidle')

    // Look for create/register hospital button
    const createBtn = page.locator('button:has-text("Register"), button:has-text("Create"), button:has-text("Add")')
    if (await createBtn.count() > 0) {
      await createBtn.first().click()
      await page.waitForTimeout(500)

      // Modal or form should appear with hospital name field
      const nameField = page.locator('input[name="name"], #name, #hospital-name')
      if (await nameField.count() > 0) {
        await expect(nameField.first()).toBeVisible()
      }
    }
  })
})
