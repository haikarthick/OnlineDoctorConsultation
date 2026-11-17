import React from 'react'
import { useTranslation } from 'react-i18next'

export interface FormStep {
  id: string
  /** Short title shown above the step, e.g. "Milk and breeding". */
  title: string
  content: React.ReactNode
  /** Why the user cannot go on yet, in plain words ("Choose an animal first"). Empty = can go on. */
  blockedReason?: string
}

interface StepFormProps {
  steps: FormStep[]
  /** Index of the step being shown. The parent owns it so Back never loses what was typed. */
  current: number
  onStepChange: (index: number) => void
  /** Called from the last step's primary button. */
  onSubmit: () => void
  submitLabel: string
  /** Disable the primary button while a save is running. */
  busy?: boolean
  /** Anything to show just above the buttons - usually <SaveState>. */
  footer?: React.ReactNode
  onCancel?: () => void
  /**
   * Editing a record: the person usually wants to change ONE thing, not walk every step. When set,
   * a "save now" button is offered on every step before the last (it runs the same submit).
   */
  saveNowLabel?: string
}

/**
 * A form split into short steps - one topic per screen, progress always visible, the primary
 * button fixed at the bottom within thumb reach. Steps are data, so adding, removing or
 * reordering one is an edit to the array the caller passes, not a layout change. All field
 * state stays in the parent: going Back shows what was already entered.
 */
export const StepForm: React.FC<StepFormProps> = ({ steps, current, onStepChange, onSubmit, submitLabel, busy, footer, onCancel, saveNowLabel }) => {
  const { t } = useTranslation()
  const index = Math.min(Math.max(current, 0), steps.length - 1)
  const step = steps[index]
  const isLast = index === steps.length - 1
  const blocked = !!step.blockedReason

  return (
    <form className="step-form" onSubmit={e => { e.preventDefault(); if (blocked || busy) return; if (isLast) onSubmit(); else onStepChange(index + 1) }} noValidate>
      {steps.length > 1 && (
        <div className="step-form-progress">
          <span className="step-form-count">{t('mobileUi.step.stepOf', { current: index + 1, total: steps.length })}</span>
          <div className="step-form-bar" aria-hidden="true">
            {steps.map((s, i) => <span key={s.id} className={`step-form-pip ${i <= index ? 'is-done' : ''}`} />)}
          </div>
        </div>
      )}
      <h2 className="step-form-title">{step.title}</h2>
      <div className="step-form-body">{step.content}</div>
      <div className="step-form-footer">
        {footer}
        {blocked && <p className="step-form-blocked" role="status">{step.blockedReason}</p>}
        {saveNowLabel && !isLast && (
          <button type="button" className="step-form-save-now" onClick={() => { if (!blocked && !busy) onSubmit() }} disabled={busy || steps.slice(0, index + 1).some(s => !!s.blockedReason)}>
            {saveNowLabel}
          </button>
        )}
        <div className="step-form-actions">
          {index > 0
            ? <button type="button" className="step-form-back" onClick={() => onStepChange(index - 1)} disabled={busy}>{t('mobileUi.step.back')}</button>
            : onCancel && <button type="button" className="step-form-back" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>}
          <button type="submit" className="step-form-next" disabled={blocked || busy}>
            {isLast ? submitLabel : t('mobileUi.step.next')}
          </button>
        </div>
      </div>
    </form>
  )
}
