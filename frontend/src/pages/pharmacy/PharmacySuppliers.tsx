import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface Supplier {
  id: string
  name: string
  contact_name: string
  email: string
  phone: string
  address: string
  is_approved: boolean
  payment_terms: string
  lead_time_days: number
}

interface Props {
  networkId: string
}

export default function PharmacySuppliers({ networkId }: Props) {
  const { t } = useTranslation()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', contact_name: '', email: '', phone: '',
    address: '', payment_terms: '', lead_time_days: 7, is_approved: true
  })

  const load = useCallback(async () => {
    try {
      if (!networkId) { setSuppliers([]); setLoading(false); return }
      const res = await client.get(`/networks/${networkId}/suppliers`)
      setSuppliers(res.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [networkId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-suppliers', load, 30000)

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', contact_name: '', email: '', phone: '', address: '', payment_terms: 'net30', lead_time_days: 7, is_approved: true })
    setError('')
    setShowModal(true)
  }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name, contact_name: s.contact_name || '', email: s.email || '',
      phone: s.phone || '', address: s.address || '', payment_terms: s.payment_terms || '',
      lead_time_days: s.lead_time_days || 7, is_approved: s.is_approved
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('pharmacy.suppliers.nameRequired')); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await client.patch(`/networks/${networkId}/suppliers/${editing.id}`, form)
      } else {
        await client.post(`/networks/${networkId}/suppliers`, form)
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>🏭 {t('pharmacy.suppliers.title')}</h3>
          <button className="module-btn primary small" onClick={openAdd}>+ {t('pharmacy.suppliers.addSupplier')}</button>
        </div>

        {error && !showModal && <div className="pharm-error">⚠️ {error}</div>}

        {loading ? (
          <p className="si-40d2db53">{t('common.loading')}</p>
        ) : suppliers.length === 0 ? (
          <div className="pharmacy-empty"><div className="empty-icon">🏭</div><p>{t('pharmacy.suppliers.empty')}</p></div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.table.name')}</th>
                  <th>{t('pharmacy.table.contact')}</th>
                  <th>{t('pharmacy.table.email')}</th>
                  <th>{t('pharmacy.table.phone')}</th>
                  <th>{t('pharmacy.table.leadTime')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contact_name || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.lead_time_days ? `${s.lead_time_days}d` : '—'}</td>
                    <td>
                      <span className={`pharm-badge ${s.is_approved ? 'approved' : 'rejected'}`}>
                        {s.is_approved ? t('pharmacy.suppliers.approved') : t('pharmacy.suppliers.unapproved')}
                      </span>
                    </td>
                    <td>
                      <button className="module-btn small" onClick={() => openEdit(s)}>{t('common.edit')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="pharm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="pharm-modal" onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>{editing ? t('pharmacy.suppliers.editTitle') : t('pharmacy.suppliers.addTitle')}</h2>
              <button className="pharm-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {error && <div className="pharm-error">⚠️ {error}</div>}
            <form onSubmit={handleSave}>
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.suppliers.nameLabel')} <span className="req-star">*</span></label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('pharmacy.suppliers.namePlaceholder')} />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.suppliers.contactName')}</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
              </div>
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.suppliers.email')}</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.suppliers.phone')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="pharm-form-group">
                <label>{t('pharmacy.suppliers.address')}</label>
                <textarea rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.suppliers.paymentTerms')}</label>
                  <select value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                    <option value="">{t('pharmacy.suppliers.selectPaymentTerms')}</option>
                    <option value="immediate">Immediate / COD</option>
                    <option value="net15">Net 15 Days</option>
                    <option value="net30">Net 30 Days</option>
                    <option value="net45">Net 45 Days</option>
                    <option value="net60">Net 60 Days</option>
                    <option value="net90">Net 90 Days</option>
                    <option value="advance">Advance Payment</option>
                    <option value="consignment">Consignment</option>
                  </select>
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.suppliers.leadTimeDays')}</label>
                  <input type="number" min="1" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: parseInt(e.target.value) || 7 }))} />
                </div>
              </div>
              <div className="pharm-form-group">
                <label className="si-0c7e7279">
                  <input type="checkbox" checked={form.is_approved} onChange={e => setForm(f => ({ ...f, is_approved: e.target.checked }))} className="si-7f2e0347" />
                  {t('pharmacy.suppliers.approvedLabel')}
                </label>
              </div>
              <p className="req-legend">* {t('common.requiredField')}</p>
              <div className="pharm-modal-actions">
                <button type="button" className="module-btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="module-btn primary" disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
