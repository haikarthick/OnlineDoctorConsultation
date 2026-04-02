import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { usePermission, NAV_PERMISSION_MAP } from '../context/PermissionContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MenuItem, UserRole } from '../types'
import './Navigation.css'

interface NavigationProps {
  onNavigate: (path: string) => void
  currentPath: string
}

const SIDEBAR_COLLAPSED_KEY = 'vetcare_sidebar_collapsed'

export const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentPath }) => {
  const { user, logout } = useAuth()
  const { hasPermission } = usePermission()
  const { t } = useTranslation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true' } catch { return false }
  })

  const isPetOwner = user?.role === 'pet_owner'

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

  /* ════════════════════════════════════════════════════════
   * MENU DEFINITIONS — properly grouped by module/section
   * ════════════════════════════════════════════════════════ */
  const menuItems: MenuItem[] = [
    // ── Dashboard (always first, ungrouped) ──
    { id: 'dashboard', label: t('nav.dashboard'), icon: '📊', path: '/dashboard',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Main' },
    { id: 'marketplace', label: t('nav.marketplace'), icon: '🏪', path: '/marketplace',
      roles: ['farmer', 'admin', 'pet_owner', 'veterinarian'], section: 'Main' },

    // ── Consultation & Booking ──
    { id: 'consultations', label: t('nav.myConsultations'), icon: '🏥', path: '/consultations',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'], section: 'Consultations' },
    { id: 'find-doctor', label: t('nav.findDoctor'), icon: '🔍', path: '/find-doctor',
      roles: ['pet_owner', 'farmer'], section: 'Consultations' },
    { id: 'book-consultation', label: t('nav.bookConsultation'), icon: '📝', path: '/book-consultation',
      roles: ['pet_owner', 'farmer'], section: 'Consultations' },
    { id: 'manage-schedule', label: t('nav.mySchedule'), icon: '🗓️', path: '/doctor/manage-schedule',
      roles: ['veterinarian'], section: 'Consultations' },
    { id: 'prescriptions', label: t('nav.prescriptions'), icon: '💊', path: '/doctor/prescriptions',
      roles: ['veterinarian'], section: 'Consultations' },
    { id: 'prescriptions', label: t('nav.myPrescriptions'), icon: '💊', path: '/prescriptions',
      roles: ['pet_owner', 'farmer'], section: 'Consultations' },

    // ── Animals & Health ──
    { id: 'animals', label: t(isPetOwner ? 'nav.myPets' : (user?.role === 'veterinarian' ? 'nav.myPets' : 'nav.myAnimals')),
      icon: (isPetOwner || user?.role === 'veterinarian') ? '🐾' : '🐄', path: '/animals',
      roles: ['pet_owner', 'farmer', 'veterinarian'], section: 'Animals & Health' },
    { id: 'medical', label: t('nav.medicalRecords'), icon: '📋', path: '/medical-records',
      roles: ['veterinarian', 'pet_owner', 'farmer'], section: 'Animals & Health' },
    { id: 'animal-timeline', label: t('nav.animalTimeline'), icon: '📅', path: '/animal-timeline',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Animals & Health' },
    { id: 'vaccination-passport', label: t('nav.vaccinationPassport'), icon: '💉', path: '/vaccination-passport',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Animals & Health' },
    { id: 'write-review', label: t('nav.writeReview'), icon: '✍️', path: '/write-review',
      roles: ['pet_owner', 'farmer'], section: 'Animals & Health' },
    { id: 'my-reviews', label: t('nav.myReviews'), icon: '⭐', path: '/doctor/reviews',
      roles: ['veterinarian'], section: 'Animals & Health' },

    // ── Farm / Enterprise Module ──
    { id: 'enterprises', label: t('nav.farmEnterprise'), icon: '🏢', path: '/enterprises',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'animal-groups', label: t('nav.herdsGroups'), icon: '🐄', path: '/animal-groups',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'herd-medical', label: t('nav.herdMedical'), icon: '💊', path: '/herd-medical',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Farm Management' },
    { id: 'locations', label: t('nav.locations'), icon: '📍', path: '/locations',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'movement-log', label: t('nav.movementLog'), icon: '🔄', path: '/movement-log',
      roles: ['farmer', 'admin'], section: 'Farm Management' },
    { id: 'campaigns', label: t('nav.campaigns'), icon: '💉', path: '/campaigns',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Farm Management' },

    // ── Analytics & Tools ──
    { id: 'health-analytics', label: t('nav.healthAnalytics'), icon: '📈', path: '/health-analytics',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Analytics & Tools' },
    { id: 'breeding', label: t('nav.breedingGenetics'), icon: '🧬', path: '/breeding',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'feed-inventory', label: t('nav.feedInventory'), icon: '🌾', path: '/feed-inventory',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'compliance', label: t('nav.complianceDocs'), icon: '📜', path: '/compliance',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'financial', label: t('nav.financialAnalytics'), icon: '💰', path: '/financial',
      roles: ['farmer', 'admin'], section: 'Analytics & Tools' },
    { id: 'alerts', label: t('nav.smartAlerts'), icon: '🔔', path: '/alerts',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Analytics & Tools' },

    // ── Innovation Modules ──
    { id: 'disease-prediction', label: t('nav.diseaseAI'), icon: '🧠', path: '/disease-prediction',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Innovation' },
    { id: 'genomic-lineage', label: t('nav.genomicLineage'), icon: '🧬', path: '/genomic-lineage',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'iot-sensors', label: t('nav.iotSensors'), icon: '📡', path: '/iot-sensors',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'supply-chain', label: t('nav.supplyChain'), icon: '🔗', path: '/supply-chain',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'workforce', label: t('nav.workforce'), icon: '👷', path: '/workforce',
      roles: ['farmer', 'admin'], section: 'Innovation' },
    { id: 'report-builder', label: t('nav.reportBuilder'), icon: '📊', path: '/report-builder',
      roles: ['farmer', 'admin', 'veterinarian'], section: 'Innovation' },

    // ── Intelligence Modules ──
    { id: 'ai-copilot', label: t('nav.aiCopilot'), icon: '🤖', path: '/ai-copilot',
      roles: ['veterinarian', 'farmer', 'admin', 'pet_owner'], section: 'Intelligence' },
    { id: 'digital-twin', label: t('nav.digitalTwin'), icon: '🔮', path: '/digital-twin',
      roles: ['farmer', 'admin'], section: 'Intelligence' },
    { id: 'sustainability', label: t('nav.sustainability'), icon: '🌱', path: '/sustainability',
      roles: ['farmer', 'admin'], section: 'Intelligence' },
    { id: 'wellness', label: t('nav.wellnessPortal'), icon: '💚', path: '/wellness',
      roles: ['pet_owner', 'farmer', 'admin', 'veterinarian'], section: 'Intelligence' },
    { id: 'geospatial', label: t('nav.geospatial'), icon: '🗺️', path: '/geospatial',
      roles: ['farmer', 'admin'], section: 'Intelligence' },

    // ── Vet Hospital Network ──
    { id: 'vet-hospitals', label: t('nav.vetHospitals'), icon: '🏥', path: '/vet-hospitals',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Vet Network' },
    { id: 'vet-hospitals-manage', label: t('nav.myHospital'), icon: '🏨', path: '/vet-hospitals/manage',
      roles: ['veterinarian'], section: 'Vet Network' },
    { id: 'hospital-workflow', label: 'Hospital Workflow', icon: '🔄', path: '/hospital-workflow',
      roles: ['veterinarian', 'admin'], section: 'Vet Network' },
    { id: 'inpatient', label: 'Inpatient & Boarding', icon: '🛏️', path: '/inpatient',
      roles: ['veterinarian', 'admin'], section: 'Vet Network' },

    // ── Wallet ──
    { id: 'wallet', label: t('nav.myWallet'), icon: '💰', path: '/wallet',
      roles: ['pet_owner', 'farmer', 'veterinarian', 'admin'], section: 'Account' },

    // ── Administration (admin only) ──
    { id: 'admin-dashboard', label: t('nav.adminPanel'), icon: '🛡️', path: '/admin/dashboard',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-users', label: t('nav.userManagement'), icon: '👥', path: '/admin/users',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-consultations', label: t('nav.consultations'), icon: '🩺', path: '/admin/consultations',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-payments', label: t('nav.payments'), icon: '💳', path: '/admin/payments',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-reviews', label: t('nav.reviewModeration'), icon: '⚖️', path: '/admin/reviews',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-settings', label: t('nav.systemSettings'), icon: '⚙️', path: '/admin/settings',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-permissions', label: t('nav.permissions'), icon: '🔐', path: '/admin/permissions',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-medical-records', label: t('nav.medicalRecords'), icon: '📋', path: '/admin/medical-records',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-hospitals', label: t('nav.hospitalMgmt'), icon: '🏥', path: '/admin/vet-hospitals',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-audit', label: t('nav.auditLogs'), icon: '📜', path: '/admin/audit-logs',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-compliance', label: 'HIPAA Compliance', icon: '🛡️', path: '/admin/compliance',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-staff-settings', label: 'Staff & Positions', icon: '👥', path: '/admin/staff-settings',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-cancellation-dashboard', label: t('nav.cancellations'), icon: '📊', path: '/admin/cancellation-dashboard',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-vaccine-protocols', label: t('nav.vaccineProtocols'), icon: '🧬', path: '/admin/vaccine-protocols',
      roles: ['admin'], section: 'Administration' },
    { id: 'admin-holidays', label: 'Holiday Management', icon: '🎉', path: '/admin/holidays',
      roles: ['admin', 'veterinarian'], section: 'Administration' },

    // ── Preferences (bottom) ──
    { id: 'settings', label: t('nav.settings'), icon: '⚙️', path: '/settings',
      roles: ['veterinarian', 'pet_owner', 'farmer'], section: 'Preferences' }
  ]

  // Filter by role AND permission
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles.includes(user?.role as UserRole)) return false
    const permKey = NAV_PERMISSION_MAP[item.id]
    if (permKey && !hasPermission(permKey)) return false
    return true
  })

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

  // Track collapsed sections — start with advanced sections collapsed
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
    'Main': '🏠', 'Consultations': '🏥', 'Animals & Health': '🐾',
    'Farm Management': '🌾', 'Analytics & Tools': '📈', 'Innovation': '🚀',
    'Intelligence': '🤖', 'Veterinarian': '🩺', 'Administration': '🛡️', 'Preferences': '⚙️',
  }

  // Section name translation map
  const sectionNameMap: Record<string, string> = {
    'Main': t('nav.sections.main'),
    'Consultations': t('nav.sections.consultations'),
    'Animals & Health': t('nav.sections.animalsHealth'),
    'Farm Management': t('nav.sections.farmManagement'),
    'Analytics & Tools': t('nav.sections.analyticsTools'),
    'Innovation': t('nav.sections.innovation'),
    'Intelligence': t('nav.sections.intelligence'),
    'Vet Network': t('nav.sections.vetNetwork'),
    'Account': t('nav.sections.account'),
    'Administration': t('nav.sections.administration'),
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
          <span className="nav-logo" aria-hidden="true">🏥</span>
          <span className="nav-title">VetCare</span>
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
            <span className="nav-logo" aria-hidden="true">🏥</span>
            {!isCollapsed && <span className="nav-title">VetCare</span>}
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

        {/* Menu Items — grouped by section */}
        <div className="nav-menu" role="menubar" aria-label="Navigation menu">
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
