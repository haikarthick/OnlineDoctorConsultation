import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { codedMessage } from '../../utils/codedMessage'
import '../mobile/ownerTools.css'

interface Props {
  providerId: string
  /** The saved working-hours row to remove (its id), and the weekday name to say ("Monday"). */
  scheduleId: string | null
  dayName: string
  onClose: () => void
  onRemoved: () => void
}

/** Remove a saved working-hours row. Customers can no longer book that weekday until hours are saved for it again; bookings already made stay. */
export function RemoveScheduleSheet({ providerId, scheduleId, dayName, onClose, onRemoved }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    if (!scheduleId || busy) return
    setBusy(true); setError('')
    try { await apiService.deleteGroomingSchedule(providerId, scheduleId); onRemoved() }
    catch (err) { setError(codedMessage(err, 'groomingConsole', 'groomingConsole.removeFailed')) }
    finally { setBusy(false) }
  }

  return (
    <BottomSheet open={!!scheduleId} title={t('groomingConsole.removeHoursTitle', { day: dayName })} onClose={onClose}>
      <div className="ot-sheet">
        <p>{t('groomingConsole.removeHoursConfirm', { day: dayName })}</p>
        <p className="ot-muted">{t('groomingConsole.removeHoursHint')}</p>
        {error && <div className="ot-error" role="alert">{error}</div>}
        <div className="ot-actions">
          <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="module-btn primary" disabled={busy} onClick={remove}>{t('groomingConsole.removeHours')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}
