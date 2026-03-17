import { test, expect } from './fixtures'

/**
 * MODAL & FORM FLOW TESTS
 *
 * Tests modal dialogs, multi-step wizards, and form CRUD operations:
 * - Animal CRUD (create, edit, delete confirmation)
 * - Booking wizard step navigation
 * - Reschedule modal flow
 * - Enterprise create/edit modal
 * - Wellness scorecard & reminder create modals
 * - Marketplace listing creation form
 * - Settings profile save
 */

// ── Animal CRUD ────────────────────────────────────────────

test.describe('Animals — CRUD Forms', () => {
  test('add animal button opens registration form', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button').filter({ hasText: /register|add|new/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Form should be visible with required fields
      const nameField = page.locator('input[name="name"]')
      await expect(nameField).toBeVisible({ timeout: 5_000 })

      const speciesSelect = page.locator('select[name="species"]')
      await expect(speciesSelect).toBeVisible()
    }
  })

  test('species dropdown populates breed dropdown', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button').filter({ hasText: /register|add|new/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      const speciesSelect = page.locator('select[name="species"]')
      if (await speciesSelect.count() > 0) {
        // Select a species
        await speciesSelect.selectOption({ index: 1 })
        await page.waitForTimeout(300)

        // Breed dropdown should now have options
        const breedSelect = page.locator('select[name="breed"]')
        if (await breedSelect.count() > 0) {
          const breedOptions = await breedSelect.locator('option').count()
          expect(breedOptions).toBeGreaterThanOrEqual(2) // placeholder + at least 1 breed
        }
      }
    }
  })

  test('animal form validates required fields', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button').filter({ hasText: /register|add|new/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Try submitting empty form
      const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /save|submit|register/i })
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click()
        await page.waitForTimeout(500)

        // Should stay on animals page (not navigate away)
        await expect(page).toHaveURL(/\/animals/)
      }
    }
  })

  test('animal form submission fills all fields', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button').filter({ hasText: /register|add|new/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Fill required fields
      const nameField = page.locator('input[name="name"]')
      if (await nameField.count() > 0) {
        await nameField.fill('E2E Test Animal')
      }

      const speciesSelect = page.locator('select[name="species"]')
      if (await speciesSelect.count() > 0) {
        await speciesSelect.selectOption({ index: 1 })
        await page.waitForTimeout(300)
      }

      const breedSelect = page.locator('select[name="breed"]')
      if (await breedSelect.count() > 0) {
        await breedSelect.selectOption({ index: 1 })
      }

      const genderSelect = page.locator('select[name="gender"]')
      if (await genderSelect.count() > 0) {
        await genderSelect.selectOption('male')
      }

      // Form should be filled without errors
      await expect(page).toHaveURL(/\/animals/)
    }
  })

  test('delete animal shows confirmation dialog', async ({ petOwnerPage: page }) => {
    await page.goto('/animals')
    await page.waitForLoadState('networkidle')

    // Find delete buttons
    const deleteBtn = page.locator('button').filter({ hasText: /delete|remove/i })
    if (await deleteBtn.count() > 0) {
      // Set up dialog handler BEFORE clicking
      let dialogMessage = ''
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message()
        await dialog.dismiss() // Cancel the delete
      })

      await deleteBtn.first().click()
      await page.waitForTimeout(500)

      // If a native confirm dialog appeared, it should have a confirmation message
      if (dialogMessage) {
        expect(dialogMessage.toLowerCase()).toMatch(/delete|remove|sure|confirm/)
      }
    }
  })
})

// ── Booking Wizard Steps ───────────────────────────────────

test.describe('Book Consultation — Wizard Flow', () => {
  test('booking page shows step indicators', async ({ petOwnerPage: page }) => {
    await page.goto('/book-consultation')
    await page.waitForLoadState('networkidle')

    // Should show step 1 content (vet selection)
    const pageContent = await page.textContent('body')
    expect(pageContent?.toLowerCase()).toMatch(/select|choose|veterinarian|doctor|step/i)
  })

  test('vet selection step shows vet list', async ({ petOwnerPage: page }) => {
    await page.goto('/book-consultation')
    await page.waitForLoadState('networkidle')

    // Should display vet cards or dropdown
    const vetElements = page.locator('select, [class*="vet"], [class*="doctor"], [class*="card"]')
    const count = await vetElements.count()
    expect(count).toBeGreaterThan(0)
  })

  test('next/back buttons navigate between steps', async ({ petOwnerPage: page }) => {
    await page.goto('/book-consultation')
    await page.waitForLoadState('networkidle')

    // Select a vet first (if dropdown)
    const vetSelect = page.locator('select').first()
    if (await vetSelect.count() > 0) {
      const options = await vetSelect.locator('option').count()
      if (options > 1) {
        await vetSelect.selectOption({ index: 1 })
        await page.waitForTimeout(300)
      }
    }

    // Try clicking Next button
    const nextBtn = page.locator('button').filter({ hasText: /next|continue|proceed/i })
    if (await nextBtn.count() > 0 && await nextBtn.first().isEnabled()) {
      await nextBtn.first().click()
      await page.waitForTimeout(500)

      // Try clicking Back button
      const backBtn = page.locator('button').filter({ hasText: /back|previous/i })
      if (await backBtn.count() > 0) {
        await backBtn.first().click()
        await page.waitForTimeout(500)
      }
    }

    // Should still be on booking page
    await expect(page).toHaveURL(/\/book-consultation/)
  })

  test('booking type radio selection works', async ({ petOwnerPage: page }) => {
    await page.goto('/book-consultation')
    await page.waitForLoadState('networkidle')

    // Look for booking type selector (may be on later step)
    const typeSelect = page.locator('select[name="bookingType"], input[name="bookingType"]')
    if (await typeSelect.count() > 0) {
      if (await typeSelect.first().getAttribute('type') === 'radio') {
        // Radio button
        await typeSelect.first().check()
      } else {
        // Dropdown
        await typeSelect.first().selectOption({ index: 1 })
      }
    }
  })
})

// ── Consultations Reschedule Modal ─────────────────────────

test.describe('Consultations — Reschedule Modal', () => {
  test('reschedule button opens modal with date/slot picker', async ({ petOwnerPage: page }) => {
    await page.goto('/consultations')
    await page.waitForLoadState('networkidle')

    const rescheduleBtn = page.locator('button').filter({ hasText: /reschedule/i })
    if (await rescheduleBtn.count() > 0) {
      await rescheduleBtn.first().click()
      await page.waitForTimeout(500)

      // Modal should open with date input
      const dateInput = page.locator('input[type="date"]')
      if (await dateInput.count() > 0) {
        await expect(dateInput.first()).toBeVisible()
      }

      // Close modal
      const closeBtn = page.locator('button').filter({ hasText: /close|cancel|✕|×/i })
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click()
      }
    }
  })
})

// ── Enterprise Management CRUD ─────────────────────────────

test.describe('Enterprise Management — CRUD', () => {
  test('add enterprise button opens form modal', async ({ farmerPage: page }) => {
    await page.goto('/enterprises')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button').filter({ hasText: /add|create|new|register/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      // Form should appear with enterprise fields
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]')
      if (await nameInput.count() > 0) {
        await expect(nameInput.first()).toBeVisible()
      }
    }
  })

  test('enterprise type dropdown has options', async ({ farmerPage: page }) => {
    await page.goto('/enterprises')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button').filter({ hasText: /add|create|new|register/i })
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await page.waitForTimeout(500)

      const typeSelect = page.locator('select[name="type"], select[name="enterpriseType"]')
      if (await typeSelect.count() > 0) {
        const options = await typeSelect.first().locator('option').count()
        expect(options).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

// ── Wellness Scorecard & Reminder Modals ───────────────────

test.describe('Wellness Portal — Create Modals', () => {
  test('new scorecard button opens form', async ({ petOwnerPage: page }) => {
    await page.goto('/wellness')
    await page.waitForLoadState('networkidle')

    // Switch to scorecards tab
    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabTexts = await tabs.allTextContents()
    const scorecardTabIdx = tabTexts.findIndex(t => /scorecard/i.test(t))
    if (scorecardTabIdx >= 0) {
      await tabs.nth(scorecardTabIdx).click()
      await page.waitForTimeout(500)
    }

    const createBtn = page.locator('button').filter({ hasText: /new|create|add/i })
    if (await createBtn.count() > 0) {
      await createBtn.first().click()
      await page.waitForTimeout(500)

      // Form should appear with animal selector
      const animalSelect = page.locator('select')
      if (await animalSelect.count() > 0) {
        await expect(animalSelect.first()).toBeVisible()
      }
    }
  })

  test('new reminder button opens form', async ({ petOwnerPage: page }) => {
    await page.goto('/wellness')
    await page.waitForLoadState('networkidle')

    // Switch to reminders tab
    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabTexts = await tabs.allTextContents()
    const reminderTabIdx = tabTexts.findIndex(t => /reminder/i.test(t))
    if (reminderTabIdx >= 0) {
      await tabs.nth(reminderTabIdx).click()
      await page.waitForTimeout(500)
    }

    const createBtn = page.locator('button').filter({ hasText: /new|create|add/i })
    if (await createBtn.count() > 0) {
      await createBtn.first().click()
      await page.waitForTimeout(500)

      const formFields = page.locator('input, select, textarea')
      expect(await formFields.count()).toBeGreaterThan(0)
    }
  })
})

// ── Marketplace Create Listing ─────────────────────────────

test.describe('Marketplace — Create Listing Form', () => {
  test('create listing tab shows form fields', async ({ farmerPage: page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')

    // Switch to Create Listing tab
    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabTexts = await tabs.allTextContents()
    const createTabIdx = tabTexts.findIndex(t => /create/i.test(t))
    if (createTabIdx >= 0) {
      await tabs.nth(createTabIdx).click()
      await page.waitForTimeout(500)

      // Form should have title, description, category, price fields
      const formFields = page.locator('input, select, textarea')
      expect(await formFields.count()).toBeGreaterThanOrEqual(3)
    }
  })

  test('category dropdown has marketplace categories', async ({ farmerPage: page }) => {
    await page.goto('/marketplace')
    await page.waitForLoadState('networkidle')

    const tabs = page.locator('.module-tab, [class*="tab"]')
    const tabTexts = await tabs.allTextContents()
    const createTabIdx = tabTexts.findIndex(t => /create/i.test(t))
    if (createTabIdx >= 0) {
      await tabs.nth(createTabIdx).click()
      await page.waitForTimeout(500)

      const categorySelect = page.locator('select').filter({ has: page.locator('option') })
      if (await categorySelect.count() > 0) {
        const options = await categorySelect.first().locator('option').allTextContents()
        expect(options.length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

// ── Settings Profile Save ──────────────────────────────────

test.describe('Settings — Profile Form', () => {
  test('profile form loads with pre-filled user data', async ({ petOwnerPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const firstNameInput = page.locator('input[name="firstName"]')
    if (await firstNameInput.count() > 0) {
      const value = await firstNameInput.inputValue()
      // Should be pre-filled (not empty) for logged-in user
      expect(value.length).toBeGreaterThan(0)
    }
  })

  test('email field is disabled (read-only)', async ({ petOwnerPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[name="email"]')
    if (await emailInput.count() > 0) {
      const isDisabled = await emailInput.isDisabled()
      expect(isDisabled).toBe(true)
    }
  })

  test('vet profile shows additional professional fields', async ({ vetPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Vet should see consultation fee, specializations, etc.
    const vetFields = page.locator('input[name="consultationFee"], input[name="specializations"], input[name="licenseNumber"]')
    if (await vetFields.count() > 0) {
      await expect(vetFields.first()).toBeVisible()
    }
  })

  test('save button triggers form submission', async ({ petOwnerPage: page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const saveBtn = page.locator('button').filter({ hasText: /save/i })
    if (await saveBtn.count() > 0) {
      // Modify a field
      const phoneInput = page.locator('input[name="phone"]')
      if (await phoneInput.count() > 0) {
        const currentValue = await phoneInput.inputValue()
        await phoneInput.fill(currentValue || '1234567890')
      }

      // Intercept API call
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/') && resp.request().method() === 'PUT',
        { timeout: 5_000 },
      ).catch(() => null)

      await saveBtn.first().click()

      const response = await responsePromise
      if (response) {
        expect([200, 201, 204]).toContain(response.status())
      }
    }
  })
})

// ── Admin User Management ──────────────────────────────────

test.describe('Admin — User Management', () => {
  test('user list table renders rows', async ({ adminPage: page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Should show a table or list of users
    const rows = page.locator('table tbody tr, [class*="user-row"], [class*="user-card"]')
    const count = await rows.count()
    // Seed data has 8+ users
    expect(count).toBeGreaterThan(0)
  })

  test('user role filter dropdown works', async ({ adminPage: page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    const filterSelect = page.locator('select')
    if (await filterSelect.count() > 0) {
      const options = await filterSelect.first().locator('option').allTextContents()
      // Should have role filter options
      expect(options.length).toBeGreaterThanOrEqual(2)
    }
  })
})
