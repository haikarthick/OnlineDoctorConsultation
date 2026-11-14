import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import AnimalSearchPicker from '../AnimalSearchPicker'
import { PRIORITIES } from './hospitalWorkflowShared'
import WalkInRegisterForm, { type WalkInForm } from './WalkInRegisterForm'

interface CheckInForm {
  reason: string
  priority: string
  animalId: string
  ownerId: string
}

interface CheckInModalProps {
  checkInMode: 'search' | 'register'
  setCheckInMode: Dispatch<SetStateAction<'search' | 'register'>>
  checkInAnimal: any
  setCheckInAnimal: Dispatch<SetStateAction<any>>
  checkInError: string
  setCheckInError: Dispatch<SetStateAction<string>>
  checkInForm: CheckInForm
  setCheckInForm: Dispatch<SetStateAction<CheckInForm>>
  checkInSubmitting: boolean
  handleCheckIn: () => void
  closeCheckInModal: () => void
  openRegisterMode: () => void
  hospitalId: string
  t: TFunction
  walkInForm: WalkInForm
  setWalkInForm: Dispatch<SetStateAction<WalkInForm>>
  walkInPhotoPreview: string
  setWalkInPhotoFile: Dispatch<SetStateAction<File | null>>
  setWalkInPhotoPreview: Dispatch<SetStateAction<string>>
  walkInError: string
  setWalkInError: Dispatch<SetStateAction<string>>
  walkInRegistering: boolean
  walkInFormValid: boolean
  handleWalkInRegister: () => void
  speciesCategories: any[]
  breedsForSpecies: (species: string) => string[]
  breedLabel: (species: string, breed: string) => string
  classTermsForSpecies: (species: string) => any[]
  findClassTerm: (species: string, value: string) => any
  earTagSpecies: string[]
  speciesLabel: (species: string, t: TFunction) => string
  resolveLabel: (term: any, t: TFunction) => string
}

export default function CheckInModal(props: CheckInModalProps) {
  const {
    checkInMode, setCheckInMode, checkInAnimal, setCheckInAnimal, checkInError, setCheckInError,
    checkInForm, setCheckInForm, checkInSubmitting, handleCheckIn, closeCheckInModal, openRegisterMode,
    hospitalId, t, walkInError, setWalkInError,
  } = props

  return (
    <div onClick={e => { if (e.target === e.currentTarget) closeCheckInModal() }}
      className="si-6d1caf37">
      <div className="si-57f9eac3">
        <div className="si-fe2d5bfb">
          <div>
            <h3 className="si-3fe3cab8">🏥 {t('hospitalWorkflow.checkInPatient')}</h3>
            {checkInMode === 'register' && (
              <div className="si-f199afd6">{t('hospitalWorkflow.walkIn.subtitle')}</div>
            )}
          </div>
          <button onClick={closeCheckInModal} className="si-034e37c2">✕</button>
        </div>

        {checkInError && (
          <div className="si-86aee441">
            ⚠️ {checkInError}
          </div>
        )}

        {checkInMode === 'search' ? (
          <div className="si-7a28b1a9">
            <div>
              <AnimalSearchPicker
                selectedAnimal={checkInAnimal}
                onSelect={a => { setCheckInAnimal(a); setCheckInError('') }}
                label={`🔍 ${t('hospitalWorkflow.searchPatient')} *`}
                onRegisterNew={openRegisterMode}
                hospitalId={hospitalId || undefined}
              />
              {!checkInAnimal && (
                <div className="si-80df77c2">
                  ⚠️ <strong>{t('hospitalWorkflow.walkIn.searchRequired')}</strong>
                </div>
              )}
            </div>
            {!checkInAnimal && (
              <div className="si-20547c1e">
                <span className="si-db3602ae">{t('hospitalWorkflow.walkIn.or')} </span>
                <button onClick={openRegisterMode}
                  className="si-fa312d0d">
                  ➕ {t('hospitalWorkflow.walkIn.registerNew')}
                </button>
              </div>
            )}
            <div>
              <label className="si-2561596d">{t('hospitalWorkflow.reasonForVisit')} <span className="si-17788c1c">(optional)</span></label>
              <input placeholder="e.g., Vaccination, Limping, Skin rash..." value={checkInForm.reason} onChange={e => setCheckInForm(f => ({ ...f, reason: e.target.value }))} className="si-d0e0df59" />
            </div>
            <div>
              <label className="si-1e22ae90">{t('hospitalWorkflow.priority')} <span className="si-17788c1c">(optional)</span></label>
              <div className="si-9f20fe5e">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => setCheckInForm(f => ({ ...f, priority: p }))}
                    className={`hw-priority-pill pri-${p} ${checkInForm.priority === p ? 'is-selected' : ''}`}>{p}</button>
                ))}
              </div>
            </div>
            <div className="si-db3602ae"><span className="si-f84f41a5">*</span> Required field</div>
            <div className="si-81c39146">
              <button onClick={closeCheckInModal} className="si-db673962">{t('hospitalWorkflow.cancel')}</button>
              <button onClick={handleCheckIn} disabled={!checkInAnimal || checkInSubmitting}
                className="hw-checkin-submit">
                {checkInSubmitting ? `⏳ ${t('hospitalWorkflow.checkingIn')}` : `✅ ${t('hospitalWorkflow.checkIn')}`}
              </button>
            </div>
          </div>
        ) : (
          <WalkInRegisterForm
            walkInForm={props.walkInForm}
            setWalkInForm={props.setWalkInForm}
            walkInPhotoPreview={props.walkInPhotoPreview}
            setWalkInPhotoFile={props.setWalkInPhotoFile}
            setWalkInPhotoPreview={props.setWalkInPhotoPreview}
            walkInError={walkInError}
            walkInRegistering={props.walkInRegistering}
            walkInFormValid={props.walkInFormValid}
            handleWalkInRegister={props.handleWalkInRegister}
            onBackToSearch={() => { setCheckInMode('search'); setWalkInError('') }}
            speciesCategories={props.speciesCategories}
            breedsForSpecies={props.breedsForSpecies}
            breedLabel={props.breedLabel}
            classTermsForSpecies={props.classTermsForSpecies}
            findClassTerm={props.findClassTerm}
            earTagSpecies={props.earTagSpecies}
            speciesLabel={props.speciesLabel}
            resolveLabel={props.resolveLabel}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
