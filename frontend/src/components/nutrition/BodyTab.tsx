import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useSaveAction } from '../../hooks/useSaveAction'
import { ChipSelect } from '../mobile/ChipSelect'
import { NumberStepper, parseStepperValue } from '../mobile/NumberStepper'
import { SaveState } from '../mobile/SaveState'
import { bcsScaleFor, conditionBand, formatKg, type NutritionOverview } from './nutritionShared'

interface Props {
  data: NutritionOverview
  onSaved: () => void
}

/**
 * Weight, body condition and muscle condition - entered here, stored in the ONE body-measurement history that
 * medical records and farm health observations also write to (migration 056). Shows the last 20 entries from
 * every source, so the owner, the farm team and the vet all read the same history.
 */
export const BodyTab: React.FC<Props> = ({ data, onSaved }) => {
  const { t, i18n } = useTranslation()
  const scale = bcsScaleFor(data.model)
  const showMuscle = data.model === 'companion_energy' || data.model === 'guidance_only' || data.model === 'equine_dm'
  const last = data.measurements.find(m => m.weightKg !== null)
  const [weight, setWeight] = useState('')
  const [bcs, setBcs] = useState('')
  const [muscle, setMuscle] = useState('')

  const save = useSaveAction(async () => {
    await apiService.addBodyMeasurement(data.animal.id, {
      weight: parseStepperValue(weight), unit: 'kg',
      bodyConditionScore: bcs ? Number(bcs) : null, bcsScale: bcs ? scale : null,
      muscleCondition: muscle || null,
    })
  }, t('nutrition.errors.saveBody'))

  const ready = parseStepperValue(weight) !== null || !!bcs || !!muscle
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)

  return (
    <div className="nutri-tab">
      {data.permissions.canWrite && (
        <section className="nutri-card" aria-label={t('nutrition.body.addTitle')}>
          <h3 className="nutri-card-title">{t('nutrition.body.addTitle')}</h3>
          <div className="nutri-form">
            <NumberStepper label={t('nutrition.body.weight')} value={weight} onChange={setWeight} step={0.5} unit="kg"
              quickValues={last?.weightKg ? [last.weightKg] : undefined}
              hint={last?.weightKg ? t('nutrition.body.lastWeight', { value: formatKg(last.weightKg), date: date(last.recordedAt) }) : undefined} />
            <ChipSelect label={t('nutrition.body.bcs', { scale })} value={bcs} allowClear onClear={() => setBcs('')} onChange={setBcs}
              options={Array.from({ length: scale }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            <p className="nutri-hint">{t(scale === 9 ? 'nutrition.body.bcsGuide9' : 'nutrition.body.bcsGuide5')}</p>
            {showMuscle && (
              <ChipSelect label={t('nutrition.body.muscle')} value={muscle} allowClear onClear={() => setMuscle('')} onChange={setMuscle}
                options={['normal', 'mild', 'moderate', 'marked'].map(v => ({ value: v, label: t(`nutrition.muscle.${v}`) }))} />
            )}
          </div>
          <SaveState status={save.status} error={save.error} offline={save.offline} onRetry={save.retry} savedMessage={t('nutrition.body.saved')} />
          <button type="button" className="btn btn-primary nutri-wide-btn" disabled={!ready || save.status === 'saving'}
            onClick={async () => { if (await save.run()) { setWeight(''); setBcs(''); setMuscle(''); onSaved() } }}>
            {t('nutrition.body.save')}
          </button>
        </section>
      )}

      <section className="nutri-card" aria-label={t('nutrition.body.historyTitle')}>
        <h3 className="nutri-card-title">{t('nutrition.body.historyTitle')}</h3>
        {data.measurements.length === 0 ? (
          <p className="nutri-empty">{t('nutrition.body.empty')}</p>
        ) : (
          <ul className="nutri-list">
            {data.measurements.map(m => {
              const band = conditionBand(m.bcs9)
              return (
                <li key={m.id} className="nutri-list-row">
                  <span className="nutri-list-main">
                    {m.weightKg !== null && <strong>{formatKg(m.weight)} {m.unit}</strong>}
                    {m.bodyConditionScore !== null && (
                      <span className={`nutri-pill band-${band}`}>
                        {t('nutrition.body.bcsShort', { score: m.bodyConditionScore, scale: m.bcsScale })} · {t(`nutrition.band.${band}`)}
                      </span>
                    )}
                    {m.muscleCondition && m.muscleCondition !== 'normal' && (
                      <span className="nutri-pill band-overweight">{t(`nutrition.muscle.${m.muscleCondition}`)}</span>
                    )}
                  </span>
                  <span className="nutri-list-meta">
                    {date(m.recordedAt)} · {t(`nutrition.source.${m.source}`, { defaultValue: m.source })}{m.recordedByName ? ` · ${m.recordedByName}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default BodyTab
