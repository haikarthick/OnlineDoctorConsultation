import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { userMessage } from '../../utils/userMessage'
import RationBuilderSheet from './RationBuilderSheet'
import RationPlanCard from './RationPlanCard'
import PlanVetActions from './PlanVetActions'
import type { NutritionModel, NutritionPlan } from './nutritionShared'

interface HerdOverview {
  group: { id: string; name: string; species: string; headCount: number }
  model: NutritionModel
  rationAvailable: boolean
  facts: { avgWeightKg: number | null; avgDailyMilkLitres: number | null }
  plan: NutritionPlan | null
  permissions: { canWrite: boolean; canReview: boolean }
}

/**
 * The ration for a whole herd of cattle, buffalo, goats, sheep, horses or donkeys - one least-cost mix for the
 * herd's average animal, with the total for every animal in it. Shown inside the group's feed card for the farmer
 * (group health sheet) and the vet (group consultation). Average weight and milk come from the members' records.
 */
export const HerdRationCard: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { t } = useTranslation()
  const [data, setData] = useState<HerdOverview | null>(null)
  const [error, setError] = useState('')
  const [building, setBuilding] = useState(false)

  const load = useCallback(async () => {
    try {
      const res: any = await apiService.groupRation(groupId)
      setData(res?.data || null)
      setError('')
    } catch (err) {
      setError(userMessage(err, 'nutrition.errors.load'))
    }
  }, [groupId])

  useEffect(() => { void load() }, [load])

  if (error) return <section className="nutri-card"><p className="nutri-note is-warning" role="status">{error}</p></section>
  if (!data) return null

  return (
    <>
      {data.plan ? (
        <RationPlanCard plan={data.plan} herd>
          {data.permissions.canWrite && (
            <button type="button" className="btn btn-secondary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.change')}</button>
          )}
          <PlanVetActions plan={data.plan} name={data.group.name} canReview={data.permissions.canReview} onChanged={() => { void load() }} />
        </RationPlanCard>
      ) : (
        <section className="nutri-card" aria-label={t('nutrition.ration.herdNone')}>
          <h4 className="nutri-card-title">🌾 {t('nutrition.ration.herdNone')}</h4>
          <p className="nutri-hint">{t('nutrition.ration.herdNoneBody', { count: data.group.headCount })}</p>
          {data.permissions.canWrite && data.group.headCount > 0 && (
            <button type="button" className="btn btn-primary nutri-wide-btn" onClick={() => setBuilding(true)}>{t('nutrition.ration.herdMake')}</button>
          )}
          {data.group.headCount === 0 && <p className="nutri-hint">{t('nutrition.ration.herdEmpty')}</p>}
        </section>
      )}
      {building && (
        <RationBuilderSheet
          target={{
            kind: 'group', id: data.group.id, name: data.group.name, model: data.model,
            milk: data.facts.avgDailyMilkLitres, work: null, avgWeightKg: data.facts.avgWeightKg, headCount: data.group.headCount,
          }}
          onClose={() => setBuilding(false)}
          onSaved={() => { setBuilding(false); void load() }}
        />
      )}
    </>
  )
}

export default HerdRationCard
