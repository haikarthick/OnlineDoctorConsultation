import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalDepartment, HospitalDoctor } from '../../types'

interface DeptForm { name: string; code: string; description: string; specializations: string; floorNumber: string; headDoctorId: string }

interface Props {
  t: TFunction
  show: boolean
  editDept: HospitalDepartment | null
  deptForm: DeptForm
  setDeptForm: React.Dispatch<React.SetStateAction<DeptForm>>
  modalMsg: { text: string; isError: boolean } | null
  doctors: HospitalDoctor[]
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const AddEditDepartmentModal: React.FC<Props> = ({ t, show, editDept, deptForm, setDeptForm, modalMsg, doctors, onClose, onSubmit }) => {
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{editDept ? t('vetHospitalManage.modal.editDept') : t('vetHospitalManage.modal.addDept')}</h2>
        <form onSubmit={onSubmit} className="vh-form">
          {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.deptName')}</label>
              <input required value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.code')}</label>
              <input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CARDIO" />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={2} value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>{t('vetHospitalManage.modal.specializations')}</label>
            <input value={deptForm.specializations} onChange={e => setDeptForm(f => ({ ...f, specializations: e.target.value }))} placeholder="Cardiology, Neurology" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.floorLocation')}</label>
              <input value={deptForm.floorNumber} onChange={e => setDeptForm(f => ({ ...f, floorNumber: e.target.value }))} placeholder="Floor 2, Block A" />
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.headDoctor')}</label>
              <select value={deptForm.headDoctorId} onChange={e => setDeptForm(f => ({ ...f, headDoctorId: e.target.value }))}>
                <option value="">- None -</option>
                {doctors.map(d => <option key={d.doctorId} value={d.doctorId}>{d.doctorName || d.doctorId}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary">{editDept ? t('vetHospitalManage.settings.saveBtn') : t('vetHospitalManage.modal.createDept')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddEditDepartmentModal
