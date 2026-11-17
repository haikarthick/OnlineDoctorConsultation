import React from 'react'
import type { TFunction } from 'i18next'
import type { VetHospital } from '../../types'
import { HOSPITAL_TYPE_LABELS } from './vetHospitalManageShared'

interface Props {
  t: TFunction
  settingsForm: Partial<VetHospital>
  setSettingsForm: React.Dispatch<React.SetStateAction<Partial<VetHospital>>>
  onSubmit: (e: React.FormEvent) => void
}

const SettingsTab: React.FC<Props> = ({ t, settingsForm, setSettingsForm, onSubmit }) => (
  <form onSubmit={onSubmit} className="vh-form">
    <h3 className="si-33c1a83e">{t('vetHospitalManage.settings.title')}</h3>
    <div className="form-row">
      <div className="form-group">
        <label>{t('vetHospitals.form.hospitalName')}</label>
        <input required value={settingsForm.name || ''} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>{t('common.type')}</label>
        <select value={settingsForm.hospitalType || 'clinic'} onChange={e => setSettingsForm(f => ({ ...f, hospitalType: e.target.value as any }))}>
          {Object.entries(HOSPITAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    </div>
    <div className="form-group">
      <label>{t('vetHospitals.form.tagline')}</label>
      <input value={settingsForm.tagline || ''} onChange={e => setSettingsForm(f => ({ ...f, tagline: e.target.value }))} />
    </div>
    <div className="form-group">
      <label>{t('common.description')}</label>
      <textarea rows={3} value={settingsForm.description || ''} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>{t('vetHospitals.form.city')}</label>
        <input value={settingsForm.city || ''} onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>{t('vetHospitals.form.state')}</label>
        <input value={settingsForm.state || ''} onChange={e => setSettingsForm(f => ({ ...f, state: e.target.value }))} />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>{t('vetHospitals.form.phone')}</label>
        <input value={settingsForm.phone || ''} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>{t('vetHospitals.form.email')}</label>
        <input type="email" value={settingsForm.email || ''} onChange={e => setSettingsForm(f => ({ ...f, email: e.target.value }))} />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>{t('vetHospitals.form.website')}</label>
        <input value={settingsForm.website || ''} onChange={e => setSettingsForm(f => ({ ...f, website: e.target.value }))} />
      </div>
      <div className="form-group">
        <label>{t('vetHospitalManage.settings.fullAddress')}</label>
        <input value={settingsForm.address || ''} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} />
      </div>
    </div>
    <div className="si-c8512b7d">
      <label className="vh-toggle si-5afcd5fa">
        <input type="checkbox" checked={!!settingsForm.hasEmergency} onChange={e => setSettingsForm(f => ({ ...f, hasEmergency: e.target.checked }))} />
        {t('vetHospitalManage.settings.hasEmergency')}
      </label>
      <label className="vh-toggle">
        <input type="checkbox" checked={!!settingsForm.is24Hours} onChange={e => setSettingsForm(f => ({ ...f, is24Hours: e.target.checked }))} />
        {t('vetHospitalManage.settings.open24h')}
      </label>
    </div>
    <div className="form-actions">
      <button type="submit" className="btn-primary">{t('vetHospitalManage.settings.saveBtn')}</button>
    </div>
  </form>
)

export default SettingsTab
