import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'

interface MyPlan { planName?: string; status?: string; seat_limit?: number; seatsUsed?: number | string; billing_cycle?: string | null; priceMonthly?: number | string | null; priceAnnually?: number | string | null }

/**
 * "My plan" for a corporate admin: which plan the network is on, how many of its seats are used and whether anything is paused.
 * The price shows only when the platform admin allows it (the server leaves it out otherwise). Read-only: plans are changed by the
 * platform admin. Renders nothing when the person has no network.
 */
const MyNetworkPlanCard: React.FC = () => {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<MyPlan | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    apiService.getMyNetworkSubscription()
      .then((res: any) => { if (live) setPlan(res?.data || null) })
      .catch(err => { if (live) setError(userMessage(err, 'hospitalNetworks.plan.loadFailed')) })
    return () => { live = false }
  }, [])

  if (error) return <div className="module-alert error" role="alert">{error}</div>
  if (!plan) return null
  const used = Number(plan.seatsUsed) || 0
  const limit = Number(plan.seat_limit) || 0
  const status = plan.status || 'trial'
  return (
    <div className="module-card hn-plan-card">
      <div className="card-header"><h3>{t('hospitalNetworks.plan.title')}</h3></div>
      <div className="card-body">
        <p><strong>{plan.planName || t('hospitalNetworks.plan.trial')}</strong> <span className={`module-badge ${status === 'active' ? 'badge-success' : 'badge-pending'}`}>{t(`hospitalNetworks.plan.status.${status}`, { defaultValue: status })}</span></p>
        <p>{t('hospitalNetworks.plan.seats', { used, limit })}</p>
        <progress className="hn-plan-bar" max={Math.max(limit, 1)} value={Math.min(used, Math.max(limit, 1))} aria-label={t('hospitalNetworks.plan.seats', { used, limit })} />
        {limit > 0 && used >= limit && <p className="hn-hint">{t('hospitalNetworks.plan.full')}</p>}
        {status === 'suspended' && <p className="hn-hint">{t('hospitalNetworks.plan.suspended')}</p>}
        {plan.priceMonthly != null && plan.priceMonthly !== '' && <p>{t('hospitalNetworks.plan.price', { amount: plan.priceMonthly })}</p>}
        <p className="hn-hint">{t('hospitalNetworks.plan.changeHint')}</p>
      </div>
    </div>
  )
}

export default MyNetworkPlanCard
