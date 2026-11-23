import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiService from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useNutritionEnabled } from '../../hooks/useNutritionEnabled'
import DashboardStatsGrid from './DashboardStatsGrid'
import type { StatCard } from './dashboardShared'

interface Summary { total: number; attention: number; toReview: number; noPlan: number; feedCostToday: number | null }

/**
 * Feeding at a glance on the dashboard, for every role that has animals: what needs attention, what waits for a vet,
 * which animals have no plan, and (farm) today's feed cost. The same stat cards the rest of the dashboard uses; each
 * opens the Nutrition list already filtered. Shows nothing while nutrition is switched off or there is nothing to say.
 */
const NutritionSummaryPanel: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { formatCurrency } = useSettings()
  const { enabled } = useNutritionEnabled(!!user)
  const [s, setS] = useState<Summary | null>(null)

  useEffect(() => {
    if (!enabled) return
    let active = true
    apiService.nutritionSummary().then((res: any) => { if (active) setS(res?.data || null) }).catch(() => { if (active) setS(null) })
    return () => { active = false }
  }, [enabled])

  if (!enabled || !s || s.total === 0) return null
  const isVet = user?.role === 'veterinarian'
  const cards: StatCard[] = [
    { label: t('nutrition.dashboard.attention'), value: s.attention, icon: '⚠️', color: '#ef4444', path: '/nutrition?filter=attention' },
    ...(isVet || user?.role === 'admin' ? [{ label: t('nutrition.dashboard.toReview'), value: s.toReview, icon: '🩺', color: '#8b5cf6', path: '/nutrition?filter=to_review' }] : []),
    { label: t('nutrition.dashboard.noPlan'), value: s.noPlan, icon: '🥣', color: '#f59e0b', path: '/nutrition?filter=no_plan' },
  ]
  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h2 className="section-title">{t('nutrition.dashboard.title')}</h2>
        {s.feedCostToday !== null && <span className="nutri-hint">{t('nutrition.dashboard.feedCostToday', { cost: formatCurrency(s.feedCostToday) })}</span>}
      </div>
      <DashboardStatsGrid statCards={cards} loading={false} />
    </section>
  )
}

export default NutritionSummaryPanel
