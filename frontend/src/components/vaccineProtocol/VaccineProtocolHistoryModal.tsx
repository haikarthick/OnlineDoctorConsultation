import React from 'react'
import { Protocol, ProtocolChange } from './vaccineProtocolShared'

interface ChangeFormState {
  changedField: string
  oldValue: string
  newValue: string
  changeReason: string
  regulatoryStandard: string
  effectiveDate: string
}

interface VaccineProtocolHistoryModalProps {
  protocol: Protocol
  changes: ProtocolChange[]
  loadingChanges: boolean
  showAddChange: boolean
  setShowAddChange: React.Dispatch<React.SetStateAction<boolean>>
  changeForm: ChangeFormState
  setChangeForm: React.Dispatch<React.SetStateAction<ChangeFormState>>
  onSaveChange: () => void
  savingChange: boolean
  onClose: () => void
  t: any
}

const VaccineProtocolHistoryModal: React.FC<VaccineProtocolHistoryModalProps> = ({
  protocol, changes, loadingChanges, showAddChange, setShowAddChange, changeForm, setChangeForm,
  onSaveChange, savingChange, onClose, t,
}) => (
  <div className="vpa-modal-overlay" onClick={onClose}>
    <div className="vpa-modal vpa-wide-modal" onClick={e => e.stopPropagation()}>
      <div className="vpa-modal-header">
        <h2>{t('vaccineProtocol.changeHistory')}: {protocol.name}</h2>
        <button className="vpa-close-btn" onClick={onClose}>×</button>
      </div>
      <div className="vpa-modal-body">
        <button className="module-btn module-btn-small primary" onClick={() => setShowAddChange(v => !v)}>
          + {t('vaccineProtocol.addChange')}
        </button>

        {showAddChange && (
          <div className="vpa-change-form module-card">
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">{t('vaccineProtocol.changeForm.field')}</label>
                <input className="module-input" value={changeForm.changedField} onChange={e => setChangeForm(p => ({ ...p, changedField: e.target.value }))} placeholder="e.g. booster_interval_days" />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('vaccineProtocol.changeForm.effectiveDate')}</label>
                <input type="date" className="module-input" value={changeForm.effectiveDate} onChange={e => setChangeForm(p => ({ ...p, effectiveDate: e.target.value }))} />
              </div>
            </div>
            <div className="module-form-row">
              <div className="module-form-group">
                <label className="module-label">{t('vaccineProtocol.changeForm.oldValue')}</label>
                <input className="module-input" value={changeForm.oldValue} onChange={e => setChangeForm(p => ({ ...p, oldValue: e.target.value }))} />
              </div>
              <div className="module-form-group">
                <label className="module-label">{t('vaccineProtocol.changeForm.newValue')} *</label>
                <input className="module-input" value={changeForm.newValue} onChange={e => setChangeForm(p => ({ ...p, newValue: e.target.value }))} />
              </div>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.changeForm.regulatoryStandard')}</label>
              <input className="module-input" value={changeForm.regulatoryStandard} onChange={e => setChangeForm(p => ({ ...p, regulatoryStandard: e.target.value }))} placeholder="e.g. WSAVA 2022" />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.changeForm.reason')}</label>
              <textarea className="module-input" rows={2} value={changeForm.changeReason} onChange={e => setChangeForm(p => ({ ...p, changeReason: e.target.value }))} />
            </div>
            <button className="module-btn primary" onClick={onSaveChange} disabled={savingChange}>
              {savingChange ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}

        {loadingChanges ? (
          <div className="module-loading">{t('common.loading')}</div>
        ) : changes.length === 0 ? (
          <p className="vpa-empty">{t('vaccineProtocol.noChanges')}</p>
        ) : (
          <div className="vpa-timeline">
            {changes.map(c => (
              <div key={c.id} className="vpa-timeline-item">
                <div className="vpa-timeline-dot" />
                <div className="vpa-timeline-content module-card">
                  <div className="vpa-change-header">
                    <strong>{c.changedField}</strong>
                    <span className="vpa-change-date">{new Date(c.effectiveDate).toLocaleDateString()}</span>
                  </div>
                  <div className="vpa-change-values">
                    <span className="vpa-old-val">{c.oldValue || '-'}</span>
                    <span className="vpa-arrow">→</span>
                    <span className="vpa-new-val">{c.newValue}</span>
                  </div>
                  {c.regulatoryStandard && (
                    <div className="vpa-regulatory-tag">📋 {c.regulatoryStandard}</div>
                  )}
                  {c.changeReason && <p className="vpa-change-reason">{c.changeReason}</p>}
                  {c.changedByName && (
                    <small className="vpa-changed-by">{t('vaccineProtocol.changedBy')}: {c.changedByName}</small>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)

export default VaccineProtocolHistoryModal
