import React from 'react'
import { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { EmptyState, RecordItemProps } from './medicalRecordsShared'

interface Props {
  t: TFunction
  isVet: boolean
  isAdmin: boolean
  selectedAnimal: string
  prescriptions: any[]
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
}

const PrescriptionsTab: React.FC<Props> = ({ t, isVet, isAdmin, selectedAnimal, prescriptions, recordItemProps, fmtDate }) => {
  const navigate = useNavigate()
  return (
  <div>
    {(isVet || isAdmin) && selectedAnimal && (
      <div className="si-bab8e8bc">
        <button className="btn-primary si-f1d94d5d"
          onClick={() => navigate(`/doctor/prescriptions/new?animalId=${selectedAnimal}`)}>
          💊 {t('medicalRecords.prescriptionsTab.addButton')}
        </button>
      </div>
    )}
    {prescriptions.length === 0 ? (
      <EmptyState icon="💊" title={t('medicalRecords.prescriptionsTab.emptyTitle')} subtitle={selectedAnimal ? t('medicalRecords.prescriptionsTab.emptySubtitle') : t('medicalRecords.prescriptionsTab.emptySubtitle')} />
    ) : (
      <div className="records-list">
        {prescriptions.map((rx: any) => (
          <div key={rx.id} {...recordItemProps(rx.id)} className="si-c9335004">
            <div className="record-icon">💊</div>
            <div className="record-details">
              <h4>{Array.isArray(rx.medications) ? rx.medications.map((m: any) => m.name).join(', ') : t('medicalRecords.prescriptionsTab.medication')}</h4>
              {Array.isArray(rx.medications) && rx.medications.map((med: any, mi: number) => (
                <p key={mi}><strong>{med.name}</strong>{med.dosage ? ` - ${med.dosage}` : ''}{med.frequency ? `, ${med.frequency}` : ''}{med.duration ? ` for ${med.duration}` : ''}</p>
              ))}
              {rx.diagnosis && <p className="si-76a355c2"><strong>{t('medicalRecords.prescriptionsTab.diagnosis')}</strong> {rx.diagnosis}</p>}
              {rx.instructions && <p className="text-muted">📝 {rx.instructions}</p>}
              <p className="text-muted">
                {rx.veterinarianName && `👨‍⚕️ Dr. ${rx.veterinarianName} • `}
                {t('medicalRecords.prescriptionsTab.prescribed')} {fmtDate(rx.createdAt || rx.created_at || '')} • {t('medicalRecords.prescriptionsTab.validUntil')} {fmtDate(rx.validUntil || rx.valid_until || '')}
              </p>
            </div>
              {rx.isNetworkCoordinated && (
                <p className="text-muted">
                  💊 {rx.pharmacyName || t('medicalRecords.prescriptionsTab.networkPharmacy')}
                  {rx.dispensingStatus
                    ? ` - ${t('medicalRecords.prescriptionsTab.dispensedOn', { date: fmtDate(rx.dispensedAt || '') })}`
                    : ` - ${t(`medicalRecords.prescriptionsTab.reviewStatus.${rx.reviewStatus}`, rx.reviewStatus || '')}`}
                </p>
              )}
            <div className="record-actions">
              <span className="badge badge-completed">{rx.isActive || rx.is_active ? t('medicalRecords.prescriptionsTab.active') : t('medicalRecords.prescriptionsTab.expired')}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
  )
}

export default PrescriptionsTab
