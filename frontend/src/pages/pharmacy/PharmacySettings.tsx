import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

interface Pharmacy {
  id: string
  pharmacy_name: string
  network_id: string
  hospital_id: string
  is_primary_pharmacy: boolean
}

interface Props {
  pharmacy: Pharmacy
  networkId?: string
  onRefresh?: () => void
}

export default function PharmacySettings({ pharmacy, onRefresh }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    pharmacy_name: pharmacy.pharmacy_name || '',
    phone: '',
    email: '',
    address: '',
    license_number: '',
    is_accepting_requests: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.pharmacy_name.trim()) { setError(t('pharmacy.settings.nameRequired')); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await axios.patch(`/api/v1/pharmacies/${pharmacy.id}`, form)
      setSuccess(t('pharmacy.settings.saved'))
      onRefresh?.()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pharmacy-card">
      <div className="pharmacy-card-header">
        <h3>⚙️ {t('pharmacy.settings.title')}</h3>
      </div>
      {error && <div className="pharm-error">⚠️ {error}</div>}
      {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.87rem' }}>✅ {success}</div>}
      <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
        <div className="pharm-form-group">
          <label>{t('pharmacy.settings.nameLabel')} <span className="req-star">*</span></label>
          <input value={form.pharmacy_name} onChange={e => setForm(f => ({ ...f, pharmacy_name: e.target.value }))} />
        </div>
        <div className="pharm-form-row">
          <div className="pharm-form-group">
            <label>{t('pharmacy.settings.phone')}</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.settings.email')}</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="pharm-form-group">
          <label>{t('pharmacy.settings.address')}</label>
          <textarea rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="pharm-form-group">
          <label>{t('pharmacy.settings.licenseNumber')}</label>
          <input value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} />
        </div>
        <div className="pharm-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_accepting_requests} onChange={e => setForm(f => ({ ...f, is_accepting_requests: e.target.checked }))} style={{ width: 'auto' }} />
            {t('pharmacy.settings.acceptingRequests')}
          </label>
        </div>
        <p className="req-legend">* {t('common.requiredField')}</p>
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="module-btn primary" disabled={saving}>
            {saving ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  )
}
