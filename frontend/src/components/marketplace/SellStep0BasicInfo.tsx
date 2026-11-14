import React from 'react'
import type { TFunction } from 'i18next'

export const SellStep0BasicInfo: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void;
  fieldErrors: Record<string, string>; onClearFieldError: (key: string) => void;
  userAnimals: any[]; selectedAnimalId: string; onAnimalSelect: (id: string) => void;
  copiedId: string | null; onCopyId: (id: string) => void;
  speciesLabel: (s: string, t: TFunction) => string;
  auctionEnabled: boolean; isAdmin: boolean;
  categoryKeys: Array<{ value: string; label: string }>;
  onNext: () => void; t: TFunction;
}> = ({ sellForm, sf, fieldErrors, onClearFieldError, userAnimals, selectedAnimalId, onAnimalSelect, copiedId, onCopyId, speciesLabel, auctionEnabled, isAdmin, categoryKeys, onNext, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.basicInfoTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.basicInfoDesc')}</p>
    <div className="module-form">
      {/* Auto-populate from existing animal - top of form for visibility */}
      {userAnimals.length > 0 && (
        <div className="mp-auto-populate-section">
          <div className="mp-form-section-title">🐾 {t('marketplace.sell.autoPopulateTitle')}</div>
          <p className="mp-auto-populate-hint">{t('marketplace.sell.autoPopulateHint')}</p>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.sell.selectAnimal')}</label>
            <select className="module-input mp-animal-select" value={selectedAnimalId} onChange={e => onAnimalSelect(e.target.value)}>
              <option value="">{t('marketplace.sell.manualEntry')}</option>
              {userAnimals.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({speciesLabel(a.species, t)}{a.breed ? ` - ${a.breed}` : ''})</option>)}
            </select>
          </div>
          {selectedAnimalId && <div className="mp-auto-populated-badge">✅ {t('marketplace.sell.autoPopulated')}</div>}
          {selectedAnimalId && (() => {
            const sel = userAnimals.find((a: any) => a.id === selectedAnimalId)
            const vcId = sel?.uniqueId || sel?.unique_id
            return vcId ? (
              <div className="si-a85540c4"
                title="waytovet Animal ID - click to copy"
                onClick={() => onCopyId(vcId)}
              >
                {copiedId === vcId ? `✅ ${t('common.copied')}` : `🏷️ ${vcId}`}
              </div>
            ) : null
          })()}
        </div>
      )}
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.sell.title')}</label>
        <input className={`module-input${fieldErrors.title ? ' input-error' : ''}`} value={sellForm.title} onChange={e => { sf('title', e.target.value); if (fieldErrors.title) onClearFieldError('title') }} placeholder={t('marketplace.sell.titlePlaceholder')} />
        {fieldErrors.title && <div className="input-error-msg">{fieldErrors.title}</div>}
      </div>
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.sell.description')}</label>
        <textarea className="module-input" value={sellForm.description} onChange={e => sf('description', e.target.value)} rows={3} placeholder={t('marketplace.sell.descPlaceholder')} />
      </div>
      <div className="module-form-row">
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.sell.category')}</label>
          <select className="module-input" value={sellForm.category} onChange={e => sf('category', e.target.value)}>
            {categoryKeys.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.sell.listingType')}</label>
          <select className="module-input" value={sellForm.listingType} onChange={e => sf('listingType', e.target.value)}>
            <option value="fixed_price">{t('marketplace.listingType.fixedPrice')}</option>
            {(auctionEnabled || isAdmin) && <option value="auction">{t('marketplace.listingType.auctionType')}{!auctionEnabled ? ' (Admin preview)' : ''}</option>}
            <option value="wanted">{t('marketplace.listingType.wanted')}</option>
          </select>
        </div>
      </div>
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.sell.tags')}</label>
        <input className="module-input" value={sellForm.tags} onChange={e => sf('tags', e.target.value)} placeholder={t('marketplace.sell.tagsPlaceholder')} />
      </div>
      {/* Seller Type (Compliance: PCA Rules 2017/2018) */}
      <div className="mp-form-section">
        <div className="mp-form-section-title">📋 {t('marketplace.compliance.sellerTypeTitle')}</div>
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.compliance.sellerType')}</label>
          <select className="module-input" value={sellForm.sellerType} onChange={e => sf('sellerType', e.target.value)}>
            <option value="individual">{t('marketplace.compliance.individualOwner')}</option>
            <option value="registered_breeder">{t('marketplace.compliance.registeredBreeder')}</option>
          </select>
        </div>
        {sellForm.sellerType === 'registered_breeder' && (
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.compliance.registrationNumber')}</label>
            <input className="module-input" value={sellForm.registrationNumber} onChange={e => sf('registrationNumber', e.target.value)} placeholder={t('marketplace.compliance.registrationPlaceholder')} />
            <div className="mp-compliance-hint">{t('marketplace.compliance.registrationHint')}</div>
          </div>
        )}
        {sellForm.sellerType === 'individual' && (
          <div className="mp-compliance-info">{t('marketplace.compliance.individualInfo')}</div>
        )}
      </div>
    </div>
    <div className="mp-step-actions">
      <button className="module-btn primary" onClick={onNext}>{t('marketplace.sell.next')}</button>
    </div>
  </div>
)
