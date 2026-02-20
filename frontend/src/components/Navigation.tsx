import React, { useState } from 'react'
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
      roles: ['veterinarian', 'pet_owner', 'farmer', 'admin']
    },
    {
      id: 'consultations',
      label: 'Consultations',
      icon: '🏥',
      path: '/consultations',
      roles: ['veterinarian', 'pet_owner', 'farmer']
    },
    // ── Pet Owner Module ──
    {
      id: 'find-doctor',
      label: 'Find Doctor',
      icon: '🔍',
      path: '/find-doctor',
      roles: ['pet_owner', 'farmer']
    },
    {
      id: 'book-consultation',
      label: 'Book Consultation',
      icon: '📝',
      path: '/book-consultation',
      roles: ['pet_owner', 'farmer']
    },
    {
      id: 'animals',
      label: 'My Animals',
      icon: '🐾',
      path: '/animals',
      roles: ['pet_owner', 'farmer']
    },
    {
      id: 'medical',
      label: 'Medical Records',
      icon: '📋',
      path: '/medical-records',
      roles: ['veterinarian', 'pet_owner']
    },

    // ── Enterprise Module ──
    {
      id: 'enterprises',
      label: 'Enterprises',
      icon: '🏢',
      path: '/enterprises',
      roles: ['farmer', 'admin', 'pet_owner']
    },
    {
      id: 'animal-groups',
      label: 'Animal Groups',
      icon: '🐄',
      path: '/animal-groups',
      roles: ['farmer', 'admin']
    },
    {
      id: 'locations',
      label: 'Locations',
      icon: '📍',
      path: '/locations',
      roles: ['farmer', 'admin']
    },
    {
      id: 'movement-log',
      label: 'Movement Log',
      icon: '🔄',
      path: '/movement-log',
      roles: ['farmer', 'admin']
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: '💉',
      path: '/campaigns',
      roles: ['farmer', 'admin', 'veterinarian']
    },

    // ── Advanced Modules ──
    {
      id: 'health-analytics',
      label: 'Health Analytics',
      icon: '🏥',
      path: '/health-analytics',
      roles: ['farmer', 'admin', 'veterinarian']
    },
    {
      id: 'breeding',
      label: 'Breeding & Genetics',
      icon: '🧬',
      path: '/breeding',
      roles: ['farmer', 'admin']
    },
    {
      id: 'feed-inventory',
      label: 'Feed & Inventory',
      icon: '🌾',
      path: '/feed-inventory',
      roles: ['farmer', 'admin']
    },
    {
      id: 'compliance',
      label: 'Compliance Docs',
      icon: '📜',
      path: '/compliance',
      roles: ['farmer', 'admin']
    },
    {
      id: 'financial',
      label: 'Financial Analytics',
      icon: '💰',
      path: '/financial',
      roles: ['farmer', 'admin']
    },
    {
      id: 'alerts',
      label: 'Smart Alerts',
      icon: '🔔',
      path: '/alerts',
      roles: ['farmer', 'admin', 'veterinarian']
    },

    // ── Innovation Modules ──
    {
      id: 'disease-prediction',
      label: 'Disease AI',
      icon: '🧠',
      path: '/disease-prediction',
      roles: ['farmer', 'admin', 'veterinarian']
    },
    {
      id: 'genomic-lineage',
      label: 'Genomic Lineage',
      icon: '🧬',
      path: '/genomic-lineage',
      roles: ['farmer', 'admin']
    },
    {
      id: 'iot-sensors',
      label: 'IoT Sensors',
      icon: '📡',
      path: '/iot-sensors',
      roles: ['farmer', 'admin']
    },
    {
      id: 'supply-chain',
      label: 'Supply Chain',
      icon: '🔗',
      path: '/supply-chain',
      roles: ['farmer', 'admin']
    },
    {
      id: 'workforce',
      label: 'Workforce',
      icon: '👷',
      path: '/workforce',
      roles: ['farmer', 'admin']
    },
    {
      id: 'report-builder',
      label: 'Report Builder',
      icon: '📊',
      path: '/report-builder',
      roles: ['farmer', 'admin', 'veterinarian']
    },

    // ── Intelligence Modules ──
    {
      id: 'ai-copilot',
      label: 'AI Copilot',
      icon: '🤖',
      path: '/ai-copilot',
      roles: ['veterinarian', 'farmer', 'admin', 'pet_owner']
    },
    {
      id: 'digital-twin',
      label: 'Digital Twin',
      icon: '🔮',
      path: '/digital-twin',
      roles: ['farmer', 'admin']
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: '🏪',
      path: '/marketplace',
      roles: ['farmer', 'admin', 'pet_owner', 'veterinarian']
    },
    {
      id: 'sustainability',
      label: 'Sustainability',
      icon: '🌱',
      path: '/sustainability',
      roles: ['farmer', 'admin']
    },
    {
      id: 'wellness',
      label: 'Wellness Portal',
      icon: '💚',
      path: '/wellness',
      roles: ['pet_owner', 'farmer', 'admin', 'veterinarian']
    },
    {
      id: 'geospatial',
      label: 'Geospatial',
      icon: '🗺️',
      path: '/geospatial',
      roles: ['farmer', 'admin']
    },

    // ── Doctor/Vet Module ──
    {
      id: 'manage-schedule',
      label: 'My Schedule',
      icon: '🗓️',
      path: '/doctor/manage-schedule',
      roles: ['veterinarian']
    },
    {
      id: 'prescriptions',
      label: 'Prescriptions',
      icon: '💊',
      path: '/doctor/prescriptions',
      roles: ['veterinarian']
    },
    {
      id: 'my-reviews',
      label: 'My Reviews',
      icon: '⭐',
      path: '/doctor/reviews',
      roles: ['veterinarian']
    },

    // ── Admin Module ──
    {
      id: 'admin-dashboard',
      label: 'Admin Panel',
      icon: '🛡️',
      path: '/admin/dashboard',
      roles: ['admin']
    },
    {
      id: 'admin-users',
      label: 'User Management',
      icon: '👥',
      path: '/admin/users',
      roles: ['admin']
    },
    {
      id: 'admin-consultations',
      label: 'Consultations',
      icon: '🩺',
      path: '/admin/consultations',
      roles: ['admin']
    },
    {
      id: 'admin-payments',
      label: 'Payments',
      icon: '💳',
      path: '/admin/payments',
      roles: ['admin']
    },
    {
      id: 'admin-reviews',
      label: 'Review Moderation',
      icon: '⚖️',
      path: '/admin/reviews',
      roles: ['admin']
    },
    {
      id: 'admin-settings',
      label: 'System Settings',
      icon: '⚙️',
      path: '/admin/settings',
      roles: ['admin']
    },
    {
      id: 'admin-permissions',
      label: 'Permissions',
      icon: '🔐',
      path: '/admin/permissions',
      roles: ['admin']
    },
    {
      id: 'admin-medical-records',
      label: 'Medical Records',
      icon: '📋',
      path: '/admin/medical-records',
      roles: ['admin']
    },
    {
      id: 'admin-audit',
      label: 'Audit Logs',
      icon: '📜',
      path: '/admin/audit-logs',
      roles: ['admin']
    },

    // ── Common Bottom ──
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      path: '/settings',
      roles: ['veterinarian', 'pet_owner', 'farmer']
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

        {/* Menu Items */}
        <ul className="nav-menu" role="menubar" aria-label="Navigation menu">
          {filteredMenuItems.map((item) => (
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
