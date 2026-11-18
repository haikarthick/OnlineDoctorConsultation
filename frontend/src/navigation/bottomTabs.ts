import { MenuItem } from '../types'

/**
 * The phone bottom tab bar and quick-action sheet for every role - as DATA.
 *
 * To change what a role sees on a phone, edit this file only. Each entry is a list of menu-item
 * ids from src/navigation/menuItems.ts in order of preference:
 *
 *   tabs          the bar is always FIVE cells. With quick actions: two tabs, the "+" in the
 *                 middle, one tab, More (so the first THREE ids the user can open become tabs).
 *                 Without quick actions: four tabs, then More. Extra ids are fallbacks, used when
 *                 a preferred one is hidden by a permission or a feature flag.
 *   quickActions  the tiles behind the middle "+" button - the things this role does most. Leave
 *                 it empty and the role simply has no "+" button.
 *
 * Paths, labels, icons and permissions are NOT repeated here: they come from the menu item, so a
 * destination can never be offered on the tab bar to someone the sidebar would hide it from.
 */
export interface RoleTabConfig {
  tabs: string[]
  quickActions: string[]
}

export const BOTTOM_TABS: Record<string, RoleTabConfig> = {
  farmer: {
    tabs: ['dashboard', 'animals', 'herd-medical', 'animal-groups', 'medical', 'consultations'],
    quickActions: ['marketplace', 'farm-records', 'animals', 'animal-groups', 'herd-medical', 'breeding', 'feed-inventory', 'movement-log', 'campaigns', 'book-consultation'],
  },
  pet_owner: {
    tabs: ['dashboard', 'animals', 'medical', 'consultations', 'prescriptions'],
    quickActions: ['book-consultation', 'find-doctor', 'marketplace', 'grooming-find', 'vaccination-passport', 'animal-timeline', 'write-review'],
  },
  veterinarian: {
    tabs: ['dashboard', 'consultations', 'prescriptions', 'manage-schedule', 'animals'],
    quickActions: ['manage-schedule', 'hospital-workflow', 'inpatient', 'vet-certificates', 'herd-medical', 'medical'],
  },
  hospital_staff: {
    tabs: ['dashboard', 'hospital-workflow', 'inpatient', 'hospital-networks', 'vet-hospitals', 'settings'],
    quickActions: [],
  },
  pharmacist: {
    tabs: ['dashboard', 'pharmacy', 'settings'],
    quickActions: [],
  },
  groomer: {
    tabs: ['dashboard', 'grooming-orders', 'grooming-schedule', 'grooming-earnings', 'grooming-provider', 'settings'],
    quickActions: [],
  },
  admin: {
    tabs: ['admin-dashboard', 'admin-users', 'admin-consultations', 'admin-finance-reports', 'dashboard'],
    quickActions: ['admin-payments', 'admin-disputes', 'admin-medical-records', 'admin-master-data', 'admin-permissions', 'admin-settings', 'admin-audit', 'hospital-networks'],
  },
  corporate_admin: {
    tabs: ['dashboard', 'hospital-networks', 'hospital-workflow', 'inpatient', 'financial', 'health-analytics', 'settings'],
    quickActions: ['pharmacy', 'wallet', 'ai-copilot'],
  },
  support: {
    tabs: ['dashboard', 'admin-disputes', 'admin-cancellation-dashboard', 'settings'],
    quickActions: [],
  },
}

/** Used for a role with no entry above: whatever the menu offers first. */
const FALLBACK: RoleTabConfig = { tabs: ['dashboard'], quickActions: [] }

/** Five cells in all: tabs + (the "+" when there are quick actions) + More. Keeps every label wide enough to read. */
export const MAX_TABS = 4
export const MAX_TABS_WITH_ADD = 3
export const MAX_QUICK_ACTIONS = 10

export interface ResolvedBottomTabs {
  tabs: MenuItem[]
  quickActions: MenuItem[]
}

/**
 * Turns the config for a role into the items to draw, given the destinations the user may open.
 * Pure, so it is unit-tested: every role must get a usable bar from its own menu.
 */
export function resolveBottomTabs(role: string | undefined | null, available: MenuItem[]): ResolvedBottomTabs {
  const config = (role && BOTTOM_TABS[role]) || FALLBACK
  // The same id can appear twice in the menu for different roles (e.g. 'prescriptions'); the
  // list is already filtered to this user, so the first match is theirs.
  const byId = new Map<string, MenuItem>()
  for (const item of available) if (!byId.has(item.id)) byId.set(item.id, item)

  const pick = (ids: string[], max: number, skipPaths: Set<string>): MenuItem[] => {
    const out: MenuItem[] = []
    for (const id of ids) {
      const item = byId.get(id)
      if (!item || skipPaths.has(item.path)) continue
      out.push(item)
      skipPaths.add(item.path)
      if (out.length === max) break
    }
    return out
  }

  // A quick action may repeat a tab (a farmer's "+" should still offer Animals).
  const quickActions = pick(config.quickActions, MAX_QUICK_ACTIONS, new Set<string>())
  // The "+" takes a cell, so a role with quick actions shows one tab fewer.
  const maxTabs = quickActions.length > 0 ? MAX_TABS_WITH_ADD : MAX_TABS

  const usedPaths = new Set<string>()
  const tabs = pick(config.tabs, maxTabs, usedPaths)
  // Not enough of the preferred ones available: top up from the menu, in menu order, so a role
  // never ends up with a half-empty bar.
  if (tabs.length < maxTabs) {
    for (const item of available) {
      if (tabs.length === maxTabs) break
      if (usedPaths.has(item.path)) continue
      tabs.push(item)
      usedPaths.add(item.path)
    }
  }
  return { tabs, quickActions }
}

/** True when `path` is the current page or a page under it - same rule the sidebar uses. */
export function isTabActive(path: string, currentPath: string): boolean {
  return currentPath === path || (path !== '/dashboard' && path !== '/settings' && currentPath.startsWith(path + '/'))
}
