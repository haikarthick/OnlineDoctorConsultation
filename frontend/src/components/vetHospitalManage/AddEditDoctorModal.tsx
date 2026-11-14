import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalDepartment, HospitalDoctor } from '../../types'
import { HOSPITAL_ROLES, EMPLOYMENT_TYPES } from './vetHospitalManageShared'

interface DoctorForm { doctorId: string; hospitalRole: string; employmentType: string; departmentId: string; title: string; consultationFee: string; isPrimaryHospital: boolean }

interface Props {
  t: TFunction
  show: boolean
  editDoctor: HospitalDoctor | null
  doctorForm: DoctorForm
  setDoctorForm: React.Dispatch<React.SetStateAction<DoctorForm>>
  modalMsg: { text: string; isError: boolean } | null
  vetSearch: string
  setVetSearch: (v: string) => void
  allVets: any[]
  vetSearchLoading: boolean
  selectedVetName: string
  setSelectedVetName: (v: string) => void
  specFilter: string
  setSpecFilter: (v: string) => void
  filteredVets: any[]
  allSpecializations: string[]
  existingDoctorIdsCount: number
  departments: HospitalDepartment[]
  currency: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const AddEditDoctorModal: React.FC<Props> = ({
  t, show, editDoctor, doctorForm, setDoctorForm, modalMsg, vetSearch, setVetSearch, allVets,
  vetSearchLoading, selectedVetName, setSelectedVetName, specFilter, setSpecFilter, filteredVets,
  allSpecializations, existingDoctorIdsCount, departments, currency, onClose, onSubmit,
}) => {
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{editDoctor ? t('vetHospitalManage.modal.editDoctor') : t('vetHospitalManage.modal.addDoctor')}</h2>
        <form onSubmit={onSubmit} className="vh-form">
          {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
          {!editDoctor && (
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.selectVet')}</label>
              {selectedVetName ? (
                <div className="vet-selected-chip">
                  <span>👨‍⚕️ {selectedVetName}</span>
                  <button type="button" className="vet-chip-clear" onClick={() => {
                    setSelectedVetName(''); setDoctorForm(f => ({ ...f, doctorId: '' }))
                  }}>✕</button>
                </div>
              ) : (
                <>
                  <input
                    value={vetSearch}
                    onChange={e => setVetSearch(e.target.value)}
                    placeholder="Search by name, email, or specialization..."
                    autoComplete="off"
                    className="si-3c64c436"
                  />
                  {allSpecializations.length > 0 && (
                    <div className="si-8d41d654">
                      <button type="button" onClick={() => setSpecFilter('')} className={`vh-spec-filter-btn${specFilter === '' ? ' is-active' : ''}`}>All</button>
                      {allSpecializations.slice(0, 8).map(s => (
                        <button type="button" key={s} onClick={() => setSpecFilter(specFilter === s ? '' : s)} className={`vh-spec-filter-btn${specFilter === s ? ' is-active' : ''}`}>{s}</button>
                      ))}
                    </div>
                  )}
                  <div className="si-d252a329">
                    {vetSearchLoading && <div className="si-61ce8c47">Loading veterinarians…</div>}
                    {!vetSearchLoading && filteredVets.length === 0 && (
                      <div className="si-61ce8c47">
                        {allVets.length === 0 ? 'No veterinarians registered in the system' : 'No matching veterinarians'}
                      </div>
                    )}
                    {!vetSearchLoading && filteredVets.map((v: any) => (
                      <div key={v.userId}
                        onClick={() => {
                          setDoctorForm(f => ({ ...f, doctorId: v.userId }))
                          setSelectedVetName(`${v.firstName || ''} ${v.lastName || ''}`.trim() + (v.email ? ` (${v.email})` : ''))
                        }}
                        className="si-42884720 vh-vet-result-row"
                      >
                        <div className="si-26d7edc3">
                          <div className="si-a9b7f385">👨‍⚕️ {v.firstName} {v.lastName}</div>
                          <div className="si-7f4ca63a">{v.email}</div>
                          {v.specializations?.length > 0 && (
                            <div className="si-f49f847e">
                              {v.specializations.slice(0, 3).map((s: string) => (
                                <span key={s} className="si-03983371">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="si-d052cd20">
                          {v.rating > 0 && <div className="si-7c2973e6">⭐ {Number(v.rating).toFixed(1)}</div>}
                          {v.yearsOfExperience > 0 && <div className="si-26b03e6b">{v.yearsOfExperience} yrs exp</div>}
                          <div className={`vh-availability-text${v.isAvailable ? ' is-available' : ' is-unavailable'}`}>{v.isAvailable ? '● Available' : '○ Unavailable'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!vetSearchLoading && allVets.length > 0 && (
                    <div className="si-0610a7ce">Showing {filteredVets.length} of {allVets.length} veterinarians{existingDoctorIdsCount > 0 ? ` (${existingDoctorIdsCount} already added)` : ''}</div>
                  )}
                </>
              )}
              <input type="hidden" required value={doctorForm.doctorId} />
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.hospitalRole')}</label>
              <select value={doctorForm.hospitalRole} onChange={e => setDoctorForm(f => ({ ...f, hospitalRole: e.target.value }))}>
                {HOSPITAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.employmentType')}</label>
              <select value={doctorForm.employmentType} onChange={e => setDoctorForm(f => ({ ...f, employmentType: e.target.value }))}>
                {EMPLOYMENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.titleDesignation')}</label>
              <input value={doctorForm.title} onChange={e => setDoctorForm(f => ({ ...f, title: e.target.value }))} placeholder="Dr., Prof., etc." />
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.invite.department')}</label>
              <select value={doctorForm.departmentId} onChange={e => setDoctorForm(f => ({ ...f, departmentId: e.target.value }))}>
                <option value="">- None -</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('vetHospitalManage.modal.consultationFee', { currency })}</label>
            <input type="number" value={doctorForm.consultationFee} onChange={e => setDoctorForm(f => ({ ...f, consultationFee: e.target.value }))} placeholder="e.g. 500" min="0" />
          </div>
          <label className="vh-toggle si-5afcd5fa">
            <input type="checkbox" checked={doctorForm.isPrimaryHospital} onChange={e => setDoctorForm(f => ({ ...f, isPrimaryHospital: e.target.checked }))} />
            {t('vetHospitalManage.modal.primaryHospital')}
          </label>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary">{editDoctor ? t('vetHospitalManage.settings.saveBtn') : t('vetHospitalManage.modal.addDoctor')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddEditDoctorModal
