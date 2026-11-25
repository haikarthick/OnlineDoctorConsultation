import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useNutritionEnabled } from '../../hooks/useNutritionEnabled'
import { userMessage } from '../../utils/userMessage'
import HerdRationCard from './HerdRationCard'
import FlagList from './FlagList'

/**
 * Today's feed for a flock, pig batch or pond (or, for a herd of cattle / buffalo / goats / sheep / horses, its
 * balanced ration - HerdRationCard), and how well feed is turning into meat or eggs this cycle (FCR) -
 * one card for the farmer (group health sheet) and the vet (group consultation). It reads what the farm already
 * records in Daily records (sample weight, water temperature, feed, eggs) - nothing is entered twice. Renders
 * nothing while nutrition is switched off, or for someone the server says may not see the group.
 */
export const GroupFeedingCard: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { enabled } = useNutritionEnabled(!!user)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const timer = window.setTimeout(() => {
      apiService.groupFeeding(groupId)
        .then((res: any) => { if (active) { setData(res?.data || null); setError('') } })
        .catch((err: any) => {
          if (!active) return
          if (err?.response?.status === 403 || err?.response?.status === 404) setHidden(true)
          else setError(userMessage(err, 'nutrition.errors.load'))
        })
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [enabled, groupId, reload])

  if (!enabled || hidden) return null
  if (error) return <section className="nutri-card"><p className="nutri-note is-warning" role="status">{error}</p></section>
  if (!data) return null
  const money = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString(i18n.language, { maximumFractionDigits: 2 }))

  // Cattle, buffalo, goats, sheep, horses: a herd's feeding is a balanced ration, not a per-head table.
  if (data.status === 'herd_ration') return <HerdRationCard groupId={groupId} />

  if (data.status === 'no_curve') {
    return (
      <section className="nutri-card" aria-label={t('nutrition.group.title')}>
        <h4 className="nutri-card-title">🌾 {t('nutrition.group.title')}</h4>
        <p className="nutri-hint">{t('nutrition.group.noCurve')}</p>
      </section>
    )
  }
  const today = data.today
  return (
    <section className="nutri-card" aria-label={t('nutrition.group.title')}>
      <h4 className="nutri-card-title">🌾 {t('nutrition.group.title')}</h4>
      {today.status === 'needs' ? (
        <ul className="nutri-bullets">
          {today.missing.map((m: string) => <li key={m}>{t(`nutrition.group.needs.${m}`)}</li>)}
        </ul>
      ) : (
        <>
          <p className="nutri-big">{t('nutrition.group.perDay', { kg: today.kgPerDay })}</p>
          <p className="nutri-hint">
            {today.basis === 'per_head'
              ? t('nutrition.group.perHead', { g: today.gramsPerHead, count: data.inputs.headCount })
              : t('nutrition.group.biomass', { kg: today.biomassKg, rate: today.ratePct, count: data.inputs.headCount, g: data.inputs.avgWeightG })}
            {today.feedType ? ` · ${today.feedType}` : ''}
            {today.feedsPerDay ? ` · ${t('nutrition.group.feeds', { count: today.feedsPerDay })}` : ''}
          </p>
          {today.cautionKey && <p className="nutri-note is-warning">{t(`nutrition.group.cautions.${today.cautionKey}`, { defaultValue: '' })}</p>}
          {today.basis === 'percent_biomass' && today.tempFactor !== 1 && (
            <p className="nutri-note is-warning">{t('nutrition.group.temp', { c: data.inputs.waterTempC, pct: Math.round(today.tempFactor * 100) })}</p>
          )}
          {data.inputs.pricePerKg === null && <p className="nutri-hint">{t('nutrition.group.priceFromStock')}</p>}
          {today.costPerDay !== null && <p className="nutri-hint">{t('nutrition.ration.costPerDay', { cost: money(today.costPerDay) })}</p>}
        </>
      )}
      <div className="nutri-summary">
        <span className="nutri-summary-item">{t('nutrition.group.cycleFeed', { kg: data.cycle.feedKg })}</span>
        {data.cycle.fcr !== null
          ? <span className="nutri-pill is-reviewed">{t(data.curve.product === 'eggs' ? 'nutrition.group.fcrEggs' : 'nutrition.group.fcr', { fcr: data.cycle.fcr })}</span>
          : <span className="nutri-hint">{t(data.curve.product === 'eggs' ? 'nutrition.group.fcrNeedsEggs' : 'nutrition.group.fcrNeedsWeights')}</span>}
      </div>
      <FlagList flags={data.flags || []} canAct={!!data.canAct} onChanged={() => setReload(n => n + 1)} />
      <p className="nutri-list-meta">{t('nutrition.group.basedOn', { title: data.curve.title })}{data.curve.status === 'unvalidated' ? ` · ${t('nutrition.safe.unvalidated')}` : ''}</p>
    </section>
  )
}

export default GroupFeedingCard
