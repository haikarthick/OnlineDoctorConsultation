import React from 'react'
import type { TFunction } from 'i18next'

export const SellStep1AnimalDetails: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void; setSellForm: (updater: (f: Record<string, any>) => Record<string, any>) => void;
  selectedAnimalId: string;
  speciesCategories: any[]; marketplaceEligibleSpecies: string[]; speciesLabel: (s: string, t: TFunction) => string;
  breedsForSpecies: (species: string) => string[]; breedLabel: (species: string, breed: string) => string;
  classTermsForSpecies: (species: string) => any[]; findClassTerm: (species: string, value: string) => any; resolveLabel: (term: any, t: TFunction) => string;
  onBack: () => void; onNext: () => void; t: TFunction;
}> = ({ sellForm, sf, setSellForm, selectedAnimalId, speciesCategories, marketplaceEligibleSpecies, speciesLabel, breedsForSpecies, breedLabel, classTermsForSpecies, findClassTerm, resolveLabel, onBack, onNext, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.animalDetailsTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.animalDetailsDesc')}</p>
    <div className="module-form">
      {selectedAnimalId && (
        <div className="mp-auto-populated-badge">✅ {t('marketplace.sell.fieldsAutoFilled')}</div>
      )}
      <div className="mp-form-section">
        <div className="mp-form-section-title">{t('marketplace.sell.identificationSection')}</div>
        <div className="module-form-row">
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.livestock.species')}</label>
            <select className="module-input" value={sellForm.species}
              onChange={e => setSellForm(f => ({ ...f, species: e.target.value, breed: '' }))}>
              <option value="">{t('marketplace.livestock.selectSpecies')}</option>
              {speciesCategories.map(cat => {
                // Only species flagged marketplace-eligible in Master Data - keeps this in
                // sync with the Browse filter's SPECIES_LIST (both read marketplaceEligibleSpecies).
                const eligible = cat.species.filter((s: string) => marketplaceEligibleSpecies.includes(s))
                if (eligible.length === 0) return null
                return (
                  <optgroup key={cat.label} label={cat.label}>
                    {eligible.map((s: string) => <option key={s} value={s}>{speciesLabel(s, t)}</option>)}
                  </optgroup>
                )
              })}
            </select>
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.livestock.breed')}</label>
            {(() => {
              const breeds = breedsForSpecies(sellForm.species)
              return breeds.length > 0 ? (
                <select className="module-input" value={sellForm.breed} onChange={e => sf('breed', e.target.value)} disabled={!sellForm.species}>
                  <option value="">{sellForm.species ? t('marketplace.sell.selectBreed') : t('marketplace.sell.selectSpeciesFirst')}</option>
                  {breeds.map(b => <option key={b} value={b}>{breedLabel(sellForm.species, b)}</option>)}
                </select>
              ) : (
                <input className="module-input" value={sellForm.breed} onChange={e => sf('breed', e.target.value)} placeholder={t('marketplace.sell.breedPlaceholder')} disabled={!sellForm.species} />
              )
            })()}
          </div>
        </div>
      </div>
      <div className="mp-form-section">
        <div className="mp-form-section-title">{t('marketplace.sell.physicalSection')}</div>
        <div className="module-form-row-3">
          <div className="module-form-group">
            {classTermsForSpecies(sellForm.species).length > 0 ? (
              <>
                <label className="module-label">{t('animalClass.fieldLabel')}</label>
                <select className="module-input" value={sellForm.animalClass} onChange={e => {
                  const term = findClassTerm(sellForm.species, e.target.value)
                  sf('animalClass', e.target.value)
                  if (term?.impliedGender) sf('gender', term.impliedGender)
                }}>
                  <option value="">{t('animalClass.selectClass')}</option>
                  {classTermsForSpecies(sellForm.species).map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
                </select>
              </>
            ) : (
              <>
                <label className="module-label">{t('marketplace.livestock.gender')}</label>
                <select className="module-input" value={sellForm.gender} onChange={e => sf('gender', e.target.value)}>
                  <option value="">{t('marketplace.livestock.selectGender')}</option>
                  <option value="female">{t('marketplace.genderLabel.female')}</option>
                  <option value="male">{t('marketplace.genderLabel.male')}</option>
                </select>
              </>
            )}
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.livestock.ageMonths')}</label>
            <input className="module-input" type="number" value={sellForm.animalAgeMonths} onChange={e => sf('animalAgeMonths', e.target.value)} placeholder={t('marketplace.sell.agePlaceholder')} />
          </div>
          <div className="module-form-group">
            <label className="module-label">{t('marketplace.livestock.weightKg')}</label>
            <input className="module-input" type="number" value={sellForm.animalWeightKg} onChange={e => sf('animalWeightKg', e.target.value)} placeholder={t('marketplace.sell.weightPlaceholder')} />
          </div>
        </div>
      </div>
      {(() => {
        // Only show production/pregnancy fields when relevant to the
        // selected species+class - e.g. a Bullock or Dog listing never
        // needs a milk-yield field. Species without a class glossary keep
        // today's always-show behavior (no new judgment calls for them).
        const hasClassGlossary = classTermsForSpecies(sellForm.species).length > 0
        const selectedClassTerm = findClassTerm(sellForm.species, sellForm.animalClass)
        const showMilk = !hasClassGlossary || !sellForm.animalClass || selectedClassTerm?.canProduceMilk
        const showPregnancy = !hasClassGlossary || !sellForm.animalClass || selectedClassTerm?.canBePregnant
        if (!showMilk && !showPregnancy) return null
        return (
          <div className="mp-form-section">
            <div className="mp-form-section-title">{t('marketplace.sell.productionSection')}</div>
            {showMilk && (
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('marketplace.livestock.lactation')}</label>
                  <input className="module-input" type="number" value={sellForm.lactationNumber} onChange={e => sf('lactationNumber', e.target.value)} placeholder={t('marketplace.sell.lactationPlaceholder')} />
                </div>
                <div className="module-form-group">
                  <label className="module-label">{t('marketplace.livestock.milkYield')}</label>
                  <input className="module-input" type="number" value={sellForm.dailyMilkYield} onChange={e => sf('dailyMilkYield', e.target.value)} placeholder={t('marketplace.sell.milkYieldPlaceholder')} />
                </div>
              </div>
            )}
            {showPregnancy && (
              <div className="module-form-row">
                <div className="module-form-group">
                  <label className="module-label">{t('marketplace.livestock.pregnancy')}</label>
                  <select className="module-input" value={sellForm.pregnancyStatus} onChange={e => sf('pregnancyStatus', e.target.value)}>
                    <option value="">{t('marketplace.livestock.select')}</option>
                    <option value="pregnant">{t('marketplace.pregnancyLabel.pregnant')}</option>
                    <option value="not_pregnant">{t('marketplace.pregnancyLabel.notPregnant')}</option>
                    <option value="unknown">{t('marketplace.genderLabel.unknown')}</option>
                  </select>
                </div>
                {sellForm.pregnancyStatus === 'pregnant' && (
                  <div className="module-form-group">
                    <label className="module-label">{t('marketplace.livestock.pregnancyMonth')}</label>
                    <input className="module-input" type="number" value={sellForm.pregnancyMonth} onChange={e => sf('pregnancyMonth', e.target.value)} min="1" max="12" />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.livestock.quantity')}</label>
        <input className="module-input" type="number" value={sellForm.quantity} onChange={e => sf('quantity', e.target.value)} placeholder="1" />
      </div>
    </div>
    <div className="mp-step-actions">
      <button className="module-btn" onClick={onBack}>{t('marketplace.sell.back')}</button>
      <button className="module-btn primary" onClick={onNext}>{t('marketplace.sell.next')}</button>
    </div>
  </div>
)
