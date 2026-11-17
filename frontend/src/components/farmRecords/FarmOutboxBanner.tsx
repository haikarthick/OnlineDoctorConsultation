import React from 'react'
import { useTranslation } from 'react-i18next'
import type { OutboxItem } from '../../utils/farmOutbox'

/**
 * "2 entries waiting to send" - what was saved on this phone with no signal, and what happened to it. An entry
 * the server refused stays here with the reason in words and can be sent again or discarded; nothing is hidden
 * and nothing is dropped silently.
 */
export const FarmOutboxBanner: React.FC<{
  items: OutboxItem[]
  waiting: number
  onSendNow: () => void
  onDiscard: (id: string) => void
  onRetry: (id: string) => void
}> = ({ items, waiting, onSendNow, onDiscard, onRetry }) => {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <section className="farm-outbox" aria-label={t('farmRecords.outbox.title')}>
      {waiting > 0 && (
        <div className="farm-outbox-head" role="status">
          <span>📤 {t('farmRecords.outbox.waiting', { count: waiting })}</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onSendNow}>{t('farmRecords.outbox.sendNow')}</button>
        </div>
      )}
      {waiting > 0 && <p className="farm-outbox-hint">{t('farmRecords.outbox.hint')}</p>}
      <ul className="farm-outbox-list">
        {items.map(i => (
          <li key={i.id} className={`farm-outbox-item ${i.error ? 'is-refused' : ''}`}>
            <span className="farm-outbox-label">{i.label}</span>
            {i.error && <span className="farm-outbox-error" role="alert">{t('farmRecords.outbox.refused', { reason: i.error })}</span>}
            <span className="farm-outbox-actions">
              {i.error && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onRetry(i.id)}>{t('farmRecords.outbox.retry')}</button>}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => onDiscard(i.id)}>{t('farmRecords.outbox.discard')}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
