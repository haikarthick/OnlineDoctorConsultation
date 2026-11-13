import React from 'react'
import apiService from '../../services/api'
import SearchSelect, { SearchSelectOption } from '../SearchSelect'
import Toggle from './Toggle'
import type { ConsentFormState, ScopeType, GrantToType } from './patientConsentShared'

interface GrantConsentModalProps {
  show: boolean
  form: ConsentFormState
  setForm: React.Dispatch<React.SetStateAction<ConsentFormState>>
  errorMsg: string
  submitting: boolean
  grantToLabel: string
  setGrantToLabel: (label: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  applyPreset: (preset: 'view_only' | 'treatment' | 'emergency') => void
  t: (key: string) => string
}

const GrantConsentModal: React.FC<GrantConsentModalProps> = ({
  show, form, setForm, errorMsg, submitting, grantToLabel, setGrantToLabel,
  onClose, onSubmit, applyPreset, t,
}) => {
  if (!show) return null

  return (
    <div
      className="pc-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pc-modal-title"
    >
      <div className="pc-modal">
        <div className="pc-modal-header">
          <h3 id="pc-modal-title">{t('patientConsent.modal.title')}</h3>
          <button className="pc-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="pc-modal-body">
            {errorMsg && (
              <div className="module-alert error" role="alert">⚠ {errorMsg}</div>
            )}

            <div>
              <p className="pc-form-section-label">Quick Presets</p>
              <div className="pc-preset-bar">
                <button type="button" className="pc-preset-btn" onClick={() => applyPreset('view_only')}>
                  🔍 {t('patientConsent.modal.preset.viewOnly')}
                </button>
                <button type="button" className="pc-preset-btn" onClick={() => applyPreset('treatment')}>
                  💊 {t('patientConsent.modal.preset.treatment')}
                </button>
                <button type="button" className="pc-preset-btn" onClick={() => applyPreset('emergency')}>
                  🚨 {t('patientConsent.modal.preset.emergency')}
                </button>
              </div>
            </div>

            <div>
              <p className="pc-form-section-label">Consent Scope</p>
              <div className="pc-scope-grid">
                {([
                  { value: 'view_only'    as ScopeType, icon: '🔍', title: t('patientConsent.scope.viewOnly'),    desc: 'Read-only access to selected records' },
                  { value: 'full_history' as ScopeType, icon: '📋', title: t('patientConsent.scope.fullHistory'), desc: 'Complete medical history access' },
                  { value: 'treatment'    as ScopeType, icon: '💊', title: t('patientConsent.scope.treatment'),   desc: 'Full access to provide treatment' },
                  { value: 'emergency'    as ScopeType, icon: '🚨', title: t('patientConsent.scope.emergency'),   desc: 'Emergency-only access (expires in 24h)' },
                ]).map(opt => (
                  <label
                    key={opt.value}
                    className={'pc-scope-option' + (form.scope === opt.value ? ' selected-' + opt.value : '')}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={opt.value}
                      checked={form.scope === opt.value}
                      onChange={() => setForm(f => ({ ...f, scope: opt.value }))}
                    />
                    <span className="pc-scope-option-title">{opt.icon} {opt.title}</span>
                    <span className="pc-scope-option-desc">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="pc-form-section-label">{t('patientConsent.grantedTo')}</p>
              <div className="pc-grant-to-tabs">
                {(['doctor', 'hospital', 'network'] as GrantToType[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    className={'pc-grant-to-tab' + (form.grantToType === tab ? ' active' : '')}
                    onClick={() => { setForm(f => ({ ...f, grantToType: tab, grantToId: '' })); setGrantToLabel('') }}
                  >
                    {t('patientConsent.modal.grantTo.' + tab)}
                  </button>
                ))}
              </div>
              <div className="module-form-group">
                <label className="module-label">
                  {form.grantToType === 'doctor'   && 'Search Doctor *'}
                  {form.grantToType === 'hospital' && 'Search Hospital *'}
                  {form.grantToType === 'network'  && 'Search Network *'}
                </label>
                <SearchSelect
                  placeholder={
                    form.grantToType === 'doctor'   ? 'Search by name or email...' :
                    form.grantToType === 'hospital' ? 'Search by hospital name or city...' :
                    'Search by network name...'
                  }
                  value={form.grantToId}
                  displayValue={grantToLabel}
                  loadOnOpen={true}
                  required
                  onSelect={(val, label) => { setForm(f => ({ ...f, grantToId: val })); setGrantToLabel(label) }}
                  onClear={() => { setForm(f => ({ ...f, grantToId: '' })); setGrantToLabel('') }}
                  onSearch={async (q: string): Promise<SearchSelectOption[]> => {
                    if (form.grantToType === 'doctor') {
                      const res = await apiService.get('/consent/search-doctors', { params: { q } })
                      return (res.data?.data || []).map((d: any) => ({
                        value: d.id,
                        label: d.name,
                        sublabel: [d.email, d.specialization].filter(Boolean).join(' · '),
                      }))
                    } else if (form.grantToType === 'hospital') {
                      const res = await apiService.get('/consent/search-hospitals', { params: { q } })
                      return (res.data?.data || []).map((h: any) => ({
                        value: h.id,
                        label: h.name,
                        sublabel: [h.city, h.state].filter(Boolean).join(', '),
                      }))
                    } else {
                      const res = await apiService.get('/consent/search-networks', { params: { q } })
                      return (res.data?.data || []).map((n: any) => ({
                        value: n.id,
                        label: n.name,
                        sublabel: n.networkType,
                      }))
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <p className="pc-form-section-label">Data Permissions</p>
              <div className="pc-modal-permissions-grid">
                <Toggle checked={form.allowMedicalRecords}     onChange={v => setForm(f => ({ ...f, allowMedicalRecords: v }))}     label={t('patientConsent.permissions.medicalRecords')} />
                <Toggle checked={form.allowVaccinationRecords} onChange={v => setForm(f => ({ ...f, allowVaccinationRecords: v }))} label={t('patientConsent.permissions.vaccinationRecords')} />
                <Toggle checked={form.allowPrescriptions}      onChange={v => setForm(f => ({ ...f, allowPrescriptions: v }))}      label={t('patientConsent.permissions.prescriptions')} />
                <Toggle checked={form.allowLabResults}         onChange={v => setForm(f => ({ ...f, allowLabResults: v }))}         label={t('patientConsent.permissions.labResults')} />
                <Toggle checked={form.allowGeneticData}        onChange={v => setForm(f => ({ ...f, allowGeneticData: v }))}        label={t('patientConsent.permissions.geneticData')} />
                <Toggle checked={form.includeHospitalRecords}  onChange={v => setForm(f => ({ ...f, includeHospitalRecords: v }))}  label={t('patientConsent.permissions.hospitalRecords')} note="Private by default - only enable if needed" />
              </div>
            </div>

            <div>
              <p className="pc-form-section-label">Action Permissions</p>
              <div className="pc-modal-permissions-grid">
                <Toggle checked={form.allowView}        onChange={v => setForm(f => ({ ...f, allowView: v }))}        label={t('patientConsent.permissions.allowView')} />
                <Toggle checked={form.allowCreateNotes} onChange={v => setForm(f => ({ ...f, allowCreateNotes: v }))} label={t('patientConsent.permissions.allowNotes')} />
                <Toggle checked={form.allowPrescribe}   onChange={v => setForm(f => ({ ...f, allowPrescribe: v }))}   label={t('patientConsent.permissions.allowPrescribe')} />
              </div>
            </div>

            <div>
              <p className="pc-form-section-label">Validity Period</p>
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('patientConsent.validFrom')}</label>
                  <input
                    className="module-input"
                    type="date"
                    value={form.validFrom}
                    onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                    required
                  />
                </div>
                <div className="module-form-group">
                  <label className="module-label">
                    {t('patientConsent.validUntil')}{' '}
                    <span className="si-f7f517fe">(optional)</span>
                  </label>
                  <input
                    className="module-input"
                    type="date"
                    value={form.validUntil}
                    min={form.validFrom}
                    onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pc-modal-footer">
            <button type="button" className="module-btn" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="module-btn primary" disabled={submitting}>
              {submitting ? 'Granting…' : t('patientConsent.grantConsent')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GrantConsentModal
