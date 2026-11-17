import { useCallback } from 'react'

/**
 * Sets one CSS custom property on an element from a value that is genuinely dynamic - a colour a
 * farmer picked, a computed width - WITHOUT an inline `style` prop (inline styles are banned by
 * the design system lint; see docs/DESIGN_SYSTEM.md). The element's class reads `var(--name)`.
 *
 *   const colorRef = useCssVar('--group-color', group.colorCode)
 *   <div className="group-card" ref={colorRef}>
 *
 * Returns a callback ref, so the value is applied when the element mounts and whenever it changes.
 */
export function useCssVar(name: string, value: string | null | undefined) {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return
    if (value) el.style.setProperty(name, value)
    else el.style.removeProperty(name)
  }, [name, value])
}
