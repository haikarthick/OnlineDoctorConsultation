import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { BOTTOM_TABS, MAX_TABS, MAX_TABS_WITH_ADD, resolveBottomTabs, isTabActive } from './bottomTabs'
import { buildMenuItems } from './menuItems'
import type { MenuItem, User } from '../types'

/**
 * Guards the phone tab bar against drifting away from the menu it is built from. The config is
 * only ids, so the failure it can have is an id that no longer exists (a screen was renamed or
 * removed) - which would silently shrink a role's bar. These tests fail loudly instead.
 */

const t = ((key: string) => key) as unknown as TFunction
const user = (role: string): User => ({ id: 'u', role, roles: [role] } as unknown as User)

/** What a given role could ever open, ignoring live permissions and feature flags. */
function menuFor(role: string): MenuItem[] {
  return buildMenuItems(t, user(role)).filter(item => item.roles.includes(role as never))
}

describe('bottom tab bar config', () => {
  const allIds = new Set(buildMenuItems(t, user('admin')).concat(...['farmer', 'pet_owner', 'veterinarian'].map(r => buildMenuItems(t, user(r)))).map(i => i.id))

  for (const [role, config] of Object.entries(BOTTOM_TABS)) {
    it(`${role}: every configured id is a real menu item`, () => {
      const unknown = [...config.tabs, ...config.quickActions].filter(id => !allIds.has(id))
      expect(unknown).toEqual([])
    })

    it(`${role}: gets a full bar from its own menu`, () => {
      const available = menuFor(role)
      const { tabs, quickActions } = resolveBottomTabs(role, available)
      // Always five cells: tabs + ("+" when there are quick actions) + More.
      const cells = quickActions.length > 0 ? MAX_TABS_WITH_ADD : MAX_TABS
      // A role whose whole menu is smaller than the bar simply gets everything it has.
      expect(tabs.length).toBe(Math.min(cells, new Set(available.map(i => i.path)).size))
    })

    it(`${role}: never offers a destination its menu would hide`, () => {
      const available = menuFor(role)
      const paths = new Set(available.map(i => i.path))
      const { tabs, quickActions } = resolveBottomTabs(role, available)
      for (const item of [...tabs, ...quickActions]) expect(paths.has(item.path)).toBe(true)
    })

    it(`${role}: no destination appears twice in the tabs`, () => {
      const { tabs } = resolveBottomTabs(role, menuFor(role))
      expect(new Set(tabs.map(i => i.path)).size).toBe(tabs.length)
    })
  }

  // A destination on the bar without a short label falls back to its long menu label, which
  // truncates in a 60px column. Not an error at runtime, but a regression in readability.
  const enLabels = Object.values(
    import.meta.glob('../locales/en/modules/mobileUi.json', { eager: true }) as Record<string, { default: { mobileUi: { tabLabels: Record<string, string> } } }>,
  )[0].default.mobileUi.tabLabels

  it('every destination used as a tab has a short label (all roles)', () => {
    const missing = Object.entries(BOTTOM_TABS).flatMap(([role, config]) =>
      config.tabs.filter(id => id !== 'dashboard' && !enLabels[id]).map(id => `${role}:${id}`))
    expect(missing).toEqual([])
  })

  it('short labels are short enough for a tab (14 characters or fewer)', () => {
    const tooLong = Object.entries(enLabels).filter(([, label]) => label.length > 14).map(([id]) => id)
    expect(tooLong).toEqual([])
  })

  it('every system role the menu knows has a bar', () => {
    const roles = new Set(buildMenuItems(t, user('admin')).flatMap(i => i.roles as string[]))
    expect([...roles].filter(r => !BOTTOM_TABS[r])).toEqual([])
  })

  it('a hidden preferred tab is replaced by the next one, not left as a gap', () => {
    const available = menuFor('farmer').filter(i => i.id !== 'animals')
    const { tabs } = resolveBottomTabs('farmer', available)
    expect(tabs).toHaveLength(MAX_TABS_WITH_ADD)
    expect(tabs.some(i => i.id === 'animals')).toBe(false)
  })

  it('an unknown role still gets a usable bar', () => {
    const available = menuFor('farmer')
    expect(resolveBottomTabs('astronaut', available).tabs.length).toBeGreaterThan(0)
    expect(resolveBottomTabs(undefined, available).quickActions).toEqual([])
  })

  it('an empty menu resolves to an empty bar without throwing', () => {
    expect(resolveBottomTabs('farmer', [])).toEqual({ tabs: [], quickActions: [] })
  })

  it('the farmer gets the "+" quick actions (the daily recording entry point)', () => {
    expect(resolveBottomTabs('farmer', menuFor('farmer')).quickActions.length).toBeGreaterThan(0)
  })
})

describe('isTabActive', () => {
  it('matches the page and pages under it, like the sidebar', () => {
    expect(isTabActive('/animals', '/animals')).toBe(true)
    expect(isTabActive('/animals', '/animals/123')).toBe(true)
    expect(isTabActive('/animals', '/animal-groups')).toBe(false)
  })
  it('keeps Home and Settings from lighting up on every page', () => {
    expect(isTabActive('/dashboard', '/dashboard/anything')).toBe(false)
    expect(isTabActive('/settings', '/settings/profile')).toBe(false)
  })
})
