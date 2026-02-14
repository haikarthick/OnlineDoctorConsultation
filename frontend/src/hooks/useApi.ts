import { useState, useCallback } from 'react'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
    setState({ data: null, loading: true, error: null })
    try {
      const result = await apiCall()
      setState({ data: result, loading: false, error: null })
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setState({ data: null, loading: false, error: message })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}

export function useNotification() {
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
  } | null>(null)

  const show = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  const dismiss = useCallback(() => {
    setNotification(null)
  }, [])

  return { notification, show, dismiss }
}
