import React from 'react'
import { TFunction } from 'i18next'
import { RECORD_TYPES, SEVERITY_OPTIONS, ModalField, ModalActions } from './medicalRecordsShared'

interface Props {
  t: TFunction
  showModal: string | null
  modalData: any
  setModalData: (d: any) => void
  modalError: string
  setModalError: (e: string) => void
  saving: boolean
  closeModal: () => void
  handleSaveRecord: () => void
  handleSaveVaccination: () => void
  handleSaveWeight: () => void
  handleSaveAllergy: () => void
  handleSaveLabResult: () => void
  vaccineProtocols: any[]
  loadingProtocols: boolean
  handleProtocolSelect: (protocolId: string) => void
  selectedAnimalData: any
  speciesLabel: (species: string, t: TFunction) => string
}

const RecordModals: React.FC<Props> = ({
  t, showModal, modalData, setModalData, modalError, setModalError, saving, closeModal,
  handleSaveRecord, handleSaveVaccination, handleSaveWeight, handleSaveAllergy, handleSaveLabResult,
  vaccineProtocols, loadingProtocols, handleProtocolSelect, selectedAnimalData, speciesLabel,
}) => {
  if (!showModal) return null
  return (
    <div className="si-6e1f69a1" onClick={closeModal}>
      <div className="si-34a7f42e" onClick={(e) => e.stopPropagation()}>
        {modalError && (
          <div className="si-5b1231f8">
            <span>⚠ {modalError}</span>
            <button onClick={() => setModalError('')} className="si-9b665e15">✕</button>
          </div>
        )}

        {/* Medical Record Modal */}
        {showModal === 'record' && (
          <>
            <h2 className="si-fdff7499">{t('medicalRecords.modals.newRecord')}</h2>
            <ModalField label={t('medicalRecords.modals.recordType')}>
              <select value={modalData.recordType || ''} onChange={(e) => setModalData({ ...modalData, recordType: e.target.value })} className="mr-field">
                {RECORD_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.icon} {t(`medicalRecords.recordTypes.${rt.value === 'lab_report' ? 'labReport' : rt.value === 'follow_up' ? 'followUp' : rt.value}`)}</option>)}
              </select>
            </ModalField>
            <ModalField label={t('medicalRecords.modals.title')}><input value={modalData.title || ''} onChange={(e) => setModalData({ ...modalData, title: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.recordTitlePlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.content')}><textarea value={modalData.content || ''} onChange={(e) => setModalData({ ...modalData, content: e.target.value })} className="mr-field mr-field--h100" placeholder={t('medicalRecords.modals.contentPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.severity')}>
              <select value={modalData.severity || 'normal'} onChange={(e) => setModalData({ ...modalData, severity: e.target.value })} className="mr-field">
                {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(`medicalRecords.severityLevels.${s.value}`)}</option>)}
              </select>
            </ModalField>
            <ModalField label={t('medicalRecords.modals.followUpDate')}>
              <input type="date" value={modalData.followUpDate || ''} onChange={(e) => setModalData({ ...modalData, followUpDate: e.target.value })} className="mr-field" />
            </ModalField>
            <ModalActions onCancel={closeModal} onSave={handleSaveRecord} saving={saving}
              disabled={!modalData.recordType || !modalData.title || !modalData.content} />
          </>
        )}

        {/* Vaccination Modal */}
        {showModal === 'vaccination' && (
          <>
            <h2 className="si-2fda8813">{t('medicalRecords.modals.addVaccination')}</h2>
            {selectedAnimalData && (
              <p className="si-3a80c844">
                {selectedAnimalData.name} &bull; {speciesLabel(selectedAnimalData.species, t)}{selectedAnimalData.breed ? ` / ${selectedAnimalData.breed}` : ''}
              </p>
            )}

            {/* Protocol Selector - primary integration point */}
            <ModalField label={t('medicalRecords.modals.selectProtocol')}>
              {loadingProtocols ? (
                <div className="si-2bffca72">{t('common.loading')}</div>
              ) : vaccineProtocols.length > 0 ? (
                <select
                  value={modalData.protocolId || ''}
                  onChange={(e) => handleProtocolSelect(e.target.value)}
                  className="mr-field"
                >
                  <option value="">{t('medicalRecords.modals.selectProtocolPlaceholder')}</option>
                  {vaccineProtocols.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} &mdash; {p.vaccineCategory?.replace('_', ' ')} ({p.disease})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="si-54168195">{t('medicalRecords.modals.noProtocolsForSpecies')}</p>
              )}
            </ModalField>

            <div className="si-b35a790c">
              <ModalField label={t('medicalRecords.modals.vaccineName')}><input value={modalData.vaccineName || ''} onChange={(e) => setModalData({ ...modalData, vaccineName: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.vaccineNamePlaceholder')} /></ModalField>
              <ModalField label={t('medicalRecords.modals.vaccineType')}><input value={modalData.vaccineType || ''} onChange={(e) => setModalData({ ...modalData, vaccineType: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.vaccineTypePlaceholder')} /></ModalField>
              <ModalField label={t('medicalRecords.modals.dateAdministered')}><input type="date" value={modalData.dateAdministered || ''} onChange={(e) => setModalData({ ...modalData, dateAdministered: e.target.value })} className="mr-field" /></ModalField>
              <ModalField label={t('medicalRecords.modals.nextDueDate')}><input type="date" value={modalData.nextDueDate || ''} onChange={(e) => setModalData({ ...modalData, nextDueDate: e.target.value })} className="mr-field" /></ModalField>
              <ModalField label={t('medicalRecords.modals.dosage')}><input value={modalData.dosage || ''} onChange={(e) => setModalData({ ...modalData, dosage: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.dosagePlaceholder')} /></ModalField>
              <ModalField label={t('medicalRecords.modals.batchNumber')}><input value={modalData.batchNumber || ''} onChange={(e) => setModalData({ ...modalData, batchNumber: e.target.value })} className="mr-field" /></ModalField>
              <ModalField label={t('medicalRecords.modals.manufacturer')}><input value={modalData.manufacturer || ''} onChange={(e) => setModalData({ ...modalData, manufacturer: e.target.value })} className="mr-field" /></ModalField>
              <ModalField label={t('medicalRecords.modals.certificateNumber')}><input value={modalData.certificateNumber || ''} onChange={(e) => setModalData({ ...modalData, certificateNumber: e.target.value })} className="mr-field" /></ModalField>
              <ModalField label={t('medicalRecords.modals.reactionNotes')}><textarea value={modalData.reactionNotes || ''} onChange={(e) => setModalData({ ...modalData, reactionNotes: e.target.value })} className="mr-field mr-field--h60" placeholder={t('medicalRecords.modals.reactionPlaceholder')} /></ModalField>
            </div>

            <ModalActions onCancel={closeModal} onSave={handleSaveVaccination} saving={saving}
              disabled={!modalData.vaccineName || !modalData.dateAdministered} />
          </>
        )}

        {/* Weight Modal */}
        {showModal === 'weight' && (
          <>
            <h2 className="si-fdff7499">{t('medicalRecords.modals.recordWeight')}</h2>
            <ModalField label={t('medicalRecords.modals.weightValue')}><input type="number" step="0.01" value={modalData.weight || ''} onChange={(e) => setModalData({ ...modalData, weight: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.weightPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.unit')}>
              <select value={modalData.unit || 'kg'} onChange={(e) => setModalData({ ...modalData, unit: e.target.value })} className="mr-field">
                <option value="kg">kg</option><option value="lbs">lbs</option><option value="g">g</option>
              </select>
            </ModalField>
            <ModalField label={t('medicalRecords.modals.notes')}><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} className="mr-field mr-field--h60" placeholder={t('medicalRecords.modals.notesPlaceholder')} /></ModalField>
            <ModalActions onCancel={closeModal} onSave={handleSaveWeight} saving={saving}
              disabled={!modalData.weight} />
          </>
        )}

        {/* Allergy Modal */}
        {showModal === 'allergy' && (
          <>
            <h2 className="si-fdff7499">{t('medicalRecords.modals.reportAllergy')}</h2>
            <ModalField label={t('medicalRecords.modals.allergen')}><input value={modalData.allergen || ''} onChange={(e) => setModalData({ ...modalData, allergen: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.allergenPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.reaction')}><textarea value={modalData.reaction || ''} onChange={(e) => setModalData({ ...modalData, reaction: e.target.value })} className="mr-field mr-field--h60" placeholder={t('medicalRecords.modals.reactionDescPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.severity')}>
              <select value={modalData.severity || 'mild'} onChange={(e) => setModalData({ ...modalData, severity: e.target.value })} className="mr-field">
                <option value="mild">{t('medicalRecords.modals.allergyMild')}</option><option value="moderate">{t('medicalRecords.modals.allergyModerate')}</option><option value="severe">{t('medicalRecords.modals.allergySevere')}</option>
              </select>
            </ModalField>
            <ModalField label={t('medicalRecords.modals.dateIdentified')}><input type="date" value={modalData.identifiedDate || ''} onChange={(e) => setModalData({ ...modalData, identifiedDate: e.target.value })} className="mr-field" /></ModalField>
            <ModalField label={t('medicalRecords.modals.notes')}><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} className="mr-field mr-field--h60" /></ModalField>
            <ModalActions onCancel={closeModal} onSave={handleSaveAllergy} saving={saving}
              disabled={!modalData.allergen} />
          </>
        )}

        {/* Lab Result Modal */}
        {showModal === 'lab_result' && (
          <>
            <h2 className="si-fdff7499">{t('medicalRecords.modals.addLabResult')}</h2>
            <ModalField label={t('medicalRecords.modals.testName')}><input value={modalData.testName || ''} onChange={(e) => setModalData({ ...modalData, testName: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.testNamePlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.testCategory')}><input value={modalData.testCategory || ''} onChange={(e) => setModalData({ ...modalData, testCategory: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.testCategoryPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.testDate')}><input type="date" value={modalData.testDate || ''} onChange={(e) => setModalData({ ...modalData, testDate: e.target.value })} className="mr-field" /></ModalField>
            <ModalField label={t('medicalRecords.modals.resultValue')}><input value={modalData.resultValue || ''} onChange={(e) => setModalData({ ...modalData, resultValue: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.resultPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.normalRange')}><input value={modalData.normalRange || ''} onChange={(e) => setModalData({ ...modalData, normalRange: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.normalRangePlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.unit')}><input value={modalData.unit || ''} onChange={(e) => setModalData({ ...modalData, unit: e.target.value })} className="mr-field" placeholder={t('medicalRecords.modals.unitPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.status')}>
              <select value={modalData.status || 'pending'} onChange={(e) => setModalData({ ...modalData, status: e.target.value })} className="mr-field">
                <option value="pending">{t('medicalRecords.modals.statusPending')}</option><option value="in_progress">{t('medicalRecords.modals.statusInProgress')}</option><option value="completed">{t('medicalRecords.modals.statusCompleted')}</option>
              </select>
            </ModalField>
            <ModalField label={t('medicalRecords.modals.labName')}><input value={modalData.labName || ''} onChange={(e) => setModalData({ ...modalData, labName: e.target.value })} className="mr-field" /></ModalField>
            <ModalField label={t('medicalRecords.modals.abnormalLabel')}>
              <label className="si-bab2d193">
                <input type="checkbox" checked={modalData.isAbnormal || false} onChange={(e) => setModalData({ ...modalData, isAbnormal: e.target.checked })} />
                {t('medicalRecords.modals.abnormalLabel')}
              </label>
            </ModalField>
            <ModalField label={t('medicalRecords.modals.interpretation')}><textarea value={modalData.interpretation || ''} onChange={(e) => setModalData({ ...modalData, interpretation: e.target.value })} className="mr-field mr-field--h60" placeholder={t('medicalRecords.modals.interpretationPlaceholder')} /></ModalField>
            <ModalField label={t('medicalRecords.modals.notes')}><textarea value={modalData.notes || ''} onChange={(e) => setModalData({ ...modalData, notes: e.target.value })} className="mr-field mr-field--h60" /></ModalField>
            <ModalActions onCancel={closeModal} onSave={handleSaveLabResult} saving={saving}
              disabled={!modalData.testName || !modalData.testDate} />
          </>
        )}
      </div>
    </div>
  )
}

export default RecordModals
