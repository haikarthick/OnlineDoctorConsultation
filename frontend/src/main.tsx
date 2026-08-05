import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { registerServiceWorker, initInstallPrompt } from './pwa.ts'
import { installStaleChunkRecovery, scheduleStaleChunkGuardRelease } from './utils/staleChunkRecovery'
import { i18nInitialized } from './i18n'
import './index.css'

// Must run before anything can dynamically import a route chunk.
installStaleChunkRecovery();

// Register PWA service worker & install prompt
registerServiceWorker();
initInstallPrompt();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes (was cacheTime in v3)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Wait for i18next to finish loading the active language before the first
// render. English is bundled synchronously (instant either way); other
// languages are fetched over HTTP by i18next-http-backend, and rendering
// before that resolves would flash raw translation keys (e.g. "nav.home")
// since react-i18next's useSuspense is disabled.
i18nInitialized.then(() => {
  // We rendered, so any earlier chunk reload worked. Release the guard after a settle period
  // so a LATER deploy can recover in this same tab, without re-arming fast enough to let a
  // genuinely broken chunk reload-loop.
  scheduleStaleChunkGuardRelease()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </QueryClientProvider>
    </React.StrictMode>,
  )
})
