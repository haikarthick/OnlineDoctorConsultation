import React from 'react'
import { useTranslation } from 'react-i18next'
import { Animal } from '../../types'
import { Enterprise, AnimalGroup } from './bookConsultationShared'
import EnterpriseAnimalSelector from './EnterpriseAnimalSelector'

const CERT_PURPOSES = ['health_certificate','fitness_to_travel','rabies_vaccination','vaccination_record','pre_travel','sterilization','treatment','animal_injury','post_mortem','breeding_soundness','pregnancy_diagnosis','infertility_evaluation','fitness_for_sale','animal_valuation']

interface PrefilledContext { animalName?: string; groupName?: string; enterpriseName?: string }

interface Step3DetailsProps {
  prefilledContext: PrefilledContext | null
  isFarmer: boolean
  isAdmin: boolean
  selectionMode: 'individual' | 'enterprise'
  onSelectionModeChange: (mode: 'individual' | 'enterprise') => void
  enterprises: Enterprise[]
  selectedEnterprise: string
  selectedEnterpriseName: string
  onEnterpriseChange: (enterpriseId: string) => void
  groups: AnimalGroup[]
  selectedGroup: string
  selectedGroupName: string
  onGroupChange: (groupId: string) => void
  loadingEnterpriseData: boolean
  filteredEnterpriseAnimals: Animal[]
  animals: Animal[]
  selectedAnimal: string
  onSelectedAnimalChange: (animalId: string) => void
  selectedAnimalObj: Animal | undefined
  onNavigate: (path: string) => void
  speciesLabel: (species: string, t: any) => string
  certPurpose: string
  onCertPurposeChange: (purpose: string) => void
  reasonForVisit: string
  onReasonForVisitChange: (reason: string) => void
  step3Error: string
  onClearStep3Error: () => void
  symptoms: string
  onSymptomsChange: (symptoms: string) => void
  priority: string
  onPriorityChange: (priority: string) => void
  notes: string
  onNotesChange: (notes: string) => void
  onBack: () => void
  onContinue: () => void
}

const Step3Details: React.FC<Step3DetailsProps> = (props) => {
  const { t } = useTranslation()
  const {
    prefilledContext, isFarmer, isAdmin, selectionMode, onSelectionModeChange,
    enterprises, selectedEnterprise, selectedEnterpriseName, onEnterpriseChange,
    groups, selectedGroup, selectedGroupName, onGroupChange, loadingEnterpriseData,
    filteredEnterpriseAnimals, animals, selectedAnimal, onSelectedAnimalChange, selectedAnimalObj,
    onNavigate, speciesLabel, certPurpose, onCertPurposeChange, reasonForVisit,
    onReasonForVisitChange, step3Error, onClearStep3Error, symptoms, onSymptomsChange,
    priority, onPriorityChange, notes, onNotesChange, onBack, onContinue
  } = props

  return (
    <div>
      <h2 className="si-7e63ec4f">{t('bookConsultation.consultationDetails')}</h2>

      {prefilledContext && (
        <div className="si-a028abe6">
          <strong>ℹ️ Pre-selected:</strong>{' '}
          {prefilledContext.animalName && <span>Animal: <strong>{prefilledContext.animalName}</strong></span>}
          {prefilledContext.enterpriseName && <span>Enterprise: <strong>{prefilledContext.enterpriseName}</strong></span>}
          {prefilledContext.groupName && <span> → Group: <strong>{prefilledContext.groupName}</strong></span>}
          <span className="si-824a7a1e">
            (You can change the selection below if needed)
          </span>
        </div>
      )}

      {(isFarmer || isAdmin) && (
        <div className="card si-7e63ec4f">
          <div className="card-body si-5792103e">
            <label className="form-label si-dab75309">{t('bookConsultation.bookingFor')}</label>
            <div className="si-d223efb3">
              <button
                type="button"
                className={`bc-mode-btn variant-individual${selectionMode === 'individual' ? ' is-selected' : ''}`}
                onClick={() => onSelectionModeChange('individual')}
              >
                🐾 {t('bookConsultation.individualPet')}
              </button>
              <button
                type="button"
                className={`bc-mode-btn variant-enterprise${selectionMode === 'enterprise' ? ' is-selected' : ''}`}
                onClick={() => onSelectionModeChange('enterprise')}
              >
                🏢 {t('bookConsultation.farmEnterprise')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">

          {selectionMode === 'enterprise' && (isFarmer || isAdmin) && (
            <EnterpriseAnimalSelector
              enterprises={enterprises}
              selectedEnterprise={selectedEnterprise}
              selectedEnterpriseName={selectedEnterpriseName}
              onEnterpriseChange={onEnterpriseChange}
              groups={groups}
              selectedGroup={selectedGroup}
              selectedGroupName={selectedGroupName}
              onGroupChange={onGroupChange}
              loadingEnterpriseData={loadingEnterpriseData}
              filteredEnterpriseAnimals={filteredEnterpriseAnimals}
              selectedAnimal={selectedAnimal}
              onSelectedAnimalChange={onSelectedAnimalChange}
              selectedAnimalObj={selectedAnimalObj}
              onNavigate={onNavigate}
              speciesLabel={speciesLabel}
            />
          )}

          {selectionMode === 'individual' && (
            <div className="form-group">
              <label className="form-label">{t('bookConsultation.selectYourPet')}</label>
              {animals.length === 0 ? (
                <div className="si-db6c70c7">
                  <div>
                    <strong className="si-852e3180">🐾 {t('bookConsultation.noPetsRegistered')}</strong>
                    <p className="si-1118237b">{t('bookConsultation.noPetsHint')}</p>
                  </div>
                  <button
                    type="button"
                    className="module-btn primary si-7a2c0aef"
                    onClick={() => onNavigate('/animals')}
                  >
                    + {t('bookConsultation.addPet')}
                  </button>
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedAnimal}
                  onChange={(e) => onSelectedAnimalChange(e.target.value)}
                >
                  <option value="">-- {t('bookConsultation.selectPetOptional')} --</option>
                  {animals.map(a => (
                    <option key={a.id} value={a.id}>{a.name} - {speciesLabel(a.species, t)}{a.breed ? ` / ${a.breed}` : ''}{a.uniqueId ? ` [${a.uniqueId}]` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Certificate Purpose (optional)</label>
            <select
              className="form-input"
              value={certPurpose}
              onChange={e => onCertPurposeChange(e.target.value)}
            >
              <option value="">Regular Consultation</option>
              {CERT_PURPOSES.map(ct => (
                <option key={ct} value={ct}>{ct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('bookConsultation.reasonForVisit')}</label>
            <input
              type="text"
              className={`form-input${step3Error && reasonForVisit.trim().length < 3 ? ' input-error' : ''}`}
              placeholder={t('bookConsultation.reasonPlaceholder')}
              value={reasonForVisit}
              onChange={(e) => {
                onReasonForVisitChange(e.target.value)
                if (step3Error) onClearStep3Error()
              }}
            />
            {step3Error && (
              <p className="si-4bdfd452">
                ⚠ {step3Error}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('bookConsultation.symptoms')}</label>
            <textarea
              className="form-textarea"
              placeholder={t('bookConsultation.symptomsPlaceholder')}
              value={symptoms}
              onChange={(e) => onSymptomsChange(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('bookConsultation.priority')}</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => onPriorityChange(e.target.value)}
              >
                <option value="low">{t('bookConsultation.priorityLow')}</option>
                <option value="normal">{t('bookConsultation.priorityNormal')}</option>
                <option value="high">{t('bookConsultation.priorityHigh')}</option>
                <option value="emergency">🚨 {t('bookConsultation.priorityEmergency')}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('bookConsultation.additionalNotes')}</label>
            <textarea
              className="form-textarea"
              placeholder={t('bookConsultation.notesPlaceholder')}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="si-2595c296">
        <button className="btn btn-outline" onClick={onBack}>{t('bookConsultation.back')}</button>
        <button
          className="btn btn-primary btn-lg"
          disabled={!reasonForVisit.trim()}
          onClick={onContinue}
        >
          {t('bookConsultation.reviewBooking')}
        </button>
      </div>
    </div>
  )
}

export default Step3Details
