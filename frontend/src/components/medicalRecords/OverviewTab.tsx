import React from 'react'
import { TFunction } from 'i18next'
import { StatCard, QuickBtn, RecordItemProps } from './medicalRecordsShared'

interface Props {
  t: TFunction
  stats: any
  isVet: boolean
  isAdmin: boolean
  isFarmer: boolean
  selectedAnimal: string
  prescriptions: any[]
  prescriptionsTotal: number
  recordItemProps: RecordItemProps
  fmtDate: (d: string) => string
  openVaccinationModal: () => void
  setShowModal: (m: string | null) => void
  setModalData: (d: any) => void
  setRecordTypeFilter: (f: string) => void
  setActiveTab: (t: any) => void
  loadMedRecords: (typeFilter?: string) => void
}

const OverviewTab: React.FC<Props> = ({
  t, stats, isVet, isAdmin, isFarmer, selectedAnimal, prescriptions, prescriptionsTotal,
  recordItemProps, fmtDate, openVaccinationModal, setShowModal, setModalData,
  setRecordTypeFilter, setActiveTab, loadMedRecords,
}) => (
  <div>
    {/* Stats Cards */}
    {stats && (
      <div className="si-e03859be">
        <StatCard icon="🩺" label={t('medicalRecords.overview.stats.consultations')} value={stats.consultations?.total || 0}
          sub={stats.consultations?.completed ? `${stats.consultations.completed} ${t('medicalRecords.overview.completed')}` : ''} color="#667eea" />
        <StatCard icon="💊" label={t('medicalRecords.overview.stats.prescriptions')} value={stats.prescriptions?.total || 0}
          sub={stats.prescriptions?.active ? `${stats.prescriptions.active} ${t('medicalRecords.overview.active')}` : ''} color="#059669" />
        <StatCard icon="💉" label={t('medicalRecords.overview.stats.vaccinations')} value={stats.vaccinations?.total || 0}
          sub={stats.vaccinations?.upcomingDue ? `${stats.vaccinations.upcomingDue} ${t('medicalRecords.overview.dueSoon')}` : ''} color="#7c3aed" />
        <StatCard icon="🔬" label={t('medicalRecords.overview.stats.labResults')} value={stats.labResults?.total || 0}
          sub={stats.labResults?.pending ? `${stats.labResults.pending} ${t('medicalRecords.overview.pending')}` : ''} color="#d97706" />
        <StatCard icon="⚠️" label={t('medicalRecords.overview.stats.activeAllergies')} value={stats.allergies?.active || 0} color="#dc2626" />
        <StatCard icon="📋" label={t('medicalRecords.overview.stats.medicalRecords')} value={stats.totalRecords || 0} color="#6b7280"
          onClick={stats.totalRecords ? () => { setRecordTypeFilter(''); setActiveTab('records'); loadMedRecords('') } : undefined} />
        <StatCard icon="📅" label={t('medicalRecords.overview.stats.followUps')} value={stats.upcomingFollowUps || 0} color="#ea580c"
          onClick={stats.upcomingFollowUps ? () => { setRecordTypeFilter('follow_up'); setActiveTab('records'); loadMedRecords('follow_up') } : undefined} />
      </div>
    )}

    {/* Quick Actions */}
    {(isVet || isAdmin || isFarmer) && selectedAnimal && (
      <div className="si-af65fe13">
        <h3 className="si-d0d40338">{t('medicalRecords.overview.quickActions')}</h3>
        <div className="si-b9eb5ec7">
          <QuickBtn label={t('medicalRecords.overview.addVaccination')} onClick={openVaccinationModal} />
          <QuickBtn label={t('medicalRecords.overview.addWeight')} onClick={() => { setShowModal('weight'); setModalData({ unit: 'kg' }) }} />
          <QuickBtn label={t('medicalRecords.overview.addAllergy')} onClick={() => { setShowModal('allergy'); setModalData({ severity: 'mild' }) }} />
          <QuickBtn label={t('medicalRecords.overview.addLabResult')} onClick={() => { setShowModal('lab_result'); setModalData({ status: 'pending' }) }} />
        </div>
      </div>
    )}

    {/* Recent Activity preview */}
    {prescriptions.length > 0 && (
      <div className="si-af65fe13">
        <h3 className="si-d0d40338">{t('medicalRecords.overview.recentPrescriptions')}</h3>
        <div className="records-list">
          {prescriptions.slice(0, 5).map((rx: any) => (
            <div key={rx.id} {...recordItemProps(rx.id)} className="si-c9335004">
              <div className="record-icon">💊</div>
              <div className="record-details">
                <h4>{Array.isArray(rx.medications) ? rx.medications.map((m: any) => m.name).join(', ') : t('medicalRecords.overview.medication')}</h4>
                {rx.diagnosis && <p className="si-96d9ee51"><strong>{t('medicalRecords.overview.diagnosis')}</strong> {rx.diagnosis}</p>}
                <p className="text-muted si-6af9d82f">
                  {rx.veterinarianName && `👨‍⚕️ Dr. ${rx.veterinarianName} • `}
                  {fmtDate(rx.createdAt || rx.created_at || '')}
                </p>
              </div>
              <div className="record-actions">
                <span className="badge badge-completed">{rx.isActive || rx.is_active ? t('medicalRecords.prescriptionsTab.active') : t('medicalRecords.prescriptionsTab.expired')}</span>
              </div>
            </div>
          ))}
        </div>
        {prescriptions.length > 5 && (
          <button onClick={() => setActiveTab('prescriptions')} className="si-96479a2f">
            {t('medicalRecords.overview.viewAllPrescriptions', { count: prescriptionsTotal })}
          </button>
        )}
      </div>
    )}
  </div>
)

export default OverviewTab
