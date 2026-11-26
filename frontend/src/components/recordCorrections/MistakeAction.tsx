import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { correctionError } from './correctionMessage'
import './RecordCorrections.css'

export type MistakeKind = 'vaccination' | 'allergy'

interface Props {
  kind: MistakeKind
  id: string
  /** Called after the server saved the mark, so the list reloads. `reopened` is how many scheduled doses are due again. */
  onDone: (reopened: number) => void
}

/**
 * "Entered by mistake" for one vaccination or allergy entry: a confirm sheet that asks for the reason, then the server marks the entry
 * (who, when, why are kept). The entry is never deleted or overwritten. Same button on every screen and for every role; the server
 * says in plain words when the person is not allowed.
 */
export function MistakeAction({ kind, id, onDone }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    if (busy || reason.trim().length < 3) return
    setBusy(true); setError('')
    try {
      const res = kind === 'vaccination' ? await apiService.markVaccinationMistake(id, reason.trim()) : await apiService.markAllergyMistake(id, reason.trim())
      setOpen(false); setReason('')
      onDone(Number(res?.data?.reopenedDoses) || 0)
    } catch (e) {
      setError(correctionError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="module-btn small" onClick={e => { e.stopPropagation(); setError(''); setOpen(true) }}>{t('recordCorrections.mistakeButton')}</button>
      <BottomSheet open={open} title={t('recordCorrections.mistakeTitle')} onClose={() => setOpen(false)}>
        <div className="rc-sheet">
          <p className="rc-hint">{t(kind === 'vaccination' ? 'recordCorrections.mistakeExplainVaccination' : 'recordCorrections.mistakeExplainAllergy')}</p>
          {error && <div className="rc-error" role="alert">{error}</div>}
          <label>{t('recordCorrections.reasonLabel')}
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder={t('recordCorrections.reasonPlaceholder')} />
          </label>
          <div className="rc-actions">
            <button type="button" className="module-btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy || reason.trim().length < 3} onClick={confirm}>
              {busy ? t('recordCorrections.saving') : t('recordCorrections.confirmMistake')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}

/** The mark an entry carries once it was entered by mistake: a badge, and who/why on the line below. */
export function MistakeBadge({ entry }: { entry: { enteredByMistakeAt?: string | null; enteredByMistakeByName?: string | null; enteredByMistakeReason?: string | null } }) {
  const { t } = useTranslation()
  if (!entry.enteredByMistakeAt) return null
  return (
    <>
      <span className="rc-badge">{t('recordCorrections.mistakeBadge')}</span>
      <p className="rc-mistake-detail">{t('recordCorrections.mistakeDetail', { name: entry.enteredByMistakeByName || t('recordCorrections.unknownAuthor'), reason: entry.enteredByMistakeReason || '-' })}</p>
    </>
  )
}
