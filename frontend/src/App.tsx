import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Consultations from './pages/Consultations'
import MedicalRecords from './pages/MedicalRecords'
import Animals from './pages/Animals'
import Settings from './pages/Settings'
// Pet Owner Module
import FindDoctor from './pages/petowner/FindDoctor'
import BookConsultation from './pages/petowner/BookConsultation'
import MyBookings from './pages/petowner/MyBookings'
import VideoConsultation from './pages/petowner/VideoConsultation'
import WriteReview from './pages/petowner/WriteReview'
// Doctor Module
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import ManageSchedule from './pages/doctor/ManageSchedule'
import PatientQueue from './pages/doctor/PatientQueue'
import ConsultationRoom from './pages/doctor/ConsultationRoom'
import PrescriptionWriter from './pages/doctor/PrescriptionWriter'
import Prescriptions from './pages/doctor/Prescriptions'
import MyReviews from './pages/doctor/MyReviews'
// Admin Module
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import ConsultationManagement from './pages/admin/ConsultationManagement'
import PaymentManagement from './pages/admin/PaymentManagement'
import ReviewModeration from './pages/admin/ReviewModeration'
import SystemSettings from './pages/admin/SystemSettings'
import AuditLogs from './pages/admin/AuditLogs'
import './App.css'
import './styles/modules.css'

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

/** Helper: wraps a page that needs onNavigate + route params */
function RoutedPage({ Component, paramKey }: { Component: React.FC<any>, paramKey?: string }) {
  const navigate = useNavigate()
  const params = useParams()
  const props: any = { onNavigate: (path: string) => navigate(path) }
  if (paramKey && params[paramKey]) {
    props[paramKey] = params[paramKey]
  }
  return <Component {...props} />
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
      <Route path="/medical-records" element={<ProtectedRoute><AppLayout><MedicalRecords /></AppLayout></ProtectedRoute>} />
      <Route path="/animals" element={<ProtectedRoute><AppLayout><Animals /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

      {/* ── Pet Owner Module ── */}
      <Route path="/find-doctor" element={<ProtectedRoute><AppLayout><RoutedPage Component={FindDoctor} /></AppLayout></ProtectedRoute>} />
      <Route path="/book-consultation" element={<ProtectedRoute><AppLayout><RoutedPage Component={BookConsultation} /></AppLayout></ProtectedRoute>} />
      <Route path="/my-bookings" element={<ProtectedRoute><AppLayout><RoutedPage Component={MyBookings} /></AppLayout></ProtectedRoute>} />
      <Route path="/video-consultation/:consultationId" element={<ProtectedRoute><AppLayout><RoutedPage Component={VideoConsultation} paramKey="consultationId" /></AppLayout></ProtectedRoute>} />
      <Route path="/write-review" element={<ProtectedRoute><AppLayout><RoutedPage Component={WriteReview} /></AppLayout></ProtectedRoute>} />

      {/* ── Doctor/Vet Module ── */}
      <Route path="/doctor/dashboard" element={<ProtectedRoute><AppLayout><RoutedPage Component={DoctorDashboard} /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/manage-schedule" element={<ProtectedRoute><AppLayout><RoutedPage Component={ManageSchedule} /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/patient-queue" element={<ProtectedRoute><AppLayout><RoutedPage Component={PatientQueue} /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/consultation-room/:consultationId" element={<ProtectedRoute><AppLayout><RoutedPage Component={ConsultationRoom} paramKey="consultationId" /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/prescriptions/new" element={<ProtectedRoute><AppLayout><RoutedPage Component={PrescriptionWriter} /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/prescriptions" element={<ProtectedRoute><AppLayout><RoutedPage Component={Prescriptions} /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/reviews" element={<ProtectedRoute><AppLayout><RoutedPage Component={MyReviews} /></AppLayout></ProtectedRoute>} />

      {/* ── Admin Module ── */}
      <Route path="/admin/dashboard" element={<ProtectedRoute><AppLayout><RoutedPage Component={AdminDashboard} /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AppLayout><RoutedPage Component={UserManagement} /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/consultations" element={<ProtectedRoute><AppLayout><RoutedPage Component={ConsultationManagement} /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/payments" element={<ProtectedRoute><AppLayout><RoutedPage Component={PaymentManagement} /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/reviews" element={<ProtectedRoute><AppLayout><RoutedPage Component={ReviewModeration} /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AppLayout><RoutedPage Component={SystemSettings} /></AppLayout></ProtectedRoute>} />
      <Route path="/admin/audit-logs" element={<ProtectedRoute><AppLayout><RoutedPage Component={AuditLogs} /></AppLayout></ProtectedRoute>} />

      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
