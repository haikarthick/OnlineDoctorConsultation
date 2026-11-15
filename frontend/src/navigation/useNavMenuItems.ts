import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { usePermission, NAV_PERMISSION_MAP } from '../context/PermissionContext'
import { useGroomingEnabled } from '../hooks/useGroomingEnabled'
import { MenuItem, UserRole } from '../types'
import { buildMenuItems } from './menuItems'

/**
 * The destinations the signed-in user may actually open right now: the full menu filtered by
 * role, live permission and feature flags. The sidebar, the bottom tab bar and the quick-action
 * sheet all call this, so an item hidden in one place is hidden in all of them.
 */
export function useNavMenuItems(): MenuItem[] {
  const { user } = useAuth()
  const { hasPermission, networks } = usePermission()
  const { enabled: groomingEnabled } = useGroomingEnabled()
  const { t } = useTranslation()

  return useMemo(() => {
    const menuItems = buildMenuItems(t, user)
    // Filter by role AND permission - supports multi-role users (P4-HIGH1)
    return menuItems.filter(item => {
      const userRoles = user?.roles && user.roles.length > 0 ? user.roles : (user?.role ? [user.role] : [])
      if (!item.roles.some(r => userRoles.includes(r as UserRole))) return false
      const permKey = NAV_PERMISSION_MAP[item.id]
      if (permKey && !hasPermission(permKey)) return false
      // §7 hierarchy visibility: vets/staff only see Hospital Networks if they actually belong to a
      // network (admins & corporate_admins always manage networks). Avoids a misleading global entry.
      if (item.id === 'hospital-networks'
          && !userRoles.includes('admin' as UserRole)
          && !userRoles.includes('corporate_admin' as UserRole)
          && networks.length === 0) {
        return false
      }
      // Grooming onboarding CTA disappears once the user owns/staffs a provider - from then on the
      // "My Grooming Business" console entry covers the same route.
      if (item.id === 'grooming-apply' && hasPermission('grooming_provider_console')) {
        return false
      }
      // Dark launch: while `grooming.enabled` is off every /grooming route 404s server-side, so the
      // whole section is hidden rather than leading users into dead pages. Permissions alone can't
      // do this - the flag is a runtime setting, not a role.
      if (item.section === 'Grooming & Spa' && !groomingEnabled) {
        return false
      }
      return true
    })
  }, [t, user, hasPermission, networks, groomingEnabled])
}
