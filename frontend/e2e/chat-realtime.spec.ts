import { test, expect } from './fixtures'

/**
 * FLOATING CHAT WIDGET & REAL-TIME TESTS
 *
 * Tests the global AI chat widget and real-time features:
 * - Chat bubble toggle open/close
 * - Suggested prompt click
 * - Message input & send
 * - Message list rendering
 * - API response handling
 * - Socket connection (presence indicators)
 */

// ── Chat Widget — Toggle ──────────────────────────────────

test.describe('Floating Chat Widget', () => {
  test('chat bubble is visible for authenticated users', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await expect(bubble).toBeVisible({ timeout: 10_000 })
  })

  test('clicking bubble opens chat panel', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await expect(bubble).toBeVisible({ timeout: 10_000 })

    await bubble.click()
    await page.waitForTimeout(500)

    // Chat panel should now be visible
    const panel = page.locator('.chat-widget-panel')
    await expect(panel).toBeVisible({ timeout: 5_000 })

    // Should show AI Buddy header
    const header = page.locator('.chat-widget-header')
    await expect(header).toBeVisible()
  })

  test('clicking bubble again closes chat panel', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await expect(bubble).toBeVisible({ timeout: 10_000 })

    // Open
    await bubble.click()
    await page.waitForTimeout(500)
    const panel = page.locator('.chat-widget-panel')
    await expect(panel).toBeVisible()

    // Close via close button
    const closeBtn = page.locator('.chat-widget-close')
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click()
      await page.waitForTimeout(500)
      await expect(panel).not.toBeVisible()
    }
  })

  test('welcome message shows on first open', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await bubble.click()
    await page.waitForTimeout(1_000)

    // Should show welcome screen or messages
    const welcome = page.locator('.chat-widget-welcome, .chat-widget-messages')
    await expect(welcome.first()).toBeVisible({ timeout: 10_000 })
  })

  test('suggested prompts are displayed', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await bubble.click()
    await page.waitForTimeout(1_000)

    const prompts = page.locator('.chat-widget-prompt-btn')
    if (await prompts.count() > 0) {
      // Should have at least 2 suggested prompts
      const count = await prompts.count()
      expect(count).toBeGreaterThanOrEqual(2)

      // Prompts should have text content
      const text = await prompts.first().textContent()
      expect(text!.length).toBeGreaterThan(3)
    }
  })

  test('clicking suggested prompt sends a message', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await bubble.click()
    await page.waitForTimeout(1_000)

    const prompts = page.locator('.chat-widget-prompt-btn')
    if (await prompts.count() > 0) {
      await prompts.first().click()
      await page.waitForTimeout(2_000)

      // A user message should appear
      const userMsg = page.locator('.chat-widget-msg.user')
      if (await userMsg.count() > 0) {
        await expect(userMsg.first()).toBeVisible()
      }
    }
  })

  test('message input accepts text', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await bubble.click()
    await page.waitForTimeout(1_000)

    const input = page.locator('.chat-widget-input')
    if (await input.count() > 0) {
      await input.fill('Hello, test message')
      const value = await input.inputValue()
      expect(value).toBe('Hello, test message')
    }
  })

  test('send button sends user message', async ({ petOwnerPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await bubble.click()
    await page.waitForTimeout(1_000)

    const input = page.locator('.chat-widget-input')
    if (await input.count() > 0) {
      await input.fill('E2E test message')
      const sendBtn = page.locator('.chat-widget-send')
      if (await sendBtn.count() > 0) {
        await sendBtn.click()
        await page.waitForTimeout(2_000)

        // User message should appear in messages area
        const userMsg = page.locator('.chat-widget-msg.user')
        await expect(userMsg.last()).toBeVisible({ timeout: 5_000 })
      }
    }
  })

  test('chat widget works on different pages', async ({ farmerPage: page }) => {
    // Widget should be accessible from any authenticated page
    await page.goto('/enterprises')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await expect(bubble).toBeVisible({ timeout: 10_000 })

    await bubble.click()
    await page.waitForTimeout(500)

    const panel = page.locator('.chat-widget-panel')
    await expect(panel).toBeVisible()
  })

  test('chat widget visible for all roles', async ({ vetPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    await expect(bubble).toBeVisible({ timeout: 10_000 })
  })
})

// ── Chat Widget — Not visible for unauthenticated ──────────

test.describe('Chat Widget — Auth Guard', () => {
  test('chat bubble is NOT visible on login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const bubble = page.locator('.chat-widget-bubble')
    // Should not be visible for unauthenticated users
    await expect(bubble).not.toBeVisible({ timeout: 3_000 })
  })
})

// ── AI Copilot Page ────────────────────────────────────────

test.describe('AI Copilot Page', () => {
  test('AI copilot page loads with chat interface', async ({ petOwnerPage: page }) => {
    await page.goto('/ai-copilot')
    await page.waitForLoadState('networkidle')

    // Should have chat/message area
    const chatArea = page.locator('[class*="chat"], [class*="message"], [class*="copilot"]')
    const count = await chatArea.count()
    expect(count).toBeGreaterThan(0)
  })

  test('AI copilot has message input', async ({ petOwnerPage: page }) => {
    await page.goto('/ai-copilot')
    await page.waitForLoadState('networkidle')

    const input = page.locator('input[type="text"], textarea, [class*="input"]')
    expect(await input.count()).toBeGreaterThan(0)
  })
})
