import React, { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'

interface Patient { animalId: string; animalName: string; networkPatientId?: string; ownerName?: string; branchHospitalId?: string | null; branchHospitalName?: string | null; enrollmentStatus?: string }

export interface StartTransferModalProps {
  networkId: string
  /** The network's hospitals (id + name). */
  hospitals: Array<{ id?: string; hospital_id?: string; hospitalId?: string; name?: string; hospitalName?: string }>
  onClose: () => void
  onStarted: () => void
  t: TFunction
}

const hid = (h: StartTransferModalProps['hospitals'][number]) => h.hospital_id || h.hospitalId || h.id || ''
const hname = (h: StartTransferModalProps['hospitals'][number]) => h.name || h.hospitalName || ''

/**
 * Start moving a patient from one hospital of the network to another: search the network's own patients, the hospital they are at
 * is filled in for you, choose where they go and say why. The server re-checks everything (the patient must be an active patient of
 * this network and at that hospital), and the owner is told when the move is completed.
 */
const StartTransferModal: React.FC<StartTransferModalProps> = ({ networkId, hospitals, onClose, onStarted, t }) => {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [patient, setPatient] = useState<Patient | null>(null)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (patient || q.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(() => {
      apiService.searchNetworkPatients(networkId, q.trim())
        .then((r: any) => setResults((Array.isArray(r) ? r : r?.data || []).filter((p: Patient) => !p.enrollmentStatus || p.enrollmentStatus === 'active')))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, patient, networkId])

  const pick = (p: Patient) => { setPatient(p); setFromId(p.branchHospitalId || ''); setResults([]) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patient) { setError(t('hospitalNetworks.transfers.errPatient')); return }
    if (!fromId || !toId) { setError(t('hospitalNetworks.transfers.errHospitals')); return }
    if (!reason.trim()) { setError(t('hospitalNetworks.transfers.errReason')); return }
    setBusy(true); setError('')
    try {
      await apiService.createPatientTransfer(networkId, { fromHospitalId: fromId, toHospitalId: toId, animalId: patient.animalId, reason: reason.trim(), clinicalNotes: notes.trim() || undefined })
      onStarted()
    } catch (err) {
      setError(userMessage(err, 'hospitalNetworks.transfers.startFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="hn-modal-overlay" onClick={onClose}>
      <div className="hn-modal hn-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="hn-modal-header">
          <h2>{t('hospitalNetworks.transfers.startTitle')}</h2>
          <button type="button" className="hn-modal-close" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>
        <form className="hn-modal-body" onSubmit={submit}>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.transfers.patient')} <span className="hn-required">*</span></label>
            {patient ? (
              <div className="hn-picked">
                <strong>{patient.animalName}</strong>{patient.networkPatientId ? ` (${patient.networkPatientId})` : ''}{patient.branchHospitalName ? ` - ${patient.branchHospitalName}` : ''}
                <button type="button" className="module-btn small" onClick={() => { setPatient(null); setFromId(''); setQ('') }}>{t('hospitalNetworks.transfers.change')}</button>
              </div>
            ) : (
              <>
                <input className="module-input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('hospitalNetworks.transfers.searchPlaceholder')} autoComplete="off" />
                {q.trim().length >= 2 && results.length === 0 && <p className="hn-hint">{t('hospitalNetworks.transfers.noMatches')}</p>}
                {results.length > 0 && (
                  <ul className="hn-pick-list">
                    {results.slice(0, 8).map(p => (
                      <li key={p.animalId}>
                        <button type="button" className="module-btn" onClick={() => pick(p)}>
                          {p.animalName}{p.ownerName ? ` - ${p.ownerName}` : ''}{p.branchHospitalName ? ` (${p.branchHospitalName})` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.transfers.from')} <span className="hn-required">*</span></label>
            <select className="module-input" value={fromId} onChange={e => setFromId(e.target.value)}>
              <option value="">{t('hospitalNetworks.transfers.choose')}</option>
              {hospitals.map(h => <option key={hid(h)} value={hid(h)}>{hname(h)}</option>)}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.transfers.to')} <span className="hn-required">*</span></label>
            <select className="module-input" value={toId} onChange={e => setToId(e.target.value)}>
              <option value="">{t('hospitalNetworks.transfers.choose')}</option>
              {hospitals.filter(h => hid(h) !== fromId).map(h => <option key={hid(h)} value={hid(h)}>{hname(h)}</option>)}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.transfers.reason')} <span className="hn-required">*</span></label>
            <input className="module-input" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder={t('hospitalNetworks.transfers.reasonPlaceholder')} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('hospitalNetworks.transfers.notes')}</label>
            <textarea className="module-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <p className="hn-hint">{t('hospitalNetworks.transfers.ownerTold')}</p>
          {error && <div className="module-alert error" role="alert">{error}</div>}
          <div className="hn-modal-actions">
            <button type="button" className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="module-btn primary" disabled={busy}>{busy ? t('common.saving') : t('hospitalNetworks.transfers.submit')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StartTransferModal
