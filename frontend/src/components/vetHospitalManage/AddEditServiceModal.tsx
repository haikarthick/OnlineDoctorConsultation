import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalService } from '../../types'
import { SERVICE_CATEGORIES } from './vetHospitalManageShared'

interface ServiceForm { serviceName: string; category: string; description: string; priceMin: string; priceMax: string; durationMinutes: string; requiresAppointment: boolean }

interface Props {
  t: TFunction
  show: boolean
  editService: HospitalService | null
  serviceForm: ServiceForm
  setServiceForm: React.Dispatch<React.SetStateAction<ServiceForm>>
  modalMsg: { text: string; isError: boolean } | null
  currency: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const AddEditServiceModal: React.FC<Props> = ({ t, show, editService, serviceForm, setServiceForm, modalMsg, currency, onClose, onSubmit }) => {
  if (!show) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content si-197ba518" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{editService ? t('vetHospitalManage.modal.editService') : t('vetHospitalManage.modal.addService')}</h2>
        <form onSubmit={onSubmit} className="vh-form">
          {modalMsg && <div className={`modal-alert ${modalMsg.isError ? 'error' : 'success'}`}>{modalMsg.text}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.serviceName')}</label>
              <input required value={serviceForm.serviceName} onChange={e => setServiceForm(f => ({ ...f, serviceName: e.target.value }))} placeholder="e.g. Abdominal Ultrasound" />
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.category')}</label>
              <select value={serviceForm.category} onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}>
                {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={2} value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.minPrice', { currency })}</label>
              <input type="number" value={serviceForm.priceMin} onChange={e => setServiceForm(f => ({ ...f, priceMin: e.target.value }))} min="0" />
            </div>
            <div className="form-group">
              <label>{t('vetHospitalManage.modal.maxPrice', { currency })}</label>
              <input type="number" value={serviceForm.priceMax} onChange={e => setServiceForm(f => ({ ...f, priceMax: e.target.value }))} min="0" />
            </div>
          </div>
          <div className="form-group">
            <label>{t('vetHospitalManage.modal.duration')}</label>
            <input type="number" value={serviceForm.durationMinutes} onChange={e => setServiceForm(f => ({ ...f, durationMinutes: e.target.value }))} min="5" step="5" />
          </div>
          <label className="vh-toggle si-5afcd5fa">
            <input type="checkbox" checked={serviceForm.requiresAppointment} onChange={e => setServiceForm(f => ({ ...f, requiresAppointment: e.target.checked }))} />
            {t('vetHospitalManage.modal.requiresAppointment')}
          </label>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn-primary">{editService ? t('vetHospitalManage.settings.saveBtn') : t('vetHospitalManage.modal.createService')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddEditServiceModal
