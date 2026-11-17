import React from 'react'
import { useTranslation } from 'react-i18next'
import type { SaveStatus } from '../../hooks/useSaveAction'

interface SaveStateProps {
  status: SaveStatus
  error?: string
  offline?: boolean
  onRetry?: () => void
  /** Shown when saved, e.g. "Saved. Next cow?" Defaults to a plain "Saved". */
  savedMessage?: string
}

/**
 * The status line that goes with useSaveAction(): saving, saved, or failed with Retry.
 * A failure caused by no connection is styled as "waiting", not as an error - being offline is
 * not something the user did wrong (docs/DESIGN_SYSTEM.md section 5a), and what they typed is
 * still in the form.
 */
export const SaveState: React.FC<SaveStateProps> = ({ status, error, offline, onRetry, savedMessage }) => {
  const { t } = useTranslation()
  if (status === 'idle') return null

  if (status === 'saving') {
    return <p className="save-state is-saving" role="status">{t('mobileUi.save.saving')}</p>
  }
  if (status === 'saved') {
    return <p className="save-state is-saved" role="status"><span aria-hidden="true">✓ </span>{savedMessage || t('mobileUi.save.saved')}</p>
  }
  return (
    <div className={`save-state ${offline ? 'is-offline' : 'is-failed'}`} role="alert">
      <div className="save-state-text">
        <strong>{offline ? t('mobileUi.save.offlineTitle') : t('mobileUi.save.failedTitle')}</strong>
        <span>{offline ? t('mobileUi.save.offlineHint') : error}</span>
      </div>
      {onRetry && <button type="button" className="save-state-retry" onClick={onRetry}>{t('mobileUi.save.retry')}</button>}
    </div>
  )
}
