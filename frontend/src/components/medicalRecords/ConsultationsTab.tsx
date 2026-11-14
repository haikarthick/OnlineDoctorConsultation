import React from 'react'
import { TFunction } from 'i18next'
import { EmptyState, RecordItemProps } from './medicalRecordsShared'

interface Props {
  t: TFunction
  selectedAnimal: string
  consultations: any[]
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
}

const ConsultationsTab: React.FC<Props> = ({ t, selectedAnimal, consultations, recordItemProps, fmtDate }) => (
  <div>
    {!selectedAnimal ? (
      <EmptyState icon="🩺" title={t('medicalRecords.consultationsTab.selectPet')} subtitle={t('medicalRecords.consultationsTab.selectPetSubtitle')} />
    ) : consultations.length === 0 ? (
      <EmptyState icon="🩺" title={t('medicalRecords.consultationsTab.emptyTitle')} subtitle={t('medicalRecords.consultationsTab.emptySubtitle')} />
    ) : (
      <div className="records-list">
        {consultations.map((c: any) => {
          const statusKeys = ['completed', 'in_progress', 'scheduled', 'cancelled', 'missed']
          const statusClass = statusKeys.includes(c.status) ? `status-${c.status}` : 'status-default'
          const itemProps = recordItemProps(c.id)
          return (
            <div key={c.id} {...itemProps} className={`${itemProps.className} mr-consult-card ${statusClass}`}>
              <div className="record-icon">🩺</div>
              <div className="record-details">
                <h4>
                  {t('medicalRecords.consultationsTab.consultWith', { name: c.veterinarianName || t('medicalRecords.consultationsTab.unknown') })}
                  {c.prescriptionCount > 0 && <span className="si-2d5f7558">💊 {t('medicalRecords.consultationsTab.prescriptionCount', { count: c.prescriptionCount })}</span>}
                </h4>
                {c.diagnosis && <p><strong>{t('medicalRecords.consultationsTab.diagnosis')}</strong> {c.diagnosis}</p>}
                {c.notes && <p className="text-muted">📝 {(c.notes || '').substring(0, 150)}{(c.notes || '').length > 150 ? '...' : ''}</p>}
                <p className="text-muted">
                  {t('medicalRecords.consultationsTab.date')} {fmtDate(c.startTime || c.createdAt)}
                  {c.ownerName && ` • ${t('medicalRecords.consultationsTab.owner')} ${c.ownerName}`}
                  {c.followUpDate && ` • ${t('medicalRecords.consultationsTab.followUp')} ${fmtDate(c.followUpDate)}`}
                </p>
              </div>
              <div className="record-actions">
                <span className={`badge badge-${c.status === 'completed' ? 'completed' : c.status === 'cancelled' ? 'cancelled' : 'pending'}`}>{t(c.status === 'in_progress' ? 'common.inProgress' : `common.${c.status}`)}</span>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

export default ConsultationsTab
