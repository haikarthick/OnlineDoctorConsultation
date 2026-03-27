import { useEffect } from 'react'

/**
 * Global component that auto-scrolls to error alerts when they appear anywhere in the DOM.
 * Renders nothing — just observes DOM mutations.
 * Add once inside AppLayout to cover all pages.
 */
const ErrorAutoScroll: React.FC = () => {
  useEffect(() => {
    const ERROR_SELECTORS = '.module-alert.error, .alert.alert-error, .alert-error, .error-message, .modal-alert.error'

    const scrollToError = (el: Element) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('error-shake')
      setTimeout(() => el.classList.remove('error-shake'), 600)
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.matches(ERROR_SELECTORS)) {
              scrollToError(node)
              return
            }
            const child = node.querySelector(ERROR_SELECTORS)
            if (child) {
              scrollToError(child)
              return
            }
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}

export default ErrorAutoScroll
