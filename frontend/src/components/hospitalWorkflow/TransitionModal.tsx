import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { STAGE_ICONS } from './hospitalWorkflowShared'

interface TransitionModalProps {
  transTarget: any
  setTransTarget: Dispatch<SetStateAction<any>>
  transStage: string
  transNotes: string
  setTransNotes: Dispatch<SetStateAction<string>>
  handleTransition: () => void
  t: TFunction
}

export default function TransitionModal({ transTarget, setTransTarget, transStage, transNotes, setTransNotes, handleTransition, t }: TransitionModalProps) {
  if (!transTarget) return null

  return (
    <div className="si-1c4649c0">
      <div className="si-dc0fea35">
        <h3 className="si-33c1a83e">{t('hospitalWorkflow.moveTo')} {STAGE_ICONS[transStage]} {transStage}</h3>
        <textarea placeholder={t('hospitalWorkflow.notesOptional')} value={transNotes} onChange={e => setTransNotes(e.target.value)} rows={3} className="si-2a364628" />
        <div className="si-f0412db6">
          <button onClick={() => setTransTarget(null)} className="si-978a1643">{t('hospitalWorkflow.cancel')}</button>
          <button onClick={handleTransition} className="si-880bdf60">{t('hospitalWorkflow.confirm')}</button>
        </div>
      </div>
    </div>
  )
}
