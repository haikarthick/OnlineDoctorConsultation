import React from 'react'
import type { TFunction } from 'i18next'
import { BottomSheet } from '../mobile/BottomSheet'
import { INDIAN_STATES } from '../../constants/indianStates'

/** Age bands a farmer thinks in (years), mapped to the months the API filters on. */
export const AGE_BANDS: Array<{ id: string; minAge?: string; maxAge?: string; labelKey: string }> = [
  { id: 'any', labelKey: 'marketplace.filters.ageAny' },
  { id: 'u1', maxAge: '12', labelKey: 'marketplace.filters.ageUnder1' },
  { id: '1to3', minAge: '12', maxAge: '36', labelKey: 'marketplace.filters.age1to3' },
  { id: '3to5', minAge: '36', maxAge: '60', labelKey: 'marketplace.filters.age3to5' },
  { id: '5p', minAge: '60', labelKey: 'marketplace.filters.age5plus' },
]
const MILK_STEPS = ['5', '10', '15', '20']

/** The number of filters a person has set beyond search/category/species/sort (shown on the button). */
export const SHEET_FILTER_KEYS = ['minPrice', 'maxPrice', 'breed', 'minAge', 'maxAge', 'minMilkYield', 'state', 'district', 'pincode',
  'gender', 'animalClass', 'pregnancyStatus', 'vaccinationStatus', 'healthCertificate']

export const MarketplaceFilterSheet: React.FC<{
  open: boolean; onClose: () => void;
  filters: Record<string, string>;
  setFilters: (updater: (f: Record<string, string>) => Record<string, string>) => void;
  breeds: string[]; breedLabel: (species: string | undefined, name: string) => string;
  classTerms: any[]; resolveLabel: (term: any, t: TFunction) => string;
  onClear: () => void; resultCount: number; t: TFunction;
}> = ({ open, onClose, filters, setFilters, breeds, breedLabel, classTerms, resolveLabel, onClear, resultCount, t }) => {
  const set = (patch: Record<string, string | undefined>) => setFilters(f => {
    const n = { ...f }
    for (const [k, v] of Object.entries(patch)) { if (v) n[k] = v; else delete n[k] }
    return n
  })
  const toggle = (key: string, value: string) => set({ [key]: filters[key] === value ? undefined : value })
  const ageId = AGE_BANDS.find(b => (b.minAge || '') === (filters.minAge || '') && (b.maxAge || '') === (filters.maxAge || ''))?.id || 'any'

  return (
    <BottomSheet open={open} onClose={onClose} title={t('marketplace.filters.title')}>
      <div className="mp-fsheet">
        <section className="mp-fsheet-section">
          <h3 className="mp-fsheet-h">{t('marketplace.filters.price')}</h3>
          <div className="mp-fsheet-row">
            <input className="module-input" type="number" inputMode="numeric" min={0} value={filters.minPrice || ''}
              onChange={e => set({ minPrice: e.target.value })} placeholder={t('marketplace.filters.min')} aria-label={t('marketplace.filters.min')} />
            <span aria-hidden="true">–</span>
            <input className="module-input" type="number" inputMode="numeric" min={0} value={filters.maxPrice || ''}
              onChange={e => set({ maxPrice: e.target.value })} placeholder={t('marketplace.filters.max')} aria-label={t('marketplace.filters.max')} />
          </div>
        </section>

        {breeds.length > 0 && (
          <section className="mp-fsheet-section">
            <h3 className="mp-fsheet-h">{t('marketplace.livestock.breed')}</h3>
            <select className="module-input" value={filters.breed || ''} onChange={e => set({ breed: e.target.value })}>
              <option value="">{t('marketplace.filters.anyBreed')}</option>
              {breeds.map(b => <option key={b} value={b}>{breedLabel(filters.species, b)}</option>)}
            </select>
          </section>
        )}

        <section className="mp-fsheet-section">
          <h3 className="mp-fsheet-h">{t('marketplace.livestock.gender')}</h3>
          <div className="mp-fsheet-chips">
            <button type="button" className={`mp-chip ${filters.gender === 'female' ? 'active' : ''}`} onClick={() => toggle('gender', 'female')}>♀ {t('marketplace.genderLabel.female')}</button>
            <button type="button" className={`mp-chip ${filters.gender === 'male' ? 'active' : ''}`} onClick={() => toggle('gender', 'male')}>♂ {t('marketplace.genderLabel.male')}</button>
          </div>
          {classTerms.length > 0 && (
            <select className="module-input" value={filters.animalClass || ''} onChange={e => set({ animalClass: e.target.value })}>
              <option value="">{t('animalClass.anyClass')}</option>
              {classTerms.map(c => <option key={c.value} value={c.value}>{resolveLabel(c, t)}</option>)}
            </select>
          )}
        </section>

        <section className="mp-fsheet-section">
          <h3 className="mp-fsheet-h">{t('marketplace.filters.age')}</h3>
          <div className="mp-fsheet-chips">
            {AGE_BANDS.map(b => (
              <button key={b.id} type="button" className={`mp-chip ${ageId === b.id ? 'active' : ''}`}
                onClick={() => set({ minAge: b.minAge, maxAge: b.maxAge })}>{t(b.labelKey)}</button>
            ))}
          </div>
        </section>

        <section className="mp-fsheet-section">
          <h3 className="mp-fsheet-h">{t('marketplace.filters.milk')}</h3>
          <div className="mp-fsheet-chips">
            <button type="button" className={`mp-chip ${!filters.minMilkYield ? 'active' : ''}`} onClick={() => set({ minMilkYield: undefined })}>{t('marketplace.filters.ageAny')}</button>
            {MILK_STEPS.map(m => (
              <button key={m} type="button" className={`mp-chip ${filters.minMilkYield === m ? 'active' : ''}`}
                onClick={() => toggle('minMilkYield', m)}>{m}+ {t('marketplace.units.lPerDay')}</button>
            ))}
          </div>
        </section>

        <section className="mp-fsheet-section">
          <h3 className="mp-fsheet-h">{t('marketplace.filters.place')}</h3>
          <select className="module-input" value={filters.state || ''} onChange={e => set({ state: e.target.value, district: e.target.value === filters.state ? filters.district : undefined })}>
            <option value="">{t('marketplace.filters.anyState')}</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="mp-fsheet-row">
            <input className="module-input" value={filters.district || ''} maxLength={80} onChange={e => set({ district: e.target.value })}
              placeholder={t('marketplace.filters.district')} aria-label={t('marketplace.filters.district')} />
            <input className="module-input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={filters.pincode || ''}
              onChange={e => set({ pincode: e.target.value.replace(/\D/g, '') })}
              placeholder={t('marketplace.filters.pincode')} aria-label={t('marketplace.filters.pincode')} />
          </div>
        </section>

        <section className="mp-fsheet-section">
          <h3 className="mp-fsheet-h">{t('marketplace.filters.more')}</h3>
          <div className="mp-fsheet-chips">
            <button type="button" className={`mp-chip ${filters.pregnancyStatus === 'pregnant' ? 'active' : ''}`} onClick={() => toggle('pregnancyStatus', 'pregnant')}>{t('marketplace.chips.pregnant')}</button>
            <button type="button" className={`mp-chip ${filters.vaccinationStatus === 'fully_vaccinated' ? 'active' : ''}`} onClick={() => toggle('vaccinationStatus', 'fully_vaccinated')}>{t('marketplace.chips.vaccinated')}</button>
            <button type="button" className={`mp-chip ${filters.healthCertificate === 'true' ? 'active' : ''}`} onClick={() => toggle('healthCertificate', 'true')}>{t('marketplace.chips.healthCert')}</button>
          </div>
        </section>

        <div className="mp-fsheet-actions">
          <button type="button" className="module-btn" onClick={onClear}>{t('marketplace.filters.reset')}</button>
          <button type="button" className="module-btn primary" onClick={onClose}>{t('marketplace.filters.show', { count: resultCount })}</button>
        </div>
      </div>
    </BottomSheet>
  )
}
