import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { codedMessage } from '../../utils/codedMessage'
import { formatQuantity, type FarmRecord } from './recordShared'
import '../mobile/ownerTools.css'

interface Props {
  record: FarmRecord | null
  /** "Milk", "Feed" ... in the person's language, and the subject ("Cow Lakshmi", "Flock A") the entry belongs to. */
  label: string
  subjectName?: string
  onClose: () => void
  onDeleted: () => void
}

/**
 * Delete a wrong entry from Daily records. It says exactly which entry, asks once, and tells the truth about the side effect: a feed entry
 * puts the stock it used back (the server does that in the same step). The server refuses anyone who is not the person who wrote the
 * entry or the farm's owner or manager, and that refusal is shown in plain words, never as a code.
 */
export function DeleteRecordSheet({ record, label, subjectName, onClose, onDeleted }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    if (!record || busy) return
    setBusy(true); setError('')
    try {
      await apiService.deleteFarmRecord(record.id)
      onDeleted()
    } catch (err) {
      setError(codedMessage(err, 'deleteRecord', 'deleteRecord.failed'))
    } finally { setBusy(false) }
  }

  const amount = record && record.quantity !== null ? `${formatQuantity(record.quantity)}${record.unit ? ` ${record.unit}` : ''}` : ''
  return (
    <BottomSheet open={!!record} title={t('deleteRecord.title')} onClose={onClose}>
      {record && (
        <div className="ot-sheet">
          <div className="ot-card">
            <strong>{[label, amount].filter(Boolean).join(' ')}</strong>
            <span className="ot-muted">{[subjectName, record.recordDate].filter(Boolean).join(' · ')}</span>
          </div>
          <p>{t('deleteRecord.confirm')}</p>
          {record.feedId && <p className="ot-note">{t('deleteRecord.stockBack')}</p>}
          {error && <div className="ot-error" role="alert">{error}</div>}
          <div className="ot-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy} onClick={remove}>{t('deleteRecord.delete')}</button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
