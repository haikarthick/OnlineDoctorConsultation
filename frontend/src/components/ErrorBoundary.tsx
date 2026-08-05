import { Component, ErrorInfo, ReactNode } from 'react'
import i18n from '../i18n'
import { isStaleChunkError, reloadForStaleChunk } from '../utils/staleChunkRecovery'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    // A stale lazy chunk after a deploy is not a crash - the tab is just running an older
    // build than the server has. Reload once and the user never sees an error screen. If the
    // reload already happened (guard held inside reloadForStaleChunk) we fall through and
    // render the fallback, so a genuinely missing chunk is still visible rather than looping.
    if (isStaleChunkError(error)) {
      reloadForStaleChunk()
      return
    }
    // Otherwise: already captured by getDerivedStateFromError.
    // Add external error reporting here (e.g. Sentry) if needed.
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '20px' }} aria-hidden="true">⚠️</div>
          <h2 style={{ color: '#1a1a1a', marginBottom: '12px' }}>{i18n.t('errorBoundary.heading')}</h2>
          <p style={{ color: '#666', marginBottom: '24px', maxWidth: '500px' }}>
            {i18n.t('errorBoundary.description')}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              {i18n.t('errorBoundary.tryAgain')}
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                background: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              {i18n.t('errorBoundary.reloadPage')}
            </button>
          </div>
          {this.state.error && (
            <div style={{ marginTop: '24px', textAlign: 'left', maxWidth: '600px', margin: '24px auto' }}>
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '16px',
                borderRadius: '8px',
                overflow: 'auto',
                fontSize: '13px',
                color: '#991b1b',
              }}>
                <strong>{i18n.t('errorBoundary.errorLabel')}</strong>{this.state.error.message}
              </div>
              {import.meta.env.DEV && (
                <pre style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '8px',
                  overflow: 'auto',
                  fontSize: '11px',
                  color: '#666',
                  marginTop: '8px',
                  maxHeight: '200px',
                }}>
                  {this.state.error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
