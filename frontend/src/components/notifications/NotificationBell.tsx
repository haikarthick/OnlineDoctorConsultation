import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiService } from '../../services/api'
import './NotificationBell.css'

/** Fired by the inbox when something is read, so the bell count follows at once. */
export const NOTIFICATIONS_CHANGED = 'notifications-changed'

const REFRESH_MS = 60_000

/** The bell every signed-in person sees, in every role: the count of unread notifications and the way into the inbox. */
export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await apiService.listNotifications({ limit: 1, offset: 0, unreadOnly: true })
      setUnread(Number(res?.data?.unreadCount) || 0)
    } catch { /* the count simply stays as it was; the inbox explains a failure in words */ }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void refresh() }, REFRESH_MS)
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    window.addEventListener('online', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener(NOTIFICATIONS_CHANGED, refresh); window.removeEventListener('online', refresh) }
  }, [refresh])

  const label = unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')
  return (
    <button type="button" className="notification-bell" aria-label={label} title={label} onClick={() => navigate('/notifications')}>
      <span aria-hidden="true">🔔</span>
      {unread > 0 && <span className="notification-bell-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
  )
}
