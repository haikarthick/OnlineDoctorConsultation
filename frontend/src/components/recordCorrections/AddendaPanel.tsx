import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { BottomSheet } from '../mobile/BottomSheet'
import { correctionError } from './correctionMessage'
import './RecordCorrections.css'

interface Addendum { id: string; note: string; authorName?: string | null; createdAt: string }

interface Props {
  recordId: string
  fmtDate: (d: string) => string
}

/** A record row's "Corrections" button that opens the panel under it (the animal's Records tab lists many records on one page). */
export function CorrectionsToggle({ recordId, fmtDate }: Props) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div>
      <button type="button" className="module-btn small" aria-expanded={shown} onClick={() => setShown(v => !v)}>{t('recordCorrections.addendaTitle')}</button>
      {shown && <AddendaPanel recordId={recordId} fmtDate={fmtDate} />}
    </div>
  )
}

/**
 * The corrections on ONE saved medical record. A saved record is never edited in place (owner decision 2026-11-25): a correction is a
 * new dated note under it, with the name of the person who wrote it. The same panel is used for every role; the server decides who may
 * add a note and refuses anyone else in plain words.
 */
export function AddendaPanel({ recordId, fmtDate }: Props) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<Addendum[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiService.listRecordAddenda(recordId)
      setNotes(Array.isArray(res?.data) ? res.data : [])
    } catch (e) {
      setMessage({ text: correctionError(e), ok: false })
    } finally {
      setLoading(false)
    }
  }, [recordId])
  useEffect(() => { setLoading(true); load() }, [load])

  const save = async () => {
    if (busy || text.trim().length < 3) return
    setBusy(true); setMessage(null)
    try {
      await apiService.addRecordAddendum(recordId, text.trim())
      setText(''); setOpen(false)
      setMessage({ text: t('recordCorrections.addendumSaved'), ok: true })
      await load()
    } catch (e) {
      setMessage({ text: correctionError(e), ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rc-panel">
      <h4>{t('recordCorrections.addendaTitle')}</h4>
      <p className="rc-hint">{t('recordCorrections.addendaHint')}</p>
      {message && <div className={message.ok ? 'rc-ok' : 'rc-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}
      {!loading && notes.length === 0 && <p className="rc-hint">{t('recordCorrections.addendaEmpty')}</p>}
      {notes.length > 0 && (
        <ul className="rc-list">
          {notes.map(n => (
            <li key={n.id} className="rc-note">
              <p>{n.note}</p>
              <small>{t('recordCorrections.writtenBy', { name: n.authorName || t('recordCorrections.unknownAuthor'), date: fmtDate(n.createdAt) })}</small>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" className="module-btn" onClick={() => { setMessage(null); setOpen(true) }}>{t('recordCorrections.addCorrection')}</button>
      </div>
      <BottomSheet open={open} title={t('recordCorrections.addCorrection')} onClose={() => setOpen(false)}>
        <div className="rc-sheet">
          <p className="rc-hint">{t('recordCorrections.addendaHint')}</p>
          <label>{t('recordCorrections.addendumLabel')}
            <textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder={t('recordCorrections.addendumPlaceholder')} />
          </label>
          <div className="rc-actions">
            <button type="button" className="module-btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="button" className="module-btn primary" disabled={busy || text.trim().length < 3} onClick={save}>
              {busy ? t('recordCorrections.saving') : t('recordCorrections.saveCorrection')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
