/**
 * Unit tests for the shared Axios client's auth-refresh and CSRF-retry
 * interceptors in api.ts (the client actually used by ~94 of the app's
 * pages — see services/api/client.ts for the separate, newer client used
 * by a handful of pages under services/api/*Api.ts).
 *
 * Interceptors are tested by capturing the callback functions Axios
 * registers them with, then invoking those callbacks directly with
 * synthetic error objects — this avoids needing a real network layer and
 * matches how Axios itself would invoke them on a real response.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockClient = {
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  get: vi.fn(),
  request: vi.fn(),
}

vi.mock('axios', () => {
  const create = vi.fn(() => mockClient)
  const post = vi.fn()
  return { default: { create, post }, create, post }
})

import axios from 'axios'

describe('api.ts — auth refresh + CSRF retry interceptors', () => {
  let responseErrorHandler: (error: any) => Promise<any>
  let requestHandler: (config: any) => any
  let locationHrefSetter: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    mockClient.get.mockReset().mockResolvedValue({ data: { csrfToken: 'initial-csrf' } })
    mockClient.request.mockReset()
    mockClient.interceptors.request.use.mockClear()
    mockClient.interceptors.response.use.mockClear()
    ;(axios.post as any).mockReset()
    localStorage.clear()

    // window.location.href is read-only in jsdom by default; stub it so the
    // logout-redirect branch doesn't throw or actually navigate.
    locationHrefSetter = vi.fn()
    delete (window as any).location
    window.location = { ...window.location, set href(v: string) { locationHrefSetter(v) }, get href() { return '' } } as any

    await import('./api')

    // First registered request interceptor: attaches auth + CSRF headers.
    requestHandler = mockClient.interceptors.request.use.mock.calls[0][0]
    // First registered response interceptor: auth-refresh + CSRF-retry (the
    // second one registered, at the bottom of the constructor, is timeout
    // handling — unrelated to this test).
    responseErrorHandler = mockClient.interceptors.response.use.mock.calls[0][1]
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('request interceptor', () => {
    it('attaches Authorization header from authToken in localStorage', () => {
      localStorage.setItem('authToken', 'my-jwt')
      const config = requestHandler({ method: 'get', headers: {} })
      expect(config.headers.Authorization).toBe('Bearer my-jwt')
    })

    it('does not attach a CSRF header to GET requests', () => {
      const config = requestHandler({ method: 'get', headers: {} })
      expect(config.headers['X-CSRF-Token']).toBeUndefined()
    })

    it('attaches the cached CSRF token to state-changing requests', async () => {
      // The constructor's initial fetchCsrfToken() call resolves the cached token.
      await Promise.resolve()
      await Promise.resolve()
      const config = requestHandler({ method: 'post', headers: {} })
      expect(config.headers['X-CSRF-Token']).toBe('initial-csrf')
    })
  })

  describe('401 handling — refresh-then-retry', () => {
    it('refreshes the token and retries the original request on success', async () => {
      localStorage.setItem('refreshToken', 'old-refresh')
      ;(axios.post as any).mockResolvedValue({
        data: { data: { token: 'new-jwt', refreshToken: 'new-refresh' } },
      })
      mockClient.request.mockResolvedValue({ data: 'retried-ok' })

      const originalConfig = { headers: {}, url: '/bookings' }
      const error = { response: { status: 401 }, config: originalConfig }

      const result = await responseErrorHandler(error)

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/auth/refresh',
        { refreshToken: 'old-refresh' },
        { withCredentials: true }
      )
      expect(localStorage.getItem('authToken')).toBe('new-jwt')
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh')
      expect((originalConfig.headers as any).Authorization).toBe('Bearer new-jwt')
      expect(mockClient.request).toHaveBeenCalledWith(originalConfig)
      expect(result).toEqual({ data: 'retried-ok' })
    })

    it('does not retry twice for the same request (marks _authRetry)', async () => {
      const originalConfig = { headers: {}, _authRetry: true, url: '/bookings' }
      const error = { response: { status: 401 }, config: originalConfig }

      await responseErrorHandler(error).catch(() => {})

      expect(axios.post).not.toHaveBeenCalled()
    })

    it('logs out (clears tokens, redirects) when there is no refresh token', async () => {
      const originalConfig = { headers: {}, url: '/bookings' }
      const error = { response: { status: 401 }, config: originalConfig }

      await responseErrorHandler(error).catch(() => {})

      expect(axios.post).not.toHaveBeenCalled()
      expect(localStorage.getItem('authToken')).toBeNull()
      expect(locationHrefSetter).toHaveBeenCalledWith('/')
    })

    it('logs out when the refresh call itself fails', async () => {
      localStorage.setItem('authToken', 'stale-jwt')
      localStorage.setItem('refreshToken', 'bad-refresh')
      ;(axios.post as any).mockRejectedValue(new Error('refresh rejected'))

      const originalConfig = { headers: {}, url: '/bookings' }
      const error = { response: { status: 401 }, config: originalConfig }

      await responseErrorHandler(error).catch(() => {})

      expect(localStorage.getItem('authToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
      expect(locationHrefSetter).toHaveBeenCalledWith('/')
    })
  })

  describe('403 handling — CSRF retry', () => {
    it('fetches a fresh CSRF token and retries once when the error mentions CSRF', async () => {
      mockClient.get.mockResolvedValue({ data: { csrfToken: 'rotated-csrf' } })
      mockClient.request.mockResolvedValue({ data: 'retried-after-csrf' })

      const originalConfig = { headers: {}, url: '/bookings', method: 'post' }
      const error = { response: { status: 403, data: { error: 'Invalid CSRF token' } }, config: originalConfig }

      const result = await responseErrorHandler(error)

      expect((originalConfig as any)._csrfRetry).toBe(true)
      expect(mockClient.request).toHaveBeenCalledWith(originalConfig)
      expect(result).toEqual({ data: 'retried-after-csrf' })
    })

    it('does not retry a 403 that is unrelated to CSRF', async () => {
      const originalConfig = { headers: {}, url: '/admin/users', method: 'get' }
      const error = { response: { status: 403, data: { error: 'Insufficient permissions' } }, config: originalConfig }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockClient.request).not.toHaveBeenCalled()
    })

    it('does not retry a 403 twice for the same request (marks _csrfRetry)', async () => {
      const originalConfig = { headers: {}, url: '/bookings', _csrfRetry: true }
      const error = { response: { status: 403, data: { error: 'CSRF token missing' } }, config: originalConfig }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockClient.request).not.toHaveBeenCalled()
    })
  })
})
