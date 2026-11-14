import React from 'react'

export interface ReferralFormState {
  networkId: string
  fromHospitalId: string
  toHospitalId: string
  reason: string
  priority: string
  clinicalNotes: string
}

interface ReferralModalProps {
  referralForm: ReferralFormState
  onChangeForm: (updater: (f: ReferralFormState) => ReferralFormState) => void
  networksList: any[]
  networkHospitals: any[]
  referralError: string
  referralSubmitting: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const ReferralModal: React.FC<ReferralModalProps> = ({
  referralForm, onChangeForm, networksList, networkHospitals, referralError, referralSubmitting,
  onClose, onSubmit
}) => {
  const submitDisabled = referralSubmitting || !referralForm.networkId || !referralForm.toHospitalId

  return (
    <div className="si-5044997e" onClick={onClose}>
      <div className="si-e6c98afe" onClick={e => e.stopPropagation()}>
        <div className="si-101fd1d0">
          <h3 className="si-44087c4b">🔄 Refer Patient to Network Hospital</h3>
          <button onClick={onClose} className="si-30be827b">✕</button>
        </div>
        {referralError && <div className="si-80ee1308">{referralError}</div>}
        <form onSubmit={onSubmit}>
          <div className="si-bab8e8bc">
            <label className="si-0402f865">Network <span className="si-f84f41a5">*</span></label>
            <select className="si-c8d05a40" required
              value={referralForm.networkId} onChange={e => onChangeForm(f => ({ ...f, networkId: e.target.value, toHospitalId: '' }))}>
              <option value="">- Select Network -</option>
              {networksList.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div className="si-bab8e8bc">
            <label className="si-0402f865">
              Receiving Hospital <span className="si-f84f41a5">*</span>
              {!referralForm.networkId && <span className="si-18d8dcb2">⚠️ Select a network first</span>}
            </label>
            <select className="si-c8d05a40" required
              disabled={!referralForm.networkId}
              value={referralForm.toHospitalId} onChange={e => onChangeForm(f => ({ ...f, toHospitalId: e.target.value }))}>
              <option value="">- Select Hospital -</option>
              {networkHospitals.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="si-bab8e8bc">
            <label className="si-0402f865">Reason <span className="si-f84f41a5">*</span></label>
            <textarea className="si-d41674e2"
              rows={3} required placeholder="Reason for referral..."
              value={referralForm.reason} onChange={e => onChangeForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="si-bab8e8bc">
            <label className="si-0402f865">Priority</label>
            <select className="si-c8d05a40"
              value={referralForm.priority} onChange={e => onChangeForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="si-7e63ec4f">
            <label className="si-0402f865">Clinical Notes (optional)</label>
            <textarea className="si-d41674e2"
              rows={4} placeholder="Include relevant history, diagnosis, what you need from the receiving hospital..."
              value={referralForm.clinicalNotes} onChange={e => onChangeForm(f => ({ ...f, clinicalNotes: e.target.value }))} />
          </div>
          <p className="si-7dc8bae5">* Required field</p>
          <div className="si-b1214800">
            <button type="button" onClick={onClose} className="si-bf48a746">Cancel</button>
            <button type="submit" disabled={submitDisabled} className="cr-referral-submit-btn">
              {referralSubmitting ? '⏳ Sending...' : '🔄 Send Referral'}
            </button>
          </div>
          {(!referralForm.networkId || !referralForm.toHospitalId) && (
            <p className="si-d46111c1">⚠️ Select a network and hospital to enable submission</p>
          )}
        </form>
      </div>
    </div>
  )
}

export default ReferralModal
