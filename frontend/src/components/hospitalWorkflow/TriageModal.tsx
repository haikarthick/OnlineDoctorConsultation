import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { TRIAGE_LEVELS } from './hospitalWorkflowShared'

interface TriageForm {
  triageLevel: number
  triageNotes: string
}

interface TriageModalProps {
  triageTarget: any
  setTriageTarget: Dispatch<SetStateAction<any>>
  triageForm: TriageForm
  setTriageForm: Dispatch<SetStateAction<TriageForm>>
  handleTriage: () => void
  t: TFunction
}

export default function TriageModal({ triageTarget, setTriageTarget, triageForm, setTriageForm, handleTriage, t }: TriageModalProps) {
  if (!triageTarget) return null

  return (
    <div onClick={e => { if (e.target === e.currentTarget) setTriageTarget(null) }}
      className="si-6d1caf37">
      <div className="si-37f24010">
        {/* Header */}
        <div className="si-fe2d5bfb">
          <div>
            <h3 className="si-3fe3cab8">🏥 Triage - #{triageTarget.queue_number} {triageTarget.animal_name}</h3>
            <div className="si-aff656fd">Select severity level - priority is derived automatically</div>
          </div>
          <button onClick={() => setTriageTarget(null)} className="si-034e37c2">✕</button>
        </div>

        <div className="si-7a28b1a9">
          {/* Unified triage level selector - number + label + color all in one */}
          <div>
            <label className="si-1cac7fac">
              {t('hospitalWorkflow.triageLevel')} <span className="si-f84f41a5">*</span>
            </label>
            <div className="si-85143a6f">
              {([1, 2, 3, 4, 5] as const).map(n => {
                const tl = TRIAGE_LEVELS[n]
                const isSelected = triageForm.triageLevel === n
                return (
                  <button key={n} onClick={() => setTriageForm(f => ({ ...f, triageLevel: n }))}
                    className={`hw-triage-option lvl-${n} ${isSelected ? 'is-selected' : ''}`}>
                    <span className="hw-triage-num">{n}</span>
                    <span className="hw-triage-label">{tl.icon} {tl.label}</span>
                    <span className="hw-triage-desc">{tl.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Derived priority badge - confirmation that priority auto-matches level */}
          {(() => {
            const n = triageForm.triageLevel
            const tl = TRIAGE_LEVELS[n]
            return (
              <div className={`hw-triage-derived lvl-${n}`}>
                <span className="hw-triage-derived-label">Priority assigned automatically:</span>
                <span className="hw-triage-derived-value">{tl.priority}</span>
              </div>
            )
          })()}

          {/* Notes */}
          <div>
            <label className="si-2561596d">
              {t('hospitalWorkflow.triageNotesPlaceholder')} <span className="si-17788c1c">(optional)</span>
            </label>
            <textarea placeholder="Observed symptoms, vital signs, reason for triage level..." value={triageForm.triageNotes} onChange={e => setTriageForm(f => ({ ...f, triageNotes: e.target.value }))} rows={3} className="si-0523a7a3" />
          </div>

          <div className="si-cfc4497e">
            <button onClick={() => setTriageTarget(null)} className="si-db673962">{t('hospitalWorkflow.cancel')}</button>
            <button onClick={handleTriage} className="si-afdd074e">{t('hospitalWorkflow.saveTriage')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
