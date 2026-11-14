import React, { useState } from 'react'
import apiService from '../../services/api'
import { BranchHospitalFormData, NetworkHospital } from './hospitalNetworksShared'

const EditBranchHospitalModal: React.FC<{
  networkId: string;
  hospital: NetworkHospital;
  onSuccess: () => void;
  onClose: () => void;
  t: any;
}> = ({ networkId, hospital, onSuccess, onClose, t }) => {
  const [form, setForm] = useState<BranchHospitalFormData>({
    name: hospital.name || '',
    hospitalType: hospital.hospitalType || 'multi_specialty',
    address: '',
    city: hospital.city || '',
    state: hospital.state || '',
    country: 'IN',
    postalCode: '',
    phone: hospital.contactPhone || '',
    email: hospital.contactEmail || '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Hospital name is required'); return }
    setSaving(true); setError('')
    try {
      await apiService.updateBranchHospital(networkId, hospital.id, form)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update branch hospital')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal si-dde6b9b9" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h3>✏️ Edit Branch Hospital</h3>
          <button type="button" className="hn-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="si-3834fcb3">
          <div className="si-28fc7e41">
            {error && <div className="module-alert error si-af843d88">{error}</div>}
            <div className="module-form">
              <div className="module-form-group">
                <label className="module-label">Hospital Name <span className="si-19136384">*</span></label>
                <input className="module-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
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
                <input className="module-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Address</label>
                <input className="module-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
              </div>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">City</label>
                  <input className="module-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">State</label>
                  <input className="module-input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div className="module-form-group">
                <label className="module-label">Description <span className="si-f7764c70">(optional)</span></label>
                <textarea className="module-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="si-de5a14e5">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={saving || !form.name.trim()}>
              {saving ? '⏳ Saving...' : '✏️ Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditBranchHospitalModal
