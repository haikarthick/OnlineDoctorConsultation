import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PlanBuilderSheet from './PlanBuilderSheet'
import PlanVetActions from './PlanVetActions'
import RationBuilderSheet, { type RationTarget } from './RationBuilderSheet'
import RationPlanCard from './RationPlanCard'
import { formatKcal, type NutritionOverview } from './nutritionShared'

interface Props {
  data: NutritionOverview
  onChanged: () => void
}

/** The current food plan, who made it, whether a vet has reviewed it - and the way to make or change one. */
export const PlanTab: React.FC<Props> = ({ data, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [building, setBuilding] = useState(false)
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

  if (data.model === 'ruminant_dm' || data.model === 'equine_dm') {
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
          {data.permissions.canWrite && (
            <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.plan.change')}</button>
          )}
          <PlanVetActions plan={plan} name={data.animal.name} canReview={data.permissions.canReview} onChanged={onChanged} />
        </section>
      )}

      <PendingPlan data={data} onChanged={onChanged} />

      {building && <PlanBuilderSheet data={data} onClose={() => setBuilding(false)} onSaved={() => { setBuilding(false); onChanged() }} />}
    </div>
  )
}

/**
 * Farm ration (cattle, buffalo, goats, sheep, horses, donkeys): what to feed per day in kg, what it costs, and the
 * cost per litre of milk - the farmer's money question.
 */
const RationPlan: React.FC<{ data: NutritionOverview; onChanged: () => void }> = ({ data, onChanged }) => {
  const { t } = useTranslation()
  const [building, setBuilding] = useState(false)
  const plan = data.plan && data.plan.ration ? data.plan : null
  const target: RationTarget = {
    kind: 'animal', id: data.animal.id, name: data.animal.name, model: data.model,
    milk: data.facts.avgDailyMilkLitres ?? null, work: data.facts.activityLevel,
  }
  return (
    <div className="nutri-tab">
      {!plan && data.herdPlan ? (
        <>
          <p className="nutri-hint">{t('nutrition.ration.fromHerd', { name: data.herdName })}</p>
          <RationPlanCard plan={data.herdPlan} herd>
            {data.permissions.canWrite && (
              <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.ownInstead')}</button>
            )}
          </RationPlanCard>
        </>
      ) : !plan ? (
        <section className="nutri-card">
          <h3 className="nutri-card-title">{t('nutrition.ration.none')}</h3>
          <p className="nutri-hint">{data.canCalculate ? t('nutrition.ration.noneBody') : t('nutrition.plan.needsFacts')}</p>
          {data.permissions.canWrite && data.canCalculate && (
            <button type="button" className="btn btn-primary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.make')}</button>
          )}
        </section>
      ) : (
        <RationPlanCard plan={plan}>
          {data.permissions.canWrite && (
            <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.change')}</button>
          )}
          <PlanVetActions plan={plan} name={data.animal.name} canReview={data.permissions.canReview} onChanged={onChanged} />
        </RationPlanCard>
      )}
      <PendingPlan data={data} onChanged={onChanged} />
      {building && <RationBuilderSheet target={target} onClose={() => setBuilding(false)} onSaved={() => { setBuilding(false); onChanged() }} />}
    </div>
  )
}

/** A plan or ration saved for an animal with a recorded condition: it waits for a vet and the plan in use stays unchanged. */
const PendingPlan: React.FC<{ data: NutritionOverview; onChanged: () => void }> = ({ data, onChanged }) => {
  const { t, i18n } = useTranslation()
  const pending = data.pendingPlan
  if (!pending) return null
  return (
    <section className="nutri-card" aria-label={t('nutrition.plan.pendingTitle')}>
      <div className="nutri-card-head">
        <h3 className="nutri-card-title">{t('nutrition.plan.pendingTitle')}</h3>
        <span className="nutri-pill is-suggested">{t('nutrition.plan.pendingPill')}</span>
      </div>
      <p className="nutri-note is-warning">
        {t('nutrition.plan.pendingBody', { conditions: (pending.conditions || []).map(c => t(`nutrition.conditions.${c}`)).join(', ') })}
      </p>
      {pending.ration
        ? <RationPlanCard plan={pending} />
        : (
          <>
            <p className="nutri-big">{t('nutrition.plan.perDay', { kcal: formatKcal(pending.effectiveKcal, i18n.language) })}</p>
            <ul className="nutri-list">
              {pending.items.map(item => (
                <li key={item.id} className="nutri-list-row">
                  <span className="nutri-list-main"><strong>{item.label}</strong></span>
                  <span className="nutri-list-meta">{item.gramsPerDay === null ? '' : t('nutrition.plan.portion', { perDay: item.gramsPerDay, perMeal: item.gramsPerMeal, kcal: formatKcal(item.kcalPerDay, i18n.language) })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      <PlanVetActions plan={pending} name={data.animal.name} canReview={data.permissions.canReview} onChanged={onChanged} />
    </section>
  )
}

export default PlanTab
