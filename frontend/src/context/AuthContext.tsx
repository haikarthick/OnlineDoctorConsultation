import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { returnPathFrom, takeReturnTo } from '../utils/returnPath'
import { UserFacingError } from '../utils/userMessage'
import { User, AuthContextType, RegisterData, UserRole } from '../types'

const API_BASE = '/api/v1'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function readStoredSession(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('authToken')
    const raw = localStorage.getItem('authUser')
    if (token && raw) {
      const user = JSON.parse(raw)
      if (user && typeof user === 'object') return { user, token }
    }
  } catch { /* unreadable storage or damaged value: treat as signed out */ }
  return { user: null, token: null }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // The stored session is read ONCE, synchronously, before the first render - so the app never has a
  // moment where a signed-in person looks signed out (which used to bounce deep links to /login or
  // the dashboard). A damaged stored value counts as signed out.
  const [initial] = useState(readStoredSession)
  const [user, setUser] = useState<User | null>(initial.user)
  const [token, setToken] = useState<string | null>(initial.token)
  const [isAuthenticated, setIsAuthenticated] = useState(initial.user !== null)
  const [loading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  /** Read a cookie by name (for CSRF) */
  const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
  }

  /** Build headers with optional CSRF token */
  const headersWithCsrf = (extra: Record<string, string> = {}): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
    const csrf = getCookie('__csrf')
    if (csrf) h['X-CSRF-Token'] = csrf
    return h
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: headersWithCsrf(),
        credentials: 'include',
        // `email` may be an email address or a mobile number: the server accepts either as the identifier.
        body: JSON.stringify({ identifier: email, password })
      })

      const data = await response.json()

      if (response.ok) {
        const authToken = data.data?.token || data.token
        const refreshTk = data.data?.refreshToken
        const userData = data.data?.user || {
          email,
          firstName: data.data?.firstName || email.split('@')[0],
          lastName: '',
          role: 'pet_owner' as UserRole,
          roles: ['pet_owner'],
          id: Math.random().toString()
        }
        // Ensure roles array is populated
        if (!userData.roles || userData.roles.length === 0) {
          userData.roles = [userData.role]
        }

        setToken(authToken)
        setUser(userData)
        setIsAuthenticated(true)
        localStorage.setItem('authToken', authToken)
        localStorage.setItem('authUser', JSON.stringify(userData))
        if (refreshTk) localStorage.setItem('refreshToken', refreshTk)
        navigate(returnPathFrom(location.state, takeReturnTo()), { replace: true })
      } else {
        // `data.message` MUST be read. A blocked account (pending_approval / frozen /
        // suspended) replies { success:false, accountStatus, message } with NO `error` key,
        // so reading only data.error dropped the real explanation and fell through to the
        // literal 'Login failed'. A vet waiting on approval was therefore told exactly what a
        // typo'd password is told, concluded their registration had not gone through, and
        // signed up again. Standard AppError replies carry BOTH message and userMessage(err),
        // so this ordering changes nothing for them.
        const err = new UserFacingError(
          data.message || data.error?.message || data.error || 'Login failed' // guard-ok: the server's sign-in reply is written for the person
        )
        // Let the caller render a blocked-but-legitimate account as information rather than
        // as a failure the user is expected to correct.
        if (data.accountStatus) err.accountStatus = data.accountStatus
        throw err
      }
    } catch (error) {
      throw error
    }
  }

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: headersWithCsrf(),
        credentials: 'include',
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (response.ok) {
        const authToken = result.data?.token || result.token
        const userData: User = {
          id: result.data?.user?.id || Math.random().toString(),
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
          roles: [data.role],
          createdAt: new Date().toISOString()
        }

        setToken(authToken)
        setUser(userData)
        setIsAuthenticated(true)
        localStorage.setItem('authToken', authToken)
        localStorage.setItem('authUser', JSON.stringify(userData))
        if (result.data?.refreshToken) localStorage.setItem('refreshToken', result.data.refreshToken)
        navigate(returnPathFrom(location.state, takeReturnTo()), { replace: true })
      } else {
        throw new UserFacingError(result.error?.message || result.message || result.error || 'Registration failed')
      }
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    // Revoke refresh token on server
    const refreshTk = localStorage.getItem('refreshToken')
    if (refreshTk) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ refreshToken: refreshTk }),
        })
      } catch { /* silent */ }
    }
    setUser(null)
    setToken(null)
    setIsAuthenticated(false)
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    localStorage.removeItem('refreshToken')
    navigate('/')
  }

  // hasRole checks all roles the user has (primary + secondary)
  const hasRole = (role: string): boolean => {
    if (!user) return false
    if (user.roles && user.roles.length > 0) return user.roles.includes(role)
    return user.role === role
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
