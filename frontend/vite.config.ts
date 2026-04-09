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
  build: {
    // Split vendor libs into separate chunks to reduce peak memory during minification.
    // Render free tier has 512MB RAM — a single 1,585KB bundle OOM-kills the build process.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector', 'i18next-http-backend'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-socket': ['socket.io-client'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-markdown': ['react-markdown'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: silenceProxyErrors,
      },
      '/uploads': {
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
