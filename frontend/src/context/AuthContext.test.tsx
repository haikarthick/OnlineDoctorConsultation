import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <AuthProvider>{children}</AuthProvider>
  </MemoryRouter>
)

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    mockNavigate.mockClear()
    vi.restoreAllMocks()
  })

  describe('persistence on mount', () => {
    it('hydrates from localStorage when both authToken and authUser are present', async () => {
      const storedUser = { id: '1', email: 'vet@example.com', firstName: 'Val', lastName: 'Vet', role: 'veterinarian', roles: ['veterinarian'] }
      localStorage.setItem('authToken', 'stored-token')
      localStorage.setItem('authUser', JSON.stringify(storedUser))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.token).toBe('stored-token')
      expect(result.current.user).toEqual(storedUser)
    })

    it('stays unauthenticated when authToken is missing', async () => {
      localStorage.setItem('authUser', JSON.stringify({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'pet_owner' }))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })

    it('stays unauthenticated when authUser is missing', async () => {
      localStorage.setItem('authToken', 'orphan-token')

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('stays unauthenticated when localStorage has nothing', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })
  })

  describe('login', () => {
    it('stores auth data, flips isAuthenticated, and navigates to /dashboard on success', async () => {
      const serverUser = { id: '42', email: 'pet@example.com', firstName: 'Pat', lastName: 'Owner', role: 'pet_owner', roles: ['pet_owner'] }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { token: 'new-token', refreshToken: 'new-refresh', user: serverUser } }),
      }) as any

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.login('pet@example.com', 'Password123')
      })

      expect(localStorage.getItem('authToken')).toBe('new-token')
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh')
      expect(JSON.parse(localStorage.getItem('authUser') || '{}')).toEqual(serverUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(serverUser)
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    it('throws and leaves storage/state untouched when the server responds with an error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Invalid credentials' } }),
      }) as any

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      await expect(
        act(async () => {
          await result.current.login('pet@example.com', 'wrong-password')
        })
      ).rejects.toThrow('Invalid credentials')

      expect(localStorage.getItem('authToken')).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('logout', () => {
    it('clears all auth localStorage keys and navigates to / ', async () => {
      const storedUser = { id: '1', email: 'vet@example.com', firstName: 'Val', lastName: 'Vet', role: 'veterinarian', roles: ['veterinarian'] }
      localStorage.setItem('authToken', 'stored-token')
      localStorage.setItem('authUser', JSON.stringify(storedUser))
      localStorage.setItem('refreshToken', 'stored-refresh')

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

      await act(async () => {
        await result.current.logout()
      })

      expect(localStorage.getItem('authToken')).toBeNull()
      expect(localStorage.getItem('authUser')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('hasRole (role visibility)', () => {
    it('checks the roles array when present and non-empty', async () => {
      const storedUser = { id: '1', email: 'multi@example.com', firstName: 'Multi', lastName: 'Role', role: 'veterinarian', roles: ['veterinarian', 'pharmacist'] }
      localStorage.setItem('authToken', 'tok')
      localStorage.setItem('authUser', JSON.stringify(storedUser))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

      expect(result.current.hasRole('pharmacist')).toBe(true)
      expect(result.current.hasRole('veterinarian')).toBe(true)
      expect(result.current.hasRole('admin')).toBe(false)
    })

    it('falls back to the single role field when roles array is absent', async () => {
      const storedUser = { id: '2', email: 'single@example.com', firstName: 'Single', lastName: 'Role', role: 'pet_owner' }
      localStorage.setItem('authToken', 'tok')
      localStorage.setItem('authUser', JSON.stringify(storedUser))

      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

      expect(result.current.hasRole('pet_owner')).toBe(true)
      expect(result.current.hasRole('admin')).toBe(false)
    })

    it('returns false for any role when logged out', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.hasRole('admin')).toBe(false)
      expect(result.current.hasRole('pet_owner')).toBe(false)
    })
  })
})
