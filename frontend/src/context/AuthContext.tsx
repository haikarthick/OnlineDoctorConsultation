import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, AuthContextType, RegisterData, UserRole } from '../types'

const API_BASE = '/api/v1'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const navigate = useNavigate()

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('authToken')
    const storedUser = localStorage.getItem('authUser')
    if (stored && storedUser) {
      setToken(stored)
      setUser(JSON.parse(storedUser))
      setIsAuthenticated(true)
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        const authToken = data.data?.token || data.token
        const userData = data.data?.user || {
          email,
          firstName: data.data?.firstName || email.split('@')[0],
          lastName: '',
          role: 'pet_owner' as UserRole,
          id: Math.random().toString()
        }

        setToken(authToken)
        setUser(userData)
        setIsAuthenticated(true)
        localStorage.setItem('authToken', authToken)
        localStorage.setItem('authUser', JSON.stringify(userData))
        navigate('/dashboard')
      } else {
        throw new Error(data.error?.message || data.error || 'Login failed')
      }
    } catch (error) {
      console.error('[AUTH] Login error:', error)
      throw error
    }
  }

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          createdAt: new Date().toISOString()
        }

        setToken(authToken)
        setUser(userData)
        setIsAuthenticated(true)
        localStorage.setItem('authToken', authToken)
        localStorage.setItem('authUser', JSON.stringify(userData))
        navigate('/dashboard')
      } else {
        throw new Error(result.error?.message || result.error || 'Registration failed')
      }
    } catch (error) {
      console.error('[AUTH] Registration error:', error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setIsAuthenticated(false)
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    navigate('/')
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, register, logout }}>
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
