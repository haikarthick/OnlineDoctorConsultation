import React, { ReactNode } from 'react'
import { Navigation } from './Navigation'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
  currentPath: string
  onNavigate: (path: string) => void
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  return (
    <div className="layout-container">
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
