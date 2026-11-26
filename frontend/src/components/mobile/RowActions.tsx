import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from './BottomSheet'
import { userMessage } from '../../utils/userMessage'

/**
 * Edit and delete on a list row - ONE set of building blocks for every screen that lists records a team keeps
 * (sensors, shifts, batches, goals, zones ...), so the buttons, the sheets and the wording are identical everywhere.
 *
 *   <RowActions name={s.name} onEdit={() => setEditing(s)} onDelete={() => setDeleting(s)} />
 *   <EditFieldsSheet open title fields initial onSave={values => api.update(id, toPayload(values))} onClose />
 *   <ConfirmDeleteSheet open name what onConfirm={() => api.delete(id)} onClose />
 *
 * Both sheets stay open on a failure and say, in the server's own words (or a translated sentence), what happened and
 * what to do next - never a status code. A delete always asks first and says what will be removed.
 */

interface RowActionsProps {
  /** What the row is called; read out by assistive tech ("Edit Barn sensor"). */
  name: string
  onEdit?: () => void
  onDelete?: () => void
}

export const RowActions: React.FC<RowActionsProps> = ({ name, onEdit, onDelete }) => {
  const { t } = useTranslation()
  if (!onEdit && !onDelete) return null
  return (
    <div className="row-actions">
      {onEdit && (
        <button type="button" className="row-action-btn" onClick={onEdit} aria-label={t('recordActions.editItem', { name })}>
          {t('recordActions.edit')}
        </button>
      )}
      {onDelete && (
        <button type="button" className="row-action-btn is-danger" onClick={onDelete} aria-label={t('recordActions.deleteItem', { name })}>
          {t('recordActions.delete')}
        </button>
      )}
    </div>
  )
}

/** Runs one save/delete with a busy flag and a plain error; the sheet stays open on failure so nothing typed is lost. */
function useSheetAction(open: boolean, failKey: string) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setBusy(false); setError('') } }, [open])
  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    if (busy) return false
    setBusy(true); setError('')
    try {
      await action()
      setBusy(false)
      return true
    } catch (err) {
      setError(userMessage(err, failKey))
      setBusy(false)
      return false
    }
  }, [busy, failKey])
  return { busy, error, run }
}

interface ConfirmDeleteSheetProps {
  open: boolean
  /** The record's name, in the title: "Delete Barn sensor?" */
  name: string
  /** What will be removed, in a sentence a first-time user understands: "The sensor and its readings". */
  what: string
  onConfirm: () => Promise<unknown>
  onClose: () => void
  /** Called after a successful delete (reload the list, show a message). */
  onDone?: () => void
}

export const ConfirmDeleteSheet: React.FC<ConfirmDeleteSheetProps> = ({ open, name, what, onConfirm, onClose, onDone }) => {
  const { t } = useTranslation()
  const { busy, error, run } = useSheetAction(open, 'recordActions.deleteFailed')
  const confirm = async () => {
    if (await run(onConfirm)) { onClose(); onDone?.() }
  }
  return (
    <BottomSheet open={open} title={t('recordActions.confirmTitle', { name })} onClose={busy ? () => {} : onClose}>
      <div className="record-sheet">
        <p className="record-sheet-text">{t('recordActions.willRemove', { what })}</p>
        <p className="record-sheet-text record-sheet-warn">{t('recordActions.cannotUndo')}</p>
        {error && <div className="record-sheet-error" role="alert">{error}</div>}
        <div className="record-sheet-buttons">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('recordActions.keep')}</button>
          <button type="button" className="btn-danger" onClick={confirm} disabled={busy}>
            {busy ? t('recordActions.deleting') : t('recordActions.confirmDelete')}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

export type SheetFieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'checkbox'

export interface SheetField {
  key: string
  label: string
  type: SheetFieldType
  /** For `select`: value + the words shown. */
  options?: Array<{ value: string; label: string }>
  required?: boolean
  step?: string
  /** A short line under the field that says what it is for. */
  hint?: string
}

interface EditFieldsSheetProps {
  open: boolean
  title: string
  fields: SheetField[]
  /** Current values as strings (a checkbox is 'true' / 'false'). The sheet starts from these each time it opens. */
  initial: Record<string, string>
  onSave: (values: Record<string, string>) => Promise<unknown>
  onClose: () => void
  onDone?: () => void
}

/** Which required fields are still empty (pure; the sheet shows one plain sentence instead of the browser's pop-up). */
export function missingRequired(fields: SheetField[], values: Record<string, string>): SheetField[] {
  return fields.filter(f => f.required && f.type !== 'checkbox' && !(values[f.key] ?? '').toString().trim())
}

export const EditFieldsSheet: React.FC<EditFieldsSheetProps> = ({ open, title, fields, initial, onSave, onClose, onDone }) => {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [missing, setMissing] = useState('')
  const { busy, error, run } = useSheetAction(open, 'recordActions.saveFailed')
  useEffect(() => { if (open) { setValues(initial); setMissing('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const gaps = missingRequired(fields, values)
    if (gaps.length) { setMissing(t('recordActions.fillRequired', { fields: gaps.map(g => g.label).join(', ') })); return }
    setMissing('')
    if (await run(() => onSave(values))) { onClose(); onDone?.() }
  }

  return (
    <BottomSheet open={open} title={title} onClose={busy ? () => {} : onClose}>
      <form className="record-sheet" onSubmit={submit} noValidate>
        {fields.map(f => {
          const id = `rs-${f.key}`
          const v = values[f.key] ?? ''
          const set = (nv: string) => setValues(prev => ({ ...prev, [f.key]: nv }))
          if (f.type === 'checkbox') {
            return (
              <label key={f.key} className="record-sheet-check">
                <input id={id} type="checkbox" checked={v === 'true'} onChange={e => set(e.target.checked ? 'true' : 'false')} />
                <span>{f.label}</span>
              </label>
            )
          }
          return (
            <div key={f.key} className="record-sheet-field">
              <label htmlFor={id}>{f.label}{f.required ? ' *' : ''}</label>
              {f.type === 'select' ? (
                <select id={id} value={v} onChange={e => set(e.target.value)}>
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea id={id} rows={3} value={v} onChange={e => set(e.target.value)} />
              ) : (
                <input id={id} type={f.type} step={f.type === 'number' ? (f.step || 'any') : undefined}
                  inputMode={f.type === 'number' ? 'decimal' : undefined} value={v} onChange={e => set(e.target.value)} />
              )}
              {f.hint && <small className="record-sheet-hint">{f.hint}</small>}
            </div>
          )
        })}
        {missing && <div className="record-sheet-error" role="alert">{missing}</div>}
        {error && <div className="record-sheet-error" role="alert">{error}</div>}
        <div className="record-sheet-buttons">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>{t('recordActions.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('recordActions.saving') : t('recordActions.save')}</button>
        </div>
      </form>
    </BottomSheet>
  )
}

/** A number typed in a sheet to what the server takes: '' means "leave it empty" (null) when `emptyIsNull`, else undefined. */
export function numOrUndefined(v: string | undefined, emptyIsNull = false): number | null | undefined {
  const s = (v ?? '').trim()
  if (!s) return emptyIsNull ? null : undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Text to what the server takes: '' stays '' so a cleared note is cleared. */
export function textOrEmpty(v: string | undefined): string {
  return (v ?? '').trim()
}

/** Text to what the server takes for a column that cannot hold '' (a date): empty means "clear it" (null). */
export function textOrNull(v: string | undefined): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}
