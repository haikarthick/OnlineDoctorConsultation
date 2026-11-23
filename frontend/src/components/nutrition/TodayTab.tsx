import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSaveAction } from '../../hooks/useSaveAction'
import { userMessage } from '../../utils/userMessage'
import { BottomSheet } from '../mobile/BottomSheet'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { formatAmount, formatKcal, progressPct, type NutritionOverview } from './nutritionShared'
import FlagList from './FlagList'

interface Entry { id: string; label: string; kind: 'meal' | 'treat'; amountG: number | null; kcal: number | null; fedOn: string; recordedByName: string }

interface Props {
  data: NutritionOverview
  onChanged: () => void
}

const localToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Today at a glance: what needs attention, energy eaten against the plan, one-tap "fed as planned" for each
 * food, and anything else given (treats, leftovers). A food that is unsafe for this species is still saved -
 * it happened - but the screen says so at once and raises an alert for the vet.
 */
export const TodayTab: React.FC<Props> = ({ data, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadError, setLoadError] = useState('')
  const [logging, setLogging] = useState<'treat' | 'meal' | null>(null)
  const [warning, setWarning] = useState('')
  const today = localToday()
  const target = data.plan?.effectiveKcal ?? null
  const eaten = entries.filter(e => e.fedOn === today).reduce((s, e) => s + (e.kcal || 0), 0)
  const treats = entries.filter(e => e.fedOn === today && e.kind === 'treat').reduce((s, e) => s + (e.kcal || 0), 0)

  const load = useCallback(() => {
    apiService.listFeeding(data.animal.id, 2)
      .then((res: any) => { setEntries(res?.data?.items || []); setLoadError('') })
      .catch((err: unknown) => setLoadError(userMessage(err, 'nutrition.errors.loadFeeding')))
  }, [data.animal.id])
  useEffect(() => { load() }, [load])

  const quick = useSaveAction(async (planItemId: string, amountG: number | null) => {
    const res = await apiService.logFeeding(data.animal.id, { planItemId, kind: 'meal', amountG, fedOn: localToday() })
    const w = res?.data?.warnings || []
    setWarning(w.length ? t('nutrition.today.unsafeLogged', { food: res?.data?.label }) : '')
  }, t('nutrition.errors.logFeeding'))

  const remove = async (id: string) => {
    try { await apiService.deleteFeeding(id); load(); onChanged() } catch (err) { setLoadError(userMessage(err, 'nutrition.errors.deleteFeeding')) }
  }

  return (
    <div className="nutri-tab">
      {data.flags.length > 0 && <FlagList flags={data.flags} canAct={data.permissions.canWrite} onChanged={onChanged} />}
      {warning && <p className="nutri-note is-danger" role="alert">{warning}</p>}

      {['ruminant_dm', 'equine_dm', 'monogastric_spec', 'aqua_biomass'].includes(data.model) ? (
        // Farm animals: today's ration at a glance; feed given is recorded once, in Daily records.
        <section className="nutri-card" aria-label={t('nutrition.today.title')}>
          <h3 className="nutri-card-title">{t('nutrition.today.title')}</h3>
          {data.plan?.ration ? (
            <ul className="nutri-list">
              {data.plan.items.map(item => (
                <li key={item.id} className="nutri-list-row">
                  <span className="nutri-list-main"><strong>{item.label}</strong></span>
                  <span className="nutri-list-meta">{t('nutrition.ration.itemLine', { amount: formatAmount(item.amountPerDay) })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nutri-hint">{t('nutrition.ration.noneBody')}</p>
          )}
          <p className="nutri-hint">{t('nutrition.ration.recordHint')}</p>
        </section>
      ) : (
      <section className="nutri-card" aria-label={t('nutrition.today.title')}>
        <h3 className="nutri-card-title">{t('nutrition.today.title')}</h3>
        {target ? (
          <>
            <p className="nutri-big">{t('nutrition.today.eatenOf', { eaten: formatKcal(eaten, i18n.language), target: formatKcal(target, i18n.language) })}</p>
            <div className="nutri-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct(eaten, target)}
              aria-label={t('nutrition.today.progressLabel')}>
              {/* eslint-disable-next-line react/forbid-dom-props -- runtime-computed bar width (DESIGN_SYSTEM.md §3) */}
              <span className={`nutri-progress-fill ${eaten > target * 1.05 ? 'is-over' : ''}`} style={{ ['--fill' as string]: `${progressPct(eaten, target)}%` }} />
            </div>
            {eaten > target * 1.05 && <p className="nutri-hint">{t('nutrition.today.over', { kcal: formatKcal(eaten - target, i18n.language) })}</p>}
            {treats > 0 && <p className="nutri-hint">{t('nutrition.today.treats', { kcal: formatKcal(treats, i18n.language) })}</p>}
          </>
        ) : (
          <p className="nutri-hint">{data.calculatorAvailable ? t('nutrition.today.noPlan') : t('nutrition.today.guidanceOnly')}</p>
        )}

        {data.permissions.canWrite && data.plan && data.plan.items.length > 0 && (
          <div className="nutri-quick">
            {data.plan.items.map(item => (
              <button key={item.id} type="button" className="btn btn-secondary nutri-quick-btn" disabled={quick.status === 'saving'}
                onClick={async () => { if (await quick.run(item.id, item.gramsPerMeal)) { load(); onChanged() } }}>
                ✅ {item.gramsPerMeal ? t('nutrition.today.fedPortion', { food: item.label, grams: item.gramsPerMeal }) : t('nutrition.today.fed', { food: item.label })}
              </button>
            ))}
          </div>
        )}
        <SaveState status={quick.status} error={quick.error} offline={quick.offline} onRetry={quick.retry} savedMessage={t('nutrition.today.saved')} />
        {data.permissions.canWrite && (
          <div className="record-sheet-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setLogging('treat')}>🦴 {t('nutrition.today.addTreat')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setLogging('meal')}>🍽️ {t('nutrition.today.addOther')}</button>
          </div>
        )}
      </section>
      )}

      <section className="nutri-card" aria-label={t('nutrition.today.entriesTitle')}>
        <h3 className="nutri-card-title">{t('nutrition.today.entriesTitle')}</h3>
        {loadError && <p className="nutri-note is-warning" role="status">{loadError}</p>}
        {entries.filter(e => e.fedOn === today).length === 0 ? (
          <p className="nutri-empty">{t('nutrition.today.empty')}</p>
        ) : (
          <ul className="nutri-list">
            {entries.filter(e => e.fedOn === today).map(e => (
              <li key={e.id} className="nutri-list-row">
                <span className="nutri-list-main">
                  <strong>{e.label}</strong>
                  {e.kind === 'treat' && <span className="nutri-pill">{t('nutrition.today.treat')}</span>}
                </span>
                <span className="nutri-list-meta">
                  {e.amountG !== null ? `${e.amountG} g` : ''}{e.kcal !== null ? ` · ${formatKcal(e.kcal, i18n.language)} kcal` : ''}{e.recordedByName ? ` · ${e.recordedByName}` : ''}
                </span>
                {data.permissions.canWrite && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void remove(e.id) }} aria-label={t('nutrition.today.deleteEntry', { food: e.label })}>✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {logging && (
        <LogFoodSheet animalId={data.animal.id} kind={logging} onClose={() => setLogging(null)}
          onSaved={(w) => { setLogging(null); setWarning(w); load(); onChanged() }} />
      )}
    </div>
  )
}

/** A treat or any other food, by name and amount. Energy is worked out from the food's label value when known. */
const LogFoodSheet: React.FC<{ animalId: string; kind: 'meal' | 'treat'; onClose: () => void; onSaved: (warning: string) => void }> = ({ animalId, kind, onClose, onSaved }) => {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'meal' | 'treat'>(kind)
  const [label, setLabel] = useState('')
  const [grams, setGrams] = useState('')
  const [kcal, setKcal] = useState('')
  const result = React.useRef('')
  const save = useSaveAction(async () => {
    const res = await apiService.logFeeding(animalId, {
      label: label.trim(), kind: mode, amountG: parseStepperValue(grams), kcal: parseStepperValue(kcal), fedOn: localToday(),
    })
    result.current = (res?.data?.warnings || []).length ? t('nutrition.today.unsafeLogged', { food: label.trim() }) : ''
  }, t('nutrition.errors.logFeeding'))
  return (
    <BottomSheet open title={mode === 'treat' ? t('nutrition.today.addTreat') : t('nutrition.today.addOther')} onClose={onClose}>
      <div className="record-sheet">
        <ChipSelect label={t('nutrition.today.whatKind')} variant="segmented" value={mode} onChange={setMode}
          options={[{ value: 'meal', label: t('nutrition.today.meal') }, { value: 'treat', label: t('nutrition.today.treat') }]} />
        <label className="nutri-field">
          <span className="nutri-field-label">{t('nutrition.today.foodName')}</span>
          <input className="form-input" type="text" maxLength={200} value={label} onChange={e => setLabel(e.target.value)} />
        </label>
        <NumberStepper label={t('nutrition.today.amount')} value={grams} onChange={setGrams} step={10} unit="g" />
        <NumberStepper label={t('nutrition.today.energy')} value={kcal} onChange={setKcal} step={10} unit="kcal" hint={t('nutrition.today.energyHint')} />
        <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} />
        <div className="record-sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!label.trim() || save.status === 'saving'}
            onClick={async () => { if (await save.run()) onSaved(result.current) }}>{t('nutrition.today.save')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}

export default TodayTab
