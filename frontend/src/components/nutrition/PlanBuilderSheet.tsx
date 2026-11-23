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
import { evenShares, formatKcal, type Food, type NutritionOverview } from './nutritionShared'

interface Chosen { ingredientId: string | null; label: string; kcalPer100g: string; sharePct: string; fromLibrary: boolean }

interface Props {
  data: NutritionOverview
  onClose: () => void
  onSaved: () => void
}

const GOALS = ['maintain', 'lose', 'gain', 'growth', 'gestation', 'lactation'] as const

/**
 * Builds a food plan: choose a goal, the foods (from the library or the pack in hand), how the day is shared
 * between them - and the server works out the energy and grams (engine/, never the browser). The preview
 * updates as you change things; nothing is stored until Save.
 */
export const PlanBuilderSheet: React.FC<Props> = ({ data, onClose, onSaved }) => {
  const { t, i18n } = useTranslation()
  const { resolveLabel } = useMasterData()
  const current = data.plan
  const [goal, setGoal] = useState<string>(current?.goal || '')
  const [meals, setMeals] = useState(String(current?.mealsPerDay || 2))
  const [target, setTarget] = useState(current?.targetWeightKg ? String(current.targetWeightKg) : '')
  const [chosen, setChosen] = useState<Chosen[]>(() => (current?.items || []).map(i => ({
    ingredientId: i.ingredientId, label: i.label, kcalPer100g: i.kcalPer100g === null ? '' : String(i.kcalPer100g),
    sharePct: String(i.sharePct ?? 100), fromLibrary: !!i.ingredientId,
  })))
  const [markReviewed, setMarkReviewed] = useState(false)
  const [library, setLibrary] = useState<Food[]>([])
  const [search, setSearch] = useState('')
  const [newFood, setNewFood] = useState<{ label: string; kcal: string } | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    let active = true
    apiService.listNutritionFoods({ animalId: data.animal.id })
      .then((res: any) => { if (active) setLibrary(res?.data?.items || []) })
      .catch(() => { if (active) setLibrary([]) })
    return () => { active = false }
  }, [data.animal.id])

  const foodName = (f: Food) => resolveLabel(f, t) || f.label
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? library.filter(f => foodName(f).toLowerCase().includes(q) || f.label.toLowerCase().includes(q)) : library
    return list.slice(0, 30)
  }, [library, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFood = (f: { ingredientId: string | null; label: string; kcalPer100g: number | null; fromLibrary: boolean }) => {
    if (chosen.length >= 12) return
    const next = [...chosen, { ...f, kcalPer100g: f.kcalPer100g === null ? '' : String(f.kcalPer100g), sharePct: '0' }]
    const shares = evenShares(next.length)
    setChosen(next.map((c, i) => ({ ...c, sharePct: String(shares[i]) })))
  }
  const update = (i: number, patch: Partial<Chosen>) => setChosen(prev => prev.map((c, k) => (k === i ? { ...c, ...patch } : c)))
  const remove = (i: number) => setChosen(prev => prev.filter((_, k) => k !== i))

  const payload = useMemo(() => ({
    goal: goal || null,
    targetWeightKg: (goal === 'lose' || goal === 'gain') ? parseStepperValue(target) : null,
    mealsPerDay: Math.max(1, Math.round(parseStepperValue(meals) || 2)),
    foods: chosen.map(c => ({
      ingredientId: c.ingredientId, label: c.ingredientId ? null : c.label,
      kcalPer100g: parseStepperValue(c.kcalPer100g), sharePct: parseStepperValue(c.sharePct) || 0,
    })).filter(f => f.sharePct > 0),
  }), [goal, target, meals, chosen])

  // Live preview from the server's engine (debounced): the browser never computes a portion itself.
  useEffect(() => {
    if (payload.foods.length === 0) { setPreview(null); setPreviewError(''); return }
    let active = true
    const timer = window.setTimeout(() => {
      apiService.previewNutritionPlan(data.animal.id, payload)
        .then((res: any) => { if (active) { setPreview(res?.data || null); setPreviewError('') } })
        .catch((err: unknown) => { if (active) { setPreview(null); setPreviewError(userMessage(err, 'nutrition.errors.preview')) } })
    }, 400)
    return () => { active = false; window.clearTimeout(timer) }
  }, [payload, data.animal.id])

  const save = useSaveAction(async () => {
    await apiService.saveNutritionPlan(data.animal.id, { ...payload, markReviewed: markReviewed && data.permissions.canReview })
  }, t('nutrition.errors.savePlan'))

  const addOwn = useSaveAction(async () => {
    if (!newFood) return
    const res = await apiService.createNutritionFood({
      animalId: data.animal.id, label: newFood.label.trim(), kcalPer100g: parseStepperValue(newFood.kcal), kind: 'commercial_food',
    })
    const f: Food | undefined = res?.data
    if (f) { setLibrary(prev => [f, ...prev]); addFood({ ingredientId: f.id, label: f.label, kcalPer100g: f.kcalPer100g, fromLibrary: true }) }
    setNewFood(null)
  }, t('nutrition.errors.saveFood'))

  const shareTotal = chosen.reduce((s, c) => s + (parseStepperValue(c.sharePct) || 0), 0)
  const lineFor = (i: number) => preview?.portions?.lines?.[i]
  const suggested = preview?.energy?.suggestedGoal

  return (
    <BottomSheet open title={t('nutrition.plan.builderTitle', { name: data.animal.name })} onClose={onClose}>
      <div className="record-sheet nutri-builder">
        <ChipSelect label={t('nutrition.plan.goal')} value={goal} allowClear onClear={() => setGoal('')} onChange={setGoal}
          options={GOALS.map(g => ({ value: g, label: t(`nutrition.goals.${g}`) }))} />
        {!goal && suggested && <p className="nutri-hint">{t('nutrition.plan.suggestedGoal', { goal: t(`nutrition.goals.${suggested}`) })}</p>}
        {(goal === 'lose' || goal === 'gain') && (
          <NumberStepper label={t('nutrition.plan.targetWeight')} value={target} onChange={setTarget} step={0.5} unit="kg"
            hint={t('nutrition.plan.targetWeightHint')} />
        )}
        <NumberStepper label={t('nutrition.plan.meals')} value={meals} onChange={setMeals} min={1} max={6} integer quickValues={[1, 2, 3]} />

        <div className="nutri-subsection">
          <h4 className="nutri-sub-title">{t('nutrition.plan.foodsTitle')}</h4>
          {chosen.length === 0 && <p className="nutri-hint">{t('nutrition.plan.foodsEmpty')}</p>}
          {chosen.map((c, i) => {
            const line = lineFor(i)
            return (
              <div key={`${c.ingredientId || c.label}-${i}`} className="nutri-food-row">
                <div className="nutri-food-head">
                  <strong className="nutri-food-name">{c.label}</strong>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(i)}>{t('nutrition.plan.remove')}</button>
                </div>
                <NumberStepper label={t('nutrition.plan.kcalPer100g')} value={c.kcalPer100g} onChange={v => update(i, { kcalPer100g: v })}
                  step={5} max={1000} unit="kcal" hint={t('nutrition.plan.kcalHint')} />
                {chosen.length > 1 && (
                  <NumberStepper label={t('nutrition.plan.share')} value={c.sharePct} onChange={v => update(i, { sharePct: v })} step={5} max={100} unit="%" integer />
                )}
                {line && (
                  <p className="nutri-portion">
                    {line.gramsPerDay === null
                      ? t('nutrition.plan.needsKcal')
                      : t('nutrition.plan.portion', { perDay: line.gramsPerDay, perMeal: line.gramsPerMeal, kcal: formatKcal(line.kcalPerDay, i18n.language) })}
                  </p>
                )}
              </div>
            )
          })}
          {chosen.length > 1 && Math.round(shareTotal) !== 100 && <p className="nutri-hint">{t('nutrition.plan.sharesNote', { total: Math.round(shareTotal) })}</p>}

          {chosen.length < 12 && (
            <div className="nutri-picker">
              <input className="form-input" type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('nutrition.plan.searchFoods')} aria-label={t('nutrition.plan.searchFoods')} />
              <ul className="nutri-picker-list">
                {visible.map(f => (
                  <li key={f.id}>
                    <button type="button" className="nutri-picker-item" onClick={() => addFood({ ingredientId: f.id, label: foodName(f), kcalPer100g: f.kcalPer100g, fromLibrary: true })}>
                      <span>{foodName(f)}{f.isOwn ? ` · ${t('nutrition.plan.yourFood')}` : ''}</span>
                      <span className="nutri-list-meta">{f.kcalPer100g !== null ? t('nutrition.plan.kcalValue', { kcal: f.kcalPer100g }) : t('nutrition.plan.kcalUnknown')}</span>
                    </button>
                  </li>
                ))}
                {visible.length === 0 && <li className="nutri-hint">{t('nutrition.plan.noFoodsFound')}</li>}
              </ul>
              {newFood ? (
                <div className="nutri-new-food">
                  <label className="nutri-field">
                    <span className="nutri-field-label">{t('nutrition.plan.newFoodName')}</span>
                    <input className="form-input" type="text" maxLength={200} value={newFood.label} onChange={e => setNewFood({ ...newFood, label: e.target.value })} />
                  </label>
                  <NumberStepper label={t('nutrition.plan.kcalPer100g')} value={newFood.kcal} onChange={v => setNewFood({ ...newFood, kcal: v })} step={5} max={1000} unit="kcal" hint={t('nutrition.plan.kcalHint')} />
                  <SaveState status={addOwn.status} error={addOwn.error} offline={addOwn.offline} onRetry={addOwn.retry} />
                  <div className="record-sheet-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setNewFood(null)}>{t('common.cancel')}</button>
                    <button type="button" className="btn btn-primary" disabled={!newFood.label.trim() || addOwn.status === 'saving'} onClick={() => { void addOwn.run() }}>{t('nutrition.plan.addFood')}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => setNewFood({ label: search.trim(), kcal: '' })}>
                  ➕ {t('nutrition.plan.addOwnFood')}
                </button>
              )}
            </div>
          )}
        </div>

        {previewError && <p className="nutri-note is-warning" role="status">{previewError}</p>}
        {preview && (
          <div className="nutri-preview" role="status">
            <p className="nutri-preview-kcal">{t('nutrition.plan.dailyEnergy', { kcal: formatKcal(preview.energy?.dailyKcal, i18n.language) })}</p>
            {(preview.energy?.reasons || []).filter((r: string) => r !== 'neutered' && r !== 'intact').map((r: string) => (
              <p key={r} className="nutri-hint">{t(`nutrition.reasons.${r}`)}</p>
            ))}
            {preview.energy?.requiresVet && <p className="nutri-note is-warning">{t('nutrition.plan.requiresVet')}</p>}
            {(preview.unsafe || []).map((u: any) => (
              <p key={`${u.food}-${u.item}`} className={`nutri-note ${u.severity === 'danger' ? 'is-danger' : 'is-warning'}`}>
                {u.kind === 'allergy' ? t('nutrition.plan.allergyFood', { food: u.food, allergen: u.item }) : t('nutrition.plan.unsafeFood', { food: u.food })}
              </p>
            ))}
          </div>
        )}

        {data.permissions.canReview && (
          <label className="nutri-check">
            <input type="checkbox" checked={markReviewed} onChange={e => setMarkReviewed(e.target.checked)} />
            <span>{t('nutrition.plan.markReviewed')}</span>
          </label>
        )}
        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={payload.foods.length === 0 || save.status === 'saving' || !!previewError}
            onClick={async () => { if (await save.run()) onSaved() }}>
            {t('nutrition.plan.save')}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default PlanBuilderSheet
