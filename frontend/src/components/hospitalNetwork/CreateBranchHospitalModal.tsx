import React, { useState } from 'react'
import apiService from '../../services/api'
import { BranchHospitalFormData } from './hospitalNetworksShared'

const SPECIALIZATION_OPTIONS = ['Cardiology', 'Surgery', 'Emergency', 'Orthopedics', 'Dermatology', 'Ophthalmology', 'Neurology', 'Oncology', 'Internal Medicine', 'General Practice']

const CreateBranchHospitalModal: React.FC<{
  networkId: string;
  onSuccess: () => void;
  onClose: () => void;
  t: any;
}> = ({ networkId, onSuccess, onClose, t }) => {
  const [form, setForm] = useState<BranchHospitalFormData>({
    name: '', hospitalType: 'multi_specialty', address: '', city: '',
    state: '', country: 'IN', postalCode: '', phone: '', email: '', description: '',
    operatingHours: '', specializations: []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Hospital name is required'); return }
    setSaving(true)
    setError('')
    try {
      await apiService.createBranchHospital(networkId, form)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create branch hospital')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal si-dde6b9b9" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h3>🏥 Create Branch Hospital</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="si-3834fcb3">
          <div className="si-28fc7e41">
            {error && <div className="module-alert error si-af843d88">{error}</div>}
            <div className="module-form">
              <div className="module-form-group">
                <label className="module-label">Hospital Name <span className="si-19136384">*</span></label>
                <input className="module-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chennai Branch - North" required />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Type</label>
                  <select className="module-input" value={form.hospitalType} onChange={e => setForm(f => ({ ...f, hospitalType: e.target.value }))}>
                    <option value="multi_specialty">Multi Specialty</option>
                    <option value="specialty">Specialty</option>
                    <option value="clinic">Clinic</option>
                    <option value="emergency">Emergency</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
                <div className="module-form-group">
                  <label className="module-label">Phone</label>
                  <input className="module-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 ..." />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Email</label>
                <input className="module-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="branch@hospital.com" />
              </div>
              <div className="module-form-group">
                <label className="module-label">Address</label>
                <input className="module-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">City</label>
                  <input className="module-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">State</label>
                  <input className="module-input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="State" />
                </div>
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">Country</label>
                  <input className="module-input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="IN" />
                </div>
                <div className="module-form-group">
                  <label className="module-label">Postal Code</label>
                  <input className="module-input" value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="600001" />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Description <span className="si-f7764c70">(optional)</span></label>
                <textarea className="module-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this branch..." />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('networkSettings.operatingHours')} <span className="si-f7764c70">(optional)</span></label>
                <input
                  className="module-input"
                  value={form.operatingHours || ''}
                  onChange={e => setForm(f => ({ ...f, operatingHours: e.target.value }))}
                  placeholder={t('hospitalNetworks.operatingHoursPlaceholder')}
                />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('networkSettings.specializations')} <span className="si-f7764c70">(optional)</span></label>
                <div className="si-4526a3dd">
                  {(form.specializations || []).map(spec => (
                    <span key={spec} className="si-bbabfb92">
                      {spec}
                      <button type="button" onClick={() => setForm(f => ({ ...f, specializations: (f.specializations || []).filter(s => s !== spec) }))} className="si-f021bb7e">×</button>
                    </span>
                  ))}
                </div>
                <div className="si-50c82988">
                  {SPECIALIZATION_OPTIONS.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        specializations: (f.specializations || []).includes(spec)
                          ? (f.specializations || []).filter(s => s !== spec)
                          : [...(f.specializations || []), spec]
                      }))}
                      className={`hn-branch-spec-chip${(form.specializations || []).includes(spec) ? ' active' : ''}`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
                <p className="si-ada3b9d6">{t('hospitalNetworks.specializationsHint')}</p>
              </div>
            </div>
          </div>
          <div className="si-23022006">
            <p className="si-a089afbe">* Name required</p>
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || !form.name.trim()}>
              {saving ? '⏳ Creating...' : '🏥 Create Branch Hospital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateBranchHospitalModal
