import { test, expect } from './fixtures'

/**
 * NOTIFICATIONS INBOX (orphan workstream W1): every role has one bell and one list; it explains itself in words, never an error code.
 */
async function bellOpensList(page: import('@playwright/test').Page) {
  const bell = page.locator('button.notification-bell')
  await expect(bell).toBeVisible()
  await bell.click()
  await expect(page).toHaveURL(/\/notifications/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const text = (await page.textContent('body')) || ''
  expect(text).not.toMatch(/(403|404|500)|Request failed with status/)
}

test('pet owner: the bell opens the notifications list', async ({ petOwnerPage: page }) => { await bellOpensList(page) })
test('veterinarian: the bell opens the notifications list', async ({ vetPage: page }) => { await bellOpensList(page) })
test('admin: the bell opens the notifications list', async ({ adminPage: page }) => { await bellOpensList(page) })

test('pet owner: marking all read leaves nothing unread', async ({ petOwnerPage: page }) => {
  await page.goto('/notifications')
  const markAll = page.getByRole('button', { name: /mark all|सभी को पढ़ा/i })
  await expect(markAll).toBeVisible()
  if (await markAll.isEnabled()) await markAll.click()
  await expect(markAll).toBeDisabled()
  await expect(page.locator('.notification-row-unread')).toHaveCount(0)
})
