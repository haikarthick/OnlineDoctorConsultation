import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import '../mobile/ownerTools.css'

interface LogRow {
  id: string
  userId?: string
  userName?: string
  action: string
  createdAt?: string
  details?: { reason?: string; cancelledByRole?: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  myUserId?: string
  /** The same words the per-booking log uses ("Booking created", "Confirmed", ...). */
  actionLabel: (action: string) => string
}

const PAGE = 30

/**
 * "History": everything that happened to MY bookings - booked, confirmed, cancelled, rescheduled - newest first, across all of them
 * (the per-booking Action Log shows one booking). The server returns only bookings this person is a party to.
 */
export function MyActionHistorySheet({ open, onClose, myUserId, actionLabel }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (offset: number) => {
    setLoading(true); setError('')
    try {
      const res = await apiService.getMyActionLogs(PAGE, offset)
      const list: LogRow[] = Array.isArray(res?.data) ? res.data : []
      setRows(prev => (offset === 0 ? list : [...prev, ...list]))
      setMore(list.length === PAGE)
    } catch (err) {
      setError(userMessage(err, 'bookingHistory.failed'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (open) void load(0) }, [open, load])

  return (
    <BottomSheet open={open} title={t('bookingHistory.title')} onClose={onClose}>
      <div className="ot-sheet">
        <p className="ot-muted">{t('bookingHistory.hint')}</p>
        {error && <div className="ot-error" role="alert">{error}</div>}
        {loading && rows.length === 0 && <p role="status">{t('bookingHistory.loading')}</p>}
        {!loading && !error && rows.length === 0 && <p className="ot-muted">{t('bookingHistory.empty')}</p>}
        {rows.length > 0 && (
          <ul className="ot-list">
            {rows.map(log => (
              <li key={log.id}>
                <strong>{actionLabel(log.action)}</strong>
                <div className="ot-muted">
                  {t('bookingHistory.by', { who: log.userId && log.userId === myUserId ? t('bookingHistory.you') : (log.userName?.trim() || t('bookingHistory.otherParty')) })}
                  {' · '}
                  {log.createdAt ? new Date(log.createdAt).toLocaleString(appLocale()) : '-'}
                </div>
                {log.details?.reason && <div className="ot-muted">{t('consultations.actionLog.reason', { reason: log.details.reason })}</div>}
              </li>
            ))}
          </ul>
        )}
        {more && (
          <div className="ot-actions">
            <button type="button" className="module-btn" disabled={loading} onClick={() => load(rows.length)}>{t('bookingHistory.more')}</button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
