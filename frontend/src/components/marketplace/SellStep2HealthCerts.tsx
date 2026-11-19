import React from 'react'
import type { TFunction } from 'i18next'

export const SellStep2HealthCerts: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void; marketplaceConditions: any[]; resolveLabel: (term: any, t: TFunction) => string;
  onBack: () => void; onNext: () => void; t: TFunction;
}> = ({ sellForm, sf, marketplaceConditions, resolveLabel, onBack, onNext, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.healthCertsTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.healthCertsDesc')}</p>
    <div className="module-form">
      <div className="module-form-row">
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.livestock.vaccination')}</label>
          <select className="module-input" value={sellForm.vaccinationStatus} onChange={e => sf('vaccinationStatus', e.target.value)}>
            <option value="unknown">{t('marketplace.vaxLabel.unknown')}</option>
            <option value="fully_vaccinated">{t('marketplace.vaxLabel.fully')}</option>
            <option value="partially_vaccinated">{t('marketplace.vaxLabel.partial')}</option>
            <option value="not_vaccinated">{t('marketplace.vaxLabel.none')}</option>
          </select>
        </div>
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.livestock.condition')}</label>
          <select className="module-input" value={sellForm.condition} onChange={e => sf('condition', e.target.value)}>
            {marketplaceConditions.map(c => <option key={c.code} value={c.code}>{resolveLabel(c, t)}</option>)}
          </select>
        </div>
      </div>
      <div className="module-form-group">
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={sellForm.healthCertificate} onChange={e => sf('healthCertificate', e.target.checked)} />
          {t('marketplace.sell.hasHealthCert')}
        </label>
      </div>
      <div className="module-form-group">
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={sellForm.welfareAttestation} onChange={e => sf('welfareAttestation', e.target.checked)} />
          {t('marketplace.compliance.welfareAttestation')}
        </label>
        <div className="mp-compliance-hint">{t('marketplace.compliance.welfareHint')}</div>
      </div>
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.livestock.contact')}</label>
        <input className="module-input" value={sellForm.contactPhone} onChange={e => sf('contactPhone', e.target.value)} placeholder={t('marketplace.sell.contactPlaceholder')} />
      </div>
    </div>
    <div className="mp-step-actions">
      <button className="module-btn" onClick={onBack}>{t('marketplace.sell.back')}</button>
      <button className="module-btn primary" onClick={onNext}>{t('marketplace.sell.next')}</button>
    </div>
  </div>
)
