import React from 'react'
import type { TFunction } from 'i18next'
import type { VetHospital, HospitalDepartment, HospitalDoctor, HospitalService, HospitalStats } from '../../types'

interface Props {
  t: TFunction
  hospital: VetHospital
  doctors: HospitalDoctor[]
  departments: HospitalDepartment[]
  services: HospitalService[]
  stats: HospitalStats | null
  onQuickAddDoctor: () => void
  onQuickAddDept: () => void
  onQuickAddService: () => void
  onEditProfile: () => void
}

const OverviewTab: React.FC<Props> = ({ t, hospital, doctors, departments, services, stats, onQuickAddDoctor, onQuickAddDept, onQuickAddService, onEditProfile }) => (
  <div>
    <div className="vh-manage-stats">
      {[
        { label: t('vetHospitalManage.overview.doctors'), value: doctors.length, icon: '👨‍⚕️' },
        { label: t('vetHospitalManage.overview.departments'), value: departments.length, icon: '🏢' },
        { label: t('vetHospitalManage.overview.services'), value: services.length, icon: '💊' },
        { label: t('vetHospitalManage.overview.avgRating'), value: hospital.rating > 0 ? Number(hospital.rating).toFixed(1) : '-', icon: '⭐' },
        { label: t('vetHospitalManage.overview.totalReviews'), value: hospital.totalReviews, icon: '💬' },
        { label: t('common.status'), value: hospital.isActive ? t('common.active') : t('vetHospitalManage.overview.inactive'), icon: '🔘' },
      ].map(s => (
        <div key={s.label} className="vh-stat-card">
          <div className="si-46606d89">{s.icon}</div>
          <div className="vh-stat-value">{s.value}</div>
          <div className="vh-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
    {stats && (
      <div className="card">
        <h3 className="si-33c1a83e">{t('vetHospitalManage.overview.acceptingPatients')}</h3>
        <p>{doctors.filter(d => d.isAcceptingPatients).length} of {doctors.length} doctors are accepting new patients</p>
      </div>
    )}
    <div className="card si-216c99b7">
      <h3 className="si-33c1a83e">{t('vetHospitalManage.overview.quickActions')}</h3>
      <div className="si-05b84723">
        <button className="btn-secondary" onClick={onQuickAddDoctor}>+ {t('vetHospitalManage.modal.addDoctor')}</button>
        <button className="btn-secondary" onClick={onQuickAddDept}>+ {t('vetHospitalManage.modal.addDept')}</button>
        <button className="btn-secondary" onClick={onQuickAddService}>+ {t('vetHospitalManage.modal.addService')}</button>
        <button className="btn-secondary" onClick={onEditProfile}>{t('vetHospitalManage.editProfile')}</button>
      </div>
    </div>
  </div>
)

export default OverviewTab
