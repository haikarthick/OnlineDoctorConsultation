import React, { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePermission, NAV_PERMISSION_MAP } from '../context/PermissionContext'
import { MenuItem, UserRole } from '../types'
import './Navigation.css'

interface NavigationProps {
  onNavigate: (path: string) => void
  currentPath: string
}

export const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentPath }) => {
  const { user, logout } = useAuth()
  const { hasPermission } = usePermission()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const menuItems: MenuItem[] = [
    // ── Common ──
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      path: '/dashboard',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'],
      section: 'Main'
    },
    {
      id: 'consultations',
      label: 'Consultations',
      icon: '🏥',
      path: '/consultations',
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin'],
      section: 'Main'
    },
    // ── Pet Owner Module ──
    {
      id: 'find-doctor',
      label: 'Find Doctor',
      icon: '🔍',
      path: '/find-doctor',
      roles: ['pet_owner', 'farmer'],
      section: 'Main'
    },
    {
      id: 'book-consultation',
      label: 'Book Consultation',
      icon: '📝',
      path: '/book-consultation',
      roles: ['pet_owner', 'farmer'],
      section: 'Main'
    },
    {
      id: 'animals',
      label: 'My Animals',
      icon: '🐾',
      path: '/animals',
      roles: ['pet_owner', 'farmer'],
      section: 'Main'
    },
    {
      id: 'medical',
      label: 'Medical Records',
      icon: '📋',
      path: '/medical-records',
      roles: ['veterinarian', 'pet_owner', 'farmer'],
      section: 'Main'
    },
    {
      id: 'write-review',
      label: 'Write Review',
      icon: '✍️',
      path: '/write-review',
      roles: ['pet_owner', 'farmer'],
      section: 'Main'
    },

    // ── Enterprise Module ──
    {
      id: 'enterprises',
      label: 'Farm / Enterprise',
      icon: '🏢',
      path: '/enterprises',
      roles: ['farmer', 'admin', 'pet_owner'],
      section: 'Farm Management'
    },
    {
      id: 'animal-groups',
      label: 'Herds & Groups',
      icon: '🐄',
      path: '/animal-groups',
      roles: ['farmer', 'admin'],
      section: 'Farm Management'
    },
    {
      id: 'locations',
      label: 'Locations',
      icon: '📍',
      path: '/locations',
      roles: ['farmer', 'admin'],
      section: 'Farm Management'
    },
    {
      id: 'movement-log',
      label: 'Movement Log',
      icon: '🔄',
      path: '/movement-log',
      roles: ['farmer', 'admin'],
      section: 'Farm Management'
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: '💉',
      path: '/campaigns',
      roles: ['farmer', 'admin', 'veterinarian'],
      section: 'Farm Management'
    },

    // ── Advanced Modules ──
    {
      id: 'health-analytics',
      label: 'Health Analytics',
      icon: '🏥',
      path: '/health-analytics',
      roles: ['farmer', 'admin', 'veterinarian'],
      section: 'Analytics & Tools'
    },
    {
      id: 'breeding',
      label: 'Breeding & Genetics',
      icon: '🧬',
      path: '/breeding',
      roles: ['farmer', 'admin'],
      section: 'Analytics & Tools'
    },
    {
      id: 'feed-inventory',
      label: 'Feed & Inventory',
      icon: '🌾',
      path: '/feed-inventory',
      roles: ['farmer', 'admin'],
      section: 'Analytics & Tools'
    },
    {
      id: 'compliance',
      label: 'Compliance Docs',
      icon: '📜',
      path: '/compliance',
      roles: ['farmer', 'admin'],
      section: 'Analytics & Tools'
    },
    {
      id: 'financial',
      label: 'Financial Analytics',
      icon: '💰',
      path: '/financial',
      roles: ['farmer', 'admin'],
      section: 'Analytics & Tools'
    },
    {
      id: 'alerts',
      label: 'Smart Alerts',
      icon: '🔔',
      path: '/alerts',
      roles: ['farmer', 'admin', 'veterinarian'],
      section: 'Analytics & Tools'
    },

    // ── Innovation Modules ──
    {
      id: 'disease-prediction',
      label: 'Disease AI',
      icon: '🧠',
      path: '/disease-prediction',
      roles: ['farmer', 'admin', 'veterinarian'],
      section: 'Innovation'
    },
    {
      id: 'genomic-lineage',
      label: 'Genomic Lineage',
      icon: '🧬',
      path: '/genomic-lineage',
      roles: ['farmer', 'admin'],
      section: 'Innovation'
    },
    {
      id: 'iot-sensors',
      label: 'IoT Sensors',
      icon: '📡',
      path: '/iot-sensors',
      roles: ['farmer', 'admin'],
      section: 'Innovation'
    },
    {
      id: 'supply-chain',
      label: 'Supply Chain',
      icon: '🔗',
      path: '/supply-chain',
      roles: ['farmer', 'admin'],
      section: 'Innovation'
    },
    {
      id: 'workforce',
      label: 'Workforce',
      icon: '👷',
      path: '/workforce',
      roles: ['farmer', 'admin'],
      section: 'Innovation'
    },
    {
      id: 'report-builder',
      label: 'Report Builder',
      icon: '📊',
      path: '/report-builder',
      roles: ['farmer', 'admin', 'veterinarian'],
      section: 'Innovation'
    },

    // ── Intelligence Modules ──
    {
      id: 'ai-copilot',
      label: 'AI Copilot',
      icon: '🤖',
      path: '/ai-copilot',
      roles: ['veterinarian', 'farmer', 'admin', 'pet_owner'],
      section: 'Intelligence'
    },
    {
      id: 'digital-twin',
      label: 'Digital Twin',
      icon: '🔮',
      path: '/digital-twin',
      roles: ['farmer', 'admin'],
      section: 'Intelligence'
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: '🏪',
      path: '/marketplace',
      roles: ['farmer', 'admin', 'pet_owner', 'veterinarian'],
      section: 'Intelligence'
    },
    {
      id: 'sustainability',
      label: 'Sustainability',
      icon: '🌱',
      path: '/sustainability',
      roles: ['farmer', 'admin'],
      section: 'Intelligence'
    },
    {
      id: 'wellness',
      label: 'Wellness Portal',
      icon: '💚',
      path: '/wellness',
      roles: ['pet_owner', 'farmer', 'admin', 'veterinarian'],
      section: 'Intelligence'
    },
    {
      id: 'geospatial',
      label: 'Geospatial',
      icon: '🗺️',
      path: '/geospatial',
      roles: ['farmer', 'admin'],
      section: 'Intelligence'
    },

    // ── Doctor/Vet Module ──
    {
      id: 'manage-schedule',
      label: 'My Schedule',
      icon: '🗓️',
      path: '/doctor/manage-schedule',
      roles: ['veterinarian'],
      section: 'Veterinarian'
    },
    {
      id: 'prescriptions',
      label: 'Prescriptions',
      icon: '💊',
      path: '/doctor/prescriptions',
      roles: ['veterinarian'],
      section: 'Veterinarian'
    },
    {
      id: 'my-reviews',
      label: 'My Reviews',
      icon: '⭐',
      path: '/doctor/reviews',
      roles: ['veterinarian'],
      section: 'Veterinarian'
    },

    // ── Admin Module ──
    {
      id: 'admin-dashboard',
      label: 'Admin Panel',
      icon: '🛡️',
      path: '/admin/dashboard',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-users',
      label: 'User Management',
      icon: '👥',
      path: '/admin/users',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-consultations',
      label: 'Consultations',
      icon: '🩺',
      path: '/admin/consultations',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-payments',
      label: 'Payments',
      icon: '💳',
      path: '/admin/payments',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-reviews',
      label: 'Review Moderation',
      icon: '⚖️',
      path: '/admin/reviews',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-settings',
      label: 'System Settings',
      icon: '⚙️',
      path: '/admin/settings',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-permissions',
      label: 'Permissions',
      icon: '🔐',
      path: '/admin/permissions',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-medical-records',
      label: 'Medical Records',
      icon: '📋',
      path: '/admin/medical-records',
      roles: ['admin'],
      section: 'Administration'
    },
    {
      id: 'admin-audit',
      label: 'Audit Logs',
      icon: '📜',
      path: '/admin/audit-logs',
      roles: ['admin'],
      section: 'Administration'
    },

    // ── Common Bottom ──
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      path: '/settings',
      roles: ['veterinarian', 'pet_owner', 'farmer'],
      section: 'Preferences'
    }
  ]

  // Filter by role AND permission
  const filteredMenuItems = menuItems.filter(item => {
    // Must have the role
    if (!item.roles.includes(user?.role as UserRole)) return false
    // Must have the permission (if mapping exists)
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

  // Track collapsed sections (default: all expanded)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

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

  /** Close mobile menu on Escape key */
  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setIsMobileMenuOpen(false)
  }

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
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav
        id="nav-sidebar"
        className={`nav-sidebar ${isMobileMenuOpen ? 'nav-sidebar-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="nav-header">
          <div className="nav-brand-desktop">
            <span className="nav-logo" aria-hidden="true">🏥</span>
            <span className="nav-title">VetCare</span>
          </div>
        </div>

        {/* User Info */}
        <div className="nav-user-section" aria-label="User profile" role="region">
          <div className="nav-user-avatar" aria-hidden="true">
            {user?.firstName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="nav-user-info">
            <div className="nav-user-name">{user?.firstName} {user?.lastName}</div>
            <div className="nav-user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Menu Items — grouped by section */}
        <div className="nav-menu" role="menubar" aria-label="Navigation menu">
          {groupedMenuItems.map((group) => {
            const showHeader = group.section && group.section !== 'Main' && group.section !== 'Preferences'
            const isCollapsed = collapsedSections[group.section] || false
            return (
              <div key={group.section || 'ungrouped'} className="nav-section">
                {showHeader && (
                  <button
                    className="nav-section-header"
                    onClick={() => toggleSection(group.section)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="nav-section-title">{group.section}</span>
                    <span className={`nav-section-chevron ${isCollapsed ? 'collapsed' : ''}`} aria-hidden="true">▾</span>
                  </button>
                )}
                {!isCollapsed && (
                  <ul className="nav-section-items" role="group">
                    {group.items.map((item) => (
                      <li key={item.id} className="nav-menu-item" role="none">
                        <button
                          role="menuitem"
                          className={`nav-menu-link ${isActive(item.path) ? 'nav-menu-active' : ''}`}
                          onClick={() => handleMenuClick(item.path)}
                          aria-current={isActive(item.path) ? 'page' : undefined}
                        >
                          <span className="nav-menu-icon" aria-hidden="true">{item.icon}</span>
                          <span className="nav-menu-label">{item.label}</span>
                          {item.badge && <span className="nav-menu-badge" aria-label={`${item.badge} notifications`}>{item.badge}</span>}
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
          <button 
            className="nav-logout-btn"
            onClick={handleLogout}
            aria-label="Log out of your account"
          >
            <span className="nav-menu-icon" aria-hidden="true">🚪</span>
            <span className="nav-menu-label">Logout</span>
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
