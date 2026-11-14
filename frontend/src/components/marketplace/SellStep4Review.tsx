import React from 'react'
import type { TFunction } from 'i18next'
import { ReviewItem } from './ReviewItem'

export const SellStep4Review: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void;
  currency: string;
  speciesLabel: (s: string, t: TFunction) => string; breedLabel: (species: string, breed: string) => string;
  findClassTerm: (species: string, value: string) => any; resolveLabel: (term: any, t: TFunction) => string;
  genderLabels: Record<string, string>; vaxLabels: Record<string, string>;
  onBack: () => void; onPublish: () => void; t: TFunction;
}> = ({ sellForm, sf, currency, speciesLabel, breedLabel, findClassTerm, resolveLabel, genderLabels, vaxLabels, onBack, onPublish, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.reviewTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.reviewDesc')}</p>
    <div className="mp-review-grid">
      <ReviewItem label={t('marketplace.sell.title').replace(' *', '')} value={sellForm.title} />
      <ReviewItem label={t('marketplace.sell.category')} value={sellForm.category} />
      <ReviewItem label={t('marketplace.reviewLabels.type')} value={sellForm.listingType} />
      <ReviewItem label={t('marketplace.livestock.species')} value={speciesLabel(sellForm.species, t)} />
      <ReviewItem label={t('marketplace.livestock.breed')} value={breedLabel(sellForm.species, sellForm.breed)} />
      <ReviewItem label={t('marketplace.livestock.gender')} value={(() => {
        const term = findClassTerm(sellForm.species, sellForm.animalClass)
        if (term) return resolveLabel(term, t)
        return sellForm.gender ? genderLabels[sellForm.gender] : '-'
      })()} />
      <ReviewItem label={t('marketplace.livestock.age')} value={sellForm.animalAgeMonths ? `${sellForm.animalAgeMonths} ${t('marketplace.units.months')}` : '-'} />
      <ReviewItem label={t('marketplace.livestock.weightKg')} value={sellForm.animalWeightKg ? `${sellForm.animalWeightKg} ${t('marketplace.units.kg')}` : '-'} />
      <ReviewItem label={t('marketplace.reviewLabels.milkYield')} value={sellForm.dailyMilkYield ? `${sellForm.dailyMilkYield} ${t('marketplace.units.lPerDay')}` : '-'} />
      <ReviewItem label={t('marketplace.livestock.pregnancy')} value={sellForm.pregnancyStatus || '-'} />
      <ReviewItem label={t('marketplace.livestock.vaccination')} value={vaxLabels[sellForm.vaccinationStatus] || '-'} />
      <ReviewItem label={t('marketplace.reviewLabels.healthCert')} value={sellForm.healthCertificate ? t('marketplace.reviewLabels.yes') : t('marketplace.reviewLabels.no')} />
      <ReviewItem label={t('marketplace.reviewLabels.price')} value={sellForm.price ? `${currency} ${sellForm.price}` : t('marketplace.reviewLabels.contactForPrice')} />
      <ReviewItem label={t('marketplace.sell.location')} value={sellForm.location || '-'} />
      <ReviewItem label={t('marketplace.livestock.contact')} value={sellForm.contactPhone || '-'} />
      <ReviewItem label={t('marketplace.compliance.sellerType')} value={sellForm.sellerType === 'registered_breeder' ? t('marketplace.compliance.registeredBreeder') : t('marketplace.compliance.individualOwner')} />
      {sellForm.sellerType === 'registered_breeder' && <ReviewItem label={t('marketplace.compliance.registrationNumber')} value={sellForm.registrationNumber || '-'} />}
    </div>
    {sellForm.description && (
      <div className="mp-review-desc">
        <strong>{t('marketplace.sell.description')}:</strong>
        <p>{sellForm.description}</p>
      </div>
    )}
    {/* Legal Compliance & T&C */}
    <div className="mp-compliance-section">
      <h4 className="mp-compliance-title">⚖️ {t('marketplace.compliance.legalTitle')}</h4>
      <div className="mp-compliance-disclaimer">{t('marketplace.compliance.legalDisclaimer')}</div>
      <div className="mp-compliance-checkboxes">
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={sellForm.welfareAttestation} onChange={e => sf('welfareAttestation', e.target.checked)} />
          {t('marketplace.compliance.welfareAttestation')}
        </label>
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={sellForm.termsAccepted} onChange={e => sf('termsAccepted', e.target.checked)} />
          {t('marketplace.compliance.termsAccept')}
        </label>
      </div>
      {sellForm.sellerType === 'registered_breeder' && (
        <div className="mp-compliance-breeder-note">{t('marketplace.compliance.breederNote')}</div>
      )}
    </div>
    <div className="mp-step-actions">
      <button className="module-btn" onClick={onBack}>{t('marketplace.sell.back')}</button>
      <button className="module-btn primary" disabled={!sellForm.termsAccepted || !sellForm.welfareAttestation} onClick={onPublish}>{t('marketplace.sell.publish')}</button>
    </div>
  </div>
)
