import React, { useState, useEffect } from 'react'
import apiService from '../../services/api'
import { HospitalNetwork, EMPTY_NETWORK_FORM, NETWORK_TYPES } from './hospitalNetworksShared'

export interface NetworkModalProps {
  editing: HospitalNetwork | null
  onClose: () => void
  onSaved: (network: HospitalNetwork) => void
  t: (key: string) => string
}

const NetworkModal: React.FC<NetworkModalProps> = ({ editing, onClose, onSaved, t }) => {
  const [form, setForm] = useState({ ...EMPTY_NETWORK_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? '',
        legalName: editing.legalName ?? '',
        registrationNumber: editing.registrationNumber ?? '',
        taxId: editing.taxId ?? '',
        networkType: editing.networkType ?? 'private',
        country: editing.country ?? '',
        headquartersCity: editing.headquartersCity ?? '',
        headquartersState: editing.headquartersState ?? '',
        contactEmail: editing.contactEmail ?? '',
        contactPhone: editing.contactPhone ?? '',
        website: editing.website ?? '',
        dpoName: (editing as any).dpoName ?? '',
        dpoEmail: (editing as any).dpoEmail ?? '',
        dataResidencyRegion: (editing as any).dataResidencyRegion ?? '',
        idPrefix: editing.idPrefix ?? '',
      })
    } else {
      setForm({ ...EMPTY_NETWORK_FORM })
    }
  }, [editing])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Network name is required'); return }
    setSaving(true); setError('')
    try {
      let result: any
      if (editing) {
        result = await apiService.updateHospitalNetwork(editing.id, form)
      } else {
        result = await apiService.createHospitalNetwork(form)
      }
      onSaved(result.data ?? result)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>{editing ? t('hospitalNetworks.modal.editTitle') : t('hospitalNetworks.modal.createTitle')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="hn-modal-body">
          {error && <div className="module-alert error">{error}</div>}
          <form className="module-form" onSubmit={handleSubmit}>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Network Name <span className="hn-required">*</span></label>
                <input className="module-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. PawCare Group" />
              </div>
              <div className="module-form-group">
                <label className="module-label">Legal Name</label>
                <input className="module-input" value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder="Registered legal name" />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">{t('hospitalNetworks.form.idPrefix')}</label>
                <input className="module-input" value={(form as any).idPrefix} onChange={e => set('idPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="e.g. APOLLO, NH1, TNGOV" maxLength={10} />
                <small className="si-fd547d99">{t('hospitalNetworks.form.idPrefixHint')}</small>
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Registration Number</label>
                <input className="module-input" value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Tax ID</label>
                <input className="module-input" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Network Type</label>
                <select className="module-input" value={form.networkType} onChange={e => set('networkType', e.target.value)}>
                  {NETWORK_TYPES.map(nt => <option key={nt.value} value={nt.value}>{nt.label}</option>)}
                </select>
              </div>
              <div className="module-form-group">
                <label className="module-label">Country</label>
                <input className="module-input" value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. India" />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Headquarters City</label>
                <input className="module-input" value={form.headquartersCity} onChange={e => set('headquartersCity', e.target.value)} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Headquarters State</label>
                <input className="module-input" value={form.headquartersState} onChange={e => set('headquartersState', e.target.value)} />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">Contact Email</label>
                <input className="module-input" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
              </div>
              <div className="module-form-group">
                <label className="module-label">Contact Phone</label>
                <input className="module-input" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
              </div>
            </div>
            <div className="module-form-group">
              <label className="module-label">Website</label>
              <input className="module-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
            </div>
            <div className="hn-section-title">Data Protection</div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">DPO Name</label>
                <input className="module-input" value={form.dpoName} onChange={e => set('dpoName', e.target.value)} placeholder="Data Protection Officer" />
              </div>
              <div className="module-form-group">
                <label className="module-label">DPO Email</label>
                <input className="module-input" type="email" value={form.dpoEmail} onChange={e => set('dpoEmail', e.target.value)} />
              </div>
            </div>
            <div className="module-form-group">
              <label className="module-label">Data Residency Region</label>
              <input className="module-input" value={form.dataResidencyRegion} onChange={e => set('dataResidencyRegion', e.target.value)} placeholder="e.g. Asia-South1" />
            </div>
            <div className="hn-modal-actions">
              <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className="module-btn primary" disabled={saving}>
                {saving ? t('common.saving') : (editing ? t('common.update') : t('common.create'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default NetworkModal
