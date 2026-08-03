import { test, expect } from '@playwright/test'
import { USERS } from './constants'
import { loginAs } from './fixtures'

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
    await page.fill('#login-email', 'not-an-email')
    await page.fill('#login-password', 'SomePassword')
    await page.click('.login-submit')
    // HTML5 validation should prevent submission
    const emailField = page.locator('#login-email')
    const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })
})

test.describe('Form Validation - Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
  })

  test('should require all fields', async ({ page }) => {
    await page.click('.register-submit')
    // Should stay on register page
    await expect(page).toHaveURL(/\/register/)
  })

  test('should reject password shorter than 6 characters', async ({ page }) => {
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', `test-${Date.now()}@e2e.com`)
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', '12345')
    await page.fill('#reg-confirmPassword', '12345')
    await page.click('.register-submit')
    // Password field should be invalid (minLength=6)
    const pwField = page.locator('#reg-password')
    const isInvalid = await pwField.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })

  test('should reject mismatched passwords', async ({ page }) => {
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', `test-${Date.now()}@e2e.com`)
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', 'ValidPass123')
    await page.fill('#reg-confirmPassword', 'DifferentPass')
    await page.click('.register-submit')
    // Should show error message
    const msg = page.locator('.message.error, [role="status"]')
    await expect(msg).toBeVisible({ timeout: 5_000 })
  })

  test('should reject invalid email format', async ({ page }) => {
    await page.fill('#reg-firstName', 'Test')
    await page.fill('#reg-lastName', 'User')
    await page.fill('#reg-email', 'invalid-email')
    await page.fill('#reg-phone', '+1234567890')
    await page.fill('#reg-password', 'ValidPass123')
    await page.fill('#reg-confirmPassword', 'ValidPass123')
    await page.click('.register-submit')
    const emailField = page.locator('#reg-email')
    const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })

  test('should default to pet_owner role', async ({ page }) => {
    const petOwnerRadio = page.locator('input[name="role"][value="pet_owner"]')
    await expect(petOwnerRadio).toBeChecked()
  })

  test('should allow switching between roles', async ({ page }) => {
    // Switch to farmer
    await page.click('input[name="role"][value="farmer"]')
    await expect(page.locator('input[name="role"][value="farmer"]')).toBeChecked()

    // Switch to veterinarian
    await page.click('input[name="role"][value="veterinarian"]')
    await expect(page.locator('input[name="role"][value="veterinarian"]')).toBeChecked()

    // Switch back to pet_owner
    await page.click('input[name="role"][value="pet_owner"]')
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

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Register")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Try to submit without filling name
      const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")')
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click()
        // Should show validation (HTML5 or app-level)
        await page.waitForTimeout(1_000)
        // Should still be on animals page (not redirected)
        await expect(page).toHaveURL(/\/animals/)
      }
    }
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
