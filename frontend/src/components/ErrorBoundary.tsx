import { Component, ErrorInfo, ReactNode } from 'react'

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ color: '#1a1a1a', marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '24px', maxWidth: '500px' }}>
            An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
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
              Try Again
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
              Reload Page
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
                <strong>Error: </strong>{this.state.error.message}
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
