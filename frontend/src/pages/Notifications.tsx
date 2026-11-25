import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiService } from '../services/api'
import { userMessage } from '../utils/userMessage'
import { appLocale } from '../utils/appLocale'
import { AppNotification, dayKey, notificationBody, notificationTarget, notificationTitle } from '../utils/notificationView'
import { NOTIFICATIONS_CHANGED } from '../components/notifications/NotificationBell'
import './Notifications.css'

const PAGE = 30

/** The one list of everything the app told this person, the same for every role. Tap = mark read and open what it is about. */
export default function Notifications() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)

  const load = useCallback(async (offset: number) => {
    try {
      const res = await apiService.listNotifications({ limit: PAGE, offset, unreadOnly: onlyUnread })
      const d = res?.data || {}
      const list: AppNotification[] = Array.isArray(d.notifications) ? d.notifications : []
      setItems(prev => (offset === 0 ? list : [...prev, ...list]))
      setTotal(Number(d.total) || 0)
      setUnread(Number(d.unreadCount) || 0)
      setError('')
    } catch (e) {
      setError(userMessage(e, 'notifications.loadFailed'))
    } finally {
      setLoading(false)
      setMore(false)
    }
  }, [onlyUnread])

  useEffect(() => { setLoading(true); void load(0) }, [load])

  const announce = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))

  const open = async (n: AppNotification) => {
    if (!n.isRead) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, isRead: true } : x)))
      setUnread(u => Math.max(0, u - 1))
      try { await apiService.markNotificationRead(n.id); announce() } catch { /* the next refresh shows the true state */ }
    }
    const target = notificationTarget(n)
    if (target) navigate(target)
  }

  const markAll = async () => {
    try {
      await apiService.markAllNotificationsRead()
      setItems(prev => prev.map(x => ({ ...x, isRead: true })))
      setUnread(0)
      announce()
    } catch (e) {
      setError(userMessage(e, 'notifications.markFailed'))
    }
  }

  const heading = (key: string) => {
    if (key === 'today') return t('notifications.today')
    if (key === 'yesterday') return t('notifications.yesterday')
    if (key === 'earlier') return t('notifications.earlier')
    return new Date(key + 'T00:00:00').toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const groups: Array<{ key: string; rows: AppNotification[] }> = []
  for (const n of items) {
    const key = dayKey(n.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.rows.push(n)
    else groups.push({ key, rows: [n] })
  }

  return (
    <div className="notifications-page">
      <div className="page-header">
        <div>
          <h1>{t('notifications.title')}</h1>
          <p>{unread > 0 ? t('notifications.unreadCount', { count: unread }) : t('notifications.allRead')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn-secondary" aria-pressed={onlyUnread} onClick={() => setOnlyUnread(v => !v)}>
            {onlyUnread ? t('notifications.showAll') : t('notifications.showUnread')}
          </button>
          <button type="button" className="btn-primary" disabled={unread === 0} onClick={markAll}>{t('notifications.markAllRead')}</button>
        </div>
      </div>

      {error && <div className="notifications-error" role="alert">{error} <button type="button" className="link-button" onClick={() => { setLoading(true); void load(0) }}>{t('notifications.retry')}</button></div>}
      {loading && <p role="status">{t('notifications.loading')}</p>}
      {!loading && !error && items.length === 0 && (
        <div className="notifications-empty">
          <strong>{onlyUnread ? t('notifications.noneUnread') : t('notifications.none')}</strong>
          <span>{t('notifications.noneHint')}</span>
        </div>
      )}

      {groups.map(g => (
        <section key={g.key} className="notifications-day" aria-label={heading(g.key)}>
          <h2>{heading(g.key)}</h2>
          <ul>
            {g.rows.map(n => (
              <li key={n.id}>
                <button type="button" className={`notification-row${n.isRead ? '' : ' notification-row-unread'}`} onClick={() => open(n)}>
                  <span className="notification-dot" aria-hidden="true" />
                  <span className="notification-text">
                    <span className="notification-title">{notificationTitle(n)}</span>
                    <span className="notification-body">{notificationBody(n)}</span>
                    <span className="notification-time">{new Date(n.createdAt).toLocaleTimeString(appLocale(), { hour: 'numeric', minute: '2-digit' })}{n.isRead ? '' : ` · ${t('notifications.new')}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!loading && items.length < total && !error && (
        <button type="button" className="btn-secondary" disabled={more} onClick={() => { setMore(true); void load(items.length) }}>{t('notifications.loadMore')}</button>
      )}
    </div>
  )
}
