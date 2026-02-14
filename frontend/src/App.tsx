import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Consultations from './pages/Consultations'
import Appointments from './pages/Appointments'
import MedicalRecords from './pages/MedicalRecords'
import Animals from './pages/Animals'
import Settings from './pages/Settings'
import './App.css'

/** Wrapper: redirects unauthenticated users to /login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Wrapper: redirects authenticated users to /dashboard */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Layout wrapper that injects react-router navigation */
function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <Layout currentPath={location.pathname} onNavigate={handleNavigate}>
      <div className="layout-content">
        {children}
      </div>
    </Layout>
  )
}

function AppRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={
        <PublicOnlyRoute>
          <Home onGetStarted={() => navigate('/register')} onViewForDoctors={() => navigate('/register')} />
        </PublicOnlyRoute>
      } />
      <Route path="/login" element={
        <PublicOnlyRoute>
          <Login onSwitchToRegister={() => navigate('/register')} />
        </PublicOnlyRoute>
      } />
      <Route path="/register" element={
        <PublicOnlyRoute>
          <Register onSwitchToLogin={() => navigate('/login')} />
        </PublicOnlyRoute>
      } />

      {/* Protected pages (inside AppLayout) */}
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/consultations" element={<ProtectedRoute><AppLayout><Consultations /></AppLayout></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute><AppLayout><Appointments /></AppLayout></ProtectedRoute>} />
      <Route path="/medical-records" element={<ProtectedRoute><AppLayout><MedicalRecords /></AppLayout></ProtectedRoute>} />
      <Route path="/animals" element={<ProtectedRoute><AppLayout><Animals /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
