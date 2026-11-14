import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import AnimalSearchPicker from '../AnimalSearchPicker'
import VetSearchPicker from '../VetSearchPicker'
import { PRIORITIES } from './hospitalWorkflowShared'

interface ReferralForm {
  reason: string
  specialtyNeeded: string
  priority: string
  clinicalNotes: string
}

interface NewReferralModalProps {
  showNewReferral: boolean
  setShowNewReferral: Dispatch<SetStateAction<boolean>>
  selectedToVet: any
  setSelectedToVet: Dispatch<SetStateAction<any>>
  referralAnimal: any
  setReferralAnimal: Dispatch<SetStateAction<any>>
  referralForm: ReferralForm
  setReferralForm: Dispatch<SetStateAction<ReferralForm>>
  referralError: string
  setReferralError: Dispatch<SetStateAction<string>>
  referralSubmitting: boolean
  handleCreateReferral: () => void
  hospitalId: string
  t: TFunction
}

export default function NewReferralModal({
  showNewReferral, setShowNewReferral, selectedToVet, setSelectedToVet, referralAnimal, setReferralAnimal,
  referralForm, setReferralForm, referralError, setReferralError, referralSubmitting, handleCreateReferral,
  hospitalId, t,
}: NewReferralModalProps) {
  if (!showNewReferral) return null

  const close = () => { setShowNewReferral(false); setSelectedToVet(null); setReferralAnimal(null); setReferralError('') }

  return (
    <div className="si-db8248e9" onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="si-b011d727">
        <button onClick={close} className="si-9142cad1">✕</button>
        <h3 className="si-f522c581">🔀 {t('hospitalWorkflow.newSpecialistReferral')}</h3>

        {referralError && (
          <div className="si-ebc0428a">
            ⚠️ {referralError}
          </div>
        )}

        <div className="si-d8480906">
          {/* Vet Search - required */}
          <VetSearchPicker selectedVet={selectedToVet} onSelect={setSelectedToVet} required />
          {!selectedToVet && (
            <p className="si-7bdf7b77">
              ⚠️ Required: Search and select a veterinarian to enable submission
            </p>
          )}

          {/* Patient - optional */}
          <AnimalSearchPicker selectedAnimal={referralAnimal} onSelect={setReferralAnimal} label="🔍 Patient (optional)" hospitalId={hospitalId || undefined} />

          {/* Reason - required */}
          <div>
            <label className="si-1d2216db">
              {t('hospitalWorkflow.reasonForReferral')} <span className="si-f84f41a5">*</span>
            </label>
            <input
              placeholder="e.g., Complex orthopedic case requiring specialist evaluation"
              value={referralForm.reason}
              onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))}
              className={`hw-referral-reason-input ${!referralForm.reason.trim() ? 'is-invalid' : ''}`}
            />
            {!referralForm.reason.trim() && (
              <p className="si-c4e6ca6a">
                ⚠️ Required: Provide a reason for the referral
              </p>
            )}
          </div>

          {/* Specialty - optional */}
          <div>
            <label className="si-1d2216db">
              {t('hospitalWorkflow.specialtyNeeded')} <span className="si-fe954780">(optional)</span>
            </label>
            <input
              placeholder="e.g., Cardiology, Orthopedics, Surgery"
              value={referralForm.specialtyNeeded}
              onChange={e => setReferralForm(f => ({ ...f, specialtyNeeded: e.target.value }))}
              className="si-0c92c61f"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="si-1d2216db">
              {t('hospitalWorkflow.priority')} <span className="si-f84f41a5">*</span>
            </label>
            <select
              value={referralForm.priority}
              onChange={e => setReferralForm(f => ({ ...f, priority: e.target.value }))}
              className="si-0c92c61f"
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>

          {/* Clinical Notes - optional */}
          <div>
            <label className="si-1d2216db">
              {t('hospitalWorkflow.clinicalNotes')} <span className="si-fe954780">(optional)</span>
            </label>
            <textarea
              placeholder={t('hospitalWorkflow.clinicalNotesPlaceholder')}
              value={referralForm.clinicalNotes}
              onChange={e => setReferralForm(f => ({ ...f, clinicalNotes: e.target.value }))}
              rows={3}
              className="si-dc3839a2"
            />
          </div>

          <p className="si-ada3b9d6">
            <span className="si-f84f41a5">*</span> Required field
          </p>

          <div className="si-8d13495b">
            <button onClick={close} className="si-978a1643">{t('hospitalWorkflow.cancel')}</button>
            <button
              onClick={handleCreateReferral}
              disabled={!selectedToVet || !referralForm.reason.trim() || referralSubmitting}
              className="hw-referral-submit-btn"
            >
              {referralSubmitting ? '⏳ Creating...' : t('hospitalWorkflow.createReferral')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
