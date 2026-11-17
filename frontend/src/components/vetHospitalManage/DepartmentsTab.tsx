import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalDepartment, HospitalDoctor } from '../../types'

interface Props {
  t: TFunction
  departments: HospitalDepartment[]
  doctors: HospitalDoctor[]
  onAddDept: () => void
  onEditDept: (dept: HospitalDepartment) => void
  onDeleteDept: (dept: HospitalDepartment) => void
}

const DepartmentsTab: React.FC<Props> = ({ t, departments, doctors, onAddDept, onEditDept, onDeleteDept }) => (
  <div>
    <div className="si-c66b816b">
      <h3 className="si-44087c4b">{t('vetHospitalManage.departments.title')} ({departments.length})</h3>
      <button className="btn-primary" onClick={onAddDept}>+ {t('vetHospitalManage.modal.addDept')}</button>
    </div>
    {departments.length === 0
      ? <div className="empty-state"><div className="empty-state-icon">🏢</div><p>{t('vetHospitalManage.departments.emptyState')}</p></div>
      : <div className="vh-dept-grid">
          {departments.map(dept => (
            <div key={dept.id} className="vh-dept-card">
              <div className="vh-dept-name">{dept.name}</div>
              {dept.code && <div className="si-95f0b257">Code: {dept.code}</div>}
              {dept.description && <div className="si-880fbd4a">{dept.description}</div>}
              {dept.specializations && dept.specializations.length > 0 && (
                <div className="hcard-chips si-200bd478">
                  {dept.specializations.map(s => <span key={s} className="chip">{s}</span>)}
                </div>
              )}
              <div className="si-953889dc">
                {doctors.filter(d => d.departmentId === dept.id).length} {t('vetHospitalManage.departments.doctors')}
              </div>
              <div className="si-49829023">
                <button className="btn-secondary si-aa7179fc" onClick={() => onEditDept(dept)}>{t('common.edit')}</button>
                <button className="btn-danger si-aa7179fc" onClick={() => onDeleteDept(dept)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>}
  </div>
)

export default DepartmentsTab
