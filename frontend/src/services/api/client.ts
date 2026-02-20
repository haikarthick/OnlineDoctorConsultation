import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = '/api/v1'

/** Read a cookie value by name */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

let csrfToken: string | null = null

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach auth token + CSRF token
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Attach CSRF token for state-changing requests
    const method = (config.method || '').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = csrfToken || getCookie('__csrf')
      if (csrf && config.headers) {
        config.headers['X-CSRF-Token'] = csrf
      }
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// Response interceptor - handle common errors
client.interceptors.response.use(
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
          return client.request(originalConfig)
        } catch {
          // Refresh failed — logout
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
      if (data?.error?.includes?.('CSRF')) {
        await fetchCsrfToken()
        originalConfig._csrfRetry = true
        return client.request(originalConfig)
      }
    }
    return Promise.reject(error)
  }
)

/** Fetch a CSRF token from the server and cache it */
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await client.get('/csrf-token')
    csrfToken = response.data.csrfToken
  } catch {
    // non-fatal; requests without cookies bypass CSRF anyway
  }
}

// Fetch initial CSRF token
fetchCsrfToken().catch(() => { /* silent — will retry on 403 */ })

export { client }
export default client
