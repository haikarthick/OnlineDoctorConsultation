import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { MenuItem, UserRole } from '../types'
import './Navigation.css'

interface NavigationProps {
  onNavigate: (path: string) => void
  currentPath: string
}

export const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentPath }) => {
  const { user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      path: '/dashboard',
      roles: ['veterinarian', 'pet_owner', 'farmer']
    },
    {
      id: 'consultations',
      label: 'Consultations',
      icon: '🏥',
      path: '/consultations',
      roles: ['veterinarian', 'pet_owner', 'farmer']
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: '📅',
      path: '/appointments',
      roles: ['veterinarian', 'pet_owner', 'farmer']
    },
    {
      id: 'medical',
      label: 'Medical Records',
      icon: '📋',
      path: '/medical-records',
      roles: ['veterinarian', 'pet_owner']
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: '👥',
      path: '/patients',
      roles: ['veterinarian']
    },
    {
      id: 'animals',
      label: 'My Animals',
      icon: '🐾',
      path: '/animals',
      roles: ['pet_owner', 'farmer']
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '📈',
      path: '/reports',
      roles: ['veterinarian', 'farmer']
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      path: '/settings',
      roles: ['veterinarian', 'pet_owner', 'farmer']
    }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role as UserRole)
  )

  const handleLogout = () => {
    logout()
    onNavigate('/login')
    setIsMobileMenuOpen(false)
  }

  const handleMenuClick = (path: string) => {
    onNavigate(path)
    setIsMobileMenuOpen(false)
  }

  const isActive = (path: string) => currentPath === path

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
