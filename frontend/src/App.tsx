import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { PermissionProvider, usePermission, ROUTE_PERMISSION_MAP } from './context/PermissionContext'
import { SocketProvider } from './context/SocketContext'
import { Layout } from './components/Layout'
// Eagerly loaded public pages (needed at first paint)
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'
import './styles/modules.css'

// ── Lazy-loaded protected pages ─────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Consultations = lazy(() => import('./pages/Consultations'))
const MedicalRecords = lazy(() => import('./pages/MedicalRecords'))
const Animals = lazy(() => import('./pages/Animals'))
const Settings = lazy(() => import('./pages/Settings'))
// Pet Owner Module
const FindDoctor = lazy(() => import('./pages/petowner/FindDoctor'))
const BookConsultation = lazy(() => import('./pages/petowner/BookConsultation'))
const VideoConsultation = lazy(() => import('./pages/petowner/VideoConsultation'))
const WriteReview = lazy(() => import('./pages/petowner/WriteReview'))
const VetProfilePage = lazy(() => import('./pages/petowner/VetProfilePage'))
// Doctor Module
const ManageSchedule = lazy(() => import('./pages/doctor/ManageSchedule'))
const ConsultationRoom = lazy(() => import('./pages/doctor/ConsultationRoom'))
const PrescriptionWriter = lazy(() => import('./pages/doctor/PrescriptionWriter'))
const Prescriptions = lazy(() => import('./pages/doctor/Prescriptions'))
const MyReviews = lazy(() => import('./pages/doctor/MyReviews'))
// Admin Module
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const ConsultationManagement = lazy(() => import('./pages/admin/ConsultationManagement'))
const PaymentManagement = lazy(() => import('./pages/admin/PaymentManagement'))
const ReviewModeration = lazy(() => import('./pages/admin/ReviewModeration'))
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'))
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'))
const PermissionManagement = lazy(() => import('./pages/admin/PermissionManagement'))
const MedicalRecordManagement = lazy(() => import('./pages/admin/MedicalRecordManagement'))
// Enterprise Module
const EnterpriseManagement = lazy(() => import('./pages/EnterpriseManagement'))
const AnimalGroups = lazy(() => import('./pages/AnimalGroups'))
const LocationManagement = lazy(() => import('./pages/LocationManagement'))
const MovementLog = lazy(() => import('./pages/MovementLog'))
const TreatmentCampaigns = lazy(() => import('./pages/TreatmentCampaigns'))
const HerdMedicalManagement = lazy(() => import('./pages/HerdMedicalManagement'))
// Advanced Modules
const HealthAnalytics = lazy(() => import('./pages/HealthAnalytics'))
const BreedingManager = lazy(() => import('./pages/BreedingManager'))
const FeedInventory = lazy(() => import('./pages/FeedInventory'))
const ComplianceDocs = lazy(() => import('./pages/ComplianceDocs'))
const FinancialAnalytics = lazy(() => import('./pages/FinancialAnalytics'))
const AlertCenter = lazy(() => import('./pages/AlertCenter'))
// Innovation Modules
const DiseasePrediction = lazy(() => import('./pages/DiseasePrediction'))
const GenomicLineage = lazy(() => import('./pages/GenomicLineage'))
const IoTSensors = lazy(() => import('./pages/IoTSensors'))
const SupplyChain = lazy(() => import('./pages/SupplyChain'))
const Workforce = lazy(() => import('./pages/Workforce'))
const ReportBuilder = lazy(() => import('./pages/ReportBuilder'))
// Intelligence Modules
const AICopilot = lazy(() => import('./pages/AICopilot'))
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const Sustainability = lazy(() => import('./pages/Sustainability'))
const WellnessPortal = lazy(() => import('./pages/WellnessPortal'))
const GeospatialAnalytics = lazy(() => import('./pages/GeospatialAnalytics'))

/** Suspense fallback spinner shown while lazy chunks load */
function PageLoader() {
  return (
    <div role="status" aria-label="Loading page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
      <div className="spinner" aria-hidden="true" style={{
        width: 40, height: 40, border: '4px solid #e0e0e0',
        borderTop: '4px solid #2e7d32', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span className="sr-only">Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/** Wrapper: redirects unauthenticated users to /login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Wrapper: enforces RBAC permission on a route. Redirects to /dashboard if no access */
function RoleRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { hasPermission, loading } = usePermission()
  if (authLoading) return <PageLoader />
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
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
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
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public pages */}
      <Route path="/" element={
        <PublicOnlyRoute>
          <Home onGetStarted={() => navigate('/register')} onViewForDoctors={() => navigate('/register')} onLogin={() => navigate('/login')} />
        </PublicOnlyRoute>
      } />
      <Route path="/login" element={
        <PublicOnlyRoute>
          <Login onSwitchToRegister={() => navigate('/register')} onGoHome={() => navigate('/')} />
        </PublicOnlyRoute>
      } />
      <Route path="/register" element={
        <PublicOnlyRoute>
          <Register onSwitchToLogin={() => navigate('/login')} onGoHome={() => navigate('/')} />
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
      <Route path="/vet-profile/:userId" element={<ProtectedRoute><AppLayout><RoutedPage Component={VetProfilePage} paramKey="userId" /></AppLayout></ProtectedRoute>} />

      {/* ── Enterprise Module ── */}
      <Route path="/enterprises" element={<RoleRoute path="/enterprises"><AppLayout><EnterpriseManagement /></AppLayout></RoleRoute>} />
      <Route path="/animal-groups" element={<RoleRoute path="/animal-groups"><AppLayout><AnimalGroups /></AppLayout></RoleRoute>} />
      <Route path="/locations" element={<RoleRoute path="/locations"><AppLayout><LocationManagement /></AppLayout></RoleRoute>} />
      <Route path="/movement-log" element={<RoleRoute path="/movement-log"><AppLayout><MovementLog /></AppLayout></RoleRoute>} />
      <Route path="/campaigns" element={<RoleRoute path="/campaigns"><AppLayout><TreatmentCampaigns /></AppLayout></RoleRoute>} />
      <Route path="/herd-medical" element={<RoleRoute path="/herd-medical"><AppLayout><HerdMedicalManagement /></AppLayout></RoleRoute>} />

      {/* ── Advanced Modules ── */}
      <Route path="/health-analytics" element={<RoleRoute path="/health-analytics"><AppLayout><HealthAnalytics /></AppLayout></RoleRoute>} />
      <Route path="/breeding" element={<RoleRoute path="/breeding"><AppLayout><BreedingManager /></AppLayout></RoleRoute>} />
      <Route path="/feed-inventory" element={<RoleRoute path="/feed-inventory"><AppLayout><FeedInventory /></AppLayout></RoleRoute>} />
      <Route path="/compliance" element={<RoleRoute path="/compliance"><AppLayout><ComplianceDocs /></AppLayout></RoleRoute>} />
      <Route path="/financial" element={<RoleRoute path="/financial"><AppLayout><FinancialAnalytics /></AppLayout></RoleRoute>} />
      <Route path="/alerts" element={<RoleRoute path="/alerts"><AppLayout><AlertCenter /></AppLayout></RoleRoute>} />

      {/* ── Innovation Modules ── */}
      <Route path="/disease-prediction" element={<RoleRoute path="/disease-prediction"><AppLayout><DiseasePrediction /></AppLayout></RoleRoute>} />
      <Route path="/genomic-lineage" element={<RoleRoute path="/genomic-lineage"><AppLayout><GenomicLineage /></AppLayout></RoleRoute>} />
      <Route path="/iot-sensors" element={<RoleRoute path="/iot-sensors"><AppLayout><IoTSensors /></AppLayout></RoleRoute>} />
      <Route path="/supply-chain" element={<RoleRoute path="/supply-chain"><AppLayout><SupplyChain /></AppLayout></RoleRoute>} />
      <Route path="/workforce" element={<RoleRoute path="/workforce"><AppLayout><Workforce /></AppLayout></RoleRoute>} />
      <Route path="/report-builder" element={<RoleRoute path="/report-builder"><AppLayout><ReportBuilder /></AppLayout></RoleRoute>} />

      {/* ── Intelligence Modules ── */}
      <Route path="/ai-copilot" element={<RoleRoute path="/ai-copilot"><AppLayout><AICopilot /></AppLayout></RoleRoute>} />
      <Route path="/digital-twin" element={<RoleRoute path="/digital-twin"><AppLayout><DigitalTwin /></AppLayout></RoleRoute>} />
      <Route path="/marketplace" element={<RoleRoute path="/marketplace"><AppLayout><Marketplace /></AppLayout></RoleRoute>} />
      <Route path="/sustainability" element={<RoleRoute path="/sustainability"><AppLayout><Sustainability /></AppLayout></RoleRoute>} />
      <Route path="/wellness" element={<RoleRoute path="/wellness"><AppLayout><WellnessPortal /></AppLayout></RoleRoute>} />
      <Route path="/geospatial" element={<RoleRoute path="/geospatial"><AppLayout><GeospatialAnalytics /></AppLayout></RoleRoute>} />

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
    </Suspense>
  )
}

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <PermissionProvider>
            <SocketProvider>
              <AppRoutes />
            </SocketProvider>
          </PermissionProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
