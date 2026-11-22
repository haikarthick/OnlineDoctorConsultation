import React from 'react'
import { useTranslation } from 'react-i18next'
import { useMasterData } from '../../context/MasterDataContext'
import type { NutritionOverview } from './nutritionShared'

/**
 * Foods that are unsafe for this species - and, for species without a vetted calculator yet (rabbits, birds,
 * reptiles, fish...), the guidance the owner decided on: track weight and condition, feed what the vet advises.
 */
export const SafeFoodsTab: React.FC<{ data: NutritionOverview }> = ({ data }) => {
  const { t } = useTranslation()
  const { resolveLabel } = useMasterData()
  const unvalidated = data.unsafeFoods.some(u => u.status === 'unvalidated')
  return (
    <div className="nutri-tab">
      {!data.calculatorAvailable && (
        <section className="nutri-card">
          <h3 className="nutri-card-title">{t('nutrition.safe.guidanceTitle')}</h3>
          <p>{t(`nutrition.models.${data.model}`)}</p>
          <ul className="nutri-bullets">
            <li>{t('nutrition.safe.tipWeigh')}</li>
            <li>{t('nutrition.safe.tipCondition')}</li>
            <li>{t('nutrition.safe.tipChange')}</li>
            <li>{t('nutrition.safe.tipVet')}</li>
          </ul>
        </section>
      )}
      <section className="nutri-card" aria-label={t('nutrition.safe.title')}>
        <h3 className="nutri-card-title">{t('nutrition.safe.title')}</h3>
        {data.unsafeFoods.length === 0 ? (
          <p className="nutri-empty">{t('nutrition.safe.none')}</p>
        ) : (
          <>
            <ul className="nutri-list">
              {data.unsafeFoods.map(u => (
                <li key={u.id} className={`nutri-flag is-${u.severity === 'danger' ? 'act' : 'watch'}`}>
                  <span aria-hidden="true">{u.severity === 'danger' ? '⛔' : '⚠️'}</span>
                  <span className="nutri-flag-text">
                    <strong>{resolveLabel(u, t) || u.label}</strong>
                    <span className="nutri-hint">{t(u.severity === 'danger' ? 'nutrition.safe.danger' : 'nutrition.safe.caution')}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="nutri-list-meta">{t('nutrition.safe.source', { source: data.unsafeFoods[0].source })}{unvalidated ? ` · ${t('nutrition.safe.unvalidated')}` : ''}</p>
          </>
        )}
        <p className="nutri-hint">{t('nutrition.safe.emergency')}</p>
      </section>
    </div>
  )
}

export default SafeFoodsTab
