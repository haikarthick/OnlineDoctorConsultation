import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatAmount, type NutritionPlan } from './nutritionShared'

interface Props {
  plan: NutritionPlan
  /** Shown under the title: per animal, or "per animal" + the herd's total. */
  herd?: boolean
  /** Extra controls (change / review / prescribe) rendered at the bottom. */
  children?: React.ReactNode
}

/**
 * A saved farm ration - cattle, buffalo, goats, sheep, horses, donkeys; one animal or a whole herd. What to feed per
 * day in kg, what it costs, the cost per litre of milk, and for a herd the whole herd's total. One card for the
 * animal's Plan tab and the group's feed card so both read the same way. Feeding itself is recorded in Daily records
 * (the farm's one record of feed), so this card never keeps a second copy.
 */
export const RationPlanCard: React.FC<Props> = ({ plan, herd = false, children }) => {
  const { t, i18n } = useTranslation()
  const r = plan.ration
  const money = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString(i18n.language, { maximumFractionDigits: 2 }))
  return (
    <section className="nutri-card" aria-label={t(herd ? 'nutrition.ration.herdCurrent' : 'nutrition.ration.currentTitle')}>
      <div className="nutri-card-head">
        <h3 className="nutri-card-title">{t(herd ? 'nutrition.ration.herdCurrent' : 'nutrition.ration.currentTitle')}</h3>
        <span className={`nutri-pill ${plan.validation === 'vet_reviewed' ? 'is-reviewed' : 'is-suggested'}`}>
          {plan.validation === 'vet_reviewed' ? t('nutrition.plan.reviewed') : t('nutrition.plan.suggested')}
        </span>
      </div>
      {herd && <p className="nutri-hint">{t('nutrition.ration.perHead')}</p>}
      <p className="nutri-big">
        {t('nutrition.ration.cost', { cost: money(r?.totalCostPerDay) })}
        {r?.costPerLitre !== null && r?.costPerLitre !== undefined ? ` · ${t('nutrition.ration.costLitre', { cost: money(r.costPerLitre) })}` : ''}
      </p>
      {plan.dailyDmKg !== null && plan.dailyDmKg !== undefined && <p className="nutri-hint">{t('nutrition.ration.perDay', { kg: plan.dailyDmKg })}</p>}
      {r?.work && <p className="nutri-hint">{t('nutrition.ration.workLine', { work: t(`nutrition.activity.${r.work}`) })}</p>}
      <ul className="nutri-list">
        {plan.items.map(item => (
          <li key={item.id} className="nutri-list-row">
            <span className="nutri-list-main"><strong>{item.label}</strong></span>
            <span className="nutri-list-meta">
              {t('nutrition.ration.itemLine', { amount: formatAmount(item.amountPerDay) })}
              {item.costPerDay ? ` · ${t('nutrition.ration.itemCost', { cost: money(item.costPerDay) })}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {r?.herd && (
        <>
          <h4 className="nutri-sub-title">{t('nutrition.ration.herdTotal', { count: r.herd.headCount, cost: money(r.herd.totalCostPerDay) })}</h4>
          {!!r.herd.notCounted && <p className="nutri-note is-warning">{t('nutrition.ration.herdNotCounted', { count: r.herd.headCount, other: r.herd.notCounted })}</p>}
          <ul className="nutri-list">
            {r.herd.lines.map(l => (
              <li key={l.key} className="nutri-list-row">
                <span className="nutri-list-main">{l.label}</span>
                <span className="nutri-list-meta">{t('nutrition.ration.herdLine', { amount: formatAmount(l.kgAsFedPerDay) })}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {plan.validation === 'vet_reviewed'
        ? <p className="nutri-hint">{t('nutrition.plan.reviewedBy', { name: plan.reviewedByName || t('nutrition.plan.aVet'), date: plan.reviewedAt ? new Date(plan.reviewedAt).toLocaleDateString(i18n.language) : '' })}</p>
        : <p className="nutri-hint">{t('nutrition.plan.suggestedNote')}</p>}
      {plan.reviewNote && <p className="nutri-quote">“{plan.reviewNote}”</p>}
      <p className="nutri-hint">{t(herd ? 'nutrition.ration.herdRecordHint' : 'nutrition.ration.recordHint')}</p>
      {children}
    </section>
  )
}

export default RationPlanCard
