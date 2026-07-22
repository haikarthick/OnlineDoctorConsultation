import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'

interface Pharmacy {
  id: string
  pharmacy_name: string
  network_id: string
  hospital_id: string
  is_primary_pharmacy: boolean
  phone?: string
  email?: string
  address?: string
  license_number?: string
  is_accepting_requests?: boolean
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
    is_accepting_requests: true,
    is_primary_pharmacy: pharmacy.is_primary_pharmacy || false,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load full pharmacy data to pre-populate all fields
  useEffect(() => {
    client.get(`/pharmacies/${pharmacy.id}`)
      .then(res => {
        const data = res.data || {}
        setForm({
          pharmacy_name: data.pharmacy_name || pharmacy.pharmacy_name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          license_number: data.license_number || '',
          is_accepting_requests: data.is_accepting_requests !== false,
          is_primary_pharmacy: data.is_primary_pharmacy || false,
        })
      })
      .catch(() => { /* use defaults if load fails */ })
      .finally(() => setLoading(false))
  }, [pharmacy.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.pharmacy_name.trim()) { setError(t('pharmacy.settings.nameRequired')); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await client.patch(`/pharmacies/${pharmacy.id}`, form)
      setSuccess(t('pharmacy.settings.saved'))
      onRefresh?.()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="pharmacy-card">
        <div className="pharmacy-card-header"><h3>⚙️ {t('pharmacy.settings.title')}</h3></div>
        <p className="si-43f86130">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="pharmacy-card">
      <div className="pharmacy-card-header">
        <h3>⚙️ {t('pharmacy.settings.title')}</h3>
      </div>
      {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button></div>}
      {success && <div className="si-b4b2a275">✅ {success}</div>}
      <form onSubmit={handleSave} className="si-fd3355c4">
        <div className="pharm-form-group">
          <label>{t('pharmacy.settings.nameLabel')} <span className="req-star">*</span></label>
          <input value={form.pharmacy_name} onChange={e => setForm(f => ({ ...f, pharmacy_name: e.target.value }))} />
        </div>
        <div className="pharm-form-row">
          <div className="pharm-form-group">
            <label>{t('pharmacy.settings.phone')}</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.settings.email')}</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="pharmacy@example.com" />
          </div>
        </div>
        <div className="pharm-form-group">
          <label>{t('pharmacy.settings.address')}</label>
          <textarea rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('pharmacy.settings.addressPlaceholder')} />
        </div>
        <div className="pharm-form-group">
          <label>{t('pharmacy.settings.licenseNumber')}</label>
          <input value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="e.g. PH/2024/001234" />
        </div>
        <div className="si-f7d0e944">
          <label className="si-5b02de19">
            <input type="checkbox" checked={form.is_accepting_requests} onChange={e => setForm(f => ({ ...f, is_accepting_requests: e.target.checked }))} className="si-7f2e0347" />
            <span>
              <strong>{t('pharmacy.settings.acceptingRequests')}</strong>
              <small className="si-1a0c0bfa">{t('pharmacy.settings.acceptingRequestsNote')}</small>
            </span>
          </label>
          <label className="si-5b02de19">
            <input type="checkbox" checked={form.is_primary_pharmacy} onChange={e => setForm(f => ({ ...f, is_primary_pharmacy: e.target.checked }))} className="si-7f2e0347" />
            <span>
              <strong>{t('pharmacy.settings.primaryPharmacy')}</strong>
              <small className="si-1a0c0bfa">{t('pharmacy.settings.primaryPharmacyNote')}</small>
            </span>
          </label>
        </div>
        <p className="req-legend">* {t('common.requiredField')}</p>
        <div className="si-6ef8ed8f">
          <button type="submit" className="module-btn primary" disabled={saving}>
            {saving ? `⏳ ${t('common.saving')}` : t('common.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  )
}
