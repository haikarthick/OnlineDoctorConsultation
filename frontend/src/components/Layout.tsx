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
      <Navigation currentPath={currentPath} onNavigate={onNavigate} />
      <main className="layout-main">
        {children}
      </main>
    </div>
  )
}
