import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'

export default function PharmacyCreateModal({
  networkId,
  onClose,
  onCreated,
  onError,
}: {
  networkId: string
  onClose: () => void
  onCreated: () => Promise<void>
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [createForm, setCreateForm] = useState({ pharmacy_name: '', license_number: '', phone: '', email: '', address: '' })
  const [creating, setCreating] = useState(false)

  return (
    <div className="pharm-modal-overlay" onClick={onClose}>
      <div className="pharm-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('pharmacy.empty.createCta')}</h3>
        <form
          onSubmit={async e => {
            e.preventDefault()
            setCreating(true)
            try {
              await client.post(`/networks/${networkId}/pharmacies`, { ...createForm, is_primary_pharmacy: true })
              onClose()
              setCreateForm({ pharmacy_name: '', license_number: '', phone: '', email: '', address: '' })
              await onCreated()
            } catch (err: any) {
              onError(err?.response?.data?.message || err?.response?.data?.error || err.message)
            } finally { setCreating(false) }
          }}
        >
          <div className="pharm-form-group">
            <label>{t('pharmacy.empty.name')} *</label>
            <input value={createForm.pharmacy_name} required
              onChange={e => setCreateForm(f => ({ ...f, pharmacy_name: e.target.value }))} />
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.empty.licenseNumber')}</label>
            <input value={createForm.license_number}
              onChange={e => setCreateForm(f => ({ ...f, license_number: e.target.value }))} />
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.empty.phone')}</label>
            <input value={createForm.phone}
              onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="pharm-form-group">
            <label>{t('pharmacy.empty.address')}</label>
            <input value={createForm.address}
              onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="pharm-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? t('common.saving') : t('pharmacy.empty.createCta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
