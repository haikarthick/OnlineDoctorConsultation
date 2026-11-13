import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

export const API_BASE_URL = '/api/v1'

/** Read a cookie value by name */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

// ─── Shared Axios client ──────────────────────────────────────────
// This is THE single Axios instance + auth/CSRF/refresh interceptor stack
// for the whole app. services/api/client.ts re-exports it rather than
// creating its own - previously it duplicated all of this with a subtly
// different (weaker) 403/CSRF error-shape check, and its CSRF token cache
// was a separate variable that never synced with this one, so a token
// rotated on one client wasn't known to the other.
let sharedCsrfToken: string | null = null

export const sharedClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s - free-tier Render DB can take up to 30-90s to wake from sleep
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach auth token + CSRF token
sharedClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Attach CSRF token for state-changing requests
    const method = (config.method || '').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = sharedCsrfToken || getCookie('__csrf')
      if (csrf && config.headers) {
        config.headers['X-CSRF-Token'] = csrf
      }
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Response interceptor - handle common errors
sharedClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as InternalAxiosRequestConfig & { _authRetry?: boolean; _csrfRetry?: boolean }

    // On 401, try to refresh the token before logging out
    if (error.response?.status === 401 && originalConfig && !originalConfig._authRetry) {
      originalConfig._authRetry = true
      const refreshTk = localStorage.getItem('refreshToken')
      if (refreshTk) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: refreshTk }, { withCredentials: true })
          const { token: newToken, refreshToken: newRefreshToken } = res.data.data
          localStorage.setItem('authToken', newToken)
          if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken)
          if (originalConfig.headers) {
            originalConfig.headers.Authorization = `Bearer ${newToken}`
          }
          return sharedClient.request(originalConfig)
        } catch {
          // Refresh failed - logout
        }
      }
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
      localStorage.removeItem('refreshToken')
      window.location.href = '/'
    }

    // If CSRF token expired/missing, fetch a new one and retry once
    if (error.response?.status === 403 && originalConfig && !originalConfig._csrfRetry) {
      const data = error.response?.data as any
      const errorStr = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || '')
      if (errorStr.includes('CSRF')) {
        await fetchCsrfToken()
        originalConfig._csrfRetry = true
        return sharedClient.request(originalConfig)
      }
    }
    return Promise.reject(error)
  }
)

// Add timeout flag so pages can show user-friendly message instead of raw axios error
sharedClient.interceptors.response.use(
  undefined,
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const enriched = new Error(
        'The server is taking longer than expected to respond (possibly waking from sleep). Please wait a moment and try again.'
      ) as any
      enriched.isTimeout = true
      enriched.originalError = error
      return Promise.reject(enriched)
    }
    return Promise.reject(error)
  }
)

/** Fetch a CSRF token from the server and cache it (shared across every consumer of sharedClient) */
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await sharedClient.get('/csrf-token')
    sharedCsrfToken = response.data.csrfToken
  } catch {
    // non-fatal; requests without cookies bypass CSRF anyway
  }
}

// Fetch initial CSRF token
fetchCsrfToken().catch(() => { /* silent - will retry on 403 */ })

