import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useNutritionEnabled } from '../../hooks/useNutritionEnabled'
import { userMessage } from '../../utils/userMessage'
import { ChipSelect } from '../mobile/ChipSelect'
import MissingFactsCard from './MissingFactsCard'
import TodayTab from './TodayTab'
import PlanTab from './PlanTab'
import BodyTab from './BodyTab'
import SafeFoodsTab from './SafeFoodsTab'
import { conditionBand, formatKcal, formatKg, type NutritionOverview } from './nutritionShared'

type Tab = 'today' | 'plan' | 'body' | 'safe'

interface Props {
  animalId: string
  /**
   * Compact: a one-line summary with "Show nutrition" - for screens where nutrition sits beside other things
   * (the animal detail, the vet's consultation room). Expands in place to the same full panel.
   */
  compact?: boolean
}

/**
 * THE nutrition panel - one component for every role and every screen that shows an animal (docs/NUTRITION_PLAN.md
 * §5.6). What a person can do here (record, change the plan, review it) comes from the server's answer for this
 * animal, never from a role check in the browser. Renders nothing while the module is switched off, and nothing
 * for someone the server says may not see this animal - it is an addition to those screens, never an error on them.
 */
export const NutritionPanel: React.FC<Props> = ({ animalId, compact = false }) => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { enabled } = useNutritionEnabled(!!user)
  const [data, setData] = useState<NutritionOverview | null>(null)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(!compact)
  const [tab, setTab] = useState<Tab>('today')

  const load = useCallback(async () => {
    try {
      const res: any = await apiService.nutritionOverview(animalId)
      setData(res?.data || null)
      setError('')
      setForbidden(false)
    } catch (err: any) {
      if (err?.response?.status === 403 && compact) setForbidden(true)
      else setError(userMessage(err, 'nutrition.errors.load'))
    } finally {
      setLoading(false)
    }
  }, [animalId, compact])

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setData(null)
    void load()
  }, [enabled, load])

  if (!enabled || forbidden) return null
  if (loading && !data) return <div className="nutri-panel"><p className="nutri-hint">{t('nutrition.loading')}</p></div>
  if (error && !data) {
    return (
      <div className="nutri-panel">
        <p className="nutri-note is-warning" role="status">{error}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); void load() }}>{t('nutrition.retry')}</button>
      </div>
    )
  }
  if (!data) return null

  const band = conditionBand(data.facts.bcs9)
  const acts = data.flags.filter(f => f.severity === 'act').length
  const summary = (
    <div className="nutri-summary">
      <span className="nutri-summary-item">🥣 {data.plan?.effectiveKcal ? t('nutrition.summary.kcal', { kcal: formatKcal(data.plan.effectiveKcal, i18n.language) }) : t('nutrition.summary.noPlan')}</span>
      {data.facts.weightKg !== null && <span className="nutri-summary-item">⚖️ {formatKg(data.facts.weightKg)} kg</span>}
      {band && <span className={`nutri-pill band-${band}`}>{t(`nutrition.band.${band}`)}</span>}
      {acts > 0 && <span className="nutri-pill is-act">{t('nutrition.summary.alerts', { count: acts })}</span>}
    </div>
  )

  if (compact && !open) {
    return (
      <section className="nutri-panel is-compact" aria-label={t('nutrition.title')}>
        <div className="nutri-card-head">
          <h4 className="nutri-card-title">{t('nutrition.title')}</h4>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)} aria-expanded={false}>{t('nutrition.show')}</button>
        </div>
        {summary}
      </section>
    )
  }

  const required = data.missingFacts.filter(m => m.required)
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'today', label: t('nutrition.tabs.today') },
    { value: 'plan', label: t('nutrition.tabs.plan') },
    { value: 'body', label: t('nutrition.tabs.body') },
    { value: 'safe', label: t('nutrition.tabs.safe') },
  ]

  return (
    <section className="nutri-panel" aria-label={t('nutrition.titleFor', { name: data.animal.name })}>
      <div className="nutri-card-head">
        <h3 className="nutri-panel-title">{t('nutrition.titleFor', { name: data.animal.name })}</h3>
        {compact && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)} aria-expanded>{t('nutrition.hide')}</button>}
      </div>
      {summary}
      {data.permissions.via === 'vet' && <p className="nutri-hint">{t('nutrition.vetAccess')}</p>}
      {error && <p className="nutri-note is-warning" role="status">{error}</p>}

      {data.permissions.canWrite && data.missingFacts.length > 0 && (required.length > 0 || tab === 'plan') && (
        <MissingFactsCard animalId={data.animal.id} model={data.model} missing={data.missingFacts} onSaved={() => { void load() }} />
      )}

      <ChipSelect label={t('nutrition.tabs.label')} variant="segmented" value={tab} onChange={setTab} options={tabs} />

      {tab === 'today' && <TodayTab data={data} onChanged={() => { void load() }} />}
      {tab === 'plan' && <PlanTab data={data} onChanged={() => { void load() }} />}
      {tab === 'body' && <BodyTab data={data} onSaved={() => { void load() }} />}
      {tab === 'safe' && <SafeFoodsTab data={data} />}
    </section>
  )
}

export default NutritionPanel
