import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useMasterData } from '../../context/MasterDataContext'
import { useSaveAction } from '../../hooks/useSaveAction'
import { userMessage } from '../../utils/userMessage'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import type { Food, NutritionModel } from './nutritionShared'

interface Chosen { ingredientId: string; label: string; price: string; maxKg: string }

/** Who the ration is for: one animal (its Plan tab) or a whole herd (the group's feed card). */
export interface RationTarget {
  kind: 'animal' | 'group'
  id: string
  name: string
  model: NutritionModel
  /** Recorded milk per day (the animal's, or the herd's average). */
  milk: number | null
  /** Horses / donkeys: the animal's recorded activity level. */
  work: string | null
  /** Herd only: average weight from the members' records, and how many animals. */
  avgWeightKg?: number | null
  headCount?: number
}

interface Props {
  target: RationTarget
  onClose: () => void
  onSaved: () => void
}

const WORK = ['low', 'moderate', 'high', 'working'] as const

const GROUPS: Array<{ key: string; kinds: string[] }> = [
  { key: 'fodder', kinds: ['forage'] },
  { key: 'concentrate', kinds: ['concentrate', 'compound_feed'] },
  { key: 'mineral', kinds: ['mineral', 'supplement'] },
]

/**
 * Least-cost ration (docs/NUTRITION_PLAN.md Phase 2) for a cow, buffalo, goat, sheep, horse or donkey - one animal
 * or a whole herd. The farmer ticks the feeds they have and what each costs; the server's engine finds the cheapest
 * mix that meets the need and shows kg per day, cost per day and (for milk) cost per litre; for a herd, also the
 * whole herd's total. Phone-first: tap to choose, steppers to adjust, no typing needed except a price.
 */
export const RationBuilderSheet: React.FC<Props> = ({ target, onClose, onSaved }) => {
  const { t, i18n } = useTranslation()
  const { resolveLabel } = useMasterData()
  const equine = target.model === 'equine_dm'
  const herd = target.kind === 'group'
  const [milk, setMilk] = useState(target.milk ? String(target.milk) : '')
  const [fat, setFat] = useState('')
  const [work, setWork] = useState<string>(WORK.includes(target.work as any) ? String(target.work) : 'low')
  const [avgWeight, setAvgWeight] = useState(target.avgWeightKg ? String(target.avgWeightKg) : '')
  const [library, setLibrary] = useState<Food[]>([])
  const [chosen, setChosen] = useState<Chosen[]>([])
  const [preview, setPreview] = useState<any>(null)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    let active = true
    apiService.listNutritionFoods(herd ? { groupId: target.id } : { animalId: target.id })
      .then((res: any) => { if (active) setLibrary((res?.data?.items || []).filter((f: Food) => GROUPS.some(g => g.kinds.includes(f.kind)))) })
      .catch(() => { if (active) setLibrary([]) })
    return () => { active = false }
  }, [target.id, herd])

  const name = (f: Food) => resolveLabel(f, t) || f.label
  const toggle = (f: Food) => setChosen(prev => (prev.some(c => c.ingredientId === f.id)
    ? prev.filter(c => c.ingredientId !== f.id)
    : [...prev, { ingredientId: f.id, label: name(f), price: '', maxKg: '' }]))
  const update = (id: string, patch: Partial<Chosen>) => setChosen(prev => prev.map(c => (c.ingredientId === id ? { ...c, ...patch } : c)))

  const payload = useMemo(() => ({
    ...(equine ? { work: work as typeof WORK[number] } : { milkLitresPerDay: parseStepperValue(milk) ?? 0, milkFatPct: parseStepperValue(fat) }),
    ...(herd ? { avgWeightKg: parseStepperValue(avgWeight) } : {}),
    feeds: chosen.map(c => ({ ingredientId: c.ingredientId, pricePerKg: parseStepperValue(c.price), maxKg: parseStepperValue(c.maxKg) })),
  }), [equine, herd, work, milk, fat, avgWeight, chosen])

  useEffect(() => {
    if (payload.feeds.length === 0) { setPreview(null); setPreviewError(''); return }
    let active = true
    const timer = window.setTimeout(() => {
      const call = herd ? apiService.previewGroupRation(target.id, payload) : apiService.previewRation(target.id, payload)
      call
        .then((res: any) => { if (active) { setPreview(res?.data || null); setPreviewError('') } })
        .catch((err: unknown) => { if (active) { setPreview(null); setPreviewError(userMessage(err, 'nutrition.errors.preview')) } })
    }, 400)
    return () => { active = false; window.clearTimeout(timer) }
  }, [payload, target.id, herd])

  const save = useSaveAction(async () => {
    if (herd) await apiService.saveGroupRation(target.id, payload)
    else await apiService.saveRation(target.id, payload)
  }, t('nutrition.errors.savePlan'))
  const result = preview?.result
  const money = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString(i18n.language, { maximumFractionDigits: 2 }))
  const reason = (r: string) => (equine && i18n.exists(`nutrition.ration.reasonsEquine.${r}`) ? t(`nutrition.ration.reasonsEquine.${r}`) : t(`nutrition.ration.reasons.${r}`))

  return (
    <BottomSheet open title={t(herd ? 'nutrition.ration.herdTitle' : 'nutrition.ration.title', { name: target.name })} onClose={onClose}>
      <div className="record-sheet nutri-builder">
        {herd && (
          <NumberStepper label={t('nutrition.ration.avgWeight')} value={avgWeight} onChange={setAvgWeight} step={5} unit="kg"
            hint={t('nutrition.ration.avgWeightHint', { count: target.headCount ?? 0 })} />
        )}
        {equine ? (
          <ChipSelect label={t('nutrition.ration.work')} value={work} onChange={setWork}
            options={WORK.map(w => ({ value: w, label: t(`nutrition.activity.${w}`) }))} />
        ) : (
          <>
            <NumberStepper label={t(herd ? 'nutrition.ration.milkHerd' : 'nutrition.ration.milk')} value={milk} onChange={setMilk} step={0.5} unit="L"
              hint={t(herd ? 'nutrition.ration.milkHerdHint' : 'nutrition.ration.milkHint')} />
            {(parseStepperValue(milk) ?? 0) > 0 && (
              <NumberStepper label={t('nutrition.ration.fat')} value={fat} onChange={setFat} step={0.1} max={15} unit="%" hint={t('nutrition.ration.fatHint')} />
            )}
          </>
        )}
        {equine && !herd && <p className="nutri-hint">{t('nutrition.ration.workHint')}</p>}

        {GROUPS.map(g => {
          const items = library.filter(f => g.kinds.includes(f.kind))
          if (items.length === 0) return null
          return (
            <fieldset key={g.key} className="chip-select">
              <legend className="chip-select-label">{t(equine && g.key !== 'mineral' ? `nutrition.ration.groups.${g.key}Equine` : `nutrition.ration.groups.${g.key}`)}</legend>
              <div className="chip-select-chips">
                {items.map(f => {
                  const on = chosen.some(c => c.ingredientId === f.id)
                  return (
                    <button key={f.id} type="button" className={`choice-chip ${on ? 'is-selected' : ''}`} aria-pressed={on} onClick={() => toggle(f)}>
                      {name(f)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {chosen.length > 0 && (
          <div className="nutri-subsection">
            <h4 className="nutri-sub-title">{t('nutrition.ration.pricesTitle')}</h4>
            {chosen.map(c => (
              <div key={c.ingredientId} className="nutri-food-row">
                <strong className="nutri-food-name">{c.label}</strong>
                <NumberStepper label={t('nutrition.ration.price')} value={c.price} onChange={v => update(c.ingredientId, { price: v })} step={1} unit="₹/kg" hint={t('nutrition.ration.priceHint')} />
                <NumberStepper label={t(herd ? 'nutrition.ration.maxKgHead' : 'nutrition.ration.maxKg')} value={c.maxKg} onChange={v => update(c.ingredientId, { maxKg: v })} step={1} unit="kg" hint={t('nutrition.ration.maxKgHint')} />
              </div>
            ))}
          </div>
        )}

        {previewError && <p className="nutri-note is-warning" role="status">{previewError}</p>}
        {result?.status === 'infeasible' && (
          <div className="nutri-note is-warning" role="status">
            <strong>{t('nutrition.ration.cannotBalance')}</strong>
            <ul className="nutri-bullets">{(result.reasons || []).map((r: string) => <li key={r}>{reason(r)}</li>)}</ul>
          </div>
        )}
        {result?.status === 'ok' && (
          <div className="nutri-preview" role="status">
            {herd && <h4 className="nutri-sub-title">{t('nutrition.ration.perHead')}</h4>}
            <p className="nutri-preview-kcal">{t('nutrition.ration.costPerDay', { cost: money(result.totalCostPerDay) })}
              {result.costPerLitre !== null && result.costPerLitre !== undefined ? ` · ${t('nutrition.ration.costPerLitre', { cost: money(result.costPerLitre) })}` : ''}</p>
            <ul className="nutri-list">
              {result.lines.map((l: any) => (
                <li key={l.key} className="nutri-list-row">
                  <span className="nutri-list-main"><strong>{l.label}</strong></span>
                  <span className="nutri-list-meta">{t('nutrition.ration.line', { kg: l.kgAsFedPerDay, cost: money(l.costPerDay) })}</span>
                </li>
              ))}
            </ul>
            {preview.herd && (
              <>
                <h4 className="nutri-sub-title">{t('nutrition.ration.herdTotal', { count: preview.herd.headCount, cost: money(preview.herd.totalCostPerDay) })}</h4>
                <ul className="nutri-list">
                  {preview.herd.lines.map((l: any) => (
                    <li key={l.key} className="nutri-list-row">
                      <span className="nutri-list-main">{l.label}</span>
                      <span className="nutri-list-meta">{t('nutrition.ration.herdLine', { kg: l.kgAsFedPerDay })}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="nutri-hint">{equine
              ? t('nutrition.ration.needLineEquine', { energy: result.need.deMcal, cp: result.need.cpMinG, dmMin: result.need.dmiMinKg, dmMax: result.need.dmiMaxKg, dm: result.supplied.dmKg, conc: result.supplied.concentratePct })
              : t('nutrition.ration.needLine', { energy: result.need.nelMcal, dmMin: result.need.dmiMinKg, dmMax: result.need.dmiMaxKg, dm: result.supplied.dmKg })}</p>
            <p className="nutri-hint">{t('nutrition.ration.basedOn', { set: preview.requirementSet?.title || '' })}{preview.requirementSet?.status === 'unvalidated' ? ` · ${t('nutrition.safe.unvalidated')}` : ''}</p>
          </div>
        )}

        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={result?.status !== 'ok' || save.status === 'saving'}
            onClick={async () => { if (await save.run()) onSaved() }}>
            {t('nutrition.ration.save')}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default RationBuilderSheet
