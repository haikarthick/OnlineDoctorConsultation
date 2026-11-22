import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSaveAction } from '../../hooks/useSaveAction'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { bcsScaleFor, type MissingFact, type NutritionModel } from './nutritionShared'

interface Props {
  animalId: string
  model: NutritionModel
  missing: MissingFact[]
  onSaved: () => void
}

/**
 * "We need a couple of things first." Asks only what this animal's nutrition model needs and what is not
 * recorded anywhere yet. Each answer is saved THROUGH the module that owns it - date of birth, sex, activity
 * and housing on the animal profile, weight and body condition in the body-measurement history - so every
 * other screen sees the same value (single source of truth, docs/NUTRITION_PLAN.md §4a).
 */
export const MissingFactsCard: React.FC<Props> = ({ animalId, model, missing, onSaved }) => {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>({})
  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }))
  const scale = bcsScaleFor(model)

  const save = useSaveAction(async () => {
    const facts: Record<string, unknown> = {}
    if (values.dateOfBirth) facts.dateOfBirth = values.dateOfBirth
    if (values.gender) facts.gender = values.gender
    if (values.isNeutered) facts.isNeutered = values.isNeutered === 'yes'
    if (values.activityLevel) facts.activityLevel = values.activityLevel
    if (values.housing) facts.housing = values.housing
    const weight = parseStepperValue(values.weight || '')
    const bcs = values.bodyCondition ? Number(values.bodyCondition) : null
    if (weight !== null || bcs !== null) {
      await apiService.addBodyMeasurement(animalId, { weight, unit: 'kg', bodyConditionScore: bcs, bcsScale: bcs === null ? null : scale })
    }
    if (Object.keys(facts).length) await apiService.saveNutritionFacts(animalId, facts)
  }, t('nutrition.errors.saveFacts'))

  const answered = missing.some(m => (m.key === 'weight' ? parseStepperValue(values.weight || '') !== null : !!values[m.key]))
  const today = new Date().toISOString().slice(0, 10)

  const field = (m: MissingFact) => {
    const label = `${t(`nutrition.facts.${m.key}`)}${m.required ? '' : ` ${t('nutrition.facts.optional')}`}`
    switch (m.key) {
      case 'weight':
        return <NumberStepper key={m.key} label={label} value={values.weight || ''} onChange={v => set('weight', v)} step={0.5} unit="kg" />
      case 'dateOfBirth':
        return (
          <label key={m.key} className="nutri-field">
            <span className="nutri-field-label">{label}</span>
            <input className="form-input" type="date" max={today} value={values.dateOfBirth || ''} onChange={e => set('dateOfBirth', e.target.value)} />
            <span className="nutri-hint">{t('nutrition.facts.dateOfBirthHint')}</span>
          </label>
        )
      case 'gender':
        return <ChipSelect key={m.key} label={label} variant="segmented" value={values.gender || ''} onChange={v => set('gender', v)}
          options={[{ value: 'female', label: t('nutrition.options.female') }, { value: 'male', label: t('nutrition.options.male') }]} />
      case 'isNeutered':
        return <ChipSelect key={m.key} label={label} variant="segmented" value={values.isNeutered || ''} onChange={v => set('isNeutered', v)}
          options={[{ value: 'yes', label: t('nutrition.options.yes') }, { value: 'no', label: t('nutrition.options.no') }]} />
      case 'activityLevel':
        return <ChipSelect key={m.key} label={label} value={values.activityLevel || ''} onChange={v => set('activityLevel', v)}
          options={['low', 'moderate', 'high', 'working'].map(v => ({ value: v, label: t(`nutrition.activity.${v}`) }))} />
      case 'housing':
        return <ChipSelect key={m.key} label={label} value={values.housing || ''} onChange={v => set('housing', v)}
          options={(model === 'companion_energy' || model === 'guidance_only'
            ? ['indoor', 'outdoor', 'indoor_outdoor'] : ['stall_fed', 'grazing', 'semi_grazing']).map(v => ({ value: v, label: t(`nutrition.housing.${v}`) }))} />
      case 'bodyCondition':
        return (
          <div key={m.key}>
            <ChipSelect label={label} value={values.bodyCondition || ''} onChange={v => set('bodyCondition', v)}
              options={Array.from({ length: scale }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            <p className="nutri-hint">{t(scale === 9 ? 'nutrition.body.bcsGuide9' : 'nutrition.body.bcsGuide5')}</p>
          </div>
        )
      default:
        return null
    }
  }

  const hasRequired = missing.some(m => m.required)
  return (
    <section className={`nutri-card ${hasRequired ? 'is-needed' : ''}`} aria-label={t('nutrition.facts.title')}>
      <h3 className="nutri-card-title">{hasRequired ? t('nutrition.facts.titleRequired') : t('nutrition.facts.title')}</h3>
      <p className="nutri-hint">{t('nutrition.facts.why')}</p>
      <div className="nutri-form">{missing.map(field)}</div>
      <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} savedMessage={t('nutrition.facts.saved')} />
      <button type="button" className="btn btn-primary nutri-wide-btn" disabled={!answered || save.status === 'saving'}
        onClick={async () => { if (await save.run()) { setValues({}); onSaved() } }}>
        {t('nutrition.facts.save')}
      </button>
    </section>
  )
}

export default MissingFactsCard
