import React from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { usePermission, ROUTE_PERMISSION_MAP } from '../../context/PermissionContext'
import { returnPathFrom } from '../../utils/returnPath'

/**
 * Route guards - the ONE place that decides whether a person may open a page.
 *
 * Three rules keep a person from ever landing somewhere unexplained:
 *   1. No decision is made until we KNOW the answer. While sign-in or the permission list is still
 *      loading, a guard shows a loader. (A guard that decided on an empty, still-loading permission
 *      list used to send people to the dashboard from a pasted link or a page refresh.)
 *   2. A failed permission check is not "no permission". It says the check could not be made and
 *      offers Try again.
 *   3. A real refusal explains itself: what, why, and what to do next - never a silent redirect.
 *
 * A signed-out person who opens a deep link is sent to sign in and brought back to that page.
 */

export const PageLoader: React.FC = () => (
  <div className="route-loader" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true" />
  </div>
)

/** A plain-words screen for "you cannot open this right now", with a way forward. */
export const AccessProblem: React.FC<{
  kind: 'checkFailed' | 'noPermission' | 'notFound'
  onRetry?: () => void
  /** Where the primary button goes. */
  homePath?: string
}> = ({ kind, onRetry, homePath = '/dashboard' }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  return (
    <div className="empty-state route-problem" role="alert">
      <div className="empty-icon" aria-hidden="true">{kind === 'checkFailed' ? '📶' : kind === 'notFound' ? '🧭' : '🔒'}</div>
      <h3>{t(`routeErrors.${kind}.title`)}</h3>
      <p>{t(`routeErrors.${kind}.body`, { role: user?.role ? String(user.role).replace(/_/g, ' ') : '' })}</p>
      {kind === 'checkFailed' && onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>{t('routeErrors.checkFailed.retry')}</button>
      )}
      {kind !== 'checkFailed' && (
        <button type="button" className="btn btn-primary" onClick={() => navigate(homePath)}>
          {t(kind === 'notFound' && homePath === '/' ? 'routeErrors.notFound.home' : 'routeErrors.noPermission.home')}
        </button>
      )}
    </div>
  )
}

/** Signed-in pages. Signed out: go and sign in, then come back here. */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}

/** Pages that need a permission. */
export const RoleRoute: React.FC<{ children: React.ReactNode; path: string }> = ({ children, path }) => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { hasPermission, loading, loadFailed, reloadPermissions } = usePermission()
  const location = useLocation()
  if (authLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (loading) return <PageLoader />
  const requiredPermission = ROUTE_PERMISSION_MAP[path]
  if (requiredPermission) {
    if (loadFailed) return <AccessProblem kind="checkFailed" onRetry={() => { void reloadPermissions() }} />
    if (!hasPermission(requiredPermission)) return <AccessProblem kind="noPermission" />
  }
  return <>{children}</>
}

/** Sign-in and registration: already signed in? Go where you were headed, or the dashboard. */
export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to={returnPathFrom(location.state)} replace />
  return <>{children}</>
}
