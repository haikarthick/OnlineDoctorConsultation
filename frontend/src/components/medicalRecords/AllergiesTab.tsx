import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, RecordItemProps } from './medicalRecordsShared'
import { MistakeAction, MistakeBadge } from '../recordCorrections/MistakeAction'

interface Props {
  t: TFunction
  selectedAnimal: string
  allergies: any[]
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
  setShowModal: (m: string | null) => void
  setModalData: (d: any) => void
  /** Reload after an entry was marked as entered by mistake. */
  onChanged: () => void
}

const AllergiesTab: React.FC<Props> = ({ t, selectedAnimal, allergies, recordItemProps, fmtDate, setShowModal, setModalData, onChanged }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="⚠️" title={t('medicalRecords.allergiesTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
    ) : (
      <>
        <div className="si-bab8e8bc">
          <button className="btn-primary si-f1d94d5d"
            onClick={() => { setShowModal('allergy'); setModalData({ severity: 'mild' }) }}>
            {t('medicalRecords.allergiesTab.addButton')}
          </button>
        </div>
        {allergies.length === 0 ? (
          <EmptyState icon="✅" title={t('medicalRecords.allergiesTab.emptyTitle')} subtitle={t('medicalRecords.allergiesTab.emptySubtitle')} />
        ) : (
          <div className="records-list">
            {allergies.map((al: any) => {
              const sevClass = al.severity === 'severe' ? 'sev-severe' : al.severity === 'moderate' ? 'sev-moderate' : 'sev-mild'
              const itemProps = recordItemProps(al.id)
              return (
                <div key={al.id} {...itemProps} className={`${itemProps.className} mr-allergy-card ${sevClass}${al.enteredByMistakeAt ? ' rc-struck' : ''}`}>
                  <div className="record-icon">⚠️</div>
                  <div className="record-details">
                    <h4>{al.allergen}</h4>
                    <MistakeBadge entry={al} />
                    {al.reaction && <p>{t('medicalRecords.allergiesTab.reaction')} {al.reaction}</p>}
                    <p className="text-muted">
                      {t('medicalRecords.allergiesTab.severity')} <strong className={`mr-allergy-sev-text ${sevClass}`}>{al.severity}</strong>
                      {al.identifiedDate ? ` | ${t('medicalRecords.allergiesTab.identified')} ${fmtDate(al.identifiedDate)}` : ''}
                      {al.reportedByName ? ` | ${t('medicalRecords.allergiesTab.reportedBy')} ${al.reportedByName}` : ''}
                    </p>
                    {al.notes && <p className="text-muted">📝 {al.notes}</p>}
                  </div>
                  <div className="record-actions">
                    {!al.enteredByMistakeAt && <span className={`badge ${al.isActive ? 'badge-cancelled' : 'badge-completed'}`}>{al.isActive ? t('medicalRecords.allergiesTab.active') : t('medicalRecords.allergiesTab.resolved')}</span>}
                    {!al.enteredByMistakeAt && <MistakeAction kind="allergy" id={al.id} onDone={onChanged} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    )}
  </div>
)

export default AllergiesTab
