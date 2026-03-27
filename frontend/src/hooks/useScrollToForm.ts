import { useRef, useEffect } from 'react'

/**
 * Auto-scrolls to a form panel when it becomes visible.
 * Returns a ref to attach to the form container div.
 */
export function useScrollToForm(isVisible: boolean) {
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }, [isVisible])

  return formRef
}
