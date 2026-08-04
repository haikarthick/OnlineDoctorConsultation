import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import client from '../../services/api/client'
import { useSettings } from '../../context/SettingsContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

interface MedLine { med_id: string; name: string; quantity: number; unit: string }

interface TransferRequest {
  id: string
  source_hospital_id: string | null
  destination_hospital_id: string | null
  source_hospital_name: string | null
  destination_hospital_name: string | null
  requested_medications: MedLine[]
  status: string
  tracking_number: string | null
  decline_reason: string | null
  notes: string | null
  created_by_name: string
  created_at: string
}

interface NetworkHospital { id: string; name: string }
interface NetworkMedication { id: string; name: string; form?: string; strength?: string; unit?: string }

interface Props {
  networkId: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fff3e0', color: '#e65100' },
  accepted:  { bg: '#e8eaf6', color: '#3949ab' },
  preparing: { bg: '#e8eaf6', color: '#3949ab' },
  shipped:   { bg: '#e3f2fd', color: '#1565c0' },
  received:  { bg: '#f1f8e9', color: '#33691e' },
  fulfilled: { bg: '#e8f5e9', color: '#2e7d32' },
  declined:  { bg: '#ffebee', color: '#c62828' },
}

const STATUS_FLOW: Record<string, string | null> = {
  pending: 'accepted', accepted: 'preparing', preparing: 'shipped', shipped: 'received', received: 'fulfilled', fulfilled: null, declined: null,
}

export default function MedicationTransfers({ networkId }: Props) {
  const { t } = useTranslation()
  const { formatDate } = useSettings()
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [hospitals, setHospitals] = useState<NetworkHospital[]>([])
  const [medications, setMedications] = useState<NetworkMedication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [trackingTarget, setTrackingTarget] = useState<{ id: string; tracking: string } | null>(null)
  const [declineTarget, setDeclineTarget] = useState<{ id: string; reason: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [form, setForm] = useState({ sourceHospitalId: '', destHospitalId: '', notes: '' })
  const [formLines, setFormLines] = useState<{ medId: string; quantity: number; unit: string }[]>([{ medId: '', quantity: 1, unit: 'unit' }])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [reqRes, hospRes, medRes] = await Promise.all([
        client.get(`/networks/${networkId}/med-requests`),
        client.get(`/hospital-networks/${networkId}/hospitals`),
        client.get(`/networks/${networkId}/medications`),
      ])
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : [])
      const rawHospitals = hospRes.data?.hospitals ?? hospRes.data ?? []
      setHospitals(Array.isArray(rawHospitals) ? rawHospitals : [])
      setMedications(Array.isArray(medRes.data) ? medRes.data : [])
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [networkId, t])

  useEffect(() => { load() }, [load])
  useAutoRefresh('pharmacy-transfers', load, 30000)

  const filtered = filterStatus === 'active'
    ? requests.filter(r => !['fulfilled', 'declined'].includes(r.status))
    : filterStatus === 'all'
    ? requests
    : requests.filter(r => r.status === filterStatus)

  const updateStatus = async (id: string, status: string, extra?: Record<string, string>) => {
    setUpdatingId(id)
    try {
      await client.patch(`/networks/${networkId}/med-requests/${id}`, { status, ...extra })
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleAdvance = (r: TransferRequest) => {
    const next = STATUS_FLOW[r.status]
    if (next === 'shipped') { setTrackingTarget({ id: r.id, tracking: '' }); return }
    if (next) updateStatus(r.id, next)
  }

  const submitTracking = async () => {
    if (!trackingTarget) return
    await updateStatus(trackingTarget.id, 'shipped', { tracking_number: trackingTarget.tracking })
    setTrackingTarget(null)
  }

  const submitDecline = async () => {
    if (!declineTarget) return
    await updateStatus(declineTarget.id, 'declined', { decline_reason: declineTarget.reason })
    setDeclineTarget(null)
  }

  const addLine = () => setFormLines(prev => [...prev, { medId: '', quantity: 1, unit: 'unit' }])
  const removeLine = (idx: number) => setFormLines(prev => prev.filter((_, i) => i !== idx))
  const updateLine = (idx: number, patch: Partial<{ medId: string; quantity: number; unit: string }>) =>
    setFormLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))

  const resetForm = () => {
    setForm({ sourceHospitalId: '', destHospitalId: '', notes: '' })
    setFormLines([{ medId: '', quantity: 1, unit: 'unit' }])
  }

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const validLines = formLines.filter(l => l.medId && l.quantity > 0)
    if (!form.sourceHospitalId || !form.destHospitalId || validLines.length === 0) {
      setError(t('pharmacy.transfers.formIncomplete'))
      return
    }
    if (form.sourceHospitalId === form.destHospitalId) {
      setError(t('pharmacy.transfers.sameHospital'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const requested_medications = validLines.map(l => {
        const med = medications.find(m => m.id === l.medId)
        return { med_id: l.medId, name: med?.name || '', quantity: l.quantity, unit: l.unit }
      })
      await client.post(`/networks/${networkId}/med-requests`, {
        source_hospital_id: form.sourceHospitalId,
        destination_hospital_id: form.destHospitalId,
        requested_medications,
        notes: form.notes || undefined,
      })
      resetForm()
      setShowCreate(false)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="pharmacy-card">
        <div className="pharmacy-card-header">
          <h3>🚚 {t('pharmacy.transfers.title')}</h3>
          <button type="button" className="module-btn small primary" onClick={() => setShowCreate(true)}>
            + {t('pharmacy.transfers.newRequest')}
          </button>
        </div>

        {error && <div className="pharm-error">⚠️ {error} <button type="button" onClick={() => setError('')} className="si-540cb98a">✕</button></div>}

        <div className="pharmacy-filter-bar">
          <select className="pharmacy-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="active">{t('pharmacy.transfers.activeRequests')}</option>
            <option value="all">{t('pharmacy.filter.all')}</option>
            <option value="pending">{t('pharmacy.transfers.status.pending')}</option>
            <option value="accepted">{t('pharmacy.transfers.status.accepted')}</option>
            <option value="preparing">{t('pharmacy.transfers.status.preparing')}</option>
            <option value="shipped">{t('pharmacy.transfers.status.shipped')}</option>
            <option value="received">{t('pharmacy.transfers.status.received')}</option>
            <option value="fulfilled">{t('pharmacy.transfers.status.fulfilled')}</option>
            <option value="declined">{t('pharmacy.transfers.status.declined')}</option>
          </select>
          <span className="si-22cd98cf">{filtered.length} {t('pharmacy.transfers.requests')}</span>
        </div>

        {loading ? (
          <p className="si-43f86130">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="pharmacy-empty">
            <div className="empty-icon">🚚</div>
            <p>{filterStatus === 'active' ? t('pharmacy.transfers.noActive') : t('pharmacy.transfers.empty')}</p>
          </div>
        ) : (
          <div className="pharmacy-table-wrap">
            <table className="pharmacy-table">
              <thead>
                <tr>
                  <th>{t('pharmacy.transfers.route')}</th>
                  <th>{t('pharmacy.table.medication')}</th>
                  <th>{t('pharmacy.transfers.requestedBy')}</th>
                  <th>{t('pharmacy.table.date')}</th>
                  <th>{t('pharmacy.table.status')}</th>
                  <th>{t('pharmacy.reorders.tracking')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const colors = STATUS_COLORS[r.status] || { bg: '#f5f5f5', color: '#666' }
                  const nextStatus = STATUS_FLOW[r.status]
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.source_hospital_name || '-'}</strong>
                        <small className="si-1a0c0bfa">→ {r.destination_hospital_name || '-'}</small>
                      </td>
                      <td className="si-d83d7d70">
                        {(r.requested_medications || []).map((m, i) => (
                          <div key={i}>{m.name} × {m.quantity} {m.unit}</div>
                        ))}
                      </td>
                      <td className="si-c5381d69">{r.created_by_name}</td>
                      <td className="si-86931177">{formatDate(r.created_at)}</td>
                      <td>
                        <span className="pharm-badge" style={{ background: colors.bg, color: colors.color }}>
                          {t(`pharmacy.transfers.status.${r.status}`) || r.status}
                        </span>
                        {r.status === 'declined' && r.decline_reason && (
                          <small className="si-1a0c0bfa">{r.decline_reason}</small>
                        )}
                      </td>
                      <td className="si-f2dbbee4">{r.tracking_number || <span className="si-c81ca09e">-</span>}</td>
                      <td>
                        <div className="si-8aa04a6d">
                          {nextStatus && (
                            <button type="button" className="module-btn small primary"
                              disabled={updatingId === r.id}
                              onClick={() => handleAdvance(r)}>
                              {t(`pharmacy.transfers.advanceTo.${nextStatus}`)}
                            </button>
                          )}
                          {r.status === 'pending' && (
                            <button type="button" className="module-btn small si-bc631a4a"
                              disabled={updatingId === r.id}
                              onClick={() => setDeclineTarget({ id: r.id, reason: '' })}>
                              {t('pharmacy.transfers.decline')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracking modal */}
      {trackingTarget && (
        <div className="pharm-modal-overlay" onClick={() => setTrackingTarget(null)}>
          <div className="pharm-modal si-3196bd33" onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>📦 {t('pharmacy.transfers.addTracking')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => setTrackingTarget(null)}>✕</button>
            </div>
            <div className="pharm-form-group">
              <label>{t('pharmacy.reorders.trackingNumber')}</label>
              <input value={trackingTarget.tracking}
                onChange={e => setTrackingTarget(tt => tt ? { ...tt, tracking: e.target.value } : tt)}
                placeholder="e.g. INDP12345678" />
            </div>
            <div className="pharm-modal-actions">
              <button type="button" className="module-btn" onClick={() => setTrackingTarget(null)}>{t('common.cancel')}</button>
              <button type="button" className="module-btn primary" onClick={submitTracking}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Decline modal */}
      {declineTarget && (
        <div className="pharm-modal-overlay" onClick={() => setDeclineTarget(null)}>
          <div className="pharm-modal si-3196bd33" onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>❌ {t('pharmacy.transfers.decline')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => setDeclineTarget(null)}>✕</button>
            </div>
            <div className="pharm-form-group">
              <label>{t('pharmacy.transfers.declineReason')}</label>
              <textarea rows={2} value={declineTarget.reason}
                onChange={e => setDeclineTarget(dt => dt ? { ...dt, reason: e.target.value } : dt)} />
            </div>
            <div className="pharm-modal-actions">
              <button type="button" className="module-btn" onClick={() => setDeclineTarget(null)}>{t('common.cancel')}</button>
              <button type="button" className="module-btn primary" onClick={submitDecline}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create request modal */}
      {showCreate && (
        <div className="pharm-modal-overlay" onClick={() => { setShowCreate(false); resetForm() }}>
          <div className="pharm-modal si-b86380be" onClick={e => e.stopPropagation()}>
            <div className="pharm-modal-header">
              <h2>🚚 {t('pharmacy.transfers.newRequest')}</h2>
              <button type="button" className="pharm-modal-close" onClick={() => { setShowCreate(false); resetForm() }}>✕</button>
            </div>
            <form onSubmit={submitCreate}>
              <div className="pharm-form-row">
                <div className="pharm-form-group">
                  <label>{t('pharmacy.transfers.sourceHospital')} <span className="req-star">*</span></label>
                  <select value={form.sourceHospitalId} onChange={e => setForm(f => ({ ...f, sourceHospitalId: e.target.value }))}>
                    <option value="">{t('pharmacy.transfers.selectHospital')}</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="pharm-form-group">
                  <label>{t('pharmacy.transfers.destHospital')} <span className="req-star">*</span></label>
                  <select value={form.destHospitalId} onChange={e => setForm(f => ({ ...f, destHospitalId: e.target.value }))}>
                    <option value="">{t('pharmacy.transfers.selectHospital')}</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              </div>

              <label className="si-86032ed0">{t('pharmacy.transfers.medications')} <span className="req-star">*</span></label>
              <div className="si-51b511c9">
                {formLines.map((line, idx) => (
                  <div key={idx} className="pharm-form-row si-403e4828">
                    <div className="pharm-form-group si-d7d15c11">
                      <select value={line.medId} onChange={e => updateLine(idx, { medId: e.target.value })}>
                        <option value="">{t('pharmacy.transfers.selectMedication')}</option>
                        {medications.map(m => (
                          <option key={m.id} value={m.id}>{m.name}{m.strength ? ` ${m.strength}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="pharm-form-group si-7120288a">
                      <input type="number" min="1" value={line.quantity}
                        onChange={e => updateLine(idx, { quantity: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="pharm-form-group si-7120288a">
                      <input value={line.unit} onChange={e => updateLine(idx, { unit: e.target.value })} placeholder="unit" />
                    </div>
                    {formLines.length > 1 && (
                      <button type="button" className="module-btn small si-bc631a4a" onClick={() => removeLine(idx)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="module-btn small" onClick={addLine}>+ {t('pharmacy.transfers.addLine')}</button>

              <div className="pharm-form-group">
                <label>{t('pharmacy.dispense.notes')}</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <p className="req-legend">* {t('common.requiredField')}</p>
              <div className="pharm-modal-actions">
                <button type="button" className="module-btn" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</button>
                <button type="submit" className="module-btn primary" disabled={saving}>
                  {saving ? `⏳ ${t('common.saving')}` : t('pharmacy.transfers.submitRequest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
