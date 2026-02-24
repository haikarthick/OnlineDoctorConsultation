import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Silence transient proxy errors (ECONNREFUSED / ECONNRESET / ECONNABORTED).
 * Vite's built-in proxy logger fires *before* user-land handlers, so we
 * monkey-patch the proxy's `emit` to swallow network-level errors that are
 * harmless during development (e.g. backend restart, cold start).
 */
function silenceProxyErrors(proxy: any) {
  const SUPPRESSED = new Set(['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT'])
  const origEmit = proxy.emit.bind(proxy)
  proxy.emit = (event: string, err: any, ...args: any[]) => {
    if (event === 'error' && err && SUPPRESSED.has(err.code)) {
      return true                 // swallow — prevent Vite's default logger
    }
    return origEmit(event, err, ...args)
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: silenceProxyErrors,
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        configure: silenceProxyErrors,
      }
    }
  }
})
