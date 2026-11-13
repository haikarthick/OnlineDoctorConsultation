import React from 'react'
import { Protocol, SPECIES_OPTIONS, ROUTE_OPTIONS } from './vaccineProtocolShared'

interface VaccineProtocolFormModalProps {
  editProtocol: Protocol | null
  formData: Partial<Protocol>
  setFormData: React.Dispatch<React.SetStateAction<Partial<Protocol>>>
  onSave: () => void
  onClose: () => void
  saving: boolean
  onSpeciesToggle: (sp: string) => void
  t: any
}

const VaccineProtocolFormModal: React.FC<VaccineProtocolFormModalProps> = ({
  editProtocol, formData, setFormData, onSave, onClose, saving, onSpeciesToggle, t,
}) => (
  <div className="vpa-modal-overlay" onClick={onClose}>
    <div className="vpa-modal" onClick={e => e.stopPropagation()}>
      <div className="vpa-modal-header">
        <h2>{editProtocol ? t('vaccineProtocol.editProtocol') : t('vaccineProtocol.addProtocol')}</h2>
        <button className="vpa-close-btn" onClick={onClose}>×</button>
      </div>
      <div className="vpa-modal-body">
        <div className="module-form">
          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.name')} *</label>
              <input className="module-input" value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.disease')} *</label>
              <input className="module-input" value={formData.disease || ''} onChange={e => setFormData(p => ({ ...p, disease: e.target.value }))} />
            </div>
          </div>

          <div className="module-form-group">
            <label className="module-label">{t('vaccineProtocol.form.species')} *</label>
            <div className="vpa-species-checkboxes">
              {SPECIES_OPTIONS.map(sp => (
                <label key={sp} className="vpa-checkbox-label">
                  <input
                    type="checkbox"
                    checked={(formData.species || []).includes(sp)}
                    onChange={() => onSpeciesToggle(sp)}
                  />
                  {sp}
                </label>
              ))}
            </div>
          </div>

          <div className="module-form-row module-form-row-3">
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.category')}</label>
              <select className="module-input" value={formData.vaccineCategory || 'core'} onChange={e => setFormData(p => ({ ...p, vaccineCategory: e.target.value as any }))}>
                <option value="core">{t('vaccineProtocol.category.core')}</option>
                <option value="non_core">{t('vaccineProtocol.category.nonCore')}</option>
                <option value="mandatory_govt">{t('vaccineProtocol.category.mandatoryGovt')}</option>
                <option value="legally_mandated">{t('vaccineProtocol.category.legallyMandated')}</option>
              </select>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.gender')}</label>
              <select className="module-input" value={formData.applicableGender || 'all'} onChange={e => setFormData(p => ({ ...p, applicableGender: e.target.value as any }))}>
                <option value="all">{t('vaccineProtocol.gender.all')}</option>
                <option value="male">{t('vaccineProtocol.gender.male')}</option>
                <option value="female">{t('vaccineProtocol.gender.female')}</option>
              </select>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.country')}</label>
              <input className="module-input" value={formData.country || ''} onChange={e => setFormData(p => ({ ...p, country: e.target.value }))} placeholder="IN" />
            </div>
          </div>

          <div className="module-form-row module-form-row-3">
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.boosterInterval')}</label>
              <input type="number" className="module-input" min={0} value={formData.boosterIntervalDays ?? 365} onChange={e => setFormData(p => ({ ...p, boosterIntervalDays: parseInt(e.target.value) || 365 }))} />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.seriesDoseCount')}</label>
              <input type="number" className="module-input" min={1} max={10} value={formData.seriesDoseCount ?? 1} onChange={e => setFormData(p => ({ ...p, seriesDoseCount: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.seriesInterval')}</label>
              <input type="number" className="module-input" min={0} value={formData.seriesIntervalDays ?? 21} onChange={e => setFormData(p => ({ ...p, seriesIntervalDays: parseInt(e.target.value) || 21 }))} />
            </div>
          </div>

          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.route')}</label>
              <select className="module-input" value={formData.route || 'intramuscular'} onChange={e => setFormData(p => ({ ...p, route: e.target.value }))}>
                {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.dosageMl')}</label>
              <input className="module-input" value={formData.dosageMl || ''} onChange={e => setFormData(p => ({ ...p, dosageMl: e.target.value }))} placeholder="e.g. 2 ml" />
            </div>
          </div>

          <div className="module-form-row">
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.regulatoryBody')}</label>
              <input className="module-input" value={formData.regulatoryBody || ''} onChange={e => setFormData(p => ({ ...p, regulatoryBody: e.target.value }))} />
            </div>
            <div className="module-form-group">
              <label className="module-label">{t('vaccineProtocol.form.seasonalWindow')}</label>
              <input className="module-input" value={formData.seasonalWindow || ''} onChange={e => setFormData(p => ({ ...p, seasonalWindow: e.target.value }))} placeholder="e.g. Pre-monsoon (May-Jun)" />
            </div>
          </div>

          <div className="module-form-group">
            <label className="module-label">{t('vaccineProtocol.form.regulatoryStandard')}</label>
            <input className="module-input" value={formData.regulatoryStandard || ''} onChange={e => setFormData(p => ({ ...p, regulatoryStandard: e.target.value }))} placeholder="e.g. WSAVA 2022, DAHD Circular 2023" />
          </div>

          <div className="module-form-group">
            <label className="module-label">{t('vaccineProtocol.form.notes')}</label>
            <textarea className="module-input" rows={3} value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <label className="vpa-checkbox-label">
            <input type="checkbox" checked={formData.isZoonotic || false} onChange={e => setFormData(p => ({ ...p, isZoonotic: e.target.checked }))} />
            {t('vaccineProtocol.form.isZoonotic')}
          </label>
        </div>
      </div>
      <div className="vpa-modal-footer">
        <button className="module-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="module-btn primary" onClick={onSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  </div>
)

export default VaccineProtocolFormModal
