import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ProtectedRoute, RoleRoute, PublicOnlyRoute } from './RouteGuards'
import { returnPathFrom, rememberSessionEnded, takeSessionEnded, takeReturnTo } from '../../utils/returnPath'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let auth = { isAuthenticated: true, loading: false, user: { role: 'farmer' } as any }
let perm = { loading: false, loadFailed: false, has: true, reload: vi.fn() }
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../../context/PermissionContext', () => ({
  ROUTE_PERMISSION_MAP: { '/animals': 'view_animals' },
  usePermission: () => ({ loading: perm.loading, loadFailed: perm.loadFailed, hasPermission: () => perm.has, reloadPermissions: perm.reload }),
}))

const Where: React.FC = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div> }

const app = (start: string) => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><div>login page</div><Where /></PublicOnlyRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><div>dashboard page</div></ProtectedRoute>} />
      <Route path="/animals" element={<RoleRoute path="/animals"><div>animals page</div></RoleRoute>} />
    </Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  auth = { isAuthenticated: true, loading: false, user: { role: 'farmer' } }
  perm = { loading: false, loadFailed: false, has: true, reload: vi.fn() }
})

describe('RoleRoute', () => {
  it('opens a pasted deep link when the person has the permission', () => {
    app('/animals')
    expect(screen.getByText('animals page')).toBeInTheDocument()
  })

  it('shows a loader - and decides nothing - while permissions are still loading', () => {
    perm = { ...perm, loading: true, has: false }
    app('/animals')
    expect(screen.queryByText('animals page')).toBeNull()
    expect(screen.queryByText('dashboard page')).toBeNull() // no silent redirect
    expect(screen.queryByText('routeErrors.noPermission.title')).toBeNull() // and no premature "no access"
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('a failed permission check says so and offers Try again; it is not "no permission"', () => {
    perm = { ...perm, loadFailed: true, has: false }
    app('/animals')
    expect(screen.getByText('routeErrors.checkFailed.title')).toBeInTheDocument()
    expect(screen.queryByText('routeErrors.noPermission.title')).toBeNull()
    fireEvent.click(screen.getByText('routeErrors.checkFailed.retry'))
    expect(perm.reload).toHaveBeenCalledTimes(1)
  })

  it('a real refusal explains itself and offers a way forward instead of redirecting', () => {
    perm = { ...perm, has: false }
    app('/animals')
    expect(screen.getByText('routeErrors.noPermission.title')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByText('routeErrors.noPermission.home'))
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
  })

  it('signed out: sent to sign in, and brought back to the page that was asked for', async () => {
    auth = { isAuthenticated: false, loading: false, user: null }
    const { unmount } = app('/animals?tab=2')
    expect(screen.getByText('login page')).toBeInTheDocument()
    unmount()
    // After sign-in the login route (public-only) sends the person where they were headed.
    auth = { isAuthenticated: true, loading: false, user: { role: 'farmer' } }
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/animals', search: '?tab=2' } } }]}>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><div>login page</div></PublicOnlyRoute>} />
          <Route path="/animals" element={<><div>animals page</div><Where /></>} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/animals?tab=2'))
  })

  it('waits for sign-in to be restored instead of treating a refresh as signed out', () => {
    auth = { isAuthenticated: false, loading: true, user: null }
    app('/animals')
    expect(screen.queryByText('login page')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('returnPathFrom', () => {
  it('uses the page that was asked for, else the dashboard', () => {
    expect(returnPathFrom({ from: { pathname: '/animals', search: '?x=1' } })).toBe('/animals?x=1')
    expect(returnPathFrom(null)).toBe('/dashboard')
    expect(returnPathFrom({})).toBe('/dashboard')
  })
  it('never honours anything but a path inside the app', () => {
    expect(returnPathFrom({ from: { pathname: '//evil.example/x' } })).toBe('/dashboard')
    expect(returnPathFrom({ from: { pathname: 'https://evil.example' } })).toBe('/dashboard')
    expect(returnPathFrom({ from: { pathname: '/login' } })).toBe('/dashboard')
  })
})

describe('a session that ended while working', () => {
  it('is remembered once, so sign-in can explain it and bring the person back', () => {
    rememberSessionEnded('/animals?tab=2')
    expect(takeSessionEnded()).toBe(true)
    expect(takeSessionEnded()).toBe(false) // shown once
    expect(returnPathFrom(null, takeReturnTo())).toBe('/animals?tab=2')
    expect(takeReturnTo()).toBeNull()
  })
  it('a remembered address outside the app is ignored', () => {
    expect(returnPathFrom(null, '//evil.example')).toBe('/dashboard')
  })
})
