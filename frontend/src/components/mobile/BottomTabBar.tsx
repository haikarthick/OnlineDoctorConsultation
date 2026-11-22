import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { MenuItem } from '../../types'
import { resolveBottomTabs, isTabActive } from '../../navigation/bottomTabs'
import { BottomSheet } from './BottomSheet'

interface BottomTabBarProps {
  /** The destinations this user may open (from useNavMenuItems). */
  items: MenuItem[]
  currentPath: string
  onNavigate: (path: string) => void
  /** Whether the full menu ("More") is open, and how to toggle it. */
  moreOpen: boolean
  onMore: () => void
}

/**
 * The phone bottom tab bar, for every role. Hidden on wide screens, where the sidebar is the
 * navigation. What each role sees is data in src/navigation/bottomTabs.ts - this component only
 * draws it: five cells - up to three or four destinations, a middle "+" that opens the role's
 * quick actions (when it has any), and "More" for the full menu.
 */
export const BottomTabBar: React.FC<BottomTabBarProps> = ({ items, currentPath, onNavigate, moreOpen, onMore }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)

  const { tabs, quickActions } = useMemo(() => resolveBottomTabs(user?.role, items), [user?.role, items])
  if (!user || tabs.length === 0) return null

  // Short label for the bar (full menu labels are too long for a 60px column). Looked up as
  // mobileUi.tabLabelsByRole.<role>.<id>, then mobileUi.tabLabels.<id>, then the menu's own label,
  // so a new destination works before anyone writes a short label for it.
  const tabLabel = (item: MenuItem): string => {
    if (item.id === 'dashboard') return t('mobileUi.tabs.home')
    return t(`mobileUi.tabLabelsByRole.${user.role}.${item.id}`, {
      defaultValue: t(`mobileUi.tabLabels.${item.id}`, { defaultValue: item.label }),
    })
  }

  const hasAdd = quickActions.length > 0
  // Five cells in all. With "+": two tabs, "+" in the middle, one tab, More.
  const left = hasAdd ? tabs.slice(0, 2) : tabs
  const right = hasAdd ? tabs.slice(2) : []

  const go = (path: string) => {
    setSheetOpen(false)
    onNavigate(path)
  }

  const tabButton = (item: MenuItem) => {
    const active = !moreOpen && isTabActive(item.path, currentPath)
    return (
      <button
        key={`${item.id}:${item.path}`}
        type="button"
        className={`bottom-tab ${active ? 'is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => go(item.path)}
      >
        <span className="bottom-tab-icon" aria-hidden="true">{item.icon}</span>
        <span className="bottom-tab-label">{tabLabel(item)}</span>
      </button>
    )
  }

  return (
    <>
      <nav className={`bottom-tabbar ${hasAdd ? 'has-add' : ''}`} aria-label={t('mobileUi.tabBarLabel')}>
        {left.map(tabButton)}
        {hasAdd && (
          <button
            type="button"
            className="bottom-tab-add"
            aria-label={t('mobileUi.tabs.add')}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            <span aria-hidden="true">+</span>
          </button>
        )}
        {right.map(tabButton)}
        <button
          type="button"
          className={`bottom-tab ${moreOpen ? 'is-active' : ''}`}
          aria-expanded={moreOpen}
          aria-controls="nav-sidebar"
          onClick={onMore}
        >
          <span className="bottom-tab-icon" aria-hidden="true">{moreOpen ? '✕' : '⋯'}</span>
          <span className="bottom-tab-label">{t('mobileUi.tabs.more')}</span>
        </button>
      </nav>

      <BottomSheet open={sheetOpen} title={t('mobileUi.quickActionsTitle')} onClose={() => setSheetOpen(false)} labelledBy="quick-actions-title">
        <div className="action-tile-grid">
          {quickActions.map(item => (
            <button key={`${item.id}:${item.path}`} type="button" className="action-tile" onClick={() => go(item.path)}>
              <span className="action-tile-icon" aria-hidden="true">{item.icon}</span>
              <span className="action-tile-label">{item.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}
