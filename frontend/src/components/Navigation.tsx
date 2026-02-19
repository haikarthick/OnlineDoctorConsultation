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

  return (
    <>
      {/* Mobile Header */}
      <div className="nav-mobile-header">
        <div className="nav-brand">
          <span className="nav-logo">🏥</span>
          <span className="nav-title">VetCare</span>
        </div>
        <button 
          className="nav-mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav className={`nav-sidebar ${isMobileMenuOpen ? 'nav-sidebar-open' : ''}`}>
        <div className="nav-header">
          <div className="nav-brand-desktop">
            <span className="nav-logo">🏥</span>
            <span className="nav-title">VetCare</span>
          </div>
        </div>

        {/* User Info */}
        <div className="nav-user-section">
          <div className="nav-user-avatar">
            {user?.firstName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="nav-user-info">
            <div className="nav-user-name">{user?.firstName} {user?.lastName}</div>
            <div className="nav-user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Menu Items */}
        <ul className="nav-menu">
          {filteredMenuItems.map((item) => (
            <li key={item.id} className="nav-menu-item">
              <button
                className={`nav-menu-link ${isActive(item.path) ? 'nav-menu-active' : ''}`}
                onClick={() => handleMenuClick(item.path)}
              >
                <span className="nav-menu-icon">{item.icon}</span>
                <span className="nav-menu-label">{item.label}</span>
                {item.badge && <span className="nav-menu-badge">{item.badge}</span>}
              </button>
            </li>
          ))}
        </ul>

        {/* Bottom Section */}
        <div className="nav-bottom">
          <button 
            className="nav-logout-btn"
            onClick={handleLogout}
          >
            <span className="nav-menu-icon">🚪</span>
            <span className="nav-menu-label">Logout</span>
          </button>
        </div>
      </nav>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="nav-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
