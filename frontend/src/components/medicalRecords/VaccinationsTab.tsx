import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, RecordItemProps } from './medicalRecordsShared'

interface Props {
  t: TFunction
  isVet: boolean
  isAdmin: boolean
  isFarmer: boolean
  selectedAnimal: string
  vaccinations: any[]
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
  openVaccinationModal: () => void
}

const VaccinationsTab: React.FC<Props> = ({ t, isVet, isAdmin, isFarmer, selectedAnimal, vaccinations, recordItemProps, fmtDate, openVaccinationModal }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="💉" title={t('medicalRecords.vaccinationsTab.selectPet')} subtitle={t('medicalRecords.selectPetGenericSub')} />
    ) : (
      <>
        {(isVet || isAdmin || isFarmer) && (
          <div className="si-bab8e8bc">
            <button className="btn-primary si-f1d94d5d"
              onClick={openVaccinationModal}>
              {t('medicalRecords.vaccinationsTab.addButton')}
            </button>
          </div>
        )}
        {vaccinations.length === 0 ? (
          <EmptyState icon="💉" title={t('medicalRecords.vaccinationsTab.emptyTitle')} subtitle={t('medicalRecords.vaccinationsTab.emptySubtitle')} />
        ) : (
          <div className="records-list">
            {vaccinations.map((v: any) => {
              const isOverdue = v.nextDueDate && new Date(v.nextDueDate) < new Date()
              const itemProps = recordItemProps(v.id)
              return (
                <div key={v.id} {...itemProps} className={`${itemProps.className} mr-vax-card${isOverdue ? ' is-overdue' : ''}`}>
                  <div className="record-icon">💉</div>
                  <div className="record-details">
                    <h4>{v.vaccineName} {v.vaccineType ? `(${v.vaccineType})` : ''}</h4>
                    <p>{t('medicalRecords.vaccinationsTab.administered')} {fmtDate(v.dateAdministered)} {v.administeredByName ? `by ${v.administeredByName}` : ''}</p>
                    {v.dosage && <p className="text-muted">{t('medicalRecords.vaccinationsTab.dosage')} {v.dosage}</p>}
                    {v.batchNumber && <p className="text-muted">{t('medicalRecords.vaccinationsTab.batch')} {v.batchNumber} {v.manufacturer ? `| ${v.manufacturer}` : ''}</p>}
                    {v.nextDueDate && <p className="text-muted">{t('medicalRecords.vaccinationsTab.nextDue')} <strong className={`mr-vax-due-text${isOverdue ? ' is-overdue' : ''}`}>{fmtDate(v.nextDueDate)}{isOverdue ? ` ${t('medicalRecords.vaccinationsTab.overdue')}` : ''}</strong></p>}
                    {v.certificateNumber && <p className="text-muted">{t('medicalRecords.vaccinationsTab.certificate')} {v.certificateNumber}</p>}
                    {v.reactionNotes && <p className="text-muted">{t('medicalRecords.vaccinationsTab.reaction')} {v.reactionNotes}</p>}
                  </div>
                  <div className="record-actions">
                    <span className={`badge ${v.isValid ? 'badge-completed' : 'badge-cancelled'}`}>{v.isValid ? t('medicalRecords.vaccinationsTab.valid') : t('medicalRecords.vaccinationsTab.invalid')}</span>
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

export default VaccinationsTab
