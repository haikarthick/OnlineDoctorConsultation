import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useNavMenuItems } from '../navigation/useNavMenuItems'
import { BottomTabBar } from './mobile/BottomTabBar'
import { LanguageSwitcher } from './LanguageSwitcher'
import { WayToVetLogo } from './WayToVetLogo'
import { MenuItem } from '../types'
import './Navigation.css'

interface NavigationProps {
  onNavigate: (path: string) => void
  currentPath: string
}

const SIDEBAR_COLLAPSED_KEY = 'vetcare_sidebar_collapsed'
const NAV_SCROLL_KEY = 'vetcare_nav_scroll'

export const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentPath }) => {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true' } catch { return false }
  })

  // Ref for the scrollable nav-menu container
  const navMenuRef = useRef<HTMLDivElement>(null)
  // Ref for the active menu item (for scroll-into-view)
  const activeItemRef = useRef<HTMLButtonElement>(null)

  // Persist collapse preference & notify Layout
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed)) } catch {}
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: isCollapsed } }))
  }, [isCollapsed])

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setIsCollapsed(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Restore scroll position when component mounts
  useEffect(() => {
    const saved = sessionStorage.getItem(NAV_SCROLL_KEY)
    if (saved && navMenuRef.current) {
      navMenuRef.current.scrollTop = parseInt(saved, 10)
    }
  }, [])

  // Save scroll position on scroll (debounced via requestAnimationFrame)
  useEffect(() => {
    const el = navMenuRef.current
    if (!el) return
    let rafId: number
    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        try { sessionStorage.setItem(NAV_SCROLL_KEY, String(el.scrollTop)) } catch {}
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId) }
  }, [])

  // When active item changes, scroll it into view only if it's outside the visible area
  useEffect(() => {
    const btn = activeItemRef.current
    const container = navMenuRef.current
    if (!btn || !container) return
    const btnTop = btn.offsetTop
    const btnBottom = btnTop + btn.offsetHeight
    const containerTop = container.scrollTop
    const containerBottom = containerTop + container.clientHeight
    const isVisible = btnTop >= containerTop + 4 && btnBottom <= containerBottom - 4
    if (!isVisible) {
      container.scrollTop = btnTop - container.clientHeight / 2 + btn.offsetHeight / 2
      try { sessionStorage.setItem(NAV_SCROLL_KEY, String(container.scrollTop)) } catch {}
    }
  }, [currentPath])

  // Menu definitions live in src/navigation/menuItems.ts; role / permission / feature-flag
  // filtering in useNavMenuItems(). The bottom tab bar reads the same list.
  const filteredMenuItems = useNavMenuItems()

  // Group filtered items by section
  const groupedMenuItems = useMemo(() => {
    const groups: { section: string; items: MenuItem[] }[] = []
    let currentSection = ''
    for (const item of filteredMenuItems) {
      const s = item.section || ''
      if (s !== currentSection) {
        currentSection = s
        groups.push({ section: s, items: [] })
      }
      groups[groups.length - 1].items.push(item)
    }
    return groups
  }, [filteredMenuItems])

  // Track collapsed sections - start with advanced sections collapsed
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'Innovation': true,
    'Intelligence': true,
  })

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const handleLogout = () => {
    logout()
    onNavigate('/login')
    setIsMobileMenuOpen(false)
  }

  const handleMenuClick = (path: string) => {
    onNavigate(path)
    setIsMobileMenuOpen(false)
  }

  const isActive = (path: string) => currentPath === path || (path !== '/dashboard' && path !== '/settings' && currentPath.startsWith(path + '/'))

  // Auto-expand section containing the active route
  useEffect(() => {
    for (const group of groupedMenuItems) {
      const hasActiveItem = group.items.some(item => isActive(item.path))
      if (hasActiveItem && collapsedSections[group.section]) {
        setCollapsedSections(prev => ({ ...prev, [group.section]: false }))
      }
    }
  }, [currentPath])

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsMobileMenuOpen(false)
  }

  // Section icon map for collapsed view
  const sectionIcons: Record<string, string> = {
    'Main': '🏠', 'Consultations': '🏥', 'Grooming & Spa': '💈', 'Animals & Health': '🐾',
    'Farm Management': '🌾', 'Analytics & Tools': '📈', 'Innovation': '🚀',
    'Intelligence': '🤖', 'Veterinarian': '🩺', 'Administration': '🛡️',
    'Hospital Networks': '🌐', 'Preferences': '⚙️', 'Finance': '💰',
  }

  // Section name translation map
  const sectionNameMap: Record<string, string> = {
    'Main': t('nav.sections.main'),
    'Consultations': t('nav.sections.consultations'),
    'Grooming & Spa': t('nav.sections.groomingSpa'),
    'Animals & Health': t('nav.sections.animalsHealth'),
    'Farm Management': t('nav.sections.farmManagement'),
    'Analytics & Tools': t('nav.sections.analyticsTools'),
    'Innovation': t('nav.sections.innovation'),
    'Intelligence': t('nav.sections.intelligence'),
    'Vet Network': t('nav.sections.vetNetwork'),
    'Account': t('nav.sections.account'),
    'Finance': t('nav.sections.finance'),
    'Administration': t('nav.sections.administration'),
    'Hospital Networks': t('nav.sections.hospitalNetworks'),
    'Preferences': t('nav.sections.preferences'),
  }

  const roleLabel = useMemo(() => {
    switch (user?.role) {
      case 'veterinarian': return t('nav.roles.veterinarian')
      case 'pet_owner': return t('nav.roles.petOwner')
      case 'farmer': return t('nav.roles.farmer')
      case 'admin': return t('nav.roles.admin')
      default: return String(user?.role || '').replace('_', ' ')
    }
  }, [user?.role, t])

  return (
    <>
      {/* Mobile Header */}
      <div className="nav-mobile-header" role="banner">
        <div className="nav-brand">
          <WayToVetLogo size={26} variant="full" onDark title={t('nav.brand')} />
        </div>
        <button
          className="nav-mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="nav-sidebar"
          aria-label={isMobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav
        id="nav-sidebar"
        className={`nav-sidebar ${isMobileMenuOpen ? 'nav-sidebar-open' : ''} ${isCollapsed ? 'nav-sidebar-collapsed' : ''}`}
        aria-label="Main navigation"
      >
        {/* Header with collapse toggle */}
        <div className="nav-header">
          <div className="nav-brand-desktop">
            {isCollapsed
              ? <WayToVetLogo size={30} variant="mark" title={t('nav.brand')} />
              : <WayToVetLogo size={30} variant="full" title={t('nav.brand')} />}
          </div>
          <button
            className="nav-collapse-btn"
            onClick={() => setIsCollapsed(prev => !prev)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          >
            <span className={`nav-collapse-icon ${isCollapsed ? 'rotated' : ''}`}>
              {isCollapsed ? '▶' : '◀'}
            </span>
          </button>
        </div>

        {/* User Info */}
        <div className="nav-user-section" aria-label="User profile" role="region">
          <div className="nav-user-avatar" aria-hidden="true" title={`${user?.firstName} ${user?.lastName}`}>
            {user?.firstName?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="nav-user-info">
              <div className="nav-user-name">{user?.firstName} {user?.lastName}</div>
              <div className="nav-user-role">{roleLabel}</div>
            </div>
          )}
        </div>

        {/* Menu Items - grouped by section */}
        <div className="nav-menu" ref={navMenuRef} role="menubar" aria-label="Navigation menu">
          {groupedMenuItems.map((group) => {
            const isMainSection = group.section === 'Main'
            const isPreferences = group.section === 'Preferences'
            const showHeader = !isMainSection && !isPreferences
            const sectionCollapsed = collapsedSections[group.section] || false
            const hasActiveItem = group.items.some(item => isActive(item.path))

            return (
              <div key={group.section || 'ungrouped'} className={`nav-section ${hasActiveItem ? 'nav-section-has-active' : ''}`}>
                {showHeader && (
                  <button
                    className={`nav-section-header ${sectionCollapsed ? 'section-is-collapsed' : ''}`}
                    onClick={() => toggleSection(group.section)}
                    aria-expanded={!sectionCollapsed}
                    title={isCollapsed ? group.section : undefined}
                  >
                    {isCollapsed ? (
                      <span className="nav-section-icon" aria-hidden="true">{sectionIcons[group.section] || '📁'}</span>
                    ) : (
                      <>
                        <span className="nav-section-title">{sectionNameMap[group.section] || group.section}</span>
                        <span className={`nav-section-chevron ${sectionCollapsed ? 'collapsed' : ''}`} aria-hidden="true">▾</span>
                      </>
                    )}
                  </button>
                )}
                {!sectionCollapsed && (
                  <ul className="nav-section-items" role="group">
                    {group.items.map((item) => (
                      <li key={item.id} className="nav-menu-item" role="none">
                        <button
                          ref={isActive(item.path) ? activeItemRef : undefined}
                          role="menuitem"
                          className={`nav-menu-link ${isActive(item.path) ? 'nav-menu-active' : ''}`}
                          onClick={() => handleMenuClick(item.path)}
                          aria-current={isActive(item.path) ? 'page' : undefined}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <span className="nav-menu-icon" aria-hidden="true">{item.icon}</span>
                          {!isCollapsed && <span className="nav-menu-label">{item.label}</span>}
                          {item.badge && !isCollapsed && (
                            <span className="nav-menu-badge" aria-label={`${item.badge} notifications`}>{item.badge}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom Section */}
        <div className="nav-bottom">
          <LanguageSwitcher collapsed={isCollapsed} />
          <button
            className="nav-logout-btn"
            onClick={handleLogout}
            aria-label={t('nav.logout')}
            title={isCollapsed ? t('nav.logout') : undefined}
          >
            <span className="nav-menu-icon" aria-hidden="true">🚪</span>
            {!isCollapsed && <span className="nav-menu-label">{t('nav.logout')}</span>}
          </button>
        </div>
      </nav>

      {/* Phone bottom tab bar - every role. "More" opens the menu above. */}
      <BottomTabBar
        items={filteredMenuItems}
        currentPath={currentPath}
        onNavigate={handleMenuClick}
        moreOpen={isMobileMenuOpen}
        onMore={() => setIsMobileMenuOpen(open => !open)}
      />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="nav-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={handleOverlayKeyDown}
          role="presentation"
          aria-hidden="true"
        />
      )}
    </>
  )
}
