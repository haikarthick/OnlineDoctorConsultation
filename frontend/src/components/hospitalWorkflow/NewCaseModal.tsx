import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import AnimalSearchPicker from '../AnimalSearchPicker'
import { PRIORITIES } from './hospitalWorkflowShared'

interface CaseForm {
  chiefComplaint: string
  priority: string
  animalId: string
  ownerId: string
}

interface NewCaseModalProps {
  showNewCase: boolean
  setShowNewCase: Dispatch<SetStateAction<boolean>>
  caseAnimal: any
  setCaseAnimal: Dispatch<SetStateAction<any>>
  caseForm: CaseForm
  setCaseForm: Dispatch<SetStateAction<CaseForm>>
  handleCreateCase: () => void
  hospitalId: string
  t: TFunction
}

export default function NewCaseModal({ showNewCase, setShowNewCase, caseAnimal, setCaseAnimal, caseForm, setCaseForm, handleCreateCase, hospitalId, t }: NewCaseModalProps) {
  if (!showNewCase) return null

  return (
    <div className="si-db8248e9">
      <div className="si-7f17206a">
        <h3 className="si-33c1a83e">🔄 {t('hospitalWorkflow.newClinicalCase')}</h3>
        <div className="si-d8480906">
          <AnimalSearchPicker selectedAnimal={caseAnimal} onSelect={setCaseAnimal} hospitalId={hospitalId || undefined} />
          <div>
            <label className="si-1d2216db">{t('hospitalWorkflow.chiefComplaint')}</label>
            <textarea placeholder={t('hospitalWorkflow.chiefComplaintPlaceholder')} value={caseForm.chiefComplaint} onChange={e => setCaseForm(f => ({ ...f, chiefComplaint: e.target.value }))} rows={2} className="si-dc3839a2" />
          </div>
          <div>
            <label className="si-1d2216db">{t('hospitalWorkflow.priority')}</label>
            <div className="si-9f20fe5e">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => setCaseForm(f => ({ ...f, priority: p }))}
                  className={`hw-priority-pill pri-${p} ${caseForm.priority === p ? 'is-selected' : ''}`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="si-8d13495b">
            <button onClick={() => { setShowNewCase(false); setCaseAnimal(null) }} className="si-978a1643">{t('hospitalWorkflow.cancel')}</button>
            <button onClick={handleCreateCase} disabled={!caseAnimal} className="hw-create-case-btn">{t('hospitalWorkflow.createCase')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
