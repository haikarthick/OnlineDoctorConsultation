import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface BottomSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  /** id of the element that names the sheet for assistive tech; defaults to the title. */
  labelledBy?: string
}

/**
 * A panel that slides up from the bottom edge - the phone-first replacement for a centred modal.
 * Within thumb reach, dismissable by the close button, the backdrop or Escape, and it returns
 * focus to whatever opened it. On wide screens the same component renders as a centred dialog
 * (see .bottom-sheet in modules.css), so callers never branch on screen size.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, title, onClose, children, labelledBy }) => {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = labelledBy || 'bottom-sheet-title'

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="bottom-sheet-grip" aria-hidden="true" />
        <div className="bottom-sheet-header">
          <h2 id={titleId} className="bottom-sheet-title">{title}</h2>
          <button type="button" className="bottom-sheet-close" onClick={onClose} aria-label={t('mobileUi.close')}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  )
}
