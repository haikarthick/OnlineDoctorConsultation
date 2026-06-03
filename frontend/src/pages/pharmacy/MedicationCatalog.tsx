import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface Medication {
  id: string
  name: string
  generic_name: string
  form: string
  strength: string
  unit: string
  supplier_id: string | null
  supplier_name?: string
  unit_cost: number
  selling_price: number
  min_stock_level: number
  reorder_point: number
  reorder_quantity: number
  manufacturer: string
  registration_number: string
  is_controlled: boolean
  is_active: boolean
  withdrawal_period_days?: number
}

interface Supplier { id: string; name: string }

interface Props {
  networkId: string
  pharmacyId?: string
}

const FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'powder', 'paste', 'spray', 'other']

const emptyForm = () => ({
  name: '', generic_name: '', form: 'tablet', strength: '', unit: 'unit',
  supplier_id: '', unit_cost: 0, selling_price: 0, min_stock_level: 10,
  reorder_point: 20, reorder_quantity: 100, manufacturer: '',
  registration_number: '', is_controlled: false, withdrawal_period_days: 0
})

export default function MedicationCatalog({ networkId }: Props) {
  const { t } = useTranslation()
  const { formatCurrency } = useSettings()
  const [meds, setMeds] = useState<Medication[]>([])
  const [filtered, setFiltered] = useState<Medication[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    try {
      const [medsRes, suppRes] = await Promise.all([
        client.get(`/networks/${networkId}/medications`),
        client.get(`/networks/${networkId}/suppliers`),
      ])
      setMeds(Array.isArray(medsRes.data) ? medsRes.data : [])
      setSuppliers(Array.isArray(suppRes.data) ? suppRes.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [networkId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-catalog', load, 60000)

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q
      ? meds.filter(m =>
          m.name?.toLowerCase().includes(q) ||
          m.generic_name?.toLowerCase().includes(q) ||
          m.manufacturer?.toLowerCase().includes(q)
        )
      : meds
    )
  }, [meds, search])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm())
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (med: Medication) => {
    setEditing(med)
    setForm({
      name: med.name || '',
      generic_name: med.generic_name || '',
      form: med.form || 'tablet',
      strength: med.strength || '',
      unit: med.unit || 'unit',
      supplier_id: med.supplier_id || '',
      unit_cost: med.unit_cost || 0,
      selling_price: med.selling_price || 0,
      min_stock_level: med.min_stock_level || 10,
      reorder_point: med.reorder_point || 20,
      reorder_quantity: med.reorder_quantity || 100,
      manufacturer: med.manufacturer || '',
      registration_number: med.registration_number || '',
      is_controlled: med.is_controlled || false,
      withdrawal_period_days: med.withdrawal_period_days || 0,
    })
    setModalError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setModalError(t('pharmacy.catalog.nameRequired')); return }
    setSaving(true)
    setModalError('')
    try {
      const payload = {
        ...form,
        supplier_id: form.supplier_id || null,
        unit_cost: parseFloat(String(form.unit_cost)) || 0,
        selling_price: parseFloat(String(form.selling_price)) || 0,
        min_stock_level: parseInt(String(form.min_stock_level)) || 10,
        reorder_point: parseInt(String(form.reorder_point)) || 20,
        reorder_quantity: parseInt(String(form.reorder_quantity)) || 100,
        withdrawal_period_days: parseInt(String(form.withdrawal_period_days)) || 0,
      }
      if (editing) {
        await client.patch(`/networks/${networkId}/medications/${editing.id}`, payload)
      } else {
        await client.post(`/networks/${networkId}/medications`, payload)
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      setModalError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (med: Medication) => {
    if (!window.confirm(t('pharmacy.catalog.confirmDeactivate', { name: med.name }))) return
    try {
      await client.patch(`/networks/${networkId}/medications/${med.id}`, { is_active: false })
      load()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message)
    }
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>📋 {t('pharmacy.catalog.title')}</h3>
          <button type="button" className="module-btn primary small" onClick={openAdd}>
            + {t('pharmacy.catalog.addMedication')}
          </button>
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}

        <div className="pharmacy-filter-bar">
          <input
            className="pharmacy-search"
            placeholder={t('pharmacy.catalog.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ fontSize: '0.82rem', color: '#888', whiteSpace: 'nowrap' }}>
            {filtered.length} {t('pharmacy.catalog.medications')}
          </span>
        </div>

        {loading ? (
          <p style={{ color: '#888', padding: '20px 0', textAlign: 'center' }}>{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty">
            <div className="empty-icon">💊</div>
            <p>{search ? t('pharmacy.catalog.noResults') : t('pharmacy.catalog.empty')}</p>
            {!search && (
              <button type="button" className="module-btn primary" style={{ marginTop: 12 }} onClick={openAdd}>
                + {t('pharmacy.catalog.addFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.table.medication')}</th>
                  <th>{t('pharmacy.catalog.form')}</th>
                  <th>{t('pharmacy.catalog.supplier')}</th>
                  <th>{t('pharmacy.catalog.unitCost')}</th>
                  <th>{t('pharmacy.catalog.sellingPrice')}</th>
                  <th>{t('pharmacy.catalog.reorderPoint')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(med => (
                  <tr key={med.id} style={{ opacity: med.is_active ? 1 : 0.5 }}>
                    <td>
                      <strong>{med.name}</strong>
                      {med.generic_name && <br />}
                      {med.generic_name && <small style={{ color: '#888' }}>{med.generic_name}</small>}
                      {med.is_controlled && (
                        <span className="pharm-badge" style={{ background: '#fce4ec', color: '#c62828', marginLeft: 6, fontSize: '0.7rem' }}>
                          {t('pharmacy.catalog.controlled')}
                        </span>
                      )}
                      {(med.withdrawal_period_days ?? 0) > 0 && (
                        <span className="pharm-badge" style={{ background: '#fff8e1', color: '#f57f17', marginLeft: 4, fontSize: '0.7rem' }}>
                          WP {med.withdrawal_period_days}d
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{med.form}</span>
                      {med.strength && <small style={{ color: '#888', display: 'block' }}>{med.strength}</small>}
                    </td>
                    <td>{med.supplier_name || <span style={{ color: '#ccc' }}>—</span>}</td>
                    <td>{formatCurrency(med.unit_cost)}</td>
                    <td>{formatCurrency(med.selling_price)}</td>
                    <td>{med.reorder_point} {med.unit}</td>
                    <td>
                      <span className={`pharm-badge ${med.is_active ? 'approved' : 'rejected'}`}>
                        {med.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="module-btn small" onClick={() => openEdit(med)}>
                          {t('common.edit')}
                        </button>
                        {med.is_active && (
                          <button type="button" className="module-btn small" style={{ color: '#c62828', borderColor: '#f44336' }} onClick={() => handleDeactivate(med)}>
                            {t('common.deactivate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="pharm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="pharm-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>{editing ? t('pharmacy.catalog.editTitle') : t('pharmacy.catalog.addTitle')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {modalError && <div className="pharm-error">⚠️ {modalError}</div>}
            <form onSubmit={handleSave}>
              {/* Basic info */}
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.nameLabel')} <span className="req-star">*</span></label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Amoxicillin" />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.genericName')}</label>
                  <input value={form.generic_name} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
                    placeholder="e.g. Amoxicillin trihydrate" />
                </div>
              </div>
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.form')}</label>
                  <select value={form.form} onChange={e => setForm(f => ({ ...f, form: e.target.value }))}>
                    {FORMS.map(f => <option key={f} value={f} style={{ textTransform: 'capitalize' }}>{f}</option>)}
                  </select>
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.strength')}</label>
                  <input value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))}
                    placeholder="e.g. 250mg, 5mg/ml" />
                </div>
              </div>
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.unit')}</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="unit">Unit</option>
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="vial">Vial</option>
                    <option value="tube">Tube</option>
                    <option value="bottle">Bottle</option>
                    <option value="sachet">Sachet</option>
                  </select>
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.supplier')}</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">{t('pharmacy.catalog.noSupplier')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.unitCost')}</label>
                  <input type="number" min="0" step="0.01" value={form.unit_cost}
                    onChange={e => setForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.sellingPrice')}</label>
                  <input type="number" min="0" step="0.01" value={form.selling_price}
                    onChange={e => setForm(f => ({ ...f, selling_price: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Stock levels */}
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.minStockLevel')}</label>
                  <input type="number" min="0" value={form.min_stock_level}
                    onChange={e => setForm(f => ({ ...f, min_stock_level: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.reorderPoint')}</label>
                  <input type="number" min="0" value={form.reorder_point}
                    onChange={e => setForm(f => ({ ...f, reorder_point: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.reorderQty')}</label>
                  <input type="number" min="1" value={form.reorder_quantity}
                    onChange={e => setForm(f => ({ ...f, reorder_quantity: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>

              {/* Manufacturer */}
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.manufacturer')}</label>
                  <input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.registrationNumber')}</label>
                  <input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))}
                    placeholder="Reg / Lic number" />
                </div>
              </div>

              {/* Livestock + controlled */}
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.catalog.withdrawalDays')}</label>
                  <input type="number" min="0" value={form.withdrawal_period_days}
                    onChange={e => setForm(f => ({ ...f, withdrawal_period_days: parseInt(e.target.value) || 0 }))} />
                  <small style={{ color: '#888', fontSize: '0.75rem' }}>{t('pharmacy.catalog.withdrawalNote')}</small>
                </div>
                <div className="pharm-form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                    <input type="checkbox" checked={form.is_controlled}
                      onChange={e => setForm(f => ({ ...f, is_controlled: e.target.checked }))}
                      style={{ width: 'auto' }} />
                    {t('pharmacy.catalog.isControlled')}
                  </label>
                </div>
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
