import React, { ReactNode, useState, useEffect } from 'react'
import { Navigation } from './Navigation'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
  currentPath: string
  onNavigate: (path: string) => void
}

const SIDEBAR_COLLAPSED_KEY = 'vetcare_sidebar_collapsed'

export const Layout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.collapsed === 'boolean') {
        setSidebarCollapsed(detail.collapsed)
      }
    }
    window.addEventListener('sidebar-toggle', handler)
    return () => window.removeEventListener('sidebar-toggle', handler)
  }, [])

  return (
    <div className={`layout-container ${sidebarCollapsed ? 'layout-sidebar-collapsed' : ''}`}>
      {/* Skip navigation link for keyboard users */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <Navigation currentPath={currentPath} onNavigate={onNavigate} />
      <main className="layout-main" id="main-content" role="main" aria-label="Main content">
        {children}
      </main>
    </div>
  )
}
