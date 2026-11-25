import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSaveAction } from '../../hooks/useSaveAction'
import { BottomSheet } from '../mobile/BottomSheet'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { formatAmount, formatKcal, planItemName, type NutritionPlan } from './nutritionShared'

interface Props {
  plan: NutritionPlan
  /** The animal's or the herd's name, for sheet titles and the shared text. */
  name: string
  canReview: boolean
  onChanged: () => void
}

/**
 * What can be done with a saved plan, the same for a pet plan, an animal's ration and a herd ration (Phase 3):
 *   - Share: a plain-text copy for WhatsApp / SMS (phone share sheet, else copied) - every role.
 *   - Review as vet / Prescribe as diet: shown when the server says this person may review. A prescribed diet becomes
 *     an ordinary prescription, so the owner and (for network prescriptions) the pharmacy see it with the others.
 */
export const PlanVetActions: React.FC<Props> = ({ plan, name, canReview, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [sheet, setSheet] = useState<'review' | 'prescribe' | null>(null)
  const [shared, setShared] = useState<'' | 'copied' | 'failed'>('')
  const [explained, setExplained] = useState<{ text: string; ai: boolean } | null>(null)
  const [explaining, setExplaining] = useState(false)
  const isPet = !plan.ration

  /** The screen's own explanation, from the same numbers - used whenever AI is off, busy or its text was rejected. */
  const builtIn = () => (isPet
    ? t('nutrition.explain.fallbackPet', { kcal: formatKcal(plan.effectiveKcal, i18n.language), meals: plan.mealsPerDay, goal: t(`nutrition.goals.${plan.goal}`) })
    : t('nutrition.explain.fallbackRation', { dm: plan.dailyDmKg ?? '-', cost: plan.ration?.totalCostPerDay ?? '-' }))
    + (plan.requiresVet && plan.validation !== 'vet_reviewed' ? ` ${t('nutrition.plan.requiresVet')}` : '')

  const explain = async () => {
    setExplaining(true)
    try {
      const res: any = await apiService.explainNutritionPlan(plan.id, (i18n.language || 'en').slice(0, 2))
      const text = res?.data?.source === 'ai' ? res.data.text : null
      setExplained(text ? { text, ai: true } : { text: builtIn(), ai: false })
    } catch {
      setExplained({ text: builtIn(), ai: false })
    } finally {
      setExplaining(false)
    }
  }

  const shareText = () => {
    const lines = plan.items.map(i => (isPet
      ? `- ${planItemName(t, i)}: ${t('nutrition.share.gramsLine', { perDay: i.gramsPerDay ?? '-', perMeal: i.gramsPerMeal ?? '-' })}`
      : `- ${planItemName(t, i)}: ${t('nutrition.ration.itemLine', { amount: formatAmount(i.amountPerDay) })}`))
    const head = isPet
      ? t('nutrition.share.petHead', { name, kcal: formatKcal(plan.effectiveKcal, i18n.language), meals: plan.mealsPerDay })
      : t('nutrition.share.rationHead', { name })
    const status = plan.validation === 'vet_reviewed' ? t('nutrition.plan.reviewed') : t('nutrition.plan.suggested')
    return [head, ...lines, plan.reviewNote ? `"${plan.reviewNote}"` : '', status].filter(Boolean).join('\n')
  }

  const share = async () => {
    const text = shareText()
    try {
      if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        await (navigator as any).share({ title: t('nutrition.share.title', { name }), text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShared('copied')
    } catch (err: any) {
      // The person closing the share sheet is not a failure.
      if (err?.name !== 'AbortError') setShared('failed')
    }
  }

  return (
    <>
      {plan.requiresVet && plan.validation !== 'vet_reviewed' && <p className="nutri-note is-warning">{t('nutrition.plan.requiresVet')}</p>}
      {plan.allergies && plan.allergies.length > 0 && <p className="nutri-hint">{t('nutrition.vet.allergies', { list: plan.allergies.join(', ') })}</p>}
      {plan.prescriptionId && <p className="nutri-pill is-reviewed">{t('nutrition.vet.prescribed')}</p>}
      {explained && (
        <div className="nutri-preview" role="status">
          <p>{explained.text}</p>
          <p className="nutri-list-meta">{explained.ai ? t('nutrition.explain.aiNote') : t('nutrition.explain.builtInNote')}</p>
        </div>
      )}
      <div className="nutri-actions">
        {!explained && (
          <button type="button" className="btn btn-secondary" disabled={explaining} onClick={() => { void explain() }}>
            {explaining ? t('nutrition.explain.working') : t('nutrition.explain.button')}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { void share() }}>{t('nutrition.share.button')}</button>
        {canReview && plan.validation !== 'vet_reviewed' && (
          <button type="button" className="btn btn-secondary" onClick={() => setSheet('review')}>{t('nutrition.plan.review')}</button>
        )}
        {canReview && !plan.prescriptionId && (
          <button type="button" className="btn btn-primary" onClick={() => setSheet('prescribe')}>{t('nutrition.vet.prescribe')}</button>
        )}
      </div>
      {shared === 'copied' && <p className="nutri-hint" role="status">{t('nutrition.share.copied')}</p>}
      {shared === 'failed' && <p className="nutri-note is-warning" role="status">{t('nutrition.share.failed')}</p>}
      {sheet === 'review' && (
        <ReviewSheet planId={plan.id} kcal={isPet ? plan.effectiveKcal : null} name={name}
          onClose={() => setSheet(null)} onSaved={() => { setSheet(null); onChanged() }} />
      )}
      {sheet === 'prescribe' && (
        <PrescribeSheet planId={plan.id} name={name} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); onChanged() }} />
      )}
    </>
  )
}

/** A vet confirms the plan; for a pet plan they may set the daily energy themselves (the grams are re-worked by the server). */
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
        {kcal !== null && (
          <NumberStepper label={t('nutrition.plan.reviewKcal')} value={value} onChange={setValue} step={10} integer unit="kcal" hint={t('nutrition.plan.reviewKcalHint')} />
        )}
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

/** A vet prescribes the plan as a diet for a number of days, with an optional note for the owner. */
const PrescribeSheet: React.FC<{ planId: string; name: string; onClose: () => void; onSaved: () => void }> = ({ planId, name, onClose, onSaved }) => {
  const { t } = useTranslation()
  const [days, setDays] = useState('30')
  const [note, setNote] = useState('')
  const save = useSaveAction(async () => {
    await apiService.prescribeNutritionPlan(planId, { durationDays: parseStepperValue(days), note: note.trim() || null })
  }, t('nutrition.errors.prescribe'))
  return (
    <BottomSheet open title={t('nutrition.vet.prescribeTitle', { name })} onClose={onClose}>
      <div className="record-sheet">
        <p className="nutri-hint">{t('nutrition.vet.prescribeHelp')}</p>
        <NumberStepper label={t('nutrition.vet.days')} value={days} onChange={setDays} step={7} integer min={1} max={365} unit={t('nutrition.vet.daysUnit')} />
        <label className="nutri-field">
          <span className="nutri-field-label">{t('nutrition.plan.reviewNote')}</span>
          <textarea className="form-input" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={save.status === 'saving'} onClick={async () => { if (await save.run()) onSaved() }}>{t('nutrition.vet.confirmPrescribe')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default PlanVetActions
