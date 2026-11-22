import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSaveAction } from '../../hooks/useSaveAction'
import { BottomSheet } from '../mobile/BottomSheet'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import PlanBuilderSheet from './PlanBuilderSheet'
import RationBuilderSheet from './RationBuilderSheet'
import { formatKcal, type NutritionOverview } from './nutritionShared'

interface Props {
  data: NutritionOverview
  onChanged: () => void
}

/** The current food plan, who made it, whether a vet has reviewed it - and the way to make or change one. */
export const PlanTab: React.FC<Props> = ({ data, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [building, setBuilding] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const plan = data.plan
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language) : '')

  if (!data.calculatorAvailable) {
    return (
      <div className="nutri-tab">
        <section className="nutri-card">
          <h3 className="nutri-card-title">{t('nutrition.plan.notYetTitle')}</h3>
          <p>{t(`nutrition.models.${data.model}`)}</p>
          <p className="nutri-hint">{t('nutrition.plan.notYetBody')}</p>
        </section>
      </div>
    )
  }

  if (data.model === 'ruminant_dm') {
    return <RationPlan data={data} onChanged={onChanged} />
  }

  return (
    <div className="nutri-tab">
      {!plan ? (
        <section className="nutri-card">
          <h3 className="nutri-card-title">{t('nutrition.plan.noneTitle')}</h3>
          <p className="nutri-hint">{data.canCalculate ? t('nutrition.plan.noneBody') : t('nutrition.plan.needsFacts')}</p>
          {data.permissions.canWrite && data.canCalculate && (
            <button type="button" className="btn btn-primary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.plan.make')}</button>
          )}
        </section>
      ) : (
        <section className="nutri-card" aria-label={t('nutrition.plan.currentTitle')}>
          <div className="nutri-card-head">
            <h3 className="nutri-card-title">{t('nutrition.plan.currentTitle')}</h3>
            <span className={`nutri-pill ${plan.validation === 'vet_reviewed' ? 'is-reviewed' : 'is-suggested'}`}>
              {plan.validation === 'vet_reviewed' ? t('nutrition.plan.reviewed') : t('nutrition.plan.suggested')}
            </span>
          </div>
          <p className="nutri-big">{t('nutrition.plan.perDay', { kcal: formatKcal(plan.effectiveKcal, i18n.language) })}</p>
          <p className="nutri-hint">
            {t(`nutrition.goals.${plan.goal}`)} · {t('nutrition.plan.mealsCount', { count: plan.mealsPerDay })}
            {plan.targetWeightKg ? ` · ${t('nutrition.plan.target', { kg: plan.targetWeightKg })}` : ''}
          </p>
          <ul className="nutri-list">
            {plan.items.map(item => (
              <li key={item.id} className="nutri-list-row">
                <span className="nutri-list-main"><strong>{item.label}</strong></span>
                <span className="nutri-list-meta">
                  {item.gramsPerDay === null
                    ? t('nutrition.plan.needsKcal')
                    : t('nutrition.plan.portion', { perDay: item.gramsPerDay, perMeal: item.gramsPerMeal, kcal: formatKcal(item.kcalPerDay, i18n.language) })}
                </span>
              </li>
            ))}
          </ul>
          {plan.energy?.requiresVet && plan.validation !== 'vet_reviewed' && <p className="nutri-note is-warning">{t('nutrition.plan.requiresVet')}</p>}
          {plan.validation === 'vet_reviewed' ? (
            <p className="nutri-hint">
              {t('nutrition.plan.reviewedBy', { name: plan.reviewedByName || t('nutrition.plan.aVet'), date: date(plan.reviewedAt) })}
              {plan.vetOverrideKcal ? ` · ${t('nutrition.plan.vetSet', { kcal: formatKcal(plan.vetOverrideKcal, i18n.language), calc: formatKcal(plan.dailyEnergyKcal, i18n.language) })}` : ''}
            </p>
          ) : (
            <p className="nutri-hint">{t('nutrition.plan.suggestedNote')}</p>
          )}
          {plan.reviewNote && <p className="nutri-quote">“{plan.reviewNote}”</p>}
          <p className="nutri-list-meta">{t('nutrition.plan.madeBy', { name: plan.createdByName || '-', date: date(plan.createdAt) })}</p>
          <div className="record-sheet-actions">
            {data.permissions.canWrite && <button type="button" className="btn btn-secondary" onClick={() => setBuilding(true)}>{t('nutrition.plan.change')}</button>}
            {data.permissions.canReview && <button type="button" className="btn btn-primary" onClick={() => setReviewing(true)}>{t('nutrition.plan.review')}</button>}
          </div>
        </section>
      )}

      {building && <PlanBuilderSheet data={data} onClose={() => setBuilding(false)} onSaved={() => { setBuilding(false); onChanged() }} />}
      {reviewing && plan && <ReviewSheet planId={plan.id} kcal={plan.effectiveKcal} name={data.animal.name} onClose={() => setReviewing(false)} onSaved={() => { setReviewing(false); onChanged() }} />}
    </div>
  )
}

/**
 * Farm ration (cattle, buffalo, goats, sheep): what to feed per day in kg, what it costs, and the cost per litre
 * of milk - the farmer's money question. Feeding itself is recorded in Daily records (the farm's one record of
 * feed), so this tab never keeps a second copy.
 */
const RationPlan: React.FC<{ data: NutritionOverview; onChanged: () => void }> = ({ data, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [building, setBuilding] = useState(false)
  const plan = data.plan && data.plan.ration ? data.plan : null
  const money = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString(i18n.language, { maximumFractionDigits: 2 }))
  return (
    <div className="nutri-tab">
      {!plan ? (
        <section className="nutri-card">
          <h3 className="nutri-card-title">{t('nutrition.ration.none')}</h3>
          <p className="nutri-hint">{data.canCalculate ? t('nutrition.ration.noneBody') : t('nutrition.plan.needsFacts')}</p>
          {data.permissions.canWrite && data.canCalculate && (
            <button type="button" className="btn btn-primary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.make')}</button>
          )}
        </section>
      ) : (
        <section className="nutri-card" aria-label={t('nutrition.ration.currentTitle')}>
          <div className="nutri-card-head">
            <h3 className="nutri-card-title">{t('nutrition.ration.currentTitle')}</h3>
            <span className={`nutri-pill ${plan.validation === 'vet_reviewed' ? 'is-reviewed' : 'is-suggested'}`}>
              {plan.validation === 'vet_reviewed' ? t('nutrition.plan.reviewed') : t('nutrition.plan.suggested')}
            </span>
          </div>
          <p className="nutri-big">
            {t('nutrition.ration.cost', { cost: money(plan.ration?.totalCostPerDay) })}
            {plan.ration?.costPerLitre !== null && plan.ration?.costPerLitre !== undefined ? ` · ${t('nutrition.ration.costLitre', { cost: money(plan.ration.costPerLitre) })}` : ''}
          </p>
          {plan.dailyDmKg !== null && plan.dailyDmKg !== undefined && <p className="nutri-hint">{t('nutrition.ration.perDay', { kg: plan.dailyDmKg })}</p>}
          <ul className="nutri-list">
            {plan.items.map(item => (
              <li key={item.id} className="nutri-list-row">
                <span className="nutri-list-main"><strong>{item.label}</strong></span>
                <span className="nutri-list-meta">
                  {t('nutrition.ration.itemLine', { kg: item.amountPerDay ?? '-' })}
                  {item.costPerDay ? ` · ${t('nutrition.ration.itemCost', { cost: money(item.costPerDay) })}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="nutri-hint">{plan.validation === 'vet_reviewed' ? '' : t('nutrition.plan.suggestedNote')}</p>
          <p className="nutri-hint">{t('nutrition.ration.recordHint')}</p>
          {data.permissions.canWrite && (
            <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.change')}</button>
          )}
        </section>
      )}
      {building && <RationBuilderSheet data={data} onClose={() => setBuilding(false)} onSaved={() => { setBuilding(false); onChanged() }} />}
    </div>
  )
}

/** A vet confirms the plan, optionally setting the daily energy themselves (the grams are re-worked by the server). */
const ReviewSheet: React.FC<{ planId: string; kcal: number | null; name: string; onClose: () => void; onSaved: () => void }> = ({ planId, kcal, name, onClose, onSaved }) => {
  const { t } = useTranslation()
  const [value, setValue] = useState(kcal ? String(Math.round(kcal)) : '')
  const [note, setNote] = useState('')
  const save = useSaveAction(async () => {
    const v = parseStepperValue(value)
    await apiService.reviewNutritionPlan(planId, { overrideKcal: v !== null && kcal !== null && Math.round(v) !== Math.round(kcal) ? v : null, note: note.trim() || null })
  }, t('nutrition.errors.review'))
  return (
    <BottomSheet open title={t('nutrition.plan.reviewTitle', { name })} onClose={onClose}>
      <div className="record-sheet">
        <NumberStepper label={t('nutrition.plan.reviewKcal')} value={value} onChange={setValue} step={10} integer unit="kcal" hint={t('nutrition.plan.reviewKcalHint')} />
        <label className="nutri-field">
          <span className="nutri-field-label">{t('nutrition.plan.reviewNote')}</span>
          <textarea className="form-input" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={save.status === 'saving'} onClick={async () => { if (await save.run()) onSaved() }}>{t('nutrition.plan.confirmReview')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default PlanTab
