import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { userMessage } from '../../utils/userMessage'
import { appLocale } from '../../utils/appLocale'
import { pickField } from '../../utils/recordForm'

interface Props {
  open: boolean
  batchId: string | null
  onClose: () => void
}

/**
 * "Where has this batch been?" - the chain of custody of one product batch: every recorded step, who recorded it,
 * and whether someone verified it. Read-only; opened from the batch list on the Supply Chain screen.
 */
export const BatchTraceSheet: React.FC<Props> = ({ open, batchId, onClose }) => {
  const { t } = useTranslation()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !batchId) return
    let active = true
    setLoading(true); setError(''); setData(null)
    apiService.getBatchTraceability(batchId)
      .then((res: any) => { if (active) setData(res?.data || null) })
      .catch((err: unknown) => { if (active) setError(userMessage(err, 'recordActions.supplyChain.traceFailed')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, batchId])

  const steps: any[] = data?.chainOfCustody || []
  return (
    <BottomSheet open={open} title={t('recordActions.supplyChain.traceTitle', { batch: pickField(data?.batch, 'batchNumber') || '' })} onClose={onClose}>
      <div className="record-sheet">
        {loading && <p className="record-sheet-text" role="status">{t('recordActions.loading')}</p>}
        {error && <div className="record-sheet-error" role="alert">{error}</div>}
        {data && !error && (
          <>
            <p className="record-sheet-text">
              {t('recordActions.supplyChain.traceSummary', { steps: data.totalEvents ?? steps.length, verified: data.verificationCount ?? 0 })}
            </p>
            {steps.length === 0 ? (
              <p className="record-sheet-text">{t('recordActions.supplyChain.traceEmpty')}</p>
            ) : (
              <ol className="trace-list">
                {steps.map((ev, i) => (
                  <li key={ev.id || i} className="trace-step">
                    <strong>{ev.title}</strong>
                    <span className="trace-meta">
                      {String(pickField(ev, 'eventType') || '').replace(/_/g, ' ')}
                      {pickField(ev, 'eventDate') ? ` · ${new Date(pickField(ev, 'eventDate')).toLocaleDateString(appLocale())}` : ''}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </span>
                    <span className="trace-meta">
                      {pickField(ev, 'recordedByName') ? t('recordActions.supplyChain.recordedBy', { name: pickField(ev, 'recordedByName') }) : ''}
                      {' '}
                      {pickField(ev, 'verifiedBy') ? t('recordActions.supplyChain.verified') : t('recordActions.supplyChain.unverified')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <div className="record-sheet-buttons">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recordActions.close')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}
