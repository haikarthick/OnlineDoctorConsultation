import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { PermissionProvider, usePermission, ROUTE_PERMISSION_MAP } from './context/PermissionContext'
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
import VideoConsultation from './pages/petowner/VideoConsultation'
import WriteReview from './pages/petowner/WriteReview'
// Doctor Module
import ManageSchedule from './pages/doctor/ManageSchedule'
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
import PermissionManagement from './pages/admin/PermissionManagement'
import MedicalRecordManagement from './pages/admin/MedicalRecordManagement'
// Enterprise Module
import EnterpriseManagement from './pages/EnterpriseManagement'
import AnimalGroups from './pages/AnimalGroups'
import LocationManagement from './pages/LocationManagement'
import MovementLog from './pages/MovementLog'
import TreatmentCampaigns from './pages/TreatmentCampaigns'
// Tier-2 Advanced Modules
import HealthAnalytics from './pages/HealthAnalytics'
import BreedingManager from './pages/BreedingManager'
import FeedInventory from './pages/FeedInventory'
import ComplianceDocs from './pages/ComplianceDocs'
import FinancialAnalytics from './pages/FinancialAnalytics'
import AlertCenter from './pages/AlertCenter'
import './App.css'
import './styles/modules.css'

/** Wrapper: redirects unauthenticated users to /login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Wrapper: enforces RBAC permission on a route. Redirects to /dashboard if no access */
function RoleRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { isAuthenticated } = useAuth()
  const { hasPermission, loading } = usePermission()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><p>Loading...</p></div>
  const requiredPermission = ROUTE_PERMISSION_MAP[path]
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />
  }
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
          <Home onGetStarted={() => navigate('/register')} onViewForDoctors={() => navigate('/register')} onLogin={() => navigate('/login')} />
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
      <Route path="/consultations" element={<RoleRoute path="/consultations"><AppLayout><Consultations /></AppLayout></RoleRoute>} />
      <Route path="/medical-records" element={<RoleRoute path="/medical-records"><AppLayout><MedicalRecords /></AppLayout></RoleRoute>} />
      <Route path="/animals" element={<RoleRoute path="/animals"><AppLayout><Animals /></AppLayout></RoleRoute>} />
      <Route path="/settings" element={<RoleRoute path="/settings"><AppLayout><Settings /></AppLayout></RoleRoute>} />

      {/* ── Pet Owner Module ── */}
      <Route path="/find-doctor" element={<RoleRoute path="/find-doctor"><AppLayout><RoutedPage Component={FindDoctor} /></AppLayout></RoleRoute>} />
      <Route path="/book-consultation" element={<RoleRoute path="/book-consultation"><AppLayout><RoutedPage Component={BookConsultation} /></AppLayout></RoleRoute>} />
      <Route path="/my-bookings" element={<Navigate to="/consultations" replace />} />
      <Route path="/video-consultation/:consultationId" element={<ProtectedRoute><AppLayout><RoutedPage Component={VideoConsultation} paramKey="consultationId" /></AppLayout></ProtectedRoute>} />
      <Route path="/write-review" element={<RoleRoute path="/write-review"><AppLayout><RoutedPage Component={WriteReview} /></AppLayout></RoleRoute>} />

      {/* ── Enterprise Module ── */}
      <Route path="/enterprises" element={<RoleRoute path="/enterprises"><AppLayout><EnterpriseManagement /></AppLayout></RoleRoute>} />
      <Route path="/animal-groups" element={<RoleRoute path="/animal-groups"><AppLayout><AnimalGroups /></AppLayout></RoleRoute>} />
      <Route path="/locations" element={<RoleRoute path="/locations"><AppLayout><LocationManagement /></AppLayout></RoleRoute>} />
      <Route path="/movement-log" element={<RoleRoute path="/movement-log"><AppLayout><MovementLog /></AppLayout></RoleRoute>} />
      <Route path="/campaigns" element={<RoleRoute path="/campaigns"><AppLayout><TreatmentCampaigns /></AppLayout></RoleRoute>} />

      {/* ── Tier-2 Advanced Modules ── */}
      <Route path="/health-analytics" element={<RoleRoute path="/health-analytics"><AppLayout><HealthAnalytics /></AppLayout></RoleRoute>} />
      <Route path="/breeding" element={<RoleRoute path="/breeding"><AppLayout><BreedingManager /></AppLayout></RoleRoute>} />
      <Route path="/feed-inventory" element={<RoleRoute path="/feed-inventory"><AppLayout><FeedInventory /></AppLayout></RoleRoute>} />
      <Route path="/compliance" element={<RoleRoute path="/compliance"><AppLayout><ComplianceDocs /></AppLayout></RoleRoute>} />
      <Route path="/financial" element={<RoleRoute path="/financial"><AppLayout><FinancialAnalytics /></AppLayout></RoleRoute>} />
      <Route path="/alerts" element={<RoleRoute path="/alerts"><AppLayout><AlertCenter /></AppLayout></RoleRoute>} />

      {/* ── Doctor/Vet Module ── */}
      <Route path="/doctor/dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/doctor/manage-schedule" element={<RoleRoute path="/doctor/manage-schedule"><AppLayout><RoutedPage Component={ManageSchedule} /></AppLayout></RoleRoute>} />
      <Route path="/doctor/patient-queue" element={<Navigate to="/consultations" replace />} />
      <Route path="/doctor/consultation-room/:consultationId" element={<ProtectedRoute><AppLayout><RoutedPage Component={ConsultationRoom} paramKey="consultationId" /></AppLayout></ProtectedRoute>} />
      <Route path="/doctor/prescriptions/new" element={<RoleRoute path="/doctor/prescriptions/new"><AppLayout><RoutedPage Component={PrescriptionWriter} /></AppLayout></RoleRoute>} />
      <Route path="/doctor/prescriptions" element={<RoleRoute path="/doctor/prescriptions"><AppLayout><RoutedPage Component={Prescriptions} /></AppLayout></RoleRoute>} />
      <Route path="/doctor/reviews" element={<RoleRoute path="/doctor/reviews"><AppLayout><RoutedPage Component={MyReviews} /></AppLayout></RoleRoute>} />

      {/* ── Admin Module ── */}
      <Route path="/admin/dashboard" element={<RoleRoute path="/admin/dashboard"><AppLayout><RoutedPage Component={AdminDashboard} /></AppLayout></RoleRoute>} />
      <Route path="/admin/users" element={<RoleRoute path="/admin/users"><AppLayout><RoutedPage Component={UserManagement} /></AppLayout></RoleRoute>} />
      <Route path="/admin/consultations" element={<RoleRoute path="/admin/consultations"><AppLayout><RoutedPage Component={ConsultationManagement} /></AppLayout></RoleRoute>} />
      <Route path="/admin/payments" element={<RoleRoute path="/admin/payments"><AppLayout><RoutedPage Component={PaymentManagement} /></AppLayout></RoleRoute>} />
      <Route path="/admin/reviews" element={<RoleRoute path="/admin/reviews"><AppLayout><RoutedPage Component={ReviewModeration} /></AppLayout></RoleRoute>} />
      <Route path="/admin/settings" element={<RoleRoute path="/admin/settings"><AppLayout><RoutedPage Component={SystemSettings} /></AppLayout></RoleRoute>} />
      <Route path="/admin/audit-logs" element={<RoleRoute path="/admin/audit-logs"><AppLayout><RoutedPage Component={AuditLogs} /></AppLayout></RoleRoute>} />
      <Route path="/admin/permissions" element={<RoleRoute path="/admin/permissions"><AppLayout><RoutedPage Component={PermissionManagement} /></AppLayout></RoleRoute>} />
      <Route path="/admin/medical-records" element={<RoleRoute path="/admin/medical-records"><AppLayout><RoutedPage Component={MedicalRecordManagement} /></AppLayout></RoleRoute>} />

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
          <PermissionProvider>
            <AppRoutes />
          </PermissionProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
