import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './OfflineBanner.css'

/**
 * One notice for every role and screen: the phone has lost its connection. What is on screen may be old, and anything the person
 * enters may not reach the server until the connection is back (farm records are kept on the phone and sent later). It clears itself
 * the moment the connection returns. role="status" so a screen reader announces it without stealing focus.
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      <strong>{t('offline.title')}</strong> {t('offline.body')}
    </div>
  )
}
